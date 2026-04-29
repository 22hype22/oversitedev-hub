import { useCallback, useEffect, useState } from "react";
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
  const [periods, setPeriods] = useState<Record<string, BotFreePeriod>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setPeriods({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("bot_free_periods")
      .select("bot_id,free_until,reminder_sent_at,resumed_at")
      .eq("user_id", user.id);

    const map: Record<string, BotFreePeriod> = {};
    (data ?? []).forEach((row: BotFreePeriod) => {
      map[row.bot_id] = row;
    });
    setPeriods(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { periods, loading, reload };
}
