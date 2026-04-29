import { Badge } from "@/components/ui/badge";
import { useBotHealth, formatUptime, formatRelative } from "@/hooks/useBotHealth";
import { Activity, CircleOff, AlertTriangle, RefreshCw, Pause, Loader2 } from "lucide-react";

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }>; pulse?: boolean }
> = {
  online:    { label: "Online",     className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Activity, pulse: true },
  offline:   { label: "Offline",    className: "bg-muted text-muted-foreground border-border",             icon: CircleOff },
  starting:  { label: "Starting",   className: "bg-blue-500/15 text-blue-400 border-blue-500/30",          icon: Loader2 },
  stopping:  { label: "Stopping",   className: "bg-amber-500/15 text-amber-400 border-amber-500/30",       icon: Loader2 },
  crashed:   { label: "Crashed",    className: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle },
  updating:  { label: "Updating",   className: "bg-blue-500/15 text-blue-400 border-blue-500/30",          icon: RefreshCw },
  suspended: { label: "Suspended",  className: "bg-orange-500/15 text-orange-400 border-orange-500/30",    icon: Pause },
};

export const BotHealthBadge = ({ botId }: { botId: string }) => {
  const { health, loading } = useBotHealth(botId);

  if (loading || !health) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1.5 bg-muted text-muted-foreground border-border">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking…
      </Badge>
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
      <Badge variant="outline" className={`text-[10px] gap-1.5 ${meta.className}`}>
        <Icon className={`h-3 w-3 ${meta.pulse ? "animate-pulse" : ""}`} />
        {meta.label}
        {health.stale && <span className="opacity-70">(stale)</span>}
      </Badge>
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
    </div>
  );
};
