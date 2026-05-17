import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import {
  DEFAULT_PERMISSIONS, ROLE_LABEL, type TeamPermissions, type TeamRole,
} from "@/hooks/useTeamRole";

const ROLES: TeamRole[] = ["owner", "co_owner", "admin", "moderator", "viewer"];

const PERMISSION_KEYS: Array<{ key: keyof TeamPermissions; label: string; desc: string }> = [
  { key: "view_dashboard",     label: "View dashboard",      desc: "See bots, settings, and stats" },
  { key: "edit_bot_config",    label: "Edit bot config",     desc: "Change addon settings & save changes" },
  { key: "manage_secrets",     label: "Manage secrets",      desc: "Set API keys and bot tokens" },
  { key: "view_logs",          label: "View logs",           desc: "Read bot activity & error logs" },
  { key: "edit_billing",       label: "Edit billing",        desc: "Change payment method & subscriptions" },
  { key: "manage_team",        label: "Manage team",         desc: "Invite, remove, and re-role members" },
  { key: "transfer_ownership", label: "Transfer ownership",  desc: "Hand the account to another member" },
];

const LOCKED: Record<TeamRole, Partial<TeamPermissions>> = {
  // Owner always has everything; viewer can't ever be granted destructive perms via this matrix.
  owner: { ...DEFAULT_PERMISSIONS.owner },
  co_owner: { transfer_ownership: false },
  admin: {},
  moderator: {},
  viewer: {},
};

type Row = Record<TeamRole, TeamPermissions>;

function buildDefault(): Row {
  return ROLES.reduce((acc, r) => { acc[r] = { ...DEFAULT_PERMISSIONS[r] }; return acc; }, {} as Row);
}

export function RolesTab() {
  const { user } = useAuth();
  const [matrix, setMatrix] = useState<Row>(buildDefault());
  const [dirty, setDirty] = useState<Set<TeamRole>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const next = buildDefault();
    const { data } = await (supabase as any)
      .from("dashboard_role_permissions")
      .select("role, permissions")
      .eq("owner_user_id", user.id);
    for (const row of (data ?? []) as { role: TeamRole; permissions: Partial<TeamPermissions> }[]) {
      if (next[row.role]) next[row.role] = { ...next[row.role], ...row.permissions };
    }
    setMatrix(next);
    setDirty(new Set());
    setLoading(false);
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  const toggle = (role: TeamRole, key: keyof TeamPermissions, value: boolean) => {
    if (role === "owner") return; // owner is always fully privileged
    const locked = LOCKED[role][key];
    if (locked !== undefined) return;
    setMatrix((prev) => ({ ...prev, [role]: { ...prev[role], [key]: value } }));
    setDirty((prev) => new Set(prev).add(role));
  };

  const resetRole = (role: TeamRole) => {
    setMatrix((prev) => ({ ...prev, [role]: { ...DEFAULT_PERMISSIONS[role] } }));
    setDirty((prev) => new Set(prev).add(role));
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const role of dirty) {
        const { data, error } = await (supabase as any).rpc("team_set_role_permissions", {
          _role: role, _permissions: matrix[role],
        });
        if (error || !data?.ok) throw new Error(error?.message ?? data?.error ?? "Failed");
      }
      toast.success("Permissions saved");
      setDirty(new Set());
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Role permissions</h3>
          <p className="text-xs text-muted-foreground">
            Customize what each role can do across your dashboard. Owner always has full access.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving || dirty.size === 0}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save changes
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Permission</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center min-w-[110px]">{ROLE_LABEL[r]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_KEYS.map(({ key, label, desc }) => (
              <TableRow key={key}>
                <TableCell>
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </TableCell>
                {ROLES.map((r) => {
                  const value = matrix[r][key];
                  const isOwner = r === "owner";
                  const locked = LOCKED[r][key];
                  const disabled = isOwner || locked !== undefined;
                  return (
                    <TableCell key={r} className="text-center">
                      <Checkbox
                        checked={value}
                        disabled={disabled}
                        onCheckedChange={(v) => toggle(r, key, !!v)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="text-xs text-muted-foreground">Reset to defaults</TableCell>
              {ROLES.map((r) => (
                <TableCell key={r} className="text-center">
                  {r === "owner" ? null : (
                    <Button size="sm" variant="ghost" className="h-7 px-2"
                      onClick={() => resetRole(r)}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
