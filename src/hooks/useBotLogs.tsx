import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BotLogLevel = "debug" | "info" | "warn" | "error";

export interface BotLog {
  id: string;
  bot_id: string;
  level: BotLogLevel;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

export function useBotLogs(botId: string | null, limit = 50) {
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("bot_logs")
      .select("id, bot_id, level, message, context, created_at")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      setError(error.message);
      setLogs([]);
    } else {
      setLogs((data ?? []) as BotLog[]);
    }
    setLoading(false);
  }, [botId, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, error, refresh };
}
