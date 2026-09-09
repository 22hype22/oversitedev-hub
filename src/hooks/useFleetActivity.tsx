import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The dashboard's Fleet activity chart, from real data for the viewer's bots:
 *   events   commands run and messages handled (bot_usage_metrics) plus
 *            actions the Protection bot watched (nuke_actions)
 *   blocked  Protection events where the bot took action
 * Seven days ending today, with the same window a week earlier for the delta.
 */
export type FleetDay = { label: string; events: number; blocked: number };
export type FleetActivity = {
  loading: boolean;
  days: FleetDay[];
  thisWeek: number;
  lastWeek: number;
  /** Percent change against last week, or null when last week had nothing. */
  deltaPct: number | null;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function useFleetActivity(userId: string | null | undefined, botIds: string[]): FleetActivity {
  const [state, setState] = useState<FleetActivity>({ loading: true, days: [], thisWeek: 0, lastWeek: 0, deltaPct: null });
  const idsKey = botIds.join(",");

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const today = startOfDay(new Date());
    const first = new Date(today.getTime() - 13 * DAY_MS);
    const empty = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * DAY_MS);
      return { label: DAY_LABELS[d.getDay()], events: 0, blocked: 0 };
    });
    if (!userId || ids.length === 0) {
      setState({ loading: false, days: empty, thisWeek: 0, lastWeek: 0, deltaPct: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const since = first.toISOString();
      const [usage, watched, protection] = await Promise.all([
        (supabase as any).from("bot_usage_metrics").select("bucket_start, commands_count, messages_count").in("bot_id", ids).gte("bucket_start", since),
        (supabase as any).from("nuke_actions").select("created_at").in("bot_id", ids).gte("created_at", since),
        (supabase as any).from("protection_events").select("created_at, action_taken").in("bot_id", ids).gte("created_at", since),
      ]);
      if (cancelled) return;
      // 14 slots: 0..6 last week, 7..13 this week (13 = today).
      const events = new Array<number>(14).fill(0);
      const blocked = new Array<number>(14).fill(0);
      const slot = (iso: string) => Math.floor((startOfDay(new Date(iso)).getTime() - first.getTime()) / DAY_MS);
      for (const r of (usage?.data ?? []) as { bucket_start: string; commands_count: number; messages_count: number }[]) {
        const i = slot(r.bucket_start);
        if (i >= 0 && i < 14) events[i] += Number(r.commands_count ?? 0) + Number(r.messages_count ?? 0);
      }
      for (const r of (watched?.data ?? []) as { created_at: string }[]) {
        const i = slot(r.created_at);
        if (i >= 0 && i < 14) events[i] += 1;
      }
      for (const r of (protection?.data ?? []) as { created_at: string; action_taken: string | null }[]) {
        const i = slot(r.created_at);
        if (i >= 0 && i < 14) {
          events[i] += 1;
          if (r.action_taken) blocked[i] += 1;
        }
      }
      const days = empty.map((d, i) => ({ ...d, events: events[7 + i], blocked: blocked[7 + i] }));
      const thisWeek = events.slice(7).reduce((a, b) => a + b, 0);
      const lastWeek = events.slice(0, 7).reduce((a, b) => a + b, 0);
      const deltaPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
      setState({ loading: false, days, thisWeek, lastWeek, deltaPct });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, idsKey]);

  return state;
}
