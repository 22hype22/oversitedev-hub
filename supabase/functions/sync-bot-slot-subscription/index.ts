// Lightweight subscription sync endpoint.
// Called from the dashboard after returning from Checkout, or from a future
// payments-webhook hook. Reads the latest state from Stripe and writes it
// to bot_server_slots.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function resolveStripeEnv(): StripeEnv {
  const explicit = (Deno.env.get("STRIPE_ENVIRONMENT") || "").toLowerCase();
  if (explicit === "live" || explicit === "sandbox") return explicit as StripeEnv;
  if (Deno.env.get("STRIPE_LIVE_API_KEY")) return "live";
  return "sandbox";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const botId = String(body.botId ?? "");
    if (!botId) return new Response("botId required", { status: 400, headers: corsHeaders });

    const { data: bot } = await supabaseAdmin
      .from("bot_orders")
      .select("user_id")
      .eq("id", botId)
      .maybeSingle();
    if (!bot || bot.user_id !== user.id) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);

    // Find the most recent subscription for this bot.
    const subs = await stripe.subscriptions.search({
      query: `metadata['kind']:'bot_server_slot' AND metadata['bot_id']:'${botId}'`,
      limit: 1,
    });
    const sub = subs.data[0];
    if (!sub) {
      return new Response(JSON.stringify({ ok: true, found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const item = sub.items.data[0];
    const qty = item?.quantity ?? 0;
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    await supabaseAdmin
      .from("bot_server_slots")
      .upsert(
        {
          bot_id: botId,
          user_id: user.id,
          extra_slots: qty,
          stripe_subscription_id: sub.id,
          stripe_price_id: item?.price?.id ?? null,
          status: sub.status,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bot_id" },
      );

    return new Response(
      JSON.stringify({ ok: true, found: true, extra_slots: qty, status: sub.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-bot-slot-subscription:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
