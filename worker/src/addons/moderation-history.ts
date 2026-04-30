import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, GuildMember, Events } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

interface ModAction {
  action: string;
  reason: string;
  moderatorId: string;
  moderatorTag: string;
  timestamp: number;
}

const modHistory = new Map<string, ModAction[]>();

function addModAction(userId: string, action: ModAction) {
  const existing = modHistory.get(userId) ?? [];
  existing.push(action);
  modHistory.set(userId, existing);
}

export const moderationHistoryAddon: Addon = {
  id: "moderation-history",
  name: "Moderation History",

  commands: [
    new SlashCommandBuilder()
      .setName("modlog")
      .setDescription("View moderation history for a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to look up").setRequired(true)),

    new SlashCommandBuilder()
      .setName("clearmodlog")
      .setDescription("Clear moderation history for a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) => o.setName("member").setDescription("Member to clear").setRequired(true)),
  ],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    // Track bans
    client.on(Events.GuildBanAdd, async (ban) => {
      const guild = ban.guild;
      try {
        const auditLogs = await guild.fetchAuditLogs({ type: 22, limit: 1 });
        const entry = auditLogs.entries.first();
        if (entry && entry.target?.id === ban.user.id) {
          addModAction(ban.user.id, {
            action: "Ban",
            reason: entry.reason ?? "No reason provided",
            moderatorId: entry.executor?.id ?? "Unknown",
            moderatorTag: entry.executor?.tag ?? "Unknown",
            timestamp: Date.now(),
          });
        }
      } catch { /* ignore */ }
    });

    await ctx.log("info", "Moderation History addon registered");
  },

  async onCommand(interaction, ctx) {
    if (interaction.commandName === "modlog") {
      const target = interaction.options.getMember("member") as GuildMember;
      const history = modHistory.get(target.id) ?? [];
      if (history.length === 0) {
        await interaction.reply({ content: `No moderation history found for ${target.toString()}.`, ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(`Mod History for ${target.user.tag} (${history.length} actions)`)
        .setColor(0xed4245);
      history.slice(-10).forEach((h, i) => {
        embed.addFields({
          name: `#${i + 1} — ${h.action}`,
          value: `**Reason:** ${h.reason}\n**By:** ${h.moderatorTag}\n<t:${Math.floor(h.timestamp / 1000)}:R>`,
        });
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === "clearmodlog") {
      const target = interaction.options.getMember("member") as GuildMember;
      modHistory.delete(target.id);
      await interaction.reply({ content: `✅ Cleared moderation history for ${target.toString()}.`, ephemeral: true });
    }
  },
};
