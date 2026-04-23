import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

interface LineItemInput {
  // Either provide a Stripe lookup key (legacy / pre-created prices)
  priceId?: string;
  // OR provide dynamic pricing for a DB product
  productId?: string; // uuid of a row in public.products
  productName?: string;
  amountCents?: number; // unit amount in cents
  currency?: string;
  quantity?: number;
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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

    const env = ((environment || "sandbox") as StripeEnv);
    const stripe = createStripeClient(env);

    // Resolve any lookup-key based items in one call
    const lookupKeys = items
      .map((i) => i.priceId)
      .filter((k): k is string => !!k);
    let priceMap = new Map<string, any>();
    if (lookupKeys.length > 0) {
      const prices = await stripe.prices.list({
        lookup_keys: lookupKeys,
        limit: 100,
      });
      priceMap = new Map(prices.data.map((p) => [p.lookup_key as string, p]));
    }

    const lineItems: any[] = [];
    let hasRecurring = false;
    let hasOneTime = false;

    for (const it of items) {
      if (it.priceId) {
        if (!/^[a-zA-Z0-9_-]+$/.test(it.priceId)) {
          return new Response(JSON.stringify({ error: "Invalid priceId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const stripePrice = priceMap.get(it.priceId);
        if (!stripePrice) {
          return new Response(
            JSON.stringify({ error: `Price not found: ${it.priceId}` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (stripePrice.type === "recurring") hasRecurring = true;
        else hasOneTime = true;
        lineItems.push({ price: stripePrice.id, quantity: it.quantity || 1 });
      } else if (it.productId && it.amountCents && it.productName) {
        // Dynamic pricing for a DB product
        if (it.amountCents < 50) {
          return new Response(
            JSON.stringify({ error: `Amount too low for ${it.productName}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        hasOneTime = true;
        lineItems.push({
          price_data: {
            currency: (it.currency || "usd").toLowerCase(),
            product_data: { name: it.productName },
            unit_amount: it.amountCents,
          },
          quantity: it.quantity || 1,
        });
      } else {
        return new Response(JSON.stringify({ error: "Invalid line item" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    // Build a compact list of DB product IDs to remember for fulfilment
    const productIds = items
      .map((i) => i.productId)
      .filter((p): p is string => !!p);

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: hasRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      return_url:
        returnUrl ||
        `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: {
        product_ids: productIds.join(","),
        environment: env,
      },
    });

    // Pre-create pending purchase rows for any DB products so we can fulfil later
    if (productIds.length > 0) {
      const { data: dbProducts } = await supabaseAdmin
        .from("products")
        .select("id,name,file_url,file_name,price")
        .in("id", productIds);

      const rows = (dbProducts || []).map((p) => ({
        stripe_session_id: session.id,
        product_id: p.id,
        product_name: p.name,
        file_url: p.file_url,
        file_name: p.file_name,
        amount_cents: Math.round(Number(p.price) * 100),
        currency: "usd",
        email: customerEmail || null,
        status: "pending",
        environment: env,
      }));
      if (rows.length > 0) {
        await supabaseAdmin.from("purchases").insert(rows);
      }
    }

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
