import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  type Interaction,
} from "discord.js";
import { ChannelType } from "discord.js";
import { setStatus, appendLog, recordMetrics, getSecret, upsertGuild, removeGuild, upsertChannels, replaceGuilds } from "./runtime-api.js";
import { HEARTBEAT_INTERVAL_MS } from "./supabase.js";
import { loadBotConfig } from "./config.js";
import { ADDONS, type AddonContext, type Addon } from "./addons/index.js";

/**
 * Bot lifecycle controller. One instance per running bot.
 */
export class BotRuntime {
  private heartbeat?: ReturnType<typeof setInterval>;
  private client?: Client;
  private running = false;
  private activeAddons: Addon[] = [];

  constructor(public readonly botId: string) {}

  async start() {
    if (this.running) return;
    this.running = true;
    await setStatus(this.botId, "starting");

    try {
      // 1. Load order config
      const config = await loadBotConfig(this.botId);
      if (!config) throw new Error("Bot order not found");
      // Website-only addons (e.g. "dashboard") aren't loaded by the worker —
      // they're features of the hosted dashboard, not the Discord bot.
      const WEBSITE_ONLY = new Set(["dashboard"]);
      this.activeAddons = (config.addons ?? [])
        .filter((id) => !WEBSITE_ONLY.has(id))
        .map((id) => ADDONS[id])
        .filter((a): a is Addon => Boolean(a));

      // 2. Pull credentials
      const token = await getSecret(this.botId, "DISCORD_TOKEN");
      if (!token) throw new Error("DISCORD_TOKEN secret not set");

      // 3. Build Discord client
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
        ],
      });
      this.client = client;

      const ctx: AddonContext = {
        botId: this.botId,
        userId: config.user_id,
        client,
        recordMetric: (deltas) => recordMetrics(this.botId, deltas),
        log: (level, message, context) => appendLog(this.botId, level, message, context),
      };

      // 4. Wire up addon listeners
      for (const addon of this.activeAddons) {
        await addon.register?.(ctx);
      }

      // 5. Generic event hooks
      client.on(Events.MessageCreate, () => {
        recordMetrics(this.botId, { messages: 1 }).catch(() => {});
      });

      client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;
        recordMetrics(this.botId, { commands: 1 }).catch(() => {});
        for (const addon of this.activeAddons) {
          if (!addon.onCommand) continue;
          try {
            await addon.onCommand(interaction, ctx);
            if (interaction.replied || interaction.deferred) break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            recordMetrics(this.botId, { errors: 1 }).catch(() => {});
            await appendLog(this.botId, "error", `addon ${addon.id} failed: ${msg}`);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: "Something went wrong.", ephemeral: true }).catch(() => {});
            }
          }
        }
      });

      client.on(Events.Error, (err) => {
        recordMetrics(this.botId, { errors: 1 }).catch(() => {});
        appendLog(this.botId, "error", `client error: ${err.message}`).catch(() => {});
      });

      // Server-slot enforcement: leave any guild over the paid limit.
      client.on(Events.GuildCreate, async (guild) => {
        const result = await upsertGuild(this.botId, guild.id, guild.name, guild.memberCount);
        if (!result.allowed) {
          await appendLog(
            this.botId,
            "warn",
            `Server limit reached (${result.current}/${result.limit}) — leaving "${guild.name}"`,
            { guild_id: guild.id, guild_name: guild.name },
          );
          try {
            await guild.leave();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await appendLog(this.botId, "error", `Failed to leave over-limit guild: ${msg}`);
          }
        } else {
          await appendLog(this.botId, "info", `Joined guild "${guild.name}"`, {
            guild_id: guild.id,
            members: guild.memberCount,
          });
        }
      });

      client.on(Events.GuildDelete, async (guild) => {
        await removeGuild(this.botId, guild.id);
        await appendLog(this.botId, "info", `Left guild "${guild.name ?? guild.id}"`);
      });

      // 6. Login
      await client.login(token);
      await this.registerSlashCommands(token, client.user!.id);

      // 7. Initial metrics & status
      const guilds = client.guilds.cache;
      const members = guilds.reduce((sum, g) => sum + g.memberCount, 0);
      await recordMetrics(this.botId, {
        activeServers: guilds.size,
        memberCount: members,
      });
      await appendLog(this.botId, "info", `Bot online in ${guilds.size} guild(s)`, {
        addons: this.activeAddons.map((a) => a.id),
      });

      // Reconcile existing guilds against the paid slot limit.
      // Process oldest-joined first so newcomers are the ones evicted.
      const sorted = [...guilds.values()].sort(
        (a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0),
      );
      for (const guild of sorted) {
        const r = await upsertGuild(this.botId, guild.id, guild.name, guild.memberCount);
        if (!r.allowed) {
          await appendLog(
            this.botId,
            "warn",
            `Over server limit on startup — leaving "${guild.name}"`,
            { guild_id: guild.id },
          );
          try { await guild.leave(); } catch { /* ignore */ }
        }
      }

      await setStatus(this.botId, "online");

      // 3. Periodic heartbeat (keeps last_heartbeat_at fresh so the
      //    detect_stale_bots cron doesn't flip us to offline).
      this.heartbeat = setInterval(async () => {
        const g = this.client?.guilds.cache;
        if (g) {
          const m = g.reduce((s, guild) => s + guild.memberCount, 0);
          await recordMetrics(this.botId, { activeServers: g.size, memberCount: m });
        }
        await setStatus(this.botId, "online");
      }, HEARTBEAT_INTERVAL_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendLog(this.botId, "error", `Startup failed: ${msg}`);
      await setStatus(this.botId, "crashed", { lastError: msg });
      this.running = false;
      this.cleanup();
      throw err;
    }
  }

  private async registerSlashCommands(token: string, clientId: string) {
    const commands = this.activeAddons
      .flatMap((a) => a.commands ?? [])
      .map((c) => c.toJSON());
    if (commands.length === 0) return;
    const rest = new REST({ version: "10" }).setToken(token);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    await appendLog(this.botId, "info", `Registered ${commands.length} slash command(s)`);
  }

  private cleanup() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
    if (this.client) {
      this.client.destroy().catch(() => {});
      this.client = undefined;
    }
    this.activeAddons = [];
  }

  async stop() {
    if (!this.running) return;
    await setStatus(this.botId, "stopping");
    this.cleanup();
    await appendLog(this.botId, "info", "Bot stopped");
    await setStatus(this.botId, "offline");
    this.running = false;
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  /**
   * Fetch the current text-channel list for a guild and replace the cache.
   * Caller must ensure this bot is running and is a member of the guild.
   */
  async listChannels(guildId: string) {
    if (!this.client) {
      throw new Error("Bot not running — start it before listing channels");
    }
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      // Try a fetch in case the cache is cold
      try {
        await this.client.guilds.fetch(guildId);
      } catch {
        throw new Error(`Bot is not in guild ${guildId}`);
      }
    }
    const g = this.client.guilds.cache.get(guildId);
    if (!g) throw new Error(`Bot is not in guild ${guildId}`);

    // Force a fresh fetch so newly-created channels show up.
    const channels = await g.channels.fetch();
    const TEXTUAL = new Set<number>([
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildVoice, // include for completeness; UI can filter
    ]);

    const entries = [...channels.values()]
      .filter((c): c is NonNullable<typeof c> => c !== null && TEXTUAL.has(c.type))
      .map((c) => {
        const parent = "parent" in c ? c.parent : null;
        const channelType =
          c.type === ChannelType.GuildText
            ? "text"
            : c.type === ChannelType.GuildAnnouncement
            ? "announcement"
            : c.type === ChannelType.GuildForum
            ? "forum"
            : c.type === ChannelType.GuildVoice
            ? "voice"
            : "text";
        const ownPos = "position" in c ? (c.position ?? 0) : 0;
        const parentPos = parent && "position" in parent ? (parent.position ?? 0) : -1;
        // Compose a sortable position: parent category first (by its own
        // position), then child by its position. Uncategorized channels
        // (parentPos = -1) sort to the very top, matching Discord's UI.
        // Voice channels in Discord always render below text/announcement
        // within a category, so bump them by a large offset.
        const typeBucket = channelType === "voice" ? 10000 : 0;
        const composite = (parentPos + 1) * 1000000 + typeBucket + ownPos;
        return {
          channel_id: c.id,
          channel_name: c.name ?? c.id,
          channel_type: channelType,
          parent_id: parent?.id ?? null,
          parent_name: parent?.name ?? null,
          position: composite,
        };
      });

    await upsertChannels(this.botId, guildId, entries);
    await appendLog(this.botId, "info", `Cached ${entries.length} channel(s) for guild ${g.name}`);
  }

  /**
   * Refresh the cached server list from Discord — adds servers the bot has
   * joined and removes ones it's left since startup. Called on demand from
   * the dashboard.
   */
  async listGuilds() {
    if (!this.client) {
      throw new Error("Bot not running — start it before listing servers");
    }
    // Force a fresh fetch so newly-joined servers show up.
    await this.client.guilds.fetch();
    const guilds = [...this.client.guilds.cache.values()].map((g) => ({
      guild_id: g.id,
      guild_name: g.name,
      member_count: g.memberCount,
    }));
    await replaceGuilds(this.botId, guilds);
    await appendLog(this.botId, "info", `Refreshed guild list (${guilds.length} server(s))`);
  }

  isRunning() {
    return this.running;
  }
}
