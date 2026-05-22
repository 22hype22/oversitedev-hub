// Fetches the bot's live Discord identity (username, avatar, etc.)
// using the bot's stored DISCORD_TOKEN.
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
      let allowed = !!isAdmin;
      if (!allowed) {
        // Check team membership (any role with view_dashboard permission)
        const { data: roleData } = await userClient.rpc(
          "team_get_effective_role",
          { _bot_id: botId },
        );
        const perms = (roleData as any)?.permissions ?? {};
        if (perms.view_dashboard) allowed = true;
      }
      if (!allowed) return json(200, { ok: false, fallback: true, error: "Not authorized" });
    }

    const { data: tokenData, error: tokenErr } = await admin.rpc(
      "runtime_resolve_bot_token",
      { _bot_id: botId },
    );
    if (tokenErr) return json(200, { ok: false, fallback: true, error: `secret lookup failed: ${tokenErr.message}` });
    const botToken = typeof tokenData === "string" ? tokenData : null;
    if (!botToken) return json(200, { ok: false, fallback: true, error: "Bot has no DISCORD_TOKEN configured" });

    const dRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!dRes.ok) {
      const text = await dRes.text();
      return json(200, {
        ok: false,
        fallback: true,
        error: `Discord API error ${dRes.status}: ${text.slice(0, 200)}`,
      });
    }
    const u = await dRes.json() as {
      id: string;
      username?: string;
      global_name?: string | null;
      discriminator?: string;
      avatar?: string | null;
      banner?: string | null;
      bio?: string | null;
    };

    const avatarUrl = u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${
          (Number(u.discriminator ?? "0") || 0) % 5
        }.png`;
    const bannerUrl = u.banner
      ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}.${u.banner.startsWith("a_") ? "gif" : "png"}?size=600`
      : null;

    return json(200, {
      ok: true,
      id: u.id,
      username: u.username ?? null,
      global_name: u.global_name ?? null,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      bio: u.bio ?? null,
    });
  } catch (e) {
    console.error("bot-fetch-identity error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
