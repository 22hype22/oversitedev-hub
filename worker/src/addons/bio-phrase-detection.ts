import { Events, EmbedBuilder, TextChannel, GuildMember, PermissionFlagsBits } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

const BIO_PHRASES = [
  "check my bio", "check bio", "link in bio", "see my bio",
  "check my profile", "see my profile", "link in profile",
  "in my bio", "my bio has", "bio has the", "check profile",
  "see profile", "visit my bio", "visit my profile",
];

const bioViolationTracker = new Map<string, number>();

export const bioPhraseDetectionAddon: Addon = {
  id: "bio-phrase-detection",
  name: "Bio Phrase Detection",
  commands: [],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    client.on(Events.MessageCreate, async (message) => {
      if (!message.guild || message.author.bot) return;
      const member = message.member as GuildMember;
      if (member?.permissions.has(PermissionFlagsBits.KickMembers)) return;

      const msgLower = message.content.toLowerCase();
      const matched = BIO_PHRASES.find((p) => msgLower.includes(p));
      if (!matched) return;

      await message.delete().catch(() => {});

      const count = (bioViolationTracker.get(message.author.id) ?? 0) + 1;
      bioViolationTracker.set(message.author.id, count);

      try {
        await message.author.send(
          `⚠️ Your message in **${message.guild.name}** was removed because it directed members to an external profile or bio.\n\nThis is strike **${count}/3**. At 3 strikes you will be muted.`
        ).catch(() => {});
      } catch { /* ignore */ }

      const ch = message.guild.channels.cache.find(
        (c) => c.name === "auto-mod" && c.isTextBased()
      ) as TextChannel | undefined;

      if (ch) {
        const embed = new EmbedBuilder()
          .setTitle("🔍 Bio Phrase Detected")
          .addFields(
            { name: "User", value: `${message.author.tag} (\`${message.author.id}\`)` },
            { name: "Message", value: message.content.slice(0, 500), inline: false },
            { name: "Strike", value: `${count}/3` },
            { name: "Matched Phrase", value: `\`${matched}\`` },
          )
          .setColor(0xffa500)
          .setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => {});
      }

      if (count >= 3) {
        bioViolationTracker.set(message.author.id, 0);
        await member.timeout(60 * 60 * 1000, "3 bio phrase violations").catch(() => {});
        if (ch) {
          const muteEmbed = new EmbedBuilder()
            .setTitle("🔇 Auto-Muted (Bio Phrases)")
            .addFields(
              { name: "User", value: `${message.author.tag} (\`${message.author.id}\`)` },
              { name: "Reason", value: "3 bio phrase violations — muted for 1 hour" },
            )
            .setColor(0xed4245)
            .setTimestamp();
          await ch.send({ embeds: [muteEmbed] }).catch(() => {});
        }
      }

      await ctx.log("warn", `Bio phrase detected from ${message.author.tag} (strike ${count})`, { phrase: matched });
    });

    await ctx.log("info", "Bio Phrase Detection addon registered");
  },
};
