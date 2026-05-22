// Updates the bot's Discord identity (username, avatar, bio) via the
// Discord REST API using the bot's stored DISCORD_TOKEN. Also persists the
// desired values to bot_orders so they can be inspected and reapplied later.
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

    const username: string | null =
      typeof body.username === "string" ? body.username.trim() : null;
    const bio: string | null =
      typeof body.bio === "string" ? body.bio : null;
    // Accept either a full data URL or a raw base64 PNG/JPEG payload.
    let avatar: string | null =
      typeof body.avatar === "string" ? body.avatar.trim() : null;
    let banner: string | null =
      typeof body.banner === "string" ? body.banner.trim() : null;

    if (username === null && bio === null && avatar === null && banner === null) {
      return json(400, { error: "Nothing to update" });
    }

    if (username !== null && (username.length < 2 || username.length > 32)) {
      return json(400, { error: "Username must be 2-32 characters" });
    }
    if (bio !== null && bio.length > 190) {
      return json(400, { error: "Bio must be 190 characters or fewer" });
    }
    for (const [name, val] of [["avatar", avatar], ["banner", banner]] as const) {
      if (val && !val.startsWith("data:") && !/^[A-Za-z0-9+/=]+$/.test(val)) {
        return json(400, { error: `${name} must be a data URL or base64 string` });
      }
    }
    if (avatar && !avatar.startsWith("data:")) avatar = `data:image/png;base64,${avatar}`;
    if (banner && !banner.startsWith("data:")) banner = `data:image/png;base64,${banner}`;
    if (avatar && avatar.length > 14_000_000) {
      return json(400, { error: "Avatar image too large (max ~10 MB)" });
    }
    if (banner && banner.length > 14_000_000) {
      return json(400, { error: "Banner image too large (max ~10 MB)" });
    }

    const { data: order, error: orderErr } = await admin
      .from("bot_orders")
      .select("id, user_id, discord_last_username_change_at")
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

    const payload: Record<string, unknown> = {};
    if (username !== null) payload.username = username;
    if (avatar !== null) payload.avatar = avatar;
    if (banner !== null) payload.banner = banner;
    if (bio !== null) payload.bio = bio;

    const fieldsSent = Object.keys(payload);
    console.log(
      `[bot-update-identity] bot=${botId} PATCH /users/@me fields=${fieldsSent.join(",")} bio_len=${
        bio !== null ? bio.length : "n/a"
      }`,
    );

    const dRes = await fetch("https://discord.com/api/v10/users/@me", {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await dRes.text();
    console.log(
      `[bot-update-identity] bot=${botId} discord_status=${dRes.status} retry_after=${
        dRes.headers.get("retry-after") ?? "-"
      } body=${rawBody.slice(0, 500)}`,
    );

    if (!dRes.ok) {
      const retryAfter = dRes.headers.get("retry-after");
      return json(dRes.status === 429 ? 429 : dRes.status === 401 || dRes.status === 403 ? 400 : 502, {
        error: `Discord API error ${dRes.status}: ${rawBody.slice(0, 300)}`,
        retry_after: retryAfter ? Number(retryAfter) : undefined,
      });
    }

    const updated = (() => {
      try { return JSON.parse(rawBody); } catch { return {} as any; }
    })();

    // Warn if Discord silently dropped the bio (returned 200 but no bio in response).
    if (bio !== null && typeof updated?.bio !== "string") {
      console.warn(
        `[bot-update-identity] bot=${botId} bio sent but missing from Discord response. response_keys=${Object.keys(
          updated ?? {},
        ).join(",")}`,
      );
    }


    const newAvatarUrl = updated?.avatar
      ? `https://cdn.discordapp.com/avatars/${updated.id}/${updated.avatar}.${
          String(updated.avatar).startsWith("a_") ? "gif" : "png"
        }?size=256`
      : null;
    const newBannerUrl = updated?.banner
      ? `https://cdn.discordapp.com/banners/${updated.id}/${updated.banner}.${
          String(updated.banner).startsWith("a_") ? "gif" : "png"
        }?size=600`
      : null;

    // Persist desired values + rate-limit timestamp.
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (username !== null) {
      dbPatch.bot_name = username;
      dbPatch.discord_last_username_change_at = new Date().toISOString();
    }
    if (bio !== null) dbPatch.bot_bio = bio;
    if (avatar !== null && newAvatarUrl) dbPatch.icon_url = newAvatarUrl;
    if (banner !== null && newBannerUrl) dbPatch.banner_url = newBannerUrl;

    const { error: updErr } = await admin
      .from("bot_orders")
      .update(dbPatch)
      .eq("id", botId);
    if (updErr) {
      console.warn("bot-update-identity: db persist failed", updErr);
    }

    return json(200, {
      ok: true,
      id: updated?.id ?? null,
      username: updated?.username ?? null,
      avatar_url: newAvatarUrl,
      banner_url: newBannerUrl,
      bio: updated?.bio ?? null,
    });
  } catch (e) {
    console.error("bot-update-identity error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
