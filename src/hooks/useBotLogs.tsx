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

/**
 * @param botId   bot to stream logs for
 * @param limit   max rows to keep
 * @param sinceMs only return logs newer than (now - sinceMs). Pass null/undefined
 *                for "all" (bounded by `limit` and the DB's 7-day retention).
 */
export function useBotLogs(botId: string | null, limit = 50, sinceMs?: number | null) {
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    let query = supabase
      .from("bot_logs")
      .select("id, bot_id, level, message, context, created_at")
      .eq("bot_id", botId);
    if (sinceMs != null) {
      query = query.gte("created_at", new Date(Date.now() - sinceMs).toISOString());
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      setError(error.message);
      setLogs([]);
    } else {
      setLogs((data ?? []) as BotLog[]);
    }
    setLoading(false);
  }, [botId, limit, sinceMs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live updates via realtime
  useEffect(() => {
    if (!botId) return;
    const channel = supabase
      .channel(`bot_logs:${botId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bot_logs",
          filter: `bot_id=eq.${botId}`,
        },
        (payload) => {
          const row = payload.new as BotLog;
          setLogs((prev) => [row, ...prev].slice(0, limit));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId, limit]);

  return { logs, loading, error, refresh };
}
