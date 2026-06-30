import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Wrench,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

type Fix = {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  is_active: boolean;
  created_at: string;
};

// Colors are inline (literal) because this renders inside the .osd dashboard
// theme, not the Tailwind os- token scope.
const META: Record<string, { label: string; Icon: typeof Info; color: string; tint: string }> = {
  info: { label: "Info", Icon: Info, color: "#C9DBE6", tint: "rgba(201,219,230,.10)" },
  note: { label: "Note", Icon: Info, color: "#C9DBE6", tint: "rgba(201,219,230,.10)" },
  fix: { label: "Fix", Icon: Wrench, color: "#86d3a1", tint: "rgba(134,211,161,.10)" },
  resolved: { label: "Resolved", Icon: CheckCircle2, color: "#86d3a1", tint: "rgba(134,211,161,.10)" },
  warning: { label: "Heads up", Icon: AlertCircle, color: "#e6c478", tint: "rgba(230,196,120,.12)" },
};
const getMeta = (s: string) => META[s] ?? META.info;

const HAIR = "rgba(168,180,191,.18)";
const HEADING = "#E8EEF3";
const BODY = "#A8B4BF";
const FAINT = "#788591";
const SURFACE = "rgba(45,53,62,.78)";
const DISMISS_KEY = "os_dismissed_fixes";

/** Full-width sticky bar pinned to the top of the bot dashboard, listing the
 *  active fixes / notes admins post. Dismissible (remembered per browser) and
 *  expandable when there's more than one. Renders nothing when there are none. */
export function FixesBar() {
  const [fixes, setFixes] = useState<Fix[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
    } catch {
      return [];
    }
  });

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
      setFixes(error ? [] : ((data ?? []) as Fix[]));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fixes) return null;
  const visible = fixes.filter((f) => !dismissed.includes(f.id));
  if (visible.length === 0) return null;

  const latest = visible[0];
  const rest = visible.slice(1);
  const m = getMeta(latest.severity);

  const dismissAll = () => {
    const ids = Array.from(new Set([...dismissed, ...visible.map((f) => f.id)]));
    setDismissed(ids);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="sticky top-3 z-30 mb-5">
      <div
        className="flex items-center gap-3 rounded-2xl border py-2.5 pl-3 pr-2 backdrop-blur-md"
        style={{
          background: "linear-gradient(180deg,rgba(46,54,63,.85),rgba(39,46,54,.9))",
          borderColor: HAIR,
        }}
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
          style={{ background: m.tint, color: m.color }}
        >
          <m.Icon className="h-4 w-4" />
        </span>
        <span
          className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: m.color }}
        >
          {m.label}
        </span>
        <span className="flex-1 truncate text-sm font-semibold" style={{ color: HEADING }}>
          {latest.title}
        </span>
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-md px-2 py-1 text-xs transition-colors hover:bg-white/5"
            style={{ color: FAINT }}
          >
            +{rest.length} more
          </button>
        )}
        {(rest.length > 0 || latest.body) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-white/5"
            style={{ color: FAINT }}
            aria-label="Toggle details"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={dismissAll}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-white/5"
          style={{ color: FAINT }}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div
          className="mt-2 space-y-3 rounded-2xl border p-4 backdrop-blur-md"
          style={{ background: SURFACE, borderColor: HAIR }}
        >
          {visible.map((f) => {
            const meta = getMeta(f.severity);
            return (
              <div key={f.id} className="flex items-start gap-3">
                <meta.Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium" style={{ color: HEADING }}>
                    {f.title}
                  </div>
                  {f.body && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm" style={{ color: BODY }}>
                      {f.body}
                    </p>
                  )}
                  <div className="mt-1 text-xs" style={{ color: FAINT }}>
                    {new Date(f.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
