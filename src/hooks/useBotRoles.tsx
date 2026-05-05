import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BotRole {
  role_id: string;
  role_name: string;
  color: number;
  position: number;
  managed: boolean;
  is_everyone: boolean;
}

/**
 * Lists cached roles for a guild + can ask the worker to refresh from Discord.
 * Mirrors the behavior of useBotChannels.
 */
export function useBotRoles(botId: string | undefined, guildId: string | undefined) {
  const [roles, setRoles] = useState<BotRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const hasRolesRef = useRef(false);

  const readCache = useCallback(async () => {
    if (!botId || !guildId) {
      setRoles([]);
      hasRolesRef.current = false;
      setLastFetchedAt(null);
      setLoading(false);
      return;
    }
    setLoading((wasLoading) => (hasRolesRef.current ? wasLoading : true));
    const { data } = await supabase
      .from("bot_role_cache" as any)
      .select("role_id, role_name, color, position, managed, is_everyone, fetched_at")
      .eq("bot_id", botId)
      .eq("guild_id", guildId)
      .order("position", { ascending: false });
    const rows = ((data ?? []) as any[]) as (BotRole & { fetched_at: string })[];
    hasRolesRef.current = rows.length > 0;
    setRoles(rows);
    setLastFetchedAt(rows[0]?.fetched_at ?? null);
    setLoading(false);
  }, [botId, guildId]);

  useEffect(() => {
    readCache();
  }, [readCache]);

  // Realtime updates
  useEffect(() => {
    if (!botId || !guildId) return;
    const channel = supabase
      .channel(`bot_role_cache:${botId}:${guildId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_role_cache", filter: `bot_id=eq.${botId}` },
        (payload) => {
          const row = (payload.new as { guild_id?: string } | null) ?? (payload.old as { guild_id?: string } | null);
          if (row?.guild_id === guildId) readCache();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId, guildId, readCache]);

  const refreshFromDiscord = useCallback(async () => {
    if (!botId || !guildId) return { ok: false, error: "no_guild" };
    setRefreshing(true);
    try {
      const { data, error } = await supabase.rpc("request_list_roles" as any, {
        _bot_id: botId,
        _guild_id: guildId,
      });
      if (error) return { ok: false, error: error.message };
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) return { ok: false, error: result?.error ?? "request_failed" };

      const before = lastFetchedAt;
      for (let i = 0; i < 32; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const { data: row } = await supabase
          .from("bot_role_cache" as any)
          .select("fetched_at")
          .eq("bot_id", botId)
          .eq("guild_id", guildId)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const fetchedAt = (row as any)?.fetched_at as string | undefined;
        if (fetchedAt && fetchedAt !== before) {
          await readCache();
          return { ok: true };
        }
      }
      await readCache();
      return { ok: false, error: "timeout" };
    } finally {
      setRefreshing(false);
    }
  }, [botId, guildId, lastFetchedAt, readCache]);

  // Auto-sync once per bot+guild per session
  const refreshRef = useRef(refreshFromDiscord);
  useEffect(() => {
    refreshRef.current = refreshFromDiscord;
  }, [refreshFromDiscord]);
  const autoSyncedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!botId || !guildId) return;
    const key = `${botId}:${guildId}`;
    if (autoSyncedRef.current.has(key)) return;
    autoSyncedRef.current.add(key);
    void refreshRef.current?.();
  }, [botId, guildId]);

  return { roles, loading, refreshing, lastFetchedAt, refreshFromDiscord, readCache };
}
