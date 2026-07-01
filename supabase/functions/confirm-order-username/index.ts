// Confirm a customer's preorder by matching the username they typed against
// the discord_username on file. Callable from the dashboard (as the user)
// after the Discord-join gate routes them to the low-stock path.
//
// Match -> status flips to 'ready' (when a token is available) or 'waitlist'
// (when none is left). Mismatch -> increments an attempts counter and
// returns a friendly error.
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

function norm(s: string) {
  return s.trim().replace(/^@/, "").toLowerCase();
}

// Charge the saved card off-session (build-start). ok=false on decline.
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

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const reply = String(body.username ?? "").trim();
    if (!orderId || !reply) return bad("orderId and username required");

    const { data: order, error: orderErr } = await admin
      .from("bot_orders")
      .select(
        "id, user_id, parent_order_id, status, discord_username, confirmation_state",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) return bad("Order not found", 404);
    if (order.user_id !== user.id) return bad("Forbidden", 403);
    if (order.status !== "confirmation") {
      return bad(`Order is in '${order.status}', not awaiting confirmation`);
    }

    const expected = (order.discord_username || "").trim();
    if (!expected) return bad("No Discord username on file for this order");

    if (norm(reply) !== norm(expected)) {
      return new Response(
        JSON.stringify({
          ok: false,
          mismatch: true,
          message: `That doesn't match the username on file (${expected}).`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parentId = order.parent_order_id ?? order.id;
    const { data: siblings, error: sibErr } = await admin
      .from("bot_orders")
      .select("id, status")
      .or(`id.eq.${parentId},parent_order_id.eq.${parentId}`);
    if (sibErr || !siblings) return bad("Could not load order", 500);

    const eligible = siblings.filter((r) => r.status === "confirmation");
    const allIds = eligible.map((r) => r.id);
    if (allIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, alreadyHandled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Re-check token availability at confirmation time.
    const { count: availableTokens, error: tokenErr } = await admin
      .from("bot_token_pool")
      .select("id", { count: "exact", head: true })
      .eq("status", "available");
    if (tokenErr) return bad("Could not verify availability", 500);

    const now = new Date().toISOString();
    const inStock = (availableTokens ?? 0) >= allIds.length;

    // Build-start charge: if a slot is available, charge the saved card NOW.
    // Decline → don't deploy; mark payment_failed and tell the client.
    if (inStock) {
      const charge = await chargeOrder(parentId);
      if (!charge.ok) {
        await admin
          .from("bot_orders")
          .update({
            status: "payment_failed",
            confirmation_state: "confirmed",
            confirmation_responded_at: now,
            confirmed_username: reply,
            updated_at: now,
          })
          .in("id", allIds);
        return new Response(
          JSON.stringify({
            ok: false,
            declined: true,
            error: "Your card was declined or has insufficient funds. Update your payment method and try again.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const nextStatus = inStock ? "ready" : "waitlist";

    const { error: updErr } = await admin
      .from("bot_orders")
      .update({
        status: nextStatus,
        confirmation_state: "confirmed",
        confirmation_responded_at: now,
        confirmed_username: reply,
        updated_at: now,
      })
      .in("id", allIds);
    if (updErr) return bad(`Status update failed: ${updErr.message}`, 500);

    return new Response(
      JSON.stringify({ ok: true, status: nextStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("confirm-order-username failed:", e);
    return bad("Unexpected error", 500);
  }
});
