// Edge function for the external support-bot worker to report heartbeats.
// Auth = x-worker-token header, validated against worker_tokens table.
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

/**
 * After the bot's first online heartbeat, push the customer-chosen
 * `bot_orders.bot_name` to Discord as the bot's username. Only runs once
 * per bot (gated by `bot_orders.auto_identity_applied_at`).
 */
async function maybeApplyInitialIdentity(botId: string): Promise<void> {
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


async function authenticate(req: Request): Promise<boolean> {
  const token =
    req.headers.get("x-worker-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!token) return false;
  const { data, error } = await admin.rpc("_worker_token_lookup", {
    _token: token,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return false;
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
  const path = url.pathname.replace(/^.*\/support-bot-api/, "") || "/";

  try {
    if (req.method === "POST" && path.startsWith("/heartbeat")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      const status = String(body.status || "");

      if (!botId) return json(400, { error: "bot_id required" });
      if (!status) return json(400, { error: "status required" });

      // Resolve user_id from the bot order
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
      // Discord. Wait for the heartbeat so the gateway session is live before
      // calling the Discord REST API. Fire-and-forget — failures shouldn't
      // break the heartbeat acknowledgement.
      maybeApplyInitialIdentity(botId).catch((err) => {
        console.warn("[support-bot-api] auto identity failed", botId, err);
      });

      return json(200, { ok: true });
    }

    // POST /record-metrics { bot_id, commands, messages, errors, active_servers, member_count }
    if (req.method === "POST" && path.startsWith("/record-metrics")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      if (!botId) return json(400, { error: "bot_id required" });

      const token =
        req.headers.get("x-worker-token") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        "";

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

    // POST /claim-command { bot_id } -> claims the next pending command owned
    // by the external support bot. Role refresh commands are checked first so
    // ticket category role selectors are not blocked behind older queued work.
    if (req.method === "POST" && path.startsWith("/claim-command")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      if (!botId) return json(400, { error: "bot_id required" });

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
        // Merge the originally-fetched row to guarantee payload (and any other
        // columns) are present even if the update's RETURNING clause omits them.
        return { ...row, ...claimed };
      };

      const claimed =
        (await claimCommand(["list_roles"])) ??
        (await claimCommand(["post_message", "apply_config", "edit_ticket_panel", "list_channels", "list_guilds", "set_status"]));

      return json(200, { command: claimed });
    }

    // POST /complete-command { command_id, status, error_message? }
    if (req.method === "POST" && path.startsWith("/complete-command")) {
      const body = await req.json().catch(() => ({} as any));
      const commandId = String(body.command_id || "");
      const status = String(body.status || "");
      if (!commandId) return json(400, { error: "command_id required" });
      if (status !== "done" && status !== "failed") {
        return json(400, { error: "status must be 'done' or 'failed'" });
      }
      const { error: updErr } = await admin
        .from("bot_commands")
        .update({
          status,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: body.error_message ?? null,
        })
        .eq("id", commandId);
      if (updErr) return json(500, { error: updErr.message });
      return json(200, { ok: true });
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

      // Resolve user_id from the bot order (role cache rows are owned per-user).
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

      // Wipe stale rows for this guild, then insert the fresh set so deleted
      // Discord roles disappear from the cache instead of lingering.
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

    // GET /bot-config?bot_id=...&feature=tickets
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
      return json(200, { config: data ?? null });
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
      return json(200, { ok: true });
    }

    return json(404, { error: `Unknown route: ${path}` });
  } catch (e) {
    console.error("support-bot-api error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
