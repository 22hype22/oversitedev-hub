import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KeyRound, Loader2, Check, Trash2 } from "lucide-react";
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

type Props = { bot: OwnedBot };

// A slot belongs on this bot's dashboard when its addon_id matches the bot's
// base, one of its purchased add-ons, or the generic "base" bucket. Managed
// (Oversite-provided) secrets are hidden — the customer never touches those.
function relevantScopes(bot: OwnedBot): Set<string> {
  const scopes = new Set<string>(["base"]);
  if (bot.base) scopes.add(bot.base.toLowerCase().trim());
  for (const a of bot.addons ?? []) scopes.add(a.toLowerCase().trim());
  return scopes;
}

// Keys owned by a dedicated block (e.g. the voice-channel picker) don't show
// here as a raw field.
const PICKER_MANAGED = new Set(["DISPATCH_VOICE_CHANNEL_ID"]);

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

  const visible = slots
    .filter(
      (s) =>
        !s.is_managed &&
        !PICKER_MANAGED.has(s.key) &&
        scopes.has((s.addon_id ?? "").toLowerCase().trim()),
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  if (!loading && visible.length === 0) return null;

  const allRequiredSet = visible.filter((s) => s.is_required).every((s) => s.is_set);

  return (
    <Card className="rounded-2xl border border-os-hairline/50 bg-os-surface/40 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl border border-os-accent/30 bg-os-accent/10 grid place-items-center shrink-0">
            <KeyRound className="h-[18px] w-[18px] text-os-accent" />
          </div>
          <div>
            <div className="font-display font-semibold text-os-heading">API keys &amp; credentials</div>
            <p className="text-xs text-os-faint mt-1 leading-relaxed max-w-prose">
              Your bot needs these to connect to your game. They're encrypted and only ever
              read by your bot — never shown back to us or anyone else.
            </p>
          </div>
        </div>
        {!loading && visible.length > 0 && (
          <span
            className={
              "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide " +
              (allRequiredSet
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-400/10 text-amber-300")
            }
          >
            {allRequiredSet ? "All set" : "Action needed"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-os-faint text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading…
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((s) => (
            <SecretRow key={s.key} bot={bot} slot={s} onChanged={reload} />
          ))}
        </div>
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
    setValue("");
    setEditing(true);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-os-hairline/45 bg-os-bg/40 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-os-heading">{slot.label}</span>
        <code className="font-mono text-[10px] text-os-faint bg-os-bg/70 border border-os-hairline/50 rounded px-1.5 py-0.5">
          {slot.key}
        </code>
        {slot.is_required && !slot.is_set && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
            Required
          </span>
        )}
        {slot.is_set && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
            <Check className="h-2.5 w-2.5" />
            Saved
          </span>
        )}
      </div>

      {slot.description && (
        <p className="text-xs text-os-faint mt-1.5 leading-relaxed">{slot.description}</p>
      )}

      {slot.is_set && !editing ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          {/* Masked — the stored value is never displayed, even to the owner. */}
          <span className="font-mono text-base tracking-[0.25em] text-os-faint select-none">
            ••••••••••••••••
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-os-body hover:text-os-heading"
              onClick={() => setEditing(true)}
            >
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
        <div className="mt-3 flex items-stretch gap-2.5">
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
            className="flex-1 min-w-0 font-mono bg-os-bg/60 border-os-hairline/60 text-os-heading placeholder:text-os-faint placeholder:font-sans focus-visible:border-os-accent focus-visible:ring-os-accent/30"
            disabled={saving}
          />
          <Button
            onClick={save}
            disabled={saving || !value.trim()}
            className="shrink-0 bg-os-accent text-os-bg hover:bg-os-accent/90 font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
          {slot.is_set && (
            <Button
              variant="ghost"
              className="shrink-0 text-os-body hover:text-os-heading"
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
    </div>
  );
}
