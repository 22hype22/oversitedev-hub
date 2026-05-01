import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events,
  TextChannel,
  GuildMember,
  ChannelType,
} from "discord.js";
import type { Addon, AddonContext } from "./index.js";

// ── In-memory stores ──
const ticketCategories = new Map<string, { categories: string[]; roles: Record<string, string[]> }>();
const openTickets = new Map<string, string>(); // userId-category -> channelId
const welcomeConfig = new Map<string, { channelId: string; message: string; goodbyeChannelId?: string; goodbyeMessage?: string }>();

// ── Helpers ──
function successEmbed(title: string, description?: string) {
  return new EmbedBuilder().setTitle(`✅ ${title}`).setDescription(description ?? null).setColor(0x57f287);
}

function errorEmbed(title: string, description?: string) {
  return new EmbedBuilder().setTitle(`❌ ${title}`).setDescription(description ?? null).setColor(0xed4245);
}

function isStaff(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.KickMembers) || member.permissions.has(PermissionFlagsBits.Administrator);
}

export const supportBaseAddon: Addon = {
  id: "support-base",
  name: "Oversite Support Base",

  commands: [
    new SlashCommandBuilder()
      .setName("ticket")
      .setDescription("Set up the ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("categories").setDescription("Comma separated categories e.g. Development, Appeal, Report").setRequired(true))
      .addStringOption((o) => o.setName("title").setDescription("Panel title").setRequired(false))
      .addStringOption((o) => o.setName("description").setDescription("Panel description").setRequired(false))
      .addStringOption((o) => o.setName("color").setDescription("Hex color e.g. 5865F2").setRequired(false)),

    new SlashCommandBuilder()
      .setName("welcome")
      .setDescription("Configure welcome messages")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((o) => o.setName("channel").setDescription("Welcome channel").setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Welcome message (use {user} and {server})").setRequired(true)),

    new SlashCommandBuilder()
      .setName("goodbye")
      .setDescription("Configure goodbye messages")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((o) => o.setName("channel").setDescription("Goodbye channel").setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Goodbye message (use {user} and {server})").setRequired(true)),
  ],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    // Welcome/goodbye events
    client.on(Events.GuildMemberAdd, async (member) => {
      const config = welcomeConfig.get(member.guild.id);
      if (!config) return;
      const channel = member.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
      if (!channel) return;
      const msg = config.message
        .replace("{user}", member.toString())
        .replace("{server}", member.guild.name);
      await (channel as any).send(msg).catch(() => {});
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      const config = welcomeConfig.get(member.guild.id);
      if (!config?.goodbyeChannelId || !config?.goodbyeMessage) return;
      const channel = member.guild.channels.cache.get(config.goodbyeChannelId) as TextChannel | undefined;
      if (!channel) return;
      const msg = config.goodbyeMessage
        .replace("{user}", member.user.tag)
        .replace("{server}", member.guild.name);
      await (channel as any).send(msg).catch(() => {});
    });

    // Ticket button/select/modal handling
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.guild) return;
      const guild = interaction.guild;

      // Select menu — category chosen
      if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category_select") {
        const category = interaction.values[0];
        const member = interaction.member as GuildMember;
        const ticketKey = `${member.id}-${category}`;

        if (openTickets.has(ticketKey)) {
          const existingId = openTickets.get(ticketKey)!;
          const existing = guild.channels.cache.get(existingId);
          if (existing) {
            await interaction.reply({ content: `❌ You already have an open **${category}** ticket: <#${existingId}>`, ephemeral: true });
            return;
          }
        }

        // Create category channel
        const safeCat = category.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const safeName = member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const channelName = `ticket-${safeCat}-${safeName}`;

        const guildConfig = ticketCategories.get(guild.id);
        const allowedRoles = guildConfig?.roles[category] ?? [];

        const permOverwrites: any[] = [
          { id: guild.roles.everyone.id as string, deny: ["ViewChannel"] },
          { id: guild.members.me!.id, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
          { id: member.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
        ];

        for (const roleName of allowedRoles) {
          const role = guild.roles.cache.find((r) => r.name === roleName);
          if (role) {
            permOverwrites.push({ id: role.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"] });
          }
        }

        // Find or create category
        let ticketCategory = guild.channels.cache.find(
          (c) => c.name === `${category} Tickets` && c.type === ChannelType.GuildCategory
        );
        if (!ticketCategory) {
          ticketCategory = await guild.channels.create({
            name: `${category} Tickets`,
            type: ChannelType.GuildCategory,
          }).catch(() => undefined) as any;
        }

        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: ticketCategory?.id,
          permissionOverwrites: permOverwrites,
          topic: `opener:${member.id}| category:${category}`,
        }).catch(() => null);

        if (!ticketChannel) {
          await interaction.reply({ embeds: [errorEmbed("Failed", "Could not create ticket channel.")], ephemeral: true });
          return;
        }

        openTickets.set(ticketKey, ticketChannel.id);

        // Ping roles
        const pingParts = [member.toString()];
        for (const roleName of allowedRoles) {
          const role = guild.roles.cache.find((r) => r.name === roleName);
          if (role) pingParts.push(role.toString());
        }

        const embed = new EmbedBuilder()
          .setTitle(`Ticket — ${category}`)
          .setDescription(
            `Thank you for your interest in our **${category}**. This ticket will be used to review your request.\n\n` +
            `Please describe your issue and staff will be with you shortly.\n\n` +
            `All submissions will be carefully reviewed by our staff. Submission does not guarantee acceptance.`
          )
          .setColor(0x5865f2)
          .setFooter({ text: `Opened by ${member.user.username}` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Success).setEmoji("🙋"),
          new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
          new ButtonBuilder().setCustomId("ticket_delete").setLabel("Delete").setStyle(ButtonStyle.Secondary).setEmoji("🗑️"),
        );

        await (ticketChannel as any).send({ content: pingParts.join(" "), embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>`, ephemeral: true });

        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch { /* ignore */ }
        }, 5000);
      }

      // Claim button
      if (interaction.isButton() && interaction.customId === "ticket_claim") {
        const member = interaction.member as GuildMember;
        if (!isStaff(member)) {
          await interaction.reply({ embeds: [errorEmbed("No Permission", "Only staff can claim tickets.")], ephemeral: true });
          return;
        }
        const channel = interaction.channel as TextChannel;
        await channel.edit({ topic: `${channel.topic ?? ""} claimed_by:${member.id}` }).catch(() => {});

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("ticket_claim").setLabel(`Claimed by ${member.user.username}`).setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
          new ButtonBuilder().setCustomId("ticket_delete").setLabel("Delete").setStyle(ButtonStyle.Secondary).setEmoji("🗑️"),
        );

        await interaction.update({ components: [row] });
        await (channel as any).send({ embeds: [new EmbedBuilder().setDescription(`🙋 ${member.toString()} has claimed this ticket.`).setColor(0x57f287)] });
      }

      // Close button
      if (interaction.isButton() && interaction.customId === "ticket_close") {
        const member = interaction.member as GuildMember;
        if (!isStaff(member)) {
          await interaction.reply({ embeds: [errorEmbed("No Permission", "Only staff can close tickets.")], ephemeral: true });
          return;
        }
        await interaction.reply({ embeds: [new EmbedBuilder().setDescription("🔒 This ticket will be deleted in 5 seconds...").setColor(0xffa500)] });
        setTimeout(async () => {
          await interaction.channel?.delete().catch(() => {});
        }, 5000);
      }

      // Delete button
      if (interaction.isButton() && interaction.customId === "ticket_delete") {
        const member = interaction.member as GuildMember;
        if (!isStaff(member)) {
          await interaction.reply({ embeds: [errorEmbed("No Permission", "Only staff can delete tickets.")], ephemeral: true });
          return;
        }
        await interaction.reply({ embeds: [new EmbedBuilder().setDescription("🗑️ Deleting...").setColor(0xed4245)] });
        setTimeout(async () => {
          await interaction.channel?.delete().catch(() => {});
        }, 2000);
      }

      // Appeal button
      if (interaction.isButton() && interaction.customId === "appeal_submit") {
        const modal = new ModalBuilder()
          .setCustomId("appeal_modal")
          .setTitle("Ban Appeal");
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("appeal_reason").setLabel("Why were you banned?").setStyle(TextInputStyle.Paragraph).setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("appeal_unban").setLabel("Why should you be unbanned?").setStyle(TextInputStyle.Paragraph).setRequired(true)
          ),
        );
        await interaction.showModal(modal);
      }

      // Appeal modal submit
      if (interaction.isModalSubmit() && interaction.customId === "appeal_modal") {
        const member = interaction.member as GuildMember;
        const guild = interaction.guild!;
        const reason = interaction.fields.getTextInputValue("appeal_reason");
        const unban = interaction.fields.getTextInputValue("appeal_unban");

        const appealCat = guild.channels.cache.find(
          (c) => c.name === "Appeals" && c.type === ChannelType.GuildCategory
        );
        const safeName = member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "-");

        const appealChannel = await guild.channels.create({
          name: `appeal-${safeName}`,
          type: ChannelType.GuildText,
          parent: appealCat?.id,
          permissionOverwrites: [
            { id: guild.roles.everyone.id as string, deny: ["ViewChannel"] },
            { id: member.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
            { id: guild.members.me!.id, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
          ],
          topic: `user_id:${member.id}`,
        }).catch(() => null);

        if (!appealChannel) {
          await interaction.reply({ embeds: [errorEmbed("Failed", "Could not create appeal channel.")], ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("Ban Appeal")
          .addFields(
            { name: "Why were you banned?", value: reason },
            { name: "Why should you be unbanned?", value: unban },
          )
          .setColor(0x5865f2)
          .setFooter({ text: `Submitted by ${member.user.username}` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("appeal_approve").setLabel("Approve").setStyle(ButtonStyle.Success).setEmoji("✅"),
          new ButtonBuilder().setCustomId("appeal_deny").setLabel("Deny").setStyle(ButtonStyle.Danger).setEmoji("❌"),
          new ButtonBuilder().setCustomId("appeal_claim").setLabel("Claim").setStyle(ButtonStyle.Secondary).setEmoji("🙋"),
        );

        await (appealChannel as any).send({ content: member.toString(), embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Your appeal has been submitted: <#${appealChannel.id}>`, ephemeral: true });
      }

      // Appeal approve/deny
      if (interaction.isButton() && (interaction.customId === "appeal_approve" || interaction.customId === "appeal_deny")) {
        const member = interaction.member as GuildMember;
        if (!isStaff(member)) {
          await interaction.reply({ embeds: [errorEmbed("No Permission")], ephemeral: true });
          return;
        }
        const approved = interaction.customId === "appeal_approve";
        const embed = new EmbedBuilder()
          .setTitle(approved ? "✅ Appeal Approved" : "❌ Appeal Denied")
          .setDescription(`Decision by ${member.toString()}`)
          .setColor(approved ? 0x57f287 : 0xed4245)
          .setTimestamp();
        await interaction.update({ components: [] });
        await interaction.channel?.send({ embeds: [embed] });
        setTimeout(async () => { await interaction.channel?.delete().catch(() => {}); }, 5000);
      }
    });

    await ctx.log("info", "Support Base addon registered");
  },

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;

    // /ticket
    if (interaction.commandName === "ticket") {
      const categoriesRaw = interaction.options.getString("categories", true);
      const title = interaction.options.getString("title") ?? "Open a Ticket";
      const description = interaction.options.getString("description") ?? "Select a category below to open a ticket.";
      const colorRaw = interaction.options.getString("color") ?? "5865F2";
      let color = 0x5865f2;
      try { color = parseInt(colorRaw, 16); } catch { /* ignore */ }

      const categories = categoriesRaw.split(",").map((c) => c.trim()).filter(Boolean);
      ticketCategories.set(guild.id, { categories, roles: {} });

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: "Select a category below to open a ticket" });

      const options = categories.map((cat) =>
        new StringSelectMenuOptionBuilder().setLabel(cat).setValue(cat)
      );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket_category_select")
          .setPlaceholder("Select a category to open a ticket...")
          .addOptions(options)
      );

      await interaction.channel!.send({ embeds: [embed], components: [row] });
      await interaction.reply({ embeds: [successEmbed("Ticket Panel Created", `Panel posted in <#${interaction.channelId}>`)], ephemeral: true });
    }

    // /welcome
    if (interaction.commandName === "welcome") {
      const channel = interaction.options.getChannel("channel") as TextChannel;
      const message = interaction.options.getString("message", true);
      const existing = welcomeConfig.get(guild.id) ?? { channelId: channel.id, message };
      welcomeConfig.set(guild.id, { ...existing, channelId: channel.id, message });
      await interaction.reply({ embeds: [successEmbed("Welcome Set", `Welcome messages will go to <#${channel.id}>`)], ephemeral: true });
    }

    // /goodbye
    if (interaction.commandName === "goodbye") {
      const channel = interaction.options.getChannel("channel") as TextChannel;
      const message = interaction.options.getString("message", true);
      const existing = welcomeConfig.get(guild.id) ?? { channelId: "", message: "" };
      welcomeConfig.set(guild.id, { ...existing, goodbyeChannelId: channel.id, goodbyeMessage: message });
      await interaction.reply({ embeds: [successEmbed("Goodbye Set", `Goodbye messages will go to <#${channel.id}>`)], ephemeral: true });
    }
  },
};
