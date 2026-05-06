import * as React from "react";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { Bold, Italic, Strikethrough, Quote, Code, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Textarea with a floating Discord-style markdown toolbar that appears when
 * the user selects text. Clicking a button wraps (or for blockquote, prefixes)
 * the current selection with the matching Discord markdown syntax.
 *
 * Supported: **bold**, *italic*, ~~strike~~, > quote, `code`, ||spoiler||
 */

type WrapAction = {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  before: string;
  after: string;
};

type LineAction = {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  linePrefix: string;
};

const WRAP_ACTIONS: WrapAction[] = [
  { key: "bold", label: "Bold", Icon: Bold, before: "**", after: "**" },
  { key: "italic", label: "Italic", Icon: Italic, before: "*", after: "*" },
  { key: "strike", label: "Strikethrough", Icon: Strikethrough, before: "~~", after: "~~" },
  { key: "code", label: "Code", Icon: Code, before: "`", after: "`" },
  { key: "spoiler", label: "Spoiler", Icon: EyeOff, before: "||", after: "||" },
];

const LINE_ACTIONS: LineAction[] = [
  { key: "quote", label: "Quote", Icon: Quote, linePrefix: "> " },
];

interface Props extends TextareaProps {
  value: string;
  onValueChange: (next: string) => void;
}

export const DiscordMarkdownTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  ({ value, onValueChange, className, onChange, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const setRef = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    };

    const [toolbar, setToolbar] = React.useState<{ top: number; left: number } | null>(null);
    const [activeKeys, setActiveKeys] = React.useState<Set<string>>(new Set());
    const selectionRef = React.useRef<{ start: number; end: number } | null>(null);

    const computeActive = React.useCallback(
      (src: string, start: number, end: number) => {
        const active = new Set<string>();
        const selected = src.slice(start, end);
        for (const a of WRAP_ACTIONS) {
          const beforeOutside = src.slice(Math.max(0, start - a.before.length), start);
          const afterOutside = src.slice(end, end + a.after.length);
          const wrappedOutside = beforeOutside === a.before && afterOutside === a.after;
          const wrappedInside =
            selected.startsWith(a.before) &&
            selected.endsWith(a.after) &&
            selected.length >= a.before.length + a.after.length;

          // Disambiguate single-char markers (italic `*`) from doubled
          // markers (bold `**`) and similar (`~` vs `~~`).
          if (a.before.length === 1) {
            const ch = a.before;
            const prevChar = src.charAt(start - 2);
            const nextChar = src.charAt(end + 1);
            const innerStartChar = selected.charAt(1);
            const innerEndChar = selected.charAt(selected.length - 2);
            if (wrappedOutside && (prevChar === ch || afterOutside === a.after && nextChar === ch)) {
              continue;
            }
            if (wrappedInside && (innerStartChar === ch || innerEndChar === ch)) {
              continue;
            }
          }

          if (wrappedOutside || wrappedInside) active.add(a.key);
        }
        // Line prefix actions: active if every selected line starts with prefix
        const lineStart = src.lastIndexOf("\n", start - 1) + 1;
        const lineEndIdx = src.indexOf("\n", end);
        const lineEnd = lineEndIdx === -1 ? src.length : lineEndIdx;
        const lines = src.slice(lineStart, lineEnd).split("\n");
        for (const a of LINE_ACTIONS) {
          if (lines.length && lines.every((l) => l.startsWith(a.linePrefix))) active.add(a.key);
        }
        return active;
      },
      [],
    );

    const updateToolbar = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const { selectionStart, selectionEnd } = el;
      if (selectionStart === selectionEnd) {
        selectionRef.current = null;
        setToolbar(null);
        setActiveKeys(new Set());
        return;
      }
      selectionRef.current = { start: selectionStart, end: selectionEnd };
      setToolbar({ top: -40, left: el.clientWidth / 2 });
      setActiveKeys(computeActive(el.value, selectionStart, selectionEnd));
    }, [computeActive]);

    // Recompute active state whenever the value changes while a selection
    // is open (e.g. after clicking a toolbar button).
    React.useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      if (el.selectionStart !== el.selectionEnd) {
        setActiveKeys(computeActive(el.value, el.selectionStart, el.selectionEnd));
      }
    }, [value, computeActive]);

    const applyWrap = (before: string, after: string) => {
      const el = innerRef.current;
      if (!el) return;
      const savedSelection = selectionRef.current;
      const start = el.selectionStart !== el.selectionEnd ? el.selectionStart : savedSelection?.start ?? el.selectionStart;
      const end = el.selectionStart !== el.selectionEnd ? el.selectionEnd : savedSelection?.end ?? el.selectionEnd;
      if (start === end) return;
      const src = el.value;
      const selected = src.slice(start, end);

      // Toggle: if selection is already wrapped, unwrap it.
      const already =
        value.slice(Math.max(0, start - before.length), start) === before &&
        src.slice(Math.max(0, start - before.length), start) === before &&
        src.slice(end, end + after.length) === after;

      let next: string;
      let newStart: number;
      let newEnd: number;
      if (already) {
        next = src.slice(0, start - before.length) + selected + src.slice(end + after.length);
        newStart = start - before.length;
        newEnd = end - before.length;
      } else {
        next = src.slice(0, start) + before + selected + after + src.slice(end);
        newStart = start + before.length;
        newEnd = end + before.length;
      }
      selectionRef.current = { start: newStart, end: newEnd };
      setActiveKeys(computeActive(next, newStart, newEnd));
      onValueChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(newStart, newEnd);
        setActiveKeys(computeActive(next, newStart, newEnd));
      });
    };

    const applyLinePrefix = (prefix: string) => {
      const el = innerRef.current;
      if (!el) return;
      const savedSelection = selectionRef.current;
      const start = el.selectionStart !== el.selectionEnd ? el.selectionStart : savedSelection?.start ?? el.selectionStart;
      const end = el.selectionStart !== el.selectionEnd ? el.selectionEnd : savedSelection?.end ?? el.selectionEnd;
      // Expand to full lines
      const src = el.value;
      const lineStart = src.lastIndexOf("\n", start - 1) + 1;
      const lineEndIdx = src.indexOf("\n", end);
      const lineEnd = lineEndIdx === -1 ? src.length : lineEndIdx;
      const block = src.slice(lineStart, lineEnd);
      const lines = block.split("\n");
      const allPrefixed = lines.every((l) => l.startsWith(prefix));
      const newLines = allPrefixed
        ? lines.map((l) => l.slice(prefix.length))
        : lines.map((l) => prefix + l);
      const newBlock = newLines.join("\n");
      const next = src.slice(0, lineStart) + newBlock + src.slice(lineEnd);
      onValueChange(next);
      const delta = newBlock.length - block.length;
      selectionRef.current = { start: lineStart, end: end + delta };
      setActiveKeys(computeActive(next, lineStart, end + delta));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(lineStart, end + delta);
        setActiveKeys(computeActive(next, lineStart, end + delta));
      });
    };

    return (
      <div className="relative">
        {toolbar && (
          <div
            className="absolute z-20 -translate-x-1/2 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md"
            style={{ top: toolbar.top, left: toolbar.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {(() => {
              const items = [
                ...WRAP_ACTIONS.map((a) => ({ kind: "wrap" as const, ...a })),
                ...LINE_ACTIONS.map((a) => ({ kind: "line" as const, ...a })),
              ];
              return items.map((a, idx) => {
                const isActive = activeKeys.has(a.key);
                return (
                  <React.Fragment key={a.key}>
                    {idx === 3 && (
                      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                    )}
                    <button
                      type="button"
                      title={a.label}
                      aria-label={a.label}
                      aria-pressed={isActive}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        a.kind === "wrap"
                          ? applyWrap(a.before, a.after)
                          : applyLinePrefix(a.linePrefix);
                      }}
                    >
                      <a.Icon className="h-3.5 w-3.5" />
                    </button>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}
        <Textarea
          ref={setRef}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            onChange?.(e);
          }}
          onSelect={updateToolbar}
          onKeyUp={updateToolbar}
          onMouseUp={updateToolbar}
          onBlur={() => {
            // Defer so toolbar clicks register first
            setTimeout(() => {
              const el = innerRef.current;
              if (!el || el.selectionStart === el.selectionEnd) setToolbar(null);
            }, 150);
          }}
          className={cn(className)}
          {...props}
        />
      </div>
    );
  },
);
DiscordMarkdownTextarea.displayName = "DiscordMarkdownTextarea";
