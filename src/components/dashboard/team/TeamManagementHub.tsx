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

type Props = {
  /** The bot whose team is being managed. */
  botId: string;
  /** The user_id of the bot's owner. */
  ownerUserId: string;
  /** Optional owner email for displaying the owner row when dashboard_team is empty. */
  ownerEmail?: string | null;
};

/**
 * Per-bot team management. Each bot has its own roster — members invited to
 * one bot do not get access to other bots owned by the same person.
 */
export function TeamManagementHub({ botId, ownerUserId, ownerEmail }: Props) {
  const { user } = useAuth();
  const viewerIsOwner = !!user && ownerUserId === user.id;

  // Pull effective perms on this specific bot to gate tabs.
  const { permissions, role, loading: roleLoading } = useTeamRole(
    viewerIsOwner ? null : botId,
  );

  // Auto-accept any pending invites for this user (by email match).
  useEffect(() => {
    if (!user) return;
    void (supabase as any).rpc("team_accept_invites_for_current_user");
  }, [user]);

  const canManageTeam = viewerIsOwner || permissions.manage_team;
  const canSeeRoles = viewerIsOwner; // role/permission matrix is owner-only
  const canSeeSupport = viewerIsOwner || permissions.manage_team;
  const canSeeMembers = viewerIsOwner || permissions.view_dashboard;

  const visibleTabs = [
    canSeeMembers && "members",
    canSeeRoles && "roles",
    canSeeSupport && "support",
  ].filter(Boolean) as string[];

  if (!roleLoading && visibleTabs.length === 0) return null;

  const defaultTab = visibleTabs[0] ?? "members";

  return (
    <Card className="bg-card/40 border-border">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Team for this bot</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Invite teammates to this specific bot. Each bot has its own roster
            — invites here don't apply to your other bots.
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
                botId={botId}
                ownerUserId={ownerUserId}
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
