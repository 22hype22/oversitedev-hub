import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

interface LineItemInput {
  priceId: string;
  quantity?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { items, customerEmail, returnUrl, environment } = body as {
      items: LineItemInput[];
      customerEmail?: string;
      returnUrl?: string;
      environment?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const it of items) {
      if (!it.priceId || typeof it.priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(it.priceId)) {
        return new Response(JSON.stringify({ error: "Invalid priceId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const env = ((environment || "sandbox") as StripeEnv);
    const stripe = createStripeClient(env);

    // Resolve all human-readable price IDs via lookup_keys
    const lookupKeys = items.map((i) => i.priceId);
    const prices = await stripe.prices.list({ lookup_keys: lookupKeys, limit: 100 });
    const priceMap = new Map(prices.data.map((p) => [p.lookup_key, p]));

    const lineItems = [];
    let hasRecurring = false;
    let hasOneTime = false;

    for (const it of items) {
      const stripePrice = priceMap.get(it.priceId);
      if (!stripePrice) {
        return new Response(JSON.stringify({ error: `Price not found: ${it.priceId}` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (stripePrice.type === "recurring") hasRecurring = true;
      else hasOneTime = true;

      lineItems.push({ price: stripePrice.id, quantity: it.quantity || 1 });
    }

    if (hasRecurring && hasOneTime) {
      return new Response(
        JSON.stringify({
          error:
            "Cannot mix subscriptions and one-time products in a single checkout. Please check out subscriptions separately.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: hasRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      return_url:
        returnUrl ||
        `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
