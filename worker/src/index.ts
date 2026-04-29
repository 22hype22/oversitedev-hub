import {
  supabase,
  WORKER_ID,
  WORKER_TOKEN_VALUE,
  POLL_INTERVAL_MS,
} from "./supabase.js";
import { BotRuntime } from "./runtime.js";

const runtimes = new Map<string, BotRuntime>();

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
        // Hook your update / redeploy logic here. For now: restart.
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

async function pollLoop() {
  console.log(`Worker ${WORKER_ID} polling every ${POLL_INTERVAL_MS}ms…`);
  while (true) {
    try {
      const cmd = await claimNextCommand();
      if (cmd) {
        // Don't await — let multiple commands run in parallel.
        processCommand(cmd).catch(() => {});
      }
    } catch (err) {
      console.error("poll loop error:", err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

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
