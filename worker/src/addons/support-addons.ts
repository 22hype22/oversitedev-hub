import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  GuildMember,
  Events,
  ChannelType,
} from "discord.js";
import type { Addon, AddonContext } from "./index.js";

// ── Per-Category Role Access ──
const categoryRoles = new Map<string, Record<string, string[]>>(); // guildId -> category -> roles[]

export const perCategoryRolesAddon: Addon = {
  id: "per-category-roles",
  name: "Per Category Role Access",
  commands: [
    new SlashCommandBuilder()
      .setName("ticketroles")
      .setDescription("Set roles for a ticket category")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("category").setDescription("Category name").setRequired(true))
      .addStringOption((o) => o.setName("roles").setDescription("Comma separated role names").setRequired(true)),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "ticketroles") return;
    const category = interaction.options.getString("category", true);
    const rolesRaw = interaction.options.getString("roles", true);
    const roles = rolesRaw.split(",").map((r) => r.trim());
    const existing = categoryRoles.get(interaction.guild!.id) ?? {};
    existing[category] = roles;
    categoryRoles.set(interaction.guild!.id, existing);
    await interaction.reply({ content: `✅ Set roles for **${category}**: ${roles.join(", ")}`, ephemeral: true });
  },
};

// ── Ticket Notes ──
const ticketNotes = new Map<string, { note: string; staffTag: string; timestamp: number }[]>();

export const ticketNotesAddon: Addon = {
  id: "ticket-notes",
  name: "Ticket Notes",
  commands: [
    new SlashCommandBuilder()
      .setName("ticketnote")
      .setDescription("Add a private staff note to this ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addStringOption((o) => o.setName("note").setDescription("The note").setRequired(true)),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "ticketnote") return;
    const note = interaction.options.getString("note", true);
    const key = interaction.channelId;
    const existing = ticketNotes.get(key) ?? [];
    existing.push({ note, staffTag: interaction.user.tag, timestamp: Date.now() });
    ticketNotes.set(key, existing);
    const embed = new EmbedBuilder()
      .setTitle("📝 Staff Note")
      .setDescription(note)
      .setFooter({ text: `Note by ${interaction.user.tag} • ${new Date().toUTCString()}` })
      .setColor(0xffa500);
    await interaction.reply({ embeds: [embed] });
  },
};

// ── Add/Remove Members ──
export const ticketMembersAddon: Addon = {
  id: "ticket-members",
  name: "Add/Remove Ticket Members",
  commands: [
    new SlashCommandBuilder()
      .setName("ticketadd")
      .setDescription("Add a user to this ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to add").setRequired(true)),
    new SlashCommandBuilder()
      .setName("ticketremove")
      .setDescription("Remove a user from this ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to remove").setRequired(true)),
    new SlashCommandBuilder()
      .setName("ticketrename")
      .setDescription("Rename this ticket channel")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addStringOption((o) => o.setName("name").setDescription("New channel name").setRequired(true)),
  ],
  async onCommand(interaction, ctx) {
    const channel = interaction.channel as TextChannel;

    if (interaction.commandName === "ticketadd") {
      const member = interaction.options.getMember("member") as GuildMember;
      await channel.permissionOverwrites.edit(member, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await interaction.reply({ content: `✅ Added ${member.toString()} to this ticket.` });
    }

    if (interaction.commandName === "ticketremove") {
      const member = interaction.options.getMember("member") as GuildMember;
      await channel.permissionOverwrites.delete(member);
      await interaction.reply({ content: `✅ Removed ${member.toString()} from this ticket.` });
    }

    if (interaction.commandName === "ticketrename") {
      const name = interaction.options.getString("name", true);
      const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      await channel.edit({ name: safeName });
      await interaction.reply({ content: `✅ Renamed to \`${safeName}\``, ephemeral: true });
    }
  },
};

// ── Close All Tickets ──
export const closeAllTicketsAddon: Addon = {
  id: "close-all-tickets",
  name: "Close All Tickets",
  commands: [
    new SlashCommandBuilder()
      .setName("closeall")
      .setDescription("Close all open tickets")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "closeall") return;
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild!;
    let count = 0;
    for (const channel of guild.channels.cache.values()) {
      if (channel.isTextBased() && channel.name.startsWith("ticket-")) {
        try {
          await channel.delete("closeall command");
          count++;
        } catch { /* ignore */ }
      }
    }
    await interaction.editReply({ content: `✅ Closed and deleted **${count}** ticket channels.` });
    await ctx.log("info", `closeall executed by ${interaction.user.tag} — ${count} tickets closed`);
  },
};

// ── Ticket Message Customization ──
const ticketMessages = new Map<string, string>(); // guildId-category -> message

export const ticketMessageCustomizationAddon: Addon = {
  id: "ticket-message-customization",
  name: "Ticket Message Customization",
  commands: [
    new SlashCommandBuilder()
      .setName("ticketmessage")
      .setDescription("Set the opening message for a ticket category")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("category").setDescription("Category name").setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Message to show (use \\n for new lines)").setRequired(true)),
    new SlashCommandBuilder()
      .setName("ticketmessagelist")
      .setDescription("List all saved ticket messages")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName === "ticketmessage") {
      const category = interaction.options.getString("category", true);
      const message = interaction.options.getString("message", true).replace(/\\n/g, "\n");
      ticketMessages.set(`${interaction.guild!.id}-${category}`, message);
      await interaction.reply({ content: `✅ Message set for **${category}** tickets.`, ephemeral: true });
    }

    if (interaction.commandName === "ticketmessagelist") {
      const guildId = interaction.guild!.id;
      const entries = [...ticketMessages.entries()].filter(([k]) => k.startsWith(guildId));
      if (entries.length === 0) {
        await interaction.reply({ content: "No ticket messages set yet.", ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder().setTitle("Ticket Messages").setColor(0x5865f2);
      for (const [key, msg] of entries) {
        const cat = key.replace(`${guildId}-`, "");
        embed.addFields({ name: cat, value: msg.slice(0, 200) + (msg.length > 200 ? "..." : "") });
      }
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

// ── Priority Ticket Flagging ──
export const priorityTicketAddon: Addon = {
  id: "priority-ticket",
  name: "Priority Ticket Flagging",
  commands: [
    new SlashCommandBuilder()
      .setName("priority")
      .setDescription("Flag this ticket as high priority")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "priority") return;
    const channel = interaction.channel as TextChannel;
    if (!channel.name.startsWith("ticket-")) {
      await interaction.reply({ content: "❌ This command can only be used in ticket channels.", ephemeral: true });
      return;
    }
    const newName = `🔴-${channel.name}`;
    await channel.edit({ name: newName }).catch(() => {});
    const embed = new EmbedBuilder()
      .setTitle("🔴 Ticket Flagged as Priority")
      .setDescription(`This ticket has been marked as high priority by ${interaction.user.toString()}`)
      .setColor(0xed4245)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await ctx.log("warn", `Ticket ${channel.name} flagged as priority by ${interaction.user.tag}`);
  },
};

// ── Auto-Close Inactive Tickets ──
export const autoCloseTicketsAddon: Addon = {
  id: "auto-close-tickets",
  name: "Auto-Close Inactive Tickets",
  commands: [
    new SlashCommandBuilder()
      .setName("setautoclosedays")
      .setDescription("Set how many days of inactivity before auto-closing tickets")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addIntegerOption((o) => o.setName("days").setDescription("Days of inactivity (0 to disable)").setRequired(true)),
  ],

  async register(ctx: AddonContext) {
    let autoCloseDays = 7;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startCheck = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(async () => {
        if (autoCloseDays === 0) return;
        const cutoff = Date.now() - autoCloseDays * 86400000;
        for (const guild of ctx.client.guilds.cache.values()) {
          for (const channel of guild.channels.cache.values()) {
            if (!channel.isTextBased() || !channel.name.startsWith("ticket-")) continue;
            try {
              const messages = await (channel as TextChannel).messages.fetch({ limit: 1 });
              const lastMsg = messages.first();
              if (!lastMsg || lastMsg.createdTimestamp < cutoff) {
                await (channel as TextChannel).send({
                  embeds: [new EmbedBuilder()
                    .setDescription(`⏰ This ticket has been inactive for ${autoCloseDays} days and will be closed automatically.`)
                    .setColor(0xffa500)]
                });
                setTimeout(async () => { await channel.delete("Auto-close: inactive").catch(() => {}); }, 10000);
                await ctx.log("info", `Auto-closed inactive ticket: #${channel.name}`);
              }
            } catch { /* ignore */ }
          }
        }
      }, 3600000); // Check every hour
    };

    startCheck();
    await ctx.log("info", "Auto-Close Tickets addon registered");
  },

  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "setautoclosedays") return;
    const days = interaction.options.getInteger("days", true);
    await interaction.reply({ content: `✅ Tickets will auto-close after **${days}** days of inactivity${days === 0 ? " (disabled)" : ""}.`, ephemeral: true });
  },
};

// ── Anonymous Reporting ──
export const anonymousReportingAddon: Addon = {
  id: "anonymous-reporting",
  name: "Anonymous Reporting",
  commands: [
    new SlashCommandBuilder()
      .setName("anonreport")
      .setDescription("Submit an anonymous report to staff")
      .addStringOption((o) => o.setName("report").setDescription("What are you reporting?").setRequired(true)),
    new SlashCommandBuilder()
      .setName("setreportchannel")
      .setDescription("Set the channel for anonymous reports")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((o) => o.setName("channel").setDescription("Report channel").setRequired(true)),
  ],

  async onCommand(interaction, ctx) {
    if (interaction.commandName === "setreportchannel") {
      const channel = interaction.options.getChannel("channel") as TextChannel;
      await interaction.reply({ content: `✅ Anonymous reports will go to <#${channel.id}>`, ephemeral: true });
      await ctx.log("info", `Report channel set to #${channel.name}`);
    }

    if (interaction.commandName === "anonreport") {
      const report = interaction.options.getString("report", true);
      const guild = interaction.guild!;

      const reportChannel = guild.channels.cache.find(
        (c) => c.name === "reports" && c.isTextBased()
      ) as TextChannel | undefined;

      if (!reportChannel) {
        await interaction.reply({ content: "❌ No report channel configured. Ask an admin to set one up.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🚨 Anonymous Report")
        .setDescription(report)
        .setColor(0xed4245)
        .setFooter({ text: "This report was submitted anonymously" })
        .setTimestamp();

      await reportChannel.send({ embeds: [embed] });
      await interaction.reply({ content: "✅ Your anonymous report has been submitted to staff.", ephemeral: true });
      await ctx.log("info", "Anonymous report submitted");
    }
  },
};
