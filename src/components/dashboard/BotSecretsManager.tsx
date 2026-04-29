import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  KeyRound,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
} from "lucide-react";

type SlotMeta = {
  addon_id: string;
  key: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  is_set: boolean;
  last_four: string;
  updated_at: string | null;
};

export function BotSecretsManager({
  botId,
  ownedAddons,
}: {
  botId: string;
  /** Add-on ids the bot owns (so we only show relevant slots). "base" is always included. */
  ownedAddons: Set<string>;
}) {
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<SlotMeta | null>(null);
  const [revealingSlot, setRevealingSlot] = useState<SlotMeta | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<SlotMeta | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_bot_secrets_metadata", {
      _bot_id: botId,
    });
    if (error) {
      toast.error("Couldn't load secrets", { description: error.message });
      setSlots([]);
    } else {
      setSlots((data ?? []) as SlotMeta[]);
    }
    setLoading(false);
  }, [botId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = useMemo(
    () => slots.filter((s) => ownedAddons.has(s.addon_id) || s.addon_id === "base"),
    [slots, ownedAddons],
  );

  const filledRequired = visible.filter((s) => s.is_required && s.is_set).length;
  const totalRequired = visible.filter((s) => s.is_required).length;
  const allRequiredSet = totalRequired > 0 && filledRequired === totalRequired;

  return (
    <Card className="bg-card/40 border-border">
      <div className="p-5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold flex items-center gap-2">
              Secrets &amp; tokens
              {totalRequired > 0 && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    allRequiredSet
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {filledRequired}/{totalRequired} required set
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stored encrypted. Only your bot's runtime can decrypt them.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1 hidden sm:flex">
          <ShieldCheck className="h-3 w-3" />
          Encrypted at rest
        </Badge>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading secrets…
          </div>
        ) : visible.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No secret slots configured for this bot's add-ons yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((slot) => (
              <li
                key={slot.key}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{slot.label}</span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {slot.key}
                    </code>
                    {slot.is_required && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        required
                      </Badge>
                    )}
                  </div>
                  {slot.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {slot.description}
                    </p>
                  )}
                  {slot.is_set && (
                    <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                      ••••••••{slot.last_four}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {slot.is_set ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setRevealingSlot(slot)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Reveal
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setEditingSlot(slot)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingSlot(slot)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditingSlot(slot)}>
                      Add
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingSlot && (
        <SetSecretDialog
          botId={botId}
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSaved={() => {
            setEditingSlot(null);
            reload();
          }}
        />
      )}

      {revealingSlot && (
        <RevealSecretDialog
          botId={botId}
          slot={revealingSlot}
          onClose={() => setRevealingSlot(null)}
        />
      )}

      {deletingSlot && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingSlot(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deletingSlot.label}?</AlertDialogTitle>
              <AlertDialogDescription>
                Your bot won't be able to use this credential anymore until you set it
                again. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  const slot = deletingSlot;
                  setDeletingSlot(null);
                  const { data, error } = await (supabase as any).rpc("delete_bot_secret", {
                    _bot_id: botId,
                    _key: slot.key,
                  });
                  if (error || !data?.ok) {
                    toast.error("Couldn't delete secret", {
                      description: error?.message ?? data?.error,
                    });
                    return;
                  }
                  toast.success(`${slot.label} removed`);
                  reload();
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

function SetSecretDialog({
  botId,
  slot,
  onClose,
  onSaved,
}: {
  botId: string;
  slot: SlotMeta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim()) {
      toast.error("Value cannot be empty");
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("set_bot_secret", {
      _bot_id: botId,
      _key: slot.key,
      _value: value,
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast.error("Couldn't save secret", { description: error?.message ?? data?.error });
      return;
    }
    toast.success(`${slot.label} saved`);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{slot.is_set ? "Update" : "Add"} {slot.label}</DialogTitle>
          {slot.description && (
            <DialogDescription>{slot.description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="secret-value" className="text-xs">
              Value
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="secret-value"
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={slot.placeholder ?? ""}
                autoFocus
                autoComplete="off"
                className="pr-10 font-mono text-xs"
                maxLength={8000}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Hide" : "Show"}
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            This will be encrypted before it's stored. Only your bot's runtime can read it.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !value.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevealSecretDialog({
  botId,
  slot,
  onClose,
}: {
  botId: string;
  slot: SlotMeta;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const reveal = async () => {
    if (!password) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("reveal_bot_secret", {
      _bot_id: botId,
      _key: slot.key,
      _password: password,
    });
    setLoading(false);
    if (error || !data?.ok) {
      toast.error("Couldn't reveal", { description: error?.message ?? data?.error });
      return;
    }
    setRevealed(data.value);
  };

  const copy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setPassword("");
          setRevealed(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Reveal {slot.label}
          </DialogTitle>
          <DialogDescription>
            {revealed
              ? "Copy it somewhere safe and close this dialog when you're done."
              : "Re-enter your account password to reveal the value."}
          </DialogDescription>
        </DialogHeader>

        {!revealed ? (
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="reveal-pwd" className="text-xs">
                Account password
              </Label>
              <Input
                id="reveal-pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                className="mt-1.5"
                onKeyDown={(e) => {
                  if (e.key === "Enter") reveal();
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 font-mono text-xs break-all max-h-40 overflow-auto">
              {revealed}
            </div>
            <Button size="sm" variant="outline" onClick={copy} className="w-full">
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy to clipboard"}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!revealed && (
            <Button onClick={reveal} disabled={!password || loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Reveal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
