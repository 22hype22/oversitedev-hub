import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BotGuild {
  guild_id: string;
  guild_name: string | null;
  member_count: number | null;
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
      const aVoice = a.channel_type === "voice" ? 1 : 0;
      const bVoice = b.channel_type === "voice" ? 1 : 0;
      if (aVoice !== bVoice) return aVoice - bVoice;
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

/** Lists guilds the bot is currently in (from bot_active_guilds). */
export function useBotGuilds(botId: string | undefined) {
  const [guilds, setGuilds] = useState<BotGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!botId) {
      setGuilds([]);
      setLoading(false);
      return;
    }
    setLoading((wasLoading) => (guilds.length === 0 ? true : wasLoading));
    const { data } = await supabase
      .from("bot_active_guilds")
      .select("guild_id, guild_name, member_count")
      .eq("bot_id", botId)
      .order("guild_name", { ascending: true });
    setGuilds((data ?? []) as BotGuild[]);
    setLoading(false);
  }, [botId, guilds.length]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Ask the worker to re-fetch the guild list from Discord. Polls the
   * bot_active_guilds table quickly (250ms intervals, ~6s max) until the
   * row contents change.
   */
  const refreshFromDiscord = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!botId) return { ok: false, error: "no_bot" };
    setRefreshing(true);
    try {
      const before = JSON.stringify(
        [...guilds].map((g) => g.guild_id).sort(),
      );
      const { data, error } = await supabase.rpc("request_list_guilds", {
        _bot_id: botId,
      });
      if (error) return { ok: false, error: error.message };
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) return { ok: false, error: result?.error ?? "request_failed" };

      // Poll up to 24x (every 250ms = ~6s) for the cache to change.
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const { data: rows } = await supabase
          .from("bot_active_guilds")
          .select("guild_id, guild_name, member_count")
          .eq("bot_id", botId)
          .order("guild_name", { ascending: true });
        const next = JSON.stringify(
          ((rows ?? []) as BotGuild[]).map((g) => g.guild_id).sort(),
        );
        if (next !== before) {
          setGuilds((rows ?? []) as BotGuild[]);
          return { ok: true };
        }
      }
      await refresh();
      return { ok: false, error: "timeout" };
    } finally {
      setRefreshing(false);
    }
  }, [botId, guilds, refresh]);

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

  const readCache = useCallback(async () => {
    if (!botId || !guildId) {
      setChannels([]);
      setLastFetchedAt(null);
      setLoading(false);
      return;
    }
    setLoading((wasLoading) => (channels.length === 0 ? true : wasLoading));
    const { data } = await supabase
      .from("bot_channel_cache")
      .select("channel_id, channel_name, channel_type, parent_id, parent_name, position, parent_position, fetched_at")
      .eq("bot_id", botId)
      .eq("guild_id", guildId)
      .order("parent_position", { ascending: true })
      .order("position", { ascending: true });
    const rows = (data ?? []) as (BotChannel & { fetched_at: string })[];
    setChannels(rows);
    setLastFetchedAt(rows[0]?.fetched_at ?? null);
    setLoading(false);
  }, [botId, guildId, channels.length]);

  // Initial load + when guild changes
  useEffect(() => {
    readCache();
  }, [readCache]);

  // (No focus listener — switching tabs should not refresh and reset
  // the user's in-progress configuration. Realtime subscription below
  // handles live updates from the worker.)

  // Live updates: re-read whenever the worker writes channel rows for
  // this bot+guild (channel created/renamed/deleted on Discord).
  useEffect(() => {
    if (!botId || !guildId) return;
    const channel = supabase
      .channel(`bot_channel_cache:${botId}:${guildId}`)
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
      const { data, error } = await supabase.rpc("request_list_channels", {
        _bot_id: botId,
        _guild_id: guildId,
      });
      if (error) return { ok: false, error: error.message };
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) return { ok: false, error: result?.error ?? "request_failed" };

      // Poll the cache up to 32 times (every 250ms = ~8s) waiting for fetched_at to bump.
      const before = lastFetchedAt;
      for (let i = 0; i < 32; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const { data: row } = await supabase
          .from("bot_channel_cache")
          .select("fetched_at")
          .eq("bot_id", botId)
          .eq("guild_id", guildId)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (row?.fetched_at && row.fetched_at !== before) {
          await readCache();
          return { ok: true };
        }
      }
      // Timed out — still re-read in case the worker did update.
      await readCache();
      return { ok: false, error: "timeout" };
    } finally {
      setRefreshing(false);
    }
  }, [botId, guildId, lastFetchedAt, readCache]);

  return { channels, loading, refreshing, lastFetchedAt, refreshFromDiscord, readCache };
}
