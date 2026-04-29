import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  LifeBuoy,
  Plus,
  Copy,
  Check,
  X,
  Clock,
  ShieldAlert,
  Loader2,
} from "lucide-react";

type Code = {
  id: string;
  code: string;
  expires_at: string;
  notes: string | null;
  redeemed_at: string | null;
  redeemed_by_admin_id: string | null;
  revoked_at: string | null;
  created_at: string;
};

type Grant = {
  id: string;
  admin_user_id: string;
  expires_at: string;
  granted_at: string;
  revoked_at: string | null;
};

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

export function SupportAccessManager() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<Code[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
    setCodes((codesRes.data ?? []) as Code[]);
    setGrants((grantsRes.data ?? []) as Grant[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeCodes = codes.filter(
    (c) => !c.revoked_at && new Date(c.expires_at).getTime() > Date.now(),
  );

  return (
    <Card className="bg-card/40 border-border">
      <div className="p-5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
            <LifeBuoy className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold flex items-center gap-2">
              Support access
              {grants.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1"
                >
                  <ShieldAlert className="h-3 w-3" />
                  {grants.length} active session{grants.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate a one-time code to let our support team into your dashboard. Revoke anytime.
            </p>
          </div>
        </div>
        <CreateCodeButton
          loading={creating}
          onCreate={async (hours, notes) => {
            setCreating(true);
            const { data, error } = await (supabase as any).rpc("create_support_access_code", {
              _expires_in_hours: hours,
              _notes: notes || null,
            });
            setCreating(false);
            if (error || !data?.ok) {
              toast.error("Couldn't create code", { description: error?.message ?? data?.error });
              return;
            }
            setNewCode(data.code);
            setNewCodeExpires(data.expires_at);
            reload();
          }}
        />
      </div>

      <div className="p-5 space-y-4">
        {grants.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
              Active support sessions
            </div>
            {grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">Support team has dashboard access</div>
                  <div className="text-xs text-muted-foreground">
                    Expires {new Date(g.expires_at).toLocaleString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={async () => {
                    const { data, error } = await (supabase as any).rpc("revoke_support_access_grant", {
                      _grant_id: g.id,
                    });
                    if (error || !data?.ok) {
                      toast.error(error?.message ?? data?.error);
                      return;
                    }
                    toast.success("Access revoked");
                    reload();
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Revoke now
                </Button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Loading…
          </div>
        ) : activeCodes.length === 0 && grants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active codes. Generate one when you need help.
          </p>
        ) : (
          activeCodes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Unused codes
              </div>
              {activeCodes.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <code className="font-mono text-sm font-semibold">{c.code}</code>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires {new Date(c.expires_at).toLocaleString()}
                      {c.notes && <> · {c.notes}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(c.code);
                        toast.success("Code copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        const { data, error } = await (supabase as any).rpc(
                          "revoke_support_access_code",
                          { _code_id: c.id },
                        );
                        if (error || !data?.ok) {
                          toast.error(error?.message ?? data?.error);
                          return;
                        }
                        toast.success("Code revoked");
                        reload();
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {newCode && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setNewCode(null);
              setNewCodeExpires(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Your support access code</DialogTitle>
              <DialogDescription>
                Share this code with our support team. It expires{" "}
                {newCodeExpires ? new Date(newCodeExpires).toLocaleString() : "soon"}.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-border bg-muted/40 px-4 py-4 text-center font-mono text-2xl font-bold tracking-wider">
              {newCode}
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(newCode);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy code
            </Button>
            <DialogFooter>
              <Button
                onClick={() => {
                  setNewCode(null);
                  setNewCodeExpires(null);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function CreateCodeButton({
  loading,
  onCreate,
}: {
  loading: boolean;
  onCreate: (hours: number, notes: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("24");
  const [notes, setNotes] = useState("");

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={loading}>
        <Plus className="h-4 w-4 mr-1.5" />
        Generate code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate support access code</DialogTitle>
            <DialogDescription>
              The code lets one admin into your bot dashboard temporarily. They can read & change
              your bot settings, including secrets, until the code expires or you revoke it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Expires after</Label>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger className="mt-1.5">
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
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What do you need help with?"
                className="mt-1.5 min-h-[70px]"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await onCreate(Number.parseInt(hours, 10), notes.trim());
                setOpen(false);
                setNotes("");
              }}
              disabled={loading}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
