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

    const entry = {
      channel_id: body.channel_id,
      message_id: body.message_id,
      channel_name: body.channel_name ?? null,
      posted_at: new Date().toISOString(),
    };

    // Replace any existing panel for the same channel, then append the new one.
    const nextGuildPanels = [
      ...guildPanels.filter(
        (p) => p && p.channel_id !== body.channel_id,
      ),
      entry,
    ];

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
      JSON.stringify({ ok: true, panel: entry }),
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
