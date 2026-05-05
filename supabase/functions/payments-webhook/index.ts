// Stripe webhook handler — manages subscription lifecycle for the
// $9/mo Oversite Pro membership. Supabase routes both sandbox and live
// to this handler with ?env=sandbox or ?env=live.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata", subscription.id);
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function sendWaitlistEmail(supabase: any, botOrderId: string) {
  // Look up the order owner's email + bot name to personalize the message.
  const { data: order } = await supabase
    .from("bot_orders")
    .select("user_id, bot_name")
    .eq("id", botOrderId)
    .maybeSingle();
  if (!order?.user_id) return;
  const { data: userRes } = await supabase.auth.admin.getUserById(order.user_id);
  const recipient = userRes?.user?.email;
  if (!recipient) {
    console.warn("Cannot send waitlist email — no email for user", order.user_id);
    return;
  }
  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "order-waitlisted",
      recipientEmail: recipient,
      idempotencyKey: `order-waitlisted-${botOrderId}`,
      templateData: { botName: order.bot_name ?? null },
    },
  });
  if (error) {
    console.error("Failed to send waitlist email:", error);
  }
}

async function handleCheckoutSessionCompleted(session: any, env: StripeEnv) {
  const botOrderId = session.metadata?.bot_order_id;
  if (!botOrderId) return; // not a bot-order checkout — nothing to do here
  if (session.payment_status !== "paid") {
    console.log("Bot order session completed but not paid yet:", session.id, session.payment_status);
    return;
  }

  const supabase = getSupabase();

  // Check if there is at least one available bot token in the pool. If not,
  // mark this order as 'waitlisted' instead of 'paid' so the build trigger
  // does NOT fire. The order will be auto-promoted to 'paid' by a DB trigger
  // the moment a token becomes available again.
  const { count: availableTokens, error: tokenCountErr } = await supabase
    .from("bot_token_pool")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");

  if (tokenCountErr) {
    console.error("Failed to read token pool:", tokenCountErr);
  }

  const hasToken = !tokenCountErr && (availableTokens ?? 0) > 0;
  const nextStatus = hasToken ? "paid" : "waitlisted";

  const { error } = await supabase
    .from("bot_orders")
    .update({
      status: nextStatus,
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", botOrderId)
    .not("status", "in", "(paid,waitlisted)"); // idempotent — don't double-flip

  if (error) {
    console.error("Failed to mark bot_order:", botOrderId, error);
    return;
  }

  console.log(`Bot order marked ${nextStatus}:`, botOrderId, "session:", session.id);

  if (!hasToken) {
    await sendWaitlistEmail(supabase, botOrderId);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutSessionCompleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook: invalid env query parameter:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv as StripeEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
