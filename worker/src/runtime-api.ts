import { supabase, WORKER_ID } from "./supabase.js";

export type BotStatus =
  | "online"
  | "offline"
  | "starting"
  | "stopping"
  | "crashed"
  | "updating"
  | "suspended";

export async function setStatus(
  botId: string,
  status: BotStatus,
  opts: { lastError?: string; version?: string } = {},
) {
  const { error } = await supabase.rpc("runtime_set_bot_status", {
    _bot_id: botId,
    _status: status,
    _last_error: opts.lastError ?? null,
    _worker_id: WORKER_ID,
    _version: opts.version ?? null,
    _details: null,
  });
  if (error) console.error(`[${botId}] setStatus(${status}) failed:`, error.message);
}

export async function appendLog(
  botId: string,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
) {
  const { error } = await supabase.rpc("runtime_append_bot_log", {
    _bot_id: botId,
    _level: level,
    _message: message,
    _context: (context as any) ?? null,
  });
  if (error) console.error(`[${botId}] appendLog failed:`, error.message);
}

export async function recordMetrics(
  botId: string,
  deltas: {
    commands?: number;
    messages?: number;
    errors?: number;
    activeServers?: number;
    memberCount?: number;
  },
) {
  const { error } = await supabase.rpc("runtime_record_bot_metrics", {
    _bot_id: botId,
    _commands_delta: deltas.commands ?? 0,
    _messages_delta: deltas.messages ?? 0,
    _errors_delta: deltas.errors ?? 0,
    _active_servers: deltas.activeServers ?? null,
    _member_count: deltas.memberCount ?? null,
  });
  if (error) console.error(`[${botId}] recordMetrics failed:`, error.message);
}

export async function getSecret(botId: string, key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("runtime_get_bot_secret", {
    _bot_id: botId,
    _key: key,
  });
  if (error) {
    console.error(`[${botId}] getSecret(${key}) failed:`, error.message);
    return null;
  }
  return (data as string) ?? null;
}
