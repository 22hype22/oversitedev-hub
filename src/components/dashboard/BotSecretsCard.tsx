import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import type { OwnedBot } from "@/hooks/useOwnedBots";

// Self-contained styling in the dashboard's own design language (mirrors
// BotManagePanel): eyebrow + trailing hairline sections, hairline borders,
// tinted controls. Scoped under .oskeys so nothing leaks.
const SECRETS_CSS = `
.oskeys{
  --line:rgba(255,255,255,.055); --line2:rgba(255,255,255,.09);
  --heading:rgb(var(--os-heading)); --body:rgb(var(--os-body)); --faint:rgb(var(--os-faint));
  --accent:rgb(var(--os-accent)); --surface:rgb(var(--os-surface));
  --accentd:rgba(201,219,230,.10); --accentl:rgba(201,219,230,.28);
  --ok:#84d6a0; --okd:rgba(132,214,160,.12); --okl:rgba(132,214,160,.30);
  --warn:#e6c47c; --warnd:rgba(230,196,124,.12); --warnl:rgba(230,196,124,.30);
  --bad:#e98b8b; --badd:rgba(233,139,139,.12);
  --inp:rgba(15,18,22,.45);
  --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
}
.oskeys .panel{border:1px solid var(--line2);border-radius:14px;overflow:hidden;
  background:linear-gradient(180deg,rgba(255,255,255,.02),transparent 22%),var(--surface)}
.oskeys .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 22px}
.oskeys .pl{display:flex;align-items:flex-start;gap:12px}
.oskeys .ic{width:34px;height:34px;border-radius:10px;flex:none;display:grid;place-items:center;
  border:1px solid var(--accentl);background:var(--accentd);color:var(--accent)}
.oskeys .ic svg{width:17px;height:17px}
.oskeys .pt{font-size:14.5px;font-weight:700;color:var(--heading);letter-spacing:-.01em}
.oskeys .ps{font-size:12px;color:var(--faint);margin-top:3px;line-height:1.5;max-width:46ch}
.oskeys .chip{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  border-radius:999px;padding:4px 9px;white-space:nowrap;flex:none}
.oskeys .chip.warn,.oskeys .chip.req{color:var(--warn);background:var(--warnd);border:1px solid var(--warnl)}
.oskeys .chip.ok{color:var(--ok);background:var(--okd);border:1px solid var(--okl)}
.oskeys .sec{padding:18px 22px;border-top:1px solid var(--line)}
.oskeys .eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.oskeys .eyebrow .lbl{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--faint);white-space:nowrap}
.oskeys .eyebrow .ln{flex:1;height:1px;background:var(--line2)}
.oskeys .mono-key{font-family:var(--mono);font-size:10px;color:var(--faint);opacity:.85;margin-left:4px;
  text-transform:none;letter-spacing:0;font-weight:600}
.oskeys .ed{font-size:12px;color:var(--faint);line-height:1.55;margin-bottom:13px;max-width:56ch}
.oskeys .inprow{display:flex;gap:10px;align-items:stretch}
.oskeys .inp{flex:1;min-width:0;background:var(--inp);border:1px solid var(--line2);border-radius:9px;
  padding:11px 13px;color:var(--heading);font-family:var(--mono);font-size:13px;outline:none;
  transition:border-color .15s,box-shadow .15s}
.oskeys .inp::placeholder{color:var(--faint);font-family:inherit}
.oskeys .inp:focus{border-color:var(--accentl);box-shadow:0 0 0 3px var(--accentd)}
.oskeys .save{flex:none;border:1px solid var(--accentl);background:var(--accentd);color:var(--accent);
  border-radius:9px;padding:0 18px;font:inherit;font-weight:700;font-size:13px;cursor:pointer;
  transition:background .15s,border-color .15s,transform .05s;display:inline-flex;align-items:center;gap:6px}
.oskeys .save:hover:not(:disabled){background:rgba(201,219,230,.16);border-color:var(--accent);color:var(--heading)}
.oskeys .save:disabled{opacity:.5;cursor:not-allowed}
.oskeys .save:active:not(:disabled){transform:translateY(1px)}
.oskeys .savedrow{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.oskeys .dots{font-family:var(--mono);font-size:16px;letter-spacing:.28em;color:var(--faint);user-select:none}
.oskeys .btns{display:flex;gap:8px;flex:none}
.oskeys .mini{border:1px solid var(--line2);background:transparent;color:var(--body);border-radius:8px;
  padding:7px 13px;font:inherit;font-weight:600;font-size:12px;cursor:pointer;
  transition:color .15s,border-color .15s,background .15s;display:inline-flex;align-items:center;gap:6px}
.oskeys .mini:hover:not(:disabled){color:var(--heading);border-color:var(--accentl)}
.oskeys .mini.danger:hover:not(:disabled){color:var(--bad);border-color:rgba(233,139,139,.5);background:var(--badd)}
.oskeys .mini:disabled{opacity:.5;cursor:not-allowed}
.oskeys .loading{padding:28px 22px;display:flex;align-items:center;justify-content:center;gap:8px;
  color:var(--faint);font-size:13px}
.oskeys .spin{animation:oskeys-spin 1s linear infinite}
@keyframes oskeys-spin{to{transform:rotate(360deg)}}
`;

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
    <div className="oskeys">
      <style>{SECRETS_CSS}</style>
      <div className="panel">
        <div className="phead">
          <div className="pl">
            <span className="ic">
              <KeyRound />
            </span>
            <div>
              <div className="pt">API keys &amp; credentials</div>
              <div className="ps">
                Your bot needs these to connect to your game. Encrypted, and only ever read
                by your bot — never shown back to us or anyone.
              </div>
            </div>
          </div>
          {!loading && visible.length > 0 && (
            <span className={`chip ${allRequiredSet ? "ok" : "warn"}`}>
              {allRequiredSet ? "All set" : "Action needed"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading">
            <Loader2 className="spin" size={15} />
            Loading…
          </div>
        ) : (
          visible.map((s) => <SecretRow key={s.key} bot={bot} slot={s} onChanged={reload} />)
        )}
      </div>
    </div>
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

  const chip = slot.is_set ? (
    <span className="chip ok">Saved</span>
  ) : slot.is_required ? (
    <span className="chip req">Required</span>
  ) : null;

  return (
    <div className="sec">
      <div className="eyebrow">
        <span className="lbl">
          {slot.label}
          <span className="mono-key">{slot.key}</span>
        </span>
        <span className="ln" />
        {chip}
      </div>

      {slot.description && <div className="ed">{slot.description}</div>}

      {slot.is_set && !editing ? (
        <div className="savedrow">
          {/* Masked — the stored value is never displayed, even to the owner. */}
          <span className="dots">••••••••••••••••</span>
          <span className="btns">
            <button type="button" className="mini" onClick={() => setEditing(true)}>
              Replace
            </button>
            {!slot.is_required && (
              <button type="button" className="mini danger" onClick={remove} disabled={deleting}>
                {deleting && <Loader2 className="spin" size={13} />}
                Remove
              </button>
            )}
          </span>
        </div>
      ) : (
        <div className="inprow">
          <input
            className="inp"
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
            disabled={saving}
          />
          <button type="button" className="save" onClick={save} disabled={saving || !value.trim()}>
            {saving && <Loader2 className="spin" size={14} />}
            Save
          </button>
          {slot.is_set && (
            <button
              type="button"
              className="mini"
              onClick={() => {
                setValue("");
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
