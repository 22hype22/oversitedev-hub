import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOwnedBots, type OwnedBot } from "@/hooks/useOwnedBots";
import { DEFAULT_PERMISSIONS, type TeamRole, type TeamPermissions } from "@/hooks/useTeamRole";
import { BOT_BASE_LABELS } from "@/lib/botCatalog";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function roleClass(role: string): "owner" | "admin" | "mod" | "viewer" {
  switch (role) {
    case "owner":
      return "owner";
    case "co_owner":
    case "admin":
      return "admin";
    case "moderator":
      return "mod";
    default:
      return "viewer";
  }
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/* ------------------------------ inline icons ------------------------------ */

const BoxIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
  </svg>
);
const CaretIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const TickIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="m5 12 5 5L20 7" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const InviteIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M19 8v6M22 11h-6" />
  </svg>
);
const PencilIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const NopeIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z" />
  </svg>
);
const BotIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="4" y="8" width="16" height="11" rx="3" />
    <path d="M12 8V4M9 13h.01M15 13h.01" />
  </svg>
);
const CopyIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/* ------------------------------- component -------------------------------- */

export function GroupTeamHub({ ownerUserId, ownerEmail }: Props) {
  void ownerUserId;
  void ownerEmail;
  const { dashboardBots, loading: botsLoading, reload: reloadBots } =
    useOwnedBots();

  const ownedBots = useMemo<OwnedBot[]>(
    () => dashboardBots.filter((b) => !b.isDemo && !b.viaTeam && !b.viaSupport),
    [dashboardBots],
  );

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [tab, setTab] = useState<TabKey>("members");

  const [ddOpen, setDdOpen] = useState(false);
  const [roleMenuEmail, setRoleMenuEmail] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("group_list");
      if (error) throw error;
      // Hide the auto-created default "Oversite" group — only show groups the
      // owner actually made.
      const list = ((Array.isArray(data) ? data : []) as Group[]).filter(
        (g) => (g.name ?? "").trim().toLowerCase() !== "oversite",
      );
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

  // Close dropdown / role menus on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setDdOpen(false);
        setRoleMenuEmail(null);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const handleChangeRole = useCallback(
    async (email: string, role: RoleKey) => {
      if (!selectedGroupId) return;
      setRoleMenuEmail(null);
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

  const groupName = useCallback(
    (id: string | null) =>
      id ? groups.find((g) => g.id === id)?.name ?? null : null,
    [groups],
  );

  const loading = groupsLoading || botsLoading;
  const botCount = selectedGroup?.bot_count ?? 0;
  const botNames =
    ownedBots
      .filter((b) => b.group_id === selectedGroupId)
      .map((b) => b.bot_name)
      .join(", ") || "No bots yet";

  return (
    <div className="gth" ref={rootRef}>
      <style>{GTH_CSS}</style>

      <div className="card">
        <div className="inner">
          {/* Header */}
          <div className="top">
            <div className="ttl">
              <h2>Your team</h2>
              <p>
                Each group has its own bots and its own team. People only see the
                group they're in.
              </p>
            </div>

            {groups.length > 0 && (
              <div className={"dd" + (ddOpen ? " open" : "")}>
                <button
                  className="ddbtn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDdOpen((v) => !v);
                  }}
                >
                  <span className="gi">
                    <BoxIcon />
                  </span>
                  <span className="lab">
                    {selectedGroup?.name ?? "Select group"}
                  </span>
                  <span className="n">{botCount} bots</span>
                  <span className="car">
                    <CaretIcon />
                  </span>
                </button>
                <div className="ddmenu">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className={"ddi" + (g.id === selectedGroupId ? " on" : "")}
                      onClick={() => {
                        setSelectedGroupId(g.id);
                        setDdOpen(false);
                      }}
                    >
                      <span className="gi">
                        <BoxIcon />
                      </span>
                      <span className="nm">{g.name}</span>
                      <span className="ct">{g.bot_count} bots</span>
                      <span className="tick">
                        <TickIcon />
                      </span>
                    </div>
                  ))}
                  <div className="ddsep" />
                  <div
                    className="ddnew"
                    onClick={() => {
                      setDdOpen(false);
                      setCreateOpen(true);
                    }}
                  >
                    <PlusIcon />
                    New group
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Body */}
          {loading && groups.length === 0 ? (
            <div className="loading">Loading…</div>
          ) : groups.length === 0 ? (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          ) : (
            <>
              <div className="tabs">
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
                    className={"tab" + (tab === key ? " on" : "")}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Members */}
              <div className={"pane" + (tab === "members" ? " on" : "")}>
                <div className="mhead">
                  <div>
                    <div className="h">{selectedGroup?.name ?? "—"}</div>
                    <div className="sub">
                      {botNames} ·{" "}
                      <a onClick={() => setManageOpen(true)}>Manage bots</a>
                    </div>
                  </div>
                  <button
                    className="btnp"
                    type="button"
                    onClick={() => setInviteOpen(true)}
                  >
                    <InviteIcon />
                    Invite
                  </button>
                </div>

                {membersLoading ? (
                  <div className="loading sm">Loading members…</div>
                ) : members.length === 0 ? (
                  <div className="loading sm">No members yet.</div>
                ) : (
                  <div className="list">
                    {members.map((m) => (
                      <MemberRow
                        key={m.member_email}
                        member={m}
                        menuOpen={roleMenuEmail === m.member_email}
                        onToggleMenu={() =>
                          setRoleMenuEmail((prev) =>
                            prev === m.member_email ? null : m.member_email,
                          )
                        }
                        onChangeRole={handleChangeRole}
                        onRemove={handleRemove}
                        onTransfer={(email) => { setRoleMenuEmail(null); setTransferEmail(email); }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Roles */}
              <div className={"pane" + (tab === "roles" ? " on" : "")}>
                <RolesMatrix ownerUserId={ownerUserId} groupId={selectedGroupId} />
              </div>

              {/* Support */}
              <div className={"pane" + (tab === "support" ? " on" : "")}>
                <div className="note">
                  Account-wide, and only ever for the Oversite team — never your
                  invited members.
                </div>
                <GroupSupportAccess />
              </div>
            </>
          )}
        </div>
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={selectedGroupId}
        groupName={selectedGroup?.name ?? ""}
        onInvited={() => selectedGroupId && loadMembers(selectedGroupId)}
      />

      <BotPickerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        bots={ownedBots}
        groupName={groupName}
        onCreated={onGroupCreated}
      />

      <BotPickerModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        mode="manage"
        bots={ownedBots}
        groupId={selectedGroupId}
        groupName={groupName}
        onManaged={onBotsManaged}
      />

      {transferEmail && (
        <TransferModal
          email={transferEmail}
          ownerUserId={ownerUserId}
          groupLabel={groupName(selectedGroupId) ?? "this group"}
          groupBotIds={ownedBots.filter((b) => b.group_id === selectedGroupId).map((b) => b.id)}
          onClose={() => setTransferEmail(null)}
          onDone={() => selectedGroupId && loadMembers(selectedGroupId)}
        />
      )}
    </div>
  );
}

/* --------------------------- transfer ownership --------------------------- */

function TransferModal({
  email,
  ownerUserId,
  groupLabel,
  groupBotIds,
  onClose,
  onDone,
}: {
  email: string;
  ownerUserId: string;
  groupLabel: string;
  groupBotIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const start = async () => {
    if (groupBotIds.length === 0) {
      toast.error("This group has no bots to transfer yet.");
      return;
    }
    setBusy(true);
    try {
      // Resolve the member's dashboard_team row id (transfer is keyed by it).
      const { data: rows, error: lookupErr } = await (supabase as any)
        .from("dashboard_team")
        .select("id")
        .eq("owner_user_id", ownerUserId)
        .ilike("member_email", email)
        .limit(1);
      if (lookupErr) throw new Error(lookupErr.message);
      const memberId = rows?.[0]?.id;
      if (!memberId) throw new Error("Couldn't find that member.");

      const { data, error } = await supabase.functions.invoke("team-transfer-send", {
        body: { memberId, siteUrl: window.location.origin, botIds: groupBotIds },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((error as any)?.message ?? (data as any)?.error ?? "Transfer failed");
      }
      setLink((data as any).confirm_url ?? null);
      onDone();
    } catch (e: any) {
      toast.error("Couldn't start the transfer", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div className="gthm">
        <style>{GTH_CSS}</style>
        <div className="scrim open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="modal">
            <div className="mhd">
              <span className="mic">
                <svg viewBox="0 0 24 24"><path d="M4 12h13M13 6l6 6-6 6" /></svg>
              </span>
              <h3>Transfer ownership</h3>
            </div>

            {link ? (
              <>
                <p className="ms indent">
                  Send this link to <b>{email}</b>. When they open it and sign in, ownership of{" "}
                  <b>{groupLabel}</b>'s {groupBotIds.length === 1 ? "bot" : `${groupBotIds.length} bots`}{" "}
                  transfers to them. It expires in 7 days.
                </p>
                <div className="xlink">{link}</div>
                <div className="mfoot">
                  <button className="btnp" type="button" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Link copied"); }}>
                    Copy link
                  </button>
                  <button className="ghost" type="button" onClick={onClose}>Done</button>
                </div>
              </>
            ) : (
              <>
                <p className="ms indent">
                  Hand <b>{groupLabel}</b>'s{" "}
                  {groupBotIds.length === 1 ? "bot" : `${groupBotIds.length} bots`} to{" "}
                  <b>{email}</b>. They'll get a confirmation link; once they accept, those bots — and
                  their billing — move to their account. You'll become a co-owner. This can't be undone.
                </p>
                <div className="mfoot">
                  <button className="ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
                  <button className="btnp" type="button" onClick={start} disabled={busy}>
                    {busy ? "Preparing…" : "Transfer ownership"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------ empty state ------------------------------- */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty">
      <span className="ei">
        <BoxIcon />
      </span>
      <div className="eh">No groups yet</div>
      <p className="ep">
        Bundle your bots into a group to give it its own team. People you invite
        only see the group they're in.
      </p>
      <button className="btnp" type="button" onClick={onCreate}>
        <PlusIcon />
        Create a group
      </button>
    </div>
  );
}

/* ------------------------------- member row ------------------------------- */

function MemberRow({
  member,
  menuOpen,
  onToggleMenu,
  onChangeRole,
  onRemove,
  onTransfer,
}: {
  member: Member;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onChangeRole: (email: string, role: RoleKey) => void;
  onRemove: (email: string) => void;
  onTransfer: (email: string) => void;
}) {
  const initial = (member.member_email[0] ?? "?").toUpperCase();
  const isPending = !member.accepted && !member.is_owner;
  const metaClass = isPending ? "pending" : "active";
  const statusLine = member.is_owner
    ? member.accepted_at
      ? `Active · joined ${shortDate(member.accepted_at)}`
      : "Active"
    : isPending
    ? "Invite pending"
    : member.accepted_at
    ? `Active · joined ${shortDate(member.accepted_at)}`
    : "Active";

  const rc = roleClass(member.role);

  return (
    <div className="li">
      <div className="who">
        <span className={"av" + (member.is_owner ? " owner" : "")}>
          {initial}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="em">{member.member_email}</div>
          <div className={"meta " + metaClass}>
            <span className="dot" />
            {statusLine}
          </div>
        </div>
      </div>

      <span
        className={"role " + rc + (member.is_owner ? "" : " clk")}
        onClick={(e) => {
          if (member.is_owner) return;
          e.stopPropagation();
          onToggleMenu();
        }}
      >
        {roleLabel(member.role)}
        {!member.is_owner && (
          <span className={"rolemenu" + (menuOpen ? " open" : "")}>
            {ROLE_OPTIONS.map((r) => (
              <div
                key={r.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeRole(member.member_email, r.key);
                }}
              >
                {r.label}
              </div>
            ))}
            {member.accepted && (
              <>
                <div className="rmdiv" />
                <div
                  className="xfer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransfer(member.member_email);
                  }}
                >
                  Transfer ownership…
                </div>
              </>
            )}
          </span>
        )}
      </span>

      <div className="act">
        {member.is_owner ? (
          <span className="dash">—</span>
        ) : isPending ? (
          <>
            <button
              className="resend"
              type="button"
              onClick={() =>
                toast.success(`Invite resent to ${member.member_email}`)
              }
            >
              Resend
            </button>
            <button
              className="ib del"
              type="button"
              title="Cancel invite"
              onClick={() => onRemove(member.member_email)}
            >
              <XIcon />
            </button>
          </>
        ) : (
          <>
            <button
              className="ib"
              type="button"
              title="Change role"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu();
              }}
            >
              <PencilIcon />
            </button>
            <button
              className="ib del"
              type="button"
              title="Remove"
              onClick={() => onRemove(member.member_email)}
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ roles matrix ------------------------------ */

// Which permission each matrix row toggles, mapped to the real keys the RLS
// (has_bot_team_perm) and useTeamRole read. Only the assignable roles get
// columns — owner is always full, co_owner is edited elsewhere.
const PERM_ROWS: Array<{ key: keyof TeamPermissions; label: string }> = [
  { key: "edit_bot_config", label: "Edit bot config" },
  { key: "manage_secrets",  label: "Manage API keys & secrets" },
  { key: "manage_settings", label: "Settings & appearance" },
  { key: "edit_billing",    label: "Manage billing" },
  { key: "manage_team",     label: "Invite & remove members" },
  { key: "view_logs",       label: "View logs & activity" },
];
const MATRIX_ROLES: TeamRole[] = ["admin", "moderator", "viewer"];

// Sentinel group id for "no specific group" (global / ungrouped) — matches the
// SQL default in the per-group permissions migration.
const GLOBAL_GROUP_ID = "00000000-0000-0000-0000-000000000000";

function RolesMatrix({ ownerUserId, groupId }: { ownerUserId: string; groupId: string | null }) {
  const [matrix, setMatrix] = useState<Record<string, TeamPermissions>>(() => ({
    admin: { ...DEFAULT_PERMISSIONS.admin },
    moderator: { ...DEFAULT_PERMISSIONS.moderator },
    viewer: { ...DEFAULT_PERMISSIONS.viewer },
  }));
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const effGroupId = groupId ?? GLOBAL_GROUP_ID;

  const reload = useCallback(async () => {
    setLoading(true);
    const next: Record<string, TeamPermissions> = {
      admin: { ...DEFAULT_PERMISSIONS.admin },
      moderator: { ...DEFAULT_PERMISSIONS.moderator },
      viewer: { ...DEFAULT_PERMISSIONS.viewer },
    };
    // Permissions are per group — only load the selected group's overrides.
    const { data } = await (supabase as any)
      .from("dashboard_role_permissions")
      .select("role, permissions")
      .eq("owner_user_id", ownerUserId)
      .eq("group_id", effGroupId);
    for (const row of ((data ?? []) as { role: string; permissions: Partial<TeamPermissions> }[])) {
      if (next[row.role]) next[row.role] = { ...next[row.role], ...row.permissions };
    }
    setMatrix(next);
    setLoading(false);
  }, [ownerUserId, effGroupId]);
  useEffect(() => { void reload(); }, [reload]);

  // Toggle a single cell — optimistic, saves the whole role's permission set
  // for THIS group via team_set_role_permissions, reverts on failure.
  const toggle = async (role: TeamRole, key: keyof TeamPermissions) => {
    const cellId = `${role}:${key}`;
    const prevVal = matrix[role][key];
    const updated = { ...matrix[role], [key]: !prevVal };
    setMatrix((m) => ({ ...m, [role]: updated }));
    setBusyKey(cellId);
    const { data, error } = await (supabase as any).rpc("team_set_role_permissions", {
      _role: role,
      _permissions: updated,
      _group_id: groupId,
    });
    setBusyKey(null);
    if (error || (data && data.ok === false)) {
      setMatrix((m) => ({ ...m, [role]: { ...m[role], [key]: prevVal } }));
      toast.error("Couldn't save that permission", { description: error?.message });
    }
  };

  return (
    <div>
      <div className="note">
        Click any ✓ or ✗ to change what a role can do — it saves instantly. Owner
        always has full access.
      </div>
      {loading ? (
        <div className="loading sm">Loading permissions…</div>
      ) : (
        <div className="rmtx">
          <div className="rrow head">
            <div>Permission</div>
            <div className="c">Admin</div>
            <div className="c">Mod</div>
            <div className="c">Viewer</div>
          </div>
          {PERM_ROWS.map((r) => (
            <div className="rrow" key={r.key}>
              <div className="p">{r.label}</div>
              {MATRIX_ROLES.map((role) => {
                const on = matrix[role][r.key];
                const cellId = `${role}:${r.key}`;
                return (
                  <div className="c" key={role}>
                    <button
                      type="button"
                      className={"pcell " + (on ? "yes" : "nope")}
                      disabled={busyKey === cellId}
                      aria-pressed={on}
                      aria-label={`${r.label} for ${role}: ${on ? "allowed" : "blocked"} — click to toggle`}
                      onClick={() => void toggle(role, r.key)}
                    >
                      {on ? <TickIcon /> : <NopeIcon />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ invite modal ------------------------------ */

function InviteModal({
  open,
  onClose,
  groupId,
  groupName,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
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

  if (!open) return null;

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
      onClose();
      onInvited();
    } catch (e: any) {
      toast.error("Couldn't send invite", { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Portal>
      <div className="gthm">
        <style>{GTH_CSS}</style>
        <div
          className="scrim open"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="modal">
            <h3>Invite to {groupName}</h3>
            <p className="ms">
              They'll get an email to sign in, and can only manage this group's
              bots.
            </p>
            <label className="fl">Email</label>
            <input
              className="fi"
              type="email"
              value={email}
              autoFocus
              autoComplete="off"
              placeholder="name@email.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <label className="fl" style={{ marginTop: 16 }}>
              Role
            </label>
            <div className="seg">
              {ROLE_OPTIONS.map((r) => (
                <div
                  key={r.key}
                  className={role === r.key ? "on" : ""}
                  onClick={() => setRole(r.key)}
                >
                  {r.label}
                </div>
              ))}
            </div>
            <div className="mfoot">
              <button className="ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btnp"
                type="button"
                onClick={send}
                disabled={sending}
              >
                {sending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* --------------------------- bot picker modal ----------------------------- */

function BotPickerModal(
  props: {
    open: boolean;
    onClose: () => void;
    bots: OwnedBot[];
    groupName: (id: string | null) => string | null;
  } & (
    | { mode: "create"; onCreated: (id: string | null) => void }
    | {
        mode: "manage";
        groupId: string | null;
        onManaged: () => void;
      }
  ),
) {
  const { open, onClose, bots, groupName, mode } = props;
  const groupId = mode === "manage" ? props.groupId : null;

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setName("");
      setSelected(new Set());
    } else {
      setSelected(
        new Set(bots.filter((b) => b.group_id === groupId).map((b) => b.id)),
      );
    }
    // Initialize ONLY when the dialog opens (or the target group changes) — NOT
    // on every `bots` refresh. useOwnedBots polls ~every 10s and returns a new
    // array reference each time; if `bots` were a dependency here, that poll
    // would re-run this effect mid-edit and wipe the name you typed and the
    // bots you selected. `bots` is intentionally read at open-time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, groupId]);

  if (!open) return null;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        onClose();
        props.onCreated(data?.id ?? null);
      } else {
        if (!groupId) return;
        const { data, error } = await (supabase as any).rpc("group_set_bots", {
          _group_id: groupId,
          _bot_ids: Array.from(selected),
        });
        if (error) throw error;
        if (data && data.ok === false) throw new Error("update failed");
        toast.success("Bots updated");
        onClose();
        props.onManaged();
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
    <Portal>
      <div className="gthm">
        <style>{GTH_CSS}</style>
        <div
          className="scrim open"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="modal wide">
            <div className="mhd">
              <span className="mic">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M8 14h5M8 17h3" />
                </svg>
              </span>
              <h3>{mode === "create" ? "New group" : "Manage bots"}</h3>
            </div>
            <p className="ms indent">
              {mode === "create"
                ? "Bundle bots for a server and give it its own team."
                : "Choose which of your bots belong to this group."}
            </p>

            {mode === "create" && (
              <>
                <label className="fl">Group name</label>
                <input
                  className="fi"
                  value={name}
                  autoFocus
                  autoComplete="off"
                  placeholder="e.g. Trading Server"
                  onChange={(e) => setName(e.target.value)}
                />
              </>
            )}

            <label className="fl" style={{ marginTop: mode === "create" ? 18 : 0 }}>
              Bots in this group
              <span className="pickn">{selected.size} selected</span>
            </label>

            {bots.length === 0 ? (
              <p className="ms" style={{ margin: "6px 0 0" }}>
                You don't have any bots yet.
              </p>
            ) : (
              <div className="botpick">
                {bots.map((b) => {
                  const on = selected.has(b.id);
                  const otherGroup =
                    b.group_id && b.group_id !== groupId
                      ? groupName(b.group_id)
                      : null;
                  return (
                    <div
                      key={b.id}
                      className={"bopt" + (on ? " on" : "")}
                      onClick={() => toggle(b.id)}
                    >
                      <span className="bic">
                        <BotIcon />
                      </span>
                      <span className="bn">
                        <div className="t">{b.bot_name}</div>
                        <div className="ty">
                          {BOT_BASE_LABELS[b.base] ?? b.base}
                          {otherGroup ? ` · currently in ${otherGroup}` : ""}
                        </div>
                      </span>
                      {otherGroup && (
                        <span className="inuse">in {otherGroup}</span>
                      )}
                      <span className="cbx">
                        <TickIcon />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mfoot spread">
              <span className="hint">A bot can only live in one group.</span>
              <div style={{ display: "flex", gap: 9 }}>
                <button className="ghost" type="button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btnp"
                  type="button"
                  onClick={submit}
                  disabled={disabled}
                >
                  {mode === "create" ? (
                    <>
                      <PlusIcon />
                      {busy ? "Creating…" : "Create group"}
                    </>
                  ) : busy ? (
                    "Saving…"
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* --------------------------- support access ------------------------------- */

type SupportCode = {
  id: string;
  code: string;
  expires_at: string;
  notes: string | null;
  revoked_at: string | null;
  created_at: string;
};
type SupportGrant = {
  id: string;
  expires_at: string;
  granted_at: string;
  revoked_at: string | null;
};

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
  { hours: 0, label: "Never" },
];

const isNeverExpires = (iso: string | null | undefined) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isFinite(t) || t > Date.UTC(9000, 0, 1);
};
const formatExpiry = (iso: string | null | undefined) =>
  isNeverExpires(iso) ? "Never" : iso ? new Date(iso).toLocaleString() : "soon";

function GroupSupportAccess() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<SupportCode[]>([]);
  const [grants, setGrants] = useState<SupportGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [newCodeExpires, setNewCodeExpires] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [codesRes, grantsRes] = await Promise.all([
      (supabase as any)
        .from("support_access_codes")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("support_access_grants")
        .select("*")
        .eq("owner_user_id", user.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("granted_at", { ascending: false }),
    ]);
    setCodes((codesRes.data ?? []) as SupportCode[]);
    setGrants((grantsRes.data ?? []) as SupportGrant[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeCodes = codes.filter(
    (c) =>
      !c.revoked_at &&
      (isNeverExpires(c.expires_at) ||
        new Date(c.expires_at).getTime() > Date.now()),
  );

  const create = async (hours: number, notes: string) => {
    setCreating(true);
    const { data, error } = await (supabase as any).rpc(
      "create_support_access_code",
      { _expires_in_hours: hours, _notes: notes || null },
    );
    setCreating(false);
    if (error || !data?.ok) {
      toast.error("Couldn't create code", {
        description: error?.message ?? data?.error,
      });
      return;
    }
    setGenOpen(false);
    setNewCode(data.code);
    setNewCodeExpires(data.expires_at);
    void reload();
  };

  const revokeGrant = async (id: string) => {
    const { data, error } = await (supabase as any).rpc(
      "revoke_support_access_grant",
      { _grant_id: id },
    );
    if (error || !data?.ok) {
      toast.error(error?.message ?? data?.error);
      return;
    }
    toast.success("Access revoked");
    void reload();
  };

  const revokeCode = async (id: string) => {
    const { data, error } = await (supabase as any).rpc(
      "revoke_support_access_code",
      { _code_id: id },
    );
    if (error || !data?.ok) {
      toast.error(error?.message ?? data?.error);
      return;
    }
    toast.success("Code revoked");
    void reload();
  };

  return (
    <div>
      <div className="sup">
        <span className="si">
          <ShieldIcon />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>Grant temporary access</h4>
          <p>
            Generate a one-time code to let our support team into your dashboard
            to troubleshoot. Revoke any time.
          </p>
          <div className="row2">
            <button
              className="btnp"
              type="button"
              onClick={() => setGenOpen(true)}
            >
              <PlusIcon />
              Generate code
            </button>
          </div>

          {grants.length > 0 && (
            <div className="grantbanner">
              {grants.map((g) => (
                <div className="gline" key={g.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="gt">Support team has dashboard access</div>
                    <div className="gm">Expires {formatExpiry(g.expires_at)}</div>
                  </div>
                  <button
                    className="resend"
                    type="button"
                    onClick={() => revokeGrant(g.id)}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="sectlbl" style={{ marginTop: 16 }}>
              Loading…
            </div>
          ) : activeCodes.length === 0 ? (
            grants.length === 0 && (
              <div className="sectlbl" style={{ marginTop: 16 }}>
                No active codes — generate one when you need help.
              </div>
            )
          ) : (
            <>
              <div className="sectlbl">Unused codes</div>
              <div className="codes">
                {activeCodes.map((c) => (
                  <div className="codeitem" key={c.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="cv">{c.code}</div>
                      <div className="cm">
                        <ClockIcon />
                        Expires {formatExpiry(c.expires_at)}
                        {c.notes ? ` · ${c.notes}` : ""}
                      </div>
                    </div>
                    <div className="cact">
                      <button
                        className="ib"
                        type="button"
                        title="Copy"
                        onClick={async () => {
                          await navigator.clipboard.writeText(c.code);
                          toast.success("Code copied");
                        }}
                      >
                        <CopyIcon />
                      </button>
                      <button
                        className="ib del"
                        type="button"
                        title="Revoke"
                        onClick={() => revokeCode(c.id)}
                      >
                        <XIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <GenerateCodeModal
        open={genOpen}
        busy={creating}
        onClose={() => setGenOpen(false)}
        onCreate={create}
      />

      {newCode && (
        <Portal>
          <div className="gthm">
            <style>{GTH_CSS}</style>
            <div
              className="scrim open"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setNewCode(null);
                  setNewCodeExpires(null);
                }
              }}
            >
              <div className="modal">
                <h3>Your support access code</h3>
                <p className="ms">
                  Share this code with our support team.{" "}
                  {isNeverExpires(newCodeExpires)
                    ? "It never expires unless you revoke it."
                    : `It expires ${
                        newCodeExpires
                          ? new Date(newCodeExpires).toLocaleString()
                          : "soon"
                      }.`}
                </p>
                <div className="codebig">{newCode}</div>
                <div className="mfoot">
                  <button
                    className="ghost"
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(newCode);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    Copy code
                  </button>
                  <button
                    className="btnp"
                    type="button"
                    onClick={() => {
                      setNewCode(null);
                      setNewCodeExpires(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function GenerateCodeModal({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (hours: number, notes: string) => void | Promise<void>;
}) {
  const [hours, setHours] = useState("24");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setHours("24");
      setNotes("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="gthm">
        <style>{GTH_CSS}</style>
        <div
          className="scrim open"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="modal">
            <h3>Generate support code</h3>
            <p className="ms">
              The code lets one Oversite admin into your bot dashboard
              temporarily. They can read &amp; change your bot settings until the
              code expires or you revoke it.
            </p>
            <label className="fl">Expires after</label>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.hours} value={String(o.hours)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="fl" style={{ marginTop: 16 }}>
              Note (optional)
            </label>
            <textarea
              className="fi"
              value={notes}
              maxLength={500}
              placeholder="What do you need help with?"
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="mfoot">
              <button className="ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btnp"
                type="button"
                disabled={busy}
                onClick={() => onCreate(Number.parseInt(hours, 10), notes.trim())}
              >
                {busy ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* --------------------------------- portal --------------------------------- */

function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/* ---------------------------------- css ----------------------------------- */

const GTH_CSS = `
.gth, .gthm {
  --gbg:#21272e;--gpanel:#272e36;--gsurface:#2d353e;--gsurface2:#343d46;--ghair:#3a434d;
  --gheading:#E8EEF3;--gbody:#A8B4BF;--gfaint:#788591;--gaccent:#C9DBE6;--gaccentink:#1E242B;
  --gok:#86d3a1;--gbad:#e98b8b;--ggold:#cbb277;
  --gdisp:"Bricolage Grotesque",system-ui,sans-serif;
  --gbodyf:"Space Grotesk",system-ui,sans-serif;
  --gmono:"Space Mono",monospace;
}
.gth, .gth *, .gthm, .gthm * { box-sizing:border-box; }
.gth { font-family:var(--gbodyf); color:var(--gbody); }

.gth .card{position:relative;background:linear-gradient(180deg,var(--gpanel),#242b32);border:1px solid var(--ghair);
  border-radius:22px;box-shadow:0 30px 70px -30px rgba(0,0,0,.65);overflow:visible}
.gth .card::before{content:"";position:absolute;top:-120px;right:-80px;width:340px;height:240px;
  background:radial-gradient(circle,color-mix(in srgb,var(--gaccent) 16%,transparent),transparent 70%);pointer-events:none;border-radius:22px}
.gth .inner{position:relative;padding:26px 28px 28px}

.gth .top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
.gth .ttl h2{font-family:var(--gdisp);font-weight:800;font-size:20px;color:var(--gheading);margin:0;letter-spacing:-.02em}
.gth .ttl p{margin:5px 0 0;font-size:12.5px;color:var(--gfaint);max-width:44ch;line-height:1.45}

.gth .dd{position:relative}
.gth .ddbtn{display:inline-flex;align-items:center;gap:10px;background:var(--gsurface);border:1px solid var(--ghair);
  border-radius:12px;padding:10px 14px;cursor:pointer;color:var(--gheading);font-family:var(--gbodyf);font-weight:600;font-size:13px;transition:.15s;min-width:190px}
.gth .ddbtn:hover{border-color:color-mix(in srgb,var(--gaccent) 40%,var(--ghair))}
.gth .ddbtn .gi{height:22px;width:22px;border-radius:7px;flex:none;display:grid;place-items:center;background:var(--gaccent);color:var(--gaccentink)}
.gth .ddbtn .gi svg{width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none}
.gth .ddbtn .lab{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gth .ddbtn .n{font-family:var(--gmono);font-size:10.5px;color:var(--gfaint)}
.gth .ddbtn .car{color:var(--gfaint);transition:.15s;display:grid;place-items:center}
.gth .ddbtn .car svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none}
.gth .dd.open .ddbtn .car{transform:rotate(180deg)}
.gth .ddmenu{position:absolute;top:calc(100% + 6px);right:0;width:260px;background:var(--gpanel);border:1px solid var(--ghair);
  border-radius:14px;box-shadow:0 20px 50px -16px rgba(0,0,0,.7);padding:6px;z-index:30;display:none;max-height:300px;overflow:auto}
.gth .dd.open .ddmenu{display:block;animation:gthpop .16s ease}
@keyframes gthpop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.gth .ddi{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;cursor:pointer;font-size:13px;color:var(--gbody);transition:.12s}
.gth .ddi:hover{background:var(--gsurface)}
.gth .ddi .gi{height:20px;width:20px;border-radius:6px;flex:none;display:grid;place-items:center;background:#3a444e;color:var(--gfaint)}
.gth .ddi .gi svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.9;fill:none}
.gth .ddi.on{color:var(--gheading)} .gth .ddi.on .gi{background:var(--gaccent);color:var(--gaccentink)}
.gth .ddi .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gth .ddi .ct{font-family:var(--gmono);font-size:10px;color:var(--gfaint)}
.gth .ddi .tick{color:var(--gaccent);opacity:0;display:grid;place-items:center}.gth .ddi.on .tick{opacity:1}
.gth .ddi .tick svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.4;fill:none}
.gth .ddsep{height:1px;background:var(--ghair);margin:6px 4px}
.gth .ddnew{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:9px;cursor:pointer;color:var(--gaccent);font-weight:600;font-size:12.5px}
.gth .ddnew:hover{background:var(--gsurface)} .gth .ddnew svg{width:15px;height:15px;stroke:currentColor;stroke-width:2;fill:none}

.gth .tabs{display:flex;gap:22px;margin:24px 0 0;border-bottom:1px solid var(--ghair)}
.gth .tab{position:relative;padding:0 1px 13px;font-family:var(--gdisp);font-weight:700;font-size:13px;color:var(--gfaint);cursor:pointer;background:none;border:0}
.gth .tab:hover{color:var(--gbody)} .gth .tab.on{color:var(--gheading)}
.gth .tab.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:var(--gaccent)}
.gth .pane{display:none;padding-top:8px}.gth .pane.on{display:block;animation:gthfade .25s ease}
@keyframes gthfade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

.gth .loading{padding:40px 0;text-align:center;font-size:13px;color:var(--gfaint)}
.gth .loading.sm{padding:28px 0}

.gth .empty{padding:46px 0;text-align:center}
.gth .empty .ei{height:52px;width:52px;border-radius:15px;display:grid;place-items:center;margin:0 auto 14px;
  background:color-mix(in srgb,var(--gaccent) 10%,transparent);border:1px solid color-mix(in srgb,var(--gaccent) 20%,transparent);color:var(--gaccent)}
.gth .empty .ei svg{width:24px;height:24px;stroke:currentColor;stroke-width:1.7;fill:none}
.gth .empty .eh{font-family:var(--gdisp);font-weight:800;font-size:17px;color:var(--gheading)}
.gth .empty .ep{font-size:13px;color:var(--gfaint);margin:7px auto 18px;max-width:42ch;line-height:1.5}

.gth .mhead{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.gth .mhead .h{font-family:var(--gdisp);font-weight:700;font-size:16px;color:var(--gheading)}
.gth .mhead .sub{font-size:12px;color:var(--gfaint);margin-top:3px}
.gth .mhead .sub a{color:var(--gaccent);text-decoration:none;cursor:pointer}
.gth .btnp{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:11px;padding:10px 15px;background:var(--gaccent);color:var(--gaccentink);font-family:var(--gbodyf);font-weight:700;font-size:12.5px;cursor:pointer;transition:.15s}
.gth .btnp:hover{filter:brightness(1.06)} .gth .btnp svg{width:15px;height:15px;stroke:currentColor;stroke-width:2;fill:none}

.gth .list{display:flex;flex-direction:column}
.gth .li{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:16px;padding:14px 4px;border-top:1px solid var(--ghair)}
.gth .li:first-child{border-top:0}
.gth .who{display:flex;align-items:center;gap:12px;min-width:0}
.gth .av{height:34px;width:34px;border-radius:10px;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,#46525E,#343D46);color:var(--gheading);font-family:var(--gdisp);font-weight:800;font-size:13px}
.gth .av.owner{background:linear-gradient(135deg,var(--ggold),#9c8347);color:#221b08}
.gth .who .em{color:var(--gheading);font-weight:500;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gth .who .meta{font-size:11px;color:var(--gfaint);margin-top:1px;display:flex;align-items:center;gap:7px}
.gth .who .meta .dot{height:5px;width:5px;border-radius:50%}
.gth .who .meta.active{color:var(--gok)} .gth .who .meta.active .dot{background:var(--gok)}
.gth .who .meta.pending{color:var(--ggold)} .gth .who .meta.pending .dot{background:var(--ggold)}
.gth .role{position:relative;font-family:var(--gdisp);font-weight:700;font-size:11px;letter-spacing:.04em;border-radius:8px;padding:5px 11px;border:1px solid transparent;justify-self:end;cursor:default}
.gth .role.clk{cursor:pointer} .gth .role.clk:hover{filter:brightness(1.1)}
.gth .role.owner{color:var(--ggold);background:color-mix(in srgb,var(--ggold) 13%,transparent);border-color:color-mix(in srgb,var(--ggold) 28%,transparent)}
.gth .role.admin{color:var(--gaccent);background:color-mix(in srgb,var(--gaccent) 12%,transparent);border-color:color-mix(in srgb,var(--gaccent) 24%,transparent)}
.gth .role.mod{color:#aab6c2;background:rgba(170,182,194,.1);border-color:rgba(170,182,194,.2)}
.gth .role.viewer{color:var(--gfaint);background:rgba(120,133,145,.1);border-color:rgba(120,133,145,.22)}
.gth .rolemenu{position:absolute;top:calc(100% + 6px);right:0;background:var(--gpanel);border:1px solid var(--ghair);border-radius:10px;padding:5px;box-shadow:0 16px 40px -14px rgba(0,0,0,.7);z-index:20;display:none;min-width:130px}
.gth .rolemenu.open{display:block}
.gth .rolemenu div{padding:7px 10px;border-radius:7px;font-size:12px;color:var(--gbody);cursor:pointer;font-family:var(--gbodyf);font-weight:600}
.gth .rolemenu div:hover{background:var(--gsurface);color:var(--gheading)}
.gth .rolemenu .rmdiv{height:1px;padding:0;margin:5px 4px;background:var(--ghair);border-radius:0;cursor:default}
.gth .rolemenu .rmdiv:hover{background:var(--ghair)}
.gth .rolemenu .xfer{color:var(--gaccent)}
.gth .rolemenu .xfer:hover{background:color-mix(in srgb,var(--gaccent) 12%,transparent);color:var(--gaccent)}
.gthm .xlink{font-family:var(--gmono,ui-monospace,monospace);font-size:11.5px;color:var(--gbody);word-break:break-all;background:var(--gbg);border:1px solid var(--ghair);border-radius:9px;padding:10px 12px;margin-top:6px}
.gth .act{display:flex;gap:6px;justify-content:flex-end;min-width:74px}
.gth .ib{height:30px;width:30px;border-radius:8px;border:1px solid var(--ghair);background:transparent;color:var(--gfaint);display:grid;place-items:center;cursor:pointer;transition:.14s}
.gth .ib:hover{background:var(--gsurface2);color:var(--gheading)} .gth .ib.del:hover{color:var(--gbad);border-color:color-mix(in srgb,var(--gbad) 40%,var(--ghair))}
.gth .ib svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.9;fill:none}
.gth .resend{height:30px;border:1px solid var(--ghair);background:transparent;color:var(--gbody);border-radius:8px;padding:0 11px;font-family:var(--gbodyf);font-weight:600;font-size:11.5px;cursor:pointer}
.gth .resend:hover{background:var(--gsurface2);color:var(--gheading)}
.gth .dash{color:var(--gfaint);font-size:12px}

.gth .note{font-size:11.5px;color:var(--gfaint);margin-bottom:12px;line-height:1.5}
.gth .rmtx{display:flex;flex-direction:column}
.gth .pcell{background:none;border:0;cursor:pointer;padding:6px 12px;border-radius:8px;display:inline-grid;place-items:center;color:#4a545d;transition:background .12s,transform .1s}
.gth .pcell:hover{background:rgba(201,219,230,.09)} .gth .pcell:active{transform:scale(.88)}
.gth .pcell:disabled{opacity:.45;cursor:default}
.gth .pcell.yes{color:var(--gok)} .gth .pcell.yes svg{width:17px;height:17px;stroke:currentColor;stroke-width:2.4;fill:none}
.gth .pcell.nope svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.4;fill:none}
.gth .rrow{display:grid;grid-template-columns:1.5fr repeat(3,1fr);align-items:center;padding:13px 4px;border-top:1px solid var(--ghair)}
.gth .rrow.head{border-top:0;font-family:var(--gdisp);font-weight:700;color:var(--gheading);font-size:12px}
.gth .rrow.head .c{text-align:center}.gth .rrow .p{font-size:13px;color:var(--gbody)}.gth .rrow .c{text-align:center}
.gth .yes{color:var(--gok);display:inline-grid;place-items:center} .gth .yes svg{width:17px;height:17px;stroke:currentColor;stroke-width:2.4;fill:none}
.gth .nope{color:#4a545d;display:inline-grid;place-items:center} .gth .nope svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.4;fill:none}

/* support access */
.gth .sup{border:1px solid var(--ghair);border-radius:14px;background:rgba(45,53,62,.5);padding:20px;display:flex;gap:14px}
.gth .sup .si{height:40px;width:40px;border-radius:12px;flex:none;display:grid;place-items:center;background:color-mix(in srgb,var(--gaccent) 12%,transparent);color:var(--gaccent)}
.gth .sup .si svg{width:20px;height:20px;stroke:currentColor;stroke-width:1.7;fill:none}
.gth .sup h4{font-family:var(--gdisp);font-weight:700;font-size:14px;color:var(--gheading);margin:0 0 4px}
.gth .sup p{margin:0;font-size:12.5px;color:var(--gfaint);line-height:1.5}
.gth .sup .row2{display:flex;gap:9px;margin-top:14px;flex-wrap:wrap}
.gth .sectlbl{font-family:var(--gdisp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gfaint);margin:16px 0 8px}
.gth .grantbanner{margin-top:14px;border:1px solid color-mix(in srgb,var(--ggold) 32%,var(--ghair));background:color-mix(in srgb,var(--ggold) 8%,transparent);border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;gap:8px}
.gth .grantbanner .gline{display:flex;align-items:center;justify-content:space-between;gap:12px}
.gth .grantbanner .gt{font-size:12.5px;font-weight:600;color:var(--gheading)}
.gth .grantbanner .gm{font-size:11px;color:var(--gfaint);margin-top:1px}
.gth .codes{display:flex;flex-direction:column;gap:8px}
.gth .codeitem{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--ghair);background:var(--gbg);border-radius:10px;padding:10px 12px}
.gth .codeitem .cv{font-family:var(--gmono);font-size:14px;font-weight:700;color:var(--gheading)}
.gth .codeitem .cm{font-size:11px;color:var(--gfaint);margin-top:3px;display:flex;align-items:center;gap:6px}
.gth .codeitem .cm svg{width:12px;height:12px;stroke:currentColor;stroke-width:2;fill:none}
.gth .codeitem .cact{display:flex;gap:6px;flex:none}

/* modal */
.gthm .scrim{position:fixed;inset:0;background:rgba(10,13,17,.6);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;z-index:9000;padding:24px;font-family:var(--gbodyf)}
.gthm .scrim.open{display:flex}
.gthm .modal{width:100%;max-width:400px;background:linear-gradient(180deg,var(--gpanel),#242b32);border:1px solid var(--ghair);border-radius:18px;padding:22px;box-shadow:0 30px 70px -20px rgba(0,0,0,.7);max-height:88vh;overflow:auto}
.gthm .modal.wide{max-width:460px}
.gthm .modal h3{font-family:var(--gdisp);font-weight:800;font-size:17px;color:var(--gheading);margin:0 0 4px}
.gthm .modal .mhd{display:flex;align-items:center;gap:12px;margin-bottom:4px}
.gthm .modal .mhd h3{margin:0}
.gthm .modal .mic{height:38px;width:38px;border-radius:11px;flex:none;display:grid;place-items:center;background:color-mix(in srgb,var(--gaccent) 14%,transparent);color:var(--gaccent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gaccent) 22%,transparent)}
.gthm .modal .mic svg{width:19px;height:19px;stroke:currentColor;stroke-width:1.8;fill:none}
.gthm .modal .ms{font-size:12.5px;color:var(--gfaint);margin:0 0 18px;line-height:1.5}
.gthm .modal .ms.indent{margin:2px 0 20px 50px}
.gthm .fl{font-family:var(--gdisp);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gfaint);margin:0 0 8px;display:flex;align-items:center;justify-content:space-between}
.gthm .fl .pickn{color:var(--gaccent);font-family:var(--gmono);letter-spacing:0}
.gthm .fi{width:100%;background:var(--gbg);border:1px solid var(--ghair);border-radius:10px;padding:11px 13px;color:var(--gheading);font-family:var(--gbodyf);font-size:13.5px;outline:none}
.gthm .fi:focus{border-color:color-mix(in srgb,var(--gaccent) 60%,var(--ghair))}
.gthm select.fi{appearance:none;-webkit-appearance:none;cursor:pointer}
.gthm textarea.fi{min-height:72px;resize:vertical}
.gthm .codebig{border:1px solid var(--ghair);background:var(--gbg);border-radius:12px;padding:18px;text-align:center;font-family:var(--gmono);font-size:26px;font-weight:700;letter-spacing:.14em;color:var(--gheading);margin:4px 0 4px}
.gthm .seg{display:flex;gap:6px;margin-top:8px}
.gthm .seg div{flex:1;text-align:center;padding:9px;border-radius:9px;border:1px solid var(--ghair);background:var(--gbg);font-size:12px;font-weight:600;color:var(--gbody);cursor:pointer}
.gthm .seg div.on{border-color:var(--gaccent);background:color-mix(in srgb,var(--gaccent) 12%,transparent);color:var(--gheading)}
.gthm .botpick{display:flex;flex-direction:column;gap:8px;margin-top:2px;max-height:42vh;overflow:auto}
.gthm .bopt{display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid var(--ghair);border-radius:12px;background:var(--gbg);cursor:pointer;transition:.13s}
.gthm .bopt:hover{border-color:color-mix(in srgb,var(--gaccent) 35%,var(--ghair))}
.gthm .bopt.on{border-color:var(--gaccent);background:color-mix(in srgb,var(--gaccent) 9%,transparent)}
.gthm .bopt .bic{height:32px;width:32px;border-radius:9px;flex:none;display:grid;place-items:center;background:var(--gsurface);color:var(--gaccent)}
.gthm .bopt .bic svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none}
.gthm .bopt .bn{flex:1;min-width:0} .gthm .bopt .bn .t{color:var(--gheading);font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .gthm .bopt .bn .ty{font-size:11px;color:var(--gfaint);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gthm .bopt .inuse{font-size:10.5px;color:var(--ggold);background:color-mix(in srgb,var(--ggold) 12%,transparent);border:1px solid color-mix(in srgb,var(--ggold) 26%,transparent);border-radius:6px;padding:3px 7px;flex:none}
.gthm .cbx{height:22px;width:22px;border-radius:7px;border:1.5px solid var(--ghair);flex:none;display:grid;place-items:center;color:var(--gaccentink);transition:.13s}
.gthm .bopt.on .cbx{background:var(--gaccent);border-color:var(--gaccent)} .gthm .cbx svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.6;fill:none;opacity:0}.gthm .bopt.on .cbx svg{opacity:1}
.gthm .mfoot{display:flex;justify-content:flex-end;gap:9px;margin-top:22px;align-items:center}
.gthm .mfoot.spread{justify-content:space-between}
.gthm .mfoot .hint{font-size:11.5px;color:var(--gfaint)}
.gthm .ghost{border:1px solid var(--ghair);background:transparent;color:var(--gheading);border-radius:10px;padding:9px 14px;font-family:var(--gbodyf);font-weight:600;font-size:12.5px;cursor:pointer}.gthm .ghost:hover{background:var(--gsurface2)}
.gthm .btnp{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:11px;padding:10px 15px;background:var(--gaccent);color:var(--gaccentink);font-family:var(--gbodyf);font-weight:700;font-size:12.5px;cursor:pointer;transition:.15s}
.gthm .btnp:hover{filter:brightness(1.06)} .gthm .btnp svg{width:15px;height:15px;stroke:currentColor;stroke-width:2;fill:none}
.gthm .btnp:disabled{opacity:.45;cursor:not-allowed;filter:none}
`;
