import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldCheck, LifeBuoy, Lock } from "lucide-react";
import { TeamMembersTab } from "./TeamMembersTab";
import { RolesTab } from "./RolesTab";
import { SupportAccessManager } from "@/components/dashboard/SupportAccessManager";
import { useTeamRole } from "@/hooks/useTeamRole";

export function TeamManagementHub({ ownerUserId }: { ownerUserId?: string | null } = {}) {
  const { user } = useAuth();
  const effectiveOwnerId = ownerUserId ?? user?.id ?? null;
  const viewerIsOwner = !!user && effectiveOwnerId === user.id;

  // Pull effective perms on the owner's account so we can gate tabs.
  const { permissions, role, loading: roleLoading } = useTeamRole(
    viewerIsOwner ? null : effectiveOwnerId,
  );

  // Auto-accept any pending invites for this user (by email match).
  useEffect(() => {
    if (!user) return;
    void (supabase as any).rpc("team_accept_invites_for_current_user");
  }, [user]);

  const canManageTeam = viewerIsOwner || permissions.manage_team;
  // Roles + Support-access screens are part of "manage team" — same gate.
  const canSeeRoles = viewerIsOwner || permissions.manage_team;
  const canSeeSupport = viewerIsOwner || permissions.manage_team;
  // Members tab is at least a roster view — anyone who can view the dashboard
  // (i.e. any team member who can see this hub at all) can see who else is
  // on the team. Write-actions are still gated server-side + client-side.
  const canSeeMembers = viewerIsOwner || permissions.view_dashboard;

  const visibleTabs = [
    canSeeMembers && "members",
    canSeeRoles && "roles",
    canSeeSupport && "support",
  ].filter(Boolean) as string[];

  // No tabs at all → hide the whole hub.
  if (!roleLoading && visibleTabs.length === 0) return null;

  const defaultTab = visibleTabs[0] ?? "members";

  return (
    <Card className="bg-card/40 border-border">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Team management</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Invite teammates, define what each role can do, and let support in temporarily.
          </p>
        </div>
        {!viewerIsOwner && role && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Showing what your role can access
          </div>
        )}
      </div>

      <div className="p-5">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-4">
            {canSeeMembers && (
              <TabsTrigger value="members"><Users className="h-3.5 w-3.5 mr-1.5" />Team members</TabsTrigger>
            )}
            {canSeeRoles && (
              <TabsTrigger value="roles"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Roles</TabsTrigger>
            )}
            {canSeeSupport && (
              <TabsTrigger value="support"><LifeBuoy className="h-3.5 w-3.5 mr-1.5" />Support access</TabsTrigger>
            )}
          </TabsList>
          {canSeeMembers && (
            <TabsContent value="members">
              <TeamMembersTab
                ownerUserId={effectiveOwnerId}
                viewerIsOwner={viewerIsOwner}
                viewerRole={viewerIsOwner ? "owner" : role}
                canManageTeam={canManageTeam}
                canTransferOwnership={viewerIsOwner || permissions.transfer_ownership}
              />
            </TabsContent>
          )}
          {canSeeRoles && <TabsContent value="roles"><RolesTab /></TabsContent>}
          {canSeeSupport && <TabsContent value="support"><SupportAccessManager /></TabsContent>}
        </Tabs>
      </div>
    </Card>
  );
}
