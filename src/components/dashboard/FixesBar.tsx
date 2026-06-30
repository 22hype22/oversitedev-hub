import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

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
const META: Record<string, { color: string; tint: string }> = {
  info: { color: "#C9DBE6", tint: "rgba(201,219,230,.12)" },
  note: { color: "#C9DBE6", tint: "rgba(201,219,230,.12)" },
  fix: { color: "#86d3a1", tint: "rgba(134,211,161,.12)" },
  resolved: { color: "#86d3a1", tint: "rgba(134,211,161,.12)" },
  warning: { color: "#e6c478", tint: "rgba(230,196,120,.14)" },
};
const getMeta = (s: string) => META[s] ?? META.info;

const HEADING = "#E8EEF3";
const BODY = "#A8B4BF";
const FAINT = "#788591";
const DISMISS_KEY = "os_dismissed_fixes";

/** Flush full-width announcement bar pinned across the very top of the bot
 *  dashboard. Shows the latest active note as a single line —
 *  Title | Description on the left, date on the far right. Dismissible
 *  (remembered per browser). Renders nothing when there are none. */
export function FixesBar() {
  const [fixes, setFixes] = useState<Fix[] | null>(null);
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
        .limit(1);
      if (cancelled) return;
      setFixes(error ? [] : ((data ?? []) as Fix[]));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fixes) return null;
  const note = fixes.find((f) => !dismissed.includes(f.id));
  if (!note) return null;

  const m = getMeta(note.severity);
  const hasBody = !!note.body && note.body.trim().length > 0;
  const date = new Date(note.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const dismiss = () => {
    const ids = Array.from(new Set([...dismissed, note.id]));
    setDismissed(ids);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="flex items-center gap-3"
      style={{
        height: 46,
        paddingLeft: 26,
        paddingRight: 16,
        background: "rgba(33,39,46,.96)",
        borderBottom: "1px solid rgba(168,180,191,.14)",
        boxShadow: `inset 3px 0 0 ${m.color}`,
      }}
    >
      <span
        className="shrink-0 text-sm font-semibold"
        style={{ color: HEADING, lineHeight: 1 }}
      >
        {note.title}
      </span>
      {hasBody && (
        <>
          <span className="shrink-0 text-sm" style={{ color: "rgba(168,180,191,.35)", lineHeight: 1 }}>
            |
          </span>
          <span className="min-w-0 flex-1 truncate text-sm" style={{ color: BODY, lineHeight: 1 }}>
            {note.body}
          </span>
        </>
      )}
      {!hasBody && <span className="flex-1" />}
      <span
        className="shrink-0 text-xs"
        style={{ color: FAINT, lineHeight: 1, fontFamily: '"Space Mono", monospace' }}
      >
        {date}
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-white/5"
        style={{ color: FAINT }}
        aria-label="Dismiss"
      >
        <X className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
