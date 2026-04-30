import { Events, EmbedBuilder, TextChannel } from "discord.js";
import type { Addon, AddonContext } from "./index.js";

const NSFW_KEYWORDS = [
  "nsfw", "xxx", "porn", "nude", "nudes", "naked", "explicit", "adult", "18+",
  "uncensored", "leaked", "onlyfans", "hotgirls", "hot girls", "egirls", "sexy",
  "horny", "hentai", "ecchi", "lewd", "erotic", "sex", "sext", "hookup",
  "no rules", "no moderation", "anything goes", "free girls", "girls server",
  "rate me", "slutty", "kinky", "fansly", "spicy content",
];

const UNCERTAIN_KEYWORDS = [
  "girls", "boys", "dating", "flirt", "thicc", "baddie", "content creator",
  "naughty", "bad girls", "simp", "egirl", "eboy",
];

const knownBadServers = new Set<string>();
const knownSafeServers = new Set<string>();

async function getCensoredLogsChannel(ctx: AddonContext) {
  const guild = ctx.client.guilds.cache.first();
  if (!guild) return null;
  return guild.channels.cache.find(
    (c) => c.name === "censored-logs" && c.isTextBased()
  ) as TextChannel | undefined;
}

async function fetchInviteInfo(code: string): Promise<{ name: string; description: string } | null> {
  try {
    const res = await fetch(`https://discord.com/api/v10/invites/${code}`);
    if (!res.ok) return null;
    const data = await res.json() as { guild?: { name?: string; description?: string } };
    return {
      name: data.guild?.name ?? "Unknown Server",
      description: data.guild?.description ?? "",
    };
  } catch {
    return null;
  }
}

export const nsfwInviteScannerAddon: Addon = {
  id: "nsfw-invite-scanner",
  name: "NSFW Invite Scanner + Censored Logs",
  commands: [],

  async register(ctx: AddonContext) {
    const { client } = ctx;

    client.on(Events.MessageCreate, async (message) => {
      if (!message.guild || message.author.bot) return;

      const inviteMatch = message.content.match(/discord\.gg\/([a-zA-Z0-9]+)/);
      if (!inviteMatch) return;
      const code = inviteMatch[1];

      // Skip known safe
      if (knownSafeServers.has(code)) return;

      // Auto-delete known bad
      if (knownBadServers.has(code)) {
        await message.delete().catch(() => {});
        const ch = await getCensoredLogsChannel(ctx);
        if (ch) {
          const embed = new EmbedBuilder()
            .setTitle("🚫 Known Bad Server — Auto Removed")
            .addFields(
              { name: "Posted By", value: `${message.author.tag} (\`${message.author.id}\`)` },
              { name: "Invite Code", value: `\`${code}\`` },
              { name: "Channel", value: `<#${message.channelId}>` },
            )
            .setColor(0xed4245)
            .setTimestamp();
          const sent = await ch.send({ embeds: [embed] }).catch(() => null);
          if (sent) {
            await sent.react("🟢").catch(() => {});
            await sent.react("🟡").catch(() => {});
            await sent.react("🔴").catch(() => {});
          }
        }
        return;
      }

      // Fetch invite info
      const info = await fetchInviteInfo(code);
      const serverName = info?.name ?? "Unknown Server";
      const fullText = `${serverName} ${info?.description ?? ""}`.toLowerCase();

      const nsfwMatch = NSFW_KEYWORDS.find((kw) => fullText.includes(kw));
      const uncertainMatch = UNCERTAIN_KEYWORDS.find((kw) => fullText.includes(kw));

      if (nsfwMatch) {
        // Delete and log
        await message.delete().catch(() => {});
        knownBadServers.add(code);
        try {
          await message.author.send(`⚠️ Your message in **${message.guild.name}** was removed because it contained a link to an inappropriate server.`).catch(() => {});
        } catch { /* ignore */ }

        const ch = await getCensoredLogsChannel(ctx);
        if (ch) {
          const embed = new EmbedBuilder()
            .setTitle("🚫 NSFW Server Link — Removed")
            .addFields(
              { name: "Posted By", value: `${message.author.tag} (\`${message.author.id}\`)` },
              { name: "Server Name", value: serverName },
              { name: "Invite Code", value: `\`${code}\`` },
              { name: "Matched Keyword", value: `\`${nsfwMatch}\`` },
              { name: "Channel", value: `<#${message.channelId}>` },
              { name: "Message", value: message.content.slice(0, 500), inline: false },
            )
            .setColor(0xed4245)
            .setTimestamp();
          const sent = await ch.send({ embeds: [embed] }).catch(() => null);
          if (sent) {
            await sent.react("🟢").catch(() => {});
            await sent.react("🟡").catch(() => {});
            await sent.react("🔴").catch(() => {});
          }
        }
      } else if (uncertainMatch) {
        // Log for review, don't delete
        const ch = await getCensoredLogsChannel(ctx);
        if (ch) {
          const embed = new EmbedBuilder()
            .setTitle("🔍 Uncertain Server Link — Needs Review")
            .addFields(
              { name: "Posted By", value: `${message.author.tag} (\`${message.author.id}\`)` },
              { name: "Server Name", value: serverName },
              { name: "Invite Code", value: `discord.gg/${code}` },
              { name: "Uncertain Keyword", value: `\`${uncertainMatch}\`` },
              { name: "Channel", value: `<#${message.channelId}>` },
              { name: "Action Needed", value: "React with 🟢 Safe, 🟡 Watch, 🔴 Bad", inline: false },
            )
            .setColor(0xffa500)
            .setTimestamp();
          const sent = await ch.send({ embeds: [embed] }).catch(() => null);
          if (sent) {
            await sent.react("🟢").catch(() => {});
            await sent.react("🟡").catch(() => {});
            await sent.react("🔴").catch(() => {});
          }
        }
      }
    });

    // Reaction handling for censored logs
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      if (user.bot) return;
      const ch = await getCensoredLogsChannel(ctx);
      if (!ch || reaction.message.channelId !== ch.id) return;

      const guild = ctx.client.guilds.cache.first();
      if (!guild) return;
      const member = guild.members.cache.get(user.id);
      if (!member) return;

      const bodRole = guild.roles.cache.find((r) => r.name === "Board of Directors");
      if (bodRole && !member.roles.cache.has(bodRole.id)) return;

      const emoji = reaction.emoji.name;
      if (!["🟢", "🟡", "🔴"].includes(emoji ?? "")) return;

      const message = reaction.message;
      if (!message.embeds.length) return;

      const embed = message.embeds[0];
      const codeField = embed.fields.find((f) => f.name === "Invite Code");
      const nameField = embed.fields.find((f) => f.name === "Server Name");
      const inviteCode = codeField?.value.replace(/`/g, "").replace("discord.gg/", "") ?? "";
      const serverName = nameField?.value ?? "Unknown";

      if (emoji === "🔴" && inviteCode) {
        knownBadServers.add(inviteCode);
        await ctx.log("warn", `Invite ${inviteCode} (${serverName}) marked as BAD by ${user.tag}`);
      } else if (emoji === "🟢" && inviteCode) {
        knownSafeServers.add(inviteCode);
        await ctx.log("info", `Invite ${inviteCode} (${serverName}) marked as SAFE by ${user.tag}`);
      } else if (emoji === "🟡") {
        await ctx.log("info", `Invite ${inviteCode} (${serverName}) marked as WATCH by ${user.tag}`);
      }
    });

    await ctx.log("info", "NSFW Invite Scanner addon registered");
  },
};
