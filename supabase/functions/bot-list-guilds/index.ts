// Fetches the guilds a bot is currently in via the Discord REST API
// (using the bot's stored DISCORD_TOKEN) and refreshes bot_active_guilds.
// This bypasses the worker so it works for Railway-deployed bots.
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
    if (!botId) return json(400, { error: "bot_id required" });

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
      "https://discord.com/api/v10/users/@me/guilds?with_counts=true",
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (!dRes.ok) {
      const text = await dRes.text();
      return json(dRes.status === 401 || dRes.status === 403 ? 400 : 502, {
        error: `Discord API error ${dRes.status}: ${text.slice(0, 200)}`,
      });
    }
    const guilds = await dRes.json() as Array<{
      id: string;
      name?: string;
      approximate_member_count?: number;
    }>;

    const now = new Date().toISOString();
    const rows = guilds.map((g) => ({
      bot_id: botId,
      user_id: order.user_id,
      guild_id: g.id,
      guild_name: g.name ?? null,
      member_count: typeof g.approximate_member_count === "number"
        ? g.approximate_member_count
        : null,
      last_seen_at: now,
    }));

    // Replace cache so removed guilds disappear.
    const { error: delErr } = await admin
      .from("bot_active_guilds")
      .delete()
      .eq("bot_id", botId);
    if (delErr) return json(500, { error: `cache clear failed: ${delErr.message}` });

    if (rows.length > 0) {
      const { error: upErr } = await admin
        .from("bot_active_guilds")
        .upsert(rows, { onConflict: "bot_id,guild_id" });
      if (upErr) return json(500, { error: `cache write failed: ${upErr.message}` });
    }

    // Also mirror into bot_runtime_status.guilds so the dashboard's
    // heartbeat-first read path sees these guilds immediately.
    try {
      await admin
        .from("bot_runtime_status")
        .upsert(
          {
            bot_id: botId,
            user_id: order.user_id,
            guilds: guilds.map((g) => ({
              id: g.id,
              name: g.name ?? null,
              member_count: g.approximate_member_count ?? null,
            })),
            updated_at: now,
          },
          { onConflict: "bot_id" },
        );
    } catch (e) {
      console.warn("bot-list-guilds: runtime_status mirror failed", e);
    }

    return json(200, { ok: true, count: rows.length });
  } catch (e) {
    console.error("bot-list-guilds error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
