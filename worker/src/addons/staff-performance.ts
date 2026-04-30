import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Events } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

interface StaffStats {
  ticketsClosed: number;
  ticketsClaimed: number;
  lastActive: number;
}

const staffStats = new Map<string, StaffStats>();

function getStats(userId: string): StaffStats {
  return staffStats.get(userId) ?? { ticketsClosed: 0, ticketsClaimed: 0, lastActive: 0 };
}

export const staffPerformanceAddon: Addon = {
  id: "staff-performance",
  name: "Staff Performance Tracking",

  commands: [
    new SlashCommandBuilder()
      .setName("staffstats")
      .setDescription("View staff performance stats")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Staff member to view (leave blank for all)").setRequired(false)),
  ],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;

      if (interaction.customId === "ticket_claim") {
        const stats = getStats(interaction.user.id);
        stats.ticketsClaimed++;
        stats.lastActive = Date.now();
        staffStats.set(interaction.user.id, stats);
      }

      if (interaction.customId === "ticket_close" || interaction.customId === "ticket_delete") {
        // Find who claimed it from topic
        const channel = interaction.channel as any;
        const topic = channel?.topic ?? "";
        const claimedMatch = topic.match(/claimed_by:(\d+)/);
        if (claimedMatch) {
          const staffId = claimedMatch[1];
          const stats = getStats(staffId);
          stats.ticketsClosed++;
          stats.lastActive = Date.now();
          staffStats.set(staffId, stats);
        }
      }
    });

    await ctx.log("info", "Staff Performance Tracking addon registered");
  },

  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "staffstats") return;
    const guild = interaction.guild!;
    const targetMember = interaction.options.getMember("member") as any;

    if (targetMember) {
      const stats = getStats(targetMember.id);
      const embed = new EmbedBuilder()
        .setTitle(`📊 Staff Stats — ${targetMember.user.tag}`)
        .addFields(
          { name: "Tickets Claimed", value: `${stats.ticketsClaimed}` },
          { name: "Tickets Closed", value: `${stats.ticketsClosed}` },
          { name: "Last Active", value: stats.lastActive ? `<t:${Math.floor(stats.lastActive / 1000)}:R>` : "Never" },
        )
        .setColor(0x5865f2)
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      // Show leaderboard
      const sorted = [...staffStats.entries()]
        .sort((a, b) => b[1].ticketsClosed - a[1].ticketsClosed)
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setTitle("📊 Staff Performance Leaderboard")
        .setColor(0x5865f2)
        .setTimestamp();

      for (const [userId, stats] of sorted) {
        const member = guild.members.cache.get(userId);
        embed.addFields({
          name: member?.user.tag ?? userId,
          value: `Claimed: ${stats.ticketsClaimed} | Closed: ${stats.ticketsClosed}`,
        });
      }

      if (sorted.length === 0) embed.setDescription("No staff activity tracked yet.");
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
