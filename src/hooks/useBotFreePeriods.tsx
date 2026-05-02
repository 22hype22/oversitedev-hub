import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type BotFreePeriod = {
  bot_id: string;
  free_until: string;
  reminder_sent_at: string | null;
  resumed_at: string | null;
};

/** Loads the signed-in user's active free periods, keyed by bot_id. */
export function useBotFreePeriods() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [periods, setPeriods] = useState<Record<string, BotFreePeriod>>({});
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setPeriods({});
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }
    if (!hasLoadedRef.current) setLoading(true);
    const { data } = await (supabase as any)
      .from("bot_free_periods")
      .select("bot_id,free_until,reminder_sent_at,resumed_at")
      .eq("user_id", userId);

    const map: Record<string, BotFreePeriod> = {};
    (data ?? []).forEach((row: BotFreePeriod) => {
      map[row.bot_id] = row;
    });
    setPeriods(map);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { periods, loading, reload };
}
