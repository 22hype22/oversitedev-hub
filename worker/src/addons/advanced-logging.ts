import { Events, EmbedBuilder, TextChannel, AuditLogEvent } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

async function getLogChannel(ctx: AddonContext, name = "all-logs") {
  const guild = ctx.client.guilds.cache.first();
  if (!guild) return null;
  return guild.channels.cache.find(
    (c) => c.name === name && c.isTextBased()
  ) as TextChannel | undefined;
}

export const advancedLoggingAddon: Addon = {
  id: "advanced-logging",
  name: "Advanced Logging",
  commands: [],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    // Message deleted
    client.on(Events.MessageDelete, async (message) => {
      if (!message.guild || message.author?.bot) return;
      const ch = await getLogChannel(ctx);
      if (!ch) return;
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Message Deleted")
        .addFields(
          { name: "Author", value: message.author?.toString() ?? "Unknown" },
          { name: "Channel", value: `<#${message.channelId}>` },
          { name: "Content", value: message.content?.slice(0, 1024) || "*(no text)*", inline: false },
        )
        .setColor(0xed4245)
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    });

    // Message edited
    client.on(Events.MessageUpdate, async (before, after) => {
      if (!before.guild || before.author?.bot) return;
      if (before.content === after.content) return;
      const ch = await getLogChannel(ctx);
      if (!ch) return;
      const embed = new EmbedBuilder()
        .setTitle("✏️ Message Edited")
        .addFields(
          { name: "Author", value: before.author?.toString() ?? "Unknown" },
          { name: "Channel", value: `<#${before.channelId}>` },
          { name: "Before", value: before.content?.slice(0, 512) || "*(empty)*", inline: false },
          { name: "After", value: after.content?.slice(0, 512) || "*(empty)*", inline: false },
          { name: "Jump", value: `[View Message](${after.url})` },
        )
        .setColor(0xffa500)
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    });

    // Role added/removed
    client.on(Events.GuildMemberUpdate, async (before, after) => {
      const ch = await getLogChannel(ctx);
      if (!ch) return;
      const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
      const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
      if (added.size === 0 && removed.size === 0) return;
      const embed = new EmbedBuilder()
        .setTitle("🔄 Member Roles Updated")
        .addFields({ name: "Member", value: after.toString() })
        .setColor(0x5865f2)
        .setTimestamp();
      if (added.size > 0) embed.addFields({ name: "Roles Added", value: added.map((r) => r.toString()).join(", ") });
      if (removed.size > 0) embed.addFields({ name: "Roles Removed", value: removed.map((r) => r.toString()).join(", ") });
      await ch.send({ embeds: [embed] }).catch(() => {});
    });

    // Nickname change
    client.on(Events.GuildMemberUpdate, async (before, after) => {
      if (before.nickname === after.nickname) return;
      const ch = await getLogChannel(ctx);
      if (!ch) return;
      const embed = new EmbedBuilder()
        .setTitle("📝 Nickname Changed")
        .addFields(
          { name: "Member", value: after.toString() },
          { name: "Before", value: before.nickname ?? "*none*" },
          { name: "After", value: after.nickname ?? "*none*" },
        )
        .setColor(0x5865f2)
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    });

    // Voice channel join/leave
    client.on(Events.VoiceStateUpdate, async (before, after) => {
      const ch = await getLogChannel(ctx);
      if (!ch) return;
      const member = after.member;
      if (!member) return;
      if (!before.channelId && after.channelId) {
        const embed = new EmbedBuilder()
          .setTitle("🎙️ Joined Voice")
          .addFields(
            { name: "Member", value: member.toString() },
            { name: "Channel", value: after.channel?.name ?? "Unknown" },
          )
          .setColor(0x57f287)
          .setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => {});
      } else if (before.channelId && !after.channelId) {
        const embed = new EmbedBuilder()
          .setTitle("🔇 Left Voice")
          .addFields(
            { name: "Member", value: member.toString() },
            { name: "Channel", value: before.channel?.name ?? "Unknown" },
          )
          .setColor(0xed4245)
          .setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => {});
      }
    });

    // Channel created/deleted
    client.on(Events.ChannelCreate, async (channel) => {
      const ch = await getLogChannel(ctx);
      if (!ch) return;
      const embed = new EmbedBuilder()
        .setTitle("📁 Channel Created")
        .addFields({ name: "Name", value: channel.name ?? "Unknown" })
        .setColor(0x57f287)
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.ChannelDelete, async (channel) => {
      const ch = await getLogChannel(ctx);
      if (!ch) return;
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Channel Deleted")
        .addFields({ name: "Name", value: "name" in channel ? channel.name ?? "Unknown" : "Unknown" })
        .setColor(0xed4245)
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    });

    await ctx.log("info", "Advanced Logging addon registered");
  },
};
