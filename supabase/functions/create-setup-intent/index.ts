// Preorder flow: save the customer's card via a SetupIntent. No charge.
// We'll charge off-session via PaymentIntent when the customer confirms
// their order via the Oversite Utilities Discord DM.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  try {
    const { botOrderId, customerEmail } = await req.json();
    if (!botOrderId || typeof botOrderId !== "string") {
      return new Response(JSON.stringify({ error: "botOrderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AuthZ: this runs with the service-role key and mutates the order (status +
    // Stripe customer). Require the caller to be signed in and own the order so
    // nobody can start a card-save flow against someone else's order.
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const caller = userRes?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);

    // Find or create the Stripe customer for this order's user.
    const { data: order } = await supabaseAdmin
      .from("bot_orders")
      .select("id, user_id, stripe_customer_id, bot_name")
      .eq("id", botOrderId)
      .maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.user_id !== caller.id) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let customerId = order.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: customerEmail || undefined,
        metadata: { user_id: order.user_id, bot_order_id: order.id },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        bot_order_id: order.id,
        user_id: order.user_id,
        environment: env,
      },
    });

    await supabaseAdmin
      .from("bot_orders")
      .update({
        stripe_customer_id: customerId,
        stripe_setup_intent_id: setupIntent.id,
        status: "preorder_pending_card",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({ clientSecret: setupIntent.client_secret, setupIntentId: setupIntent.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-setup-intent failed:", e);
    return new Response(
      JSON.stringify({ error: "Could not start preorder. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
