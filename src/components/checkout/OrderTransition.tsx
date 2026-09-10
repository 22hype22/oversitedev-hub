import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

/**
 * Order transitions and the order tracker.
 *
 * OrderTransition is a full-screen fill that grows from the centre. In the
 * "go" tone it is green: it fills the screen and hands off (the host
 * navigates to the thank-you page, which opens on the same green and fades
 * it away, so the two pages read as one move). In the "fail" tone it is red:
 * it fills, then settles into "Transaction incomplete" with the reason and
 * a way back.
 *
 * OrderTracker is the Placed / Building / Live line. The segment after the
 * current step carries a pulse that keeps travelling, so the order reads as
 * in motion rather than parked.
 *
 * Colors mirror the marketing theme tokens in index.css, set here as
 * component variables because the checkout system pages carry the palette
 * as hex, not channel triplets, and these play on both.
 */

const HANDOFF_KEY = "oversite:order-transition";

/** Call right before navigating away on green, so the next page opens green. */
export function markOrderHandoff() {
  try {
    sessionStorage.setItem(HANDOFF_KEY, String(Date.now()));
  } catch {
    /* private mode: the next page simply opens without the green */
  }
}

/** True once, if the previous page handed off on green within the last 15s. */
export function consumeOrderHandoff(): boolean {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    return !!raw && Date.now() - Number(raw) < 15000;
  } catch {
    return false;
  }
}

const CSS = `
.otr{--go:#34D399;--go-rgb:52 211 153;--bad:#E08A8A;--bad-rgb:224 138 138;--heading:#E8EEF3;--body:#A8B4BF;--faint:#788591;--hair:rgba(86,98,110,.55);--bg:#21272e;--ink:#1E242B;--ease:cubic-bezier(.23,1,.32,1);--display:'Bricolage Grotesque',system-ui,sans-serif;--sans:'Space Grotesk',system-ui,sans-serif;position:fixed;inset:0;z-index:130;font-family:var(--sans);color:var(--body);display:grid;place-items:center;padding:24px;overflow:hidden}
.otr-wash{position:absolute;inset:0;clip-path:circle(var(--sr,0px) at var(--ox,50%) var(--oy,60%));opacity:0}
.otr.go .otr-wash{background:linear-gradient(180deg,#34D399,#2DBD87)}
.otr.fail .otr-wash{background:linear-gradient(180deg,#E08A8A,#CF7878)}
.otr.wash .otr-wash,.otr.settle .otr-wash{opacity:1;clip-path:circle(var(--or,120%) at var(--ox,50%) var(--oy,60%));transition:clip-path 640ms cubic-bezier(.32,.72,0,1),opacity 0s}
.otr-ground{position:absolute;inset:0;background:radial-gradient(70% 55% at 50% 0%,rgb(var(--bad-rgb)/.14),transparent 60%),var(--bg);opacity:0}
.otr.settle .otr-ground{opacity:1;transition:opacity 420ms var(--ease)}
.otr-ui{position:relative;width:min(100%,460px);opacity:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;text-align:center}
.otr.settle .otr-ui{opacity:1;pointer-events:auto}
.otr.settle .otr-ui>*{animation:otr-rise 300ms var(--ease) both}
.otr.settle .otr-ui>*:nth-child(2){animation-delay:70ms}.otr.settle .otr-ui>*:nth-child(3){animation-delay:140ms}.otr.settle .otr-ui>*:nth-child(4){animation-delay:220ms}
@keyframes otr-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.otr-mark{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:rgb(var(--bad-rgb)/.16);box-shadow:inset 0 0 0 1.5px rgb(var(--bad-rgb)/.6);color:var(--bad)}
.otr-mark svg{width:26px;height:26px}
.otr-h{font-family:var(--display);font-size:clamp(26px,4.5vw,34px);line-height:1.06;letter-spacing:-.03em;color:var(--heading);margin:18px 0 0;text-wrap:balance;font-weight:800}
.otr-reason{margin:12px 0 0;font-size:15px;line-height:1.55;color:var(--body);max-width:44ch}
.otr-hint{margin:8px 0 0;font-size:13px;color:var(--faint);max-width:44ch}
.otr-btn{all:unset;box-sizing:border-box;margin-top:26px;display:inline-flex;align-items:center;gap:10px;height:46px;padding:0 20px 0 24px;border-radius:14px;font-family:var(--display);font-weight:600;font-size:15px;color:var(--heading);background:rgba(232,238,243,.07);box-shadow:inset 0 0 0 1px var(--hair),inset 0 1px 0 rgba(255,255,255,.12);cursor:pointer;transition:transform 160ms var(--ease),background 160ms var(--ease)}
@media (hover:hover){.otr-btn:hover{background:rgba(232,238,243,.11)}}
.otr-btn:active{transform:scale(.98)}
.otr-btn:focus-visible{outline:2px solid rgb(var(--bad-rgb)/.7);outline-offset:3px}
.otr-btn i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(232,238,243,.08)}
.otr-btn i svg{width:13px;height:13px}
@media (prefers-reduced-motion:reduce){.otr.wash .otr-wash,.otr.settle .otr-wash,.otr.settle .otr-ground{transition:none}.otr.settle .otr-ui>*{animation:none}}

.otk{--go:#34D399;--go-rgb:52 211 153;--heading:#E8EEF3;--faint:#788591;--hair:rgba(86,98,110,.55);--ease:cubic-bezier(.23,1,.32,1);font-family:'Space Grotesk',system-ui,sans-serif}
.otk-track{display:grid;grid-template-columns:auto 1fr auto 1fr auto;align-items:center}
.otk-node{width:12px;height:12px;border-radius:50%;background:var(--hair);position:relative;transition:background 300ms var(--ease),box-shadow 300ms var(--ease)}
.otk-node.lit{background:var(--go);box-shadow:0 0 0 4px rgb(var(--go-rgb)/.18)}
.otk-node.next::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1.5px solid rgb(var(--go-rgb)/.55);animation:otk-ping 1.6s var(--ease) infinite}
@keyframes otk-ping{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.otk-line{height:2px;background:var(--hair);position:relative;margin:0 8px;container-type:inline-size}
.otk-line .fill{position:absolute;inset:0;background:linear-gradient(90deg,var(--go),rgb(var(--go-rgb)/.35));transform:scaleX(0);transform-origin:left;transition:transform 700ms var(--ease) 200ms}
.otk-line.done .fill{background:var(--go);transform:scaleX(1)}
.otk-line.live .fill{transform:scaleX(1)}
.otk-line .pulse{position:absolute;top:50%;left:0;width:56px;height:8px;margin-top:-4px;border-radius:8px;background:linear-gradient(90deg,rgb(var(--go-rgb)/0),rgb(var(--go-rgb)/.9) 70%,#fff);filter:drop-shadow(0 0 6px rgb(var(--go-rgb)/.7));opacity:0;pointer-events:none}
.otk-line.live .pulse{animation:otk-travel 1.7s cubic-bezier(.45,.05,.55,.95) 600ms infinite}
.otk-line.done .pulse{background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.55) 70%,#fff);filter:none;animation:otk-travel 3.6s linear infinite}
.otk-line.idle .pulse{background:linear-gradient(90deg,rgb(var(--go-rgb)/0),rgb(var(--go-rgb)/.35));filter:none;animation:otk-travel 5s linear infinite}
@keyframes otk-travel{0%{transform:translateX(-56px);opacity:0}12%{opacity:1}88%{opacity:1}100%{transform:translateX(100cqw);opacity:0}}
.otk-labels{display:grid;grid-template-columns:1fr 1fr 1fr;font-size:12.5px;color:var(--faint);margin-top:10px}
.otk-labels span:nth-child(2){text-align:center}.otk-labels span:last-child{text-align:right}
.otk-labels .on{color:var(--heading);font-weight:600}
.otk-labels .soon{color:var(--go)}
@media (prefers-reduced-motion:reduce){.otk-node.next::after,.otk-line .pulse{animation:none}.otk-line .pulse{opacity:0}.otk-line .fill{transition-duration:1ms;transition-delay:0s}}
`;

export type OrderTransitionProps = {
  tone: "go" | "fail";
  /** Starts the fill. Flip once. */
  active: boolean;
  /** Where the fill grows from, in viewport pixels. Usually the button that
   *  was pressed. Defaults to just below the centre of the screen. */
  origin?: { x: number; y: number } | null;
  /** Radius the fill starts at, in pixels: the size of the disc it grows out
   *  of. Defaults to a point. */
  startRadius?: number;
  /** Wait this long before growing, so the disc's own move reads first. */
  delayMs?: number;
  /** "go" only: called once the screen is fully green. Navigate here. */
  onFilled?: () => void;
  /** "fail" only. */
  title?: string;
  reason?: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Centre of an element in viewport pixels, for `origin`. */
export function originOf(el: Element | null | undefined): { x: number; y: number } | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function OrderTransition({
  tone,
  active,
  origin,
  startRadius = 0,
  delayMs = 0,
  onFilled,
  title = "Transaction incomplete",
  reason,
  hint,
  actionLabel = "Try again",
  onAction,
}: OrderTransitionProps) {
  const [stage, setStage] = useState<"idle" | "wash" | "settle">("idle");

  useEffect(() => {
    if (!active) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage("wash"), delayMs));
    if (tone === "go") {
      timers.push(window.setTimeout(() => onFilled?.(), delayMs + 760));
    } else {
      timers.push(window.setTimeout(() => setStage("settle"), delayMs + 900));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tone]);

  if (!active) return null;

  // Radius that reaches the farthest screen corner from the origin.
  const vars: Record<string, string> = { "--sr": `${Math.max(0, startRadius)}px` };
  if (origin && typeof window !== "undefined") {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 24;
    vars["--ox"] = `${Math.round(origin.x)}px`;
    vars["--oy"] = `${Math.round(origin.y)}px`;
    vars["--or"] = `${Math.round(r)}px`;
  }

  return (
    <div className={`otr ${tone} ${stage}`} style={vars as React.CSSProperties} role={tone === "fail" ? "alertdialog" : "presentation"} aria-modal={tone === "fail" || undefined} aria-label={tone === "fail" ? title : undefined}>
      <style>{CSS}</style>
      <div className="otr-wash" aria-hidden />
      {tone === "fail" && (
        <>
          <div className="otr-ground" aria-hidden />
          <div className="otr-ui">
            <div className="otr-mark">
              <X strokeWidth={2.5} />
            </div>
            <h1 className="otr-h">{title}</h1>
            {reason && <p className="otr-reason">{reason}</p>}
            {hint && <p className="otr-hint">{hint}</p>}
            {onAction && (
              <button type="button" className="otr-btn" onClick={onAction} autoFocus>
                {actionLabel}
                <i>
                  <ArrowRight strokeWidth={2} />
                </i>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export type OrderStep = "placed" | "building" | "live";

/** Placed / Building / Live. Every segment keeps moving: the one in progress
 *  runs a fast bright pulse, finished ones a slow white shimmer, and the one
 *  still ahead a slow faint drift, so the order never looks parked. */
export function OrderTracker({ step, className }: { step: OrderStep; className?: string }) {
  const idx = step === "placed" ? 0 : step === "building" ? 1 : 2;
  return (
    <div className={`otk ${className ?? ""}`} aria-label={`Order progress: ${step}`}>
      <style>{CSS}</style>
      <div className="otk-track">
        <div className={`otk-node ${idx >= 0 ? "lit" : ""}`} />
        <div className={`otk-line ${idx >= 1 ? "done" : "live"}`}>
          <span className="fill" />
          <span className="pulse" aria-hidden />
        </div>
        <div className={`otk-node ${idx >= 1 ? "lit" : idx === 0 ? "next" : ""}`} />
        <div className={`otk-line ${idx >= 2 ? "done" : idx === 1 ? "live" : "idle"}`}>
          <span className="fill" />
          <span className="pulse" aria-hidden />
        </div>
        <div className={`otk-node ${idx >= 2 ? "lit" : idx === 1 ? "next" : ""}`} />
      </div>
      <div className="otk-labels">
        <span className={idx === 0 ? "on" : idx > 0 ? "on" : ""}>Placed</span>
        <span className={idx === 1 ? "on" : idx === 0 ? "soon" : idx > 1 ? "on" : ""}>Building</span>
        <span className={idx === 2 ? "on" : idx === 1 ? "soon" : ""}>Live</span>
      </div>
    </div>
  );
}
