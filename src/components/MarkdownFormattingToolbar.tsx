import * as React from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Underline, Strikethrough, Code } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Global floating Discord-markdown formatting toolbar.
 *
 * Mounted once at the app root. Listens for text selections inside any
 * <textarea> or text-like <input> on the page, then shows a floating
 * toolbar that wraps the selection in Discord markdown.
 *
 * Opt out by placing `data-no-global-md` on the field or any ancestor
 * (e.g. fields that already have their own markdown toolbar).
 */

type Action = {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  before: string;
  after: string;
};

const ACTIONS: Action[] = [
  { key: "bold", label: "Bold", Icon: Bold, before: "**", after: "**" },
  { key: "italic", label: "Italic", Icon: Italic, before: "*", after: "*" },
  { key: "underline", label: "Underline", Icon: Underline, before: "__", after: "__" },
  { key: "strike", label: "Strikethrough", Icon: Strikethrough, before: "~~", after: "~~" },
  { key: "code", label: "Code", Icon: Code, before: "`", after: "`" },
];

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", ""]);

const isEditableField = (
  el: Element | null,
): el is HTMLInputElement | HTMLTextAreaElement => {
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

// Use React's native value setter so the resulting "input" event is picked
// up by controlled components.
const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

export const MarkdownFormattingToolbar: React.FC = () => {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const fieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const selRef = React.useRef<{ start: number; end: number } | null>(null);
  const mirrorRef = React.useRef<HTMLDivElement | null>(null);

  const hide = React.useCallback(() => {
    setPos(null);
    fieldRef.current = null;
    selRef.current = null;
  }, []);

  const measureFromTextarea = (el: HTMLTextAreaElement, start: number, end: number) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    let mirror = mirrorRef.current;
    if (!mirror) {
      mirror = document.createElement("div");
      mirror.style.position = "absolute";
      mirror.style.visibility = "hidden";
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.wordWrap = "break-word";
      mirror.style.top = "0";
      mirror.style.left = "-9999px";
      document.body.appendChild(mirror);
      mirrorRef.current = mirror;
    }
    const props = [
      "boxSizing","width","height","borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth",
      "paddingTop","paddingRight","paddingBottom","paddingLeft","fontStyle","fontVariant","fontWeight","fontStretch",
      "fontSize","fontSizeAdjust","lineHeight","fontFamily","textAlign","textTransform","textIndent","textDecoration",
      "letterSpacing","wordSpacing","tabSize","whiteSpace","wordWrap","wordBreak",
    ];
    props.forEach((p) => { (mirror!.style as any)[p] = (style as any)[p]; });
    mirror.textContent = "";
    mirror.appendChild(document.createTextNode(el.value.substring(0, start)));
    const span = document.createElement("span");
    span.textContent = el.value.substring(start, end) || ".";
    mirror.appendChild(span);
    const top = rect.top + span.offsetTop - el.scrollTop;
    const left = rect.left + span.offsetLeft - el.scrollLeft + span.offsetWidth / 2;
    return { top: top - 40, left };
  };

  const measureFromInput = (el: HTMLInputElement) => {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top - 40,
      left: rect.left + rect.width / 2,
    };
  };

  const updateFromSelection = React.useCallback(() => {
    const active = document.activeElement;
    if (!isEditableField(active)) {
      hide();
      return;
    }
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (start === end) {
      hide();
      return;
    }
    fieldRef.current = active;
    selRef.current = { start, end };
    const p = active instanceof HTMLTextAreaElement
      ? measureFromTextarea(active, start, end)
      : measureFromInput(active);
    setPos(p);
  }, [hide]);

  React.useEffect(() => {
    const onSel = () => updateFromSelection();
    const onScroll = () => {
      if (fieldRef.current) updateFromSelection();
    };
    document.addEventListener("selectionchange", onSel);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (mirrorRef.current) {
        mirrorRef.current.remove();
        mirrorRef.current = null;
      }
    };
  }, [updateFromSelection]);

  const apply = (before: string, after: string) => {
    const el = fieldRef.current;
    const sel = selRef.current;
    if (!el || !sel) return;
    const { start, end } = sel;
    const src = el.value;
    if (start === end || end > src.length) return;

    // Toggle off if the selection is already wrapped (inner or outer).
    const outerLeft = src.slice(Math.max(0, start - before.length), start) === before;
    const outerRight = src.slice(end, end + after.length) === after;
    let next: string;
    let newStart: number;
    let newEnd: number;
    if (outerLeft && outerRight) {
      next = src.slice(0, start - before.length) + src.slice(start, end) + src.slice(end + after.length);
      newStart = start - before.length;
      newEnd = end - before.length;
    } else if (
      end - start >= before.length + after.length &&
      src.slice(start, start + before.length) === before &&
      src.slice(end - after.length, end) === after
    ) {
      next = src.slice(0, start) + src.slice(start + before.length, end - after.length) + src.slice(end);
      newStart = start;
      newEnd = end - before.length - after.length;
    } else {
      next = src.slice(0, start) + before + src.slice(start, end) + after + src.slice(end);
      newStart = start + before.length;
      newEnd = end + before.length;
    }

    setNativeValue(el, next);
    selRef.current = { start: newStart, end: newEnd };
    requestAnimationFrame(() => {
      el.focus();
      try { el.setSelectionRange(newStart, newEnd); } catch { /* number/email inputs may throw */ }
      updateFromSelection();
    });
  };

  if (!pos) return null;

  return createPortal(
    <div
      className="fixed z-[100] -translate-x-1/2 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          type="button"
          title={a.label}
          aria-label={a.label}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            apply(a.before, a.after);
          }}
        >
          <a.Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>,
    document.body,
  );
};
