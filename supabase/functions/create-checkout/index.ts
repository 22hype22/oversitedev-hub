import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

interface LineItemInput {
  priceId?: string;
  productId?: string;
  productName?: string;
  amountCents?: number;
  currency?: string;
  quantity?: number;
  // For upgrade flow: link this checkout to an existing purchase row
  // and stamp the new version (the latest) onto the resulting purchase.
  purchaseType?: "initial" | "upgrade";
  parentPurchaseId?: string;
  upgradeToVersion?: string;
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_ITEMS = 20;
const MAX_QUANTITY = 100;

// Server-side determination of the active Stripe environment.
// Prefer an explicit STRIPE_ENVIRONMENT secret; otherwise fall back based on
// which API key is configured. The client cannot influence this value.
function resolveStripeEnv(): StripeEnv {
  const explicit = (Deno.env.get("STRIPE_ENVIRONMENT") || "").toLowerCase();
  if (explicit === "live" || explicit === "sandbox") return explicit as StripeEnv;
  if (Deno.env.get("STRIPE_LIVE_API_KEY")) return "live";
  return "sandbox";
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { items, customerEmail, returnUrl } = body as {
      items: LineItemInput[];
      customerEmail?: string;
      returnUrl?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest("No items provided");
    }
    if (items.length > MAX_ITEMS) {
      return badRequest("Too many items in cart");
    }

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);

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
      const qty = it.quantity || 1;
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
        return badRequest("Invalid item quantity");
      }
      if (it.priceId) {
        if (!/^[a-zA-Z0-9_-]+$/.test(it.priceId)) {
          return badRequest("Invalid item");
        }
        const stripePrice = priceMap.get(it.priceId);
        if (!stripePrice) {
          // Generic message — do not echo client-provided values back
          return badRequest("One or more items are unavailable");
        }
        if (stripePrice.type === "recurring") hasRecurring = true;
        else hasOneTime = true;
        lineItems.push({ price: stripePrice.id, quantity: qty });
      } else if (it.productId && it.amountCents && it.productName) {
        if (it.amountCents < 50) {
          return badRequest("Item amount too low");
        }
        hasOneTime = true;
        lineItems.push({
          price_data: {
            currency: (it.currency || "usd").toLowerCase(),
            product_data: { name: it.productName },
            unit_amount: it.amountCents,
          },
          quantity: qty,
        });
      } else {
        return badRequest("Invalid line item");
      }
    }

    if (hasRecurring && hasOneTime) {
      return badRequest(
        "Cannot mix subscriptions and one-time products in a single checkout. Please check out subscriptions separately.",
      );
    }

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

    if (productIds.length > 0) {
      const { data: dbProducts } = await supabaseAdmin
        .from("products")
        .select("id,name,file_url,file_name,price,current_version")
        .in("id", productIds);

      const productMap = new Map((dbProducts || []).map((p) => [p.id, p]));
      const rows = items
        .filter((it) => it.productId && productMap.has(it.productId))
        .map((it) => {
          const p = productMap.get(it.productId!)!;
          const isUpgrade = it.purchaseType === "upgrade";
          // For upgrades, stamp the version they're upgrading TO (latest available).
          const version = isUpgrade
            ? (it.upgradeToVersion || p.current_version || null)
            : (p.current_version ?? null);
          return {
            stripe_session_id: session.id,
            product_id: p.id,
            product_name: isUpgrade ? `${p.name} — Upgrade` : p.name,
            file_url: p.file_url,
            file_name: p.file_name,
            amount_cents: it.amountCents ?? Math.round(Number(p.price) * 100),
            currency: "usd",
            email: customerEmail || null,
            status: "pending",
            environment: env,
            version,
            purchase_type: isUpgrade ? "upgrade" : "initial",
            parent_purchase_id: isUpgrade ? (it.parentPurchaseId ?? null) : null,
          };
        });
      if (rows.length > 0) {
        await supabaseAdmin.from("purchases").insert(rows);
      }
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log full detail server-side; return generic message to the client.
    console.error("create-checkout failed:", error);
    return new Response(
      JSON.stringify({ error: "Checkout session could not be created. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
