import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Free ($0) bot orders are personal/externally-hosted bots (e.g. running on
   *  Railway). Their runtime status is not managed by our worker, so the
   *  dashboard hides start/stop controls and the live health badge for them. */
  externallyManaged: boolean;
  created_at: string;
  submitted_at: string | null;
  delivery_url: string | null;
  source_url: string | null;
  /** Demo/practice bot that's not backed by a real bot_orders row. */
  isDemo?: boolean;
  /** True when the current viewer is an admin acting via a support access grant
   *  rather than the owner. The dashboard renders a banner & badge in this case. */
  viaSupport?: boolean;
  /** True when the current viewer is an invited team member on the owner's
   *  account rather than the owner themselves. */
  viaTeam?: boolean;
  /** When viaSupport/viaTeam is true, the user_id of the actual bot owner. */
  ownerUserId?: string;
  /** Auto-deployment lifecycle: pending | deploying | deployed | failed. */
  deployment_status?: string | null;
  /** Railway service ID once the bot has been provisioned. */
  railway_service_id?: string | null;
  /** Stored bio shown in the bot's Discord "About me" section. */
  bot_bio?: string | null;
  /** Last time the username was pushed to Discord (used for rate-limit warning). */
  discord_last_username_change_at?: string | null;
  /** Discord presence activity type (playing/watching/listening/competing/streaming). */
  activity_type?: string | null;
  /** Discord presence activity text. */
  activity_text?: string | null;
  /** Discord presence status (online/idle/dnd/invisible). */
  presence_status?: string | null;
};



// Bots that are paid and live show up in the dashboard. Drafts,
// submitted-but-unpaid, cancelled, etc. are hidden. `ready` means the
// worker finished building & deployed the bot — those should show too.
const ACCESS_STATUSES = new Set(["paid", "ready"]);

// Statuses that count as a real purchase (entitlement-bearing). Used to
// decide whether the user has unlocked account-wide perks like the Web
// Dashboard add-on, even if the underlying bot order was later cancelled.
const ENTITLEMENT_STATUSES = new Set(["paid", "ready", "submitted", "cancelled"]);

function mapRow(row: any, opts: { viaSupport?: boolean; viaTeam?: boolean } = {}): OwnedBot {
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
    externallyManaged: Number(row.total_amount ?? 0) === 0,
    created_at: row.created_at,
    submitted_at: row.submitted_at ?? null,
    delivery_url: row.delivery_url ?? null,
    source_url: row.source_url ?? null,
    viaSupport: !!opts.viaSupport,
    viaTeam: !!opts.viaTeam,
    ownerUserId: row.user_id,
    deployment_status: row.deployment_status ?? null,
    railway_service_id: row.railway_service_id ?? null,
    bot_bio: row.bot_bio ?? null,
    discord_last_username_change_at: row.discord_last_username_change_at ?? null,
    activity_type: row.activity_type ?? null,
    activity_text: row.activity_text ?? null,
    presence_status: row.presence_status ?? null,
  };
}



/**
 * Loads bots the signed-in user has ordered. `bots` is everything they've
 * built; `dashboardBots` is the subset that includes the Web Dashboard add-on
 * ("dashboard") and is therefore manageable from the Bot Dashboard.
 *
 * Admins with active support-access grants ALSO see the granting users' bots,
 * tagged with `viaSupport: true`. Invited team members see the owner's bots
 * tagged with `viaTeam: true`.
 */
export function useOwnedBots() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [bots, setBots] = useState<OwnedBot[]>([]);
  const [supportBots, setSupportBots] = useState<OwnedBot[]>([]);
  const [teamBots, setTeamBots] = useState<OwnedBot[]>([]);
  const [ownsDashboardAddon, setOwnsDashboardAddon] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setBots([]);
      setSupportBots([]);
      setOwnsDashboardAddon(false);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }
    if (!hasLoadedRef.current) setLoading(true);

    // 1) Own bots — fetch ALL of the user's orders. We filter to live ones
    // for `bots`, but we keep the full list around so account-wide perks
    // (like the Web Dashboard add-on) survive cancellations of the order
    // they were originally purchased on.
    const { data: own, error: ownErr } = await (supabase as any)
      .from("bot_orders")
      .select("id,user_id,bot_name,bot_description,icon_url,banner_url,base,addons,monthly_hosting,engine_version,status,created_at,submitted_at,delivery_url,source_url,paid_at,total_amount,deployment_status,railway_service_id,bot_bio,discord_last_username_change_at,activity_type,activity_text,presence_status")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    // If the request errored (auth race, transient network), DO NOT clobber
    // existing state with empty arrays — that's what was making the dashboard
    // flash the "locked" screen until the customer hit refresh many times.
    // Keep whatever we have and let the next reload/realtime tick recover.
    if (ownErr) {
      console.warn("[useOwnedBots] reload error, keeping previous state", ownErr.message);
      setLoading(false);
      return;
    }

    const ownAll: any[] = own ?? [];
    const ownMapped: OwnedBot[] = ownAll
      .filter((row: any) => ACCESS_STATUSES.has(row.status))
      .map((row: any) => mapRow(row));

    // Account-wide entitlement: any order that was ever paid for and
    // included the `dashboard` addon unlocks dashboard access forever.
    const ownsDashboardAddon = ownAll.some(
      (row: any) =>
        Array.isArray(row.addons) &&
        row.addons.includes("dashboard") &&
        (row.paid_at != null || ACCESS_STATUSES.has(row.status)),
    );

    // 2) Bots from active support-access grants
    const { data: grants } = await (supabase as any)
      .from("support_access_grants")
      .select("owner_user_id")
      .eq("admin_user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());

    const supportOwnerIds: string[] = Array.from(
      new Set(((grants ?? []) as any[]).map((g) => g.owner_user_id).filter(Boolean)),
    ).filter((id) => id !== userId);

    let supportMapped: OwnedBot[] = [];
    if (supportOwnerIds.length > 0) {
      const { data: supportRows } = await (supabase as any)
        .from("bot_orders")
        .select("id,user_id,bot_name,bot_description,icon_url,banner_url,base,addons,monthly_hosting,engine_version,status,created_at,submitted_at,delivery_url,source_url,total_amount,deployment_status,railway_service_id,bot_bio,discord_last_username_change_at,activity_type,activity_text,presence_status")
        .in("user_id", supportOwnerIds)
        .order("created_at", { ascending: true });
      supportMapped = (supportRows ?? [])
        .filter((row: any) => ACCESS_STATUSES.has(row.status))
        .map((row: any) => mapRow(row, { viaSupport: true }));
    }

    // 3) Bots from accounts where this user is an active team member
    //    (i.e. they accepted an invite). Owners of those accounts have
    //    granted us seats on their bots — we should show those here so
    //    invited admins/moderators/viewers can manage them.
    const { data: memberships } = await (supabase as any)
      .from("dashboard_team")
      .select("owner_user_id,role,accepted_at")
      .eq("member_user_id", user.id)
      .not("accepted_at", "is", null);

    const teamOwnerIds: string[] = Array.from(
      new Set(
        ((memberships ?? []) as any[])
          .filter((m) => m.role !== "owner") // skip self-owner row
          .map((m) => m.owner_user_id)
          .filter(Boolean),
      ),
    ).filter((id) => id !== userId);

    let teamMapped: OwnedBot[] = [];
    if (teamOwnerIds.length > 0) {
      const { data: teamRows } = await (supabase as any)
        .from("bot_orders")
        .select("id,user_id,bot_name,bot_description,icon_url,banner_url,base,addons,monthly_hosting,engine_version,status,created_at,submitted_at,delivery_url,source_url,total_amount,deployment_status,railway_service_id,bot_bio,discord_last_username_change_at,activity_type,activity_text,presence_status")
        .in("user_id", teamOwnerIds)
        .order("created_at", { ascending: true });
      teamMapped = (teamRows ?? [])
        .filter((row: any) => ACCESS_STATUSES.has(row.status))
        .map((row: any) => mapRow(row, { viaTeam: true }));
    }

    setBots(ownMapped);
    setSupportBots(supportMapped);
    setTeamBots(teamMapped);
    setOwnsDashboardAddon(ownsDashboardAddon);
    hasLoadedRef.current = true;
    setLoading(false);

    // Auto-retry: if the first fetch came back with zero bots AND zero
    // entitlement AND no team/support seats, it's almost always an auth/RLS
    // race on cold load — the customer "really has bots" but the request
    // ran before the session was ready. Quietly retry a few times instead
    // of forcing them to hit refresh.
    const looksEmpty =
      ownMapped.length === 0 &&
      !ownsDashboardAddon &&
      supportMapped.length === 0 &&
      teamMapped.length === 0;
    if (looksEmpty && emptyRetriesRef.current < 4) {
      emptyRetriesRef.current += 1;
      setTimeout(() => {
        void reload();
      }, 800 * emptyRetriesRef.current);
    } else if (!looksEmpty) {
      emptyRetriesRef.current = 0;
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime: if an owner removes this user from their team, or an owner
  // revokes a support grant this user holds, refresh immediately so the
  // affected bots disappear from the dashboard without a manual refresh.
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`owned-bots-access-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dashboard_team", filter: `member_user_id=eq.${userId}` },
        () => reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_access_grants", filter: `admin_user_id=eq.${userId}` },
        () => reload(),
      )
      .on(
        // Watch our own bot_orders so deployment_status flips (e.g. the
        // heartbeat trigger setting it to 'deployed') refresh the dashboard
        // automatically and the "Deploying your bot…" banner disappears
        // without a manual page refresh.
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bot_orders", filter: `user_id=eq.${userId}` },
        () => reload(),
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [userId, reload]);

  // Polling fallback: realtime events can be missed (especially for team
  // members viewing the owner's bots, where the UPDATE filter above doesn't
  // match). Poll bot_orders every 10s while any visible bot isn't fully
  // deployed yet so the "Deploying your bot…" banner clears as soon as
  // deployment_status flips to 'deployed' and a railway_service_id is set.
  useEffect(() => {
    if (!userId) return;
    const allVisible = [...bots, ...supportBots, ...teamBots];
    const anyDeploying = allVisible.some(
      (b) =>
        !b.isDemo &&
        (b.deployment_status !== "deployed" || !b.railway_service_id),
    );
    if (!anyDeploying) return;
    const id = setInterval(() => {
      void reload();
    }, 10000);
    return () => clearInterval(id);
  }, [userId, reload, bots, supportBots, teamBots]);

  // The Web Dashboard add-on is a one-time, account-wide unlock. Once any
  // PAID bot order includes it, the user can manage ALL of their bots from
  // the dashboard — current and future ones — even if that original order
  // is later cancelled. We also fall back to checking visible bots in case
  // the entitlement query hasn't loaded yet.
  // Team members and support-grant viewers should also have dashboard access
  // — they're managing the owner's bots on the owner's entitlement.
  const hasDashboardAccess =
    ownsDashboardAddon ||
    bots.some((b) => b.hasWebDashboard) ||
    teamBots.length > 0 ||
    supportBots.length > 0;
  // Support- and team-session bots are always visible regardless of the
  // viewer's own dashboard add-on status — they're seeing the OWNER's bots,
  // not their own, and the owner's entitlement is what unlocks them.
  const dashboardBots = [
    ...(hasDashboardAccess ? bots : []),
    ...supportBots,
    ...teamBots,
  ];

  return {
    bots,
    dashboardBots,
    supportBots,
    teamBots,
    hasDashboardAccess,
    loading,
    reload,
  };
}

