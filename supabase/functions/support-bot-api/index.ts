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

    return json(404, { error: `Unknown route: ${path}` });
  } catch (e) {
    console.error("support-bot-api error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
