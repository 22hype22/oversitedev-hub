import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type Fix = {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  is_active: boolean;
  created_at: string;
};

const SEVERITY_META: Record<
  string,
  { label: string; icon: typeof Info; className: string }
> = {
  info: {
    label: "Info",
    icon: Info,
    className: "bg-primary/10 text-primary border-primary/30",
  },
  fix: {
    label: "Fix",
    icon: Wrench,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  warning: {
    label: "Heads up",
    icon: AlertCircle,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
};

const getMeta = (s: string) => SEVERITY_META[s] ?? SEVERITY_META.info;

/** Compact bar at the top of the bot dashboard listing recent fixes / notes
 *  posted by admins. Only shows when there's at least one active fix. */
export function FixesBar() {
  const [fixes, setFixes] = useState<Fix[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("dashboard_fixes")
        .select("id, title, body, severity, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (cancelled) return;
      if (error) {
        setFixes([]);
        return;
      }
      setFixes((data ?? []) as Fix[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fixes || fixes.length === 0) return null;

  const latest = fixes[0];
  const rest = fixes.slice(1);
  const LatestIcon = getMeta(latest.severity).icon;

  return (
    <Card className="p-3 mb-6 bg-card/40 border-border">
      <button
        type="button"
        className="w-full flex items-center gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <Badge
          variant="outline"
          className={`text-xs gap-1 ${getMeta(latest.severity).className}`}
        >
          <LatestIcon className="h-3 w-3" />
          {getMeta(latest.severity).label}
        </Badge>
        <span className="text-sm font-medium truncate flex-1">
          {latest.title}
        </span>
        {rest.length > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            +{rest.length} more
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {fixes.map((f) => {
            const meta = getMeta(f.severity);
            const Icon = meta.icon;
            return (
              <div key={f.id} className="flex items-start gap-3">
                <Badge
                  variant="outline"
                  className={`text-xs gap-1 mt-0.5 shrink-0 ${meta.className}`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{f.title}</div>
                  {f.body && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
                      {f.body}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(f.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
