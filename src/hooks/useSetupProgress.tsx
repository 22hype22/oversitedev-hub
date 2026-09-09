import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * What the dashboard's Setup card checks off for each bot, from real data:
 *   invite   the bot is in at least one Discord server
 *   apis     every required API key or credential slot is filled
 * The icon step is judged from the bot rows the dashboard already has.
 */
export type SetupProgress = {
  loading: boolean;
  /** Bots not yet in any server. */
  notInvitedBotIds: string[];
  /** Bots with a required credential still empty. */
  apisMissingBotIds: string[];
  refresh: () => void;
};

type SlotMeta = { key: string; is_required: boolean; is_set: boolean };

export function useSetupProgress(userId: string | null | undefined, botIds: string[]): SetupProgress {
  const [loading, setLoading] = useState(true);
  const [notInvitedBotIds, setNotInvited] = useState<string[]>([]);
  const [apisMissingBotIds, setApisMissing] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const idsKey = botIds.join(",");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setNotInvited([]);
      setApisMissing([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [runtime, active, ...secrets] = await Promise.all([
        (supabase as any).from("bot_runtime_status").select("bot_id, guilds").in("bot_id", ids),
        (supabase as any).from("bot_active_guilds").select("bot_id").in("bot_id", ids),
        ...ids.map((id) => (supabase as any).rpc("get_bot_secrets_metadata", { _bot_id: id }).then((r: any) => ({ id, slots: (r?.data ?? []) as SlotMeta[] }))),
      ]);
      if (cancelled) return;

      const inServer = new Set<string>();
      for (const row of (runtime?.data ?? []) as { bot_id: string; guilds: unknown }[]) {
        const g = row.guilds;
        const n = Array.isArray(g) ? g.length : g && typeof g === "object" ? Object.keys(g as object).length : 0;
        if (n > 0) inServer.add(String(row.bot_id));
      }
      for (const row of (active?.data ?? []) as { bot_id: string }[]) inServer.add(String(row.bot_id));
      setNotInvited(ids.filter((id) => !inServer.has(id)));

      const missing: string[] = [];
      for (const { id, slots } of secrets as { id: string; slots: SlotMeta[] }[]) {
        if (slots.some((s) => s.is_required && !s.is_set)) missing.push(id);
      }
      setApisMissing(missing);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, idsKey, tick]);

  return { loading, notInvitedBotIds, apisMissingBotIds, refresh };
}
