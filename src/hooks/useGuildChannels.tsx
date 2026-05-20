import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BotGuild {
  guild_id: string;
  guild_name: string | null;
  member_count: number | null;
}

function normalizeRuntimeGuilds(value: unknown): BotGuild[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const guild = entry as {
        id?: unknown;
        name?: unknown;
        guild_id?: unknown;
        guild_name?: unknown;
        member_count?: unknown;
      };
      const id = typeof guild.id === "string" ? guild.id : typeof guild.guild_id === "string" ? guild.guild_id : null;
      if (!id) return null;
      const name = typeof guild.name === "string" ? guild.name : typeof guild.guild_name === "string" ? guild.guild_name : null;
      return {
        guild_id: id,
        guild_name: name,
        member_count: typeof guild.member_count === "number" ? guild.member_count : null,
      } satisfies BotGuild;
    })
    .filter((guild): guild is BotGuild => guild !== null)
    .sort((a, b) => (a.guild_name ?? a.guild_id).localeCompare(b.guild_name ?? b.guild_id));
}

export interface BotChannel {
  channel_id: string;
  channel_name: string;
  channel_type: string;
  parent_id: string | null;
  parent_name: string | null;
  position: number;
  parent_position: number;
}

export type ChannelCategoryEntry = {
  key: string;
  label: string;
  channels: BotChannel[];
};

export function sortedChannelCategoryEntries(channels: BotChannel[]): ChannelCategoryEntry[] {
  const groups = new Map<string, ChannelCategoryEntry & { firstIndex: number; sortPosition: number }>();

  channels.forEach((channel, index) => {
    const label = channel.parent_name?.trim() || "Uncategorized";
    const key = channel.parent_id ?? `uncategorized:${label}`;
    const cachedParentPosition = Number.isFinite(channel.parent_position) ? channel.parent_position : -1;
    const sortPosition = cachedParentPosition >= 0 ? cachedParentPosition : label === "Uncategorized" ? -1 : index;
    const group = groups.get(key);

    if (group) {
      group.channels.push(channel);
      if (cachedParentPosition >= 0 && group.sortPosition !== cachedParentPosition) {
        group.sortPosition = cachedParentPosition;
      }
      return;
    }

    groups.set(key, {
      key,
      label,
      channels: [channel],
      firstIndex: index,
      sortPosition,
    });
  });

  for (const group of groups.values()) {
    group.channels.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.channel_name.localeCompare(b.channel_name);
    });
  }

  return [...groups.values()]
    .sort((a, b) => {
      if (a.sortPosition !== b.sortPosition) return a.sortPosition - b.sortPosition;
      if (a.firstIndex !== b.firstIndex) return a.firstIndex - b.firstIndex;
      return a.label.localeCompare(b.label);
    })
    .map(({ key, label, channels }) => ({ key, label, channels }));
}

/** Lists guilds the bot is currently in from the live runtime heartbeat. */
export function useBotGuilds(botId: string | undefined) {
  const [guilds, setGuilds] = useState<BotGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasGuildsRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!botId) {
      setGuilds([]);
      hasGuildsRef.current = false;
      setLoading(false);
      return;
    }
    setLoading((wasLoading) => (hasGuildsRef.current ? wasLoading : true));
    const [{ data: statusRow }, { data: activeRows }] = await Promise.all([
      (supabase.from("bot_runtime_status") as any)
        .select("guilds")
        .eq("bot_id", botId)
        .maybeSingle(),
      supabase
        .from("bot_active_guilds")
        .select("guild_id, guild_name, member_count")
        .eq("bot_id", botId)
        .order("guild_name", { ascending: true }),
    ]);
    const runtimeGuilds = normalizeRuntimeGuilds((statusRow as { guilds?: unknown } | null)?.guilds);
    // Fall back to bot_active_guilds when heartbeat hasn't populated yet.
    const rows = runtimeGuilds.length > 0 ? runtimeGuilds : ((activeRows ?? []) as BotGuild[]);
    hasGuildsRef.current = rows.length > 0;
    setGuilds(rows);
    setLoading(false);
  }, [botId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-sync guilds from Discord once per bot per session so newly deployed
  // bots populate without requiring a manual refresh click.
  const autoSyncedGuildRef = useRef<Set<string>>(new Set());
  const refreshFromDiscordHolder = useRef<(() => Promise<{ ok: boolean; error?: string }>) | null>(null);

  /**
   * Ask the worker to re-fetch the guild list from Discord. Polls the
   * runtime heartbeat guild list quickly until the row contents change.
   */
  const refreshFromDiscord = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!botId) return { ok: false, error: "no_bot" };
    setRefreshing(true);
    try {
      // Fetch guilds directly via Discord REST using the bot's DISCORD_TOKEN.
      // Works for every bot type (worker-managed or Railway-deployed) since
      // it bypasses the worker command queue.
      const { data, error } = await supabase.functions.invoke("bot-list-guilds", {
        body: { bot_id: botId },
      });
      if (error) {
        await refresh();
        return { ok: false, error: error.message };
      }
      const result = (data ?? {}) as { ok?: boolean; error?: string };
      if (!result.ok) {
        await refresh();
        return { ok: false, error: result.error ?? "request_failed" };
      }
      await refresh();
      return { ok: true };
    } finally {
      setRefreshing(false);
    }
  }, [botId, refresh]);

  // Keep latest refreshFromDiscord in a ref so the auto-sync effect doesn't
  // need to re-run on every render.
  useEffect(() => {
    refreshFromDiscordHolder.current = refreshFromDiscord;
  }, [refreshFromDiscord]);

  // Auto-sync once per bot per session so freshly invited bots populate
  // their guild list without manual intervention.
  useEffect(() => {
    if (!botId) return;
    if (autoSyncedGuildRef.current.has(botId)) return;
    autoSyncedGuildRef.current.add(botId);
    void refreshFromDiscordHolder.current?.();
  }, [botId]);


  useEffect(() => {
    if (!botId) return;
    const channel = supabase
      .channel(`bot-runtime-guilds:${botId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_runtime_status", filter: `bot_id=eq.${botId}` },
        (payload) => {
          const rows = normalizeRuntimeGuilds((payload.new as { guilds?: unknown } | null)?.guilds);
          // Only overwrite the displayed list if heartbeat has guilds —
          // otherwise keep the bot_active_guilds fallback we loaded.
          if (rows.length > 0) {
            hasGuildsRef.current = true;
            setGuilds(rows);
            setLoading(false);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId]);

  return { guilds, loading, refresh, refreshing, refreshFromDiscord };
}

/**
 * Lists cached channels for a guild, with the ability to request a fresh
 * fetch from Discord (queues a worker command, then re-reads the cache
 * once the command completes — polling for up to ~10s).
 */
export function useBotChannels(botId: string | undefined, guildId: string | undefined) {
  const [channels, setChannels] = useState<BotChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const hasChannelsRef = useRef(false);

  const readCache = useCallback(async () => {
    if (!botId || !guildId) {
      setChannels([]);
      hasChannelsRef.current = false;
      setLastFetchedAt(null);
      setLoading(false);
      return;
    }
    setLoading((wasLoading) => (hasChannelsRef.current ? wasLoading : true));
    const { data } = await supabase
      .from("bot_channel_cache")
      .select("channel_id, channel_name, channel_type, parent_id, parent_name, position, parent_position, fetched_at")
      .eq("bot_id", botId)
      .eq("guild_id", guildId)
      .order("parent_position", { ascending: true })
      .order("position", { ascending: true });
    const rows = (data ?? []) as (BotChannel & { fetched_at: string })[];
    hasChannelsRef.current = rows.length > 0;
    setChannels(rows);
    setLastFetchedAt(rows[0]?.fetched_at ?? null);
    setLoading(false);
  }, [botId, guildId]);

  // Initial load + when guild changes
  useEffect(() => {
    readCache();
  }, [readCache]);

  // Live updates: re-read whenever the worker writes channel rows for
  // this bot+guild (channel created/renamed/deleted on Discord).
  useEffect(() => {
    if (!botId || !guildId) return;
    const channel = supabase
      .channel(`bot_channel_cache:${botId}:${guildId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bot_channel_cache",
          filter: `bot_id=eq.${botId}`,
        },
        (payload) => {
          const row =
            (payload.new as { guild_id?: string } | null) ??
            (payload.old as { guild_id?: string } | null);
          if (row?.guild_id === guildId) readCache();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId, guildId, readCache]);

  /**
   * Queues a list_channels command to the worker. Polls the cache for ~10s
   * waiting for the worker to update it.
   */
  const refreshFromDiscord = useCallback(async () => {
    if (!botId || !guildId) return { ok: false, error: "no_guild" };
    setRefreshing(true);
    try {
      // Call the bot-list-channels edge function, which fetches channels
      // directly from Discord using the bot's DISCORD_TOKEN and refreshes
      // bot_channel_cache. This bypasses the worker command queue so the
      // refresh works for every bot type (protection / support / utilities)
      // regardless of which orchestrator is online.
      const { data, error } = await supabase.functions.invoke("bot-list-channels", {
        body: { bot_id: botId, guild_id: guildId },
      });
      if (error) {
        await readCache();
        return { ok: false, error: error.message };
      }
      const result = (data ?? {}) as { ok?: boolean; error?: string };
      if (!result.ok) {
        await readCache();
        return { ok: false, error: result.error ?? "request_failed" };
      }
      await readCache();
      return { ok: true };
    } finally {
      setRefreshing(false);
    }
  }, [botId, guildId, readCache]);

  const refreshFromDiscordRef = useRef(refreshFromDiscord);
  useEffect(() => {
    refreshFromDiscordRef.current = refreshFromDiscord;
  }, [refreshFromDiscord]);

  // Auto-sync from Discord when guild changes so the displayed channels match
  // the live server order. Runs once per bot+guild per session to avoid
  // hammering the worker. Keep this after refreshFromDiscordRef is updated so
  // switching servers queues the refresh for the newly selected guild.
  const autoSyncedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!botId || !guildId) return;
    const key = `${botId}:${guildId}`;
    if (autoSyncedRef.current.has(key)) return;
    autoSyncedRef.current.add(key);
    // fire-and-forget; refreshFromDiscord polls the cache itself
    void refreshFromDiscordRef.current?.();
  }, [botId, guildId]);

  return { channels, loading, refreshing, lastFetchedAt, refreshFromDiscord, readCache };
}
