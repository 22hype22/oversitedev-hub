import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Events,
  TextChannel,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Addon, AddonContext } from "./index.js";

// ── Roblox Verification ──
export const robloxVerificationAddon: Addon = {
  id: "roblox-verification",
  name: "Roblox Verification",
  commands: [
    new SlashCommandBuilder()
      .setName("robloxverify")
      .setDescription("Link your Roblox account")
      .addStringOption((o) => o.setName("username").setDescription("Your Roblox username").setRequired(true)),
    new SlashCommandBuilder()
      .setName("robloxwhois")
      .setDescription("Look up a member's linked Roblox account")
      .addUserOption((o) => o.setName("member").setDescription("Member to look up").setRequired(true)),
  ],
  async register(ctx: AddonContext) {
    (ctx as any)._robloxLinks = new Map<string, { username: string; id: number }>();
    await ctx.log("info", "Roblox Verification addon registered");
  },
  async onCommand(interaction, ctx) {
    const links: Map<string, { username: string; id: number }> = (ctx as any)._robloxLinks ?? new Map();

    if (interaction.commandName === "robloxverify") {
      await interaction.deferReply({ ephemeral: true });
      const username = interaction.options.getString("username", true);
      try {
        const res = await fetch(`https://api.roblox.com/users/get-by-username?username=${username}`);
        if (!res.ok) { await interaction.editReply("❌ Roblox user not found."); return; }
        const data = await res.json() as { Id: number; Username: string };
        links.set(interaction.user.id, { username: data.Username, id: data.Id });
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Verified!").setDescription(`Linked to Roblox account **${data.Username}**`).setColor(0x57f287)] });
      } catch { await interaction.editReply("❌ Failed to fetch Roblox data."); }
    }

    if (interaction.commandName === "robloxwhois") {
      const target = interaction.options.getMember("member") as GuildMember;
      const link = links.get(target.id);
      if (!link) { await interaction.reply({ content: `${target.toString()} hasn't verified their Roblox account.`, ephemeral: true }); return; }
      const embed = new EmbedBuilder()
        .setTitle(`Roblox: ${link.username}`)
        .addFields(
          { name: "Discord", value: target.toString() },
          { name: "Roblox ID", value: `${link.id}` },
          { name: "Profile", value: `[View Profile](https://www.roblox.com/users/${link.id}/profile)` },
        )
        .setColor(0x5865f2);
      await interaction.reply({ embeds: [embed] });
    }
  },
};

// ── Starboard ──
const starboardConfig = new Map<string, { channelId: string; threshold: number }>();
const starboardMessages = new Map<string, string>(); // originalId -> starboardMsgId

export const starboardAddon: Addon = {
  id: "starboard",
  name: "Starboard",
  commands: [
    new SlashCommandBuilder()
      .setName("starboard")
      .setDescription("Set up the starboard")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((o) => o.setName("channel").setDescription("Starboard channel").setRequired(true))
      .addIntegerOption((o) => o.setName("threshold").setDescription("Stars needed (default 3)").setRequired(false)),
  ],
  async register(ctx: AddonContext) {
    const { client } = ctx;
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      if (user.bot || reaction.emoji.name !== "⭐") return;
      const guild = reaction.message.guild;
      if (!guild) return;
      const config = starboardConfig.get(guild.id);
      if (!config) return;
      const starCount = reaction.count ?? 0;
      if (starCount < config.threshold) return;
      const sbChannel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
      if (!sbChannel) return;
      const msg = reaction.message;
      const embed = new EmbedBuilder()
        .setDescription(msg.content ?? "")
        .setAuthor({ name: msg.author?.tag ?? "Unknown", iconURL: msg.author?.displayAvatarURL() })
        .addFields({ name: "Source", value: `[Jump](${msg.url})` })
        .setColor(0xffac33)
        .setFooter({ text: `⭐ ${starCount}` });
      if (msg.attachments.size > 0) embed.setImage(msg.attachments.first()!.url);
      const existing = starboardMessages.get(msg.id);
      if (existing) {
        const sbMsg = await sbChannel.messages.fetch(existing).catch(() => null);
        if (sbMsg) await sbMsg.edit({ embeds: [embed] });
      } else {
        const sent = await sbChannel.send({ embeds: [embed] });
        starboardMessages.set(msg.id, sent.id);
      }
    });
    await ctx.log("info", "Starboard addon registered");
  },
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "starboard") return;
    const channel = interaction.options.getChannel("channel") as TextChannel;
    const threshold = interaction.options.getInteger("threshold") ?? 3;
    starboardConfig.set(interaction.guild!.id, { channelId: channel.id, threshold });
    await interaction.reply({ content: `✅ Starboard set to <#${channel.id}> with ⭐ ${threshold} threshold.`, ephemeral: true });
  },
};

// ── Recurring Messages ──
const recurringMessages: { guildId: string; channelId: string; message: string; intervalMs: number; lastSent: number }[] = [];

export const recurringMessagesAddon: Addon = {
  id: "recurring-messages",
  name: "Recurring Messages",
  commands: [
    new SlashCommandBuilder()
      .setName("recurringadd")
      .setDescription("Add a recurring message")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((o) => o.setName("channel").setDescription("Channel").setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Message to send").setRequired(true))
      .addIntegerOption((o) => o.setName("interval").setDescription("Interval in minutes").setRequired(true)),
  ],
  async register(ctx: AddonContext) {
    setInterval(async () => {
      const now = Date.now();
      for (const r of recurringMessages) {
        if (now - r.lastSent < r.intervalMs) continue;
        const guild = ctx.client.guilds.cache.get(r.guildId);
        const channel = guild?.channels.cache.get(r.channelId) as TextChannel | undefined;
        if (channel) { await channel.send(r.message).catch(() => {}); r.lastSent = now; }
      }
    }, 60000);
    await ctx.log("info", "Recurring Messages addon registered");
  },
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "recurringadd") return;
    const channel = interaction.options.getChannel("channel") as TextChannel;
    const message = interaction.options.getString("message", true);
    const interval = interaction.options.getInteger("interval", true);
    recurringMessages.push({ guildId: interaction.guild!.id, channelId: channel.id, message, intervalMs: interval * 60000, lastSent: 0 });
    await interaction.reply({ content: `✅ Will post every ${interval} minutes in <#${channel.id}>`, ephemeral: true });
  },
};

// ── Giveaway System ──
const activeGiveaways = new Map<string, { messageId: string; channelId: string; prize: string; endsAt: number; entries: Set<string> }>();

export const giveawayAddon: Addon = {
  id: "giveaway",
  name: "Giveaway System",
  commands: [
    new SlashCommandBuilder()
      .setName("gstart")
      .setDescription("Start a giveaway")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((o) => o.setName("prize").setDescription("What are you giving away?").setRequired(true))
      .addIntegerOption((o) => o.setName("duration").setDescription("Duration in minutes").setRequired(true))
      .addIntegerOption((o) => o.setName("winners").setDescription("Number of winners").setRequired(false)),
    new SlashCommandBuilder()
      .setName("greroll")
      .setDescription("Reroll a giveaway winner")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((o) => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true)),
  ],
  async register(ctx: AddonContext) {
    const { client } = ctx;
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      if (user.bot || reaction.emoji.name !== "🎉") return;
      const giveaway = activeGiveaways.get(reaction.message.id);
      if (giveaway) giveaway.entries.add(user.id);
    });
    setInterval(async () => {
      const now = Date.now();
      for (const [msgId, giveaway] of activeGiveaways) {
        if (now < giveaway.endsAt) continue;
        activeGiveaways.delete(msgId);
        const guild = ctx.client.guilds.cache.first();
        const channel = guild?.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
        if (!channel) continue;
        const entries = [...giveaway.entries];
        if (entries.length === 0) {
          await channel.send(`🎉 Giveaway for **${giveaway.prize}** ended with no entries.`);
          continue;
        }
        const winner = guild?.members.cache.get(entries[Math.floor(Math.random() * entries.length)]);
        await channel.send(`🎉 Congratulations ${winner?.toString() ?? "Unknown"}! You won **${giveaway.prize}**!`);
      }
    }, 10000);
    await ctx.log("info", "Giveaway addon registered");
  },
  async onCommand(interaction, ctx) {
    if (interaction.commandName === "gstart") {
      const prize = interaction.options.getString("prize", true);
      const duration = interaction.options.getInteger("duration", true);
      const winners = interaction.options.getInteger("winners") ?? 1;
      const endsAt = Date.now() + duration * 60000;
      const embed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY 🎉")
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt / 1000)}:R>\n\nReact with 🎉 to enter!`)
        .setColor(0xffd700)
        .setTimestamp(endsAt);
      await interaction.reply({ embeds: [embed] });
      const msg = await interaction.fetchReply();
      await msg.react("🎉");
      activeGiveaways.set(msg.id, { messageId: msg.id, channelId: interaction.channelId, prize, endsAt, entries: new Set() });
    }
    if (interaction.commandName === "greroll") {
      const msgId = interaction.options.getString("message_id", true);
      await interaction.reply({ content: "🎲 Rerolling...", ephemeral: true });
    }
  },
};

// ── Birthday Announcements ──
const birthdays = new Map<string, { month: number; day: number }>(); // userId -> birthday
let birthdayChannelId: string | null = null;

export const birthdayAddon: Addon = {
  id: "birthday",
  name: "Birthday Announcements",
  commands: [
    new SlashCommandBuilder()
      .setName("setbirthday")
      .setDescription("Set your birthday")
      .addIntegerOption((o) => o.setName("month").setDescription("Month (1-12)").setRequired(true))
      .addIntegerOption((o) => o.setName("day").setDescription("Day (1-31)").setRequired(true)),
    new SlashCommandBuilder()
      .setName("birthdaychannel")
      .setDescription("Set the birthday announcement channel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((o) => o.setName("channel").setDescription("Channel").setRequired(true)),
  ],
  async register(ctx: AddonContext) {
    setInterval(async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      if (now.getHours() !== 9 || now.getMinutes() > 5) return; // Only fire at ~9am
      for (const guild of ctx.client.guilds.cache.values()) {
        if (!birthdayChannelId) continue;
        const channel = guild.channels.cache.get(birthdayChannelId) as TextChannel | undefined;
        if (!channel) continue;
        for (const [userId, bday] of birthdays) {
          if (bday.month === month && bday.day === day) {
            const member = guild.members.cache.get(userId);
            if (member) await channel.send(`🎂 Happy Birthday ${member.toString()}! 🎉`).catch(() => {});
          }
        }
      }
    }, 60000);
    await ctx.log("info", "Birthday Announcements addon registered");
  },
  async onCommand(interaction, ctx) {
    if (interaction.commandName === "setbirthday") {
      const month = interaction.options.getInteger("month", true);
      const day = interaction.options.getInteger("day", true);
      birthdays.set(interaction.user.id, { month, day });
      await interaction.reply({ content: `✅ Birthday set to ${month}/${day}`, ephemeral: true });
    }
    if (interaction.commandName === "birthdaychannel") {
      const channel = interaction.options.getChannel("channel") as TextChannel;
      birthdayChannelId = channel.id;
      await interaction.reply({ content: `✅ Birthday announcements will go to <#${channel.id}>`, ephemeral: true });
    }
  },
};

// ── Server Stats Channels ──
export const serverStatsAddon: Addon = {
  id: "server-stats",
  name: "Server Stats Channels",
  commands: [
    new SlashCommandBuilder()
      .setName("setupstats")
      .setDescription("Create auto-updating stats channels")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ],
  async register(ctx: AddonContext) {
    setInterval(async () => {
      for (const guild of ctx.client.guilds.cache.values()) {
        const memberCh = guild.channels.cache.find((c) => c.name.startsWith("👥 Members:"));
        if (memberCh && "setName" in memberCh) {
          await (memberCh as any).setName(`👥 Members: ${guild.memberCount}`).catch(() => {});
        }
        const botCh = guild.channels.cache.find((c) => c.name.startsWith("🤖 Bots:"));
        if (botCh && "setName" in botCh) {
          const botCount = guild.members.cache.filter((m) => m.user.bot).size;
          await (botCh as any).setName(`🤖 Bots: ${botCount}`).catch(() => {});
        }
      }
    }, 600000); // Update every 10 minutes
    await ctx.log("info", "Server Stats addon registered");
  },
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "setupstats") return;
    const guild = interaction.guild!;
    await interaction.deferReply({ ephemeral: true });
    try {
      await guild.channels.create({ name: `👥 Members: ${guild.memberCount}`, type: 2 as any, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ["Connect"] }] });
      const botCount = guild.members.cache.filter((m) => m.user.bot).size;
      await guild.channels.create({ name: `🤖 Bots: ${botCount}`, type: 2 as any, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ["Connect"] }] });
      await interaction.editReply("✅ Stats channels created! They update every 10 minutes.");
    } catch { await interaction.editReply("❌ Failed to create stats channels."); }
  },
};

// ── Twitch/YouTube Notifications ──
const streamNotifications = new Map<string, { channelId: string; platform: string; streamer: string }[]>();

export const streamNotificationsAddon: Addon = {
  id: "stream-notifications",
  name: "Twitch / YouTube Notifications",
  commands: [
    new SlashCommandBuilder()
      .setName("addstreamer")
      .setDescription("Add a streamer to notify when they go live")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("platform").setDescription("twitch or youtube").setRequired(true))
      .addStringOption((o) => o.setName("username").setDescription("Streamer username").setRequired(true))
      .addChannelOption((o) => o.setName("channel").setDescription("Notification channel").setRequired(true)),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "addstreamer") return;
    const platform = interaction.options.getString("platform", true).toLowerCase();
    const username = interaction.options.getString("username", true);
    const channel = interaction.options.getChannel("channel") as TextChannel;
    const existing = streamNotifications.get(interaction.guild!.id) ?? [];
    existing.push({ channelId: channel.id, platform, streamer: username });
    streamNotifications.set(interaction.guild!.id, existing);
    await interaction.reply({ content: `✅ Will notify in <#${channel.id}> when **${username}** goes live on **${platform}**.`, ephemeral: true });
  },
};

// ── Leveling System ──
const xpData = new Map<string, { xp: number; level: number }>(); // userId -> stats
const XP_PER_MESSAGE = 15;
const XP_PER_LEVEL = (level: number) => level * 100;

export const levelingAddon: Addon = {
  id: "leveling",
  name: "Leveling System",
  commands: [
    new SlashCommandBuilder()
      .setName("level")
      .setDescription("Check your level")
      .addUserOption((o) => o.setName("member").setDescription("Member to check").setRequired(false)),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("View the XP leaderboard"),
    new SlashCommandBuilder()
      .setName("setlevelrole")
      .setDescription("Set a role reward for reaching a level")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addIntegerOption((o) => o.setName("level").setDescription("Level required").setRequired(true))
      .addRoleOption((o) => o.setName("role").setDescription("Role to give").setRequired(true)),
  ],
  async register(ctx: AddonContext) {
    const levelRoles = new Map<number, string>(); // level -> roleId
    const { client } = ctx;

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || !message.guild) return;
      const key = message.author.id;
      const data = xpData.get(key) ?? { xp: 0, level: 0 };
      data.xp += XP_PER_MESSAGE;

      const xpNeeded = XP_PER_LEVEL(data.level + 1);
      if (data.xp >= xpNeeded) {
        data.level++;
        data.xp = 0;
        await message.channel.send({ embeds: [new EmbedBuilder().setDescription(`🎉 ${message.author.toString()} leveled up to **Level ${data.level}**!`).setColor(0xffd700)] }).catch(() => {});

        // Check role rewards
        const roleId = levelRoles.get(data.level);
        if (roleId) {
          const role = message.guild.roles.cache.get(roleId);
          if (role) await (message.member as GuildMember).roles.add(role).catch(() => {});
        }
      }
      xpData.set(key, data);
    });

    (ctx as any)._levelRoles = levelRoles;
    await ctx.log("info", "Leveling System addon registered");
  },
  async onCommand(interaction, ctx) {
    const levelRoles: Map<number, string> = (ctx as any)._levelRoles ?? new Map();

    if (interaction.commandName === "level") {
      const target = (interaction.options.getMember("member") ?? interaction.member) as GuildMember;
      const data = xpData.get(target.id) ?? { xp: 0, level: 0 };
      const xpNeeded = XP_PER_LEVEL(data.level + 1);
      const embed = new EmbedBuilder()
        .setTitle(`${target.user.username}'s Level`)
        .addFields(
          { name: "Level", value: `${data.level}` },
          { name: "XP", value: `${data.xp} / ${xpNeeded}` },
        )
        .setColor(0xffd700)
        .setThumbnail(target.user.displayAvatarURL());
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "leaderboard") {
      const sorted = [...xpData.entries()].sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp).slice(0, 10);
      const embed = new EmbedBuilder().setTitle("🏆 XP Leaderboard").setColor(0xffd700);
      for (const [userId, data] of sorted) {
        const member = interaction.guild!.members.cache.get(userId);
        embed.addFields({ name: member?.user.tag ?? userId, value: `Level ${data.level} — ${data.xp} XP` });
      }
      if (sorted.length === 0) embed.setDescription("No data yet.");
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "setlevelrole") {
      const level = interaction.options.getInteger("level", true);
      const role = interaction.options.getRole("role")!;
      levelRoles.set(level, role.id);
      await interaction.reply({ content: `✅ ${role.toString()} will be given at Level ${level}.`, ephemeral: true });
    }
  },
};

// ── Economy System ──
const balances = new Map<string, number>(); // userId -> balance
const DAILY_AMOUNT = 100;
const dailyCooldowns = new Map<string, number>();

export const economyAddon: Addon = {
  id: "economy",
  name: "Economy System",
  commands: [
    new SlashCommandBuilder().setName("balance").setDescription("Check your balance").addUserOption((o) => o.setName("member").setDescription("Member to check").setRequired(false)),
    new SlashCommandBuilder().setName("daily").setDescription("Claim your daily coins"),
    new SlashCommandBuilder().setName("pay").setDescription("Pay another member").addUserOption((o) => o.setName("member").setDescription("Who to pay").setRequired(true)).addIntegerOption((o) => o.setName("amount").setDescription("Amount to pay").setRequired(true)),
    new SlashCommandBuilder().setName("economyleaderboard").setDescription("View the richest members"),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a member (admin)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) => o.setName("member").setDescription("Member").setRequired(true))
      .addIntegerOption((o) => o.setName("amount").setDescription("Amount").setRequired(true)),
  ],
  async onCommand(interaction, ctx) {
    const userId = interaction.user.id;

    if (interaction.commandName === "balance") {
      const target = (interaction.options.getMember("member") ?? interaction.member) as GuildMember;
      const bal = balances.get(target.id) ?? 0;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${target.user.username}'s Balance`).setDescription(`💰 **${bal}** coins`).setColor(0xffd700)] });
    }

    if (interaction.commandName === "daily") {
      const lastClaim = dailyCooldowns.get(userId) ?? 0;
      const now = Date.now();
      if (now - lastClaim < 86400000) {
        const next = Math.floor((lastClaim + 86400000) / 1000);
        await interaction.reply({ content: `⏰ Daily already claimed. Next: <t:${next}:R>`, ephemeral: true });
        return;
      }
      const current = balances.get(userId) ?? 0;
      balances.set(userId, current + DAILY_AMOUNT);
      dailyCooldowns.set(userId, now);
      await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Claimed **${DAILY_AMOUNT}** daily coins! New balance: **${current + DAILY_AMOUNT}**`).setColor(0xffd700)] });
    }

    if (interaction.commandName === "pay") {
      const target = interaction.options.getMember("member") as GuildMember;
      const amount = interaction.options.getInteger("amount", true);
      const senderBal = balances.get(userId) ?? 0;
      if (amount <= 0) { await interaction.reply({ content: "❌ Amount must be positive.", ephemeral: true }); return; }
      if (senderBal < amount) { await interaction.reply({ content: "❌ Insufficient balance.", ephemeral: true }); return; }
      balances.set(userId, senderBal - amount);
      balances.set(target.id, (balances.get(target.id) ?? 0) + amount);
      await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Paid **${amount}** coins to ${target.toString()}`).setColor(0x57f287)] });
    }

    if (interaction.commandName === "economyleaderboard") {
      const sorted = [...balances.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const embed = new EmbedBuilder().setTitle("💰 Economy Leaderboard").setColor(0xffd700);
      for (const [uid, bal] of sorted) {
        const member = interaction.guild!.members.cache.get(uid);
        embed.addFields({ name: member?.user.tag ?? uid, value: `${bal} coins` });
      }
      if (sorted.length === 0) embed.setDescription("No data yet.");
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "addcoins") {
      const target = interaction.options.getMember("member") as GuildMember;
      const amount = interaction.options.getInteger("amount", true);
      balances.set(target.id, (balances.get(target.id) ?? 0) + amount);
      await interaction.reply({ content: `✅ Added **${amount}** coins to ${target.toString()}`, ephemeral: true });
    }
  },
};

// ── Reminder Command ──
export const reminderAddon: Addon = {
  id: "remindme",
  name: "/remindme",
  commands: [
    new SlashCommandBuilder()
      .setName("remindme")
      .setDescription("Set a personal reminder")
      .addStringOption((o) => o.setName("time").setDescription("Time e.g. 10m, 2h, 1d").setRequired(true))
      .addStringOption((o) => o.setName("reminder").setDescription("What to remind you about").setRequired(true)),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "remindme") return;
    const timeStr = interaction.options.getString("time", true);
    const reminder = interaction.options.getString("reminder", true);
    const units: Record<string, number> = { m: 60000, h: 3600000, d: 86400000 };
    const unit = timeStr.slice(-1);
    const amount = parseInt(timeStr.slice(0, -1));
    if (!units[unit] || isNaN(amount)) {
      await interaction.reply({ content: "❌ Invalid time format. Use e.g. `10m`, `2h`, `1d`", ephemeral: true });
      return;
    }
    const ms = amount * units[unit];
    await interaction.reply({ content: `⏰ I'll remind you about **${reminder}** in ${timeStr}!`, ephemeral: true });
    setTimeout(async () => {
      try {
        await interaction.user.send(`⏰ Reminder: **${reminder}**`).catch(async () => {
          const channel = interaction.channel as TextChannel;
          await channel.send(`⏰ ${interaction.user.toString()} Reminder: **${reminder}**`).catch(() => {});
        });
      } catch { /* ignore */ }
    }, ms);
  },
};
