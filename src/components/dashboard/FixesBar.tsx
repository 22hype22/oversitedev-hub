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
const DISMISS_KEY = "os_dismissed_fixes";

/** Single notice bar above the bot-dashboard header, listing the active
 *  fixes / notes admins post. Clicking the bar expands it downward (same
 *  container) to reveal the full note bodies. Dismissible (remembered per
 *  browser). Renders nothing when there are none. */
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

  // Only treat the body as expandable content when it actually adds something
  // beyond the title (admins often paste the same text into both).
  const sameAsTitle = (b: string | null) =>
    !b || b.trim().toLowerCase() === latest.title.trim().toLowerCase();
  const latestBody = sameAsTitle(latest.body) ? null : latest.body;
  const canExpand = rest.length > 0 || !!latestBody;

  return (
    <div className="mb-8">
      <div
        className="overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{
          background: "linear-gradient(180deg,rgba(46,54,63,.85),rgba(39,46,54,.9))",
          borderColor: HAIR,
        }}
      >
        {/* Header row — single bar. Clicking anywhere on it toggles expand. */}
        <div
          className={`flex items-center gap-3 px-5 ${canExpand ? "cursor-pointer" : ""}`}
          style={{ height: 54 }}
          onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
        >
          <span
            className="inline-flex shrink-0 items-center rounded-md px-2.5 py-[5px] text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ background: m.tint, color: m.color, lineHeight: 1, fontFamily: '"Bricolage Grotesque", sans-serif' }}
          >
            {m.label}
          </span>
          <span className="flex-1 truncate text-sm font-semibold" style={{ color: HEADING }}>
            {latest.title}
          </span>
          {rest.length > 0 && (
            <span className="shrink-0 text-xs" style={{ color: FAINT }}>
              +{rest.length} more
            </span>
          )}
          {canExpand && (
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
              style={{ color: FAINT }}
              aria-hidden
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissAll();
            }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-white/5"
            style={{ color: FAINT }}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Expanded body — grows the SAME container downward. The latest note's
            label + title already show in the header, so we only add its body
            here (skipped when it just repeats the title), then any other notes. */}
        {expanded && (
          <div className="px-5 pb-4" style={{ borderTop: `1px solid ${HAIR}` }}>
            {latestBody && (
              <p className="mt-3 whitespace-pre-wrap text-sm" style={{ color: BODY }}>
                {latestBody}
              </p>
            )}

            {rest.map((f) => {
              const meta = getMeta(f.severity);
              return (
                <div
                  key={f.id}
                  className="mt-3 pt-3"
                  style={{ borderTop: "1px solid rgba(168,180,191,.10)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                      style={{ background: meta.tint, color: meta.color, lineHeight: 1, fontFamily: '"Bricolage Grotesque", sans-serif' }}
                    >
                      {meta.label}
                    </span>
                    <div className="text-sm font-semibold" style={{ color: HEADING }}>
                      {f.title}
                    </div>
                  </div>
                  {f.body && f.body.trim().toLowerCase() !== f.title.trim().toLowerCase() && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm" style={{ color: BODY }}>
                      {f.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
