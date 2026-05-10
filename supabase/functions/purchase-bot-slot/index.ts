import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

// One-time price per extra Discord-server slot. Slots are user-level
// (shared across every bot the user owns) and never expire.
const SLOT_PRICE_CENTS = 299; // $2.99 per slot, one-time

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
    const quantity = Math.max(1, Math.min(50, Number(body.additionalSlots ?? 1) | 0));
    const returnUrl = String(body.returnUrl ?? "");
    if (!/^https?:\/\//.test(returnUrl)) return bad("Invalid returnUrl");

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: quantity === 1
                ? "Extra Discord server slot"
                : `${quantity} extra Discord server slots`,
              description:
                "One-time purchase. Slot is shared across every bot you own and never expires.",
            },
            unit_amount: SLOT_PRICE_CENTS,
          },
          quantity,
        },
      ],
      success_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}slot_purchase=success`,
      cancel_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}slot_purchase=cancelled`,
      metadata: {
        kind: "user_server_slot",
        user_id: user.id,
        quantity: String(quantity),
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
