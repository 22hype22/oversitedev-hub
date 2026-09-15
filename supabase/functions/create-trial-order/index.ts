// Fulfils a bot order paid for with a trial code: no Stripe, no charge, the
// full build and deploy flow, and a trial clock attached to the new bot.
//
// This is create-comped-order's shape, gated on a trial code instead of the
// comp list. It runs with the service role because the customer must not be
// able to mark their own order paid — the code, the product it is for and the
// date it runs to are all checked here, not taken from the checkout form.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const FULFILLED = ["paid", "ready", "live", "waitlisted"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { botOrderId, code } = await req.json().catch(() => ({} as any));
    if (!botOrderId || typeof botOrderId !== "string") return json({ error: "botOrderId required" }, 400);
    if (!code || typeof code !== "string") return json({ error: "code required" }, 400);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(token);
    const user = auth?.user;
    if (!user) return json({ error: "not authenticated" }, 401);

    const { data: trial } = await admin
      .from("bot_free_period_codes")
      .select("id, code, base, ends_at, is_active, expires_at, max_uses, times_used, teardown_on_expiry")
      .ilike("code", code.trim())
      .maybeSingle();

    const now = new Date();
    if (
      !trial ||
      !trial.is_active ||
      !trial.teardown_on_expiry ||
      !trial.ends_at ||
      new Date(trial.ends_at) <= now ||
      (trial.expires_at && new Date(trial.expires_at) <= now) ||
      (trial.max_uses !== null && (trial.times_used ?? 0) >= trial.max_uses)
    ) {
      return json({ error: "That trial code can't be used." }, 400);
    }

    const { data: order } = await admin
      .from("bot_orders")
      .select("id, user_id, base, status, total_amount, monthly_hosting")
      .eq("id", botOrderId)
      .maybeSingle();
    if (!order || order.user_id !== user.id) return json({ error: "order not found" }, 404);

    if (trial.base && String(order.base ?? "").toLowerCase() !== String(trial.base).toLowerCase()) {
      return json({ error: `That code is only for ${trial.base} bots.` }, 400);
    }

    // Already fulfilled — idempotent, and the claim below is idempotent too, so
    // a retried request never spends a second use of the code.
    const already = FULFILLED.includes(String(order.status));

    const nowIso = now.toISOString();
    let status = String(order.status);

    if (!already) {
      // Token-gate exactly like a real payment: enough free tokens for this
      // order and any siblings → paid, otherwise waitlisted and auto-promoted
      // when one frees up. Either way nobody is charged.
      const { count: kids } = await admin
        .from("bot_orders")
        .select("id", { count: "exact", head: true })
        .eq("parent_order_id", order.id);
      const { count: available } = await admin
        .from("bot_token_pool")
        .select("id", { count: "exact", head: true })
        .eq("status", "available");
      status = (available ?? 0) >= 1 + (kids ?? 0) ? "paid" : "waitlisted";
      const paidFields = status === "paid" ? { paid_at: nowIso, charged_at: nowIso } : {};

      await admin
        .from("bot_orders")
        .update({
          status,
          total_amount: 0,
          discount_amount: order.total_amount ?? 0,
          discount_code: trial.code,
          updated_at: nowIso,
          ...paidFields,
        })
        .eq("id", order.id)
        .not("status", "in", "(paid,waitlisted,ready,live)");

      await admin
        .from("bot_orders")
        .update({ status, total_amount: 0, updated_at: nowIso, ...paidFields })
        .eq("parent_order_id", order.id)
        .not("status", "in", "(paid,waitlisted,ready,live)");

      // A trial is hosted free for as long as it runs.
      if (order.monthly_hosting) {
        await admin.from("hosting_subscriptions").upsert(
          {
            user_id: user.id,
            status: "active",
            billing_override: true,
            past_due_since: null,
            grace_period_ends_at: null,
            updated_at: nowIso,
          },
          { onConflict: "user_id" },
        );
      }
    }

    // Attach the clock. Done through the RPC so there is one implementation of
    // what claiming a trial means, and it is idempotent per order.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );
    const { data: claim, error: claimErr } = await userClient.rpc("claim_trial_for_order", {
      _code: trial.code,
      _bot_id: order.id,
    });
    if (claimErr || !(claim as any)?.ok) {
      // The order is already fulfilled at this point, so failing here would
      // hand them a free bot with no end date. Say so loudly instead.
      console.error(
        `[trial-order] claim failed for order ${order.id}: ${claimErr?.message ?? (claim as any)?.error}`,
      );
      return json({ error: (claim as any)?.error ?? "Could not start the trial." }, 500);
    }

    console.log(`[trial-order] ${trial.code} started on ${order.id} until ${(claim as any).free_until}`);
    return json({ trial: true, status, free_until: (claim as any).free_until });
  } catch (e) {
    console.error("create-trial-order failed:", e);
    return json({ error: "Could not process the trial order." }, 500);
  }
});
