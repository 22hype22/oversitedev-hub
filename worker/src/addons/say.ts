import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import type { Addon } from "./index.js";

/**
 * /say <message> — bot echoes the message in the channel.
 * Restricted to users with Manage Messages.
 */
export const sayAddon: Addon = {
  id: "say",
  name: "Say command",
  commands: [
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Make the bot say something")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("What should the bot say?")
          .setRequired(true)
          .setMaxLength(2000),
      ),
  ],
  async onCommand(interaction, ctx) {
    if (interaction.commandName !== "say") return;
    const msg = interaction.options.getString("message", true);
    await interaction.reply({ content: msg });
    await ctx.log("info", `Used /say in #${interaction.channelId}`, {
      guild: interaction.guildId,
      length: msg.length,
    });
  },
};
