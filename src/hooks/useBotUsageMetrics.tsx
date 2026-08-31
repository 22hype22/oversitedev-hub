import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheGet, cacheSet } from "@/lib/uiCache";

export type BotUsageDay = {
  day: string; // ISO date (YYYY-MM-DD)
  commands_count: number;
  messages_count: number;
  errors_count: number;
  avg_active_servers: number;
  max_active_servers: number;
  max_member_count: number;
};

export function useBotUsageMetrics(botId: string, days = 7) {
  const cacheKey = `usage:${botId}:${days}`;
  const seeded = cacheGet<BotUsageDay[]>(cacheKey);
  const [data, setData] = useState<BotUsageDay[]>(seeded ?? []);
  // Only "loading" when there's nothing cached to show yet.
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data: rows, error: rpcError } = await (supabase as any).rpc(
      "get_bot_usage_daily",
      { _bot_id: botId, _days: days },
    );
    if (rpcError) {
      setError(rpcError.message);
    } else {
      const mapped =
        ((rows ?? []) as any[]).map((r) => ({
          day: typeof r.day === "string" ? r.day : new Date(r.day).toISOString().slice(0, 10),
          commands_count: Number(r.commands_count) || 0,
          messages_count: Number(r.messages_count) || 0,
          errors_count: Number(r.errors_count) || 0,
          avg_active_servers: Number(r.avg_active_servers) || 0,
          // max_active_servers is added by the peak-servers migration. Fall back
          // to the daily average if an older DB hasn't applied it yet.
          max_active_servers: Number(r.max_active_servers ?? r.avg_active_servers) || 0,
          max_member_count: Number(r.max_member_count) || 0,
        }));
      setData(mapped);
      cacheSet(cacheKey, mapped);
    }
    setLoading(false);
  }, [botId, days, cacheKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
