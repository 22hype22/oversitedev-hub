import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

// In-memory notes store
const staffNotes = new Map<string, { note: string; staffId: string; staffTag: string; timestamp: number }[]>();

export const staffNotesAddon: Addon = {
  id: "staff-notes",
  name: "Staff Notes on Users",

  commands: [
    new SlashCommandBuilder()
      .setName("note")
      .setDescription("Add a private staff note to a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to add note for").setRequired(true))
      .addStringOption((o) => o.setName("note").setDescription("The note").setRequired(true)),

    new SlashCommandBuilder()
      .setName("notes")
      .setDescription("View staff notes for a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("member").setDescription("Member to view notes for").setRequired(true)),

    new SlashCommandBuilder()
      .setName("clearnotes")
      .setDescription("Clear all notes for a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) => o.setName("member").setDescription("Member to clear notes for").setRequired(true)),
  ],

  async onCommand(interaction, ctx) {
    const mod = interaction.member as GuildMember;

    if (interaction.commandName === "note") {
      const target = interaction.options.getMember("member") as GuildMember;
      const note = interaction.options.getString("note", true);
      const existing = staffNotes.get(target.id) ?? [];
      existing.push({ note, staffId: mod.id, staffTag: mod.user.tag, timestamp: Date.now() });
      staffNotes.set(target.id, existing);
      await interaction.reply({
        content: `📝 Note added for ${target.toString()} (${existing.length} total notes)`,
        ephemeral: true,
      });
      await ctx.log("info", `Staff note added for ${target.user.tag} by ${mod.user.tag}`);
    }

    if (interaction.commandName === "notes") {
      const target = interaction.options.getMember("member") as GuildMember;
      const notes = staffNotes.get(target.id) ?? [];
      if (notes.length === 0) {
        await interaction.reply({ content: `No notes found for ${target.toString()}.`, ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(`Staff Notes for ${target.user.tag} (${notes.length})`)
        .setColor(0xffa500);
      notes.slice(-10).forEach((n, i) => {
        embed.addFields({
          name: `#${i + 1} by ${n.staffTag}`,
          value: `${n.note}\n<t:${Math.floor(n.timestamp / 1000)}:R>`,
        });
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === "clearnotes") {
      const target = interaction.options.getMember("member") as GuildMember;
      staffNotes.delete(target.id);
      await interaction.reply({ content: `✅ Cleared all notes for ${target.toString()}.`, ephemeral: true });
    }
  },
};
