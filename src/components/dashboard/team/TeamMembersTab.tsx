import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, UserPlus, Crown, Trash2, Copy, ArrowRightLeft } from "lucide-react";
import { ROLE_LABEL, type TeamRole } from "@/hooks/useTeamRole";

type Member = {
  id: string;
  member_email: string;
  member_user_id: string | null;
  role: TeamRole;
  invite_token: string | null;
  invited_at: string;
  accepted_at: string | null;
};

const INVITABLE_ROLES: TeamRole[] = ["co_owner", "admin", "moderator", "viewer"];

export function TeamMembersTab() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Ensure owner row exists for the current user
    await (supabase as any).rpc("ensure_team_owner_row");
    const { data } = await (supabase as any)
      .from("dashboard_team")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("role", { ascending: true })
      .order("invited_at", { ascending: true });
    setMembers((data ?? []) as Member[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  const inviteLink = (token: string | null) =>
    token ? `${window.location.origin}/auth?team_invite=${token}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Team members</h3>
          <p className="text-xs text-muted-foreground">
            Invite people to help manage your bots. Members sign in with the email you invite.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="h-4 w-4 mr-1.5" />Invite member</Button>
          </DialogTrigger>
          <InviteDialog onClose={() => setInviteOpen(false)} onInvited={reload} />
        </Dialog>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
              </TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                No members yet.
              </TableCell></TableRow>
            ) : members.map((m) => {
              const link = inviteLink(m.invite_token);
              const isOwnerRow = m.role === "owner";
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {isOwnerRow && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                    {m.member_email}
                  </TableCell>
                  <TableCell>
                    {isOwnerRow ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                        {ROLE_LABEL.owner}
                      </Badge>
                    ) : (
                      <Select
                        value={m.role}
                        onValueChange={async (v) => {
                          const { data, error } = await (supabase as any).rpc("team_update_member_role", {
                            _member_id: m.id, _role: v,
                          });
                          if (error || !data?.ok) {
                            toast.error(error?.message ?? data?.error ?? "Failed");
                            return;
                          }
                          toast.success("Role updated");
                          reload();
                        }}
                      >
                        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INVITABLE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.accepted_at ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        Active
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          Pending
                        </Badge>
                        {link && (
                          <Button
                            size="sm" variant="ghost" className="h-7 px-2"
                            onClick={async () => {
                              await navigator.clipboard.writeText(link);
                              toast.success("Invite link copied");
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />Link
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.accepted_at
                      ? new Date(m.accepted_at).toLocaleDateString()
                      : `Invited ${new Date(m.invited_at).toLocaleDateString()}`}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isOwnerRow && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm" variant="ghost" className="h-8"
                          disabled={!m.accepted_at}
                          onClick={() => setTransferTarget(m)}
                          title={m.accepted_at ? "Transfer ownership to this member" : "Member must accept invite first"}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />Transfer
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            const { data, error } = await (supabase as any).rpc("team_remove_member", { _member_id: m.id });
                            if (error || !data?.ok) {
                              toast.error(error?.message ?? data?.error ?? "Failed");
                              return;
                            }
                            toast.success("Member removed");
                            reload();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!transferTarget} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll email <strong>{transferTarget?.member_email}</strong> a
              confirmation link. The transfer only happens once they click it
              and sign in. They'll become Owner with full control (including
              billing) and you'll be demoted to Co-Owner. The link expires in
              7 days — you can cancel it before then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!transferTarget) return;
                const { data, error } = await supabase.functions.invoke("team-transfer-send", {
                  body: { memberId: transferTarget.id, siteUrl: window.location.origin },
                });
                if (error || !(data as any)?.ok) {
                  toast.error((error as any)?.message ?? (data as any)?.error ?? "Failed to send confirmation");
                  return;
                }
                toast.success(`Confirmation email sent to ${transferTarget.member_email}`);
                setTransferTarget(null);
                reload();
              }}
            >
              Send confirmation email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialog({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("team-invite-send", {
      body: { email: email.trim(), role, siteUrl: window.location.origin },
    });
    setSubmitting(false);
    if (error || !(data as any)?.ok) {
      toast.error(error?.message ?? (data as any)?.error ?? "Couldn't invite");
      return;
    }
    const link = (data as any).accept_url
      ?? `${window.location.origin}/auth?team_invite=${(data as any).invite_token}`;
    setInviteLink(link);
    toast.success("Invite sent");
    onInvited();
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Invite team member</DialogTitle>
        <DialogDescription>
          Send the invite link to the person you want to add. When they sign in with this email,
          they'll automatically join your team.
        </DialogDescription>
      </DialogHeader>
      {inviteLink ? (
        <div className="space-y-3">
          <Label className="text-xs">Invite link</Label>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
            {inviteLink}
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteLink);
              toast.success("Copied");
            }}
          >
            <Copy className="h-4 w-4 mr-1.5" />Copy link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="mt-1.5"
              maxLength={255}
            />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <DialogFooter>
        {inviteLink ? (
          <Button onClick={() => { setInviteLink(null); setEmail(""); onClose(); }}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={submitting || !email.trim()}>
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Send invite
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
