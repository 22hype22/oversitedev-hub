import { useBotHealth, formatUptime, formatRelative, type BotHealth } from "@/hooks/useBotHealth";
import { Activity, CircleOff, AlertTriangle, RefreshCw, Pause, Loader2 } from "lucide-react";

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }>; pulse?: boolean }
> = {
  online:     { label: "Online",      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Activity, pulse: true },
  checking:   { label: "Checking…",   className: "bg-muted text-muted-foreground border-border",             icon: Loader2 },
  offline:    { label: "Offline",     className: "bg-muted text-muted-foreground border-border",             icon: CircleOff },
  starting:   { label: "Starting",    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",          icon: Loader2 },
  stopping:   { label: "Stopping",    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",       icon: Loader2 },
  restarting: { label: "Restarting…", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",  icon: Loader2 },
  crashed:    { label: "Crashed",     className: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle },
  updating:   { label: "Updating",    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",          icon: RefreshCw },
  suspended:  { label: "Suspended",   className: "bg-orange-500/15 text-orange-400 border-orange-500/30",    icon: Pause },
};

type Props = {
  botId: string;
  /**
   * When the parent already polls this bot's health, pass its reading here so
   * the badge does not start a second poll of its own.
   */
  health?: BotHealth | null;
  loading?: boolean;
  reload?: () => void;
};

export const BotHealthBadge = ({ botId, health: givenHealth, loading: givenLoading, reload: givenReload }: Props) => {
  const shared = givenHealth !== undefined;
  const own = useBotHealth(shared ? null : botId);
  const health = shared ? givenHealth : own.health;
  const loading = shared ? Boolean(givenLoading) : own.loading;
  const reload = shared ? (givenReload ?? (() => {})) : own.reload;

  // Match the "Ready to invite" status pill exactly: same font size/weight
  // and the same inline padding (the dashboard's `.osd *{padding:0}` reset
  // zeroes Tailwind/Badge padding, which left this chip looking cramped).
  const pillClass =
    "inline-flex items-center gap-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap";
  const pillPad = { padding: "3px 11px" } as const;

  if (loading || !health) {
    return (
      <span className={`${pillClass} bg-muted text-muted-foreground border-border`} style={pillPad}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking…
      </span>
    );
  }

  const meta = STATUS_META[health.effective_status] ?? STATUS_META.offline;
  const Icon = meta.icon;

  const uptime =
    health.effective_status === "online" && health.uptime_seconds
      ? formatUptime(health.uptime_seconds)
      : null;
  const lastSeen = health.last_heartbeat_at ? formatRelative(health.last_heartbeat_at) : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`${pillClass} ${meta.className}`} style={pillPad}>
        <Icon className={`h-3 w-3 ${meta.pulse ? "animate-pulse" : health.effective_status === "checking" ? "animate-spin" : ""}`} />
        {meta.label}
        {health.stale && health.effective_status !== "checking" && <span className="opacity-70">(stale)</span>}
      </span>
      {uptime && (
        <span className="text-[10px] text-muted-foreground">
          up <span className="text-foreground font-medium">{uptime}</span>
        </span>
      )}
      {lastSeen && health.effective_status !== "online" && !health.never_started && (
        <span className="text-[10px] text-muted-foreground">
          last seen <span className="text-foreground font-medium">{lastSeen}</span>
        </span>
      )}
      {health.never_started && (
        <span className="text-[10px] text-muted-foreground">never started</span>
      )}
      <button
        type="button"
        onClick={() => reload()}
        title="Refresh status"
        aria-label="Refresh status"
        className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
};
