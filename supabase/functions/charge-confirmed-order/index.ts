// charge-confirmed-order — SELF-CONTAINED single-file version for Supabase dashboard deploy.
// The shared Stripe helper is inlined below.

import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- inlined from _shared/stripe.ts ----

export type StripeEnv = "sandbox" | "live";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  // Call Stripe's API directly with our own secret key. (Previously this was
  // proxied through Lovable's connector gateway, which required a
  // LOVABLE_API_KEY — removed so the payment stack doesn't depend on Lovable
  // Cloud and keeps working after migrating to our own hosting.)
  // STRIPE_{LIVE,SANDBOX}_API_KEY must be a real Stripe secret key (sk_live_…
  // / sk_test_…) from our own Stripe account.
  const apiKey = getConnectionApiKey(env);
  return new Stripe(apiKey, {
    apiVersion: "2025-03-31.basil",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
// ---- end inlined helper ----

// Charge a customer's saved payment method off-session for a confirmed
// preorder. Called when the build is about to start (token assigned), AFTER
// the customer has confirmed the order via Discord DM.
//
// Auth: requires `INTERNAL_CHARGE_SECRET` header. The utilities-bot worker
// and the Go Live sweeper both pass this. We don't expose this to end users.

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
      .select("id, user_id, total_amount, currency, stripe_customer_id, stripe_payment_method_id, stripe_setup_intent_id, charged_at, status")
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

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);

    // Resolve the saved card. Normally the setup_intent.succeeded webhook has
    // already written stripe_customer_id / stripe_payment_method_id. But if we
    // charge moments after the card is saved (in-stock path), the webhook may
    // not have landed yet — so fall back to reading the SetupIntent directly.
    let customerId = order.stripe_customer_id as string | null;
    let paymentMethodId = order.stripe_payment_method_id as string | null;
    if (!paymentMethodId && order.stripe_setup_intent_id) {
      try {
        const si = await stripe.setupIntents.retrieve(order.stripe_setup_intent_id);
        paymentMethodId = (si.payment_method as string) || null;
        customerId = customerId || ((si.customer as string) || null);
        if (paymentMethodId) {
          await supabaseAdmin
            .from("bot_orders")
            .update({ stripe_payment_method_id: paymentMethodId, stripe_customer_id: customerId })
            .eq("id", order.id);
        }
      } catch (e) {
        console.warn("charge-confirmed-order: setup intent lookup failed", (e as any)?.message);
      }
    }
    if (!customerId || !paymentMethodId) {
      return new Response(JSON.stringify({ error: "No saved payment method on order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountCents = Math.max(50, Math.round(Number(order.total_amount) * 100));

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: (order.currency || "usd").toLowerCase(),
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { bot_order_id: order.id, user_id: order.user_id, environment: env },
      },
      // Idempotency: a retry (or a race past the charged_at guard) re-uses the
      // same PaymentIntent instead of charging the card twice.
      { idempotencyKey: `charge-order-${order.id}` },
    );

    if (intent.status === "succeeded") {
      const ts = new Date().toISOString();
      // 1) 'paid' — the paid trigger assigns a token from the pool.
      await supabaseAdmin
        .from("bot_orders")
        .update({ status: "paid", paid_at: ts, charged_at: ts, updated_at: ts })
        .eq("id", order.id);
      await supabaseAdmin
        .from("bot_orders")
        .update({ status: "paid", paid_at: ts, charged_at: ts, updated_at: ts })
        .eq("parent_order_id", order.id);
      // 2) 'ready' — now that a token is assigned, fire the auto-deploy trigger.
      //    Charge success is the ONLY thing that flips an order to 'ready', so
      //    the build can never happen without a successful payment.
      await supabaseAdmin
        .from("bot_orders")
        .update({ status: "ready", updated_at: ts })
        .eq("id", order.id)
        .eq("status", "paid");
      await supabaseAdmin
        .from("bot_orders")
        .update({ status: "ready", updated_at: ts })
        .eq("parent_order_id", order.id)
        .eq("status", "paid");
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
