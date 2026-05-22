import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCached, peekCached, setCached } from "@/lib/swrCache";

/**
 * Loads the enabled/disabled state for every addon on a given bot.
 * Returns a map of addonId -> enabled (defaults to true when no row exists).
 * Uses an in-memory SWR cache so navigating back to the dashboard renders
 * instantly from cache while revalidating in the background.
 */
export function useBotAddonStates(botId?: string) {
  const cacheKey = botId ? `botAddonStates:${botId}` : null;
  const seed = cacheKey ? peekCached<Record<string, boolean>>(cacheKey) : undefined;
  const [states, setStates] = useState<Record<string, boolean>>(seed ?? {});
  const [loading, setLoading] = useState(!seed);

  const refresh = useCallback(async () => {
    if (!botId) {
      setStates({});
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("bot_addon_state")
      .select("addon_id, enabled")
      .eq("bot_id", botId);
    const map: Record<string, boolean> = {};
    for (const row of (data ?? []) as { addon_id: string; enabled: boolean }[]) {
      map[row.addon_id] = row.enabled;
    }
    setStates(map);
    if (cacheKey) setCached(cacheKey, map);
    setLoading(false);
  }, [botId, cacheKey]);

  useEffect(() => {
    // SWR: skip refetch on mount if cache is fresh (<30s).
    if (cacheKey && getCached(cacheKey)) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh, cacheKey]);

  // Realtime: react to other tabs / the worker flipping a switch.
  useEffect(() => {
    if (!botId) return;
    const channel = supabase
      .channel(`bot_addon_state:${botId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bot_addon_state",
          filter: `bot_id=eq.${botId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [botId, refresh]);

  const setEnabled = useCallback(
    async (addonId: string, enabled: boolean) => {
      if (!botId) return;
      setStates((prev) => {
        const next = { ...prev, [addonId]: enabled };
        if (cacheKey) setCached(cacheKey, next);
        return next;
      });
      await (supabase as any).from("bot_addon_state").upsert(
        {
          bot_id: botId,
          addon_id: addonId,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bot_id,addon_id" },
      );
    },
    [botId, cacheKey],
  );

  const isEnabled = (addonId: string) => states[addonId] ?? true;

  return { states, isEnabled, setEnabled, loading, refresh };
}
