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
import { toast } from "sonner";
import { Loader2, UserPlus, Crown, Trash2, Copy, ArrowRightLeft } from "lucide-react";
import { ROLE_LABEL, ROLE_RANK, rolesAssignableBy, type TeamRole } from "@/hooks/useTeamRole";

type Member = {
  id: string;
  member_email: string;
  member_user_id: string | null;
  role: TeamRole;
  invite_token: string | null;
  invited_at: string;
  accepted_at: string | null;
};

export function TeamMembersTab({
  ownerUserId,
  viewerIsOwner = true,
  viewerRole = null,
  canManageTeam = true,
  canTransferOwnership = true,
}: {
  ownerUserId?: string | null;
  viewerIsOwner?: boolean;
  viewerRole?: TeamRole | null;
  canManageTeam?: boolean;
  canTransferOwnership?: boolean;
} = {}) {
  const { user } = useAuth();
  const targetOwnerId = ownerUserId ?? user?.id ?? null;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);

  // Roles this viewer is allowed to assign / invite at.
  const effectiveViewerRole: TeamRole = viewerIsOwner ? "owner" : (viewerRole ?? "viewer");
  const assignableRoles = rolesAssignableBy(effectiveViewerRole);
  const viewerRank = ROLE_RANK[effectiveViewerRole];

  const reload = useCallback(async () => {
    if (!targetOwnerId) return;
    setLoading(true);
    // Only the owner themselves needs the safety-net owner row ensured.
    if (viewerIsOwner) {
      await (supabase as any).rpc("ensure_team_owner_row");
    }
    const { data } = await (supabase as any)
      .from("dashboard_team")
      .select("*")
      .eq("owner_user_id", targetOwnerId);
    const sorted = ((data ?? []) as Member[]).slice().sort((a, b) => {
      const rankDiff = (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return (a.member_email ?? "").localeCompare(b.member_email ?? "");
    });
    setMembers(sorted);
    setLoading(false);
  }, [targetOwnerId, viewerIsOwner]);

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
        {canManageTeam && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4 mr-1.5" />Invite member</Button>
            </DialogTrigger>
            <InviteDialog
              onClose={() => setInviteOpen(false)}
              onInvited={reload}
              assignableRoles={assignableRoles}
            />
          </Dialog>
        )}
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
                    ) : !canManageTeam ? (
                      <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
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
                          {assignableRoles.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                          {/* Show the member's current role even if it's above
                              this viewer's assignable ceiling, but as a disabled
                              option so they can see it but not pick it. */}
                          {!assignableRoles.includes(m.role) && (
                            <SelectItem key={m.role} value={m.role} disabled>
                              {ROLE_LABEL[m.role]} (above your level)
                            </SelectItem>
                          )}
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
                    {!isOwnerRow && (canManageTeam || canTransferOwnership) && (
                      <div className="flex items-center justify-end gap-1">
                        {canTransferOwnership && (
                          <Button
                            size="sm" variant="ghost" className="h-8"
                            disabled={!m.accepted_at}
                            onClick={() => setTransferTarget(m)}
                            title={m.accepted_at ? "Transfer ownership to this member" : "Member must accept invite first"}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />Transfer
                          </Button>
                        )}
                        {canManageTeam && ROLE_RANK[m.role] <= viewerRank && (
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
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TransferBotsDialog
        target={transferTarget}
        ownerUserId={targetOwnerId}
        onClose={() => setTransferTarget(null)}
        onDone={() => { setTransferTarget(null); reload(); }}
      />
    </div>
  );
}

function TransferBotsDialog({
  target,
  ownerUserId,
  onClose,
  onDone,
}: {
  target: Member | null;
  ownerUserId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [bots, setBots] = useState<Array<{ id: string; bot_name: string }>>([]);
  const [loadingBots, setLoadingBots] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!target || !ownerUserId) return;
    setStep("pick");
    setSelected(new Set());
    setLoadingBots(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("bot_orders")
        .select("id,bot_name,status")
        .eq("user_id", ownerUserId)
        .in("status", ["paid", "ready"])
        .order("created_at", { ascending: true });
      setBots(((data ?? []) as any[]).map((b) => ({ id: b.id, bot_name: b.bot_name })));
      setLoadingBots(false);
    })();
  }, [target, ownerUserId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedBots = bots.filter((b) => selected.has(b.id));

  const send = async () => {
    if (!target || selected.size === 0) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("team-transfer-send", {
      body: {
        memberId: target.id,
        siteUrl: window.location.origin,
        botIds: Array.from(selected),
      },
    });
    setSubmitting(false);
    if (error || !(data as any)?.ok) {
      toast.error((error as any)?.message ?? (data as any)?.error ?? "Failed to send confirmation");
      return;
    }
    toast.success(`Confirmation email sent to ${target.member_email}`);
    onDone();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "pick" ? "Choose bots to transfer" : "Transfer ownership?"}
          </DialogTitle>
          <DialogDescription>
            {step === "pick" ? (
              <>
                Select the bots you want to transfer to{" "}
                <strong>{target?.member_email}</strong>. Only the bots you
                check will move to their account — the rest stay with you.
              </>
            ) : (
              <>
                We'll email <strong>{target?.member_email}</strong> a
                confirmation link. Once they confirm and sign in, ownership of
                the selected {selected.size === 1 ? "bot" : `${selected.size} bots`} will
                transfer to them. The link expires in 7 days — you can cancel
                it before then.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {loadingBots ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading bots…
              </div>
            ) : bots.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                You don't have any transferable bots.
              </div>
            ) : (
              bots.map((b) => {
                const checked = selected.has(b.id);
                return (
                  <label
                    key={b.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(b.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm font-medium">{b.bot_name}</span>
                  </label>
                );
              })
            )}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <div className="font-semibold mb-1">Bots being transferred:</div>
            <ul className="list-disc list-inside space-y-0.5">
              {selectedBots.map((b) => (
                <li key={b.id}>{b.bot_name}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {step === "pick" ? (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={selected.size === 0 || loadingBots}
              >
                Continue ({selected.size})
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("pick")}>Back</Button>
              <Button onClick={send} disabled={submitting}>
                {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Send confirmation email
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  onClose,
  onInvited,
  assignableRoles,
}: {
  onClose: () => void;
  onInvited: () => void;
  assignableRoles: TeamRole[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>(
    assignableRoles.includes("viewer") ? "viewer" : (assignableRoles[assignableRoles.length - 1] ?? "viewer"),
  );
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
                {assignableRoles.map((r) => (
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
