import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function discordFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return res;
}

async function openDM(discordUserId: string): Promise<string | null> {
  const res = await discordFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!res.ok) {
    console.error("openDM failed", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  return json.id as string;
}

async function sendDM(channelId: string, title: string, body: string) {
  const res = await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [
        {
          title: title.slice(0, 256),
          description: body.slice(0, 4000),
          color: 0xef4444,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord send failed (${res.status}): ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Pull pending notifications (max 25 per run)
    const { data: pending, error } = await admin
      .from("bot_notifications")
      .select("id, user_id, event_type, title, body, attempts")
      .eq("status", "pending")
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(25);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve discord IDs in one query
    const userIds = [...new Set(pending.map((n) => n.user_id))];
    const { data: prefs } = await admin
      .from("user_notification_prefs")
      .select("user_id, discord_user_id")
      .in("user_id", userIds);

    const idMap = new Map<string, string>();
    (prefs || []).forEach((p) => {
      if (p.discord_user_id) idMap.set(p.user_id, p.discord_user_id);
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const n of pending) {
      const discordId = idMap.get(n.user_id);
      if (!discordId) {
        await admin
          .from("bot_notifications")
          .update({
            status: "skipped",
            error_message: "No Discord account linked",
          })
          .eq("id", n.id);
        skipped++;
        continue;
      }

      try {
        const channelId = await openDM(discordId);
        if (!channelId) throw new Error("Could not open DM channel");
        await sendDM(channelId, n.title, n.body);
        await admin
          .from("bot_notifications")
          .update({
            status: "sent",
            delivered_at: new Date().toISOString(),
            attempts: (n.attempts ?? 0) + 1,
          })
          .eq("id", n.id);
        sent++;
      } catch (e) {
        const attempts = (n.attempts ?? 0) + 1;
        await admin
          .from("bot_notifications")
          .update({
            status: attempts >= 5 ? "failed" : "pending",
            attempts,
            error_message: String((e as Error).message ?? e),
          })
          .eq("id", n.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: pending.length, sent, failed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("dispatch error", e);
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
