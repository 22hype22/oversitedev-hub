import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Events,
  GuildMember,
  Message,
  TextChannel,
} from "discord.js";
import type { Addon, AddonContext } from "./index.js";

// ============================================================
// CONSTANTS
// ============================================================

const SPAM_THRESHOLD = 5;
const SPAM_WINDOW_MS = 5000;
const RAID_THRESHOLD = 5;
const RAID_WINDOW_MS = 10000;
const ACCOUNT_MIN_DAYS = 20;

const PHISHING_DOMAINS = [
  "free-nitro", "discord-gift", "steamgift", "nitro-free",
  "discordapp.gift", "discord.gift.ru", "steamcommunity.ru",
  "freegift", "nitrogiveaway",
];

// In-memory trackers
const spamTracker = new Map<string, number[]>();
const raidTracker = new Map<string, number[]>();

// ============================================================
// HELPERS
// ============================================================

function successEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description ?? null)
    .setColor(0x57f287);
}

function errorEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description ?? null)
    .setColor(0xed4245);
}

function modEmbed(action: string, user: GuildMember, moderator: GuildMember, reason?: string) {
  const embed = new EmbedBuilder()
    .setTitle(`🛡️ ${action}`)
    .addFields(
      { name: "User", value: `${user.toString()} (\`${user.id}\`)` },
      { name: "Moderator", value: moderator.toString() },
    )
    .setColor(0xed4245)
    .setTimestamp();
  if (reason) embed.addFields({ name: "Reason", value: reason });
  return embed;
}

async function getLogChannel(ctx: AddonContext) {
  const guild = ctx.client.guilds.cache.first();
  if (!guild) return null;
  return guild.channels.cache.find(
    (c) => c.name === "server-logs" && c.isTextBased()
  ) as TextChannel | undefined;
}

async function logAction(ctx: AddonContext, embed: EmbedBuilder) {
  const ch = await getLogChannel(ctx);
  if (ch) {
    await (ch as any).send({ embeds: [embed] }).catch(() => {});
  }
}

// ============================================================
// VERIFICATION SYSTEM
// ============================================================

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

function generateVerifyCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ============================================================
// BASE PROTECTION ADDON
// ============================================================

export const protectionBaseAddon: Addon = {
  id: "protection-base",
  name: "Oversite Protection Base",

  commands: [
    // BAN
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a member")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to ban").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),

    // KICK
    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a member")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to kick").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),

    // WARN
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a member")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to warn").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),

    // MUTE
    new SlashCommandBuilder()
      .setName("mute")
      .setDescription("Timeout a member")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to mute").setRequired(true))
      .addIntegerOption((o) => o.setName("duration").setDescription("Duration in minutes").setRequired(false))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),

    // UNMUTE
    new SlashCommandBuilder()
      .setName("unmute")
      .setDescription("Remove timeout from a member")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to unmute").setRequired(true)),

    // VERIFICATION
    new SlashCommandBuilder()
      .setName("verification")
      .setDescription("Post the verification panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    // ── Anti-spam ──
    client.on(Events.MessageCreate, async (message: Message) => {
      if (!message.guild || message.author.bot) return;
      if ((message.member as GuildMember)?.permissions.has(PermissionFlagsBits.Administrator)) return;

      const now = Date.now();
      const key = message.author.id;
      const timestamps = (spamTracker.get(key) ?? []).filter((t) => now - t < SPAM_WINDOW_MS);
      timestamps.push(now);
      spamTracker.set(key, timestamps);

      if (timestamps.length >= SPAM_THRESHOLD) {
        spamTracker.delete(key);
        try {
          await message.delete();
          const member = message.member as GuildMember;
          await member.timeout(5 * 60 * 1000, "Auto-muted: spam");
          const embed = modEmbed("Auto-Muted (Spam)", member, message.guild.members.me!, "Sending messages too quickly");
          await logAction(ctx, embed);
          await ctx.log("warn", `Auto-muted ${message.author.tag} for spam`, { guild: message.guildId! });
        } catch { /* ignore */ }
      }

      // Phishing detection
      for (const domain of PHISHING_DOMAINS) {
        if (message.content.toLowerCase().includes(domain)) {
          try {
            await message.delete();
            await message.guild.members.ban(message.author.id, { reason: "Phishing link detected" });
            const embed = new EmbedBuilder()
              .setTitle("🚫 Auto-Ban (Phishing)")
              .addFields({ name: "User", value: `${message.author.tag} (\`${message.author.id}\`)` })
              .setColor(0xed4245)
              .setTimestamp();
            await logAction(ctx, embed);
          } catch { /* ignore */ }
          break;
        }
      }
    });

    // ── Anti-raid ──
    client.on(Events.GuildMemberAdd, async (member) => {
      if (!member.guild) return;
      const now = Date.now();
      const key = member.guild.id;
      const timestamps = (raidTracker.get(key) ?? []).filter((t) => now - t < RAID_WINDOW_MS);
      timestamps.push(now);
      raidTracker.set(key, timestamps);

      if (timestamps.length >= RAID_THRESHOLD) {
        raidTracker.delete(key);
        for (const channel of member.guild.channels.cache.values()) {
          if (channel.isTextBased() && channel.type === 0) {
            try {
              await (channel as TextChannel).permissionOverwrites.edit(
                member.guild.roles.everyone,
                { SendMessages: false },
                { reason: "Raid detected — auto lockdown" }
              );
            } catch { /* ignore */ }
          }
        }
        const logCh = await getLogChannel(ctx);
        if (logCh) {
          const embed = new EmbedBuilder()
            .setTitle("🚨 RAID DETECTED — SERVER LOCKED")
            .setDescription(`${RAID_THRESHOLD}+ members joined within ${RAID_WINDOW_MS / 1000} seconds. All channels locked.`)
            .setColor(0xff0000)
            .setTimestamp();
          await (logCh as any).send({ embeds: [embed] }).catch(() => {});
        }
        await ctx.log("warn", "Raid detected — server locked", { guild: member.guild.id });
      }

      // Basic logging: member join
      const logCh = await getLogChannel(ctx);
      if (logCh) {
        const embed = new EmbedBuilder()
          .setTitle("📥 Member Joined")
          .addFields(
            { name: "User", value: `${member.user.tag} (\`${member.id}\`)` },
            { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
          )
          .setColor(0x57f287)
          .setTimestamp();
        await (logCh as any).send({ embeds: [embed] }).catch(() => {});
      }
    });

    // ── Basic logging: bans/kicks ──
    client.on(Events.GuildBanAdd, async (ban) => {
      const logCh = await getLogChannel(ctx);
      if (!logCh) return;
      const embed = new EmbedBuilder()
        .setTitle("🔨 Member Banned")
        .addFields({ name: "User", value: `${ban.user.tag} (\`${ban.user.id}\`)` })
        .setColor(0xed4245)
        .setTimestamp();
      await (logCh as any).send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      const logCh = await getLogChannel(ctx);
      if (!logCh) return;
      const embed = new EmbedBuilder()
        .setTitle("📤 Member Left / Kicked")
        .addFields({ name: "User", value: `${member.user.tag} (\`${member.id}\`)` })
        .setColor(0xffa500)
        .setTimestamp();
      await (logCh as any).send({ embeds: [embed] }).catch(() => {});
    });

    // ── Verify button handler ──
    client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isButton() && interaction.customId === "verify_button") {
        const member = interaction.member as GuildMember;
        const guild = interaction.guild!;

        // Already verified
        const memberRole = guild.roles.cache.find((r) => r.name === "Member");
        if (memberRole && member.roles.cache.has(memberRole.id)) {
          await interaction.reply({ content: "✅ You are already verified!", ephemeral: true });
          return;
        }

        // Account age check
        const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
        if (accountAgeDays < ACCOUNT_MIN_DAYS) {
          const verifyLogCh = guild.channels.cache.find(
            (c) => c.name === "verification-logs" && c.isTextBased()
          ) as TextChannel | undefined;
          if (verifyLogCh) {
            const embed = new EmbedBuilder()
              .setTitle("🚫 Verification Denied — Account Too New")
              .setDescription(`${member.toString()} attempted to verify but their account is only **${Math.floor(accountAgeDays)} days old** (minimum: ${ACCOUNT_MIN_DAYS}).`)
              .addFields(
                { name: "User ID", value: member.id },
                { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
              )
              .setColor(0xed4245)
              .setTimestamp();
            await (verifyLogCh as any).send({ embeds: [embed] }).catch(() => {});
          }
          await interaction.reply({
            content: `❌ Your account must be at least **${ACCOUNT_MIN_DAYS} days old** to verify. Your account is **${Math.floor(accountAgeDays)} days old**.`,
            ephemeral: true,
          });
          return;
        }

        // Show code modal
        const code = generateVerifyCode();
        const modal = new ModalBuilder()
          .setCustomId(`verify_modal_${code}`)
          .setTitle("Complete Verification");
        const input = new TextInputBuilder()
          .setCustomId("verify_code")
          .setLabel(`Type this code exactly: ${code}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(code)
          .setRequired(true)
          .setMaxLength(10);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
      }

      // Modal submission
      if (interaction.isModalSubmit() && interaction.customId.startsWith("verify_modal_")) {
        const expectedCode = interaction.customId.replace("verify_modal_", "");
        const typed = interaction.fields.getTextInputValue("verify_code").trim().toUpperCase();
        const member = interaction.member as GuildMember;
        const guild = interaction.guild!;

        const verifyLogCh = guild.channels.cache.find(
          (c) => c.name === "verification-logs" && c.isTextBased()
        ) as TextChannel | undefined;

        if (typed !== expectedCode) {
          if (verifyLogCh) {
            const embed = new EmbedBuilder()
              .setTitle("⚠️ Verification Denied — Wrong Code")
              .addFields(
                { name: "User", value: `${member.user.tag} (\`${member.id}\`)` },
                { name: "Expected", value: `\`${expectedCode}\`` },
                { name: "Typed", value: `\`${typed}\`` },
              )
              .setColor(0xffa500)
              .setTimestamp();
            await (verifyLogCh as any).send({ embeds: [embed] }).catch(() => {});
          }
          await interaction.reply({ content: "❌ Incorrect code. Click **Verify** again to get a new code.", ephemeral: true });
          return;
        }

        // Grant member role, remove unverified
        const memberRole = guild.roles.cache.find((r) => r.name === "Member");
        const unverifiedRole = guild.roles.cache.find((r) => r.name === "Unverified");
        if (memberRole) await member.roles.add(memberRole, "Verified").catch(() => {});
        if (unverifiedRole) await member.roles.remove(unverifiedRole, "Verified").catch(() => {});

        if (verifyLogCh) {
          const embed = new EmbedBuilder()
            .setTitle("✅ Member Verified")
            .addFields(
              { name: "User", value: `${member.user.tag} (\`${member.id}\`)` },
              { name: "Account Age", value: `${Math.floor((Date.now() - member.user.createdTimestamp) / 86400000)} days` },
            )
            .setColor(0x57f287)
            .setTimestamp();
          await (verifyLogCh as any).send({ embeds: [embed] }).catch(() => {});
        }

        await interaction.reply({ content: "✅ You have been successfully verified! Welcome to the server.", ephemeral: true });
      }
    });

    // Assign Unverified role on join
    client.on(Events.GuildMemberAdd, async (member) => {
      const unverifiedRole = member.guild.roles.cache.find((r) => r.name === "Unverified");
      if (unverifiedRole) {
        await member.roles.add(unverifiedRole, "Auto-assigned on join").catch(() => {});
      }
    });
  },

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;
    const member = interaction.member as GuildMember;

    // ── /ban ──
    if (interaction.commandName === "ban") {
      const target = interaction.options.getMember("member") as GuildMember;
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      try {
        await guild.members.ban(target.id, { reason: `${reason} | Moderator: ${member.user.tag}` });
        const embed = modEmbed("Banned", target, member, reason);
        await interaction.reply({ embeds: [embed] });
        await logAction(ctx, embed);
      } catch (err) {
        await interaction.reply({ embeds: [errorEmbed("Failed", String(err))], ephemeral: true });
      }
    }

    // ── /kick ──
    if (interaction.commandName === "kick") {
      const target = interaction.options.getMember("member") as GuildMember;
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      try {
        await target.kick(`${reason} | Moderator: ${member.user.tag}`);
        const embed = modEmbed("Kicked", target, member, reason);
        await interaction.reply({ embeds: [embed] });
        await logAction(ctx, embed);
      } catch (err) {
        await interaction.reply({ embeds: [errorEmbed("Failed", String(err))], ephemeral: true });
      }
    }

    // ── /warn ──
    if (interaction.commandName === "warn") {
      const target = interaction.options.getMember("member") as GuildMember;
      const reason = interaction.options.getString("reason", true);
      const embed = modEmbed("Warned", target, member, reason);
      embed.setColor(0xffa500);
      await interaction.reply({ embeds: [embed] });
      await logAction(ctx, embed);
      try {
        await target.send(`⚠️ You have been warned in **${guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
      } catch { /* ignore */ }
    }

    // ── /mute ──
    if (interaction.commandName === "mute") {
      const target = interaction.options.getMember("member") as GuildMember;
      const duration = interaction.options.getInteger("duration") ?? 60;
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      try {
        await target.timeout(duration * 60 * 1000, `${reason} | Moderator: ${member.user.tag}`);
        const embed = modEmbed("Muted", target, member, `${reason} (${duration} minutes)`);
        embed.setColor(0xffa500);
        await interaction.reply({ embeds: [embed] });
        await logAction(ctx, embed);
      } catch (err) {
        await interaction.reply({ embeds: [errorEmbed("Failed", String(err))], ephemeral: true });
      }
    }

    // ── /unmute ──
    if (interaction.commandName === "unmute") {
      const target = interaction.options.getMember("member") as GuildMember;
      try {
        await target.timeout(null);
        const embed = modEmbed("Unmuted", target, member);
        embed.setColor(0x57f287);
        await interaction.reply({ embeds: [embed] });
        await logAction(ctx, embed);
      } catch (err) {
        await interaction.reply({ embeds: [errorEmbed("Failed", String(err))], ephemeral: true });
      }
    }

    // ── /verification ──
    if (interaction.commandName === "verification") {
      const embed = new EmbedBuilder()
        .setAuthor({ name: "Oversite | Rules & Regulations" })
        .setTitle("Verification")
        .setDescription(
          "Oversite Protection serves as our official verification system to ensure the security and integrity of our community. " +
          "All members are required to complete verification before gaining access to the server.\n\n" +
          "Failure to verify will result in restricted access to all channels and features. " +
          "This process is in place to protect against unauthorized users and maintain a safe, professional environment."
        )
        .setColor(0x2b2d31)
        .setFooter({ text: "Please complete verification to proceed." });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_button")
          .setLabel("Verify")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.channel!.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: "✅ Verification panel posted.", ephemeral: true });
    }
  },
};
