import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAddonIdsForBase } from "@/lib/botCatalog";

export type OwnedBot = {
  id: string;
  bot_name: string;
  bot_description: string | null;
  icon_url: string | null;
  base: string;
  addons: string[];
  monthly_hosting: boolean;
  status: string;
  hasWebDashboard: boolean;
  created_at: string;
  submitted_at: string | null;
  delivery_url: string | null;
  /** Demo/practice bot that's not backed by a real bot_orders row. */
  isDemo?: boolean;
};

const ACCESS_STATUSES = new Set(["submitted", "paid"]);

/** Stable synthetic id for the practice bot — never collides with a real UUID. */
export const DEMO_BOT_ID = "demo-all-in-one";

/**
 * Practice bot: every add-on enabled (All-in-One = Protection + Support +
 * Utilities + shared) so the user can preview every config box. Never
 * persisted to the DB; always injected client-side.
 */
function buildDemoBot(): OwnedBot {
  return {
    id: DEMO_BOT_ID,
    bot_name: "Practice Bot (Demo)",
    bot_description: "All add-ons enabled — explore every configuration box.",
    icon_url: null,
    base: "scratch",
    addons: getAddonIdsForBase("scratch"),
    monthly_hosting: false,
    status: "paid",
    hasWebDashboard: true,
    created_at: new Date(0).toISOString(),
    submitted_at: null,
    delivery_url: null,
    isDemo: true,
  };
}

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
      .select("id,bot_name,bot_description,icon_url,base,addons,monthly_hosting,status,created_at,submitted_at,delivery_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const mapped: OwnedBot[] = (data ?? [])
      .filter((row: any) => ACCESS_STATUSES.has(row.status))
      .map((row: any) => ({
        id: row.id,
        bot_name: row.bot_name,
        bot_description: row.bot_description,
        icon_url: row.icon_url,
        base: row.base,
        addons: Array.isArray(row.addons) ? row.addons : [],
        monthly_hosting: !!row.monthly_hosting,
        status: row.status,
        hasWebDashboard: Array.isArray(row.addons) && row.addons.includes("dashboard"),
        created_at: row.created_at,
        submitted_at: row.submitted_at ?? null,
        delivery_url: row.delivery_url ?? null,
      }));

    // Always include the practice bot so users can preview every add-on.
    setBots([buildDemoBot(), ...mapped]);
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
