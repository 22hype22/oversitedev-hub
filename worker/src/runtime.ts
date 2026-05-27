import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  type Interaction,
} from "discord.js";
import { ChannelType } from "discord.js";
import { appendLog, recordMetrics, getSecret, upsertGuild, removeGuild, upsertChannels, upsertRoles } from "./runtime-api.js";
import { HEARTBEAT_INTERVAL_MS } from "./supabase.js";
import { loadBotConfig, loadDisabledAddons } from "./config.js";
import { resolveAddon, WEBSITE_ONLY_CATALOG, type AddonContext, type Addon } from "./addons/index.js";

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
    // bot_runtime_status is owned by the Python bot heartbeat; do not write here.

    try {
      // 1. Load order config + per-bot addon enable/disable state
      const config = await loadBotConfig(this.botId);
      if (!config) throw new Error("Bot order not found");
      const disabled = await loadDisabledAddons(this.botId);
      // Website-only catalog entries (dashboard, branding, …) aren't loaded
      // by the worker — they're features of the hosted dashboard.
      const skipped: string[] = [];
      const unknown: string[] = [];
      this.activeAddons = (config.addons ?? [])
        .filter((id) => !WEBSITE_ONLY_CATALOG.has(id))
        .map((catalogId) => {
          const addon = resolveAddon(catalogId);
          if (!addon) {
            unknown.push(catalogId);
            return null;
          }
          // Check the disabled set against both the catalog id (what the
          // dashboard writes to `bot_addon_state.addon_id`) and the resolved
          // runtime addon id, so either spelling gates the addon off.
          if (disabled.has(catalogId) || disabled.has(addon.id)) {
            skipped.push(catalogId);
            return null;
          }
          return addon;
        })
        .filter((a): a is Addon => Boolean(a));
      if (skipped.length > 0) {
        await appendLog(this.botId, "info", `Skipping disabled addon(s): ${skipped.join(", ")}`);
      }
      if (unknown.length > 0) {
        await appendLog(this.botId, "warn", `Unknown addon(s) on order (no runtime impl): ${unknown.join(", ")}`);
      }

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

      // Restore saved presence (Playing / Watching / etc. + online/idle/dnd/invisible)
      if (config.activity_type || config.presence_status) {
        try {
          this.applyPresence(
            config.activity_type ?? "playing",
            config.activity_text ?? "",
            config.presence_status ?? "online",
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await appendLog(this.botId, "warn", `Could not restore presence: ${msg}`);
        }
      }




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

      // bot_runtime_status (status + guilds) is owned by the Python bot heartbeat.

      this.heartbeat = setInterval(async () => {
        const g = this.client?.guilds.cache;
        if (g) {
          const m = g.reduce((s, guild) => s + guild.memberCount, 0);
          await recordMetrics(this.botId, { activeServers: g.size, memberCount: m });
        }
      }, HEARTBEAT_INTERVAL_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendLog(this.botId, "error", `Startup failed: ${msg}`);
      await appendLog(this.botId, "error", `Startup crashed: ${msg}`);
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
    this.cleanup();
    await appendLog(this.botId, "info", "Bot stopped");
    this.running = false;
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  /**
   * Re-read `bot_addon_state` and restart the bot if the set of enabled
   * addons has changed. Triggered by `apply_config` commands so toggling an
   * addon off in the dashboard actually tears down its event listeners.
   *
   * discord.js doesn't expose a clean per-addon `unregister`, so the safest
   * way to truly stop a disabled addon's listeners is to drop the client and
   * re-login with only the enabled addons attached.
   */
  async refreshAddons() {
    const previousIds = new Set(this.activeAddons.map((a) => a.id));
    const config = await loadBotConfig(this.botId);
    if (!config) {
      await appendLog(this.botId, "warn", "refreshAddons: bot order not found");
      return;
    }
    const disabled = await loadDisabledAddons(this.botId);
    const nextAddons = (config.addons ?? [])
      .filter((id) => !WEBSITE_ONLY_CATALOG.has(id))
      .map((catalogId) => {
        const addon = resolveAddon(catalogId);
        if (!addon) return null;
        if (disabled.has(catalogId) || disabled.has(addon.id)) return null;
        return addon;
      })
      .filter((a): a is Addon => Boolean(a));
    const nextIds = new Set(nextAddons.map((a) => a.id));

    const changed =
      nextIds.size !== previousIds.size ||
      [...nextIds].some((id) => !previousIds.has(id));
    if (!changed) {
      await appendLog(this.botId, "info", "refreshAddons: no change");
      return;
    }
    await appendLog(this.botId, "info", "refreshAddons: addon set changed — restarting", {
      previous: [...previousIds],
      next: [...nextIds],
    });
    if (this.running) {
      await this.restart();
    }
  }

  async listChannels(guildId: string) {
    if (!this.client) {
      const token = await getSecret(this.botId, "DISCORD_TOKEN");
      if (!token) throw new Error("DISCORD_TOKEN secret not set");

      const rest = new REST({ version: "10" }).setToken(token);
      const channels = (await rest.get(Routes.guildChannels(guildId))) as Array<{
        id: string;
        name?: string;
        type: number;
        parent_id?: string | null;
        position?: number;
      }>;
      const channelById = new Map(channels.map((c) => [c.id, c]));
      const TEXTUAL = new Set<number>([
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildForum,
        ChannelType.GuildVoice,
      ]);
      const entries = channels
        .filter((c) => TEXTUAL.has(c.type))
        .map((c) => {
          const parent = c.parent_id ? channelById.get(c.parent_id) : null;
          const channelType =
            c.type === ChannelType.GuildText ? "text"
            : c.type === ChannelType.GuildAnnouncement ? "announcement"
            : c.type === ChannelType.GuildForum ? "forum"
            : c.type === ChannelType.GuildVoice ? "voice"
            : "text";

          return {
            channel_id: c.id,
            channel_name: c.name ?? c.id,
            channel_type: channelType,
            parent_id: c.parent_id ?? null,
            parent_name: parent?.name ?? null,
            position: c.position ?? 0,
            parent_position: parent?.position ?? -1,
          };
        });

      await upsertChannels(this.botId, guildId, entries);
      await appendLog(this.botId, "info", `Cached ${entries.length} channel(s) for guild ${guildId}`);
      return;
    }
    let guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      try {
        await this.client.guilds.fetch(guildId);
      } catch {
        throw new Error(`Bot is not in guild ${guildId}`);
      }
    }
    const g = this.client.guilds.cache.get(guildId);
    if (!g) throw new Error(`Bot is not in guild ${guildId}`);

    const channels = await g.channels.fetch();
    const TEXTUAL = new Set<number>([
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildVoice,
    ]);

    const entries = [...channels.values()]
      .filter((c): c is NonNullable<typeof c> => c !== null && TEXTUAL.has(c.type))
      .map((c) => {
        const anyC = c as any;
        const parent = anyC.parent ?? null;
        const channelType =
          c.type === ChannelType.GuildText ? "text"
          : c.type === ChannelType.GuildAnnouncement ? "announcement"
          : c.type === ChannelType.GuildForum ? "forum"
          : c.type === ChannelType.GuildVoice ? "voice"
          : "text";

        const ownPos: number = anyC.rawPosition ?? anyC.position ?? 0;
        const parentPos: number = parent
          ? (parent.rawPosition ?? parent.position ?? -1)
          : -1;

        return {
          channel_id: c.id,
          channel_name: c.name ?? c.id,
          channel_type: channelType,
          parent_id: parent?.id ?? null,
          parent_name: parent?.name ?? null,
          position: ownPos,
          parent_position: parentPos,
        };
      });

    await upsertChannels(this.botId, guildId, entries);
    await appendLog(this.botId, "info", `Cached ${entries.length} channel(s) for guild ${g.name}`);
  }

  async listRoles(guildId: string) {
    if (!this.client) {
      const token = await getSecret(this.botId, "DISCORD_TOKEN");
      if (!token) throw new Error("DISCORD_TOKEN secret not set");

      const rest = new REST({ version: "10" }).setToken(token);
      const roles = (await rest.get(Routes.guildRoles(guildId))) as Array<{
        id: string;
        name: string;
        color?: number;
        position?: number;
        managed?: boolean;
      }>;
      const entries = roles.map((r) => ({
        role_id: r.id,
        role_name: r.name,
        color: r.color ?? 0,
        position: r.position ?? 0,
        managed: r.managed ?? false,
        is_everyone: r.id === guildId,
      }));
      await upsertRoles(this.botId, guildId, entries);
      await appendLog(this.botId, "info", `Cached ${entries.length} role(s) for guild ${guildId}`);
      return;
    }
    let g = this.client.guilds.cache.get(guildId);
    if (!g) {
      try { await this.client.guilds.fetch(guildId); } catch {
        throw new Error(`Bot is not in guild ${guildId}`);
      }
      g = this.client.guilds.cache.get(guildId);
    }
    if (!g) throw new Error(`Bot is not in guild ${guildId}`);

    const roles = await g.roles.fetch();
    const entries = [...roles.values()].map((r) => ({
      role_id: r.id,
      role_name: r.name,
      color: r.color ?? 0,
      position: (r as any).rawPosition ?? r.position ?? 0,
      managed: r.managed ?? false,
      is_everyone: r.id === g!.id,
    }));
    await upsertRoles(this.botId, guildId, entries);
    await appendLog(this.botId, "info", `Cached ${entries.length} role(s) for guild ${g.name}`);
  }

  async listGuilds() {
    // bot_runtime_status (status + guild list) is owned by the Python bot
    // heartbeat. The Lovable worker no longer reconciles this table.
    await appendLog(this.botId, "info", "listGuilds is a no-op — guild list is owned by the Python bot heartbeat");
  }

  /**
   * Force the bot to leave every guild it's currently in. Used by the
   * hosting grace-period enforcer after a customer's monthly payment fails
   * and the 10-day grace window expires.
   */
  async leaveAllGuilds(reason?: string) {
    if (!this.client) throw new Error("Cannot leave guilds — Discord client not initialized");
    // Make sure cache is hydrated; fetch is safe to call when already cached.
    try { await this.client.guilds.fetch(); } catch { /* best effort */ }
    const guilds = [...this.client.guilds.cache.values()];
    await appendLog(
      this.botId,
      "info",
      `leave_all_guilds: leaving ${guilds.length} guild(s)${reason ? ` (reason: ${reason})` : ""}`,
    );
    let left = 0;
    for (const g of guilds) {
      try {
        await g.leave();
        left += 1;
      } catch (err) {
        await appendLog(this.botId, "warn", `Failed to leave guild ${g.id} (${g.name})`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    await appendLog(this.botId, "info", `leave_all_guilds: left ${left}/${guilds.length}`);
  }

  private applyPresence(type: string, text: string, presence: string = "online") {
    if (!this.client?.user) throw new Error("Client not ready");
    const map: Record<string, ActivityType> = {
      playing: ActivityType.Playing,
      watching: ActivityType.Watching,
      listening: ActivityType.Listening,
      competing: ActivityType.Competing,
      streaming: ActivityType.Streaming,
    };
    const activityType = map[type.toLowerCase()] ?? ActivityType.Playing;
    const PRESENCE: Record<string, "online" | "idle" | "dnd" | "invisible"> = {
      online: "online",
      idle: "idle",
      dnd: "dnd",
      invisible: "invisible",
    };
    const status = PRESENCE[presence.toLowerCase()] ?? "online";
    const activities = text
      ? [
          (() => {
            const a: any = { name: text, type: activityType };
            if (activityType === ActivityType.Streaming) {
              a.url = "https://twitch.tv/discord";
            }
            return a;
          })(),
        ]
      : [];
    this.client.user.setPresence({ activities, status });
  }

  async setStatus(type: string, text: string, presence: string = "online") {
    if (!this.client?.user) throw new Error("Bot is not running");
    this.applyPresence(type, text, presence);
    await appendLog(this.botId, "info", `Presence set: ${presence} / ${type} ${text}`);
  }




  isRunning() {
    return this.running;
  }
}
