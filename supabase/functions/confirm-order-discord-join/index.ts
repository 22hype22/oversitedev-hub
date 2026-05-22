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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

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
      .select("id, status, bot_name")
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

    // Server-side stock check at the moment of confirmation.
    const { count: availableTokens, error: tokenErr } = await admin
      .from("bot_token_pool")
      .select("id", { count: "exact", head: true })
      .eq("status", "available");
    if (tokenErr) return bad("Could not verify bot availability", 500);

    const inStock = (availableTokens ?? 0) >= botsNeeded;
    const now = new Date().toISOString();

    if (inStock) {
      // In-stock path: every row -> 'ready'. The bot_orders trigger handles
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

    // Low-stock path: every row -> 'confirmation', awaiting username reply.
    const { error: updErr } = await admin
      .from("bot_orders")
      .update({
        status: "confirmation",
        confirmation_state: "awaiting_username",
        confirmation_dm_sent_at: now,
        confirmation_deadline_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: now,
      })
      .in("id", allIds)
      .in("status", ["paid", "preorder", "preorder_pending_card"]);
    if (updErr) return bad(`Status update failed: ${updErr.message}`, 500);

    // Enqueue ONE Discord DM for the whole order (parent row only).
    const expectedName = (order.discord_username || "your Discord username")
      .trim();
    const botList = siblings
      .map((r) => `• ${r.bot_name}`)
      .join("\n");
    const title = botsNeeded === 1
      ? "Confirm your Oversite bot preorder"
      : `Confirm your Oversite preorder (${botsNeeded} bots)`;
    const dmBody = [
      `Thanks for preordering with Oversite! To finalize your order and reserve your spot, please reply to this DM with your Discord username (\`${expectedName}\`).`,
      "",
      botsNeeded === 1 ? "Your bot:" : "Your bots:",
      botList,
      "",
      "Once we receive your confirmation, your bot will be queued for deployment as soon as a slot opens. You can also confirm from your dashboard.",
    ].join("\n");

    await admin.from("bot_notifications").insert({
      user_id: user.id,
      bot_id: parentId,
      event_type: "order_confirmation_request",
      title,
      body: dmBody,
      status: "pending",
      context: { parent_order_id: parentId, bots_needed: botsNeeded },
    });

    // Best-effort kick to the dispatcher so the DM goes out promptly.
    admin.functions
      .invoke("discord-notify-dispatch", { body: {} })
      .catch(() => {});

    return new Response(
      JSON.stringify({
        ok: true,
        path: "low_stock",
        status: "confirmation",
        botsNeeded,
        expectedUsername: expectedName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("confirm-order-discord-join failed:", e);
    return bad("Unexpected error", 500);
  }
});
