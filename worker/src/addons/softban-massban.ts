import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

export const softbanMassbanAddon: Addon = {
  id: "softban-massban",
  name: "/softban and /massban",

  commands: [
    new SlashCommandBuilder()
      .setName("softban")
      .setDescription("Ban then immediately unban a member to delete their messages")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to softban").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),

    new SlashCommandBuilder()
      .setName("massban")
      .setDescription("Ban multiple users by ID (space separated)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("user_ids").setDescription("Space-separated user IDs").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),
  ],

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;
    const mod = interaction.member as GuildMember;

    if (interaction.commandName === "softban") {
      const target = interaction.options.getMember("member") as GuildMember;
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      await interaction.deferReply();
      try {
        await guild.members.ban(target.id, { deleteMessageSeconds: 604800, reason: `Softban: ${reason}` });
        await guild.members.unban(target.id, "Softban — immediate unban");
        const embed = new EmbedBuilder()
          .setTitle("🔄 Softbanned")
          .addFields(
            { name: "User", value: `${target.user.tag} (\`${target.id}\`)` },
            { name: "Moderator", value: mod.toString() },
            { name: "Reason", value: reason },
          )
          .setColor(0xffa500)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        await ctx.log("info", `Softbanned ${target.user.tag}`, { reason });
      } catch (err) {
        await interaction.editReply({ content: `❌ Failed: ${String(err)}` });
      }
    }

    if (interaction.commandName === "massban") {
      const idsRaw = interaction.options.getString("user_ids", true);
      const reason = interaction.options.getString("reason") ?? "Mass ban";
      const ids = idsRaw.trim().split(/\s+/).filter(Boolean);
      await interaction.deferReply({ ephemeral: true });

      let success = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await guild.members.ban(id, { reason: `Massban: ${reason} | By: ${mod.user.tag}` });
          success++;
        } catch {
          failed++;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle("🔨 Mass Ban Complete")
        .addFields(
          { name: "Attempted", value: `${ids.length}` },
          { name: "Successful", value: `${success}` },
          { name: "Failed", value: `${failed}` },
          { name: "Reason", value: reason },
          { name: "Moderator", value: mod.toString() },
        )
        .setColor(0xed4245)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      await ctx.log("warn", `Mass ban: ${success}/${ids.length} users banned by ${mod.user.tag}`, { reason });
    }
  },
};
