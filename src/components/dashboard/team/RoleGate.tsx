import { ReactNode } from "react";
import { useTeamRole, type TeamPermissions } from "@/hooks/useTeamRole";

type Props = {
  permission: keyof TeamPermissions;
  /** The bot whose team membership should be checked. */
  botId?: string | null;
  fallback?: ReactNode;
  children: ReactNode;
};

/** Renders children only if the current user has the given permission on this bot. */
export function RoleGate({ permission, botId, fallback = null, children }: Props) {
  const { permissions, loading } = useTeamRole(botId);
  if (loading) return null;
  if (!permissions[permission]) return <>{fallback}</>;
  return <>{children}</>;
}
