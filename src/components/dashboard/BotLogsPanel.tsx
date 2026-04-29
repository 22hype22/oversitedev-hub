import { useBotLogs, type BotLogLevel } from "@/hooks/useBotLogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, RefreshCw, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const LEVEL_META: Record<BotLogLevel, { label: string; className: string; Icon: typeof Info }> = {
  debug: {
    label: "DEBUG",
    className: "bg-muted text-muted-foreground border-border",
    Icon: Bug,
  },
  info: {
    label: "INFO",
    className: "bg-primary/10 text-primary border-primary/30",
    Icon: Info,
  },
  warn: {
    label: "WARN",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    Icon: AlertTriangle,
  },
  error: {
    label: "ERROR",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: AlertCircle,
  },
};

interface BotLogsPanelProps {
  botId: string;
}

export function BotLogsPanel({ botId }: BotLogsPanelProps) {
  const { logs, loading, error, refresh } = useBotLogs(botId, 50);

  return (
    <Card className="bg-card/40 border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Recent logs</h4>
          <Badge variant="secondary" className="text-xs font-normal">
            Last 50 · 7-day retention
          </Badge>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            LIVE
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-xs text-destructive mb-3">Failed to load logs: {error}</div>
      )}

      {logs.length === 0 && !loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No logs yet. Logs from your bot will appear here.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background/40 max-h-96 overflow-y-auto">
          <ul className="divide-y divide-border">
            {logs.map((log) => {
              const meta = LEVEL_META[log.level];
              const Icon = meta.Icon;
              return (
                <li key={log.id} className="px-3 py-2.5 text-xs font-mono">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${meta.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-foreground break-all whitespace-pre-wrap flex-1">
                      {log.message}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
