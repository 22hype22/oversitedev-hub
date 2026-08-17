/**
 * Oversite Utilities Bot — system-level Discord bot used to confirm
 * preorders with customers via DM.
 *
 * Runs in the same worker process as customer bots. Reads its token from
 * OVERSITE_UTILITIES_BOT_TOKEN. If the token is missing, the module is a
 * no-op (lets the worker boot without it during local dev).
 *
 * Responsibilities:
 *  - Poll `bot_commands` for `action='send_dm'` rows and DM the target user.
 *  - Listen for DMs from users we have an active confirmation session with
 *    (rows in `utility_bot_dm_state`) and walk them through:
 *       awaiting_yes_no  ── "yes" → ask for username
 *                       └─ "no"  → cancel order
 *       awaiting_username ── correct → confirm order, charge card on build
 *                        └─ wrong  → one retry, then cancel
 */
import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  type Message,
} from "discord.js";
import { supabase } from "./supabase.js";

const UTILS_TOKEN = process.env.OVERSITE_UTILITIES_BOT_TOKEN;
const UTILS_POLL_INTERVAL_MS = Number(process.env.UTILS_POLL_INTERVAL_MS ?? 5000);
const UTILS_PENDING_POLL_INTERVAL_MS = Number(
  process.env.UTILS_PENDING_POLL_INTERVAL_MS ?? 15000,
);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const INTERNAL_CHARGE_SECRET = process.env.INTERNAL_CHARGE_SECRET ?? "";
const WORKER_TOKEN = process.env.WORKER_TOKEN ?? "";
const UTILS_API_BASE = `${SUPABASE_URL}/functions/v1/utilities-bot-api`;

type PendingOrder = {
  id: string;
  bot_name: string | null;
  discord_user_id: string | null;
  discord_username: string | null;
  status: string;
  deployment_status: string | null;
  railway_service_id: string | null;
};

async function utilsApi(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  if (WORKER_TOKEN) headers.set("x-worker-token", WORKER_TOKEN);
  return fetch(`${UTILS_API_BASE}${path}`, { ...init, headers });
}

async function markDmSent(orderId: string, type: "in_build" | "ready" | "cancel") {
  try {
    const res = await utilsApi("/mark-dm-sent", {
      method: "POST",
      body: JSON.stringify({ orderId, type }),
    });
    if (!res.ok) {
      console.error(
        `[utils-bot] mark-dm-sent ${type} failed for ${orderId}: ${res.status} ${await res.text()}`,
      );
    }
  } catch (e) {
    console.error(
      `[utils-bot] mark-dm-sent ${type} threw for ${orderId}:`,
      (e as Error).message,
    );
  }
}

function buildMessage(
  type: "in_build" | "ready" | "cancel",
  order: PendingOrder,
): string {
  const name = order.bot_name ?? "your bot";
  if (type === "ready") {
    return `🎉 Your bot **${name}** is live! It's been deployed and is ready to be invited to your server. Head to your Oversite dashboard to grab the invite link and configure it.`;
  }
  if (type === "cancel") {
    return `Your order for **${name}** has been cancelled. If this wasn't expected, please reach out to support.`;
  }
  // in_build = preorder confirmation prompt
  return `Hi! We're about to start building your bot **${name}**. Please reply **YES** to confirm and we'll charge your card and begin the build, or **NO** to cancel.`;
}

async function pollPendingDms(type: "in_build" | "ready" | "cancel") {
  let orders: PendingOrder[] = [];
  try {
    const res = await utilsApi(`/pending?type=${type}&limit=25`, { method: "GET" });
    if (!res.ok) {
      console.error(
        `[utils-bot] pending ${type} fetch failed: ${res.status} ${await res.text()}`,
      );
      return;
    }
    const body = (await res.json()) as { orders?: PendingOrder[] };
    orders = body.orders ?? [];
  } catch (e) {
    console.error(`[utils-bot] pending ${type} threw:`, (e as Error).message);
    return;
  }

  console.log(`[utils-bot] poll pending ${type}: ${orders.length} order(s)`);
  if (orders.length === 0) return;

  for (const order of orders) {
    if (!order.discord_user_id) {
      console.warn(
        `[utils-bot] ${type} order ${order.id} has no discord_user_id; marking sent to skip`,
      );
      await markDmSent(order.id, type);
      continue;
    }
    const message = buildMessage(type, order);
    console.log(
      `[utils-bot] sending ${type} DM to ${order.discord_user_id} for order ${order.id} (${order.bot_name})`,
    );
    const ok = await dmUser(order.discord_user_id, message);
    if (ok) {
      await markDmSent(order.id, type);
    } else {
      console.error(
        `[utils-bot] ${type} DM failed for order ${order.id}; will retry on next poll`,
      );
    }
  }
}

type DmCmd = {
  id: string;
  payload: {
    discord_user_id: string;
    message: string;
    order_id: string;
    kind?: string;
  };
};

type DmState = {
  discord_user_id: string;
  bot_order_id: string;
  state: "awaiting_yes_no" | "awaiting_username";
  expected_username: string | null;
  attempts: number;
};

let client: Client | null = null;

async function dmUser(userId: string, content: string): Promise<boolean> {
  if (!client) return false;
  try {
    const user = await client.users.fetch(userId);
    await user.send({ content });
    return true;
  } catch (e) {
    console.error(`[utils-bot] DM failed for ${userId}:`, (e as Error).message);
    return false;
  }
}

async function pollSendDmCommands() {
  // Claim one pending send_dm command at a time.
  const { data: rows, error } = await supabase
    .from("bot_commands")
    .select("id,payload")
    .eq("action", "send_dm")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) {
    console.error("[utils-bot] poll error:", error.message);
    return;
  }
  if (!rows || rows.length === 0) return;

  for (const cmd of rows as DmCmd[]) {
    // Mark as claimed.
    const { error: claimErr } = await supabase
      .from("bot_commands")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
        worker_id: "utils-bot",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cmd.id)
      .eq("status", "pending");
    if (claimErr) continue;

    const { discord_user_id, message } = cmd.payload || ({} as any);
    const ok = discord_user_id && message
      ? await dmUser(discord_user_id, message)
      : false;

    await supabase
      .from("bot_commands")
      .update({
        status: ok ? "done" : "failed",
        completed_at: new Date().toISOString(),
        error_message: ok ? null : "DM send failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cmd.id);
  }
}

async function sendChannelMessage(
  channelId: string,
  content: string,
  embed?: any,
): Promise<boolean> {
  if (!client) return false;
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch || !ch.isTextBased() || !("send" in ch)) {
      console.error(`[utils-bot] channel ${channelId} is not sendable`);
      return false;
    }
    const payload: any = {
      allowedMentions: { parse: ["everyone", "roles"] },
    };
    if (content) payload.content = content;
    if (embed && typeof embed === "object") {
      const e: any = {};
      if (embed.title) e.title = String(embed.title);
      if (embed.description) e.description = String(embed.description);
      if (typeof embed.color === "number") e.color = embed.color;
      else if (typeof embed.color === "string") {
        const parsed = parseInt(embed.color.replace(/^#/, ""), 16);
        if (!Number.isNaN(parsed)) e.color = parsed;
      } else {
        e.color = 0x3b82f6;
      }
      if (embed.author?.name) {
        e.author = { name: String(embed.author.name) };
        if (embed.author.icon_url) e.author.icon_url = String(embed.author.icon_url);
      }
      if (embed.footer?.text) e.footer = { text: String(embed.footer.text) };
      if (embed.timestamp) e.timestamp = embed.timestamp;
      payload.embeds = [e];
    }
    await (ch as any).send(payload);
    return true;
  } catch (e) {
    console.error(
      `[utils-bot] channel send failed for ${channelId}:`,
      (e as Error).message,
    );
    return false;
  }
}

async function pollSendChannelMessageCommands() {
  const { data: rows, error } = await supabase
    .from("bot_commands")
    .select("id,payload")
    .eq("action", "send_channel_message")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) {
    console.error("[utils-bot] channel poll error:", error.message);
    return;
  }
  if (!rows || rows.length === 0) return;

  for (const cmd of rows as Array<{ id: string; payload: any }>) {
    const { error: claimErr } = await supabase
      .from("bot_commands")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
        worker_id: "utils-bot",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cmd.id)
      .eq("status", "pending");
    if (claimErr) continue;

    const { channel_id, content, embed } = cmd.payload || {};
    const ok = channel_id && (content || embed)
      ? await sendChannelMessage(String(channel_id), content ? String(content) : "", embed)
      : false;

    await supabase
      .from("bot_commands")
      .update({
        status: ok ? "done" : "failed",
        completed_at: new Date().toISOString(),
        error_message: ok ? null : "channel send failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cmd.id);
  }
}

async function fetchDmState(discordUserId: string): Promise<DmState | null> {
  const { data } = await supabase
    .from("utility_bot_dm_state")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
  return (data as DmState | null) ?? null;
}

async function clearDmState(discordUserId: string) {
  await supabase
    .from("utility_bot_dm_state")
    .delete()
    .eq("discord_user_id", discordUserId);
}

// Cancel the WHOLE order (parent + children) and wipe the saved-card references
// so we no longer keep their card on file. The bot_orders cancel trigger frees
// any tokens back to the pool. `orderId` is the parent order id.
async function cancelOrder(orderId: string, reason: string) {
  const now = new Date().toISOString();
  await supabase
    .from("bot_orders")
    .update({
      status: "cancelled_by_customer",
      confirmation_state: "declined",
      cancelled_at: now,
      cancellation_reason: reason,
      confirmation_responded_at: now,
      // "Get rid of their card stuff" — drop the stored card references.
      stripe_payment_method_id: null,
      stripe_setup_intent_id: null,
      stripe_customer_id: null,
      updated_at: now,
    })
    .or(`id.eq.${orderId},parent_order_id.eq.${orderId}`);
}

type ConfirmResult = "charged" | "declined" | "out_of_stock";

// Count how many bots this order still needs a token for (parent + children).
async function botsNeededForOrder(orderId: string): Promise<number> {
  const { data } = await supabase
    .from("bot_orders")
    .select("id, status")
    .or(`id.eq.${orderId},parent_order_id.eq.${orderId}`);
  const pending = (data ?? []).filter((r: any) =>
    ["waitlisted", "paid", "preorder", "preorder_pending_card"].includes(r.status),
  ).length;
  return pending || 1;
}

async function availableTokens(): Promise<number> {
  const { count } = await supabase
    .from("bot_token_pool")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");
  return count ?? 0;
}

// All-or-nothing charge. Only charges if the pool can build EVERY bot in the
// order right now. Charges the saved card FIRST; only flips the whole order to
// 'ready' (which fires the build) if the charge succeeds. `orderId` is the
// parent order id.
//   "charged"      → paid + building
//   "declined"     → card failed; order marked payment_failed, no build
//   "out_of_stock" → not enough slots for the whole order; no charge, stays waitlisted
async function confirmOrder(orderId: string): Promise<ConfirmResult> {
  const now = new Date().toISOString();

  // Guard: never partially build a multi-bot order. If a slot got taken since we
  // asked, keep them waitlisted (the promotion trigger will re-ask) and DON'T charge.
  const needed = await botsNeededForOrder(orderId);
  const avail = await availableTokens();
  if (avail < needed) {
    await supabase
      .from("bot_orders")
      .update({ status: "waitlisted", confirmation_state: null, updated_at: now })
      .or(`id.eq.${orderId},parent_order_id.eq.${orderId}`);
    return "out_of_stock";
  }

  let charged = false;
  if (INTERNAL_CHARGE_SECRET && SUPABASE_URL) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/charge-confirmed-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-internal-charge-secret": INTERNAL_CHARGE_SECRET,
        },
        body: JSON.stringify({ botOrderId: orderId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      charged = res.ok && !!data?.ok;
    } catch (e) {
      console.error("[utils-bot] charge invoke failed:", (e as Error).message);
    }
  }

  if (!charged) {
    // Card declined / no funds → do NOT build. Mark the whole order failed.
    await supabase
      .from("bot_orders")
      .update({
        status: "payment_failed",
        confirmation_state: "confirmed",
        confirmation_responded_at: now,
        updated_at: now,
      })
      .or(`id.eq.${orderId},parent_order_id.eq.${orderId}`);
    return "declined";
  }

  // Charge succeeded → whole order -> 'ready' so the auto-deploy trigger fires.
  // (charge-confirmed-order also flips the group; this is belt-and-suspenders.)
  await supabase
    .from("bot_orders")
    .update({
      status: "ready",
      confirmation_state: "confirmed",
      confirmation_responded_at: now,
      updated_at: now,
    })
    .or(`id.eq.${orderId},parent_order_id.eq.${orderId}`);
  return "charged";
}

async function loadExpectedUsername(orderId: string): Promise<string | null> {
  const { data } = await supabase
    .from("bot_orders")
    .select("discord_username, bot_name")
    .eq("id", orderId)
    .maybeSingle();
  return (data as any)?.discord_username ?? null;
}

async function loadBotName(orderId: string): Promise<string> {
  const { data } = await supabase
    .from("bot_orders")
    .select("bot_name")
    .eq("id", orderId)
    .maybeSingle();
  return (data as any)?.bot_name ?? "your bot";
}

async function handleDm(msg: Message) {
  if (msg.author.bot) return;
  if (msg.channel.type !== ChannelType.DM) return;

  const state = await fetchDmState(msg.author.id);
  if (!state) return; // not in a confirmation flow

  const text = msg.content.trim();
  const lower = text.toLowerCase();

  if (state.state === "awaiting_yes_no") {
    if (lower === "yes" || lower === "y" || lower === "confirm") {
      const expected = await loadExpectedUsername(state.bot_order_id);
      if (!expected) {
        // No username on file — charge + confirm.
        const result = await confirmOrder(state.bot_order_id);
        await clearDmState(msg.author.id);
        await msg.reply(
          result === "charged"
            ? "✅ Confirmed! Your bot is being built — we'll DM you again when it's ready."
            : result === "out_of_stock"
              ? "⏳ A slot was taken just before we could finish — no charge was made. You're still first in line and we'll DM you the moment enough slots open for your order."
              : "⚠️ Transaction failed — we couldn't charge your saved card (declined or insufficient funds), so your bot wasn't built. Update your payment method in your dashboard and we'll try again next time a slot opens.",
        );
        return;
      }
      await supabase
        .from("utility_bot_dm_state")
        .update({
          state: "awaiting_username",
          expected_username: expected,
          updated_at: new Date().toISOString(),
        })
        .eq("discord_user_id", msg.author.id);
      await msg.reply(
        `Great! To confirm it's really you, please type your Discord username exactly: **${expected}**`,
      );
      return;
    }
    if (lower === "no" || lower === "n" || lower === "cancel") {
      await cancelOrder(state.bot_order_id, "customer_declined");
      await clearDmState(msg.author.id);
      await msg.reply("Got it — your order has been cancelled and your card was not charged.");
      return;
    }
    await msg.reply("Please reply **YES** to confirm or **NO** to cancel.");
    return;
  }

  if (state.state === "awaiting_username") {
    const expected = (state.expected_username ?? "").trim().toLowerCase();
    const given = text.toLowerCase().replace(/^@/, "");
    if (expected && given === expected) {
      const result = await confirmOrder(state.bot_order_id);
      await clearDmState(msg.author.id);
      const botName = await loadBotName(state.bot_order_id);
      await msg.reply(
        result === "charged"
          ? `✅ Confirmed! Your bot **${botName}** is being built. We'll DM you the moment it's live.`
          : result === "out_of_stock"
            ? `⏳ A slot was taken just before we could finish **${botName}** — no charge was made. You're still first in line and we'll DM you as soon as enough slots open.`
            : `⚠️ Transaction failed — we couldn't charge your saved card for **${botName}** (declined or insufficient funds), so it wasn't built. Update your payment method in your dashboard and we'll retry next time a slot opens.`,
      );
      return;
    }
    const attempts = (state.attempts ?? 0) + 1;
    if (attempts >= 2) {
      await cancelOrder(state.bot_order_id, "username_mismatch");
      await clearDmState(msg.author.id);
      await msg.reply(
        "That didn't match what we have on file. For security your order has been cancelled — please reach out to support if this was a mistake.",
      );
      return;
    }
    await supabase
      .from("utility_bot_dm_state")
      .update({ attempts, updated_at: new Date().toISOString() })
      .eq("discord_user_id", msg.author.id);
    await msg.reply(
      `That didn't match. Please type your Discord username exactly as you registered it (one more try):`,
    );
    return;
  }
}

export async function startUtilitiesBot() {
  if (!UTILS_TOKEN) {
    console.warn("[utils-bot] OVERSITE_UTILITIES_BOT_TOKEN not set — utilities bot disabled.");
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.on("ready", () => {
    console.log(`[utils-bot] logged in as ${client?.user?.tag}`);
  });

  client.on("messageCreate", (msg) => {
    handleDm(msg).catch((e) =>
      console.error("[utils-bot] DM handler error:", (e as Error).message),
    );
  });

  client.on("error", (e) => console.error("[utils-bot] client error:", e.message));

  await client.login(UTILS_TOKEN);

  // Start the send_dm command poll loop.
  setInterval(() => {
    pollSendDmCommands().catch((e) =>
      console.error("[utils-bot] poll loop error:", (e as Error).message),
    );
    pollSendChannelMessageCommands().catch((e) =>
      console.error("[utils-bot] channel poll loop error:", (e as Error).message),
    );
  }, UTILS_POLL_INTERVAL_MS);

  // Poll the utilities-bot-api /pending endpoint for orders that need a
  // "your bot is live" / "your build is starting" / "your order was cancelled"
  // DM. Each type clears itself via /mark-dm-sent after a successful send.
  const runPendingPoll = () => {
    pollPendingDms("ready").catch((e) =>
      console.error("[utils-bot] pending ready loop error:", (e as Error).message),
    );
    pollPendingDms("in_build").catch((e) =>
      console.error("[utils-bot] pending in_build loop error:", (e as Error).message),
    );
    pollPendingDms("cancel").catch((e) =>
      console.error("[utils-bot] pending cancel loop error:", (e as Error).message),
    );
  };
  // Run once on boot so we don't wait a full interval.
  runPendingPoll();
  setInterval(runPendingPoll, UTILS_PENDING_POLL_INTERVAL_MS);

  console.log(
    "[utils-bot] started — send_dm poll every",
    UTILS_POLL_INTERVAL_MS,
    "ms; /pending poll every",
    UTILS_PENDING_POLL_INTERVAL_MS,
    "ms",
  );
}
