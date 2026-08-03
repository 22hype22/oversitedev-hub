// Confirm the post-payment Discord-join gate.
//
// Called by the DiscordJoinGate component on /checkout/return after the
// customer says "I've joined". Decides — server-side — whether the order
// goes down the in-stock path (status -> 'ready', auto-deploy fires) or the
// low-stock path (status -> 'confirmation' + a single DM asking for username
// confirmation).
//
// Always re-checks token availability at call time; never trusts the client.
//
// For multi-bot / pack orders we flip every sibling row, but only enqueue
// ONE notification (on the parent order) so the customer doesn't get
// 2-3 duplicate DMs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const INTERNAL_CHARGE_SECRET = Deno.env.get("INTERNAL_CHARGE_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Charge the saved card off-session (build-start). Returns ok=false on decline
// so the caller can refuse to deploy.
async function chargeOrder(botOrderId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/charge-confirmed-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
        "x-internal-charge-secret": INTERNAL_CHARGE_SECRET,
      },
      body: JSON.stringify({ botOrderId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) return { ok: true };
    return { ok: false, error: data?.error || `charge_failed_${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as any)?.message || "charge_error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return bad("Not authenticated", 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return bad("Not authenticated", 401);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId ?? "").trim();
    if (!orderId) return bad("orderId required");

    // Load the order; ensure it belongs to this user. Resolve the parent so
    // pack orders are handled as a single unit.
    const { data: order, error: orderErr } = await admin
      .from("bot_orders")
      .select(
        "id, user_id, parent_order_id, status, bot_name, discord_username, discord_user_id",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) return bad("Order not found", 404);
    if (order.user_id !== user.id) return bad("Forbidden", 403);

    const parentId = order.parent_order_id ?? order.id;

    // Pull every row in this order (parent + siblings) so we can flip them
    // together and count how many bot tokens this order needs.
    const { data: siblings, error: sibErr } = await admin
      .from("bot_orders")
      .select("id, status, bot_name, base")
      .or(`id.eq.${parentId},parent_order_id.eq.${parentId}`);
    if (sibErr || !siblings) return bad("Could not load order", 500);

    // Only rows that are post-payment and pre-fulfillment should transition.
    const eligible = siblings.filter((r) =>
      ["paid", "preorder", "preorder_pending_card"].includes(r.status),
    );
    const allIds = siblings.map((r) => r.id);

    if (eligible.length === 0) {
      // Nothing to flip — likely already past the gate. Treat as idempotent.
      return new Response(
        JSON.stringify({ ok: true, alreadyHandled: true, status: order.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const botsNeeded = eligible.length;
    const now = new Date().toISOString();

    // ── PRE-SALE GATE ──────────────────────────────────────────────────────
    // If any bot in this order is set to "Pre-order" or "Coming Soon" on the
    // storefront (per-bot `bot_availability` in app_settings), HOLD the whole
    // order as a reserved pre-order. The card is already saved (SetupIntent) but
    // we do NOT charge it and do NOT flip to 'ready' — so the bot never builds
    // until the owner sets it to Available (which fulfils the held pre-orders).
    const { data: appRow } = await admin
      .from("app_settings")
      .select("bot_availability")
      .eq("id", 1)
      .maybeSingle();
    const availability = (appRow?.bot_availability ?? {}) as Record<string, string>;
    const isGatedBase = (base: string | null | undefined) =>
      !!base &&
      String(base)
        .split(/[^a-z0-9-]+/i)
        .filter(Boolean)
        .some((tok) => {
          const st = availability[tok];
          return st === "preorder" || st === "coming_soon";
        });
    if (siblings.some((r) => isGatedBase((r as { base?: string | null }).base))) {
      // Leave the rows in their reserved 'preorder' state; charge + deploy
      // happen later, when the owner flips the bot to Available.
      await admin
        .from("bot_orders")
        .update({ status: "preorder", updated_at: now })
        .in("id", allIds)
        .in("status", ["paid", "preorder", "preorder_pending_card"]);
      return new Response(
        JSON.stringify({ ok: true, path: "presale_hold", status: "preorder" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ───────────────────────────────────────────────────────────────────────

    // Server-side stock check at the moment of confirmation.
    const { count: availableTokens, error: tokenErr } = await admin
      .from("bot_token_pool")
      .select("id", { count: "exact", head: true })
      .eq("status", "available");
    if (tokenErr) return bad("Could not verify bot availability", 500);

    const inStock = (availableTokens ?? 0) >= botsNeeded;

    if (inStock) {
      // Build-start: charge the saved card NOW. If it declines / has no funds,
      // do NOT deploy — flip the order to 'payment_failed' and tell the client.
      const charge = await chargeOrder(parentId);
      if (!charge.ok) {
        await admin
          .from("bot_orders")
          .update({ status: "payment_failed", updated_at: now })
          .in("id", allIds)
          .in("status", ["paid", "preorder", "preorder_pending_card"]);
        return new Response(
          JSON.stringify({
            ok: false,
            declined: true,
            error: "Your card was declined or has insufficient funds. Update your payment method and try again.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Charge succeeded → every row -> 'ready'. The bot_orders trigger handles
      // auto-deploy and the "your bot is live" DM downstream.
      const { error: updErr } = await admin
        .from("bot_orders")
        .update({ status: "ready", updated_at: now })
        .in("id", allIds)
        .in("status", ["paid", "preorder", "preorder_pending_card"]);
      if (updErr) return bad(`Status update failed: ${updErr.message}`, 500);

      return new Response(
        JSON.stringify({ ok: true, path: "in_stock", status: "ready" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Low-stock path: every row -> 'waitlisted'. No DM is sent yet — the
    // promote_waitlisted_order_on_token_available trigger will DM the customer
    // a "still want to proceed?" prompt the moment a bot slot opens up.
    const { error: updErr } = await admin
      .from("bot_orders")
      .update({
        status: "waitlisted",
        updated_at: now,
      })
      .in("id", allIds)
      .in("status", ["paid", "preorder", "preorder_pending_card"]);
    if (updErr) return bad(`Status update failed: ${updErr.message}`, 500);

    return new Response(
      JSON.stringify({
        ok: true,
        path: "low_stock",
        status: "waitlisted",
        botsNeeded,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("confirm-order-discord-join failed:", e);
    return bad("Unexpected error", 500);
  }
});
