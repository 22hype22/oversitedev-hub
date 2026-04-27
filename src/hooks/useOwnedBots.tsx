import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
};

const ACCESS_STATUSES = new Set(["submitted", "paid"]);

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
      .select("id,bot_name,bot_description,icon_url,base,addons,monthly_hosting,status,created_at")
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
      }));

    setBots(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const dashboardBots = bots.filter((b) => b.hasWebDashboard);

  return {
    bots,
    dashboardBots,
    hasDashboardAccess: dashboardBots.length > 0,
    loading,
    reload,
  };
}
