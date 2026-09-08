import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Braces, Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { countVariables, orderStatusGroup, variablesFor, type VariableGroup } from "@/lib/messageVariables";

/**
 * The Variables panel is a drawer that slides out of the side of the block's
 * dialog. One provider per block dialog holds which design is being edited
 * and whether the drawer is open; buttons anywhere inside open it, and the
 * drawer itself is rendered once next to the dialog.
 */
type Request = { groups: VariableGroup[]; onInsert?: (token: string) => void };
type Scope = {
  addonId: string | null;
  key: string | null;
  setKey: (k: string | null) => void;
  panel: Request | null;
  open: (opts?: { keyOverride?: string | null; groups?: VariableGroup[]; onInsert?: (token: string) => void }) => void;
  close: () => void;
  /** Explicit buttons currently mounted in this scope (a block's own header buttons). */
  buttons: { current: number };
  /** The full list for a design key, including the bot's own service tokens. */
  listFor: (key?: string | null, groups?: VariableGroup[]) => VariableGroup[];
};
const ScopeCtx = createContext<Scope>({
  addonId: null, key: null, setKey: () => {}, panel: null, open: () => {}, close: () => {}, buttons: { current: 0 }, listFor: () => [],
});

// Order Status service tokens are per bot and owner-named, so they are read
// from the bot's config once per bot and cached for the session.
const orderStatusCache = new Map<string, VariableGroup | null>();
const orderStatusInflight = new Map<string, Promise<VariableGroup | null>>();
function loadOrderStatusGroup(botId: string): Promise<VariableGroup | null> {
  if (orderStatusCache.has(botId)) return Promise.resolve(orderStatusCache.get(botId) ?? null);
  const pending = orderStatusInflight.get(botId);
  if (pending) return pending;
  const p = (async () => {
    try {
      const { data } = await supabase
        .from("bot_config")
        .select("config")
        .eq("bot_id", botId)
        .eq("feature", "customs-order-status")
        .maybeSingle();
      const cfg = (data?.config ?? {}) as { services?: Array<{ name?: string }> };
      const names = (Array.isArray(cfg.services) ? cfg.services : []).map((s) => String(s?.name ?? ""));
      const group = orderStatusGroup(names);
      orderStatusCache.set(botId, group);
      return group;
    } catch {
      return null;
    } finally {
      orderStatusInflight.delete(botId);
    }
  })();
  orderStatusInflight.set(botId, p);
  return p;
}
/** Forget a bot's cached service tokens, for after the Order Status block saves. */
export function invalidateOrderStatusVariables(botId: string) {
  orderStatusCache.delete(botId);
}

export function VariablesScopeProvider({ addonId, botId, children }: { addonId: string; botId?: string | null; children: ReactNode }) {
  const [key, setKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<Request | null>(null);
  const [extra, setExtra] = useState<VariableGroup | null>(null);
  const buttons = useRef(0);
  useEffect(() => {
    let alive = true;
    if (!botId) { setExtra(null); return; }
    void loadOrderStatusGroup(botId).then((g) => { if (alive) setExtra(g); });
    return () => { alive = false; };
  }, [botId]);
  const listFor = useCallback((k?: string | null, groups?: VariableGroup[]) => {
    if (groups) return groups;
    const base = variablesFor(addonId, k ?? key);
    // Service tokens apply to every message design on this bot, not to
    // plain fields, so only add them where the server list is present.
    return extra && base.some((g) => g.title === "Server") ? [...base, extra] : base;
  }, [addonId, key, extra]);
  const open = useCallback<Scope["open"]>((opts) => {
    setPanel({ groups: listFor(opts?.keyOverride, opts?.groups), onInsert: opts?.onInsert });
  }, [listFor]);
  const close = useCallback(() => setPanel(null), []);
  const value = useMemo(() => ({ addonId, key, setKey, panel, open, close, buttons, listFor }), [addonId, key, panel, open, close, listFor]);
  return <ScopeCtx.Provider value={value}>{children}</ScopeCtx.Provider>;
}

export function useVariablesScope() {
  return useContext(ScopeCtx);
}

/** True when a pointer event happened inside the drawer (which lives outside the dialog). */
export function isVariablesFlyoutTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("[data-variables-flyout]");
}

/**
 * The Variables button. Opens the drawer with this block's variables, or
 * with `groups` when given (a text field's own list), narrowed by
 * `keyOverride` when a block holds several designs side by side.
 */
export function VariablesButton({ keyOverride, groups, onInsert, size = "sm", className }: {
  keyOverride?: string | null;
  groups?: VariableGroup[];
  onInsert?: (token: string) => void;
  size?: "sm" | "xs";
  className?: string;
}) {
  const scope = useVariablesScope();
  const list = scope.addonId ? scope.listFor(keyOverride, groups) : (groups ?? []);
  const total = countVariables(list);
  // Register so the builder's fallback button knows a block already has one.
  useLayoutEffect(() => {
    if (total === 0 || groups) return;
    scope.buttons.current += 1;
    return () => { scope.buttons.current -= 1; };
  }, [scope.buttons, total, groups]);
  if (total === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`gap-1.5 shrink-0 ${size === "xs" ? "h-7 px-2 text-[11px]" : ""} ${className ?? ""}`}
      onClick={() => (scope.panel ? scope.close() : scope.open({ keyOverride, groups, onInsert }))}
      aria-expanded={!!scope.panel}
    >
      <Braces className="h-3.5 w-3.5" /> Variables
      <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{total}</span>
    </Button>
  );
}

/**
 * Safety net rendered by every message builder: if the block around it did
 * not place a Variables button of its own, this shows one, so no design can
 * ship without a way to see its variables. Renders nothing otherwise.
 */
export function VariablesFallbackButton({ keyOverride }: { keyOverride?: string | null }) {
  const scope = useVariablesScope();
  const [show, setShow] = useState(false);
  useLayoutEffect(() => {
    // Runs after the block's own buttons registered (they sit earlier in the tree).
    setShow(scope.buttons.current === 0);
  });
  if (!scope.addonId || !show) return null;
  return (
    <div className="flex items-center justify-end">
      <VariablesButton keyOverride={keyOverride} groups={scope.listFor(keyOverride)} size="xs" />
    </div>
  );
}

/**
 * The drawer. Render once inside the block's DialogContent and pass a ref to
 * that content: the drawer is portalled to the body and pinned to the
 * dialog's right edge, so it slides out of the block rather than the screen.
 */
export function VariablesFlyout({ anchorRef }: { anchorRef: RefObject<HTMLElement | null> }) {
  const scope = useVariablesScope();
  const [rect, setRect] = useState<{ top: number; left: number; height: number; attached: boolean } | null>(null);
  // `mounted` keeps the drawer in the DOM while it slides back in on close;
  // `shown` is the target position (out or tucked away).
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const lastPanel = useRef<Request | null>(null);
  if (scope.panel) lastPanel.current = scope.panel;
  const openNow = !!scope.panel;
  const WIDTH = 330;
  const GAP = 10;
  const SLIDE_MS = 260;

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fits = r.right + GAP + WIDTH <= window.innerWidth - 8;
    setRect({
      top: r.top,
      height: r.height,
      // Attached to the dialog's edge when there is room; otherwise tucked
      // inside its right edge so it never runs off screen.
      left: fits ? r.right + GAP : Math.max(8, r.right - WIDTH),
      attached: fits,
    });
  }, [anchorRef]);

  // Slide the dialog left by half the drawer's width while the drawer is out,
  // so the block and the drawer together stay centred on the screen. The
  // drawer re-measures every frame while the dialog moves so it stays glued
  // to the dialog's edge.
  const shiftDialog = useCallback((out: boolean) => {
    const el = anchorRef.current as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const base = out ? r.right + (parseFloat(el.style.marginLeft || "0") || 0) * -1 : r.right;
    const fits = base + GAP + WIDTH <= window.innerWidth - 8;
    el.style.transition = `margin-left ${SLIDE_MS}ms cubic-bezier(.22,1,.36,1)`;
    el.style.marginLeft = out && fits ? `${-Math.round((WIDTH + GAP) / 2)}px` : "0px";
  }, [anchorRef]);
  const trackWhileMoving = useCallback(() => {
    const start = performance.now();
    let raf = 0;
    const step = () => {
      measure();
      if (performance.now() - start < SLIDE_MS + 80) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [measure]);

  useLayoutEffect(() => {
    if (!openNow) {
      // Slide back behind the dialog and let the dialog re-centre, then leave the DOM.
      setShown(false);
      shiftDialog(false);
      const stop = trackWhileMoving();
      const t = window.setTimeout(() => setMounted(false), SLIDE_MS);
      return () => { window.clearTimeout(t); stop(); };
    }
    setMounted(true);
    measure();
    shiftDialog(true);
    const stop = trackWhileMoving();
    // The dialog zooms in over about 200ms when it opens; measure again once
    // it has settled so the drawer sits flush against its final edge.
    const settle = window.setTimeout(measure, 320);
    const id = requestAnimationFrame(() => setShown(true));
    const el = anchorRef.current;
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(settle);
      stop();
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [openNow, measure, anchorRef, shiftDialog, trackWhileMoving]);

  // Closing the dialog unmounts this; make sure the drawer does not reappear
  // already open the next time the block is opened.
  useEffect(() => () => {
    scope.close();
    const el = anchorRef.current as HTMLElement | null;
    if (el) el.style.marginLeft = "0px";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !rect || !lastPanel.current || typeof document === "undefined") return null;
  const { groups, onInsert } = lastPanel.current;

  const pick = (token: string) => {
    try { void navigator.clipboard?.writeText(token); } catch { /* ignore */ }
    if (onInsert) { onInsert(token); toast.success(`Added ${token}`); }
    else toast.success(`Copied ${token}`);
    setCopied(token);
    window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 1200);
  };

  const serverGroups = groups.filter((g) => g.kind === "server");
  const blockGroups = groups.filter((g) => g.kind !== "server");
  const row = (v: { token: string; desc: string }) => (
    <button
      key={v.token}
      type="button"
      onClick={() => pick(v.token)}
      className="w-full flex items-start gap-2.5 px-4 py-1.5 text-left hover:bg-muted/60 transition-colors"
    >
      <code className="mt-0.5 text-[11px] font-mono text-os-accent bg-os-accent/10 border border-os-accent/25 rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
        {v.token}
      </code>
      <span className="flex-1 text-[11.5px] text-muted-foreground leading-snug">{v.desc}</span>
      {copied === v.token
        ? <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
        : <Copy className="h-3 w-3 mt-1 shrink-0 text-muted-foreground/40" />}
    </button>
  );
  const section = (title: string, note: string, list: VariableGroup[], empty: string) => (
    <div className="py-2">
      <div className="px-4 pt-2 pb-1">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80 leading-snug">{note}</p>
      </div>
      {list.length === 0 && <p className="px-4 py-2 text-[11.5px] text-muted-foreground/70">{empty}</p>}
      {list.map((g) => (
        <div key={g.title} className="pb-1">
          {list.length > 1 && (
            <p className="px-4 pt-2 pb-0.5 text-[11px] font-semibold text-foreground/80">{g.title}</p>
          )}
          {g.note && list.length > 1 && <p className="px-4 pb-1 text-[11px] text-muted-foreground/70 leading-snug">{g.note}</p>}
          {g.vars.map(row)}
        </div>
      ))}
    </div>
  );

  return createPortal(
    <div
      data-variables-flyout
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.attached ? rect.left - GAP : rect.left,
        height: rect.height,
        width: rect.attached ? WIDTH + GAP : WIDTH,
        zIndex: 60,
        pointerEvents: shown ? "auto" : "none",
        overflow: "hidden",
      }}
    >
    <div
      role="dialog"
      aria-label="Variables"
      style={{
        position: "absolute",
        top: 0,
        left: rect.attached ? GAP : 0,
        height: "100%",
        width: WIDTH,
        transform: shown ? "translateX(0)" : `translateX(${rect.attached ? "-100%" : "100%"})`,
        transition: `transform ${SLIDE_MS}ms cubic-bezier(.22,1,.36,1)`,
      }}
      className={`flex flex-col border bg-background shadow-2xl ${rect.attached ? "rounded-r-lg border-l-0" : "rounded-lg"}`}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-border/60">
        <div>
          <p className="text-sm font-semibold text-foreground">Variables</p>
          <p className="text-[11px] text-muted-foreground">
            {onInsert ? "Tap one to add it where your cursor is." : "Tap one to copy it, then paste it into your message."}
          </p>
        </div>
        <button
          type="button"
          onClick={scope.close}
          aria-label="Close variables"
          className="h-7 w-7 rounded-md grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {section(
          "Server variables",
          "Work in every message on every server. They fill in from the server the message is posted in.",
          serverGroups,
          "None.",
        )}
        <div className="mx-4 my-1 h-px bg-border/70" />
        {section(
          "Block variables",
          "Only this block fills these in.",
          blockGroups,
          "This block has no variables of its own.",
        )}
      </div>
    </div>
    </div>,
    document.body,
  );
}
