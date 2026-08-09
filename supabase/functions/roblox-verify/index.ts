// Roblox OAuth verification for Oversite Customs.
//
// Two entry points on one function:
//   POST { action: "start", bot_id, guild_id, discord_user_id }  (bot, x-worker-token)
//        → creates a one-time state row and returns the Roblox authorize URL.
//   GET  ?code=...&state=...                                       (Roblox redirect)
//        → exchanges the code, reads the Roblox username, stores the link, and
//          queues a `roblox_apply` command so the bot sets the nickname + role.
//
// The bot registers THIS function's URL as the OAuth redirect URI:
//   https://<project>.supabase.co/functions/v1/roblox-verify
//
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/roblox-verify`;

const ROBLOX_AUTHORIZE = "https://apis.roblox.com/oauth/v1/authorize";
const ROBLOX_TOKEN = "https://apis.roblox.com/oauth/v1/token";
const ROBLOX_USERINFO = "https://apis.roblox.com/oauth/v1/userinfo";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-worker-token, x_worker_token, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Send the member's browser somewhere real (their Discord server) instead of
// rendering a page — a 302 can never be shown as raw HTML and reads as legit.
const redirect = (to: string) =>
  new Response(null, { status: 302, headers: { ...cors, Location: to } });

const page = (title: string, message: string, ok: boolean) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title}</title></head>
     <body style="margin:0;font-family:system-ui,sans-serif;background:#1b2026;color:#E8EEF3;display:grid;place-items:center;min-height:100vh">
       <div style="max-width:420px;text-align:center;padding:32px;border:1px solid #3a434d;border-radius:16px;background:#272e36">
         <div style="font-size:44px;margin-bottom:8px">${ok ? "✅" : "⚠️"}</div>
         <h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
         <p style="color:#A8B4BF;font-size:14px;line-height:1.5;margin:0">${message}</p>
         <p style="color:#788591;font-size:12px;margin-top:18px">You can close this tab and return to Discord.</p>
       </div>
     </body></html>`,
    { status: ok ? 200 : 400, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } },
  );

function normToken(v: string | null): string {
  return (v ?? "").trim().replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "");
}

async function getConfig(botId: string): Promise<Record<string, any> | null> {
  const { data } = await admin
    .from("bot_config")
    .select("config")
    .eq("bot_id", botId)
    .eq("feature", "roblox-verify")
    .maybeSingle();
  return (data?.config ?? null) as Record<string, any> | null;
}

// ── POST start: bot asks for an authorize URL for a member ──────────────────
async function handleStart(req: Request): Promise<Response> {
  const token =
    normToken(req.headers.get("x-worker-token")) ||
    normToken(req.headers.get("x_worker_token")) ||
    normToken(req.headers.get("authorization"));
  if (!token) return json({ error: "Missing worker token." }, 401);

  const body = await req.json().catch(() => ({}));
  const botId = String(body.bot_id ?? "");
  const guildId = String(body.guild_id ?? "");
  const discordUserId = String(body.discord_user_id ?? "");
  if (!botId || !guildId || !discordUserId) {
    return json({ error: "Missing bot_id / guild_id / discord_user_id." }, 400);
  }

  // Validate the worker token belongs to this bot.
  const { data: lookup, error: lookupErr } = await admin.rpc("_worker_token_lookup", {
    _token: token,
  });
  const row = Array.isArray(lookup) ? lookup[0] : lookup;
  if (lookupErr || !row || String(row.bot_id) !== botId) {
    return json({ error: "Worker token does not match this bot." }, 403);
  }

  const cfg = await getConfig(botId);
  const clientId = String(cfg?.roblox_client_id ?? "").trim();
  if (!clientId) return json({ error: "Roblox Client ID not configured." }, 400);

  // One-time state (uuid). Old sessions for this member are cleared first.
  const state = crypto.randomUUID();
  await admin
    .from("roblox_verify_sessions")
    .delete()
    .eq("bot_id", botId)
    .eq("discord_user_id", discordUserId);
  const { error: insErr } = await admin.from("roblox_verify_sessions").insert({
    state,
    bot_id: botId,
    guild_id: guildId,
    discord_user_id: discordUserId,
  });
  if (insErr) return json({ error: `Could not start verification: ${insErr.message}` }, 500);

  const url =
    `${ROBLOX_AUTHORIZE}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent("openid profile")}` +
    `&response_type=code&state=${encodeURIComponent(state)}`;
  return json({ url });
}

// ── GET callback: Roblox redirected the member back here ────────────────────
async function handleCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) {
    return page("Verification cancelled", "You didn't authorize Roblox. Try the Verify button again.", false);
  }
  if (!code || !state) return page("Something went wrong", "Missing code or state.", false);

  // Consume the session (one-time).
  const { data: sess } = await admin
    .from("roblox_verify_sessions")
    .select("bot_id, guild_id, discord_user_id, expires_at")
    .eq("state", state)
    .maybeSingle();
  if (!sess) return page("Link expired", "That verification link is invalid or already used. Click Verify again.", false);
  await admin.from("roblox_verify_sessions").delete().eq("state", state);
  if (new Date(sess.expires_at).getTime() < Date.now()) {
    return page("Link expired", "That link timed out. Click Verify again in Discord.", false);
  }

  const cfg = await getConfig(String(sess.bot_id));
  const clientId = String(cfg?.roblox_client_id ?? "").trim();
  const clientSecret = String(cfg?.roblox_client_secret ?? "").trim();
  if (!clientId || !clientSecret) {
    return page("Not configured", "Roblox app credentials are missing. Ask an admin to finish setup.", false);
  }

  // Exchange the code for tokens.
  const tokenResp = await fetch(ROBLOX_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!tokenResp.ok) {
    return page("Roblox rejected the login", `Token exchange failed (HTTP ${tokenResp.status}). Check the Client ID/Secret and redirect URL.`, false);
  }
  const tokens = await tokenResp.json();

  // Fetch the Roblox profile.
  const infoResp = await fetch(ROBLOX_USERINFO, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoResp.ok) return page("Couldn't read your Roblox profile", `HTTP ${infoResp.status}.`, false);
  const info = await infoResp.json();
  const robloxId = String(info.sub ?? "");
  const robloxUsername = String(info.preferred_username ?? info.name ?? info.nickname ?? "").trim();
  if (!robloxId || !robloxUsername) return page("Couldn't read your Roblox profile", "Roblox returned no username.", false);

  // Store the link.
  await admin.from("roblox_verifications").upsert(
    {
      bot_id: sess.bot_id,
      guild_id: sess.guild_id,
      discord_user_id: sess.discord_user_id,
      roblox_id: robloxId,
      roblox_username: robloxUsername,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "bot_id,discord_user_id" },
  );

  // Queue the bot to apply nickname + role. requested_by/user_id must be set.
  const { data: order } = await admin
    .from("bot_orders")
    .select("user_id")
    .eq("id", sess.bot_id)
    .maybeSingle();
  const owner = order?.user_id ?? null;
  if (owner) {
    await admin.from("bot_commands").insert({
      bot_id: sess.bot_id,
      user_id: owner,
      requested_by: owner,
      action: "roblox_apply",
      payload: {
        guild_id: sess.guild_id,
        discord_user_id: sess.discord_user_id,
        roblox_username: robloxUsername,
        roblox_id: robloxId,
      },
    });
  }

  // Success — bounce the member straight back into their Discord server so
  // they never see a raw page. Falls back to a clean rendered page only if we
  // somehow don't have a guild to return them to.
  const guildId = String(sess.guild_id ?? "").trim();
  if (guildId) return redirect(`https://discord.com/channels/${guildId}`);
  return page("You're verified!", `Linked to Roblox as <b>${robloxUsername}</b>. Head back to Discord — your nickname and role update in a few seconds.`, true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url);
    if (req.method === "POST") {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.action === "start") return await handleStart(req);
      return json({ error: "Unknown action." }, 400);
    }
    if (req.method === "GET") {
      if (url.searchParams.has("code") || url.searchParams.has("error")) {
        return await handleCallback(url);
      }
      return page("Roblox verification", "This page handles Roblox logins. Use the Verify button in Discord.", true);
    }
    return json({ error: "Method not allowed." }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
