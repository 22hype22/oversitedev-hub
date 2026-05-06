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

    const computeActive = React.useCallback(
      (start: number, end: number) => {
        const active = new Set<string>();
        const selected = value.slice(start, end);
        for (const a of WRAP_ACTIONS) {
          const wrappedOutside =
            value.slice(Math.max(0, start - a.before.length), start) === a.before &&
            value.slice(end, end + a.after.length) === a.after;
          const wrappedInside =
            selected.startsWith(a.before) &&
            selected.endsWith(a.after) &&
            selected.length >= a.before.length + a.after.length;
          if (wrappedOutside || wrappedInside) active.add(a.key);
        }
        // Line prefix actions: active if every selected line starts with prefix
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const lineEndIdx = value.indexOf("\n", end);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const lines = value.slice(lineStart, lineEnd).split("\n");
        for (const a of LINE_ACTIONS) {
          if (lines.length && lines.every((l) => l.startsWith(a.linePrefix))) active.add(a.key);
        }
        return active;
      },
      [value],
    );

    const updateToolbar = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const { selectionStart, selectionEnd } = el;
      if (selectionStart === selectionEnd) {
        setToolbar(null);
        return;
      }
      setToolbar({ top: -40, left: el.clientWidth / 2 });
      setActiveKeys(computeActive(selectionStart, selectionEnd));
    }, [computeActive]);

    const applyWrap = (before: string, after: string) => {
      const el = innerRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === end) return;
      const selected = value.slice(start, end);

      // Toggle: if selection is already wrapped, unwrap it.
      const already =
        value.slice(Math.max(0, start - before.length), start) === before &&
        value.slice(end, end + after.length) === after;

      let next: string;
      let newStart: number;
      let newEnd: number;
      if (already) {
        next = value.slice(0, start - before.length) + selected + value.slice(end + after.length);
        newStart = start - before.length;
        newEnd = end - before.length;
      } else {
        next = value.slice(0, start) + before + selected + after + value.slice(end);
        newStart = start + before.length;
        newEnd = end + before.length;
      }
      onValueChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(newStart, newEnd);
      });
    };

    const applyLinePrefix = (prefix: string) => {
      const el = innerRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      // Expand to full lines
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEndIdx = value.indexOf("\n", end);
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const block = value.slice(lineStart, lineEnd);
      const lines = block.split("\n");
      const allPrefixed = lines.every((l) => l.startsWith(prefix));
      const newLines = allPrefixed
        ? lines.map((l) => l.slice(prefix.length))
        : lines.map((l) => prefix + l);
      const newBlock = newLines.join("\n");
      const next = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
      onValueChange(next);
      const delta = newBlock.length - block.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(lineStart, end + delta);
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
            {WRAP_ACTIONS.map(({ key, label, Icon, before, after }) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => applyWrap(before, after)}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
            {LINE_ACTIONS.map(({ key, label, Icon, linePrefix }) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => applyLinePrefix(linePrefix)}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
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
