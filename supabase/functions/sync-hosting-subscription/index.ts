// sync-hosting-subscription
// Ensures the caller's monthly bot-hosting Stripe subscription matches their
// current paid-bot count:
//   0 paid bots → cancel any active hosting sub
//   1 paid bot  → bot_hosting_solo ($5/mo)
//   2+ paid    → bot_hosting_multi ($10/mo, flat)
//
// Called from the dashboard after a bot is paid for, after a bot is
// cancelled, and as a one-shot button when the user lands on the dashboard
// with a missing hosting sub. The payments-webhook still owns lifecycle
// writes into `hosting_subscriptions` — this function only talks to Stripe.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { isBillableBase } from "../_shared/billing.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function resolveStripeEnv(): StripeEnv {
  const explicit = (Deno.env.get("STRIPE_ENVIRONMENT") || "").toLowerCase();
  if (explicit === "live" || explicit === "sandbox") return explicit as StripeEnv;
  if (Deno.env.get("STRIPE_LIVE_API_KEY")) return "live";
  return "sandbox";
}

const PAID_STATUSES = ["paid", "ready"] as const;

// Which bot bases are billed monthly hosting lives in the shared billing
// module (isBillableBase) so this function and enforce-hosting-grace can never
// drift apart. ER:LC / Roblox bots are one-time and hosted free.
const ACTIVE_SUB_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
]);

async function resolvePriceId(stripe: ReturnType<typeof createStripeClient>, lookupKey: string) {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = list.data[0];
  if (!price) throw new Error(`Stripe price not found for lookup_key=${lookupKey}`);
  return price.id;
}

async function findExistingHostingSub(
  stripe: ReturnType<typeof createStripeClient>,
  userId: string,
) {
  const res = await stripe.subscriptions.search({
    query: `metadata['kind']:'bot_hosting' AND metadata['userId']:'${userId}'`,
    limit: 10,
  });
  // Prefer a non-canceled subscription.
  const active = res.data.find((s) => s.status !== "canceled");
  return active ?? res.data[0] ?? null;
}

async function getCustomerForUser(userId: string): Promise<{ customer: string | null; pm: string | null }> {
  // Prefer the hosting_subscriptions row if present, fall back to the latest bot_order.
  const { data: sub } = await admin
    .from("hosting_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (sub?.stripe_customer_id) {
    const { data: order } = await admin
      .from("bot_orders")
      .select("stripe_payment_method_id")
      .eq("user_id", userId)
      .not("stripe_payment_method_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { customer: sub.stripe_customer_id, pm: order?.stripe_payment_method_id ?? null };
  }
  const { data: order } = await admin
    .from("bot_orders")
    .select("stripe_customer_id, stripe_payment_method_id")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    customer: order?.stripe_customer_id ?? null,
    pm: order?.stripe_payment_method_id ?? null,
  };
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

    // Count this user's paid (and ready) bots that are actually billable —
    // Discord bots only. ER:LC / Roblox bots are one-time and hosted free, so
    // they must never add to the monthly hosting subscription.
    const { data: paidRows, error: countErr } = await admin
      .from("bot_orders")
      .select("base")
      .eq("user_id", user.id)
      .in("status", PAID_STATUSES as unknown as string[]);
    if (countErr) throw countErr;
    const paidBots = (paidRows ?? []).filter(
      (r: { base: string | null }) => isBillableBase(r.base),
    ).length;

    // Short-circuit: users who redeemed a billing override code are
    // paying off-platform (e.g. PayPal) — never create or modify a
    // Stripe subscription for them.
    const { data: overrideRow } = await admin
      .from("hosting_subscriptions")
      .select("billing_override")
      .eq("user_id", user.id)
      .maybeSingle();
    if (overrideRow?.billing_override) {
      return new Response(
        JSON.stringify({ ok: true, paidBots, tier: null, action: "billing_override" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const env = resolveStripeEnv();
    const stripe = createStripeClient(env);
    const existing = await findExistingHostingSub(stripe, user.id);

    // Case 1: no paid bots → cancel any active hosting sub.
    if (paidBots === 0) {
      if (existing && ACTIVE_SUB_STATUSES.has(existing.status)) {
        await stripe.subscriptions.cancel(existing.id);
      }
      return new Response(
        JSON.stringify({ ok: true, paidBots, tier: null, action: "cancelled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const targetLookup = paidBots === 1 ? "bot_hosting_solo" : "bot_hosting_multi";
    const targetPriceId = await resolvePriceId(stripe, targetLookup);

    // Case 2: existing active sub → swap item if on the wrong tier.
    if (existing && ACTIVE_SUB_STATUSES.has(existing.status)) {
      const item = existing.items.data[0];
      if (item?.price?.id === targetPriceId) {
        return new Response(
          JSON.stringify({ ok: true, paidBots, tier: targetLookup, action: "unchanged" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      await stripe.subscriptions.update(existing.id, {
        items: [{ id: item.id, price: targetPriceId }],
        proration_behavior: "create_prorations",
        metadata: { kind: "bot_hosting", userId: user.id },
      });
      return new Response(
        JSON.stringify({ ok: true, paidBots, tier: targetLookup, action: "swapped" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Case 3: no active sub → create one. Requires a saved customer + PM.
    const { customer, pm } = await getCustomerForUser(user.id);
    if (!customer) {
      return new Response(
        JSON.stringify({
          ok: false,
          paidBots,
          tier: targetLookup,
          action: "needs_payment_method",
          reason: "No Stripe customer on file for this user",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let effectivePm: string | null = pm;
    if (effectivePm) {
      try {
        await stripe.paymentMethods.attach(effectivePm, { customer });
      } catch (_) {
        // Already attached — ignore.
      }
      await stripe.customers.update(customer, {
        invoice_settings: { default_payment_method: effectivePm },
      });
    } else {
      // Fall back to whatever PM the customer already has on file.
      const cust = await stripe.customers.retrieve(customer) as any;
      effectivePm = cust?.invoice_settings?.default_payment_method
        ?? cust?.default_source
        ?? null;
      if (!effectivePm) {
        const pms = await stripe.paymentMethods.list({ customer, type: "card", limit: 1 });
        effectivePm = pms.data[0]?.id ?? null;
        if (effectivePm) {
          await stripe.customers.update(customer, {
            invoice_settings: { default_payment_method: effectivePm },
          });
        }
      }
    }

    if (!effectivePm) {
      return new Response(
        JSON.stringify({
          ok: false,
          paidBots,
          tier: targetLookup,
          action: "needs_payment_method",
          reason: "Customer has no default payment method on file",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const created = await stripe.subscriptions.create({
      customer,
      items: [{ price: targetPriceId }],
      default_payment_method: effectivePm,
      metadata: { kind: "bot_hosting", userId: user.id },
      payment_behavior: "allow_incomplete",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        paidBots,
        tier: targetLookup,
        action: "created",
        subscriptionId: created.id,
        status: created.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-hosting-subscription:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
