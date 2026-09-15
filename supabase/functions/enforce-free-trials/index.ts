// Daily cron target. Runs the two halves of a free trial: the countdown over
// the final days, and what happens when the clock runs out.
//
// The reminder comes from the customer's own trial bot rather than from an
// Oversite account, so it lands in a DM they already recognise. That needs no
// change in any bot repo: the bot's token is resolvable here, and Discord will
// open a DM on behalf of any bot that shares a server with the recipient.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DISCORD = "https://discord.com/api/v10";
const STORE_URL = "https://oversite.shop";

// How many days out the countdown starts.
const REMIND_WITHIN_DAYS = 5;

type Trial = {
  id: string;
  bot_id: string;
  user_id: string;
  free_until: string;
  last_reminder_day: number | null;
};

type Bot = {
  id: string;
  bot_name: string | null;
  base: string | null;
  discord_user_id: string | null;
  status: string | null;
};

const daysLeft = (until: string) =>
  Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000);

async function botToken(botId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("runtime_resolve_bot_token", { _bot_id: botId });
  if (error) {
    console.warn(`[trials] token lookup failed for ${botId}: ${error.message}`);
    return null;
  }
  return typeof data === "string" && data ? data : null;
}

/**
 * The Discord account to DM. Stored on the order when we know it; otherwise the
 * bot asks Discord who owns a server it is in, which is the customer in every
 * case we have seen. The answer is written back so this costs one call, once.
 */
async function ownerDiscordId(bot: Bot, token: string): Promise<string | null> {
  if (bot.discord_user_id) return bot.discord_user_id;

  const { data: guilds } = await supabase
    .from("bot_active_guilds")
    .select("guild_id")
    .eq("bot_id", bot.id)
    .order("last_seen_at", { ascending: false })
    .limit(5);

  for (const g of guilds ?? []) {
    try {
      const res = await fetch(`${DISCORD}/guilds/${(g as any).guild_id}`, {
        headers: { Authorization: `Bot ${token}` },
      });
      if (!res.ok) continue;
      const ownerId = String(((await res.json()) as any)?.owner_id ?? "");
      if (!ownerId) continue;
      await supabase.from("bot_orders").update({ discord_user_id: ownerId }).eq("id", bot.id);
      return ownerId;
    } catch (e) {
      console.warn(`[trials] guild owner lookup failed: ${(e as Error).message}`);
    }
  }
  return null;
}

async function dm(token: string, userId: string, embed: Record<string, unknown>): Promise<boolean> {
  try {
    const chRes = await fetch(`${DISCORD}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!chRes.ok) {
      console.warn(`[trials] DM channel failed ${chRes.status}: ${(await chRes.text()).slice(0, 200)}`);
      return false;
    }
    const channelId = ((await chRes.json()) as any)?.id;
    if (!channelId) return false;

    const msgRes = await fetch(`${DISCORD}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!msgRes.ok) {
      // A closed DM is the customer's choice, not a fault. Log and move on.
      console.warn(`[trials] DM send failed ${msgRes.status}: ${(await msgRes.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[trials] DM error: ${(e as Error).message}`);
    return false;
  }
}

const botLabel = (bot: Bot) => bot.bot_name || "your bot";

function countdownEmbed(bot: Bot, left: number, until: string) {
  const when = new Date(until).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const when_ = left <= 0 ? "today" : left === 1 ? "tomorrow" : `in ${left} days`;
  return {
    title: `Your free trial ends ${when_}`,
    color: 0xc9dbe6,
    description:
      `The free trial for **${botLabel(bot)}** runs out on ${when}.\n\n` +
      `To keep it, buy it at ${STORE_URL} before then. Everything you have set up stays exactly as it is.\n\n` +
      "If you'd rather not, you don't need to do anything. The bot will be removed when the trial ends.",
    timestamp: new Date().toISOString(),
  };
}

function endedEmbed(bot: Bot) {
  return {
    title: "Your free trial has ended",
    color: 0xc9dbe6,
    description:
      `The free trial for **${botLabel(bot)}** has ended and the bot has been shut down and removed.\n\n` +
      `You can buy it any time at ${STORE_URL}. A new one is set up from scratch, so the settings from ` +
      "the trial won't carry over.",
    timestamp: new Date().toISOString(),
  };
}

async function notify(trial: Trial, bot: Bot, eventType: string, title: string, body: string) {
  await supabase.from("bot_notifications").insert({
    user_id: trial.user_id,
    bot_id: trial.bot_id,
    event_type: eventType,
    title,
    body,
  });
}

/** Countdown DM, at most one per day per trial. */
async function remind(trial: Trial, bot: Bot): Promise<boolean> {
  const left = daysLeft(trial.free_until);
  // last_reminder_day counts down, so "already sent today or closer" is >= .
  if (trial.last_reminder_day !== null && trial.last_reminder_day <= left) return false;

  const token = await botToken(trial.bot_id);
  if (token) {
    const discordId = await ownerDiscordId(bot, token);
    if (discordId) await dm(token, discordId, countdownEmbed(bot, left, trial.free_until));
  }

  await notify(
    trial, bot, "trial_ending",
    `Free trial ending for ${botLabel(bot)}`,
    `The free trial for ${botLabel(bot)} ends in ${left} day${left === 1 ? "" : "s"}. ` +
      "Buy it before then to keep it — it will be removed when the trial ends.",
  );

  // Record the attempt either way: a customer with DMs closed must not be
  // re-tried every run, and the dashboard notification did go out.
  await supabase
    .from("bot_free_periods")
    .update({ last_reminder_day: left, reminder_sent_at: new Date().toISOString() })
    .eq("id", trial.id);
  return true;
}

/** The trial is over: tell them, then take the bot down. */
async function expire(trial: Trial, bot: Bot): Promise<boolean> {
  // Claim the row first. If this update matches nothing, another run already
  // took it, and a bot must never be cancelled twice.
  const { data: claimed } = await supabase
    .from("bot_free_periods")
    .update({ expired_at: new Date().toISOString() })
    .eq("id", trial.id)
    .is("expired_at", null)
    .select("id");
  if (!claimed?.length) return false;

  // DM before the teardown, while the bot is still online to send it.
  const token = await botToken(trial.bot_id);
  if (token) {
    const discordId = await ownerDiscordId(bot, token);
    if (discordId) await dm(token, discordId, endedEmbed(bot));
  }

  await notify(
    trial, bot, "trial_ended",
    `Free trial ended for ${botLabel(bot)}`,
    `The free trial for ${botLabel(bot)} has ended and the bot has been removed. ` +
      "You can buy it any time to get a fresh one.",
  );

  // Cancelling the order is the teardown: a trigger on bot_orders calls
  // cancel-bot-deploy, which destroys the Railway service, frees the token and
  // resets the bot's Discord profile.
  const { error } = await supabase
    .from("bot_orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "free_trial_ended",
      updated_at: new Date().toISOString(),
    })
    .eq("id", trial.bot_id);
  if (error) {
    console.error(`[trials] cancel failed for ${trial.bot_id}: ${error.message}`);
    return false;
  }
  console.log(`[trials] trial ended, cancelled bot ${trial.bot_id}`);
  return true;
}

// Only the database cron may run this — it cancels bots.
async function callerAllowed(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-internal-secret") ?? "";
  let secret = Deno.env.get("INTERNAL_DEPLOY_SECRET") ?? "";
  if (!secret) {
    const { data } = await supabase
      .from("deploy_config").select("internal_secret").eq("id", 1).maybeSingle();
    secret = String(data?.internal_secret ?? "");
  }
  return secret.length >= 16 && provided === secret;
}

Deno.serve(async (req) => {
  if (!(await callerAllowed(req))) {
    console.warn("[trials] forbidden caller");
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const horizon = new Date(Date.now() + REMIND_WITHIN_DAYS * 86_400_000).toISOString();
    const { data: trials, error } = await supabase
      .from("bot_free_periods")
      .select("id,bot_id,user_id,free_until,last_reminder_day")
      .eq("teardown_on_expiry", true)
      .is("expired_at", null)
      .lte("free_until", horizon);
    if (error) throw error;

    let reminded = 0;
    let expired = 0;

    for (const t of (trials ?? []) as Trial[]) {
      try {
        const { data: bot } = await supabase
          .from("bot_orders")
          .select("id,bot_name,base,discord_user_id,status")
          .eq("id", t.bot_id)
          .maybeSingle();
        if (!bot) continue;

        // An order already gone (cancelled by hand, or by the hosting job) has
        // nothing left to chase or take down — close the trial out quietly.
        if ((bot as Bot).status === "cancelled") {
          await supabase
            .from("bot_free_periods")
            .update({ expired_at: new Date().toISOString() })
            .eq("id", t.id)
            .is("expired_at", null);
          continue;
        }

        if (new Date(t.free_until).getTime() <= Date.now()) {
          if (await expire(t, bot as Bot)) expired++;
        } else if (await remind(t, bot as Bot)) {
          reminded++;
        }
      } catch (e) {
        // One customer's trial must never stop the rest of the run.
        console.error(`[trials] failed on ${t.bot_id}:`, e);
      }
    }

    console.log(`[trials] checked ${(trials ?? []).length}, reminded ${reminded}, expired ${expired}`);
    return new Response(
      JSON.stringify({ checked: (trials ?? []).length, reminded, expired }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[trials] run failed:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
