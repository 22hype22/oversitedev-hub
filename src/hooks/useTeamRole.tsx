import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

/**
 * Returns the current user's effective role + permissions for the given owner account.
 * If ownerUserId is undefined, defaults to the current user (i.e. they're the owner).
 */
export function useTeamRole(ownerUserId?: string | null) {
  const { user } = useAuth();
  const [role, setRole] = useState<TeamRole | null>(null);
  const [permissions, setPermissions] = useState<TeamPermissions>(EMPTY);
  const [loading, setLoading] = useState(true);

  const targetOwner = ownerUserId ?? user?.id ?? null;

  const reload = useCallback(async () => {
    if (!user || !targetOwner) {
      setRole(null);
      setPermissions(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("team_get_effective_role", {
      _owner_user_id: targetOwner,
    });
    if (error || !data) {
      // fallback: if same user, treat as owner
      if (user.id === targetOwner) {
        setRole("owner");
        setPermissions(DEFAULT_PERMISSIONS.owner);
      } else {
        setRole(null);
        setPermissions(EMPTY);
      }
    } else {
      setRole((data.role as TeamRole) ?? null);
      setPermissions({ ...EMPTY, ...(data.permissions ?? {}) });
    }
    setLoading(false);
  }, [user, targetOwner]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
