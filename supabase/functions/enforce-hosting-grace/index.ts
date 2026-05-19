// Daily cron target. Finds hosting subscriptions where the 10-day grace
// period has expired and cancels every paid/ready bot the owner has,
// then enqueues a leave_guild command so the worker pulls each bot out of
// every server it's in.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function expireOne(sub: { id: string; user_id: string }) {
  const { data: bots } = await supabase
    .from("bot_orders")
    .select("id")
    .eq("user_id", sub.user_id)
    .in("status", ["paid", "ready"]);

  const botIds = (bots ?? []).map((b: any) => b.id);

  if (botIds.length > 0) {
    await supabase
      .from("bot_orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "hosting_payment_failed",
        updated_at: new Date().toISOString(),
      })
      .in("id", botIds);

    // Tell the worker to leave every server for each cancelled bot.
    const commands = botIds.map((bot_id: string) => ({
      bot_id,
      user_id: sub.user_id,
      requested_by: sub.user_id,
      action: "leave_all_guilds",
      status: "pending",
      payload: { reason: "hosting_payment_failed" },
    }));
    await supabase.from("bot_commands").insert(commands);

    // User-facing notification record.
    await supabase.from("bot_notifications").insert(
      botIds.map((bot_id: string) => ({
        user_id: sub.user_id,
        bot_id,
        event_type: "hosting_cancelled",
        title: "Bot cancelled — hosting payment overdue",
        body:
          "We weren't able to charge your card for monthly hosting and the 10-day grace period has ended. " +
          "Your bot has been removed from its servers. Update your payment method to restore access.",
      })),
    );
  }

  await supabase
    .from("hosting_subscriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  console.log("Expired hosting grace for user", sub.user_id, "cancelled", botIds.length, "bots");
}

Deno.serve(async (_req) => {
  try {
    const { data: due, error } = await supabase
      .from("hosting_subscriptions")
      .select("id,user_id")
      .eq("status", "past_due")
      .lte("grace_period_ends_at", new Date().toISOString());

    if (error) throw error;

    for (const sub of due ?? []) {
      try {
        await expireOne(sub as any);
      } catch (e) {
        console.error("expireOne failed for sub", (sub as any).id, e);
      }
    }

    return new Response(
      JSON.stringify({ processed: (due ?? []).length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("enforce-hosting-grace error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
