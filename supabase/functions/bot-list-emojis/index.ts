// Lists all custom emojis available across the bot's guilds.
// Returns a flat array of { name, id, animated, guild_id }.
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

    // Get guild list
    const gRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!gRes.ok) {
      const text = await gRes.text();
      return json(502, { error: `Discord guilds error ${gRes.status}: ${text.slice(0, 200)}` });
    }
    const guilds = (await gRes.json()) as Array<{ id: string; name?: string }>;

    // Fetch emojis per guild in parallel (cap to first 50 guilds to avoid rate limits)
    const results = await Promise.all(
      guilds.slice(0, 50).map(async (g) => {
        try {
          const r = await fetch(
            `https://discord.com/api/v10/guilds/${g.id}/emojis`,
            { headers: { Authorization: `Bot ${botToken}` } },
          );
          if (!r.ok) return [];
          const emojis = (await r.json()) as Array<{
            id: string | null;
            name: string | null;
            animated?: boolean;
          }>;
          return emojis
            .filter((e) => e.id && e.name)
            .map((e) => ({
              id: e.id!,
              name: e.name!,
              animated: !!e.animated,
              guild_id: g.id,
            }));
        } catch {
          return [];
        }
      }),
    );

    const emojis = results.flat();
    return json(200, { ok: true, emojis });
  } catch (e) {
    console.error("bot-list-emojis error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
