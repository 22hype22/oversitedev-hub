import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

// In-memory warning store (persists per bot session)
const warnings = new Map<string, { reason: string; timestamp: number }[]>();

function getWarnings(userId: string) {
  return warnings.get(userId) ?? [];
}

function addWarning(userId: string, reason: string) {
  const existing = getWarnings(userId);
  existing.push({ reason, timestamp: Date.now() });
  warnings.set(userId, existing);
  return existing.length;
}

export const autoEscalatingWarningsAddon: Addon = {
  id: "auto-escalating-warnings",
  name: "Auto-Escalating Warnings",

  commands: [
    new SlashCommandBuilder()
      .setName("warnings")
      .setDescription("View a member's warnings")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to check").setRequired(true)),

    new SlashCommandBuilder()
      .setName("clearwarnings")
      .setDescription("Clear all warnings for a member")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) => o.setName("member").setDescription("Member to clear").setRequired(true)),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a member (with auto-escalation)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to warn").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),
  ],

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;
    const mod = interaction.member as GuildMember;

    if (interaction.commandName === "warn") {
      const target = interaction.options.getMember("member") as GuildMember;
      const reason = interaction.options.getString("reason", true);
      const count = addWarning(target.id, reason);

      const embed = new EmbedBuilder()
        .setTitle("⚠️ Warning Issued")
        .addFields(
          { name: "User", value: `${target.toString()} (\`${target.id}\`)` },
          { name: "Moderator", value: mod.toString() },
          { name: "Reason", value: reason },
          { name: "Total Warnings", value: `${count}` },
        )
        .setColor(0xffa500)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      try {
        await target.send(`⚠️ You have been warned in **${guild.name}**.\n**Reason:** ${reason}\n**Total Warnings:** ${count}`).catch(() => {});
      } catch { /* ignore */ }

      // Auto-escalation
      if (count >= 5) {
        try {
          await guild.members.ban(target.id, { reason: "5 warnings reached — auto ban" });
          await ctx.log("warn", `Auto-banned ${target.user.tag} for reaching 5 warnings`);
        } catch { /* ignore */ }
      } else if (count >= 3) {
        try {
          await target.timeout(60 * 60 * 1000, "3 warnings reached — auto mute 1 hour");
          const muteEmbed = new EmbedBuilder()
            .setTitle("🔇 Auto-Muted (3 Warnings)")
            .addFields({ name: "User", value: `${target.toString()} (\`${target.id}\`)` })
            .setColor(0xed4245)
            .setTimestamp();
          await interaction.channel?.send({ embeds: [muteEmbed] }).catch(() => {});
          await ctx.log("warn", `Auto-muted ${target.user.tag} for reaching 3 warnings`);
        } catch { /* ignore */ }
      }
    }

    if (interaction.commandName === "warnings") {
      const target = interaction.options.getMember("member") as GuildMember;
      const userWarnings = getWarnings(target.id);
      if (userWarnings.length === 0) {
        await interaction.reply({ content: `${target.toString()} has no warnings.`, ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${target.user.tag} (${userWarnings.length} total)`)
        .setColor(0xffa500);
      userWarnings.slice(-10).forEach((w, i) => {
        embed.addFields({ name: `#${i + 1}`, value: `${w.reason} — <t:${Math.floor(w.timestamp / 1000)}:R>` });
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === "clearwarnings") {
      const target = interaction.options.getMember("member") as GuildMember;
      warnings.delete(target.id);
      await interaction.reply({ content: `✅ Cleared all warnings for ${target.toString()}.`, ephemeral: true });
    }
  },
};
