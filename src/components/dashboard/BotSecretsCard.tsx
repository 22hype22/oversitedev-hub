import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Loader2, Server, Radio, RefreshCw, Check, ChevronsUpDown, ArrowRight } from "lucide-react";
import type { OwnedBot } from "@/hooks/useOwnedBots";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  useBotGuilds,
  useBotChannels,
  sortedChannelCategoryEntries,
} from "@/hooks/useGuildChannels";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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
.oskeys .rgtrig{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;
  background:var(--inp);border:1px solid var(--line2);border-radius:9px;padding:11px 13px;
  color:var(--heading);font-size:13px;cursor:pointer;text-align:left}
.oskeys .rgtrig:disabled{opacity:.6;cursor:default}
.oskeys .rgtrig .rgph{color:var(--faint)}
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

/* Voice-channel picker (dispatch bots) — styled like the key sections. */
.oskeys .vc{display:grid;gap:14px}
.oskeys .vcrow{display:flex;flex-direction:column;gap:6px}
.oskeys .vchead{display:flex;align-items:center;justify-content:space-between;gap:10px}
.oskeys .vclbl{font-size:11px;font-weight:700;color:var(--body);letter-spacing:.01em}
.oskeys .refresh{border:none;background:transparent;color:var(--faint);font:inherit;font-size:11.5px;
  font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:0}
.oskeys .refresh:hover:not(:disabled){color:var(--body)}
.oskeys .refresh:disabled{opacity:.5;cursor:not-allowed}
.oskeys .refresh svg{width:12px;height:12px}
.oskeys .vcfoot{margin-top:12px;font-size:12px;line-height:1.5}
.oskeys .vcfoot.ok{color:var(--ok);display:inline-flex;align-items:center;gap:6px}
.oskeys .vcfoot.note{color:var(--faint)}
`;

// Once a secret is confirmed SET we remember it per (bot, key) in localStorage,
// so a later metadata read that transiently returns is_set:false — or drops the
// slot entirely — can never flip a genuinely-saved credential back to an empty
// "Required" field. Only an explicit Remove clears the sticky flag.
const stickyKey = (botId: string) => `oversite:secretsset:${botId}`;
function stickyGet(botId: string): Set<string> {
  try {
    const raw = localStorage.getItem(stickyKey(botId));
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set<string>(); }
}
function stickySave(botId: string, set: Set<string>) {
  try { localStorage.setItem(stickyKey(botId), JSON.stringify([...set])); } catch { /* ignore */ }
}
function stickyAdd(botId: string, key: string) {
  const s = stickyGet(botId); s.add(key); stickySave(botId, s);
}
function stickyRemove(botId: string, key: string) {
  const s = stickyGet(botId); s.delete(key); stickySave(botId, s);
}

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
    // API keys are gated by `manage_secrets` for invited members. The voice
  // channel is bot config, not a secret, so it ALWAYS shows (owners and any
  // member who can reach this bot page). Owners: full access.
  const { permissions: teamPerms } = useTeamRole(bot.viaTeam ? bot.id : null);
  const canSecrets = !bot.viaTeam || teamPerms.manage_secrets;

  const reload = useCallback(async (silent = false) => {
    // Silent reload (e.g. after saving the voice channel) refreshes the slot
    // metadata without flipping `loading`, so sections don't unmount and lose
    // their local UI state (the picked channel would otherwise reset).
    if (!silent) setLoading(true);
    // The backend occasionally drops a request ("Failed to fetch") — retry a few
    // times, and on a hard failure KEEP whatever slots we already have rather
    // than blanking the card (which would hide a saved key behind an empty box).
    let data: any = null, lastErr: any = null, ok = false;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await (supabase as any).rpc("get_bot_secrets_metadata", { _bot_id: bot.id });
        if (!r.error) { data = r.data; ok = true; break; }
        lastErr = r.error;
      } catch (e) { lastErr = e; }
      await new Promise((res) => setTimeout(res, 500 * (i + 1)));
    }
    if (ok) {
      const fresh = (data ?? []) as SlotMeta[];
      const sticky = stickyGet(bot.id);
      for (const slot of fresh) {
        if (slot.is_set) stickyAdd(bot.id, slot.key);
        else if (sticky.has(slot.key)) slot.is_set = true; // known-set, don't downgrade
      }
      setSlots(fresh);
    } else {
      toast.error("Couldn't load credentials", { description: lastErr?.message ?? "Network error" });
      // leave existing slots untouched
    }
    setLoading(false);
  }, [bot.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = (canSecrets ? slots : [])
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
          <>
            {visible.map((s) => (
              <SecretRow key={s.key} bot={bot} slot={s} onChanged={reload} />
            ))}
          </>
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
  // Set the moment a save succeeds, so the masked dots stay put even if the
  // follow-up metadata reload hiccups (slot.is_set would otherwise still be
  // false locally until a clean reload lands).
  const [savedLocal, setSavedLocal] = useState(false);

  const save = async () => {
    const v = value.trim();
    if (!v) {
      toast.error("Enter a value first.");
      return;
    }
    setSaving(true);
    // The backend sometimes drops the request ("Failed to fetch") — retry a few
    // times with backoff before giving up, so a transient blip doesn't look like
    // the save failed (and leave the field blank on the next load).
    let res: { ok?: boolean; error?: string } | null = null;
    let lastErr: string | null = null;
    for (let i = 0; i < 4; i++) {
      try {
        const { data, error } = await (supabase as any).rpc("set_bot_secret", {
          _bot_id: bot.id,
          _key: slot.key,
          _value: v,
        });
        const d = data as { ok?: boolean; error?: string } | null;
        if (!error && d?.ok) { res = d; lastErr = null; break; }
        lastErr = d?.error ?? error?.message ?? "unknown error";
        // A real server-side rejection (ok:false with a reason) won't fix itself
        // on retry — stop and show it. Only retry blank/network errors.
        if (d && d.ok === false && d.error) break;
      } catch (e) {
        lastErr = (e as Error)?.message ?? String(e);
      }
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
    setSaving(false);
    if (!res?.ok) {
      toast.error("Couldn't save", { description: lastErr ?? "Network error — please try again." });
      return;
    }
    toast.success(`${slot.label} saved`);
    setValue("");
    setSavedLocal(true);
    setEditing(false);
    stickyAdd(bot.id, slot.key);
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
    stickyRemove(bot.id, slot.key);
    setValue("");
    setSavedLocal(false);
    setEditing(true);
    onChanged();
  };

  // Treat a slot as set if the server says so OR we just saved it this session.
  const isSet = slot.is_set || savedLocal;

  const chip = isSet ? (
    <span className="chip ok">Saved</span>
  ) : slot.is_required ? (
    <span className="chip req">Required</span>
  ) : null;

  return (
    <div className="sec">
      <div className="eyebrow">
        <span className="lbl">{slot.label}</span>
        <span className="ln" />
        {chip}
      </div>

      {slot.description && <div className="ed">{slot.description}</div>}

      {isSet && !editing ? (
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
          {isSet && (
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

// Region catalog — MUST match the dispatch bot's REGION_CATALOG.
const REGION_COUNTRIES = [
  "the United States", "United Kingdom", "Canada", "Australia", "Germany", "Mexico",
];
const REGION_US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

// Region picker for dispatch bots — the real-world area the dispatcher talks
// like (its radio codes, signals, phonetics). Stored via the dispatch-region
// edge function; the bot adopts it on its next config refresh (~60s), and the
// bot's /region command writes back here, so the two stay in sync.
export function RegionSection({ botId }: { botId: string }) {
  const [region, setRegion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // Read the current region. Also re-run when the tab/window regains focus, so a
  // change made elsewhere (e.g. the bot's /region command in Discord) shows up
  // here without a manual refresh.
  const fetchRegion = useCallback(async () => {
    const { data } = await supabase.functions.invoke("dispatch-region", {
      body: { botId: botId },
    });
    if ((data as any)?.region) setRegion((data as any).region);
  }, [botId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchRegion();
      if (!cancelled) setLoading(false);
    })();
    const refresh = () => { if (!document.hidden) void fetchRegion(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchRegion]);

  const pick = async (value: string) => {
    setOpen(false);
    if (!value || value === region) return;
    const prev = region;
    setRegion(value);
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("dispatch-region", {
      body: { botId: botId, region: value },
    });
    setSaving(false);
    if (error || !(data as any)?.ok) {
      setRegion(prev);
      toast.error("Couldn't save region", {
        description: (data as any)?.error ?? (error as any)?.message,
      });
      return;
    }
    toast.success("Dispatch region set", { description: value });
  };

  const label = region ? region.replace(/^the /, "") : "";

  return (
    <div className="sec">
      <div className="eyebrow">
        <span className="lbl">Region</span>
        <span className="ln" />
        {region && <span className="chip ok">Set</span>}
      </div>
      <div className="ed">
        The real-world area your dispatcher talks like — its radio codes, signals, and
        phonetic alphabet. Applies within a minute of saving, no restart.
      </div>
      <div className="vc">
        <div className="vcrow">
          <span className="vclbl">Area</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="rgtrig" disabled={loading || saving}>
                <span className="flex items-center gap-2 min-w-0">
                  <Radio size={15} className="shrink-0" />
                  <span className="truncate">
                    {loading ? "Loading…" : (label || <span className="rgph">Select a state or country…</span>)}
                  </span>
                </span>
                <ChevronsUpDown size={14} className="shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]" align="start">
              <Command>
                <CommandInput placeholder="Type to search… e.g. al" />
                <CommandList>
                  <CommandEmpty>No match.</CommandEmpty>
                  <CommandGroup heading="Countries">
                    {REGION_COUNTRIES.map((r) => {
                      const text = r.replace(/^the /, "");
                      return (
                        <CommandItem key={r} value={text} onSelect={() => pick(r)}>
                          {text}
                          {region === r && <Check size={14} className="ml-auto" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandGroup heading="US States">
                    {REGION_US_STATES.map((r) => (
                      <CommandItem key={r} value={r} onSelect={() => pick(r)}>
                        {r}
                        {region === r && <Check size={14} className="ml-auto" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

// Voice-channel picker for dispatch bots — sits under the API keys as its own
// "Voice channel" section. The chosen channel is written to the
// DISPATCH_VOICE_CHANNEL_ID secret; the bot picks it up on its next config
// refresh (~60s) with no restart.
export function VoiceChannelSection({
  botId,
  alreadySet,
  savedLastFour,
  onSaved,
}: {
  botId: string;
  alreadySet: boolean;
  savedLastFour: string;
  onSaved: () => void;
}) {
  const { guilds, loading: loadingGuilds } = useBotGuilds(botId);
  const [guildId, setGuildId] = useState<string | null>(null);
  const { channels, loading: loadingChannels, refreshing, refreshFromDiscord } = useBotChannels(
    botId,
    guildId ?? undefined,
  );
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);

  const voiceChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "voice"),
    [channels],
  );
  const groups = useMemo(() => sortedChannelCategoryEntries(voiceChannels), [voiceChannels]);

  // If the bot is only in one server, select it automatically.
  useEffect(() => {
    if (!guildId && guilds.length === 1) setGuildId(guilds[0].guild_id);
  }, [guilds, guildId]);

  // Restore the previously-saved channel in the dropdown after a refresh. The
  // full id isn't readable (write-only secret), so match on the last 4 chars
  // of the id among the loaded voice channels. Only pre-fills while the user
  // hasn't picked anything yet this session.
  useEffect(() => {
    if (channelId || !savedLastFour || voiceChannels.length === 0) return;
    const match = voiceChannels.find((c) => c.channel_id.endsWith(savedLastFour));
    if (match) {
      setChannelId(match.channel_id);
      setSavedName(match.channel_name);
    }
  }, [channelId, savedLastFour, voiceChannels]);

  const pick = async (id: string) => {
    setChannelId(id);
    if (!id) return;
    const c = voiceChannels.find((x) => x.channel_id === id);
    if (!c) return;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("set_bot_secret", {
      _bot_id: botId,
      _key: "DISPATCH_VOICE_CHANNEL_ID",
      _value: c.channel_id,
    });
    setSaving(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error("Couldn't save channel", { description: res?.error ?? error?.message });
      return;
    }
    setSavedName(c.channel_name);
    toast.success("Dispatch voice channel set", { description: `#${c.channel_name}` });
    onSaved();
  };

  return (
    <div className="sec">
      <div className="eyebrow">
        <span className="lbl">Voice channel</span>
        <span className="ln" />
        {(savedName || alreadySet) && <span className="chip ok">Set</span>}
      </div>
      <div className="ed">
        The voice channel your dispatcher sits in and speaks from. It joins within a minute of
        saving — no restart needed.
      </div>

      <div className="vc">
        <div className="vcrow">
          <span className="vclbl">Server</span>
          <Select
            value={guildId ?? ""}
            disabled={loadingGuilds || guilds.length === 0}
            onValueChange={(v) => {
              setGuildId(v || null);
              setChannelId("");
              setSavedName(null);
            }}
          >
            <SelectTrigger>
              <div className="flex items-center gap-2 min-w-0">
                <Server size={15} className="shrink-0" />
                <SelectValue
                  placeholder={
                    loadingGuilds
                      ? "Loading servers…"
                      : guilds.length === 0
                        ? "Bot not in any servers yet"
                        : "Select a server…"
                  }
                />
              </div>
            </SelectTrigger>
            <SelectContent>
              {guilds.map((g) => (
                <SelectItem key={g.guild_id} value={g.guild_id}>
                  {g.guild_name ?? g.guild_id}
                  {g.member_count != null ? ` · ${g.member_count.toLocaleString()} members` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="vcrow">
          <div className="vchead">
            <span className="vclbl">Voice channel</span>
            <button
              type="button"
              className="refresh"
              disabled={refreshing || !guildId}
              onClick={() => refreshFromDiscord()}
            >
              <RefreshCw className={refreshing ? "spin" : ""} size={12} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <Select
            value={channelId}
            disabled={!guildId || loadingChannels || voiceChannels.length === 0}
            onValueChange={(v) => pick(v)}
          >
            <SelectTrigger>
              <div className="flex items-center gap-2 min-w-0">
                <Radio size={15} className="shrink-0" />
                <SelectValue
                  placeholder={
                    !guildId
                      ? "Select a server first"
                      : loadingChannels
                        ? "Loading channels…"
                        : voiceChannels.length === 0
                          ? "No voice channels — click Refresh"
                          : "Select a voice channel…"
                  }
                />
              </div>
            </SelectTrigger>
            <SelectContent>
              {groups.map((grp) => (
                <SelectGroup key={grp.key}>
                  <SelectLabel>{grp.label}</SelectLabel>
                  {grp.channels.map((c) => (
                    <SelectItem key={c.channel_id} value={c.channel_id}>
                      {c.channel_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {saving ? (
        <div className="vcfoot note">Saving…</div>
      ) : savedName ? (
        <div className="vcfoot ok">
          <Check size={14} /> Saved — dispatcher will join #{savedName}.
        </div>
      ) : alreadySet ? (
        <div className="vcfoot note">A voice channel is currently set. Pick again to change it.</div>
      ) : null}
    </div>
  );
}


/**
 * Standalone dashboard BLOCKS for dispatch bots — the same region and voice
 * pickers that used to hide inside the API-keys card, presented as the
 * standard 158px config tile every other add-on uses (same .acard shell as
 * AddonConfigCard — CSS duplicated on purpose, single-paste files) with the
 * picker in a dialog. The voice block fetches its own slot metadata
 * (saved-state + last-four) and refreshes it after a save.
 */
const DISPATCH_TILE_CSS = `
        .acard.acard{position:relative;height:158px;padding:15px;display:flex;flex-direction:column;border-radius:14px;
          font-family:'Manrope',system-ui,-apple-system,"Segoe UI",sans-serif;border:1px solid #3a434d;
          background:linear-gradient(180deg,#2d353e,#29313a);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);
          transition:transform .17s cubic-bezier(.22,1,.36,1),border-color .17s,box-shadow .17s;cursor:pointer}
        .acard.on:hover{transform:translateY(-2px);border-color:rgba(201,219,230,.42);
          box-shadow:0 16px 34px -18px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05)}
        .acard.off{opacity:.5;filter:grayscale(.6);cursor:default;background:#272e36}
        .acard .ac-head{display:flex;align-items:center;gap:10px}
        .acard .ac-ico{height:34px;width:34px;border-radius:10px;flex:none;display:grid;place-items:center;
          background:rgba(201,219,230,.10);border:1px solid rgba(201,219,230,.42);color:#C9DBE6;transition:.17s}
        .acard.on:hover .ac-ico{background:rgba(201,219,230,.16)}
        .acard.off .ac-ico{background:#343d46;border-color:#3a434d;color:#788591}
        .acard .ac-ico svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.8;fill:none}
        .acard .ac-title{flex:1;min-width:0;font-size:20px;font-weight:700;line-height:1.2;letter-spacing:-.01em;color:#E8EEF3;padding-top:0}
        .acard.off .ac-title{color:#A8B4BF}
        /* Enable/disable toggle — sits quietly in the top-right and blends into
           the card, brightening only on hover so it never reads as a sore thumb.
           Stays fully visible when the card is OFF so its state is obvious. */
        .acard .ac-sw{padding-top:0;flex:none;opacity:.38;transform:scale(.82);transform-origin:right center;
          transition:opacity .16s ease,transform .16s ease}
        .acard:hover .ac-sw{opacity:.85}
        .acard .ac-sw:hover{opacity:1}
        .acard.off .ac-sw{opacity:1}
        .acard .ac-summary{flex:1;margin-top:10px;font-size:12px;line-height:1.45;color:#788591;
          overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
        .acard .ac-foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px}
        .acard .ac-count{font-size:11.5px;font-weight:600;color:#788591}
        .acard .ac-arrow{height:16px;width:16px;color:#788591;transition:transform .17s,color .17s}
        .acard.on:hover .ac-arrow{color:#C9DBE6;transform:translateX(3px)}
`;

export function DispatchBlockCard({ botId, kind }: { botId: string; kind: "region" | "voice" }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<{ set: boolean; lastFour: string } | null>(
    kind === "voice" ? null : { set: false, lastFour: "" },
  );
  const loadSlot = useCallback(async () => {
    if (kind !== "voice") return;
    try {
      const { data } = await (supabase as any).rpc("get_bot_secrets_metadata", { _bot_id: botId });
      const s = ((data ?? []) as SlotMeta[]).find((x) => x.key === "DISPATCH_VOICE_CHANNEL_ID");
      setSlot({ set: !!s?.is_set, lastFour: s?.is_set ? (s.last_four ?? "") : "" });
    } catch {
      setSlot({ set: false, lastFour: "" });
    }
  }, [botId, kind]);
  useEffect(() => { void loadSlot(); }, [loadSlot]);

  const Icon = kind === "region" ? Radio : Server;
  const title = kind === "region" ? "Dispatcher Region" : "Dispatch Voice Channel";
  const sub = kind === "region"
    ? "The real-world area your dispatcher talks like — its radio codes, signals and phonetics."
    : "The voice channel your dispatcher joins to read calls and talk with officers.";

  return (
    <>
      <style>{DISPATCH_TILE_CSS}</style>
      <div className="acard on" onClick={() => setOpen(true)}>
        <div className="ac-head">
          <span className="ac-ico">
            <Icon />
          </span>
          <h3 className="ac-title">{title}</h3>
        </div>
        <p className="ac-summary">{sub}</p>
        <div className="ac-foot">
          <span className="ac-count">1 setting</span>
          <ArrowRight className="ac-arrow" />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-os-accent" />
              {title}
            </DialogTitle>
            <DialogDescription>{sub}</DialogDescription>
          </DialogHeader>
          <div className="oskeys">
            <style>{SECRETS_CSS}</style>
            {kind === "region" ? (
              <RegionSection botId={botId} />
            ) : slot === null ? (
              <div className="loading">
                <Loader2 className="spin" size={15} />
                Loading…
              </div>
            ) : (
              <VoiceChannelSection
                botId={botId}
                alreadySet={slot.set}
                savedLastFour={slot.lastFour}
                onSaved={() => void loadSlot()}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
