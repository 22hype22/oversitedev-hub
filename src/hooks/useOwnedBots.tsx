import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";


export type OwnedBot = {
  id: string;
  bot_name: string;
  bot_description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  base: string;
  addons: string[];
  monthly_hosting: boolean;
  engine_version: "v1" | "v2";
  status: string;
  hasWebDashboard: boolean;
  created_at: string;
  submitted_at: string | null;
  delivery_url: string | null;
  source_url: string | null;
  /** Demo/practice bot that's not backed by a real bot_orders row. */
  isDemo?: boolean;
};

// Only bots that are paid and live show up in the dashboard. Drafts,
// submitted-but-unpaid, cancelled, etc. are hidden until they go live.
const ACCESS_STATUSES = new Set(["paid"]);

/**
 * Loads bots the signed-in user has ordered. `bots` is everything they've
 * built; `dashboardBots` is the subset that includes the Web Dashboard add-on
 * ("dashboard") and is therefore manageable from the Bot Dashboard.
 */
export function useOwnedBots() {
  const { user } = useAuth();
  const [bots, setBots] = useState<OwnedBot[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setBots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("bot_orders")
      .select("id,bot_name,bot_description,icon_url,banner_url,base,addons,monthly_hosting,status,created_at,submitted_at,delivery_url,source_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const mapped: OwnedBot[] = (data ?? [])
      .filter((row: any) => ACCESS_STATUSES.has(row.status))
      .map((row: any) => ({
        id: row.id,
        bot_name: row.bot_name,
        bot_description: row.bot_description,
        icon_url: row.icon_url,
        banner_url: row.banner_url,
        base: row.base,
        addons: Array.isArray(row.addons) ? row.addons : [],
        monthly_hosting: !!row.monthly_hosting,
        status: row.status,
        hasWebDashboard: Array.isArray(row.addons) && row.addons.includes("dashboard"),
        created_at: row.created_at,
        submitted_at: row.submitted_at ?? null,
        delivery_url: row.delivery_url ?? null,
        source_url: row.source_url ?? null,
      }));

    setBots(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  // The Web Dashboard add-on is a one-time, account-wide unlock. Once any
  // bot order includes it, the user can manage ALL of their bots from the
  // dashboard — current and future ones — without paying again. The demo
  // bot also grants visibility so new users can explore the dashboard.
  const hasDashboardAccess = bots.some((b) => b.hasWebDashboard);
  const dashboardBots = hasDashboardAccess ? bots : [];

  return {
    bots,
    dashboardBots,
    hasDashboardAccess,
    loading,
    reload,
  };
}
