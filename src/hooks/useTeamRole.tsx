import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";



export type TeamRole = "owner" | "co_owner" | "admin" | "moderator" | "viewer";

export type TeamPermissions = {
  view_dashboard: boolean;
  edit_bot_config: boolean;
  manage_secrets: boolean;
  manage_settings: boolean;
  view_logs: boolean;
  edit_billing: boolean;
  manage_team: boolean;
  transfer_ownership: boolean;
};

export const DEFAULT_PERMISSIONS: Record<TeamRole, TeamPermissions> = {
  owner:    { view_dashboard: true,  edit_bot_config: true,  manage_secrets: true,  manage_settings: true,  view_logs: true,  edit_billing: true,  manage_team: true,  transfer_ownership: true },
  co_owner: { view_dashboard: true,  edit_bot_config: true,  manage_secrets: true,  manage_settings: true,  view_logs: true,  edit_billing: true,  manage_team: true,  transfer_ownership: false },
  admin:    { view_dashboard: true,  edit_bot_config: true,  manage_secrets: true,  manage_settings: true,  view_logs: true,  edit_billing: false, manage_team: false, transfer_ownership: false },
  moderator:{ view_dashboard: true,  edit_bot_config: true,  manage_secrets: false, manage_settings: false, view_logs: true,  edit_billing: false, manage_team: false, transfer_ownership: false },
  viewer:   { view_dashboard: true,  edit_bot_config: false, manage_secrets: false, manage_settings: false, view_logs: false, edit_billing: false, manage_team: false, transfer_ownership: false },
};

const EMPTY: TeamPermissions = {
  view_dashboard: false, edit_bot_config: false, manage_secrets: false, manage_settings: false,
  view_logs: false, edit_billing: false, manage_team: false, transfer_ownership: false,
};

export const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  co_owner: "Co-Owner",
  admin: "Admin",
  moderator: "Moderator",
  viewer: "Viewer",
};

/** Higher rank = more authority. Used to gate invite/assign-role choices. */
export const ROLE_RANK: Record<TeamRole, number> = {
  owner: 100,
  co_owner: 80,
  admin: 60,
  moderator: 40,
  viewer: 20,
};

/** Returns the list of roles the given role is allowed to invite/assign. */
export function rolesAssignableBy(role: TeamRole | null): TeamRole[] {
  if (!role) return [];
  const ceiling = ROLE_RANK[role];
  const candidates: TeamRole[] = ["co_owner", "admin", "moderator", "viewer"];
  return candidates.filter((r) => ROLE_RANK[r] <= ceiling);
}

type Resolved = { role: TeamRole | null; permissions: TeamPermissions };

// The effective role is resolved by an edge function. A bot page mounts this
// hook from many places (every add-on block, the secrets card, the team hub,
// the read-only scope), so the answer is shared: one request in flight per
// user+bot, the last answer kept for the next mount, and one realtime channel
// per bot that invalidates the shared answer for every subscriber at once.
const roleCache = new Map<string, Resolved>();
const roleInflight = new Map<string, Promise<Resolved>>();
const roleListeners = new Map<string, Set<(r: Resolved) => void>>();
const roleChannels = new Map<string, { channel: ReturnType<typeof supabase.channel>; refs: number }>();

async function resolveRole(userId: string, botId: string, force = false): Promise<Resolved> {
  const key = `${userId}:${botId}`;
  const cached = roleCache.get(key);
  if (cached && !force) return cached;
  const pending = roleInflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    // Resolved by an auto-deploying edge function (service role) so it works
    // regardless of whether the old team_get_effective_role migration deployed.
    const { data, error } = await supabase.functions.invoke("team-effective-role", {
      body: { botId },
    });
    const next: Resolved =
      !error && data
        ? {
            role: ((data as any).role as TeamRole) ?? null,
            permissions: { ...EMPTY, ...((data as any).permissions ?? {}) },
          }
        : { role: null, permissions: EMPTY };
    roleCache.set(key, next);
    roleListeners.get(key)?.forEach((fn) => fn(next));
    return next;
  })();
  roleInflight.set(key, p);
  p.finally(() => {
    if (roleInflight.get(key) === p) roleInflight.delete(key);
  });
  return p;
}

function subscribeRole(userId: string, botId: string, fn: (r: Resolved) => void): () => void {
  const key = `${userId}:${botId}`;
  let set = roleListeners.get(key);
  if (!set) {
    set = new Set();
    roleListeners.set(key, set);
  }
  set.add(fn);

  // Live updates: when team membership for this bot or the owner's
  // permission matrix changes, re-resolve once for everyone listening.
  let entry = roleChannels.get(key);
  if (!entry) {
    const suffix = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`team-role-${botId}-${userId}-${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dashboard_team", filter: `bot_id=eq.${botId}` },
        () => { void resolveRole(userId, botId, true); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dashboard_role_permissions" },
        () => { void resolveRole(userId, botId, true); },
      )
      .subscribe();
    entry = { channel, refs: 0 };
    roleChannels.set(key, entry);
  }
  entry.refs += 1;

  return () => {
    set?.delete(fn);
    const e = roleChannels.get(key);
    if (e) {
      e.refs -= 1;
      if (e.refs <= 0) {
        supabase.removeChannel(e.channel);
        roleChannels.delete(key);
      }
    }
  };
}

/**
 * Returns the current user's effective role + permissions for a specific bot.
 * If botId is null/undefined, returns null role + empty permissions.
 * Team membership is per-bot: each bot has its own roster of teammates.
 */
export function useTeamRole(botId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const seeded = userId && botId ? roleCache.get(`${userId}:${botId}`) : undefined;
  const [role, setRole] = useState<TeamRole | null>(seeded?.role ?? null);
  const [permissions, setPermissions] = useState<TeamPermissions>(seeded?.permissions ?? EMPTY);
  const [loading, setLoading] = useState(!seeded);

  const reload = useCallback(async () => {
    if (!userId || !botId) {
      setRole(null);
      setPermissions(EMPTY);
      setLoading(false);
      return;
    }
    const next = await resolveRole(userId, botId, true);
    setRole(next.role);
    setPermissions(next.permissions);
    setLoading(false);
  }, [userId, botId]);

  useEffect(() => {
    if (!userId || !botId) {
      setRole(null);
      setPermissions(EMPTY);
      setLoading(false);
      return;
    }
    let active = true;
    const apply = (r: Resolved) => {
      if (!active) return;
      setRole(r.role);
      setPermissions(r.permissions);
      setLoading(false);
    };
    const unsubscribe = subscribeRole(userId, botId, apply);
    const cached = roleCache.get(`${userId}:${botId}`);
    if (cached) apply(cached);
    void resolveRole(userId, botId).then(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, botId]);

  return useMemo(
    () => ({
      role,
      permissions,
      loading,
      isOwner: role === "owner",
      canEdit: permissions.edit_bot_config,
      reload,
    }),
    [role, permissions, loading, reload],
  );
}
