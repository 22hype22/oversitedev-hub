// Checks whether a specific Discord message still exists in a channel using
// the bot's stored DISCORD_TOKEN. Returns { ok, exists } so the dashboard can
// prune stale ticket-panel entries.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return json(401, { error: "Missing authorization" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({} as any));
    const botId = String(body.bot_id || "");
    const channelId = String(body.channel_id || "");
    const messageId = String(body.message_id || "");
    if (!botId || !channelId || !messageId) {
      return json(400, { error: "bot_id, channel_id, message_id required" });
    }

    const { data: order, error: orderErr } = await admin
      .from("bot_orders")
      .select("id, user_id")
      .eq("id", botId)
      .maybeSingle();
    if (orderErr) return json(500, { error: orderErr.message });
    if (!order) return json(404, { error: "Bot not found" });

    if (order.user_id !== userId) {
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) return json(403, { error: "Not bot owner" });
    }

    const { data: tokenData, error: tokenErr } = await admin.rpc(
      "runtime_resolve_bot_token",
      { _bot_id: botId },
    );
    if (tokenErr) return json(500, { error: `secret lookup failed: ${tokenErr.message}` });
    const botToken = typeof tokenData === "string" ? tokenData : null;
    if (!botToken) return json(400, { error: "Bot has no DISCORD_TOKEN configured" });

    const dRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (dRes.ok) return json(200, { ok: true, exists: true });
    if (dRes.status === 404) return json(200, { ok: true, exists: false });
    // 401/403 — channel/message not accessible: treat as missing so it gets pruned.
    if (dRes.status === 401 || dRes.status === 403) {
      return json(200, { ok: true, exists: false, reason: `discord ${dRes.status}` });
    }
    const text = await dRes.text();
    return json(502, { error: `Discord API error ${dRes.status}: ${text.slice(0, 200)}` });
  } catch (e) {
    console.error("bot-check-message error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
