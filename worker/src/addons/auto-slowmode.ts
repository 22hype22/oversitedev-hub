import { Events, TextChannel } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

const SPAM_THRESHOLD = 8;
const SPAM_WINDOW_MS = 5000;
const SLOWMODE_DURATION = 10; // seconds
const SLOWMODE_RESET_MS = 60000; // 1 minute

const channelSpamTracker = new Map<string, number[]>();
const slowmodeActive = new Map<string, ReturnType<typeof setTimeout>>();

export const autoSlowmodeAddon: Addon = {
  id: "auto-slowmode",
  name: "Auto Slowmode on Spam",
  commands: [],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    client.on(Events.MessageCreate, async (message) => {
      if (!message.guild || message.author.bot) return;
      if (!message.channel.isTextBased() || message.channel.type !== 0) return;

      const now = Date.now();
      const key = message.channelId;
      const timestamps = (channelSpamTracker.get(key) ?? []).filter((t) => now - t < SPAM_WINDOW_MS);
      timestamps.push(now);
      channelSpamTracker.set(key, timestamps);

      if (timestamps.length >= SPAM_THRESHOLD && !slowmodeActive.has(key)) {
        const channel = message.channel as TextChannel;
        try {
          await channel.setRateLimitPerUser(SLOWMODE_DURATION, "Auto-slowmode: spam detected");
          await ctx.log("warn", `Auto-slowmode activated in #${channel.name} (${SLOWMODE_DURATION}s)`, {
            channel_id: key,
            guild: message.guildId!,
          });

          // Auto-reset after 1 minute
          const timeout = setTimeout(async () => {
            try {
              await channel.setRateLimitPerUser(0, "Auto-slowmode: reset after cooldown");
              slowmodeActive.delete(key);
              await ctx.log("info", `Auto-slowmode lifted in #${channel.name}`);
            } catch { /* ignore */ }
          }, SLOWMODE_RESET_MS);

          slowmodeActive.set(key, timeout);
          channelSpamTracker.delete(key);
        } catch { /* ignore */ }
      }
    });

    await ctx.log("info", "Auto Slowmode addon registered");
  },
};
