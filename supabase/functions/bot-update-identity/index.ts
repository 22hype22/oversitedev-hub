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

// ── Staff alert: fields Discord won't apply automatically ─────────────────
// Discord's API silently ignores the "About me" bio for bots (and sometimes
// the banner). When that happens we post an alert into the staff server via
// the Oversite Utilities bot so the team can apply the change manually in
// the Discord Developer Portal. Fire-and-forget: an alert failure must never
// break the customer's save.
//
// Secrets: OVERSITE_UTILITIES_BOT_TOKEN (already set for order DMs) and
// STAFF_ALERTS_CHANNEL_ID (the staff channel's ID).
async function notifyStaffManualApply(opts: {
  botName: string;
  orderId: string;
  bioText: string | null;
  bannerDataUrl: string | null;
}): Promise<void> {
  const token = Deno.env.get("OVERSITE_UTILITIES_BOT_TOKEN");
  const channelId = Deno.env.get("STAFF_ALERTS_CHANNEL_ID");
  if (!token || !channelId) {
    console.warn(
      "[bot-update-identity] staff alert skipped — OVERSITE_UTILITIES_BOT_TOKEN or STAFF_ALERTS_CHANNEL_ID not configured",
    );
    return;
  }

  const changed: string[] = [];
  if (opts.bioText !== null) changed.push("Description");
  if (opts.bannerDataUrl !== null) changed.push("Banner");

  const embed: Record<string, unknown> = {
    title: "Identity change needs a manual apply",
    color: 0xc9dbe6,
    description:
      `**${opts.botName}** updated their ${changed.join(" and ").toLowerCase()}, ` +
      "and Discord doesn't apply this automatically for bots. Apply it in the " +
      "Discord Developer Portal for this bot's application.",
    fields: [
      { name: "Bot", value: opts.botName, inline: true },
      { name: "Order", value: `\`${opts.orderId.slice(0, 8)}\``, inline: true },
      { name: "Changed", value: changed.join(", "), inline: true },
      ...(opts.bioText !== null
        ? [{
            // Code block = shown verbatim (no markdown/emoji rendering), so
            // staff can copy-paste it into the Developer Portal exactly.
            name: "New description — copy & paste",
            value: opts.bioText.trim()
              ? "```\n" + opts.bioText.slice(0, 1000) + "\n```"
              : "*(cleared — remove the description)*",
          }]
        : []),
    ],
    timestamp: new Date().toISOString(),
  };

  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const auth = { Authorization: `Bot ${token}` };

  // Attach the banner image itself when we have one, so staff can apply it
  // without digging through the dashboard.
  if (opts.bannerDataUrl) {
    const m = opts.bannerDataUrl.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
    if (m) {
      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      (embed as any).image = { url: `attachment://banner.${ext}` };
      const form = new FormData();
      form.append(
        "payload_json",
        JSON.stringify({ embeds: [embed], attachments: [{ id: 0, filename: `banner.${ext}` }] }),
      );
      form.append("files[0]", new Blob([bytes], { type: `image/${m[1]}` }), `banner.${ext}`);
      const res = await fetch(url, { method: "POST", headers: auth, body: form });
      if (!res.ok) {
        console.warn(
          `[bot-update-identity] staff alert (with banner) failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
        );
      }
      return;
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) {
    console.warn(
      `[bot-update-identity] staff alert failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
    );
  }
}

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
      .select("id, user_id, bot_name, discord_last_username_change_at")
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

    // Resolve :emojiname: references in the bio against the bot's guild emojis.
    let resolvedBio = bio;
    if (bio !== null && /(?<![<a]):[a-zA-Z0-9_]+:/.test(bio)) {
      try {
        const gRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (gRes.ok) {
          const guilds = (await gRes.json()) as Array<{ id: string }>;
          const emojiMap: Record<string, { id: string; animated: boolean }> = {};
          const lists = await Promise.all(
            guilds.slice(0, 50).map(async (g) => {
              try {
                const r = await fetch(
                  `https://discord.com/api/v10/guilds/${g.id}/emojis`,
                  { headers: { Authorization: `Bot ${botToken}` } },
                );
                if (!r.ok) return [];
                return (await r.json()) as Array<{
                  id: string | null;
                  name: string | null;
                  animated?: boolean;
                }>;
              } catch {
                return [];
              }
            }),
          );
          for (const list of lists) {
            for (const e of list) {
              if (e.id && e.name && !emojiMap[e.name]) {
                emojiMap[e.name] = { id: e.id, animated: !!e.animated };
              }
            }
          }
          resolvedBio = bio.replace(
            /(?<![<a]):([a-zA-Z0-9_]+):/g,
            (match, name: string) => {
              const e = emojiMap[name];
              if (!e) return match;
              return `<${e.animated ? "a" : ""}:${name}:${e.id}>`;
            },
          );
          console.log(
            `[bot-update-identity] bot=${botId} resolved emojis: ${
              Object.keys(emojiMap).length
            } available, bio changed=${resolvedBio !== bio}`,
          );
        }
      } catch (e) {
        console.warn(`[bot-update-identity] emoji resolve failed: ${(e as Error).message}`);
      }
    }

    // Username / avatar / banner live on the bot USER (/users/@me).
    // The description ("About Me") is the APPLICATION description and must go
    // to /applications/@me — Discord silently ignores `bio` on /users/@me for
    // bots, which is why descriptions used to need a manual staff copy-paste.
    const payload: Record<string, unknown> = {};
    if (username !== null) payload.username = username;
    if (avatar !== null) payload.avatar = avatar;
    if (banner !== null) payload.banner = banner;

    const fieldsSent = Object.keys(payload);
    let updated: any = {};

    if (fieldsSent.length > 0) {
      console.log(`[bot-update-identity] bot=${botId} PATCH /users/@me fields=${fieldsSent.join(",")}`);
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
        `[bot-update-identity] bot=${botId} users_status=${dRes.status} retry_after=${
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
      updated = (() => {
        try { return JSON.parse(rawBody); } catch { return {} as any; }
      })();
    }

    // Description → PATCH /applications/@me { description }. Empty string clears
    // it. This is the field that used to always fall to the manual staff flow.
    let descriptionApplied = true;
    if (resolvedBio !== null) {
      const aRes = await fetch("https://discord.com/api/v10/applications/@me", {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: resolvedBio.slice(0, 400) }),
      });
      const aBody = await aRes.text();
      console.log(
        `[bot-update-identity] bot=${botId} applications_status=${aRes.status} body=${aBody.slice(0, 300)}`,
      );
      if (!aRes.ok) {
        // 429 is retryable by the caller; surface it. Other failures fall to
        // the staff alert below rather than blocking the whole update.
        if (aRes.status === 429) {
          const retryAfter = aRes.headers.get("retry-after");
          return json(429, {
            error: `Discord API error 429: ${aBody.slice(0, 300)}`,
            retry_after: retryAfter ? Number(retryAfter) : undefined,
          });
        }
        descriptionApplied = false;
      } else {
        // Verify Discord stored what we sent (empty means we cleared it).
        try {
          const appJson = JSON.parse(aBody);
          const want = resolvedBio.slice(0, 400).trim();
          const got = typeof appJson?.description === "string" ? appJson.description.trim() : "";
          descriptionApplied = got === want;
        } catch {
          /* keep optimistic */
        }
      }
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
    if (bio !== null) dbPatch.bot_bio = resolvedBio;

    if (avatar !== null && newAvatarUrl) dbPatch.icon_url = newAvatarUrl;
    if (banner !== null && newBannerUrl) dbPatch.banner_url = newBannerUrl;

    const { error: updErr } = await admin
      .from("bot_orders")
      .update(dbPatch)
      .eq("id", botId);
    if (updErr) {
      console.warn("bot-update-identity: db persist failed", updErr);
    }

    // Staff alert is now a genuine last resort, not the normal path: the
    // description applies automatically via /applications/@me, so we only ping
    // when Discord actually refused (applications PATCH failed, or the banner
    // came back empty despite being sent).
    const descriptionDropped = resolvedBio !== null && !descriptionApplied;
    const bannerDropped = banner !== null && !updated?.banner;
    if (descriptionDropped || bannerDropped) {
      notifyStaffManualApply({
        botName: (username ?? order.bot_name ?? "Unknown bot") as string,
        orderId: botId,
        bioText: descriptionDropped ? resolvedBio : null,
        bannerDataUrl: bannerDropped ? banner : null,
      }).catch((e) =>
        console.warn("[bot-update-identity] staff alert error", (e as Error).message),
      );
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
