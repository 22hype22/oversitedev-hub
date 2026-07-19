import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Play,
  Square,
  RotateCw,
  RefreshCcw,
  Terminal,
  MessageSquare,
  Server,
  Users,
  AlertTriangle,
  Plus,
  ChevronDown,
} from "lucide-react";
import { type OwnedBot } from "@/hooks/useOwnedBots";
import {
  announceBotTransition,
  clearBotTransition,
  type BotTransition,
} from "@/hooks/useLiveBotStatuses";
import { type BotHealth, formatUptime, formatRelative } from "@/hooks/useBotHealth";
import { useBotUsageMetrics, type BotUsageDay } from "@/hooks/useBotUsageMetrics";
import { useBotServerSlots } from "@/hooks/useBotServerSlots";
import { BotInviteLinkCard } from "@/components/dashboard/BotInviteLinkCard";
import { useBotLogs, type BotLogLevel } from "@/hooks/useBotLogs";

type Action = "start" | "stop" | "restart" | "redeploy";

interface BotManagePanelProps {
  bot: OwnedBot;
  health: BotHealth | null;
  isOffline: boolean;
  isDeploying: boolean;
  isStarting: boolean;
  highlightSlots?: boolean;
  onCommandSent: (action: Action) => void;
  onReload: () => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

function totals(data: BotUsageDay[]) {
  return data.reduce(
    (acc, r) => {
      acc.commands += r.commands_count;
      acc.messages += r.messages_count;
      acc.errors += r.errors_count;
      acc.servers = Math.max(acc.servers, r.max_active_servers);
      acc.members = Math.max(acc.members, r.max_member_count);
      return acc;
    },
    { commands: 0, messages: 0, errors: 0, servers: 0, members: 0 },
  );
}

const AVATAR_GRADIENTS = ["g1", "g2", "g3", "g4"];

const LOG_RANGES: Array<{ key: string; label: string; sinceMs: number | null }> = [
  { key: "1h", label: "1h", sinceMs: 60 * 60 * 1000 },
  { key: "24h", label: "24h", sinceMs: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7d", sinceMs: 7 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "All", sinceMs: null },
];

const ACTIONS: Array<{ key: Action; label: string; Icon: typeof Play; tone: string; desc: string }> = [
  { key: "start", label: "Start", Icon: Play, tone: "start", desc: "Boot the bot worker. It will go online once it has connected." },
  { key: "stop", label: "Stop", Icon: Square, tone: "stop", desc: "Take the bot offline. It stays off until you start it again." },
  { key: "restart", label: "Restart", Icon: RotateCw, tone: "restart", desc: "Stop the bot and immediately start it again. Useful after changing secrets or config." },
  { key: "redeploy", label: "Redeploy", Icon: RefreshCcw, tone: "redeploy", desc: "Pull the latest build for this bot, then restart. The bot will be offline briefly." },
];

export function BotManagePanel({
  bot,
  health,
  isOffline,
  isDeploying,
  isStarting,
  highlightSlots = false,
  onCommandSent,
  onReload,
}: BotManagePanelProps) {
  const locked = isOffline || isDeploying;

  // ── engine ──
  const engine = bot.engine_version === "v2" ? "v2" : "v1";
  const [engineTarget, setEngineTarget] = useState<"v1" | "v2" | null>(null);
  const [engineSaving, setEngineSaving] = useState(false);
  const switchEngine = async (target: "v1" | "v2") => {
    setEngineSaving(true);
    const { error } = await (supabase as any)
      .from("bot_orders")
      .update({ engine_version: target, updated_at: new Date().toISOString() })
      .eq("id", bot.id);
    setEngineSaving(false);
    setEngineTarget(null);
    if (error) {
      toast.error("Couldn't switch engine version", { description: error.message });
      return;
    }
    toast.success(`Switching to Components ${target.toUpperCase()}`, {
      description: "Your bot may have a short period of downtime while the engine swaps over.",
    });
    onReload();
  };

  // ── controls ──
  const [history, setHistory] = useState<{ action: string; status: string; completed_at: string | null; created_at: string }[]>([]);
  const [pending, setPending] = useState<Action | null>(null);
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);

  const refreshHistory = useCallback(async () => {
    const { data } = await supabase
      .from("bot_commands")
      .select("action, status, completed_at, created_at")
      .eq("bot_id", bot.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory((data ?? []) as typeof history);
  }, [bot.id]);
  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const send = async (action: Action) => {
    setPending(action);
    // Flip the status badge immediately — the pin in useLiveBotStatuses keeps
    // the label until the backend confirms the transition or its end state.
    const optimistic: Record<Action, BotTransition> = {
      start: "starting",
      stop: "stopping",
      restart: "restarting",
      redeploy: "updating",
    };
    announceBotTransition(bot.id, optimistic[action]);
    let ok = false;
    let errorMsg: string | null = null;
    try {
      if (action === "stop") {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) {
          errorMsg = "Not signed in";
        } else {
          const { error } = await supabase.from("bot_commands").insert({
            bot_id: bot.id, user_id: uid, requested_by: uid, action: "shutdown", status: "pending",
          });
          if (error) errorMsg = error.message; else ok = true;
        }
      } else {
        const { data, error } = await supabase.functions.invoke("bot-railway-action", {
          body: { botId: bot.id, action },
        });
        if (error) {
          let bodyMsg: string | null = null;
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.text === "function") {
            try {
              const raw = await ctx.text();
              try { bodyMsg = (JSON.parse(raw) as { error?: string })?.error ?? raw; }
              catch { bodyMsg = raw; }
            } catch { /* ignore */ }
          }
          errorMsg = bodyMsg ?? (data as { error?: string } | null)?.error ?? error.message ?? "Request failed";
        } else {
          const result = data as { ok?: boolean; error?: string } | null;
          if (!result?.ok) errorMsg = result?.error ?? "Failed to perform action."; else ok = true;
        }
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }
    setConfirmAction(null);
    setPending(null);
    if (!ok) {
      clearBotTransition(bot.id);
      toast.error(errorMsg ?? "Request failed");
      refreshHistory();
      return;
    }
    onCommandSent(action);
    const msg: Record<Action, string> = {
      start: "Booting up — your bot should be online in ~30 seconds.",
      stop: "Shutting down — the bot will go offline shortly.",
      restart: "Restarting now — back online in ~30 seconds.",
      redeploy: "Redeploy starting — pulling the latest build.",
    };
    toast.success(msg[action]);
    refreshHistory();
  };
  const confirmMeta = confirmAction ? ACTIONS.find((a) => a.key === confirmAction) : null;

  // ── status beam ──
  const status = useMemo(() => {
    if (isDeploying) return { tone: "busy", label: "Deploying", sub: "Pulling the latest build…" };
    if (isStarting) return { tone: "busy", label: "Starting", sub: "Coming online in ~30 seconds…" };
    if (isOffline) return { tone: "off", label: "Offline", sub: "Not running — start it to make changes" };
    if (health?.effective_status === "online") {
      const up = formatUptime(health.uptime_seconds);
      return { tone: "on", label: "Online", sub: up && up !== "—" ? `Up ${up} · healthy` : "Running · healthy" };
    }
    const s = health?.effective_status ?? "unknown";
    return { tone: s === "online" ? "on" : "off", label: s.charAt(0).toUpperCase() + s.slice(1), sub: "" };
  }, [isDeploying, isStarting, isOffline, health]);

  const lastCmd = history.find((h) => h.status === "completed" || h.status === "done") ?? history[0];
  const lastLabel = lastCmd
    ? (lastCmd.action === "shutdown" ? "Stop" : lastCmd.action.charAt(0).toUpperCase() + lastCmd.action.slice(1))
    : null;

  // ── usage ──
  const { data: usage, loading: usageLoading } = useBotUsageMetrics(bot.id, 7);
  const t = useMemo(() => totals(usage), [usage]);
  const noUsage = !usageLoading && t.commands + t.messages + t.errors + t.servers + t.members === 0;

  // ── servers ──
  const { limit, guilds, loading: guildsLoading, refresh: refreshGuilds, purchase } = useBotServerSlots(bot.id);
  const [showAllServers, setShowAllServers] = useState(false);
  const isUnlimited = limit?.is_unlimited === true;
  const maxSlots = limit?.limit ?? 1;
  const currentSlots = guilds.length;
  const atLimit = !isUnlimited && currentSlots >= maxSlots;
  const shownGuilds = showAllServers ? guilds : guilds.slice(0, 5);
  const onBuySlot = async () => {
    const res = await purchase(1);
    if (!res.ok) toast.error(res.error ?? "Failed to start purchase");
  };
  // After returning from the one-time slot checkout, refresh the count + toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("slot_purchase");
    if (state === "success") {
      const start = Date.now();
      const tick = async () => {
        await refreshGuilds();
        if (Date.now() - start < 8000) setTimeout(tick, 1500);
      };
      tick();
      toast.success("Extra server slot added!");
    } else if (state === "cancelled") {
      toast.info("Purchase cancelled");
    }
    if (state) {
      params.delete("slot_purchase");
      const url = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── logs ──
  const [logRange, setLogRange] = useState("24h");
  const activeRange = LOG_RANGES.find((r) => r.key === logRange) ?? LOG_RANGES[1];
  const { logs } = useBotLogs(bot.id, activeRange.sinceMs === null ? 200 : 100, activeRange.sinceMs);

  return (
    <div className="mng2">
      <style>{MANAGE_CSS}</style>

      {/* ── ENGINE ── */}
      <div className="sec">
        <div className="eyebrow"><span className="lbl">Component engine</span><span className="ln" /></div>
        <div className="engrow">
          <div className="etx">
            <div className="en">Components {engine.toUpperCase()} is active</div>
            <div className="ed">
              V2 brings richer layouts and the newest Discord UI. V1 is the battle-tested stable engine.
            </div>
          </div>
          <div className="seg">
            {(["v1", "v2"] as const).map((id) => (
              <button
                key={id}
                type="button"
                disabled={engineSaving || engine === id}
                className={engine === id ? "on" : ""}
                onClick={() => setEngineTarget(id)}
              >
                {id.toUpperCase()}
                <span className="cap">{id === "v1" ? "Stable" : "Newest"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── POWER ── */}
      <div className="sec">
        <div className="eyebrow"><span className="lbl">Power</span><span className="ln" /></div>
        <div className="ctlbar">
          <div className="status">
            <span className={`beam ${status.tone}`} />
            <div className="stx">
              <div className="s1">{status.label}</div>
              {status.sub && <div className="s2">{status.sub}</div>}
            </div>
          </div>
          <div className="actions">
            {ACTIONS.map(({ key, label, Icon, tone }) => {
              const requiresOnline = key !== "start";
              const disabled = pending === key || (requiresOnline ? isOffline : !isOffline);
              return (
                <button
                  key={key}
                  type="button"
                  className={`act ${tone}`}
                  disabled={disabled}
                  onClick={() => setConfirmAction(key)}
                >
                  <Icon className={pending === key ? "spin" : ""} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {lastLabel && (
          <div className="clast">
            Last action: <b>{lastLabel}</b>
            {lastCmd?.status ? ` · ${lastCmd.status}` : ""}
            {lastCmd?.completed_at ? ` ${formatRelative(lastCmd.completed_at)}` : ""}
          </div>
        )}
      </div>

      {/* ── lower section (dims while offline/deploying) ── */}
      <div className={locked ? "mng2-lower locked" : "mng2-lower"} aria-disabled={locked}>

        {/* ── USAGE ── */}
        <div className="sec">
          <div className="eyebrow"><span className="lbl">Usage</span><span className="ln" /><span className="chip">Last 7 days</span></div>
          <div className="ustrip">
            <Ucell Icon={Terminal} label="Commands" value={compact(t.commands)} />
            <Ucell Icon={MessageSquare} label="Messages" value={compact(t.messages)} />
            <Ucell Icon={Server} label="Peak servers" value={compact(t.servers)} />
            <Ucell Icon={Users} label="Peak members" value={compact(t.members)} />
            <Ucell Icon={AlertTriangle} label="Errors" value={compact(t.errors)} err={t.errors > 0} />
          </div>
          <div className="ucap">
            <RefreshCcw />
            {noUsage ? "No activity recorded yet — stats appear once your bot is running." : "Updates automatically as your bot runs."}
          </div>
        </div>

        {/* ── SERVERS ── */}
        <div className="sec">
          <div className="eyebrow">
            <span className="lbl">Servers</span><span className="ln" />
            <span className="chip">{isUnlimited ? `${currentSlots} active` : `${currentSlots} / ${maxSlots} slots`}</span>
          </div>
          {shownGuilds.length > 0 ? (
            <div className="slist">
              {shownGuilds.map((g, i) => {
                const name = g.guild_name ?? g.guild_id;
                const joined = g.joined_at ? ` · joined ${formatRelative(g.joined_at)}` : "";
                return (
                  <div className="srow" key={g.id}>
                    <span className={`savatar ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]}`}>
                      {(name?.[0] ?? "#").toUpperCase()}
                    </span>
                    <div className="si">
                      <div className="snm">{name}</div>
                      <div className="smeta">{g.guild_id.slice(0, 3)}…{g.guild_id.slice(-2)}{joined}</div>
                    </div>
                    <span className="smem">
                      {g.member_count != null ? `${g.member_count.toLocaleString()} members` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              {guildsLoading ? "Loading servers…" : "Bot isn't in any servers yet. Invite it to get started."}
            </div>
          )}
          {guilds.length > 5 && (
            <button type="button" className="smore" onClick={() => setShowAllServers((v) => !v)}>
              {showAllServers ? "Show fewer" : `Show all ${guilds.length} servers`}
              <ChevronDown style={{ transform: showAllServers ? "rotate(180deg)" : "none" }} />
            </button>
          )}
          {/* Invite panel lives here, next to the server list it feeds. */}
          <div style={{ marginTop: 14 }}>
            <BotInviteLinkCard botId={bot.id} status={bot.status} onRequestBuySlot={onBuySlot} />
          </div>
          {!isUnlimited && (
            <div className={`slotbar ${highlightSlots || atLimit ? "hot" : ""}`}>
              <div className="sbx">
                <div className="sbt">{atLimit ? "You've hit your server limit" : "Need more room?"}</div>
                <div className="sbd">Extra slots are <b>$2.99 one-time</b>, shared across every bot you own.</div>
              </div>
              <button type="button" className="sbtn" onClick={onBuySlot}><Plus />Add a slot</button>
            </div>
          )}
        </div>

        {/* ── LOGS ── */}
        <div className="sec">
          <div className="eyebrow"><span className="lbl">Recent logs</span><span className="ln" /></div>
          <div className="logbar">
            <span className="live"><span className="ld" />LIVE</span>
            <div className="ranges">
              {LOG_RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`range ${logRange === r.key ? "on" : ""}`}
                  onClick={() => setLogRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="term">
            <div className="termhead">
              <i className="r" /><i className="y" /><i className="g" />
              <span>{bot.bot_name ?? "bot"} · runtime</span>
            </div>
            <div className="rows">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div className="lrow" key={log.id}>
                    <span className="lt">{new Date(log.created_at).toLocaleTimeString()}</span>
                    <span className={`lv ${log.level as BotLogLevel}`}>{log.level}</span>
                    <span className="lm">{log.message}</span>
                  </div>
                ))
              ) : (
                <div className="lrow empty2">No logs in this window yet. New activity streams in live.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── engine confirm ── */}
      <ConfirmModal
        open={engineTarget !== null}
        title={`Switch to Components ${engineTarget?.toUpperCase() ?? ""}?`}
        body="Your bot may have a short period of downtime while the engine swaps over. Commands and events may be briefly unavailable."
        confirmLabel={engineSaving ? "Switching…" : "Switch version"}
        busy={engineSaving}
        onCancel={() => !engineSaving && setEngineTarget(null)}
        onConfirm={() => engineTarget && switchEngine(engineTarget)}
      />

      {/* ── control confirm ── */}
      <ConfirmModal
        open={confirmAction !== null}
        title={confirmMeta ? `${confirmMeta.label} this bot?` : ""}
        body={confirmMeta?.desc ?? ""}
        confirmLabel={`Yes, ${confirmMeta?.label.toLowerCase() ?? ""}`}
        tone={confirmAction === "stop" ? "danger" : undefined}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && send(confirmAction)}
      />
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  tone,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: "danger";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="mng2">
      <style>{MANAGE_CSS}</style>
      <div className="cfmask" onClick={onCancel}>
        <div className="cfbox" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="cft">{title}</div>
          <div className="cfb">{body}</div>
          <div className="cfa">
            <button type="button" className="cfcancel" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className={`cfok ${tone ?? ""}`} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ucell({ Icon, label, value, err = false }: { Icon: typeof Terminal; label: string; value: string; err?: boolean }) {
  return (
    <div className={`ucell ${err ? "err" : ""}`}>
      <div className="uk"><Icon />{label}</div>
      <div className="uv">{value}</div>
    </div>
  );
}

const MANAGE_CSS = `
.mng2{--line:rgba(255,255,255,.055);--line2:rgba(255,255,255,.09);
  --ok:#84d6a0;--okd:rgba(132,214,160,.12);--warn:#e6c47c;--warnd:rgba(230,196,124,.12);
  --bad:#e98b8b;--badd:rgba(233,139,139,.12);--info:#93bbe0;--busy:#93bbe0;--busyd:rgba(147,187,224,.12);
  background:linear-gradient(180deg,rgba(255,255,255,.022),transparent 40%);
  border:1px solid var(--hair);border-radius:16px;overflow:hidden;
  box-shadow:0 24px 60px -34px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.04);
  font-family:'Manrope',system-ui,-apple-system,"Segoe UI",sans-serif}
.mng2 svg{display:block}

.mng2 .sec{padding:20px 22px;border-top:1px solid var(--line)}
.mng2 .sec:first-of-type,.mng2 .mng2-lower>.sec:first-of-type{border-top:0}
.mng2 .mng2-lower>.sec:first-of-type{border-top:1px solid var(--line)}
.mng2 .mng2-lower{display:block}
.mng2 .mng2-lower.locked{opacity:.4;pointer-events:none;user-select:none}

/* eyebrow */
.mng2 .eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.mng2 .eyebrow .lbl{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);white-space:nowrap}
.mng2 .eyebrow .ln{flex:1;height:1px;background:var(--line)}
.mng2 .eyebrow .chip{font-size:10.5px;font-weight:700;color:var(--body);background:rgba(255,255,255,.04);
  border:1px solid var(--hair);border-radius:20px;padding:3px 10px;letter-spacing:.02em;white-space:nowrap}

/* engine */
.mng2 .engrow{display:flex;align-items:center;gap:18px}
.mng2 .engrow .etx{flex:1;min-width:0}
.mng2 .engrow .en{font-size:14px;font-weight:700;color:var(--heading)}
.mng2 .engrow .ed{font-size:12px;color:var(--faint);margin-top:3px;line-height:1.5}
.mng2 .seg{display:flex;background:rgba(0,0,0,.22);border:1px solid var(--hair);border-radius:12px;padding:4px;flex:none;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.25)}
.mng2 .seg button{border:0;background:transparent;color:var(--body);cursor:pointer;border-radius:9px;padding:9px 20px;
  font:inherit;font-size:13px;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:1px;transition:.16s}
.mng2 .seg button .cap{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.6}
.mng2 .seg button:hover:not(:disabled):not(.on){color:var(--heading)}
.mng2 .seg button.on{background:linear-gradient(180deg,#d6e4ee,#c1d4e0);color:#1E242B;cursor:default;
  box-shadow:0 2px 8px -2px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.5)}
.mng2 .seg button:disabled:not(.on){opacity:.55;cursor:not-allowed}

/* power */
.mng2 .ctlbar{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.mng2 .status{display:flex;align-items:center;gap:12px;flex:1;min-width:170px}
.mng2 .status .beam{height:11px;width:11px;border-radius:50%;flex:none;position:relative;background:var(--faint)}
.mng2 .status .beam.on{background:var(--ok);box-shadow:0 0 0 4px var(--okd)}
.mng2 .status .beam.on::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--ok);animation:mng2pulse 2.2s ease-out infinite}
.mng2 .status .beam.busy{background:var(--busy);box-shadow:0 0 0 4px var(--busyd)}
.mng2 .status .beam.busy::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--busy);animation:mng2pulse 2.2s ease-out infinite}
.mng2 .status .beam.off{background:var(--faint);box-shadow:0 0 0 4px rgba(120,133,145,.1)}
@keyframes mng2pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
.mng2 .status .s1{font-size:15px;font-weight:700;color:var(--heading);letter-spacing:-.01em}
.mng2 .status .s2{font-size:11.5px;color:var(--faint);margin-top:1px}
.mng2 .actions{display:flex;gap:8px;flex-wrap:wrap}
.mng2 .act{display:flex;align-items:center;gap:8px;height:40px;padding:0 15px;border-radius:11px;border:1px solid var(--hair);
  background:linear-gradient(180deg,rgba(255,255,255,.03),transparent);color:var(--body);font:inherit;font-size:12.5px;
  font-weight:600;cursor:pointer;transition:.16s}
.mng2 .act svg{width:15px;height:15px;stroke:currentColor;stroke-width:2;fill:none}
.mng2 .act svg.spin{animation:mng2spin 1s linear infinite}
.mng2 .act:hover:not(:disabled){color:var(--heading);border-color:var(--line2);transform:translateY(-1px)}
.mng2 .act.start:hover:not(:disabled){border-color:rgba(132,214,160,.5);color:var(--ok);background:var(--okd)}
.mng2 .act.stop:hover:not(:disabled){border-color:rgba(233,139,139,.5);color:var(--bad);background:var(--badd)}
.mng2 .act.restart:hover:not(:disabled){border-color:rgba(230,196,124,.5);color:var(--warn);background:var(--warnd)}
.mng2 .act.redeploy:hover:not(:disabled){border-color:rgba(201,219,230,.5);color:var(--accent);background:rgba(201,219,230,.09)}
.mng2 .act:disabled{opacity:.4;cursor:not-allowed}
.mng2 .clast{margin-top:14px;font-size:11.5px;color:var(--faint)}
.mng2 .clast b{color:var(--body);font-weight:600}
@keyframes mng2spin{to{transform:rotate(360deg)}}

/* usage */
.mng2 .ustrip{display:flex;border:1px solid var(--hair);border-radius:14px;overflow:hidden;background:rgba(0,0,0,.14)}
.mng2 .ucell{flex:1;padding:16px 16px 15px;border-right:1px solid var(--line);min-width:0}
.mng2 .ucell:last-child{border-right:0}
.mng2 .ucell .uk{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);
  display:flex;align-items:center;gap:5px;white-space:nowrap}
.mng2 .ucell .uk svg{width:12px;height:12px;flex:none;stroke:currentColor;stroke-width:2;fill:none;opacity:.75}
.mng2 .ucell .uv{font-family:'Manrope',system-ui,sans-serif;font-size:25px;font-weight:800;color:var(--heading);letter-spacing:-.02em;margin-top:9px;line-height:1}
.mng2 .ucell.err .uv{color:var(--bad)}
.mng2 .ucell.err .uk svg{color:var(--bad);opacity:1}
.mng2 .ucap{font-size:11px;color:var(--faint);margin-top:12px;display:flex;align-items:center;gap:6px}
.mng2 .ucap svg{width:12px;height:12px;flex:none;stroke:currentColor;stroke-width:2;fill:none}

/* servers */
.mng2 .slist{display:flex;flex-direction:column;gap:7px}
.mng2 .srow{display:flex;align-items:center;gap:13px;padding:11px 14px;border-radius:12px;border:1px solid var(--hair);
  background:rgba(255,255,255,.018);transition:.16s}
.mng2 .srow:hover{border-color:var(--line2);background:rgba(255,255,255,.035)}
.mng2 .savatar{height:38px;width:38px;border-radius:11px;flex:none;display:grid;place-items:center;font-weight:800;font-size:15px;
  color:#12161a;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.mng2 .savatar.g1{background:linear-gradient(140deg,#c9dbe6,#8fb0c4)}
.mng2 .savatar.g2{background:linear-gradient(140deg,#e0c8a8,#c99f6f)}
.mng2 .savatar.g3{background:linear-gradient(140deg,#b8c9e6,#8f9fd0)}
.mng2 .savatar.g4{background:linear-gradient(140deg,#c3e0cd,#8fbfa0)}
.mng2 .srow .si{flex:1;min-width:0}
.mng2 .srow .snm{font-size:14px;font-weight:600;color:var(--heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mng2 .srow .smeta{font-size:11.5px;color:var(--faint);margin-top:2px;font-family:var(--mono)}
.mng2 .srow .smem{font-size:12px;font-weight:700;color:var(--body);background:rgba(255,255,255,.05);border:1px solid var(--hair);
  border-radius:8px;padding:5px 11px;white-space:nowrap;flex:none}
.mng2 .smore{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:11px;font-size:12px;font-weight:600;
  color:var(--accent);cursor:pointer;background:none;border:0;font-family:inherit;width:100%;padding:7px}
.mng2 .smore:hover{opacity:.8}
.mng2 .smore svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;transition:transform .18s}
.mng2 .slotbar{display:flex;align-items:center;gap:14px;margin-top:12px;padding:13px 16px;border-radius:12px;
  background:linear-gradient(120deg,rgba(201,219,230,.06),rgba(201,219,230,.015));border:1px solid var(--hair)}
.mng2 .slotbar.hot{border-color:rgba(201,219,230,.35);background:linear-gradient(120deg,rgba(201,219,230,.12),rgba(201,219,230,.03))}
.mng2 .slotbar .sbx{flex:1;min-width:0}
.mng2 .slotbar .sbt{font-size:12.5px;font-weight:700;color:var(--heading)}
.mng2 .slotbar .sbd{font-size:11.5px;color:var(--faint);margin-top:2px}
.mng2 .slotbar .sbd b{color:var(--body);font-weight:700}
.mng2 .slotbar .sbtn{flex:none;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 16px;border-radius:10px;
  border:0;background:linear-gradient(180deg,#d6e4ee,#c1d4e0);color:#1E242B;font:inherit;font-size:12.5px;font-weight:700;
  cursor:pointer;box-shadow:0 2px 8px -2px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.5)}
.mng2 .slotbar .sbtn:hover{filter:brightness(1.04)}
.mng2 .slotbar .sbtn svg{width:15px;height:15px;stroke:currentColor;stroke-width:2.6;fill:none}
.mng2 .empty{font-size:12.5px;color:var(--faint);text-align:center;padding:22px 12px;
  border:1px dashed var(--hair);border-radius:12px}

/* logs */
.mng2 .logbar{display:flex;align-items:center;gap:10px}
.mng2 .live{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.07em;color:var(--ok)}
.mng2 .live .ld{height:7px;width:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--okd)}
.mng2 .ranges{display:flex;gap:5px;margin-left:auto}
.mng2 .range{border:1px solid var(--hair);background:rgba(255,255,255,.03);color:var(--body);border-radius:8px;padding:5px 12px;
  font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;transition:.14s}
.mng2 .range:hover:not(.on){border-color:var(--line2)}
.mng2 .range.on{background:linear-gradient(180deg,#d6e4ee,#c1d4e0);border-color:transparent;color:#1E242B}
.mng2 .term{margin-top:14px;background:#1b2026;border:1px solid var(--hair);border-radius:13px;overflow:hidden;
  box-shadow:inset 0 2px 8px rgba(0,0,0,.3)}
.mng2 .termhead{display:flex;align-items:center;gap:7px;padding:10px 14px;border-bottom:1px solid var(--line);background:rgba(0,0,0,.2)}
.mng2 .termhead i{height:10px;width:10px;border-radius:50%;display:block}
.mng2 .termhead .r{background:#e57a70}.mng2 .termhead .y{background:#e6c47c}.mng2 .termhead .g{background:#84d6a0}
.mng2 .termhead span{margin-left:8px;font-family:var(--mono);font-size:11px;color:var(--faint)}
.mng2 .term .rows{max-height:300px;overflow-y:auto}
.mng2 .lrow{display:flex;gap:12px;padding:8px 15px;font-family:var(--mono);font-size:12px;align-items:baseline;transition:.1s}
.mng2 .lrow:hover{background:rgba(255,255,255,.025)}
.mng2 .lrow .lt{color:#5f6b76;flex:none;font-size:11px}
.mng2 .lrow .lv{flex:none;font-weight:700;font-size:9.5px;letter-spacing:.05em;padding:2px 7px;border-radius:5px;text-transform:uppercase}
.mng2 .lrow .lv.info{background:rgba(147,187,224,.14);color:var(--info)}
.mng2 .lrow .lv.warn{background:var(--warnd);color:var(--warn)}
.mng2 .lrow .lv.error{background:var(--badd);color:var(--bad)}
.mng2 .lrow .lv.debug{background:rgba(255,255,255,.06);color:var(--faint)}
.mng2 .lrow .lm{color:var(--body);flex:1;min-width:0;line-height:1.45;word-break:break-word}
.mng2 .lrow.empty2{color:var(--faint);justify-content:center;padding:26px 15px;font-size:12px}

/* confirm modal */
.mng2 .cfmask{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;
  background:rgba(10,13,17,.64);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
  animation:cffade .16s ease}
.mng2 .cfbox{width:100%;max-width:432px;background:linear-gradient(180deg,#2b333c,#262d35);border:1px solid var(--hair);
  border-radius:16px;padding:24px 24px 20px;box-shadow:0 34px 90px -30px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.05);
  animation:cfpop .18s cubic-bezier(.22,1,.36,1)}
.mng2 .cft{font-size:17px;font-weight:800;color:var(--heading);letter-spacing:-.01em}
.mng2 .cfb{font-size:13px;color:var(--body);line-height:1.55;margin-top:10px}
.mng2 .cfa{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.mng2 .cfa button{height:40px;padding:0 18px;border-radius:11px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:.15s}
.mng2 .cfcancel{background:transparent;border:1px solid var(--hair);color:var(--body)}
.mng2 .cfcancel:hover:not(:disabled){border-color:var(--line2);color:var(--heading)}
.mng2 .cfok{border:0;background:linear-gradient(180deg,#d6e4ee,#c1d4e0);color:#1E242B;
  box-shadow:0 2px 8px -2px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.5)}
.mng2 .cfok:hover:not(:disabled){filter:brightness(1.05)}
.mng2 .cfok.danger{background:linear-gradient(180deg,#eca6a6,#e08888);color:#2a1414}
.mng2 .cfa button:disabled{opacity:.5;cursor:not-allowed}
@keyframes cffade{from{opacity:0}to{opacity:1}}
@keyframes cfpop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}

@media(max-width:660px){
  .mng2 .engrow{flex-direction:column;align-items:stretch}
  .mng2 .seg{width:100%}.mng2 .seg button{flex:1}
  .mng2 .ustrip{flex-wrap:wrap}.mng2 .ucell{flex:1 1 33%;border-bottom:1px solid var(--line)}
  .mng2 .ctlbar{flex-direction:column;align-items:stretch}
  .mng2 .actions{display:grid;grid-template-columns:1fr 1fr}
  .mng2 .act{justify-content:center}
}
`;
