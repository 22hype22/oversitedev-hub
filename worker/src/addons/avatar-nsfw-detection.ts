import { Events, EmbedBuilder, TextChannel } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

async function checkAvatarNsfw(avatarUrl: string): Promise<{ isNsfw: boolean; reason: string }> {
  try {
    const imageRes = await fetch(avatarUrl);
    if (!imageRes.ok) return { isNsfw: false, reason: "Could not fetch avatar" };
    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageRes.headers.get("content-type") ?? "image/png";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: contentType, data: base64 } },
            { type: "text", text: "Is this image NSFW, sexually suggestive, or inappropriate for a general community? Reply with only YES or NO followed by one brief reason." },
          ],
        }],
      }),
    });

    if (!res.ok) return { isNsfw: false, reason: "API error" };
    const data = await res.json() as { content: Array<{ text: string }> };
    const text = data.content[0]?.text?.trim() ?? "";
    const isNsfw = text.toUpperCase().startsWith("YES");
    return { isNsfw, reason: text.slice(4).trim() || "Flagged as inappropriate" };
  } catch {
    return { isNsfw: false, reason: "Check failed" };
  }
}

export const avatarNsfwDetectionAddon: Addon = {
  id: "avatar-nsfw-detection",
  name: "Avatar NSFW Detection",
  commands: [],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    // Check avatar when member joins or updates their avatar
    client.on(Events.GuildMemberAdd, async (member) => {
      if (!member.user.avatar) return;
      const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
      const { isNsfw, reason } = await checkAvatarNsfw(avatarUrl);
      if (!isNsfw) return;

      const ch = member.guild.channels.cache.find(
        (c) => c.name === "censored-logs" && c.isTextBased()
      ) as TextChannel | undefined;
      if (!ch) return;

      const bodRole = member.guild.roles.cache.find((r) => r.name === "Board of Directors");
      const embed = new EmbedBuilder()
        .setTitle("👤 Suspicious Avatar Detected on Join")
        .setDescription(`${member.toString()} joined with a potentially inappropriate avatar.`)
        .addFields(
          { name: "User", value: `${member.user.tag} (\`${member.id}\`)` },
          { name: "Reason", value: reason },
          { name: "Account Age", value: `${Math.floor((Date.now() - member.user.createdTimestamp) / 86400000)} days` },
        )
        .setThumbnail(avatarUrl)
        .setColor(0xffa500)
        .setTimestamp();

      const sent = await ch.send({
        content: bodRole ? bodRole.toString() : undefined,
        embeds: [embed],
      }).catch(() => null);

      if (sent) {
        await sent.react("🟢").catch(() => {});
        await sent.react("🟡").catch(() => {});
        await sent.react("🔴").catch(() => {});
      }

      await ctx.log("warn", `Suspicious avatar detected for ${member.user.tag}`, { reason });
    });

    await ctx.log("info", "Avatar NSFW Detection addon registered");
  },
};
