import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCached, peekCached, setCached } from "@/lib/swrCache";

const CACHE_KEY = "addonOverrides:all";

/**
 * Per-addon admin overrides for whether the add-on is shown as INCLUDED
 * (default) or NOT INCLUDED in the public bot builder. Subscribes to
 * realtime updates so toggles propagate instantly. Uses an in-memory SWR
 * cache so navigations don't trigger a refetch within 30s.
 */
export const useAddonOverrides = () => {
  const seed = peekCached<Record<string, boolean>>(CACHE_KEY);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(seed ?? {});
  const [loading, setLoading] = useState(!seed);

  const reload = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("bot_addon_overrides")
      .select("addon_id, included");
    const map: Record<string, boolean> = {};
    for (const row of data ?? []) map[row.addon_id] = !!row.included;
    setOverrides(map);
    setCached(CACHE_KEY, map);
    setLoading(false);
  }, []);

  useEffect(() => {
    // SWR: skip refetch on mount if cache is fresh (<30s).
    if (!getCached(CACHE_KEY)) {
      void reload();
    } else {
      setLoading(false);
    }
    const channel = supabase
      .channel(`addon-overrides-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_addon_overrides" },
        () => reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  /** Whether the addon is included. Defaults to true if no override exists. */
  const isIncluded = useCallback(
    (addonId: string) => overrides[addonId] !== false,
    [overrides],
  );

  return { overrides, loading, isIncluded, reload };
};

/** Admin-only writer. Upserts the override row for an addon. */
export const setAddonIncluded = async (
  addonId: string,
  included: boolean,
  userId?: string,
) => {
  const { error } = await (supabase as any)
    .from("bot_addon_overrides")
    .upsert(
      {
        addon_id: addonId,
        included,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "addon_id" },
    );
  return { error };
};
