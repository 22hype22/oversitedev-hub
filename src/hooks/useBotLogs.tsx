import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheGet, cacheSet } from "@/lib/uiCache";

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
  // Seed from the last window we showed for this bot so logs are on screen
  // instantly; the fresh query + realtime stream take over immediately.
  const cacheKey = botId ? `logs:${botId}:${sinceMs ?? "all"}` : "";
  const seeded = cacheKey ? cacheGet<BotLog[]>(cacheKey) : null;
  const [logs, setLogs] = useState<BotLog[]>(seeded ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!botId) return;
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
    } else {
      const rows = (data ?? []) as BotLog[];
      setLogs(rows);
      if (cacheKey) cacheSet(cacheKey, rows);
    }
    setLoading(false);
  }, [botId, limit, sinceMs, cacheKey]);

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
          setLogs((prev) => {
            const next = [row, ...prev].slice(0, limit);
            if (cacheKey) cacheSet(cacheKey, next);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId, limit, cacheKey]);

  return { logs, loading, error, refresh };
}
