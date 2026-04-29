import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, Terminal, MessageSquare, Server, Users, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useBotUsageMetrics, type BotUsageDay } from "@/hooks/useBotUsageMetrics";

interface BotUsageMetricsPanelProps {
  botId: string;
}

function formatDay(d: string) {
  // d is YYYY-MM-DD; format as e.g. "Mon 28"
  const date = new Date(`${d}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

function totals(data: BotUsageDay[]) {
  return data.reduce(
    (acc, r) => {
      acc.commands += r.commands_count;
      acc.messages += r.messages_count;
      acc.errors += r.errors_count;
      acc.servers = Math.max(acc.servers, r.avg_active_servers);
      acc.members = Math.max(acc.members, r.max_member_count);
      return acc;
    },
    { commands: 0, messages: 0, errors: 0, servers: 0, members: 0 },
  );
}

function Stat({
  Icon,
  label,
  value,
  tone = "default",
}: {
  Icon: typeof Terminal;
  label: string;
  value: string | number;
  tone?: "default" | "destructive";
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={`h-3.5 w-3.5 ${tone === "destructive" ? "text-destructive" : "text-primary"}`} />
        <span>{label}</span>
      </div>
      <div className={`text-lg font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

export function BotUsageMetricsPanel({ botId }: BotUsageMetricsPanelProps) {
  const { data, loading, error, refresh } = useBotUsageMetrics(botId, 7);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        day: formatDay(d.day),
        Commands: d.commands_count,
        Messages: d.messages_count,
        Errors: d.errors_count,
      })),
    [data],
  );

  const t = useMemo(() => totals(data), [data]);
  const hasAny = t.commands + t.messages + t.errors > 0 || t.servers > 0 || t.members > 0;

  return (
    <Card className="bg-card/40 border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Usage metrics</h4>
          <Badge variant="secondary" className="text-xs font-normal">
            Last 7 days
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive mb-3">Failed to load metrics: {error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <Stat Icon={Terminal} label="Commands" value={t.commands} />
        <Stat Icon={MessageSquare} label="Messages" value={t.messages} />
        <Stat Icon={Server} label="Peak servers" value={Math.round(t.servers)} />
        <Stat Icon={Users} label="Peak members" value={t.members} />
        <Stat Icon={AlertCircle} label="Errors" value={t.errors} tone="destructive" />
      </div>

      {!hasAny && !loading ? (
        <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">
          No usage recorded yet. Metrics will appear once your bot is active.
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Commands" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Messages" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Errors" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
