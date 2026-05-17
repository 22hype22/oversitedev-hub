import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UTILITIES_BOT_ID = "e7f81d81-5645-4d81-93d4-1ae58b6ba77f";

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return json(401, { error: "Unauthorized" });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({} as any));
    const botId = String(body.botId || "");
    if (!botId) return json(400, { error: "botId required" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: bot, error: botErr } = await admin
      .from("bot_orders")
      .select("id, user_id")
      .eq("id", botId)
      .maybeSingle();
    if (botErr) return json(500, { error: botErr.message });
    if (!bot) return json(404, { error: "Bot not found" });

    if (bot.user_id !== userId) {
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) return json(403, { error: "Forbidden" });
    }

    const { data: utilsBot, error: utilsErr } = await admin
      .from("bot_orders")
      .select("user_id")
      .eq("id", UTILITIES_BOT_ID)
      .maybeSingle();
    if (utilsErr) return json(500, { error: utilsErr.message });
    if (!utilsBot) return json(404, { error: "Utilities bot not found" });

    const { error: insErr } = await admin.from("bot_commands").insert({
      bot_id: UTILITIES_BOT_ID,
      user_id: utilsBot.user_id,
      requested_by: userId,
      action: "setup_stats",
      status: "pending",
      payload: { source_bot_id: botId },
    });

    if (insErr) return json(500, { error: insErr.message });

    return json(200, { ok: true });
  } catch (e) {
    console.error("enqueue-setup-stats error", e);
    return json(500, { error: String((e as Error).message ?? e) });
  }
});
