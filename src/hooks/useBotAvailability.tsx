import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BotStatus = "available" | "preorder" | "coming_soon";

/**
 * Reads the per-bot availability map from `app_settings` (id = 1) and
 * subscribes to realtime updates so status changes propagate to every
 * visitor instantly — mirrors useBotSalesMode. Missing entries default to
 * "available" at the call site.
 */
export const useBotAvailability = () => {
  const [availability, setAvailability] = useState<Record<string, BotStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("bot_availability")
        .eq("id", 1)
        .maybeSingle();
      if (!mounted) return;
      const map = (data?.bot_availability ?? {}) as Record<string, BotStatus>;
      setAvailability(map);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`app-settings-availability-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload: any) => {
          const next = (payload.new as any)?.bot_availability;
          if (next && typeof next === "object") setAvailability(next);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { availability, loading };
};

/** Owner-only writer — the RPC verifies the caller's email server-side. */
export const setBotAvailability = async (baseId: string, status: BotStatus) => {
  const { data, error } = await (supabase as any).rpc("set_bot_availability", {
    _base_id: baseId,
    _status: status,
  });
  return { data, error };
};
