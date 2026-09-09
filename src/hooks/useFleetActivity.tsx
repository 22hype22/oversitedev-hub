import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The dashboard's Fleet activity chart: how much the bots were used each day.
 *   commands  slash commands, buttons, forms and prefix commands handled
 *   messages  messages the bots sent
 * Both come from bot_usage_metrics, which every bot reports in five minute
 * batches, summed across every bot the viewer has. The current calendar week,
 * Sunday to Saturday, with the previous week for the delta.
 */
export type FleetDay = { label: string; commands: number; messages: number; /** After today: nothing to show yet. */ future: boolean; today: boolean };
export type FleetActivity = {
  loading: boolean;
  days: FleetDay[];
  /** Commands plus messages this week and last week. */
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
    const weekStart = new Date(today.getTime() - today.getDay() * DAY_MS);
    const first = new Date(weekStart.getTime() - 7 * DAY_MS);
    const empty = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getTime() + i * DAY_MS);
      return { label: DAY_LABELS[i], commands: 0, messages: 0, future: d.getTime() > today.getTime(), today: d.getTime() === today.getTime() };
    });
    if (!userId || ids.length === 0) {
      setState({ loading: false, days: empty, thisWeek: 0, lastWeek: 0, deltaPct: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const since = first.toISOString();
      const { data } = await (supabase as any)
        .from("bot_usage_metrics")
        .select("bucket_start, commands_count, messages_count")
        .in("bot_id", ids)
        .gte("bucket_start", since);
      if (cancelled) return;
      // 14 slots: 0..6 last week, 7..13 this week, Sunday first.
      const commands = new Array<number>(14).fill(0);
      const messages = new Array<number>(14).fill(0);
      const slot = (iso: string) => Math.floor((startOfDay(new Date(iso)).getTime() - first.getTime()) / DAY_MS);
      for (const r of (data ?? []) as { bucket_start: string; commands_count: number; messages_count: number }[]) {
        const i = slot(r.bucket_start);
        if (i < 0 || i > 13) continue;
        commands[i] += Number(r.commands_count ?? 0);
        messages[i] += Number(r.messages_count ?? 0);
      }
      const days = empty.map((d, i) => ({ ...d, commands: commands[7 + i], messages: messages[7 + i] }));
      const total = (from: number, to: number) => commands.slice(from, to).reduce((a, b) => a + b, 0) + messages.slice(from, to).reduce((a, b) => a + b, 0);
      const thisWeek = total(7, 14);
      const lastWeek = total(0, 7);
      const deltaPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
      setState({ loading: false, days, thisWeek, lastWeek, deltaPct });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, idsKey]);

  return state;
}
