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

type CachedRoleRow = BotRole & { fetched_at: string };

// Shared across every mount asking for the same bot and guild, the same way
// useBotChannels shares its work: one cache read in flight, the last result
// kept for the next mount, and one Discord sync per bot+guild per page load.
const roleRowsCache = new Map<string, CachedRoleRow[]>();
const roleReadInflight = new Map<string, Promise<CachedRoleRow[]>>();
const roleReadQueued = new Map<string, Promise<CachedRoleRow[]>>();
const roleSyncInflight = new Map<string, Promise<{ ok: boolean; error?: string }>>();
const roleAutoSynced = new Set<string>();

function readRoleRows(botId: string, guildId: string, force = false): Promise<CachedRoleRow[]> {
  const key = `${botId}:${guildId}`;
  const pending = roleReadInflight.get(key);
  if (pending && !force) return pending;
  if (pending && force) {
    const queued = roleReadQueued.get(key);
    if (queued) return queued;
    const next = pending.then(() => readRoleRows(botId, guildId, false), () => readRoleRows(botId, guildId, false));
    roleReadQueued.set(key, next);
    next.finally(() => {
      if (roleReadQueued.get(key) === next) roleReadQueued.delete(key);
    });
    return next;
  }
  const p = (async () => {
    const { data } = await supabase
      .from("bot_role_cache" as any)
      .select("role_id, role_name, color, position, managed, is_everyone, fetched_at")
      .eq("bot_id", botId)
      .eq("guild_id", guildId)
      .order("position", { ascending: false });
    const rows = ((data ?? []) as any[]) as CachedRoleRow[];
    roleRowsCache.set(key, rows);
    return rows;
  })();
  roleReadInflight.set(key, p);
  p.finally(() => {
    if (roleReadInflight.get(key) === p) roleReadInflight.delete(key);
  });
  return p;
}

function syncRolesFromDiscord(botId: string, guildId: string): Promise<{ ok: boolean; error?: string }> {
  const key = `${botId}:${guildId}`;
  const pending = roleSyncInflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    // Fetch directly from Discord using the bot's DISCORD_TOKEN so this
    // works for every bot type (worker-managed or Railway-deployed).
    const { data, error } = await supabase.functions.invoke("bot-list-roles", {
      body: { bot_id: botId, guild_id: guildId },
    });
    if (error) return { ok: false, error: error.message };
    const result = (data ?? {}) as { ok?: boolean; error?: string };
    if (!result.ok) return { ok: false, error: result.error ?? "request_failed" };
    return { ok: true };
  })();
  roleSyncInflight.set(key, p);
  p.finally(() => {
    if (roleSyncInflight.get(key) === p) roleSyncInflight.delete(key);
  });
  return p;
}

/**
 * Lists cached roles for a guild + can ask the worker to refresh from Discord.
 * Mirrors the behavior of useBotChannels.
 */
export function useBotRoles(botId: string | undefined, guildId: string | undefined) {
  const cacheKey = botId && guildId ? `${botId}:${guildId}` : null;
  const seeded = cacheKey ? roleRowsCache.get(cacheKey) : undefined;
  const [roles, setRoles] = useState<BotRole[]>(seeded ?? []);
  const [loading, setLoading] = useState(!seeded);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(seeded?.[0]?.fetched_at ?? null);
  const hasRolesRef = useRef((seeded?.length ?? 0) > 0);

  const readCache = useCallback(async (force = false) => {
    if (!botId || !guildId) {
      setRoles([]);
      hasRolesRef.current = false;
      setLastFetchedAt(null);
      setLoading(false);
      return;
    }
    const known = roleRowsCache.get(`${botId}:${guildId}`);
    if (known) {
      hasRolesRef.current = known.length > 0;
      setRoles(known);
      setLastFetchedAt(known[0]?.fetched_at ?? null);
    }
    setLoading((wasLoading) => (hasRolesRef.current ? wasLoading : true));
    const rows = await readRoleRows(botId, guildId, force);
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
          if (row?.guild_id === guildId) readCache(true);
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
      const result = await syncRolesFromDiscord(botId, guildId);
      await readCache(true);
      return result;
    } finally {
      setRefreshing(false);
    }
  }, [botId, guildId, readCache]);

  // Auto-sync once per bot+guild per page load, shared across every mount.
  const refreshRef = useRef(refreshFromDiscord);
  useEffect(() => {
    refreshRef.current = refreshFromDiscord;
  }, [refreshFromDiscord]);
  useEffect(() => {
    if (!botId || !guildId) return;
    const key = `${botId}:${guildId}`;
    if (roleAutoSynced.has(key)) return;
    roleAutoSynced.add(key);
    void refreshRef.current?.();
  }, [botId, guildId]);

  return { roles, loading, refreshing, lastFetchedAt, refreshFromDiscord, readCache };
}
