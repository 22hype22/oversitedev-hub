import { Events, EmbedBuilder, TextChannel } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

export const ticketLogsAddon: Addon = {
  id: "ticket-logs",
  name: "Ticket Logs",
  commands: [],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;
      if (!["ticket_close", "ticket_delete", "appeal_approve", "appeal_deny"].includes(interaction.customId)) return;

      const guild = interaction.guild;
      if (!guild) return;

      const logChannel = guild.channels.cache.find(
        (c) => c.name === "ticket-logs" && c.isTextBased()
      ) as TextChannel | undefined;
      if (!logChannel) return;

      const channel = interaction.channel as TextChannel;
      const topic = channel.topic ?? "";

      // Extract opener ID from topic
      const openerMatch = topic.match(/opener:(\d+)/);
      const categoryMatch = topic.match(/category:([^|]+)/);
      const claimedMatch = topic.match(/claimed_by:(\d+)/);

      const openerId = openerMatch?.[1];
      const category = categoryMatch?.[1]?.trim() ?? "Unknown";
      const claimedById = claimedMatch?.[1];

      // Collect messages for transcript
      const messages: string[] = [];
      try {
        const fetched = await channel.messages.fetch({ limit: 100 });
        fetched
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .forEach((msg) => {
            if (msg.author.bot && !msg.content) return;
            const time = new Date(msg.createdTimestamp).toISOString();
            messages.push(`[${time}] ${msg.author.tag}: ${msg.content || "(embed)"}`);
          });
      } catch { /* ignore */ }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Ticket Transcript — ${category}`)
        .addFields(
          { name: "Channel", value: `#${channel.name}` },
          { name: "Category", value: category },
          { name: "Opened By", value: openerId ? `<@${openerId}>` : "Unknown" },
          { name: "Claimed By", value: claimedById ? `<@${claimedById}>` : "Unclaimed" },
          { name: "Closed By", value: interaction.user.toString() },
          { name: "Closed At", value: `<t:${Math.floor(Date.now() / 1000)}:F>` },
          { name: "Total Messages", value: `${messages.length}` },
        )
        .setColor(0x5865f2)
        .setTimestamp();

      if (messages.length > 0 && messages.join("\n").length < 1000) {
        embed.addFields({ name: "Transcript", value: messages.join("\n").slice(0, 1024), inline: false });
        await logChannel.send({ embeds: [embed] });
      } else if (messages.length > 0) {
        const { AttachmentBuilder } = await import("discord.js");
        const buf = Buffer.from(messages.join("\n"), "utf-8");
        const file = new AttachmentBuilder(buf, { name: `transcript-${channel.name}.txt` });
        await logChannel.send({ embeds: [embed], files: [file] });
      } else {
        await logChannel.send({ embeds: [embed] });
      }

      await ctx.log("info", `Ticket transcript saved for #${channel.name}`);
    });

    await ctx.log("info", "Ticket Logs addon registered");
  },
};
