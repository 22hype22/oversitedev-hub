import { supabase, WORKER_ID, WORKER_TOKEN_VALUE } from "./supabase.js";

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
    _token: WORKER_TOKEN_VALUE,
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
    _token: WORKER_TOKEN_VALUE,
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
    _token: WORKER_TOKEN_VALUE,
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
    _token: WORKER_TOKEN_VALUE,
    _bot_id: botId,
    _key: key,
  });
  if (error) {
    console.error(`[${botId}] getSecret(${key}) failed:`, error.message);
    return null;
  }
  return (data as string) ?? null;
}

export async function upsertGuild(
  botId: string,
  guildId: string,
  guildName?: string,
  memberCount?: number,
): Promise<{ allowed: boolean; limit?: number; current?: number }> {
  const { data, error } = await supabase.rpc("runtime_upsert_bot_guild", {
    _token: WORKER_TOKEN_VALUE,
    _bot_id: botId,
    _guild_id: guildId,
    _guild_name: guildName ?? null,
    _member_count: memberCount ?? null,
  });
  if (error) {
    console.error(`[${botId}] upsertGuild failed:`, error.message);
    return { allowed: true };
  }
  const r = data as { allowed?: boolean; limit?: number; current?: number };
  return { allowed: r?.allowed ?? true, limit: r?.limit, current: r?.current };
}

export async function removeGuild(botId: string, guildId: string) {
  const { error } = await supabase.rpc("runtime_remove_bot_guild", {
    _token: WORKER_TOKEN_VALUE,
    _bot_id: botId,
    _guild_id: guildId,
  });
  if (error) console.error(`[${botId}] removeGuild failed:`, error.message);
}

export type ChannelCacheEntry = {
  channel_id: string;
  channel_name: string;
  channel_type: string;
  parent_id: string | null;
  parent_name: string | null;
  position: number;
};

export async function upsertChannels(
  botId: string,
  guildId: string,
  channels: ChannelCacheEntry[],
) {
  const { error } = await supabase.rpc("runtime_upsert_bot_channels", {
    _token: WORKER_TOKEN_VALUE,
    _bot_id: botId,
    _guild_id: guildId,
    _channels: channels as any,
  });
  if (error) console.error(`[${botId}] upsertChannels failed:`, error.message);
}

/**
 * Replace the cached guild list for a bot — adds new guilds and removes
 * ones the bot has left. Called when the dashboard requests a refresh.
 */
export async function replaceGuilds(
  botId: string,
  guilds: { guild_id: string; guild_name?: string | null; member_count?: number | null }[],
) {
  const { error } = await supabase.rpc("runtime_replace_bot_guilds", {
    _token: WORKER_TOKEN_VALUE,
    _bot_id: botId,
    _guilds: guilds as any,
  });
  if (error) console.error(`[${botId}] replaceGuilds failed:`, error.message);
}
