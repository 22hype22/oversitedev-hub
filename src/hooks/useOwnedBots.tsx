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
  /** The group this bot belongs to (null when ungrouped). */
  group_id: string | null;
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
    group_id: row.group_id ?? null,
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
// Session-lifetime snapshot of the last successful load, per user. Lets the
// dashboard paint instantly when it remounts (leaving and coming back within
// the app) and refresh quietly in the background, instead of blanking on a
// full-screen loader for every single visit.
type OwnedBotsSnapshot = {
  bots: OwnedBot[];
  supportBots: OwnedBot[];
  teamBots: OwnedBot[];
  ownsDashboardAddon: boolean;
};
const snapshotCache = new Map<string, OwnedBotsSnapshot>();

// Persist the snapshot to localStorage too, so ANY return visit — a hard
// refresh, a new tab, tomorrow morning — paints the last-known bots instantly
// and refreshes silently, instead of showing the full-screen loader. The key
// is per-user-id, so it's only ever served back to the same signed-in account,
// and the background reload immediately corrects anything stale.
// (Reads fall back to the old sessionStorage key once, for sessions that
// predate this change.)
const snapKey = (uid: string) => `oversite:bots:${uid}`;
function readSnapshot(uid: string): OwnedBotsSnapshot | undefined {
  const mem = snapshotCache.get(uid);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(snapKey(uid)) ?? sessionStorage.getItem(snapKey(uid));
    if (raw) {
      const snap = JSON.parse(raw) as OwnedBotsSnapshot;
      snapshotCache.set(uid, snap);
      return snap;
    }
  } catch { /* ignore */ }
  return undefined;
}
function writeSnapshot(uid: string, snap: OwnedBotsSnapshot) {
  snapshotCache.set(uid, snap);
  try { localStorage.setItem(snapKey(uid), JSON.stringify(snap)); } catch { /* ignore */ }
}

export function useOwnedBots() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [bots, setBots] = useState<OwnedBot[]>([]);
  const [supportBots, setSupportBots] = useState<OwnedBot[]>([]);
  const [teamBots, setTeamBots] = useState<OwnedBot[]>([]);
  const [ownsDashboardAddon, setOwnsDashboardAddon] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const emptyRetriesRef = useRef(0);
  // Ensures we claim pending team invites exactly once per signed-in user,
  // independent of the snapshot cache (which can otherwise skip the claim on an
  // in-app remount for an already-logged-in member who was just added).
  const claimedForUserRef = useRef<string | null>(null);


  const reload = useCallback(async () => {
    if (!userId) {
      if (authLoading) {
        setLoading(true);
        return;
      }
      setBots([]);
      setSupportBots([]);
      setTeamBots([]);
      setOwnsDashboardAddon(false);
      setLoading(false);
      hasLoadedRef.current = false;
      emptyRetriesRef.current = 0;
      return;
    }
    // Serve the cached snapshot instantly on remount, then refresh silently
    // below — the loader only ever shows on the first load of a session.
    if (!hasLoadedRef.current) {
      const cached = readSnapshot(userId);
      if (cached) {
        setBots(cached.bots);
        setSupportBots(cached.supportBots);
        setTeamBots(cached.teamBots);
        setOwnsDashboardAddon(cached.ownsDashboardAddon);
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
    if (!hasLoadedRef.current) setLoading(true);

    // Background maintenance runs ONCE per signed-in user and does NOT block the
    // dashboard from painting — these used to be awaited up front, which meant
    // waiting on edge-function cold starts before any bot showed. Fire them off
    // after we've already fetched below (see the end of this function).

    // 1) Own bots — fetch ALL of the user's orders. We filter to live ones
    // for `bots`, but we keep the full list around so account-wide perks
    // (like the Web Dashboard add-on) survive cancellations of the order
    // they were originally purchased on.
    // The three membership lookups (own orders, support grants, team seats)
    // are independent, so they run together instead of one after another.
    const [{ data: own, error: ownErr }, { data: grants }, { data: memberships }] = await Promise.all([
      (supabase as any)
        .from("bot_orders")
        .select("id,user_id,bot_name,bot_description,icon_url,banner_url,base,group_id,addons,monthly_hosting,engine_version,status,created_at,submitted_at,delivery_url,source_url,paid_at,total_amount,deployment_status,railway_service_id,bot_bio,discord_last_username_change_at,activity_type,activity_text,presence_status")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("support_access_grants")
        .select("owner_user_id")
        .eq("admin_user_id", userId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString()),
      (supabase as any)
        .from("dashboard_team")
        .select("owner_user_id,role,accepted_at")
        .eq("member_user_id", userId)
        .not("accepted_at", "is", null),
    ]);

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
    const supportOwnerIds: string[] = Array.from(
      new Set(((grants ?? []) as any[]).map((g) => g.owner_user_id).filter(Boolean)),
    ).filter((id) => id !== userId);

    // 3) Bots from accounts where this user is an active team member
    //    (i.e. they accepted an invite). Owners of those accounts have
    //    granted us seats on their bots — we should show those here so
    //    invited admins/moderators/viewers can manage them.
    const teamOwnerIds: string[] = Array.from(
      new Set(
        ((memberships ?? []) as any[])
          .filter((m) => m.role !== "owner") // skip self-owner row
          .map((m) => m.owner_user_id)
          .filter(Boolean),
      ),
    ).filter((id) => id !== userId);

    const SHARED_COLS =
      "id,user_id,bot_name,bot_description,icon_url,banner_url,base,addons,monthly_hosting,engine_version,status,created_at,submitted_at,delivery_url,source_url,total_amount,deployment_status,railway_service_id,bot_bio,discord_last_username_change_at,activity_type,activity_text,presence_status";
    const [supportRes, teamRes] = await Promise.all([
      supportOwnerIds.length > 0
        ? (supabase as any).from("bot_orders").select(SHARED_COLS).in("user_id", supportOwnerIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      teamOwnerIds.length > 0
        ? (supabase as any).from("bot_orders").select(SHARED_COLS).in("user_id", teamOwnerIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    const supportMapped: OwnedBot[] = ((supportRes?.data ?? []) as any[])
      .filter((row: any) => ACCESS_STATUSES.has(row.status))
      .map((row: any) => mapRow(row, { viaSupport: true }));
    const teamMapped: OwnedBot[] = ((teamRes?.data ?? []) as any[])
      .filter((row: any) => ACCESS_STATUSES.has(row.status))
      .map((row: any) => mapRow(row, { viaTeam: true }));

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

    setBots(ownMapped);
    setSupportBots(supportMapped);
    setTeamBots(teamMapped);
    setOwnsDashboardAddon(ownsDashboardAddon);

    if (looksEmpty && emptyRetriesRef.current < 6) {
      emptyRetriesRef.current += 1;
      setTimeout(() => {
        void reload();
      }, 800 * emptyRetriesRef.current);
    } else if (!looksEmpty) {
      emptyRetriesRef.current = 0;
      // Cache only non-empty results: an auth-race "empty" must never poison
      // the next mount with a bot-less dashboard.
      writeSnapshot(userId, {
        bots: ownMapped,
        supportBots: supportMapped,
        teamBots: teamMapped,
        ownsDashboardAddon,
      });
    }

    hasLoadedRef.current = true;
    setLoading(false);

    // Background maintenance (once per signed-in user), fire-and-forget so it
    // never delays the dashboard:
    //   * claim any pending team invites addressed to this account's email;
    //   * repair any bot whose data was transferred before the fixed flow.
    // If claiming actually accepted an invite, silently re-fetch so the new bot
    // appears without the user refreshing.
    if (claimedForUserRef.current !== userId) {
      claimedForUserRef.current = userId;
      void (async () => {
        let acceptedCount = 0;
        try {
          const { data } = await (supabase as any).rpc("team_accept_invites_for_current_user");
          acceptedCount = typeof data === "number" ? data : 0;
        } catch (e) {
          console.error("team_accept_invites_for_current_user (dashboard) failed", e);
        }
        try {
          await supabase.functions.invoke("heal-bot-data", { body: {} });
        } catch (e) {
          console.error("heal-bot-data failed", e);
        }
        // Grant dashboard access to anyone matching a Discord-member / Discord-role
        // / Roblox-group-rank grant; it materializes team rows we then pick up.
        let grantedCount = 0;
        try {
          const { data: resolved } = await supabase.functions.invoke("team-access-resolve", { body: {} });
          grantedCount = Number((resolved as any)?.granted ?? 0);
        } catch (e) {
          console.error("team-access-resolve failed", e);
        }
        if (acceptedCount > 0 || grantedCount > 0) void reload();
      })();
    }
  }, [userId, authLoading]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Reload the moment the auth session actually settles or its token refreshes.
  // On a cold load the persisted userId is restored before the access token is
  // attached to requests, so the first fetch can come back empty via RLS. The
  // retry loop above covers the first few seconds; this catches the token
  // settling later, which otherwise left the page stuck on "0 bots" until the
  // next background refresh (~2 minutes).
  useEffect(() => {
    const { data: sub } = (supabase as any).auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        emptyRetriesRef.current = 0;
        void reload();
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
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

  // Dashboard access follows OWNERSHIP, not a separate add-on: if you own a
  // bot (bought it or had it transferred to you), you can manage it here.
  // Owners can also grant access to others — those show up as team or
  // support-grant bots. `bots` is already filtered to live (paid/ready)
  // orders, so owning any one of them unlocks the dashboard. Admins always
  // have access. (ownsDashboardAddon is kept for legacy entitlement reads but
  // is no longer required for access.)
  const hasDashboardAccess =
    isAdmin ||
    bots.length > 0 ||
    teamBots.length > 0 ||
    supportBots.length > 0;
  // Support- and team-session bots are always visible — they're the OWNER's
  // bots shared with this viewer. Owned bots are visible whenever the viewer
  // has access (which, per above, they do as soon as they own one).
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

