import * as React from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Strikethrough, Quote, Code, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Global floating Discord-markdown formatting toolbar.
 *
 * Mounted once at the app root. Mirrors the behavior of
 * `DiscordMarkdownTextarea` (Messages builder) but applies to every
 * <textarea> and text-like <input> across the dashboard.
 *
 * Opt out by placing `data-no-global-md` on the field or any ancestor
 * (e.g. fields that already have their own markdown toolbar).
 */

type WrapAction = {
  kind: "wrap";
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  before: string;
  after: string;
};

type LineAction = {
  kind: "line";
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  linePrefix: string;
};

const WRAP_ACTIONS: WrapAction[] = [
  { kind: "wrap", key: "bold", label: "Bold", Icon: Bold, before: "**", after: "**" },
  { kind: "wrap", key: "italic", label: "Italic", Icon: Italic, before: "*", after: "*" },
  { kind: "wrap", key: "strike", label: "Strikethrough", Icon: Strikethrough, before: "~~", after: "~~" },
  { kind: "wrap", key: "code", label: "Code", Icon: Code, before: "`", after: "`" },
  { kind: "wrap", key: "spoiler", label: "Spoiler", Icon: EyeOff, before: "||", after: "||" },
];

const LINE_ACTIONS: LineAction[] = [
  { kind: "line", key: "quote", label: "Quote", Icon: Quote, linePrefix: "> " },
];

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", ""]);

type Field = HTMLInputElement | HTMLTextAreaElement;

const isEditableField = (el: Element | null): el is Field => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return false;
    if (el.closest("[data-no-global-md]")) return false;
    return true;
  }
  if (el instanceof HTMLInputElement) {
    if (el.disabled || el.readOnly) return false;
    if (!TEXT_INPUT_TYPES.has((el.type || "").toLowerCase())) return false;
    if (el.closest("[data-no-global-md]")) return false;
    return true;
  }
  return false;
};

// Use React's native value setter so the resulting "input" event is
// picked up by controlled components.
const setNativeValue = (el: Field, value: string) => {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const outerRun = (src: string, left: number, right: number, ch: string) => {
  let b = 0;
  while (left - b - 1 >= 0 && src.charAt(left - b - 1) === ch) b++;
  let a = 0;
  while (right + a < src.length && src.charAt(right + a) === ch) a++;
  return Math.min(b, a);
};

const innerRun = (src: string, left: number, right: number, ch: string) => {
  let b = 0;
  while (left + b < right && src.charAt(left + b) === ch) b++;
  let a = 0;
  while (right - a - 1 >= left + b && src.charAt(right - a - 1) === ch) a++;
  return Math.min(b, a);
};

type Removal = { leftStart: number; leftEnd: number; rightStart: number; rightEnd: number };

const getBoundaryLayer = (src: string, left: number, right: number) => {
  const keys = new Set<string>();
  const removals = new Map<string, Removal>();

  const starOuter = outerRun(src, left, right, "*");
  if (starOuter > 0) {
    if (starOuter >= 2) {
      keys.add("bold");
      removals.set("bold", { leftStart: left - 2, leftEnd: left, rightStart: right, rightEnd: right + 2 });
    }
    if (starOuter % 2 === 1) {
      keys.add("italic");
      removals.set("italic", { leftStart: left - 1, leftEnd: left, rightStart: right, rightEnd: right + 1 });
    }
    return { keys, removals, leftLen: starOuter, rightLen: starOuter, consumeInner: 0 };
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
      return { keys, removals, leftLen: action.before.length, rightLen: action.after.length, consumeInner: 0 };
    }
  }

  const starInner = innerRun(src, left, right, "*");
  if (starInner > 0) {
    if (starInner >= 2) {
      keys.add("bold");
      removals.set("bold", { leftStart: left, leftEnd: left + 2, rightStart: right - 2, rightEnd: right });
    }
    if (starInner % 2 === 1) {
      keys.add("italic");
      removals.set("italic", { leftStart: left, leftEnd: left + 1, rightStart: right - 1, rightEnd: right });
    }
    return { keys, removals, leftLen: 0, rightLen: 0, consumeInner: starInner };
  }

  for (const action of WRAP_ACTIONS) {
    if (action.key === "bold" || action.key === "italic") continue;
    const bLen = action.before.length;
    const aLen = action.after.length;
    if (
      right - left >= bLen + aLen &&
      src.slice(left, left + bLen) === action.before &&
      src.slice(right - aLen, right) === action.after
    ) {
      keys.add(action.key);
      removals.set(action.key, { leftStart: left, leftEnd: left + bLen, rightStart: right - aLen, rightEnd: right });
      return { keys, removals, leftLen: 0, rightLen: 0, consumeInner: bLen };
    }
  }
  return null;
};

const computeActive = (src: string, start: number, end: number) => {
  const active = new Set<string>();
  let left = start;
  let right = end;
  for (let i = 0; i < WRAP_ACTIONS.length; i++) {
    const layer = getBoundaryLayer(src, left, right);
    if (!layer) break;
    layer.keys.forEach((k) => active.add(k));
    if (layer.consumeInner > 0) {
      left += layer.consumeInner;
      right -= layer.consumeInner;
    } else {
      left -= layer.leftLen;
      right += layer.rightLen;
    }
  }
  const lineStart = src.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = src.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? src.length : lineEndIdx;
  const lines = src.slice(lineStart, lineEnd).split("\n");
  for (const a of LINE_ACTIONS) {
    if (lines.length && lines.every((l) => l.startsWith(a.linePrefix))) active.add(a.key);
  }
  return active;
};

// Measure caret position for a textarea by mirroring its styles into a hidden div.
const measureTextareaSelection = (
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  mirror: HTMLDivElement,
) => {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const props = [
    "boxSizing","width","height","borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth",
    "paddingTop","paddingRight","paddingBottom","paddingLeft","fontStyle","fontVariant","fontWeight","fontStretch",
    "fontSize","fontSizeAdjust","lineHeight","fontFamily","textAlign","textTransform","textIndent","textDecoration",
    "letterSpacing","wordSpacing","tabSize","whiteSpace","wordWrap","wordBreak",
  ];
  props.forEach((p) => { (mirror.style as any)[p] = (style as any)[p]; });
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.textContent = "";
  mirror.appendChild(document.createTextNode(el.value.substring(0, start)));
  const span = document.createElement("span");
  span.textContent = el.value.substring(start, end) || ".";
  mirror.appendChild(span);
  const top = rect.top + span.offsetTop - el.scrollTop;
  const left = rect.left + span.offsetLeft - el.scrollLeft + span.offsetWidth / 2;
  return { top: top - 40, left };
};

const measureInputSelection = (el: HTMLInputElement) => {
  const rect = el.getBoundingClientRect();
  return { top: rect.top - 40, left: rect.left + rect.width / 2 };
};

export const MarkdownFormattingToolbar: React.FC = () => {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const [activeKeys, setActiveKeys] = React.useState<Set<string>>(new Set());
  const fieldRef = React.useRef<Field | null>(null);
  const selRef = React.useRef<{ start: number; end: number } | null>(null);
  const mirrorRef = React.useRef<HTMLDivElement | null>(null);

  const getMirror = () => {
    if (!mirrorRef.current) {
      const m = document.createElement("div");
      document.body.appendChild(m);
      mirrorRef.current = m;
    }
    return mirrorRef.current;
  };

  const hide = React.useCallback(() => {
    setPos(null);
    setActiveKeys(new Set());
    fieldRef.current = null;
    selRef.current = null;
  }, []);

  const update = React.useCallback(() => {
    const el = fieldRef.current ?? (document.activeElement as Element | null);
    if (!isEditableField(el)) {
      hide();
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end) {
      hide();
      return;
    }
    fieldRef.current = el;
    selRef.current = { start, end };
    const p =
      el instanceof HTMLTextAreaElement
        ? measureTextareaSelection(el, start, end, getMirror())
        : measureInputSelection(el);
    setPos(p);
    setActiveKeys(computeActive(el.value, start, end));
  }, [hide]);

  React.useEffect(() => {
    const onSelect = () => update();
    const onMouseUp = () => update();
    const onKeyUp = () => update();
    const onScroll = () => { if (fieldRef.current) update(); };
    const onFocusOut = (e: FocusEvent) => {
      // If focus moves to something other than the toolbar buttons, hide.
      const next = e.relatedTarget as Element | null;
      if (next && next.closest("[data-md-toolbar]")) return;
      // Defer so applyWrap (running on mousedown) can still read state.
      setTimeout(() => {
        if (document.activeElement !== fieldRef.current) hide();
      }, 0);
    };
    document.addEventListener("selectionchange", onSelect);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("selectionchange", onSelect);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (mirrorRef.current) {
        mirrorRef.current.remove();
        mirrorRef.current = null;
      }
    };
  }, [update, hide]);

  const applyWrap = (before: string, after: string) => {
    const el = fieldRef.current;
    const sel = selRef.current;
    if (!el || !sel) return;
    const { start, end } = sel;
    if (start === end) return;
    const src = el.value;
    const selected = src.slice(start, end);

    const clicked = WRAP_ACTIONS.find((a) => a.before === before && a.after === after);
    const layer = getBoundaryLayer(src, start, end);
    const removal = clicked ? layer?.removals.get(clicked.key) : undefined;

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
    setNativeValue(el, next);
    selRef.current = { start: newStart, end: newEnd };
    setActiveKeys(computeActive(next, newStart, newEnd));
    requestAnimationFrame(() => {
      el.focus();
      try { el.setSelectionRange(newStart, newEnd); } catch { /* number/email throw */ }
      update();
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const el = fieldRef.current;
    const sel = selRef.current;
    if (!el || !sel) return;
    if (!(el instanceof HTMLTextAreaElement)) return;
    const { start, end } = sel;
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
    setNativeValue(el, next);
    const delta = newBlock.length - block.length;
    selRef.current = { start: lineStart, end: end + delta };
    setActiveKeys(computeActive(next, lineStart, end + delta));
    requestAnimationFrame(() => {
      el.focus();
      try { el.setSelectionRange(lineStart, end + delta); } catch { /* noop */ }
      update();
    });
  };

  if (!pos) return null;

  const isTextarea = fieldRef.current instanceof HTMLTextAreaElement;
  const items: (WrapAction | LineAction)[] = [
    ...WRAP_ACTIONS,
    ...(isTextarea ? LINE_ACTIONS : []),
  ];

  return createPortal(
    <div
      data-md-toolbar
      className="fixed z-[100] -translate-x-1/2 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.map((a, idx) => {
        const isActive = activeKeys.has(a.key);
        return (
          <React.Fragment key={a.key}>
            {idx === WRAP_ACTIONS.length && (
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
                if (a.kind === "wrap") applyWrap(a.before, a.after);
                else applyLinePrefix(a.linePrefix);
              }}
            >
              <a.Icon className="h-3.5 w-3.5" />
            </button>
          </React.Fragment>
        );
      })}
    </div>,
    document.body,
  );
};
