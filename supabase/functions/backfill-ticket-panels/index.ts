// Scans a guild's text channels for messages authored by the bot that look
// like ticket panels (component with custom_id "ticket_category_select", or a
// button/select whose custom_id starts with "ticket_open" / "ticket_panel"),
// and merges any new ones into bot_config.posted_panels[guild_id] so the
// dashboard "Edit ticket panel" view can list every panel — including ones
// posted before the posted_panels sync existed.
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

// Discord channel types that can contain a posted panel message.
const TEXTUAL = new Set([0, 5]); // text + announcement
const MESSAGES_PER_CHANNEL = 100; // single page; panels are usually pinned-ish recent

const PANEL_PREFIXES = ["ticket_open", "ticket_panel", "ticket_create"];
const PANEL_EXACT = new Set(["ticket_category_select"]);

function isPanelComponents(components: any[]): boolean {
  if (!Array.isArray(components)) return false;
  for (const row of components) {
    const children = Array.isArray(row?.components) ? row.components : [];
    for (const c of children) {
      const cid: string | undefined = typeof c?.custom_id === "string" ? c.custom_id : undefined;
      if (!cid) continue;
      if (PANEL_EXACT.has(cid)) return true;
      if (PANEL_PREFIXES.some((p) => cid.startsWith(p))) return true;
    }
  }
  return false;
}

async function discordFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
  return res;
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
    const guildId = String(body.guild_id || "");
    if (!botId) return json(400, { error: "bot_id required" });
    if (!guildId) return json(400, { error: "guild_id required" });

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

    // Identify the bot's own user id so we can filter messages by author.
    const meRes = await discordFetch("https://discord.com/api/v10/users/@me", botToken);
    if (!meRes.ok) {
      const text = await meRes.text();
      return json(502, { error: `Discord /users/@me failed ${meRes.status}: ${text.slice(0, 200)}` });
    }
    const me = await meRes.json() as { id: string };
    const botUserId = me.id;

    // List channels in the guild.
    const chRes = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      botToken,
    );
    if (!chRes.ok) {
      const text = await chRes.text();
      return json(chRes.status === 401 || chRes.status === 403 ? 400 : 502, {
        error: `Discord channels fetch ${chRes.status}: ${text.slice(0, 200)}`,
      });
    }
    const channels = await chRes.json() as Array<{
      id: string; name?: string; type: number;
    }>;
    const textual = channels.filter((c) => TEXTUAL.has(c.type));

    const found: Array<{
      channel_id: string;
      channel_name: string | null;
      message_id: string;
      posted_at: string;
    }> = [];
    const channelErrors: Array<{ channel_id: string; error: string }> = [];

    // Scan each channel for the bot's panel messages.
    for (const c of textual) {
      try {
        const mRes = await discordFetch(
          `https://discord.com/api/v10/channels/${c.id}/messages?limit=${MESSAGES_PER_CHANNEL}`,
          botToken,
        );
        if (!mRes.ok) {
          // 403 = no read perms; skip silently
          if (mRes.status !== 403) {
            channelErrors.push({
              channel_id: c.id,
              error: `messages fetch ${mRes.status}`,
            });
          }
          continue;
        }
        const msgs = await mRes.json() as Array<{
          id: string;
          author?: { id?: string };
          components?: any[];
          timestamp?: string;
        }>;
        for (const m of msgs) {
          if (m.author?.id !== botUserId) continue;
          if (!isPanelComponents(m.components ?? [])) continue;
          found.push({
            channel_id: c.id,
            channel_name: c.name ?? null,
            message_id: m.id,
            posted_at: m.timestamp ?? new Date().toISOString(),
          });
        }
      } catch (e) {
        channelErrors.push({
          channel_id: c.id,
          error: (e as Error).message ?? "fetch error",
        });
      }
    }

    // Merge into bot_config.posted_panels[guild_id], deduped by message_id.
    const { data: existing, error: selErr } = await admin
      .from("bot_config")
      .select("id, config")
      .eq("bot_id", botId)
      .eq("feature", "ticket-panels")
      .maybeSingle();
    if (selErr) return json(500, { error: selErr.message });

    const config: Record<string, any> = (existing?.config as any) ?? {};
    const postedPanels: Record<string, any[]> = (config.posted_panels as any) ?? {};
    const current = Array.isArray(postedPanels[guildId]) ? postedPanels[guildId] : [];
    const byMsg = new Map<string, any>();
    for (const p of current) {
      if (p?.message_id) byMsg.set(String(p.message_id), p);
    }
    let added = 0;
    for (const f of found) {
      if (byMsg.has(f.message_id)) continue;
      byMsg.set(f.message_id, f);
      added++;
    }

    const merged = Array.from(byMsg.values());
    const nextConfig = {
      ...config,
      posted_panels: { ...postedPanels, [guildId]: merged },
    };
    const upsertRow: Record<string, any> = {
      bot_id: botId,
      feature: "ticket-panels",
      config: nextConfig,
    };
    if (existing?.id) upsertRow.id = existing.id;

    const { error: upErr } = await admin
      .from("bot_config")
      .upsert(upsertRow, { onConflict: "bot_id,feature" });
    if (upErr) return json(500, { error: upErr.message });

    return json(200, {
      ok: true,
      scanned_channels: textual.length,
      found: found.length,
      added,
      total_after: merged.length,
      channel_errors: channelErrors,
    });
  } catch (e) {
    console.error("backfill-ticket-panels error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
