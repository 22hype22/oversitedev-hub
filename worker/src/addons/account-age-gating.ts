import { Events, EmbedBuilder, TextChannel } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

const MIN_ACCOUNT_AGE_DAYS = 20;

export const accountAgeGatingAddon: Addon = {
  id: "account-age-gating",
  name: "New Account Age Gating",
  commands: [],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    client.on(Events.GuildMemberAdd, async (member) => {
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
      if (accountAgeDays >= MIN_ACCOUNT_AGE_DAYS) return;

      const verifyLogCh = member.guild.channels.cache.find(
        (c) => c.name === "verification-logs" && c.isTextBased()
      ) as TextChannel | undefined;

      if (verifyLogCh) {
        const embed = new EmbedBuilder()
          .setTitle("🚫 New Account Flagged on Join")
          .setDescription(`${member.toString()} joined but their account is only **${Math.floor(accountAgeDays)} days old** (minimum: ${MIN_ACCOUNT_AGE_DAYS} days).`)
          .addFields(
            { name: "User", value: `${member.user.tag} (\`${member.id}\`)` },
            { name: "Account Age", value: `${Math.floor(accountAgeDays)} days` },
            { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
            { name: "Joined Server", value: `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>` },
          )
          .setThumbnail(member.user.displayAvatarURL())
          .setColor(0xed4245)
          .setTimestamp();
        await verifyLogCh.send({ embeds: [embed] }).catch(() => {});
      }

      // DM the user explaining why they may have limited access
      try {
        await member.send(
          `👋 Welcome to **${member.guild.name}**!\n\nYour Discord account is only **${Math.floor(accountAgeDays)} days old**. ` +
          `Accounts must be at least **${MIN_ACCOUNT_AGE_DAYS} days old** to access all features. ` +
          `Some channels may be restricted until your account is older.`
        ).catch(() => {});
      } catch { /* ignore */ }

      await ctx.log("warn", `New account joined: ${member.user.tag} (${Math.floor(accountAgeDays)} days old)`, {
        user_id: member.id,
        account_age_days: Math.floor(accountAgeDays),
      });
    });

    await ctx.log("info", "Account Age Gating addon registered");
  },
};
