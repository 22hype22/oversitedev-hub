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
  const { data, error } = await supabase
    .from("bot_build_jobs")
    .select("id, bot_order_id, status, selections")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("build job claim error:", error.message);
    return null;
  }
  if (!data) return null;

  // Claim it
  const { error: claimError } = await supabase
    .from("bot_build_jobs")
    .update({
      status: "building",
      worker_id: WORKER_ID,
      claimed_at: new Date().toISOString(),
      attempts: supabase.rpc("coalesce_increment", { row_id: data.id }) as any,
    })
    .eq("id", data.id)
    .eq("status", "pending");

  if (claimError) return null;
  return data as BuildJob;
}

async function processBuildJob(job: BuildJob) {
  const { id, bot_order_id, selections } = job;
  console.log(`[build:${id}] Starting build for order ${bot_order_id}`);

  try {
    // 1. Validate that all requested addons exist
    const { ADDONS } = await import("./addons/index.js");
    const missingAddons: string[] = [];

    // Check base
    const baseAddonId = `${selections.base}-base`;
    if (!ADDONS[baseAddonId]) {
      console.warn(`[build:${id}] Base addon "${baseAddonId}" not found — proceeding anyway`);
    }

    // Check addons
    for (const addonId of selections.addons ?? []) {
      if (!ADDONS[addonId]) {
        missingAddons.push(addonId);
        console.warn(`[build:${id}] Addon "${addonId}" not found in registry`);
      }
    }

    // 2. Write config to bot_orders so the runtime can pick it up
    const { error: orderError } = await supabase
      .from("bot_orders")
      .update({
        bot_name: selections.bot_name,
        base: selections.base,
        addons: selections.addons ?? [],
        icon_url: selections.icon_url ?? null,
        banner_url: selections.banner_url ?? null,
        bot_description: selections.bot_description ?? null,
        status: "ready",
      })
      .eq("id", bot_order_id);

    if (orderError) throw new Error(`Failed to update bot_orders: ${orderError.message}`);

    // 3. Seed bot_secret_slots so the dashboard knows what secrets to ask for
    await seedSecretSlots(bot_order_id, selections.base, selections.addons ?? []);

    // 4. Mark build as ready
    const { error: buildError } = await supabase
      .from("bot_build_jobs")
      .update({
        status: "ready",
        build_log: `Build complete. Base: ${selections.base}. Addons: ${(selections.addons ?? []).join(", ") || "none"}. Missing: ${missingAddons.join(", ") || "none"}.`,
      })
      .eq("id", id);

    if (buildError) throw new Error(`Failed to update build job: ${buildError.message}`);

    // 5. Enqueue a bot_notification for the customer
    await supabase.from("bot_notifications").insert({
      bot_id: bot_order_id,
      event_type: "command_finished",
      title: "Your bot is ready!",
      body: `${selections.bot_name} has been built and is ready to configure. Add your Discord bot token to get started.`,
    }).catch(() => {});

    console.log(`[build:${id}] Build complete for order ${bot_order_id}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[build:${id}] Build failed:`, msg);

    await supabase
      .from("bot_build_jobs")
      .update({
        status: "failed",
        build_log: `Build failed: ${msg}`,
      })
      .eq("id", id);

    await supabase
      .from("bot_orders")
      .update({ status: "build_failed" })
      .eq("id", bot_order_id);
  }
}

// ── Seed secret slots so dashboard knows what secrets each addon needs ──
async function seedSecretSlots(botOrderId: string, base: string, addons: string[]) {
  const slots: { bot_id: string; key: string; label: string; description: string; placeholder: string; required: boolean; sort_order: number }[] = [];
  let order = 0;

  // Always required: Discord bot token
  slots.push({
    bot_id: botOrderId,
    key: "DISCORD_TOKEN",
    label: "Discord Bot Token",
    description: "Your Discord bot token from the Developer Portal",
    placeholder: "MTxxxxxxx.Gxxxxx.xxxxxxxxxx",
    required: true,
    sort_order: order++,
  });

  // Music addon needs Spotify credentials
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

  // Roblox verification needs group ID
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

  // Avatar NSFW detection needs Anthropic API key
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

  // Upsert slots (don't duplicate if already exists)
  const { error } = await supabase
    .from("bot_secret_slots")
    .upsert(slots, { onConflict: "bot_id,key", ignoreDuplicates: true });

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
