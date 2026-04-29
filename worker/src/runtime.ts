import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  type Interaction,
} from "discord.js";
import { setStatus, appendLog, recordMetrics, getSecret } from "./runtime-api.js";
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
      this.activeAddons = (config.addons ?? [])
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

  isRunning() {
    return this.running;
  }
}
