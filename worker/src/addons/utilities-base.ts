import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  TextChannel,
  GuildMember,
  Message,
} from "discord.js";
import type { Addon, AddonContext } from "./index.js";

// In-memory sticky messages
const stickyMessages = new Map<string, { messageId: string; embed: EmbedBuilder }>();

export const utilitiesBaseAddon: Addon = {
  id: "utilities-base",
  name: "Oversite Utilities Base",

  commands: [
    // /say
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Post a message as the bot")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption((o) => o.setName("description").setDescription("Body text (use \\n for new line)").setRequired(true))
      .addStringOption((o) => o.setName("title").setDescription("Embed title").setRequired(false))
      .addStringOption((o) => o.setName("author").setDescription("Author name").setRequired(false))
      .addStringOption((o) => o.setName("footer").setDescription("Footer text").setRequired(false))
      .addStringOption((o) => o.setName("color").setDescription("Hex color e.g. 5865F2").setRequired(false))
      .addStringOption((o) => o.setName("images").setDescription("Comma separated image URLs").setRequired(false))
      .addChannelOption((o) => o.setName("channel").setDescription("Channel to post in (default: current)").setRequired(false)),

    // /announce
    new SlashCommandBuilder()
      .setName("announce")
      .setDescription("Send a plain announcement")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption((o) => o.setName("message").setDescription("Announcement text").setRequired(true))
      .addChannelOption((o) => o.setName("channel").setDescription("Channel to post in").setRequired(false)),

    // /reactionrole
    new SlashCommandBuilder()
      .setName("reactionrole")
      .setDescription("Add a reaction role to a message")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("message_id").setDescription("Message ID").setRequired(true))
      .addRoleOption((o) => o.setName("role").setDescription("Role to assign").setRequired(true))
      .addStringOption((o) => o.setName("emoji").setDescription("Emoji to react with").setRequired(true)),

    // /autorole
    new SlashCommandBuilder()
      .setName("autorole")
      .setDescription("Set a role to give new members automatically")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addRoleOption((o) => o.setName("role").setDescription("Role to auto-assign").setRequired(true)),

    // /poll
    new SlashCommandBuilder()
      .setName("poll")
      .setDescription("Create a poll")
      .addStringOption((o) => o.setName("question").setDescription("Poll question").setRequired(true))
      .addStringOption((o) => o.setName("option1").setDescription("Option 1").setRequired(true))
      .addStringOption((o) => o.setName("option2").setDescription("Option 2").setRequired(true))
      .addStringOption((o) => o.setName("option3").setDescription("Option 3").setRequired(false))
      .addStringOption((o) => o.setName("option4").setDescription("Option 4").setRequired(false)),

    // /userinfo
    new SlashCommandBuilder()
      .setName("userinfo")
      .setDescription("Get info about a user")
      .addUserOption((o) => o.setName("member").setDescription("Member to look up").setRequired(false)),

    // /serverinfo
    new SlashCommandBuilder()
      .setName("serverinfo")
      .setDescription("Get info about this server"),

    // /avatar
    new SlashCommandBuilder()
      .setName("avatar")
      .setDescription("Get a user's avatar")
      .addUserOption((o) => o.setName("member").setDescription("Member").setRequired(false)),

    // /8ball
    new SlashCommandBuilder()
      .setName("8ball")
      .setDescription("Ask the magic 8 ball")
      .addStringOption((o) => o.setName("question").setDescription("Your question").setRequired(true)),

    // /coinflip
    new SlashCommandBuilder()
      .setName("coinflip")
      .setDescription("Flip a coin"),

    // /repeating
    new SlashCommandBuilder()
      .setName("repeating")
      .setDescription("Set a sticky message in this channel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("description").setDescription("Message body").setRequired(true))
      .addStringOption((o) => o.setName("title").setDescription("Title").setRequired(false))
      .addStringOption((o) => o.setName("color").setDescription("Hex color").setRequired(false)),

    // /drepeating
    new SlashCommandBuilder()
      .setName("drepeating")
      .setDescription("Remove the sticky message from this channel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ],

  async register(ctx: AddonContext) {
    const { client } = ctx;
    const autoroles = new Map<string, string>(); // guildId -> roleId
    const reactionRoles = new Map<string, { roleId: string }>(); // messageId-emoji -> roleId

    // Autorole on join
    client.on(Events.GuildMemberAdd, async (member) => {
      const roleId = autoroles.get(member.guild.id);
      if (!roleId) return;
      const role = member.guild.roles.cache.get(roleId);
      if (role) await member.roles.add(role, "Autorole").catch(() => {});
    });

    // Reaction roles
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      if (user.bot) return;
      const key = `${reaction.message.id}-${reaction.emoji.name}`;
      const rr = reactionRoles.get(key);
      if (!rr) return;
      const guild = reaction.message.guild;
      if (!guild) return;
      const member = guild.members.cache.get(user.id);
      const role = guild.roles.cache.get(rr.roleId);
      if (member && role) await member.roles.add(role).catch(() => {});
    });

    client.on(Events.MessageReactionRemove, async (reaction, user) => {
      if (user.bot) return;
      const key = `${reaction.message.id}-${reaction.emoji.name}`;
      const rr = reactionRoles.get(key);
      if (!rr) return;
      const guild = reaction.message.guild;
      if (!guild) return;
      const member = guild.members.cache.get(user.id);
      const role = guild.roles.cache.get(rr.roleId);
      if (member && role) await member.roles.remove(role).catch(() => {});
    });

    // Sticky messages
    client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot || !message.guild) return;
      const sticky = stickyMessages.get(message.channelId);
      if (!sticky) return;
      try {
        const old = await message.channel.messages.fetch(sticky.messageId);
        await old.delete();
      } catch { /* ignore */ }
      const newMsg = await message.(channel as any).send({ embeds: [sticky.embed] }).catch(() => null);
      if (newMsg) stickyMessages.set(message.channelId, { ...sticky, messageId: newMsg.id });
    });

    // Store references for commands
    (ctx as any)._autoroles = autoroles;
    (ctx as any)._reactionRoles = reactionRoles;

    await ctx.log("info", "Utilities Base addon registered");
  },

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;
    const autoroles: Map<string, string> = (ctx as any)._autoroles ?? new Map();
    const reactionRoles: Map<string, { roleId: string }> = (ctx as any)._reactionRoles ?? new Map();

    // /say
    if (interaction.commandName === "say") {
      let description = interaction.options.getString("description", true).replace(/\\n/g, "\n");
      const title = interaction.options.getString("title");
      const author = interaction.options.getString("author");
      const footer = interaction.options.getString("footer");
      const colorRaw = interaction.options.getString("color") ?? "5865F2";
      const imagesRaw = interaction.options.getString("images");
      const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;

      let color = 0x5865f2;
      try { color = parseInt(colorRaw, 16); } catch { /* ignore */ }

      const imageUrls = imagesRaw ? imagesRaw.split(",").map((u) => u.trim()).filter(Boolean) : [];

      const embed = new EmbedBuilder().setColor(color);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (author) embed.setAuthor({ name: author });
      if (footer) embed.setFooter({ text: footer });
      if (imageUrls.length > 0) embed.setImage(imageUrls[0]);

      const embeds = [embed];
      for (const url of imageUrls.slice(1)) {
        embeds.push(new EmbedBuilder().setColor(color).setImage(url));
      }

      await (channel as any).send({ embeds: embeds.slice(0, 10) });
      await interaction.reply({ content: `✅ Posted in <#${channel.id}>`, ephemeral: true });
    }

    // /announce
    if (interaction.commandName === "announce") {
      const message = interaction.options.getString("message", true);
      const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;
      await (channel as any).send(message);
      await interaction.reply({ content: `✅ Announced in <#${channel.id}>`, ephemeral: true });
    }

    // /reactionrole
    if (interaction.commandName === "reactionrole") {
      const messageId = interaction.options.getString("message_id", true);
      const role = interaction.options.getRole("role")!;
      const emoji = interaction.options.getString("emoji", true);
      try {
        const msg = await interaction.channel!.messages.fetch(messageId);
        await msg.react(emoji);
        reactionRoles.set(`${messageId}-${emoji}`, { roleId: role.id });
        await interaction.reply({ content: `✅ Reaction role set — reacting with ${emoji} gives ${role.toString()}`, ephemeral: true });
      } catch {
        await interaction.reply({ content: "❌ Couldn't find that message.", ephemeral: true });
      }
    }

    // /autorole
    if (interaction.commandName === "autorole") {
      const role = interaction.options.getRole("role")!;
      autoroles.set(guild.id, role.id);
      await interaction.reply({ content: `✅ New members will receive ${role.toString()}`, ephemeral: true });
    }

    // /poll
    if (interaction.commandName === "poll") {
      const question = interaction.options.getString("question", true);
      const options = [
        interaction.options.getString("option1"),
        interaction.options.getString("option2"),
        interaction.options.getString("option3"),
        interaction.options.getString("option4"),
      ].filter(Boolean) as string[];
      const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${question}`)
        .setDescription(options.map((o, i) => `${emojis[i]} ${o}`).join("\n\n"))
        .setColor(0x5865f2)
        .setFooter({ text: `Poll by ${interaction.user.username}` });
      await interaction.reply({ embeds: [embed] });
      const msg = await interaction.fetchReply();
      for (let i = 0; i < options.length; i++) {
        await msg.react(emojis[i]).catch(() => {});
      }
    }

    // /userinfo
    if (interaction.commandName === "userinfo") {
      const target = (interaction.options.getMember("member") ?? interaction.member) as GuildMember;
      const embed = new EmbedBuilder()
        .setTitle(target.user.tag)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: "ID", value: target.id },
          { name: "Joined Server", value: `<t:${Math.floor((target.joinedTimestamp ?? 0) / 1000)}:R>` },
          { name: "Account Created", value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>` },
          { name: `Roles (${target.roles.cache.size - 1})`, value: target.roles.cache.filter((r) => r.id !== guild.roles.everyone.id).map((r) => r.toString()).join(" ") || "None", inline: false },
        )
        .setColor(target.displayColor || 0x5865f2);
      await interaction.reply({ embeds: [embed] });
    }

    // /serverinfo
    if (interaction.commandName === "serverinfo") {
      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: "Owner", value: `<@${guild.ownerId}>` },
          { name: "Members", value: `${guild.memberCount}` },
          { name: "Channels", value: `${guild.channels.cache.size}` },
          { name: "Roles", value: `${guild.roles.cache.size}` },
          { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>` },
          { name: "Server ID", value: guild.id },
        )
        .setColor(0x5865f2);
      await interaction.reply({ embeds: [embed] });
    }

    // /avatar
    if (interaction.commandName === "avatar") {
      const target = (interaction.options.getMember("member") ?? interaction.member) as GuildMember;
      const embed = new EmbedBuilder()
        .setTitle(`${target.user.username}'s Avatar`)
        .setImage(target.user.displayAvatarURL({ size: 512 }))
        .setColor(0x5865f2);
      await interaction.reply({ embeds: [embed] });
    }

    // /8ball
    if (interaction.commandName === "8ball") {
      const responses = [
        "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes, definitely.",
        "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.",
        "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.",
        "Better not tell you now.", "Cannot predict now.", "Don't count on it.",
        "My reply is no.", "My sources say no.", "Outlook not so good.", "Very doubtful.",
      ];
      const question = interaction.options.getString("question", true);
      const embed = new EmbedBuilder()
        .addFields(
          { name: "❓ Question", value: question, inline: false },
          { name: "🎱 Answer", value: responses[Math.floor(Math.random() * responses.length)], inline: false },
        )
        .setColor(0x5865f2);
      await interaction.reply({ embeds: [embed] });
    }

    // /coinflip
    if (interaction.commandName === "coinflip") {
      const result = Math.random() < 0.5 ? "Heads 🪙" : "Tails 🪙";
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Coin Flip").setDescription(`It landed on **${result}**!`).setColor(0x5865f2)] });
    }

    // /repeating
    if (interaction.commandName === "repeating") {
      let description = interaction.options.getString("description", true).replace(/\\n/g, "\n");
      const title = interaction.options.getString("title");
      const colorRaw = interaction.options.getString("color") ?? "5865F2";
      let color = 0x5865f2;
      try { color = parseInt(colorRaw, 16); } catch { /* ignore */ }

      const embed = new EmbedBuilder().setColor(color).setDescription(description);
      if (title) embed.setTitle(title);

      // Delete old sticky
      if (stickyMessages.has(interaction.channelId)) {
        try {
          const old = await interaction.channel!.messages.fetch(stickyMessages.get(interaction.channelId)!.messageId);
          await old.delete();
        } catch { /* ignore */ }
      }

      const msg = await interaction.channel!.send({ embeds: [embed] }).catch(() => null);
      if (msg) stickyMessages.set(interaction.channelId, { messageId: msg.id, embed });
      await interaction.reply({ content: "✅ Sticky message set.", ephemeral: true });
    }

    // /drepeating
    if (interaction.commandName === "drepeating") {
      if (!stickyMessages.has(interaction.channelId)) {
        await interaction.reply({ content: "❌ No sticky message in this channel.", ephemeral: true });
        return;
      }
      try {
        const old = await interaction.channel!.messages.fetch(stickyMessages.get(interaction.channelId)!.messageId);
        await old.delete();
      } catch { /* ignore */ }
      stickyMessages.delete(interaction.channelId);
      await interaction.reply({ content: "✅ Sticky message removed.", ephemeral: true });
    }
  },
};
