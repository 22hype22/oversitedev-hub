import { supabase, WORKER_ID, POLL_INTERVAL_MS } from "./supabase.js";
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
  // Atomically claim one pending command for this worker.
  // Uses a CTE-style update so two workers don't race for the same row.
  const { data, error } = await supabase
    .from("bot_commands")
    .update({
      status: "claimed",
      worker_id: WORKER_ID,
      claimed_at: new Date().toISOString(),
    })
    .eq("status", "pending")
    .is("worker_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .select("id, bot_id, action")
    .maybeSingle();

  if (error) {
    console.error("claim error:", error.message);
    return null;
  }
  return (data as Cmd) ?? null;
}

async function completeCommand(id: string, ok: boolean, errorMessage?: string) {
  await supabase
    .from("bot_commands")
    .update({
      status: ok ? "done" : "failed",
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
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
