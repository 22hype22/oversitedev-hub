import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldCheck, LifeBuoy } from "lucide-react";
import { TeamMembersTab } from "./TeamMembersTab";
import { RolesTab } from "./RolesTab";
import { SupportAccessManager } from "@/components/dashboard/SupportAccessManager";

export function TeamManagementHub({ ownerUserId }: { ownerUserId?: string | null } = {}) {
  const { user } = useAuth();
  const effectiveOwnerId = ownerUserId ?? user?.id ?? null;
  const viewerIsOwner = !!user && effectiveOwnerId === user.id;

  // Auto-accept any pending invites for this user (by email match).
  useEffect(() => {
    if (!user) return;
    void (supabase as any).rpc("team_accept_invites_for_current_user");
  }, [user]);

  return (
    <Card className="bg-card/40 border-border">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="font-semibold">Team management</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Invite teammates, define what each role can do, and let support in temporarily.
          </p>
        </div>
      </div>

      <div className="p-5">
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="members"><Users className="h-3.5 w-3.5 mr-1.5" />Team members</TabsTrigger>
            <TabsTrigger value="roles"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Roles</TabsTrigger>
            <TabsTrigger value="support"><LifeBuoy className="h-3.5 w-3.5 mr-1.5" />Support access</TabsTrigger>
          </TabsList>
          <TabsContent value="members"><TeamMembersTab ownerUserId={effectiveOwnerId} viewerIsOwner={viewerIsOwner} /></TabsContent>
          <TabsContent value="roles"><RolesTab /></TabsContent>
          <TabsContent value="support"><SupportAccessManager /></TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
