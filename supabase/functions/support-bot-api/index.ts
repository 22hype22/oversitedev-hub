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

      const { error: upsertError } = await admin
        .from("bot_runtime_status")
        .upsert(upsertData, { onConflict: "bot_id" });
      if (upsertError) return json(500, { error: upsertError.message });
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

    // POST /claim-command { bot_id } -> claims oldest pending post_message/apply_config command
    if (req.method === "POST" && path.startsWith("/claim-command")) {
      const body = await req.json().catch(() => ({} as any));
      const botId = String(body.bot_id || "");
      if (!botId) return json(400, { error: "bot_id required" });

      console.log("[claim-command] received bot_id:", botId);

      const { data: pending, error: selErr } = await admin
        .from("bot_commands")
        .select("*")
        .eq("bot_id", botId)
        .eq("status", "pending")
        .in("action", ["post_message", "apply_config"])
        .order("created_at", { ascending: true })
        .limit(1);
      if (selErr) {
        console.log("[claim-command] select error:", selErr.message);
        return json(500, { error: selErr.message });
      }
      console.log("[claim-command] pending rows found:", JSON.stringify(pending));

      // Debug: also check what ANY rows exist for this bot_id
      const { data: anyRows } = await admin
        .from("bot_commands")
        .select("id, action, status, created_at")
        .eq("bot_id", botId)
        .order("created_at", { ascending: false })
        .limit(5);
      console.log("[claim-command] last 5 rows for bot_id:", JSON.stringify(anyRows));

      const row = pending?.[0];
      if (!row) {
        console.log("[claim-command] returning null command");
        return json(200, { command: null });
      }

      const { data: claimed, error: updErr } = await admin
        .from("bot_commands")
        .update({
          status: "claimed",
          claimed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "pending")
        .select()
        .maybeSingle();
      if (updErr) {
        console.log("[claim-command] update error:", updErr.message);
        return json(500, { error: updErr.message });
      }
      if (!claimed) {
        console.log("[claim-command] update returned no row (race?)");
        return json(200, { command: null });
      }
      console.log("[claim-command] claimed row id:", claimed.id);
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
