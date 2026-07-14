// Edge function for the external Railway "utilities bot" to read/update
// bot_orders without ever seeing the service-role key. Auth = WORKER_TOKEN
// header, validated against the existing worker_tokens table via the
// _worker_token_lookup() SECURITY DEFINER function.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DM_TYPES = {
  in_build: "dm_sent",
  ready: "ready_dm_sent",
  cancel: "cancel_dm_sent",
} as const;
type DmType = keyof typeof DM_TYPES;

function normalizeBotConfig(feature: string, row: any) {
  if (!row || feature !== "server-stats") return row;
  const config = { ...(row.config ?? {}) };
  const minutes = Number(config.update_interval_minutes ?? 10);
  config.update_interval_minutes = Math.max(10, Number.isFinite(minutes) ? minutes : 10);
  return { ...row, config };
}

/**
 * After the bot's first online heartbeat, push the customer-chosen
 * `bot_orders.bot_name` to Discord as the bot's username. Only runs once
 * per bot (gated by `bot_orders.auto_identity_applied_at`).
 */
async function maybeApplyInitialIdentity(
  admin: ReturnType<typeof createClient>,
  botId: string,
): Promise<void> {
  const { data: order, error } = await admin
    .from("bot_orders")
    .select("id, bot_name, auto_identity_applied_at")
    .eq("id", botId)
    .maybeSingle();
  if (error || !order) return;
  if (order.auto_identity_applied_at) return;
  const username = typeof order.bot_name === "string" ? order.bot_name.trim() : "";
  if (username.length < 2 || username.length > 32) return;

  const { data: tokenData, error: tokenErr } = await admin.rpc(
    "runtime_resolve_bot_token",
    { _bot_id: botId },
  );
  if (tokenErr) {
    console.warn("[auto-identity] token lookup failed", botId, tokenErr.message);
    return;
  }
  const botToken = typeof tokenData === "string" ? tokenData : null;
  if (!botToken) return;

  const dRes = await fetch("https://discord.com/api/v10/users/@me", {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username }),
  });
  const rawBody = await dRes.text();
  console.log(
    `[auto-identity] bot=${botId} username=${username} discord_status=${dRes.status} body=${rawBody.slice(0, 300)}`,
  );
  if (!dRes.ok) return;

  const nowIso = new Date().toISOString();
  await admin
    .from("bot_orders")
    .update({
      auto_identity_applied_at: nowIso,
      discord_last_username_change_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", botId);
}

function normalizeWorkerToken(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim()
    .replace(/^['\"]|['\"]$/g, "");
}

function getWorkerToken(req: Request): { token: string; source: string } {
  const candidates: Array<[string, string]> = [
    ["x-worker-token", normalizeWorkerToken(req.headers.get("x-worker-token"))],
    ["x_worker_token", normalizeWorkerToken(req.headers.get("x_worker_token"))],
    ["worker-token", normalizeWorkerToken(req.headers.get("worker-token"))],
    ["authorization", normalizeWorkerToken(req.headers.get("authorization"))],
    ["x-authorization", normalizeWorkerToken(req.headers.get("x-authorization"))],
  ];
  const match = candidates.find(([, token]) => token.startsWith("wkr_"));
  return match ? { source: match[0], token: match[1] } : { token: "", source: "none" };
}

async function authenticate(req: Request): Promise<boolean> {
  const { token, source } = getWorkerToken(req);
  if (!token) {
    console.warn("utilities-bot-api auth failed: no worker token carrier", {
      hasXWorkerToken: req.headers.has("x-worker-token"),
      hasXWorkerTokenUnderscore: req.headers.has("x_worker_token"),
      hasAuthorization: req.headers.has("authorization"),
    });
    return false;
  }
  const { data, error } = await admin.rpc("_worker_token_lookup", {
    _token: token,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    console.warn("utilities-bot-api auth failed: worker token lookup rejected", {
      source,
      error: error?.message,
    });
    return false;
  }
  // touch last_used_at — fire and forget
  const tokenId = Array.isArray(data) ? data[0]?.token_id : (data as any).token_id;
  if (tokenId) {
    admin
      .from("worker_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenId)
      .then(() => {});
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!(await authenticate(req))) {
    return json(401, { error: "Invalid or missing worker token" });
  }

  const url = new URL(req.url);
  // Strip the function name prefix so we can route on the rest.
  const path = url.pathname.replace(/^.*\/utilities-bot-api/, "") || "/";

  try {
    // POST /heartbeat { bot_id, status, guilds? }
    if (req.method === "POST" && path.startsWith("/heartbeat")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      const status = String(body.status || "");

      if (!botId) return json(400, { error: "bot_id required" });
      if (!status) return json(400, { error: "status required" });

      const { data: order, error: orderError } = await admin
        .from("bot_orders")
        .select("user_id")
        .eq("id", botId)
        .single();
      if (orderError || !order) {
        return json(404, { error: "Bot order not found" });
      }

      const now = new Date().toISOString();
      const upsertData: Record<string, unknown> = {
        bot_id: botId,
        user_id: order.user_id,
        status,
        last_heartbeat_at: now,
        updated_at: now,
      };
      if (body.guilds !== undefined) upsertData.guilds = body.guilds;

      // During a zero-downtime redeploy the OLD container keeps heartbeating
      // "online" while the new one builds — don't let that wipe out a fresh
      // dashboard-driven transition (Restarting…/Redeploying…/Stopping…).
      // bot-status-sync moves the label to its real end state from Railway.
      const TRANSITIONAL = new Set(["stopping", "starting", "restarting", "updating"]);
      const TRANSITION_HOLD_MS = 3 * 60_000;
      if (status === "online") {
        const { data: existing } = await admin
          .from("bot_runtime_status")
          .select("status, updated_at")
          .eq("bot_id", botId)
          .maybeSingle();
        if (
          existing &&
          TRANSITIONAL.has(existing.status) &&
          existing.updated_at &&
          Date.now() - new Date(existing.updated_at).getTime() < TRANSITION_HOLD_MS
        ) {
          upsertData.status = existing.status;
          delete upsertData.updated_at; // preserve the transition's start time
        }
      }

      const { error: upsertError } = await admin
        .from("bot_runtime_status")
        .upsert(upsertData, { onConflict: "bot_id" });
      if (upsertError) return json(500, { error: upsertError.message });

      // First-heartbeat-after-deploy: push the customer's chosen bot name to
      // Discord. We wait for the heartbeat (instead of doing it right after
      // Railway deploy) because the bot token isn't usable until the gateway
      // session is live. Fire-and-forget — failures shouldn't break the heartbeat.
      maybeApplyInitialIdentity(admin, botId).catch((err) => {
        console.warn("[utilities-bot-api] auto identity failed", botId, err);
      });

      return json(200, { ok: true });
    }

    // GET /pending?type=in_build|ready|cancel&limit=25
    if (req.method === "GET" && path.startsWith("/pending")) {
      const type = url.searchParams.get("type") as DmType | null;
      if (!type || !(type in DM_TYPES)) {
        return json(400, { error: "type must be in_build, ready, or cancel" });
      }
      const limit = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get("limit") || "25")),
      );
      const flag = DM_TYPES[type];
      let query = admin
        .from("bot_orders")
        .select(
          "id, user_id, bot_name, status, discord_user_id, discord_username, total_amount, currency, addons, base, notes, confirmation_deadline_at, created_at, deployment_status, railway_service_id",
        )
        .eq("status", type)
        .eq(flag, false);

      // For the "ready" DM, surface orders whose Railway deployment finished
      // (deployment_status='deployed' and a service id exists). We previously
      // also required a bot_runtime_status heartbeat, but utilities/support
      // bots don't heartbeat back through this API before the customer is
      // notified, so that gate prevented any ready DM from ever being sent.
      if (type === "ready") {
        query = query.eq("deployment_status", "deployed").not("railway_service_id", "is", null);
      }

      const { data, error } = await query
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) return json(500, { error: error.message });

      return json(200, { orders: data ?? [] });
    }

    // POST /record-metrics { bot_id, commands, messages, errors, active_servers, member_count }
    if (req.method === "POST" && path.startsWith("/record-metrics")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      if (!botId) return json(400, { error: "bot_id required" });

      const { token } = getWorkerToken(req);

      const { error: rpcError } = await admin.rpc("runtime_record_bot_metrics", {
        _token: token,
        _bot_id: botId,
        _commands_delta: Number(body.commands ?? 0),
        _messages_delta: Number(body.messages ?? 0),
        _errors_delta: Number(body.errors ?? 0),
        _active_servers: body.active_servers != null ? Number(body.active_servers) : null,
        _member_count: body.member_count != null ? Number(body.member_count) : null,
      });
      if (rpcError) return json(500, { error: rpcError.message });
      return json(200, { ok: true });
    }

    // GET /bot-config?bot_id=...&feature=music-addon
    if (req.method === "GET" && path.startsWith("/bot-config")) {
      const botId = url.searchParams.get("bot_id") || "";
      const feature = url.searchParams.get("feature") || "";
      if (!botId) return json(400, { error: "bot_id required" });
      if (!feature) return json(400, { error: "feature required" });

      const { data, error } = await admin
        .from("bot_config")
        .select("*")
        .eq("bot_id", botId)
        .eq("feature", feature)
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      return json(200, { config: normalizeBotConfig(feature, data) ?? null });
    }

    // POST /mark-config-applied { bot_id, feature }
    if (req.method === "POST" && path.startsWith("/mark-config-applied")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      const feature = String(body.feature || "");
      if (!botId) return json(400, { error: "bot_id required" });
      if (!feature) return json(400, { error: "feature required" });

      const now = new Date().toISOString();
      const { error } = await admin
        .from("bot_config")
        .update({ applied_at: now, updated_at: now })
        .eq("bot_id", botId)
        .eq("feature", feature);
      if (error) return json(500, { error: error.message });

      // Older Python utilities bot builds call mark-config-applied after
      // processing apply_config but never call complete-command. Close the
      // matching command here so it cannot be reclaimed forever.
      const { data: completed, error: cmdError } = await admin
        .from("bot_commands")
        .update({
          status: "done",
          completed_at: now,
          updated_at: now,
          error_message: null,
        })
        .eq("bot_id", botId)
        .eq("action", "apply_config")
        .in("status", ["pending", "claimed"])
        .contains("payload", { feature })
        .select("id, action, status");
      if (cmdError) return json(500, { error: cmdError.message });
      if (completed && completed.length > 0) {
        console.log("utilities-bot-api mark-config-applied completed apply_config", {
          botId,
          feature,
          count: completed.length,
          ids: completed.map((c: any) => c.id),
        });
      }
      return json(200, { ok: true, completed_commands: completed?.length ?? 0 });
    }

    // POST /claim-command { bot_id } -> claims the next pending command owned
    // by the external utilities bot. Role refresh commands are checked first so
    // role selectors are not blocked behind older queued work.
    if (req.method === "POST" && path.startsWith("/claim-command")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      if (!botId) return json(400, { error: "bot_id required" });

      // Sweep stale 'claimed' commands for this bot that were never completed.
      // Without this, every apply_config / list_roles / etc. that the bot
      // claims but forgets to ack accumulates forever in 'claimed' and the
      // bot ends up looping over the same backlog on each poll.
      const STALE_CLAIM_MS = 30_000;
      const staleCutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
      const nowIso = new Date().toISOString();
      const { data: sweepClaimed, error: sweepErr } = await admin
        .from("bot_commands")
        .update({
          status: "failed",
          completed_at: nowIso,
          updated_at: nowIso,
          error_message: "auto-failed: claimed but never completed by worker",
        })
        .eq("bot_id", botId)
        .eq("status", "claimed")
        .lt("claimed_at", staleCutoff)
        .select("id, action");
      if (sweepErr) {
        console.warn("utilities-bot-api stale claim sweep failed", sweepErr.message);
      } else if (sweepClaimed && sweepClaimed.length > 0) {
        console.log("utilities-bot-api stale claim sweep", {
          botId,
          count: sweepClaimed.length,
          actions: sweepClaimed.map((c: any) => c.action),
        });
      }

      // Also auto-cancel apply_config commands that have been sitting in
      // 'pending' for more than 2 minutes. The Python utilities bot writes
      // config directly to the database, so a long-pending apply_config row
      // means the queue is just churning and will never be consumed.
      const PENDING_CANCEL_MS = 120_000;
      const pendingCutoff = new Date(Date.now() - PENDING_CANCEL_MS).toISOString();
      const { data: sweepPending, error: pendingSweepErr } = await admin
        .from("bot_commands")
        .update({
          status: "canceled",
          completed_at: nowIso,
          updated_at: nowIso,
          error_message: "auto-canceled: pending too long, no worker consumed it",
        })
        .eq("bot_id", botId)
        .eq("status", "pending")
        .eq("action", "apply_config")
        .lt("created_at", pendingCutoff)
        .select("id");
      if (pendingSweepErr) {
        console.warn("utilities-bot-api pending sweep failed", pendingSweepErr.message);
      } else if (sweepPending && sweepPending.length > 0) {
        console.log("utilities-bot-api stale pending apply_config canceled", {
          botId,
          count: sweepPending.length,
        });
      }

      const claimCommand = async (actions: string[]) => {
        const { data: pending, error: selErr } = await admin
          .from("bot_commands")
          .select("*")
          .eq("bot_id", botId)
          .eq("status", "pending")
          .in("action", actions)
          .order("created_at", { ascending: true })
          .limit(1);
        if (selErr) throw selErr;

        const row = pending?.[0];
        if (!row) return null;

        const { data: claimed, error: updErr } = await admin
          .from("bot_commands")
          .update({
            status: "claimed",
            claimed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("status", "pending")
          .select("*")
          .maybeSingle();
        if (updErr) throw updErr;
        if (!claimed) return null;
        return { ...row, ...claimed };
      };

      const claimed =
        (await claimCommand(["list_roles", "list_channels"])) ??
        (await claimCommand(["post_message", "send_channel_message", "apply_config", "list_guilds", "start_giveaway", "setup_stats", "set_status"]));

      return json(200, { command: claimed });
    }

    // POST /complete-command { command_id, status, error_message? }
    // Be permissive about field names/status words because the external
    // Utilities bot is a separate Python process and older builds used
    // commandId/id plus success/completed instead of command_id/done.
    if (req.method === "POST" && (path.startsWith("/complete-command") || path.startsWith("/complete_command"))) {
      const body = await req.json().catch(() => ({} as any));
      const commandId = String(body.command_id || body.commandId || body.id || "");
      const rawStatus = body.status ?? body.state ?? body.result ?? body.ok;
      const normalizedStatus = String(rawStatus ?? "").toLowerCase().trim();
      const status = ["done", "complete", "completed", "success", "succeeded", "ok", "true"].includes(normalizedStatus)
        ? "done"
        : ["failed", "fail", "failure", "error", "errored", "false"].includes(normalizedStatus)
          ? "failed"
          : "";
      if (!commandId) return json(400, { error: "command_id required" });
      if (!status) {
        return json(400, { error: "status must mean 'done' or 'failed'" });
      }
      const nowIso = new Date().toISOString();
      const { data: updated, error: updErr } = await admin
        .from("bot_commands")
        .update({
          status,
          completed_at: nowIso,
          updated_at: nowIso,
          error_message: body.error_message ?? null,
        })
        .eq("id", commandId)
        .select("id, bot_id, action, status")
        .maybeSingle();
      if (updErr) return json(500, { error: updErr.message });
      if (!updated) return json(404, { error: "Command not found", command_id: commandId });
      console.log("utilities-bot-api complete-command", updated);
      return json(200, { ok: true, command: updated });
    }

    // POST /upsert-role-cache { bot_id, guild_id, roles[] }
    // Replaces the cached role list for (bot_id, guild_id) so the dashboard's
    // RoleMultiSelect can render fresh data after a list_roles refresh.
    if (req.method === "POST" && path.startsWith("/upsert-role-cache")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      const guildId = String(body.guild_id || "");
      const roles = Array.isArray(body.roles) ? body.roles : null;
      if (!botId) return json(400, { error: "bot_id required" });
      if (!guildId) return json(400, { error: "guild_id required" });
      if (!roles) return json(400, { error: "roles[] required" });

      const { data: order, error: orderError } = await admin
        .from("bot_orders")
        .select("user_id")
        .eq("id", botId)
        .single();
      if (orderError || !order) {
        return json(404, { error: "Bot order not found" });
      }

      const fetchedAt = new Date().toISOString();
      const rows = roles
        .filter((r: any) => r && r.role_id)
        .map((r: any) => ({
          bot_id: botId,
          user_id: order.user_id,
          guild_id: guildId,
          role_id: String(r.role_id),
          role_name: String(r.role_name ?? ""),
          color: Number(r.color ?? 0),
          position: Number(r.position ?? 0),
          managed: Boolean(r.managed ?? false),
          is_everyone: Boolean(r.is_everyone ?? false),
          fetched_at: r.fetched_at ?? fetchedAt,
        }));

      const { error: delError } = await admin
        .from("bot_role_cache")
        .delete()
        .eq("bot_id", botId)
        .eq("guild_id", guildId);
      if (delError) return json(500, { error: delError.message });

      if (rows.length > 0) {
        const { error: insError } = await admin
          .from("bot_role_cache")
          .insert(rows);
        if (insError) return json(500, { error: insError.message });
      }
      return json(200, { ok: true, count: rows.length });
    }

    // POST /upsert-channel-cache { bot_id, guild_id, channels[] }
    // Replaces the cached channel list for (bot_id, guild_id) so dashboard
    // pickers can render fresh data after a list_channels refresh.
    if (req.method === "POST" && path.startsWith("/upsert-channel-cache")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      const guildId = String(body.guild_id || "");
      const channels = Array.isArray(body.channels) ? body.channels : null;
      if (!botId) return json(400, { error: "bot_id required" });
      if (!guildId) return json(400, { error: "guild_id required" });
      if (!channels) return json(400, { error: "channels[] required" });

      const { data: order, error: orderError } = await admin
        .from("bot_orders")
        .select("user_id")
        .eq("id", botId)
        .single();
      if (orderError || !order) {
        return json(404, { error: "Bot order not found" });
      }

      const fetchedAt = new Date().toISOString();
      const rows = channels
        .filter((c: any) => c && c.channel_id)
        .map((c: any) => ({
          bot_id: botId,
          user_id: order.user_id,
          guild_id: guildId,
          channel_id: String(c.channel_id),
          channel_name: String(c.channel_name ?? c.channel_id),
          channel_type: String(c.channel_type ?? "text"),
          parent_id: c.parent_id ?? null,
          parent_name: c.parent_name ?? null,
          position: Number(c.position ?? 0),
          parent_position: Number(c.parent_position ?? -1),
          fetched_at: c.fetched_at ?? fetchedAt,
        }));

      const { error: delError } = await admin
        .from("bot_channel_cache")
        .delete()
        .eq("bot_id", botId)
        .eq("guild_id", guildId);
      if (delError) return json(500, { error: delError.message });

      if (rows.length > 0) {
        const { error: insError } = await admin
          .from("bot_channel_cache")
          .insert(rows);
        if (insError) return json(500, { error: insError.message });
      }
      return json(200, { ok: true, count: rows.length });
    }

    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = await req.json().catch(() => ({} as any));
    const orderId = String(body.orderId || "");
    if (!orderId) return json(400, { error: "orderId required" });

    // POST /mark-dm-sent { orderId, type }
    if (path.startsWith("/mark-dm-sent")) {
      const type = body.type as DmType;
      if (!type || !(type in DM_TYPES)) {
        return json(400, { error: "type must be in_build, ready, or cancel" });
      }
      const flag = DM_TYPES[type];
      const { error } = await admin
        .from("bot_orders")
        .update({ [flag]: true, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    // POST /cancel-order { orderId, reason? }
    if (path.startsWith("/cancel-order")) {
      const reason = body.reason ? String(body.reason) : null;
      const { error } = await admin
        .from("bot_orders")
        .update({
          status: "cancel",
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    // POST /confirm-payment {
    //   orderId, confirmed_username?, stripe_payment_intent_id?,
    //   build_started?: boolean (defaults true), paid?: boolean (defaults true)
    // }
    if (path.startsWith("/confirm-payment")) {
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { updated_at: now };
      if (body.confirmed_username) update.confirmed_username = String(body.confirmed_username);
      if (body.stripe_payment_intent_id)
        update.stripe_payment_intent_id = String(body.stripe_payment_intent_id);
      if (body.paid !== false) {
        update.paid_at = now;
        update.charged_at = now;
      }
      if (body.build_started !== false) update.build_started = now;
      const { error } = await admin
        .from("bot_orders")
        .update(update)
        .eq("id", orderId);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    return json(404, { error: `Unknown route: ${path}` });
  } catch (e) {
    console.error("utilities-bot-api error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
