import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { KeyRound, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

type Slot = {
  id: string;
  addon_id: string;
  key: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
};

const empty: Omit<Slot, "id"> = {
  addon_id: "base",
  key: "",
  label: "",
  description: "",
  placeholder: "",
  is_required: false,
  sort_order: 0,
};

export function BotSecretSlotManager() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Slot | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bot_secret_slots")
      .select("*")
      .order("addon_id")
      .order("sort_order");
    if (error) toast.error(error.message);
    setSlots((data ?? []) as Slot[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold">Bot secret slots</div>
            <p className="text-xs text-muted-foreground">
              Define which credentials each add-on needs. Users see these in their bot dashboard.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New slot
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading…
        </div>
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No slots yet. Create the first one to let users store secrets.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.label}</span>
                  <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    {s.key}
                  </code>
                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                    {s.addon_id}
                  </Badge>
                  {s.is_required && (
                    <Badge variant="outline" className="text-[10px] py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30">
                      required
                    </Badge>
                  )}
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {s.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleting(s)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(editing || creating) && (
        <SlotForm
          initial={editing ?? { id: "", ...empty }}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            reload();
          }}
        />
      )}

      {deleting && (
        <AlertDialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete slot "{deleting.label}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Existing user-stored values for this key will be orphaned (still encrypted in
                the database, but invisible in the dashboard). Users will need a new slot to
                save it again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  const { error } = await (supabase as any)
                    .from("bot_secret_slots")
                    .delete()
                    .eq("id", deleting.id);
                  if (error) {
                    toast.error(error.message);
                  } else {
                    toast.success("Slot deleted");
                    reload();
                  }
                  setDeleting(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
}

function SlotForm({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: Slot;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Slot>(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.key.trim() || !form.label.trim() || !form.addon_id.trim()) {
      toast.error("Key, label, and addon are required.");
      return;
    }
    setSaving(true);
    const payload = {
      addon_id: form.addon_id.trim(),
      key: form.key.trim().toUpperCase(),
      label: form.label.trim(),
      description: form.description?.trim() || null,
      placeholder: form.placeholder?.trim() || null,
      is_required: form.is_required,
      sort_order: form.sort_order ?? 0,
    };
    const { error } = isNew
      ? await (supabase as any).from("bot_secret_slots").insert(payload)
      : await (supabase as any).from("bot_secret_slots").update(payload).eq("id", form.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isNew ? "Slot created" : "Slot updated");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "New secret slot" : "Edit slot"}</DialogTitle>
          <DialogDescription>
            Slots tell users which credentials their bot needs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Add-on id</Label>
              <Input
                value={form.addon_id}
                onChange={(e) => setForm({ ...form, addon_id: e.target.value })}
                placeholder="base"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Key</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })}
                placeholder="DISCORD_TOKEN"
                className="mt-1.5 font-mono uppercase"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Discord bot token"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Where to get this value, why it's needed…"
              className="mt-1.5 min-h-[70px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Placeholder</Label>
              <Input
                value={form.placeholder ?? ""}
                onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                placeholder="MTI..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: Number.parseInt(e.target.value || "0", 10) })
                }
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Required</div>
              <p className="text-xs text-muted-foreground">
                Bot can't run without this secret being set.
              </p>
            </div>
            <Switch
              checked={form.is_required}
              onCheckedChange={(v) => setForm({ ...form, is_required: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
