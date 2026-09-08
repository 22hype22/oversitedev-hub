import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { botBaseIcon, BOT_BASE_LABELS } from "@/lib/botCatalog";

/**
 * The moment after an order is placed. A single green wash grows out of the
 * bottom centre (where the button's check disc sits), sweeps up through the
 * host card, and lifts to reveal the placed state: the bot, its name, what
 * happens next, and a tracker running from Placed toward Building.
 *
 * The host wraps its previous content and this component in one
 * `position: relative; overflow: hidden` box. When `active` flips on, the
 * wash starts at once; `onCovered` fires while the card is fully green so
 * the host can drop its old content without a visible jump.
 *
 * Colors mirror the marketing theme tokens in index.css. They are set here
 * as component variables because the checkout system pages carry the same
 * palette as hex, not channel triplets, and this plays on both.
 */

const CSS = `
.opm{--opm-go:#34D399;--opm-go-rgb:52 211 153;--opm-heading:#E8EEF3;--opm-body:#A8B4BF;--opm-faint:#788591;--opm-hair:rgba(86,98,110,.55);--opm-panel:#293038;--opm-ease:cubic-bezier(.23,1,.32,1);--opm-display:'Bricolage Grotesque',system-ui,sans-serif;--opm-sans:'Space Grotesk',system-ui,sans-serif;font-family:var(--opm-sans);color:var(--opm-body)}
.opm-wash{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgb(var(--opm-go-rgb)/.92),rgb(var(--opm-go-rgb)/.78));clip-path:circle(0px at 50% 88%);opacity:0}
.opm-wash.on{opacity:1;clip-path:circle(150% at 50% 88%);transition:clip-path 520ms cubic-bezier(.32,.72,0,1),opacity 0s}
.opm-wash.off{opacity:0;transition:opacity 260ms var(--opm-ease)}
.opm-body{position:absolute;inset:0;opacity:0;pointer-events:none;z-index:1}
.opm-body.show{position:relative;inset:auto;opacity:1;pointer-events:auto}
.opm-body.show>*{animation:opm-rise 260ms var(--opm-ease) both}
.opm-body.show>*:nth-child(2){animation-delay:60ms}.opm-body.show>*:nth-child(3){animation-delay:120ms}.opm-body.show>*:nth-child(4){animation-delay:200ms}.opm-body.show>*:nth-child(5){animation-delay:260ms}
@keyframes opm-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.opm-who{display:flex;align-items:center;gap:14px}
.opm-avatar{width:54px;height:54px;border-radius:16px;flex:none;display:grid;place-items:center;overflow:visible;position:relative;background:linear-gradient(180deg,rgba(201,219,230,.22),rgba(201,219,230,.08));box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 10px 24px -14px rgba(0,0,0,.7);color:var(--opm-heading)}
.opm-avatar img{width:100%;height:100%;border-radius:16px;object-fit:cover;display:block}
.opm-avatar svg{width:24px;height:24px}
.opm-badge{position:absolute;right:-5px;bottom:-5px;width:20px;height:20px;border-radius:50%;background:var(--opm-go);border:2px solid var(--opm-panel);display:grid;place-items:center;color:#1E242B;transform:scale(0);transition:transform 260ms cubic-bezier(.34,1.56,.64,1) 420ms}
.opm-body.show .opm-badge{transform:scale(1)}
.opm-badge svg{width:10px;height:10px}
.opm-h{font-family:var(--opm-display);font-size:26px;line-height:1.08;letter-spacing:-.025em;color:var(--opm-heading);margin:0;text-wrap:balance;font-weight:800}
.opm-tag{display:block;font-size:12.5px;color:var(--opm-go);font-weight:600;margin-top:4px}
.opm-sub{margin:14px 0 0;font-size:13.5px;line-height:1.55;color:var(--opm-body);max-width:36ch}
.opm-track{margin-top:20px;display:grid;grid-template-columns:auto 1fr auto 1fr auto;align-items:center}
.opm-node{width:10px;height:10px;border-radius:50%;background:var(--opm-hair);transition:background 260ms var(--opm-ease),box-shadow 260ms var(--opm-ease)}
.opm-node.lit{background:var(--opm-go);box-shadow:0 0 0 4px rgb(var(--opm-go-rgb)/.18)}
.opm-line{height:2px;background:var(--opm-hair);position:relative;overflow:hidden;margin:0 6px}
.opm-line i{position:absolute;inset:0;background:var(--opm-go);transform:scaleX(0);transform-origin:left;transition:transform 560ms var(--opm-ease) 380ms}
.opm-line.half i{transform:scaleX(.45)}
.opm-labels{display:grid;grid-template-columns:1fr 1fr 1fr;font-size:12px;color:var(--opm-faint);margin-top:8px}
.opm-labels span:nth-child(2){text-align:center}.opm-labels span:last-child{text-align:right}
.opm-labels .on{color:var(--opm-heading);font-weight:600}
.opm-next{margin-top:18px;padding-top:14px;border-top:1px solid var(--opm-hair);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12.5px;color:var(--opm-faint)}
.opm-next b{color:var(--opm-body);font-weight:500}
.opm-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;font-family:var(--opm-display);font-weight:600;font-size:13px;color:var(--opm-heading);padding:9px 14px;border-radius:10px;background:rgba(232,238,243,.06);box-shadow:inset 0 0 0 1px var(--opm-hair);cursor:pointer;white-space:nowrap;transition:background 150ms var(--opm-ease),transform 160ms var(--opm-ease)}
@media (hover:hover){.opm-btn:hover{background:rgba(232,238,243,.1)}}
.opm-btn:active{transform:scale(.98)}
.opm-btn:focus-visible{outline:2px solid rgb(var(--opm-go-rgb)/.7);outline-offset:2px}
.opm-btn svg{width:14px;height:14px}
@media (prefers-reduced-motion:reduce){
  .opm-wash.on{transition:none}
  .opm-body.show>*{animation:none}
  .opm-line i,.opm-badge{transition-duration:1ms;transition-delay:0s}
}
`;

export type OrderPlacedMomentProps = {
  /** Starts the wash. Flip once; the component runs the rest. */
  active: boolean;
  botName: string;
  /** Base id, for the fallback icon and the product label. */
  base?: string | null;
  /** Bot icon image, if one was uploaded. */
  iconUrl?: string | null;
  /** Fires while the card is fully green, so the host can drop its old content. */
  onCovered?: () => void;
  continueLabel?: string;
  onContinue: () => void;
  /** Optional line under the note, e.g. a payment method. */
  note?: ReactNode;
};

export function OrderPlacedMoment({
  active,
  botName,
  base,
  iconUrl,
  onCovered,
  continueLabel = "Continue",
  onContinue,
  note,
}: OrderPlacedMomentProps) {
  const [wash, setWash] = useState<"idle" | "on" | "off">("idle");
  const [shown, setShown] = useState(false);
  const [lit, setLit] = useState(false);
  const coveredRef = useRef(onCovered);
  coveredRef.current = onCovered;

  useEffect(() => {
    if (!active) return;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    setWash("on");
    later(() => {
      coveredRef.current?.();
      setShown(true);
    }, 180);
    later(() => setWash("off"), 480);
    later(() => setLit(true), 530);
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const Icon = botBaseIcon(base);
  const product = (base && BOT_BASE_LABELS[base]) || "Oversite";
  const name = botName.trim() || "Your bot";

  return (
    <>
      <style>{CSS}</style>
      <div className={`opm-wash ${wash === "on" ? "on" : wash === "off" ? "off" : ""}`} aria-hidden />
      <div className={`opm opm-body ${shown ? "show" : ""}`} aria-live="polite">
        <div className="opm-who">
          <div className="opm-avatar">
            {iconUrl ? <img src={iconUrl} alt="" /> : <Icon strokeWidth={1.75} />}
            <span className="opm-badge">
              <Check strokeWidth={3} />
            </span>
          </div>
          <div>
            <h2 className="opm-h">{name} is yours.</h2>
            <span className="opm-tag">Order placed</span>
          </div>
        </div>
        <p className="opm-sub">
          We start building now and message you on Discord the moment it goes live. Watch it come
          together from your dashboard.
        </p>
        <div className="opm-track">
          <div className={`opm-node ${lit ? "lit" : ""}`} />
          <div className={`opm-line ${lit ? "half" : ""}`}>
            <i />
          </div>
          <div className="opm-node" />
          <div className="opm-line">
            <i />
          </div>
          <div className="opm-node" />
        </div>
        <div className="opm-labels">
          <span className="on">Placed</span>
          <span>Building</span>
          <span>Live</span>
        </div>
        <div className="opm-next">
          <span>
            {product}
            {note ? <b> {note}</b> : null}
          </span>
          <button type="button" className="opm-btn" onClick={onContinue}>
            {continueLabel} <ArrowRight strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  );
}
