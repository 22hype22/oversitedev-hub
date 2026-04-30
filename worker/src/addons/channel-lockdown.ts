import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, TextChannel, GuildMember } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

export const channelLockdownAddon: Addon = {
  id: "channel-lockdown",
  name: "Channel Lockdown Command",

  commands: [
    new SlashCommandBuilder()
      .setName("lock")
      .setDescription("Lock a channel or the entire server")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addChannelOption((o) => o.setName("channel").setDescription("Channel to lock (leave blank for current)").setRequired(false))
      .addBooleanOption((o) => o.setName("server").setDescription("Lock ALL channels (server lockdown)").setRequired(false)),

    new SlashCommandBuilder()
      .setName("unlock")
      .setDescription("Unlock a channel or the entire server")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addChannelOption((o) => o.setName("channel").setDescription("Channel to unlock (leave blank for current)").setRequired(false))
      .addBooleanOption((o) => o.setName("server").setDescription("Unlock ALL channels").setRequired(false)),
  ],

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;

    if (interaction.commandName === "lock") {
      const serverLock = interaction.options.getBoolean("server") ?? false;
      await interaction.deferReply({ ephemeral: true });

      if (serverLock) {
        let count = 0;
        for (const channel of guild.channels.cache.values()) {
          if (channel.isTextBased() && channel.type === 0) {
            try {
              await (channel as TextChannel).permissionOverwrites.edit(
                guild.roles.everyone,
                { SendMessages: false },
                { reason: `Server lockdown by ${(interaction.member as GuildMember).user.tag}` }
              );
              count++;
            } catch { /* ignore */ }
          }
        }
        await interaction.editReply({ content: `🔒 Server locked — ${count} channels locked.` });
        await ctx.log("warn", `Server lockdown activated by ${(interaction.member as GuildMember).user.tag}`);
      } else {
        const target = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;
        await target.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        const embed = new EmbedBuilder()
          .setTitle("🔒 Channel Locked")
          .addFields({ name: "Channel", value: target.toString() })
          .setColor(0xed4245)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      }
    }

    if (interaction.commandName === "unlock") {
      const serverUnlock = interaction.options.getBoolean("server") ?? false;
      await interaction.deferReply({ ephemeral: true });

      if (serverUnlock) {
        let count = 0;
        for (const channel of guild.channels.cache.values()) {
          if (channel.isTextBased() && channel.type === 0) {
            try {
              await (channel as TextChannel).permissionOverwrites.edit(
                guild.roles.everyone,
                { SendMessages: true },
              );
              count++;
            } catch { /* ignore */ }
          }
        }
        await interaction.editReply({ content: `🔓 Server unlocked — ${count} channels unlocked.` });
        await ctx.log("info", `Server unlocked by ${(interaction.member as GuildMember).user.tag}`);
      } else {
        const target = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;
        await target.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
        const embed = new EmbedBuilder()
          .setTitle("🔓 Channel Unlocked")
          .addFields({ name: "Channel", value: target.toString() })
          .setColor(0x57f287)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      }
    }
  },
};
