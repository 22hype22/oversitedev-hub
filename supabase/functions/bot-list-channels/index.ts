// User-callable edge function that fetches a bot's text/announcement/etc.
// channels for a given guild directly from the Discord REST API using the
// bot's stored DISCORD_TOKEN, and refreshes bot_channel_cache.
//
// Auth: standard Supabase user JWT. Caller must own the bot (or be admin).
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

// Discord channel type ints we surface as "textual" channels.
const CHANNEL_TYPE: Record<number, string> = {
  0: "text",
  5: "announcement",
  15: "forum",
  2: "voice",
  4: "category",
};
const TEXTUAL = new Set([0, 5, 15, 2]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return json(401, { error: "Missing authorization" });

    // Resolve caller via user JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({} as any));
    const botId = String(body.bot_id || "");
    const guildId = String(body.guild_id || "");
    if (!botId) return json(400, { error: "bot_id required" });
    if (!guildId) return json(400, { error: "guild_id required" });

    // Verify ownership (or admin).
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

    // Pull the bot's Discord token. Falls back across bot_secrets,
    // bot_orders.bot_token, and the assigned bot_token_pool entry so
    // both worker-managed and Railway-deployed bots resolve a token.
    const { data: tokenData, error: tokenErr } = await admin.rpc(
      "runtime_resolve_bot_token",
      { _bot_id: botId },
    );
    if (tokenErr) return json(500, { error: `secret lookup failed: ${tokenErr.message}` });
    const botToken = typeof tokenData === "string" ? tokenData : null;
    if (!botToken) return json(400, { error: "Bot has no DISCORD_TOKEN configured" });

    // Fetch channels from Discord directly.
    const dRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!dRes.ok) {
      const text = await dRes.text();
      return json(dRes.status === 401 || dRes.status === 403 ? 400 : 502, {
        error: `Discord API error ${dRes.status}: ${text.slice(0, 200)}`,
      });
    }
    const channels = await dRes.json() as Array<{
      id: string; name?: string; type: number;
      parent_id?: string | null; position?: number;
    }>;

    const byId = new Map(channels.map((c) => [c.id, c]));
    const now = new Date().toISOString();
    const rows = channels
      .filter((c) => TEXTUAL.has(c.type))
      .map((c) => {
        const parent = c.parent_id ? byId.get(c.parent_id) ?? null : null;
        return {
          bot_id: botId,
          user_id: order.user_id,
          guild_id: guildId,
          channel_id: c.id,
          channel_name: c.name ?? c.id,
          channel_type: CHANNEL_TYPE[c.type] ?? "text",
          parent_id: c.parent_id ?? null,
          parent_name: parent?.name ?? null,
          position: c.position ?? 0,
          parent_position: parent?.position ?? -1,
          fetched_at: now,
        };
      });

    // Replace the cache for this bot+guild so deleted channels disappear.
    const { error: delErr } = await admin
      .from("bot_channel_cache")
      .delete()
      .eq("bot_id", botId)
      .eq("guild_id", guildId);
    if (delErr) return json(500, { error: `cache clear failed: ${delErr.message}` });

    if (rows.length > 0) {
      const { error: upErr } = await admin
        .from("bot_channel_cache")
        .upsert(rows, { onConflict: "bot_id,guild_id,channel_id" });
      if (upErr) return json(500, { error: `cache write failed: ${upErr.message}` });
    }

    return json(200, { ok: true, count: rows.length });
  } catch (e) {
    console.error("bot-list-channels error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
