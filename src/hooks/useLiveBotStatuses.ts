import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live runtime status for a set of bots, for the bot list/table.
 *
 * - Initial fetch + 30s fallback poll of bot_runtime_status.
 * - Realtime postgres_changes subscription so worker-reported transitions
 *   (online / starting / stopping / restarting / crashed / updating) and the
 *   optimistic 'restarting' written by bot-railway-action show up instantly.
 * - A 15s ticker re-evaluates heartbeat staleness so a hard-killed bot
 *   (which can't report anything) flips to offline within ~60–75s.
 */

export type LiveBotStatus = {
  /** Raw worker-reported status. */
  status: string;
  /** Stale-aware status: 'online' with a dead heartbeat becomes 'offline'. */
  effective: string;
  last_heartbeat_at: string | null;
};

const STALE_MS = 60_000;

function effectiveOf(status: string | null, hb: string | null): string {
  const s = status ?? "offline";
  if (s === "online" && (!hb || Date.now() - new Date(hb).getTime() > STALE_MS)) {
    return "offline";
  }
  return s;
}

export function useLiveBotStatuses(botIds: string[]) {
  const [rows, setRows] = useState<Record<string, { status: string; hb: string | null }>>({});
  const [tick, setTick] = useState(0);
  // Stable key so the effect doesn't resubscribe on every render.
  const key = useMemo(() => botIds.slice().sort().join(","), [botIds]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const ids = key.split(",");

    const load = async () => {
      const { data } = await (supabase.from("bot_runtime_status") as any)
        .select("bot_id, status, last_heartbeat_at")
        .in("bot_id", ids);
      if (cancelled || !data) return;
      const next: Record<string, { status: string; hb: string | null }> = {};
      for (const r of data as { bot_id: string; status: string; last_heartbeat_at: string | null }[]) {
        next[r.bot_id] = { status: r.status, hb: r.last_heartbeat_at };
      }
      setRows(next);
    };
    load();
    const poll = setInterval(load, 30_000);

    const channel = supabase
      .channel(`live-bot-statuses-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bot_runtime_status",
          filter: `bot_id=in.(${ids.join(",")})`,
        },
        (payload) => {
          const row = payload.new as { bot_id?: string; status?: string; last_heartbeat_at?: string | null } | null;
          if (!row?.bot_id) return;
          setRows((prev) => ({
            ...prev,
            [row.bot_id as string]: { status: row.status ?? "offline", hb: row.last_heartbeat_at ?? null },
          }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [key]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    void tick;
    const out: Record<string, LiveBotStatus> = {};
    for (const [id, r] of Object.entries(rows)) {
      out[id] = { status: r.status, effective: effectiveOf(r.status, r.hb), last_heartbeat_at: r.hb };
    }
    return out;
  }, [rows, tick]);
}
