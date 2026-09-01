import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Payload {
  bot_id: string;
  guild_id: string;
  message_id: string;
  channel_id: string;
  channel_name?: string;
  /** When true, remove this panel from posted_panels[guild_id] instead of upserting. */
  delete?: boolean;
}

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<Payload>;
    if (
      !isStr(body.bot_id) ||
      !isStr(body.guild_id) ||
      !isStr(body.message_id) ||
      !isStr(body.channel_id)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "bot_id, guild_id, message_id, and channel_id are required strings",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // AuthZ: this function runs with the service-role key (bypasses RLS), so it
    // must verify the caller before touching another bot's config. Require a
    // valid user session and confirm the caller owns bot_id (or is an admin) —
    // otherwise anyone could write/delete another bot's posted ticket panels.
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const { data: ownerRow, error: ownerErr } = await supabase
      .from("bot_orders")
      .select("id, user_id")
      .eq("id", body.bot_id)
      .maybeSingle();
    if (ownerErr) {
      return new Response(JSON.stringify({ error: ownerErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ownerRow) {
      return new Response(JSON.stringify({ error: "Bot not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ownerRow.user_id !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Not bot owner" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch existing row (if any) for this bot + feature.
    const { data: existing, error: selectError } = await supabase
      .from("bot_config")
      .select("id, config")
      .eq("bot_id", body.bot_id)
      .eq("feature", "ticket-panels")
      .maybeSingle();

    if (selectError) {
      return new Response(
        JSON.stringify({ error: selectError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const config: Record<string, any> =
      (existing?.config as Record<string, any> | null) ?? {};
    const postedPanels: Record<string, any[]> =
      (config.posted_panels as Record<string, any[]> | undefined) ?? {};
    const guildPanels = Array.isArray(postedPanels[body.guild_id])
      ? postedPanels[body.guild_id]
      : [];

    console.log(
      `[save-ticket-panel] BEFORE bot=${body.bot_id} guild=${body.guild_id} ` +
        `action=${body.delete === true ? "delete" : "upsert"} ` +
        `message_id=${body.message_id} channel_id=${body.channel_id} ` +
        `existing_count=${guildPanels.length} existing=${JSON.stringify(guildPanels)}`,
    );

    let nextGuildPanels: any[];
    let entry: Record<string, any> | null = null;

    if (body.delete === true) {
      // Remove any panel matching this message_id (or channel_id as fallback).
      nextGuildPanels = guildPanels.filter(
        (p) =>
          p &&
          p.message_id !== body.message_id &&
          // also drop legacy entries that only matched by channel
          !(p.message_id == null && p.channel_id === body.channel_id),
      );
    } else {
      entry = {
        channel_id: body.channel_id,
        message_id: body.message_id,
        channel_name: body.channel_name ?? null,
        posted_at: new Date().toISOString(),
      };
      // Replace any existing panel with the same message_id, then append the new one.
      // Dedupe by message_id (not channel_id) so multiple panels can coexist in one channel.
      nextGuildPanels = [
        ...guildPanels.filter((p) => p && p.message_id !== body.message_id),
        entry,
      ];
    }

    console.log(
      `[save-ticket-panel] AFTER bot=${body.bot_id} guild=${body.guild_id} ` +
        `next_count=${nextGuildPanels.length} next=${JSON.stringify(nextGuildPanels)}`,
    );

    const nextConfig = {
      ...config,
      posted_panels: {
        ...postedPanels,
        [body.guild_id]: nextGuildPanels,
      },
    };

    const upsertRow: Record<string, any> = {
      bot_id: body.bot_id,
      feature: "ticket-panels",
      config: nextConfig,
    };
    if (existing?.id) upsertRow.id = existing.id;

    const { error: upsertError } = await supabase
      .from("bot_config")
      .upsert(upsertRow, { onConflict: "bot_id,feature" });

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: upsertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, deleted: body.delete === true, panel: entry }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
