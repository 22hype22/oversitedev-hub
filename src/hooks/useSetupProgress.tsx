import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * What the dashboard's Setup card checks off, read from real data:
 *   billing   a hosting subscription exists (only asked when a bot bills monthly)
 *   team      at least one person has been invited (only asked in team mode)
 *   commands  every bot has at least one feature configured
 * Each is null while loading or when the step does not apply.
 */
export type SetupProgress = {
  loading: boolean;
  billing: boolean | null;
  team: boolean | null;
  /** Bot ids that still have nothing configured. */
  unconfiguredBotIds: string[];
  refresh: () => void;
};

// bot_config rows the bots write for themselves, not settings the owner made.
const INTERNAL_FEATURE = /(-state(-v\d+)?|-data|-values|-entries|-posts)$|^(pkgfile:|eph-registry|command-sync|dispatch_region)/;

export function useSetupProgress(
  userId: string | null | undefined,
  botIds: string[],
  needsBilling: boolean,
  needsTeam: boolean,
): SetupProgress {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<boolean | null>(null);
  const [team, setTeam] = useState<boolean | null>(null);
  const [unconfiguredBotIds, setUnconfigured] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const idsKey = botIds.join(",");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = idsKey ? idsKey.split(",") : [];
      const [sub, members, configs] = await Promise.all([
        needsBilling
          ? (supabase as any).from("hosting_subscriptions").select("status").eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        needsTeam
          ? (supabase as any).from("dashboard_team").select("id", { count: "exact", head: true }).eq("owner_user_id", userId)
          : Promise.resolve({ count: null }),
        ids.length
          ? (supabase as any).from("bot_config").select("bot_id, feature").in("bot_id", ids)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setBilling(needsBilling ? ["active", "trialing", "past_due"].includes(String(sub?.data?.status ?? "")) : null);
      setTeam(needsTeam ? Number(members?.count ?? 0) > 0 : null);
      const configured = new Set<string>();
      for (const row of (configs?.data ?? []) as { bot_id: string; feature: string }[]) {
        if (!INTERNAL_FEATURE.test(String(row.feature ?? ""))) configured.add(String(row.bot_id));
      }
      setUnconfigured(ids.filter((id) => !configured.has(id)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, idsKey, needsBilling, needsTeam, tick]);

  return { loading, billing, team, unconfiguredBotIds, refresh };
}
