import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

interface TempBan {
  userId: string;
  guildId: string;
  reason: string;
  unbanAt: number;
  timeout: ReturnType<typeof setTimeout>;
}

const tempBans = new Map<string, TempBan>();

export const tempBanAddon: Addon = {
  id: "temp-ban",
  name: "Temporary Bans (Auto-Unban)",

  commands: [
    new SlashCommandBuilder()
      .setName("tempban")
      .setDescription("Temporarily ban a member")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to temp-ban").setRequired(true))
      .addIntegerOption((o) => o.setName("duration").setDescription("Duration in minutes").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),
  ],

  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "tempban") return;

    const guild = interaction.guild!;
    const mod = interaction.member as GuildMember;
    const target = interaction.options.getMember("member") as GuildMember;
    const duration = interaction.options.getInteger("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const unbanAt = Date.now() + duration * 60 * 1000;

    await interaction.deferReply();

    try {
      await target.send(`⛔ You have been temporarily banned from **${guild.name}** for **${duration} minutes**.\n**Reason:** ${reason}`).catch(() => {});
      await guild.members.ban(target.id, { reason: `Temp ban (${duration}min): ${reason} | By: ${mod.user.tag}` });

      const embed = new EmbedBuilder()
        .setTitle("⏱️ Temporary Ban")
        .addFields(
          { name: "User", value: `${target.user.tag} (\`${target.id}\`)` },
          { name: "Moderator", value: mod.toString() },
          { name: "Duration", value: `${duration} minutes` },
          { name: "Unbans At", value: `<t:${Math.floor(unbanAt / 1000)}:R>` },
          { name: "Reason", value: reason },
        )
        .setColor(0xed4245)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });

      // Schedule auto-unban
      const key = `${guild.id}-${target.id}`;
      if (tempBans.has(key)) {
        clearTimeout(tempBans.get(key)!.timeout);
      }

      const timeout = setTimeout(async () => {
        try {
          await guild.members.unban(target.id, "Temp ban expired — auto unban");
          tempBans.delete(key);
          await ctx.log("info", `Temp ban expired — auto unbanned ${target.user.tag}`, { duration });
        } catch { /* ignore */ }
      }, duration * 60 * 1000);

      tempBans.set(key, { userId: target.id, guildId: guild.id, reason, unbanAt, timeout });
      await ctx.log("warn", `Temp banned ${target.user.tag} for ${duration} minutes`, { reason });
    } catch (err) {
      await interaction.editReply({ content: `❌ Failed: ${String(err)}` });
    }
  },
};
