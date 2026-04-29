import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BotUsageDay = {
  day: string; // ISO date (YYYY-MM-DD)
  commands_count: number;
  messages_count: number;
  errors_count: number;
  avg_active_servers: number;
  max_member_count: number;
};

export function useBotUsageMetrics(botId: string, days = 7) {
  const [data, setData] = useState<BotUsageDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: rows, error: rpcError } = await (supabase as any).rpc(
      "get_bot_usage_daily",
      { _bot_id: botId, _days: days },
    );
    if (rpcError) {
      setError(rpcError.message);
      setData([]);
    } else {
      setData(
        ((rows ?? []) as any[]).map((r) => ({
          day: typeof r.day === "string" ? r.day : new Date(r.day).toISOString().slice(0, 10),
          commands_count: Number(r.commands_count) || 0,
          messages_count: Number(r.messages_count) || 0,
          errors_count: Number(r.errors_count) || 0,
          avg_active_servers: Number(r.avg_active_servers) || 0,
          max_member_count: Number(r.max_member_count) || 0,
        })),
      );
    }
    setLoading(false);
  }, [botId, days]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
