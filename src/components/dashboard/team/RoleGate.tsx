import { ReactNode } from "react";
import { useTeamRole, type TeamPermissions } from "@/hooks/useTeamRole";

type Props = {
  permission: keyof TeamPermissions;
  ownerUserId?: string | null;
  fallback?: ReactNode;
  children: ReactNode;
};

/** Renders children only if the current user has the given permission on the owner's account. */
export function RoleGate({ permission, ownerUserId, fallback = null, children }: Props) {
  const { permissions, loading } = useTeamRole(ownerUserId);
  if (loading) return null;
  if (!permissions[permission]) return <>{fallback}</>;
  return <>{children}</>;
}
