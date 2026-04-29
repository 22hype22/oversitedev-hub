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
  /** True when the current viewer is an admin acting via a support access grant
   *  rather than the owner. The dashboard renders a banner & badge in this case. */
  viaSupport?: boolean;
  /** When viaSupport is true, the user_id of the actual bot owner. */
  ownerUserId?: string;
};

// Only bots that are paid and live show up in the dashboard. Drafts,
// submitted-but-unpaid, cancelled, etc. are hidden until they go live.
const ACCESS_STATUSES = new Set(["paid"]);

function mapRow(row: any, viaSupport = false): OwnedBot {
  return {
    id: row.id,
    bot_name: row.bot_name,
    bot_description: row.bot_description,
    icon_url: row.icon_url,
    banner_url: row.banner_url,
    base: row.base,
    addons: Array.isArray(row.addons) ? row.addons : [],
    monthly_hosting: !!row.monthly_hosting,
    engine_version: row.engine_version === "v2" ? "v2" : "v1",
    status: row.status,
    hasWebDashboard: Array.isArray(row.addons) && row.addons.includes("dashboard"),
    created_at: row.created_at,
    submitted_at: row.submitted_at ?? null,
    delivery_url: row.delivery_url ?? null,
    source_url: row.source_url ?? null,
    viaSupport,
    ownerUserId: row.user_id,
  };
}

/**
 * Loads bots the signed-in user has ordered. `bots` is everything they've
 * built; `dashboardBots` is the subset that includes the Web Dashboard add-on
 * ("dashboard") and is therefore manageable from the Bot Dashboard.
 *
 * Admins with active support-access grants ALSO see the granting users' bots,
 * tagged with `viaSupport: true`.
 */
export function useOwnedBots() {
  const { user } = useAuth();
  const [bots, setBots] = useState<OwnedBot[]>([]);
  const [supportBots, setSupportBots] = useState<OwnedBot[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setBots([]);
      setSupportBots([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1) Own bots
    const { data: own } = await (supabase as any)
      .from("bot_orders")
      .select("id,user_id,bot_name,bot_description,icon_url,banner_url,base,addons,monthly_hosting,engine_version,status,created_at,submitted_at,delivery_url,source_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const ownMapped: OwnedBot[] = (own ?? [])
      .filter((row: any) => ACCESS_STATUSES.has(row.status))
      .map((row: any) => mapRow(row, false));

    // 2) Bots from active support-access grants
    const { data: grants } = await (supabase as any)
      .from("support_access_grants")
      .select("owner_user_id")
      .eq("admin_user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());

    const ownerIds: string[] = Array.from(
      new Set(((grants ?? []) as any[]).map((g) => g.owner_user_id).filter(Boolean)),
    ).filter((id) => id !== user.id);

    let supportMapped: OwnedBot[] = [];
    if (ownerIds.length > 0) {
      const { data: supportRows } = await (supabase as any)
        .from("bot_orders")
        .select("id,user_id,bot_name,bot_description,icon_url,banner_url,base,addons,monthly_hosting,engine_version,status,created_at,submitted_at,delivery_url,source_url")
        .in("user_id", ownerIds)
        .order("created_at", { ascending: true });
      supportMapped = (supportRows ?? [])
        .filter((row: any) => ACCESS_STATUSES.has(row.status))
        .map((row: any) => mapRow(row, true));
    }

    setBots(ownMapped);
    setSupportBots(supportMapped);
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
  // Support-session bots are always visible regardless of the admin's own
  // dashboard add-on status — that's the whole point of the support access.
  const dashboardBots = [
    ...(hasDashboardAccess ? bots : []),
    ...supportBots,
  ];

  return {
    bots,
    dashboardBots,
    supportBots,
    hasDashboardAccess,
    loading,
    reload,
  };
}
