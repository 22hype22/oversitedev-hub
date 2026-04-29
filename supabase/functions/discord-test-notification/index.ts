import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify they have a discord_user_id linked
    const { data: prefs } = await admin
      .from("user_notification_prefs")
      .select("discord_user_id, discord_username")
      .eq("user_id", userId)
      .maybeSingle();

    if (!prefs?.discord_user_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Link your Discord first" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert a pending notification — the dispatcher cron will deliver it
    // within ~60s. We also kick the dispatcher right away for instant feedback.
    const { error: insErr } = await admin.from("bot_notifications").insert({
      user_id: userId,
      event_type: "bot_offline",
      title: "Test notification ✅",
      body: "This is a test message from Oversite. If you see this in Discord, your notifications are wired up correctly.",
    });
    if (insErr) throw insErr;

    // Fire dispatcher inline (non-blocking)
    const dispatchUrl = `${SUPABASE_URL}/functions/v1/discord-notify-dispatch`;
    fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, queued: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
