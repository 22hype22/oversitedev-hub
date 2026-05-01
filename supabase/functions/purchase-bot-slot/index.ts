import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const SLOT_PRICE_CENTS = 499; // $4.99/month per extra slot

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

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return bad("Not authenticated", 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return bad("Not authenticated", 401);

    const body = await req.json().catch(() => ({}));
    const botId = String(body.botId ?? "");
    const additionalSlots = Math.max(1, Math.min(50, Number(body.additionalSlots ?? 1) | 0));
    const returnUrl = String(body.returnUrl ?? "");
    if (!botId) return bad("botId required");
    if (!/^https?:\/\//.test(returnUrl)) return bad("Invalid returnUrl");

    // Verify ownership
    const { data: bot } = await supabaseAdmin
      .from("bot_orders")
      .select("id, user_id, bot_name")
      .eq("id", botId)
      .maybeSingle();
    if (!bot || bot.user_id !== user.id) return bad("Bot not found", 404);

    // Existing slot row (to compute the new total quantity)
    const { data: existing } = await supabaseAdmin
      .from("bot_server_slots")
      .select("extra_slots, status, stripe_subscription_id")
      .eq("bot_id", botId)
      .maybeSingle();

    const currentActive =
      existing && (existing.status === "active" || existing.status === "trialing")
        ? existing.extra_slots
        : 0;
    const newTotal = currentActive + additionalSlots;

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);

    // If they already have an active subscription, just bump quantity.
    if (existing?.stripe_subscription_id && currentActive > 0) {
      const sub = await stripe.subscriptions.retrieve(existing.stripe_subscription_id);
      const item = sub.items.data[0];
      if (!item) return bad("Subscription has no items", 500);
      await stripe.subscriptions.update(existing.stripe_subscription_id, {
        items: [{ id: item.id, quantity: newTotal }],
        proration_behavior: "create_prorations",
      });
      // Webhook will sync, but write through immediately for snappy UI.
      await supabaseAdmin
        .from("bot_server_slots")
        .update({ extra_slots: newTotal, status: "active", updated_at: new Date().toISOString() })
        .eq("bot_id", botId);
      return new Response(
        JSON.stringify({ ok: true, mode: "updated_subscription", extra_slots: newTotal }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Otherwise create a Checkout subscription session.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Extra server slot — ${bot.bot_name}`,
              description: "Allows your bot to be in one additional Discord server.",
            },
            unit_amount: SLOT_PRICE_CENTS,
            recurring: { interval: "month" },
          },
          quantity: newTotal,
        },
      ],
      success_url: `${returnUrl}?slot_purchase=success`,
      cancel_url: `${returnUrl}?slot_purchase=cancelled`,
      metadata: {
        kind: "bot_server_slot",
        bot_id: botId,
        user_id: user.id,
        additional_slots: String(additionalSlots),
        new_total: String(newTotal),
      },
      subscription_data: {
        metadata: {
          kind: "bot_server_slot",
          bot_id: botId,
          user_id: user.id,
        },
      },
    });

    return new Response(JSON.stringify({ ok: true, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("purchase-bot-slot error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
