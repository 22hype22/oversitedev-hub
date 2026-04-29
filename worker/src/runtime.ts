import { setStatus, appendLog, recordMetrics, getSecret } from "./runtime-api.js";
import { HEARTBEAT_INTERVAL_MS } from "./supabase.js";

/**
 * Bot lifecycle controller. One instance per running bot.
 *
 * Replace the body of `start()` with your real Discord client setup
 * (e.g. discord.js Client with intents). The skeleton below shows the
 * heartbeat + metrics loop you need either way.
 */
export class BotRuntime {
  private heartbeat?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(public readonly botId: string) {}

  async start() {
    if (this.running) return;
    this.running = true;
    await setStatus(this.botId, "starting");

    try {
      // 1. Pull credentials
      const token = await getSecret(this.botId, "DISCORD_TOKEN");
      if (!token) {
        throw new Error("DISCORD_TOKEN secret not set");
      }

      // 2. TODO: replace this with real Discord client login
      // const client = new Client({ intents: [...] });
      // await client.login(token);
      // client.on("messageCreate", () => recordMetrics(this.botId, { messages: 1 }));
      // client.on("interactionCreate", () => recordMetrics(this.botId, { commands: 1 }));

      await appendLog(this.botId, "info", "Bot started", { worker: true });
      await setStatus(this.botId, "online");

      // 3. Periodic heartbeat (keeps last_heartbeat_at fresh so the
      //    detect_stale_bots cron doesn't flip us to offline).
      this.heartbeat = setInterval(async () => {
        await setStatus(this.botId, "online");
      }, HEARTBEAT_INTERVAL_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendLog(this.botId, "error", `Startup failed: ${msg}`);
      await setStatus(this.botId, "crashed", { lastError: msg });
      this.running = false;
    }
  }

  async stop() {
    if (!this.running) return;
    await setStatus(this.botId, "stopping");
    if (this.heartbeat) clearInterval(this.heartbeat);
    // TODO: client.destroy();
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

  // Convenience for your real implementation
  async metric(deltas: Parameters<typeof recordMetrics>[1]) {
    return recordMetrics(this.botId, deltas);
  }
}
