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
import { toast } from "sonner";
import { KeyRound, Loader2, Check, Eye, Trash2, ShieldCheck, Lock } from "lucide-react";
import type { OwnedBot } from "@/hooks/useOwnedBots";

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
  is_managed: boolean;
};

type Props = {
  bot: OwnedBot;
};

// A slot belongs on this bot's dashboard when its addon_id matches the bot's
// base, one of its purchased add-ons, or the generic "base" bucket. Managed
// (Oversite-provided) secrets are filtered out — the customer never touches
// those, so we only surface the keys they're expected to fill in.
function relevantScopes(bot: OwnedBot): Set<string> {
  const scopes = new Set<string>(["base"]);
  if (bot.base) scopes.add(bot.base.toLowerCase().trim());
  for (const a of bot.addons ?? []) scopes.add(a.toLowerCase().trim());
  return scopes;
}

export function BotSecretsCard({ bot }: Props) {
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const scopes = useMemo(() => relevantScopes(bot), [bot]);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_bot_secrets_metadata", {
      _bot_id: bot.id,
    });
    if (error) {
      toast.error("Couldn't load credentials", { description: error.message });
      setSlots([]);
    } else {
      setSlots((data ?? []) as SlotMeta[]);
    }
    setLoading(false);
  }, [bot.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = slots.filter(
    (s) => !s.is_managed && scopes.has((s.addon_id ?? "").toLowerCase().trim()),
  );

  if (!loading && visible.length === 0) return null;

  const allRequiredSet = visible
    .filter((s) => s.is_required)
    .every((s) => s.is_set);

  return (
    <Card className="p-5 space-y-4 rounded-2xl bg-card/60 border-border shadow-lg shadow-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/25 grid place-items-center shrink-0">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold">API keys & credentials</div>
            <p className="text-xs text-muted-foreground">
              Your bot needs these to connect to your game. They're encrypted and
              only ever read by your bot — never shown back to us or anyone else.
            </p>
          </div>
        </div>
        {!loading && visible.length > 0 && (
          <Badge
            variant="outline"
            className={
              allRequiredSet
                ? "shrink-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/30"
            }
          >
            {allRequiredSet ? "All set" : "Action needed"}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading…
        </div>
      ) : (
        <ul className="space-y-3">
          {visible
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => (
              <SecretRow key={s.key} bot={bot} slot={s} onChanged={reload} />
            ))}
        </ul>
      )}
    </Card>
  );
}

function SecretRow({
  bot,
  slot,
  onChanged,
}: {
  bot: OwnedBot;
  slot: SlotMeta;
  onChanged: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!slot.is_set);
  const [revealing, setRevealing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    const v = value.trim();
    if (!v) {
      toast.error("Enter a value first.");
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("set_bot_secret", {
      _bot_id: bot.id,
      _key: slot.key,
      _value: v,
    });
    setSaving(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error("Couldn't save", { description: res?.error ?? error?.message });
      return;
    }
    toast.success(`${slot.label} saved`);
    setValue("");
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    setDeleting(true);
    const { data, error } = await (supabase as any).rpc("delete_bot_secret", {
      _bot_id: bot.id,
      _key: slot.key,
    });
    setDeleting(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error("Couldn't remove", { description: res?.error ?? error?.message });
      return;
    }
    toast.success(`${slot.label} removed`);
    setEditing(true);
    onChanged();
  };

  return (
    <li className="rounded-xl border border-border bg-background/40 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{slot.label}</span>
            <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {slot.key}
            </code>
            {slot.is_required && !slot.is_set && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30"
              >
                required
              </Badge>
            )}
            {slot.is_set && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <Check className="h-3 w-3" />
                saved
              </span>
            )}
          </div>
          {slot.description && (
            <p className="text-xs text-muted-foreground mt-1">{slot.description}</p>
          )}
        </div>
      </div>

      {slot.is_set && !editing ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Lock className="h-3.5 w-3.5" />
            ••••••••{slot.last_four}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setRevealing(true)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Reveal
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(true)}>
              Replace
            </Button>
            {!slot.is_required && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={remove}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder={slot.placeholder ?? "Paste your key…"}
            className="font-mono"
            disabled={saving}
          />
          <Button size="sm" onClick={save} disabled={saving || !value.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
          {slot.is_set && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue("");
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
        </div>
      )}

      {revealing && (
        <RevealDialog
          botId={bot.id}
          slot={slot}
          onClose={() => setRevealing(false)}
        />
      )}
    </li>
  );
}

function RevealDialog({
  botId,
  slot,
  onClose,
}: {
  botId: string;
  slot: SlotMeta;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const reveal = async () => {
    if (!password) {
      toast.error("Enter your account password.");
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("reveal_bot_secret", {
      _bot_id: botId,
      _key: slot.key,
      _password: password,
    });
    setLoading(false);
    const res = data as { ok?: boolean; error?: string; value?: string } | null;
    if (error || !res?.ok) {
      toast.error("Couldn't reveal", { description: res?.error ?? error?.message });
      return;
    }
    setRevealed(res.value ?? "");
  };

  const copy = async () => {
    if (revealed == null) return;
    try {
      await navigator.clipboard.writeText(revealed);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Reveal {slot.label}
          </DialogTitle>
          <DialogDescription>
            Confirm your account password to view this value. It's decrypted only
            for you and never leaves this screen.
          </DialogDescription>
        </DialogHeader>

        {revealed == null ? (
          <div className="space-y-2 py-2">
            <Label className="text-xs">Account password</Label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  reveal();
                }
              }}
              placeholder="Your Oversite password"
            />
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <Label className="text-xs">{slot.label}</Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm break-all">
              {revealed || "(empty)"}
            </div>
          </div>
        )}

        <DialogFooter>
          {revealed == null ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={reveal} disabled={loading || !password}>
                {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Reveal
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={copy}>
                Copy
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
