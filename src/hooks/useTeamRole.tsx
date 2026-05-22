import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCached, peekCached, setCached } from "@/lib/swrCache";


export type TeamRole = "owner" | "co_owner" | "admin" | "moderator" | "viewer";

export type TeamPermissions = {
  view_dashboard: boolean;
  edit_bot_config: boolean;
  manage_secrets: boolean;
  view_logs: boolean;
  edit_billing: boolean;
  manage_team: boolean;
  transfer_ownership: boolean;
};

export const DEFAULT_PERMISSIONS: Record<TeamRole, TeamPermissions> = {
  owner:    { view_dashboard: true,  edit_bot_config: true,  manage_secrets: true,  view_logs: true,  edit_billing: true,  manage_team: true,  transfer_ownership: true },
  co_owner: { view_dashboard: true,  edit_bot_config: true,  manage_secrets: true,  view_logs: true,  edit_billing: true,  manage_team: true,  transfer_ownership: false },
  admin:    { view_dashboard: true,  edit_bot_config: true,  manage_secrets: true,  view_logs: true,  edit_billing: false, manage_team: false, transfer_ownership: false },
  moderator:{ view_dashboard: true,  edit_bot_config: true,  manage_secrets: false, view_logs: true,  edit_billing: false, manage_team: false, transfer_ownership: false },
  viewer:   { view_dashboard: true,  edit_bot_config: false, manage_secrets: false, view_logs: false, edit_billing: false, manage_team: false, transfer_ownership: false },
};

const EMPTY: TeamPermissions = {
  view_dashboard: false, edit_bot_config: false, manage_secrets: false,
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

/**
 * Returns the current user's effective role + permissions for a specific bot.
 * If botId is null/undefined, returns null role + empty permissions.
 * Team membership is per-bot: each bot has its own roster of teammates.
 */
export function useTeamRole(botId?: string | null) {
  const { user } = useAuth();
  const cacheKey = user && botId ? `teamRole:${user.id}:${botId}` : null;
  const seed = cacheKey
    ? peekCached<{ role: TeamRole | null; permissions: TeamPermissions }>(cacheKey)
    : undefined;
  const [role, setRole] = useState<TeamRole | null>(seed?.role ?? null);
  const [permissions, setPermissions] = useState<TeamPermissions>(seed?.permissions ?? EMPTY);
  const [loading, setLoading] = useState(!seed);

  const reload = useCallback(async () => {
    if (!user || !botId) {
      setRole(null);
      setPermissions(EMPTY);
      setLoading(false);
      return;
    }
    const { data, error } = await (supabase as any).rpc("team_get_effective_role", {
      _bot_id: botId,
    });
    let nextRole: TeamRole | null = null;
    let nextPerms: TeamPermissions = EMPTY;
    if (!error && data) {
      nextRole = (data.role as TeamRole) ?? null;
      nextPerms = { ...EMPTY, ...(data.permissions ?? {}) };
    }
    setRole(nextRole);
    setPermissions(nextPerms);
    if (cacheKey) setCached(cacheKey, { role: nextRole, permissions: nextPerms });
    setLoading(false);
  }, [user, botId, cacheKey]);

  useEffect(() => {
    // SWR: skip refetch on mount if cache is fresh (<30s).
    if (cacheKey && getCached(cacheKey)) {
      setLoading(false);
      return;
    }
    void reload();
  }, [reload, cacheKey]);

  // Live updates: when team membership for this bot changes, re-resolve.
  useEffect(() => {
    if (!user || !botId) return;
    const suffix = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`team-role-${botId}-${user.id}-${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dashboard_team",
          filter: `bot_id=eq.${botId}`,
        },
        () => { void reload(); },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dashboard_role_permissions",
        },
        () => { void reload(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, botId, reload]);

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
