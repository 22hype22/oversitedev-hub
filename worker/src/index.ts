import {
  supabase,
  WORKER_ID,
  WORKER_TOKEN_VALUE,
  POLL_INTERVAL_MS,
} from "./supabase.js";
import { BotRuntime } from "./runtime.js";
import { startHealthServer } from "./health.js";

const runtimes = new Map<string, BotRuntime>();
const health = { startedAt: Date.now(), runtimes, lastPollAt: Date.now() };
startHealthServer(health);

function getRuntime(botId: string): BotRuntime {
  let r = runtimes.get(botId);
  if (!r) {
    r = new BotRuntime(botId);
    runtimes.set(botId, r);
  }
  return r;
}

type Cmd = {
  id: string;
  bot_id: string;
  action: "start" | "stop" | "restart" | "update";
};

type BuildJob = {
  id: string;
  bot_order_id: string;
  status: string;
  selections: {
    bot_name: string;
    base: string;
    addons: string[];
    icon_url?: string;
    banner_url?: string;
    bot_description?: string;
  };
};

// ============================================================
// COMMAND HANDLING
// ============================================================

async function claimNextCommand(): Promise<Cmd | null> {
  const { data, error } = await supabase.rpc("runtime_claim_next_command", {
    _token: WORKER_TOKEN_VALUE,
    _worker_id: WORKER_ID,
  });
  if (error) {
    console.error("claim error:", error.message);
    return null;
  }
  const result = data as { ok: boolean; command: Cmd | null; error?: string };
  if (!result?.ok) {
    console.error("claim refused:", result?.error);
    return null;
  }
  return result.command ?? null;
}

async function completeCommand(id: string, ok: boolean, errorMessage?: string) {
  await supabase.rpc("runtime_complete_command", {
    _token: WORKER_TOKEN_VALUE,
    _command_id: id,
    _status: ok ? "done" : "failed",
    _error: errorMessage ?? null,
  });
}

async function processCommand(cmd: Cmd) {
  console.log(`[${cmd.bot_id}] processing ${cmd.action}`);
  const runtime = getRuntime(cmd.bot_id);
  try {
    switch (cmd.action) {
      case "start":
        await runtime.start();
        break;
      case "stop":
        await runtime.stop();
        break;
      case "restart":
        await runtime.restart();
        break;
      case "update":
        await runtime.restart();
        break;
    }
    await completeCommand(cmd.id, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${cmd.bot_id}] ${cmd.action} failed:`, msg);
    await completeCommand(cmd.id, false, msg);
  }
}

// ============================================================
// BUILD PIPELINE
// ============================================================

async function claimNextBuildJob(): Promise<BuildJob | null> {
  const { data, error } = await supabase.rpc("runtime_claim_build_job", {
    _token: WORKER_TOKEN_VALUE,
    _worker_id: WORKER_ID,
  });
  if (error) {
    console.error("build job claim error:", error.message);
    return null;
  }
  const result = data as { ok: boolean; job?: BuildJob | null; error?: string };
  if (!result?.ok) {
    if (result?.error) console.error("build job claim refused:", result.error);
    return null;
  }
  return result.job ?? null;
}

async function processBuildJob(job: BuildJob) {
  const { id, bot_order_id, selections } = job;
  console.log(`[build:${id}] Starting build for order ${bot_order_id}`);

  try {
    // 1. Validate that all requested addons exist
    const { ADDONS } = await import("./addons/index.js");
    const missingAddons: string[] = [];

    const baseAddonId = `${selections.base}-base`;
    if (!ADDONS[baseAddonId]) {
      console.warn(`[build:${id}] Base addon "${baseAddonId}" not found — proceeding anyway`);
    }

    for (const addonId of selections.addons ?? []) {
      if (!ADDONS[addonId]) {
        missingAddons.push(addonId);
        console.warn(`[build:${id}] Addon "${addonId}" not found in registry`);
      }
    }

    // 2. Claim a Discord bot token from the pool
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      "claim_bot_token_from_pool",
      { _bot_order_id: bot_order_id }
    );
    if (tokenError) throw new Error(`Token claim failed: ${tokenError.message}`);
    const tokenResult = tokenData as { ok: boolean; error?: string; client_id?: string; bot_username?: string };
    if (!tokenResult?.ok) throw new Error(tokenResult?.error ?? "No tokens available in pool");
    console.log(`[build:${id}] Token claimed — bot: ${tokenResult.bot_username}, client: ${tokenResult.client_id}`);

    // 3. Finalize: write order config + mark build ready (single RPC)
    const buildLog = `Build complete. Base: ${selections.base}. Addons: ${(selections.addons ?? []).join(", ") || "none"}. Missing: ${missingAddons.join(", ") || "none"}.`;
    const { data: finData, error: finError } = await supabase.rpc("runtime_finalize_build", {
      _token: WORKER_TOKEN_VALUE,
      _job_id: id,
      _bot_order_id: bot_order_id,
      _bot_name: selections.bot_name,
      _base: selections.base,
      _addons: selections.addons ?? [],
      _icon_url: selections.icon_url ?? null,
      _banner_url: selections.banner_url ?? null,
      _bot_description: selections.bot_description ?? null,
      _build_log: buildLog,
    });
    if (finError) throw new Error(`Failed to finalize build: ${finError.message}`);
    const finResult = finData as { ok: boolean; error?: string };
    if (!finResult?.ok) throw new Error(finResult?.error ?? "finalize_build refused");

    // 4. Seed bot_secret_slots so the dashboard knows what secrets to ask for
    await seedSecretSlots(bot_order_id, selections.base, selections.addons ?? []);

    // 5. Notify the customer
    await supabase.rpc("runtime_enqueue_notification", {
      _token: WORKER_TOKEN_VALUE,
      _bot_id: bot_order_id,
      _event_type: "command_finished",
      _title: "Your bot is ready!",
      _body: `${selections.bot_name} has been built and is ready to configure. Add your Discord bot token to get started.`,
      _context: null,
    }).catch(() => {});

    console.log(`[build:${id}] Build complete for order ${bot_order_id}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[build:${id}] Build failed:`, msg);

    await supabase.rpc("runtime_fail_build", {
      _token: WORKER_TOKEN_VALUE,
      _job_id: id,
      _bot_order_id: bot_order_id,
      _build_log: `Build failed: ${msg}`,
    }).catch(() => {});
  }
}

// ── Seed secret slots so dashboard knows what secrets each addon needs ──
async function seedSecretSlots(botOrderId: string, _base: string, addons: string[]) {
  const slots: { bot_id: string; key: string; label: string; description: string; placeholder: string; required: boolean; sort_order: number }[] = [];
  let order = 0;

  slots.push({
    bot_id: botOrderId,
    key: "DISCORD_TOKEN",
    label: "Discord Bot Token",
    description: "Your Discord bot token from the Developer Portal",
    placeholder: "MTxxxxxxx.Gxxxxx.xxxxxxxxxx",
    required: true,
    sort_order: order++,
  });

  if (addons.includes("music") || addons.includes("auto-radio")) {
    slots.push(
      {
        bot_id: botOrderId,
        key: "SPOTIFY_CLIENT_ID",
        label: "Spotify Client ID",
        description: "From your Spotify Developer Dashboard",
        placeholder: "your-spotify-client-id",
        required: false,
        sort_order: order++,
      },
      {
        bot_id: botOrderId,
        key: "SPOTIFY_CLIENT_SECRET",
        label: "Spotify Client Secret",
        description: "From your Spotify Developer Dashboard",
        placeholder: "your-spotify-client-secret",
        required: false,
        sort_order: order++,
      },
    );
  }

  if (addons.includes("roblox-verification")) {
    slots.push({
      bot_id: botOrderId,
      key: "ROBLOX_GROUP_ID",
      label: "Roblox Group ID",
      description: "The ID of your Roblox group",
      placeholder: "1234567",
      required: false,
      sort_order: order++,
    });
  }

  if (addons.includes("avatar-nsfw-detection")) {
    slots.push({
      bot_id: botOrderId,
      key: "ANTHROPIC_API_KEY",
      label: "Anthropic API Key",
      description: "Required for avatar NSFW detection",
      placeholder: "sk-ant-xxxxx",
      required: true,
      sort_order: order++,
    });
  }

  if (slots.length === 0) return;

  const { error } = await supabase.rpc("runtime_seed_secret_slots", {
    _token: WORKER_TOKEN_VALUE,
    _slots: slots as any,
  });

  if (error) {
    console.error(`[seed slots] Failed to seed secret slots: ${error.message}`);
  }
}

// ============================================================
// POLL LOOP
// ============================================================

async function pollLoop() {
  console.log(`Worker ${WORKER_ID} polling every ${POLL_INTERVAL_MS}ms…`);

  while (true) {
    try {
      health.lastPollAt = Date.now();

      const cmd = await claimNextCommand();
      if (cmd) {
        processCommand(cmd).catch(() => {});
      }

      const buildJob = await claimNextBuildJob();
      if (buildJob) {
        processBuildJob(buildJob).catch(() => {});
      }
    } catch (err) {
      console.error("poll loop error:", err);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ============================================================
// SHUTDOWN
// ============================================================

async function shutdown() {
  console.log("\nShutting down — stopping all running bots…");
  await Promise.allSettled([...runtimes.values()].map((r) => r.stop()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

pollLoop().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
