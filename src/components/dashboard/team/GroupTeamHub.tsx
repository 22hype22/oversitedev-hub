import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOwnedBots, type OwnedBot } from "@/hooks/useOwnedBots";
import { BOT_BASE_LABELS } from "@/lib/botCatalog";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupportAccessManager } from "@/components/dashboard/SupportAccessManager";
import { toast } from "sonner";
import {
  Boxes,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

type Props = {
  /** The user_id of the bot owner viewing this hub. */
  ownerUserId: string;
  /** Owner email — used to render the owner row when desired. */
  ownerEmail?: string | null;
};

type Group = {
  id: string;
  name: string;
  created_at: string;
  bot_count: number;
  member_count: number;
};

type Member = {
  member_email: string;
  member_user_id: string | null;
  role: string;
  is_owner: boolean;
  accepted: boolean;
  accepted_at: string | null;
  invited_at: string | null;
  invite_token: string | null;
};

type TabKey = "members" | "roles" | "support";
type RoleKey = "admin" | "moderator" | "viewer";

const ROLE_OPTIONS: { key: RoleKey; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "moderator", label: "Moderator" },
  { key: "viewer", label: "Viewer" },
];

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "co_owner":
      return "Co-owner";
    case "admin":
      return "Admin";
    case "moderator":
      return "Moderator";
    case "viewer":
      return "Viewer";
    default:
      return role;
  }
}

function roleChipClass(role: string): string {
  switch (role) {
    case "owner":
    case "co_owner":
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "admin":
      return "text-primary bg-primary/10 border-primary/30";
    case "moderator":
      return "text-foreground bg-muted border-border";
    default:
      return "text-muted-foreground bg-muted/60 border-border";
  }
}

export function GroupTeamHub({ ownerUserId, ownerEmail }: Props) {
  const { dashboardBots, loading: botsLoading, reload: reloadBots } = useOwnedBots();

  const ownedBots = useMemo<OwnedBot[]>(
    () =>
      dashboardBots.filter(
        (b) => !b.isDemo && !b.viaTeam && !b.viaSupport,
      ),
    [dashboardBots],
  );

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [tab, setTab] = useState<TabKey>("members");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("group_list");
      if (error) throw error;
      const list = (Array.isArray(data) ? data : []) as Group[];
      setGroups(list);
      setSelectedGroupId((prev) => {
        if (prev && list.some((g) => g.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e: any) {
      toast.error("Couldn't load groups", { description: e?.message });
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const loadMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("team_group_members", {
        _group_id: groupId,
      });
      if (error) throw error;
      setMembers((Array.isArray(data) ? data : []) as Member[]);
    } catch (e: any) {
      toast.error("Couldn't load members", { description: e?.message });
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) void loadMembers(selectedGroupId);
    else setMembers([]);
  }, [selectedGroupId, loadMembers]);

  const handleChangeRole = useCallback(
    async (email: string, role: RoleKey) => {
      if (!selectedGroupId) return;
      try {
        const { data, error } = await (supabase as any).rpc(
          "team_update_member_role_group",
          { _email: email, _role: role, _group_id: selectedGroupId },
        );
        if (error) throw error;
        if (data && data.ok === false) throw new Error("update failed");
        toast.success(`${email} is now ${roleLabel(role)}`);
        await loadMembers(selectedGroupId);
      } catch (e: any) {
        toast.error("Couldn't change role", { description: e?.message });
      }
    },
    [selectedGroupId, loadMembers],
  );

  const handleRemove = useCallback(
    async (email: string) => {
      if (!selectedGroupId) return;
      try {
        const { data, error } = await (supabase as any).rpc(
          "team_remove_member_group",
          { _email: email, _group_id: selectedGroupId },
        );
        if (error) throw error;
        if (data && data.ok === false) throw new Error("remove failed");
        toast.success(`Removed ${email}`);
        await loadMembers(selectedGroupId);
      } catch (e: any) {
        toast.error("Couldn't remove member", { description: e?.message });
      }
    },
    [selectedGroupId, loadMembers],
  );

  const onGroupCreated = useCallback(
    async (newId: string | null) => {
      await Promise.all([loadGroups(), reloadBots()]);
      if (newId) setSelectedGroupId(newId);
    },
    [loadGroups, reloadBots],
  );

  const onBotsManaged = useCallback(async () => {
    await Promise.all([loadGroups(), reloadBots()]);
    if (selectedGroupId) await loadMembers(selectedGroupId);
  }, [loadGroups, reloadBots, selectedGroupId, loadMembers]);

  const loading = groupsLoading || botsLoading;

  return (
    <Card className="bg-card/40 border-border overflow-visible">
      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-4 flex-wrap border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
            <Boxes className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">Your team</div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              Each group has its own bots and its own team. People only see the
              group they're in.
            </p>
          </div>
        </div>

        {/* Group dropdown */}
        {groups.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-[190px] justify-start gap-2.5 bg-muted/40"
              >
                <span className="h-5 w-5 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
                  <Boxes className="h-3 w-3" />
                </span>
                <span className="flex-1 text-left truncate font-semibold">
                  {selectedGroup?.name ?? "Select group"}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {selectedGroup?.bot_count ?? 0} bots
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {groups.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onSelect={() => setSelectedGroupId(g.id)}
                  className="gap-2.5"
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-md grid place-items-center shrink-0",
                      g.id === selectedGroupId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Boxes className="h-3 w-3" />
                  </span>
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {g.bot_count} bots
                  </span>
                  {g.id === selectedGroupId && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setCreateOpen(true)}
                className="gap-2 text-primary font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                New group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {loading && groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Loading…
          </div>
        ) : groups.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-6 border-b border-border">
              {(
                [
                  ["members", "Members"],
                  ["roles", "Roles"],
                  ["support", "Support access"],
                ] as [TabKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "relative -mb-px pb-3 text-sm font-semibold transition-colors",
                    tab === key
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  {tab === key && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="pt-5">
              {tab === "members" && (
                <MembersTab
                  group={selectedGroup}
                  members={members}
                  loading={membersLoading}
                  onInvite={() => setInviteOpen(true)}
                  onManageBots={() => setManageOpen(true)}
                  onChangeRole={handleChangeRole}
                  onRemove={handleRemove}
                />
              )}
              {tab === "roles" && <RolesMatrix />}
              {tab === "support" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Account-wide, and only ever for the Oversite team — never
                    your invited members.
                  </p>
                  <SupportAccessManager />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <InviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        groupId={selectedGroupId}
        groupName={selectedGroup?.name ?? ""}
        onInvited={() => selectedGroupId && loadMembers(selectedGroupId)}
      />

      <BotChecklistModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        bots={ownedBots}
        groups={groups}
        onCreated={onGroupCreated}
      />

      <BotChecklistModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        mode="manage"
        bots={ownedBots}
        groups={groups}
        group={selectedGroup}
        onManaged={onBotsManaged}
      />
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="py-12 text-center space-y-3">
      <div className="h-12 w-12 rounded-xl bg-muted grid place-items-center mx-auto">
        <Boxes className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <div className="font-semibold">No groups yet</div>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Bundle your bots into a group to give it its own team. People you
          invite only see the group they're in.
        </p>
      </div>
      <Button onClick={onCreate} className="mt-1">
        <Plus className="h-4 w-4 mr-1.5" />
        Create a group
      </Button>
    </div>
  );
}

function MembersTab({
  group,
  members,
  loading,
  onInvite,
  onManageBots,
  onChangeRole,
  onRemove,
}: {
  group: Group | null;
  members: Member[];
  loading: boolean;
  onInvite: () => void;
  onManageBots: () => void;
  onChangeRole: (email: string, role: RoleKey) => void;
  onRemove: (email: string) => void;
}) {
  const botCount = group?.bot_count ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="font-semibold">{group?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {botCount} bot{botCount === 1 ? "" : "s"} ·{" "}
            <button
              type="button"
              onClick={onManageBots}
              className="text-primary hover:underline"
            >
              Manage bots
            </button>
          </div>
        </div>
        <Button size="sm" onClick={onInvite}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Invite
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Loading members…
        </div>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No members yet.
        </p>
      ) : (
        <div className="flex flex-col">
          {members.map((m) => (
            <MemberRow
              key={m.member_email}
              member={m}
              onChangeRole={onChangeRole}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  onChangeRole,
  onRemove,
}: {
  member: Member;
  onChangeRole: (email: string, role: RoleKey) => void;
  onRemove: (email: string) => void;
}) {
  const initial = (member.member_email[0] ?? "?").toUpperCase();
  const isPending = !member.accepted && !member.is_owner;

  const statusLine = member.is_owner
    ? "Owner"
    : isPending
    ? "Invite pending"
    : member.accepted_at
    ? `Active · joined ${new Date(member.accepted_at).toLocaleDateString()}`
    : "Active";

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3.5 border-t border-border first:border-t-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "h-8 w-8 rounded-lg grid place-items-center shrink-0 text-xs font-bold",
            member.is_owner
              ? "bg-amber-500/20 text-amber-300"
              : "bg-muted text-foreground",
          )}
        >
          {initial}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {member.member_email}
          </div>
          <div
            className={cn(
              "text-[11px] mt-0.5 flex items-center gap-1.5",
              member.is_owner
                ? "text-amber-400"
                : isPending
                ? "text-amber-400"
                : "text-emerald-400",
            )}
          >
            {!member.is_owner && (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isPending ? "bg-amber-400" : "bg-emerald-400",
                )}
              />
            )}
            {statusLine}
          </div>
        </div>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "justify-self-end font-semibold tracking-wide",
          roleChipClass(member.role),
        )}
      >
        {roleLabel(member.role)}
      </Badge>

      <div className="flex gap-1.5 justify-end min-w-[74px]">
        {member.is_owner ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : isPending ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => toast.success(`Invite resent to ${member.member_email}`)}
            >
              Resend
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Cancel invite"
              onClick={() => onRemove(member.member_email)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 text-muted-foreground"
                  title="Change role"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {ROLE_OPTIONS.map((r) => (
                  <DropdownMenuItem
                    key={r.key}
                    onSelect={() => onChangeRole(member.member_email, r.key)}
                  >
                    {r.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Remove"
              onClick={() => onRemove(member.member_email)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function RolesMatrix() {
  const rows: { label: string; admin: boolean; mod: boolean; viewer: boolean }[] = [
    { label: "Edit bot config", admin: true, mod: true, viewer: false },
    { label: "Manage billing", admin: true, mod: false, viewer: false },
    { label: "Invite & remove members", admin: true, mod: false, viewer: false },
    { label: "View logs & activity", admin: true, mod: true, viewer: true },
  ];
  const Cell = ({ on }: { on: boolean }) =>
    on ? (
      <Check className="h-4 w-4 text-emerald-400 mx-auto" />
    ) : (
      <X className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
    );
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        Roles mean the same in every group. Assign a member's role on the
        Members tab. Owner always has full access.
      </p>
      <div className="flex flex-col">
        <div className="grid grid-cols-[1.5fr_repeat(3,1fr)] items-center py-3 text-xs font-semibold text-foreground">
          <div>Permission</div>
          <div className="text-center">Admin</div>
          <div className="text-center">Mod</div>
          <div className="text-center">Viewer</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[1.5fr_repeat(3,1fr)] items-center py-3 border-t border-border"
          >
            <div className="text-sm text-foreground">{r.label}</div>
            <div className="text-center">
              <Cell on={r.admin} />
            </div>
            <div className="text-center">
              <Cell on={r.mod} />
            </div>
            <div className="text-center">
              <Cell on={r.viewer} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteModal({
  open,
  onOpenChange,
  groupId,
  groupName,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string | null;
  groupName: string;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleKey>("moderator");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("moderator");
    }
  }, [open]);

  const send = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email");
      return;
    }
    if (!groupId) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("team-invite-send", {
        body: { email: trimmed, role, groupId },
      });
      if (error) throw error;
      toast.success(`Invite sent to ${trimmed}`);
      onOpenChange(false);
      onInvited();
    } catch (e: any) {
      toast.error("Couldn't send invite", { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {groupName}</DialogTitle>
          <DialogDescription>
            They'll get an email to sign in, and can only manage this group's
            bots.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              autoComplete="off"
              className="mt-1.5"
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key)}
                  className={cn(
                    "py-2 rounded-md border text-xs font-semibold transition-colors",
                    role === r.key
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending}>
            {sending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BotChecklistModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bots: OwnedBot[];
  groups: Group[];
} & (
  | { mode: "create"; group?: undefined; onCreated: (id: string | null) => void; onManaged?: undefined }
  | { mode: "manage"; group: Group | null; onManaged: () => void; onCreated?: undefined }
)) {
  const { open, onOpenChange, bots, groups, mode } = props;
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const groupId = mode === "manage" ? props.group?.id ?? null : null;

  const groupName = (id: string | null) =>
    id ? groups.find((g) => g.id === id)?.name ?? "another group" : null;

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setName("");
      setSelected(new Set());
    } else {
      // Pre-check the bots already in this group.
      setSelected(
        new Set(bots.filter((b) => b.group_id === groupId).map((b) => b.id)),
      );
    }
  }, [open, mode, bots, groupId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "create") {
        const trimmed = name.trim();
        if (!trimmed) {
          toast.error("Name your group");
          setBusy(false);
          return;
        }
        const { data, error } = await (supabase as any).rpc("group_create", {
          _name: trimmed,
          _bot_ids: Array.from(selected),
        });
        if (error) throw error;
        if (data && data.ok === false) throw new Error("create failed");
        toast.success(`Group "${trimmed}" created`);
        onOpenChange(false);
        props.onCreated?.(data?.id ?? null);
      } else {
        if (!groupId) return;
        const { data, error } = await (supabase as any).rpc("group_set_bots", {
          _group_id: groupId,
          _bot_ids: Array.from(selected),
        });
        if (error) throw error;
        if (data && data.ok === false) throw new Error("update failed");
        toast.success("Bots updated");
        onOpenChange(false);
        props.onManaged?.();
      }
    } catch (e: any) {
      toast.error(
        mode === "create" ? "Couldn't create group" : "Couldn't update bots",
        { description: e?.message },
      );
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || (mode === "create" && name.trim().length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New group" : "Manage bots"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Bundle bots for a server and give it its own team."
              : "Choose which of your bots belong to this group."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {mode === "create" && (
            <div>
              <Label className="text-xs">Group name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Trading Server"
                autoComplete="off"
                className="mt-1.5"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Bots in this group</Label>
              <span className="text-[11px] text-primary font-mono">
                {selected.size} selected
              </span>
            </div>
            {bots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                You don't have any bots yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[40vh] overflow-auto">
                {bots.map((b) => {
                  const on = selected.has(b.id);
                  const otherGroup =
                    b.group_id && b.group_id !== groupId
                      ? groupName(b.group_id)
                      : null;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggle(b.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                        on
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <span className="h-8 w-8 rounded-md bg-muted text-primary grid place-items-center shrink-0">
                        <Boxes className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-foreground truncate">
                          {b.bot_name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {BOT_BASE_LABELS[b.base] ?? b.base}
                        </span>
                      </span>
                      {otherGroup && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 shrink-0">
                          in {otherGroup}
                        </span>
                      )}
                      <span
                        className={cn(
                          "h-5 w-5 rounded-md border grid place-items-center shrink-0",
                          on
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between items-center">
          <span className="text-[11px] text-muted-foreground hidden sm:block">
            A bot can only live in one group.
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={disabled}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {mode === "create" ? "Create group" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
