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

    // For a given marker char, return the matched run length r at the
    // selection boundaries (min of consecutive chars before start and after end).
    const runLen = (src: string, start: number, end: number, ch: string) => {
      let b = 0;
      while (start - b - 1 >= 0 && src.charAt(start - b - 1) === ch) b++;
      let a = 0;
      while (end + a < src.length && src.charAt(end + a) === ch) a++;
      return Math.min(b, a);
    };

    const getBoundaryLayer = React.useCallback((src: string, left: number, right: number) => {
      const keys = new Set<string>();
      const removals = new Map<string, { leftStart: number; leftEnd: number; rightStart: number; rightEnd: number }>();
      const starRun = runLen(src, left, right, "*");

      if (starRun > 0) {
        if (starRun >= 2) {
          keys.add("bold");
          removals.set("bold", { leftStart: left - 2, leftEnd: left, rightStart: right, rightEnd: right + 2 });
        }
        if (starRun % 2 === 1) {
          keys.add("italic");
          removals.set("italic", { leftStart: left - 1, leftEnd: left, rightStart: right, rightEnd: right + 1 });
        }
        return { keys, removals, leftLen: starRun, rightLen: starRun };
      }

      for (const action of WRAP_ACTIONS) {
        if (action.key === "bold" || action.key === "italic") continue;
        const leftStart = left - action.before.length;
        const rightEnd = right + action.after.length;
        if (
          leftStart >= 0 &&
          rightEnd <= src.length &&
          src.slice(leftStart, left) === action.before &&
          src.slice(right, rightEnd) === action.after
        ) {
          keys.add(action.key);
          removals.set(action.key, { leftStart, leftEnd: left, rightStart: right, rightEnd });
          return { keys, removals, leftLen: action.before.length, rightLen: action.after.length };
        }
      }

      return null;
    }, []);

    const computeActive = React.useCallback(
      (src: string, start: number, end: number) => {
        const active = new Set<string>();
        let left = start;
        let right = end;
        for (let i = 0; i < WRAP_ACTIONS.length; i++) {
          const layer = getBoundaryLayer(src, left, right);
          if (!layer) break;
          layer.keys.forEach((key) => active.add(key));
          left -= layer.leftLen;
          right += layer.rightLen;
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
      [getBoundaryLayer],
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

      const clickedAction = WRAP_ACTIONS.find((a) => a.before === before && a.after === after);
      const activeLayer = getBoundaryLayer(src, start, end);
      const removal = clickedAction ? activeLayer?.removals.get(clickedAction.key) : undefined;

      let next: string;
      let newStart: number;
      let newEnd: number;
      if (removal) {
        next =
          src.slice(0, removal.leftStart) +
          src.slice(removal.leftEnd, removal.rightStart) +
          src.slice(removal.rightEnd);
        const removedLeft = removal.leftEnd - removal.leftStart;
        newStart = start - removedLeft;
        newEnd = end - removedLeft;
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
                        if (a.kind === "wrap") {
                          applyWrap(a.before, a.after);
                        } else {
                          applyLinePrefix(a.linePrefix);
                        }
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
            // Toolbar uses onMouseDown preventDefault so clicks don't blur.
            // Hide immediately to avoid two toolbars showing across textareas.
            setToolbar(null);
            setActiveKeys(new Set());
            selectionRef.current = null;
          }}
          className={cn(className)}
          {...props}
        />
      </div>
    );
  },
);
DiscordMarkdownTextarea.displayName = "DiscordMarkdownTextarea";
