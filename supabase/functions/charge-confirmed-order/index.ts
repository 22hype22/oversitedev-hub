// Charge a customer's saved payment method off-session for a confirmed
// preorder. Called when the build is about to start (token assigned), AFTER
// the customer has confirmed the order via Discord DM.
//
// Auth: requires `INTERNAL_CHARGE_SECRET` header. The utilities-bot worker
// and the Go Live sweeper both pass this. We don't expose this to end users.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-charge-secret",
};

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

  const secret = Deno.env.get("INTERNAL_CHARGE_SECRET");
  if (secret && req.headers.get("x-internal-charge-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { botOrderId } = await req.json();
    if (!botOrderId) {
      return new Response(JSON.stringify({ error: "botOrderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error } = await supabaseAdmin
      .from("bot_orders")
      .select("id, user_id, total_amount, currency, stripe_customer_id, stripe_payment_method_id, charged_at, status")
      .eq("id", botOrderId)
      .maybeSingle();
    if (error || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.charged_at) {
      return new Response(JSON.stringify({ ok: true, already_charged: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!order.stripe_customer_id || !order.stripe_payment_method_id) {
      return new Response(JSON.stringify({ error: "No saved payment method on order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);
    const amountCents = Math.max(50, Math.round(Number(order.total_amount) * 100));

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: (order.currency || "usd").toLowerCase(),
      customer: order.stripe_customer_id,
      payment_method: order.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: { bot_order_id: order.id, user_id: order.user_id, environment: env },
    });

    if (intent.status === "succeeded") {
      await supabaseAdmin
        .from("bot_orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          charged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      // Propagate to sibling rows (pack / multi-bot orders).
      await supabaseAdmin
        .from("bot_orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          charged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("parent_order_id", order.id);
      return new Response(JSON.stringify({ ok: true, paymentIntentId: intent.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: false, status: intent.status, paymentIntentId: intent.id }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("charge-confirmed-order failed:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Charge failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
