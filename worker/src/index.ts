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
  order_id: string;
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

  const result = data as { ok: boolean; job?: BuildJob; error?: string };
  if (!result?.ok || !result.job) return null;
  return result.job;
}

// Addons that are website-only features (e.g. hosted dashboard access) and
// have no Discord runtime behavior. They live in `bot_orders.addons` for
// purchase/ownership purposes, but the worker should never try to load them
// as bot addons.
const WEBSITE_ONLY_ADDONS = new Set<string>(["dashboard"]);

async function processBuildJob(job: BuildJob) {
  const { id, order_id, selections } = job;
  console.log(`[build:${id}] Starting build for order ${order_id}`);

  try {
    // 1. Split requested addons into runtime addons (loaded by the bot) vs
    //    website-only addons (skipped silently). Validate the runtime ones
    //    against the registry; unknown ones are just ignored — the bot will
    //    still boot fine without them.
    const { ADDONS } = await import("./addons/index.js");
    const requestedAddons = selections.addons ?? [];
    const runtimeAddons = requestedAddons.filter(
      (a) => !WEBSITE_ONLY_ADDONS.has(a),
    );
    const skippedWebsiteAddons = requestedAddons.filter((a) =>
      WEBSITE_ONLY_ADDONS.has(a),
    );
    const missingAddons = runtimeAddons.filter((a) => !ADDONS[a]);

    // Check base
    const baseAddonId = `${selections.base}-base`;
    if (!ADDONS[baseAddonId]) {
      console.log(`[build:${id}] Base addon "${baseAddonId}" not in registry — skipping`);
    }
    if (skippedWebsiteAddons.length > 0) {
      console.log(`[build:${id}] Skipping website-only addons: ${skippedWebsiteAddons.join(", ")}`);
    }
    if (missingAddons.length > 0) {
      console.log(`[build:${id}] Unknown addons (ignored): ${missingAddons.join(", ")}`);
    }

    // 2. Claim a Discord bot token from the pool
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      "claim_bot_token_from_pool",
      { _order_id: order_id }
    );
    if (tokenError) throw new Error(`Token claim failed: ${tokenError.message}`);
    const tokenResult = tokenData as { ok: boolean; error?: string; client_id?: string; bot_username?: string };
    if (!tokenResult?.ok) throw new Error(tokenResult?.error ?? "No tokens available in pool");
    console.log(`[build:${id}] Token claimed — bot: ${tokenResult.bot_username}, client: ${tokenResult.client_id}`);

    // 3. Seed bot_secret_slots so the dashboard knows what secrets to ask for
    //    (runtime addons only — website-only addons don't need bot secrets)
    await seedSecretSlots(order_id, selections.base, runtimeAddons);

    // 4. Finalize through the runtime RPC so bot_orders.status flips to ready.
    //    We persist the full addons list (including website-only ones like
    //    "dashboard") so the dashboard's ownership detection still works.
    const buildLog = `Build complete. Base: ${selections.base}. Runtime addons: ${runtimeAddons.join(", ") || "none"}. Website-only: ${skippedWebsiteAddons.join(", ") || "none"}. Unknown (ignored): ${missingAddons.join(", ") || "none"}.`;
    const { data: finalizeData, error: finalizeError } = await supabase.rpc("runtime_finalize_build", {
      _token: WORKER_TOKEN_VALUE,
      _job_id: id,
      _bot_order_id: order_id,
      _bot_name: selections.bot_name,
      _base: selections.base,
      _addons: selections.addons ?? [],
      _icon_url: selections.icon_url ?? null,
      _banner_url: selections.banner_url ?? null,
      _bot_description: selections.bot_description ?? null,
      _build_log: buildLog,
    });

    if (finalizeError) throw new Error(`Failed to finalize build: ${finalizeError.message}`);
    const finalizeResult = finalizeData as { ok?: boolean; error?: string } | null;
    if (!finalizeResult?.ok) throw new Error(finalizeResult?.error ?? "Failed to finalize build");

    // 5. Enqueue a bot_notification for the customer
    await supabase.rpc("runtime_enqueue_notification", {
      _token: WORKER_TOKEN_VALUE,
      _bot_id: order_id,
      _event_type: "command_finished",
      _title: "Your bot is ready!",
      _body: `${selections.bot_name} has been built and is ready to configure. Add your Discord bot token to get started.`,
    });

    console.log(`[build:${id}] Build complete for order ${order_id}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[build:${id}] Build failed:`, msg);

    await supabase.rpc("runtime_fail_build", {
      _token: WORKER_TOKEN_VALUE,
      _job_id: id,
      _bot_order_id: order_id,
      _build_log: `Build failed: ${msg}`,
    });
  }
}

// ── Seed secret slots so dashboard knows what secrets each addon needs ──
// NOTE: `bot_secret_slots` is a GLOBAL catalog keyed by (addon_id, key) — it
// describes what secrets each addon needs, not per-bot values. Per-bot values
// live in `bot_secrets` (bot_id, user_id, key, value_encrypted).
async function seedSecretSlots(_botOrderId: string, _base: string, addons: string[]) {
  type Slot = {
    addon_id: string;
    key: string;
    label: string;
    description: string;
    placeholder: string;
    is_required: boolean;
    sort_order: number;
  };
  const slots: Slot[] = [];
  let order = 0;

  // Always required: Discord bot token (core slot, not tied to an addon)
  slots.push({
    addon_id: "core",
    key: "DISCORD_TOKEN",
    label: "Discord Bot Token",
    description: "Your Discord bot token from the Developer Portal",
    placeholder: "MTxxxxxxx.Gxxxxx.xxxxxxxxxx",
    is_required: true,
    sort_order: order++,
  });

  // Music addon needs Spotify credentials
  if (addons.includes("music") || addons.includes("auto-radio")) {
    slots.push(
      {
        addon_id: "music",
        key: "SPOTIFY_CLIENT_ID",
        label: "Spotify Client ID",
        description: "From your Spotify Developer Dashboard",
        placeholder: "your-spotify-client-id",
        is_required: false,
        sort_order: order++,
      },
      {
        addon_id: "music",
        key: "SPOTIFY_CLIENT_SECRET",
        label: "Spotify Client Secret",
        description: "From your Spotify Developer Dashboard",
        placeholder: "your-spotify-client-secret",
        is_required: false,
        sort_order: order++,
      },
    );
  }

  // Roblox verification needs group ID
  if (addons.includes("roblox-verification")) {
    slots.push({
      addon_id: "roblox-verification",
      key: "ROBLOX_GROUP_ID",
      label: "Roblox Group ID",
      description: "The ID of your Roblox group",
      placeholder: "1234567",
      is_required: false,
      sort_order: order++,
    });
  }

  // Avatar NSFW detection needs Anthropic API key
  if (addons.includes("avatar-nsfw-detection")) {
    slots.push({
      addon_id: "avatar-nsfw-detection",
      key: "ANTHROPIC_API_KEY",
      label: "Anthropic API Key",
      description: "Required for avatar NSFW detection",
      placeholder: "sk-ant-xxxxx",
      is_required: true,
      sort_order: order++,
    });
  }

  if (slots.length === 0) return;

  // Upsert global slot catalog through the runtime RPC (token-gated, RLS-safe).
  const { error } = await supabase.rpc("runtime_seed_secret_slots", {
    _token: WORKER_TOKEN_VALUE,
    _slots: slots,
  });

  if (error) {
    console.error(`[seed slots] Failed to seed secret slots: ${error.message}`);
  }
}

// ── Apply bot name/avatar/status on startup ──
async function applyBotIdentity(botOrderId: string) {
  try {
    const { data } = await supabase
      .from("bot_orders")
      .select("bot_name, icon_url, bot_description")
      .eq("id", botOrderId)
      .maybeSingle();

    if (!data) return;
    const runtime = runtimes.get(botOrderId);
    if (!runtime) return;

    // The runtime's discord client handles identity via its own startup
    // This is a hook point for future direct API calls if needed
    console.log(`[${botOrderId}] Identity: ${data.bot_name}`);
  } catch { /* ignore */ }
}

// ============================================================
// POLL LOOP
// ============================================================

async function pollLoop() {
  console.log(`Worker ${WORKER_ID} polling every ${POLL_INTERVAL_MS}ms…`);

  while (true) {
    try {
      health.lastPollAt = Date.now();

      // 1. Check for bot commands (start/stop/restart/update)
      const cmd = await claimNextCommand();
      if (cmd) {
        processCommand(cmd).catch(() => {});
      }

      // 2. Check for pending build jobs
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
