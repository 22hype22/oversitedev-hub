// Link an EXISTING Discord bot (e.g. the main Oversite bots) into the
// dashboard as a fully managed bot.
//
// Invocation (admin only):
//   POST { botName, base, token, railwayServiceId?, addons? }
//
// What it does:
//   1. Verifies the caller is an admin (has_role).
//   2. Validates the pasted bot token against Discord (/users/@me) and pulls
//      the bot's real username + avatar.
//   3. Inserts a bot_orders row with status='ready', the pasted token, and
//      (optionally) the existing Railway service id — in a SINGLE INSERT.
//      The bot_orders_auto_deploy trigger fires on INSERT without wiping
//      bot_token/railway_service_id (it only wipes those on UPDATE), so
//      auto-deploy-bot uses THIS token (never the pool) and reuses the
//      existing service if one was given.
//   4. auto-deploy-bot then injects BOT_ORDER_ID + env and (re)deploys.
//      After the ~1-2 min restart the bot heartbeats into the dashboard and
//      every control (status, identity, power, logs, metrics) works on it.
//
// The token travels HTTPS → this function → bot_orders.bot_token (service
// role). It is never logged and never touches client-side storage.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VALID_BASES = new Set(["protection", "support", "utilities", "scratch"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── Auth: caller must be a signed-in admin ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not signed in" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (userErr || !uid) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: uid,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    // ── Input ──
    const body = await req.json().catch(() => ({}));
    const botName = String(body?.botName ?? "").trim();
    const base = String(body?.base ?? "").trim().toLowerCase();
    const token = String(body?.token ?? "").trim();
    const railwayServiceId = String(body?.railwayServiceId ?? "").trim() || null;
    const addons = Array.isArray(body?.addons)
      ? (body.addons as unknown[]).map(String).filter(Boolean)
      : [];

    if (!botName || botName.length > 40) return json({ error: "Bot name is required (max 40 chars)" }, 400);
    if (!VALID_BASES.has(base)) return json({ error: "Base must be protection, support, utilities or scratch" }, 400);
    if (!token || token.length < 30) return json({ error: "That doesn't look like a Discord bot token" }, 400);

    // ── Validate the token against Discord & pull the bot's identity ──
    const dres = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (dres.status === 401) return json({ error: "Discord rejected that token — double-check it" }, 400);
    if (!dres.ok) return json({ error: `Discord API error (${dres.status}) — try again` }, 502);
    const me = (await dres.json()) as { id: string; username: string; avatar: string | null };
    const iconUrl = me.avatar
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256`
      : null;

    // ── Refuse duplicates (same token or same Railway service already linked) ──
    const { data: dupTok } = await admin
      .from("bot_orders")
      .select("id")
      .eq("bot_token", token)
      .neq("status", "cancelled")
      .limit(1);
    if (dupTok && dupTok.length > 0) {
      return json({ error: "That bot token is already linked to an order" }, 409);
    }
    if (railwayServiceId) {
      const { data: dupSvc } = await admin
        .from("bot_orders")
        .select("id")
        .eq("railway_service_id", railwayServiceId)
        .neq("status", "cancelled")
        .limit(1);
      if (dupSvc && dupSvc.length > 0) {
        return json({ error: "That Railway service is already linked to an order" }, 409);
      }
    }

    // ── Create the order. status='ready' on INSERT fires the auto-deploy
    //    trigger, which keeps bot_token/railway_service_id intact on inserts. ──
    const { data: inserted, error: insErr } = await admin
      .from("bot_orders")
      .insert({
        user_id: uid,
        bot_name: botName,
        base,
        addons,
        status: "ready",
        bot_token: token,
        railway_service_id: railwayServiceId,
        icon_url: iconUrl,
        total_amount: 0,
        currency: "usd",
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return json({ error: insErr?.message ?? "Couldn't create the order" }, 500);
    }

    console.log("[admin-link-bot] linked", {
      orderId: inserted.id,
      base,
      username: me.username,
      reusedService: Boolean(railwayServiceId),
    });

    return json({
      ok: true,
      orderId: inserted.id,
      botUsername: me.username,
      clientId: me.id,
      deploying: true,
      message: `Linked ${me.username} — deploying now. It appears in your dashboard and goes fully managed in about 1–2 minutes.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin-link-bot] failed", { message: msg });
    return json({ error: msg }, 500);
  }
});
