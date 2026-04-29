import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Gift, Plus, Trash2, Copy, Power } from "lucide-react";
import { toast } from "sonner";

type FreeCode = {
  id: string;
  code: string;
  months: number;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

const randomCode = (prefix = "FREE") => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip ambiguous chars
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${out}`;
};

export function BotFreePeriodCodeManager() {
  const [codes, setCodes] = useState<FreeCode[]>([]);
  const [loading, setLoading] = useState(true);

  // New code form
  const [newCode, setNewCode] = useState(randomCode());
  const [months, setMonths] = useState(1);
  const [maxUses, setMaxUses] = useState<string>("1");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FreeCode | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bot_free_period_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Couldn't load codes", { description: error.message });
    } else {
      setCodes(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createCode = async () => {
    const trimmed = newCode.trim();
    if (!trimmed) {
      toast.error("Enter a code");
      return;
    }
    if (months < 1 || months > 24) {
      toast.error("Months must be between 1 and 24");
      return;
    }
    const parsedMaxUses = maxUses.trim() === "" ? null : parseInt(maxUses, 10);
    if (parsedMaxUses !== null && (isNaN(parsedMaxUses) || parsedMaxUses < 1)) {
      toast.error("Max uses must be a positive number, or empty for unlimited");
      return;
    }
    setCreating(true);
    const { error } = await (supabase as any).from("bot_free_period_codes").insert({
      code: trimmed,
      months,
      max_uses: parsedMaxUses,
      notes: notes.trim() || null,
    });
    setCreating(false);
    if (error) {
      toast.error("Couldn't create code", { description: error.message });
      return;
    }
    toast.success(`Code "${trimmed}" created`);
    setNewCode(randomCode());
    setNotes("");
    reload();
  };

  const toggleActive = async (code: FreeCode) => {
    const { error } = await (supabase as any)
      .from("bot_free_period_codes")
      .update({ is_active: !code.is_active })
      .eq("id", code.id);
    if (error) {
      toast.error("Couldn't update code", { description: error.message });
      return;
    }
    reload();
  };

  const deleteCode = async (code: FreeCode) => {
    const { error } = await (supabase as any)
      .from("bot_free_period_codes")
      .delete()
      .eq("id", code.id);
    setDeleteTarget(null);
    if (error) {
      toast.error("Couldn't delete code", { description: error.message });
      return;
    }
    toast.success(`Deleted "${code.code}"`);
    reload();
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success(`Copied "${c}"`);
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Free-period codes</h3>
          <p className="text-sm text-muted-foreground">
            Give giveaway winners (or anyone) free months on a bot. Users redeem
            codes from their Bot Dashboard.
          </p>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-lg border border-border bg-card/40 p-4 mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="free-code">Code</Label>
            <div className="flex gap-1 mt-1">
              <Input
                id="free-code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                maxLength={100}
                disabled={creating}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setNewCode(randomCode())}
                disabled={creating}
                title="Generate random code"
              >
                <Power className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="free-months">Months</Label>
            <Input
              id="free-months"
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(parseInt(e.target.value, 10) || 1)}
              disabled={creating}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="free-max-uses">Max uses</Label>
            <Input
              id="free-max-uses"
              type="number"
              min={1}
              placeholder="∞ unlimited"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              disabled={creating}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="free-notes">Notes (optional)</Label>
            <Input
              id="free-notes"
              placeholder="e.g. April giveaway"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={creating}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={createCode} disabled={creating}>
            <Plus className="h-4 w-4 mr-1.5" />
            {creating ? "Creating…" : "Create code"}
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No free-period codes yet. Create one above.
        </p>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => {
            const exhausted = c.max_uses !== null && c.times_used >= c.max_uses;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-3"
              >
                <code className="font-mono text-sm font-semibold px-2 py-1 rounded bg-muted">
                  {c.code}
                </code>
                <Badge variant="secondary" className="text-xs">
                  {c.months} month{c.months === 1 ? "" : "s"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {c.times_used} / {c.max_uses ?? "∞"} used
                </Badge>
                {!c.is_active && (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                    Disabled
                  </Badge>
                )}
                {exhausted && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                    Exhausted
                  </Badge>
                )}
                {c.notes && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {c.notes}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Active
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={() => toggleActive(c)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyCode(c.code)}
                    title="Copy code"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(c)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.code}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The code will no longer work. This won't revoke any free periods
              that were already redeemed — those stay active until they expire
              naturally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteCode(deleteTarget);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
