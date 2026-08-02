import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw, FlipHorizontal2, ZoomIn, ZoomOut, X, ImagePlus, Loader2 } from "lucide-react";

// Discord's exact targets. Avatar is a 1:1 square shown as a circle; the banner
// is a wide rectangle. BANNER_RATIO is width÷height — confirmed to match the
// crop shape Discord shows in its own editor.
const AVATAR = { w: 1024, h: 1024, round: true };
export const BANNER_RATIO = 2.5; // 5:2 → 1024×410
const bannerTarget = (ratio: number) => ({ w: 1024, h: Math.round(1024 / ratio), round: false });

type Mode = "avatar" | "banner";

type Props = {
  src: string;
  mode: Mode;
  bannerRatio?: number;
  busy?: boolean;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
};

export function ImageCropModal({ src, mode, bannerRatio = BANNER_RATIO, busy, onApply, onCancel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState(src);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [flip, setFlip] = useState(false);
  // Offset lives in a ref, not state, so dragging updates the transform
  // imperatively (no React re-render per mousemove → smooth).
  const offRef = useRef({ x: 0, y: 0 });

  const target = mode === "avatar" ? AVATAR : bannerTarget(bannerRatio);

  const stageSize = useCallback(() => {
    const ar = target.w / target.h;
    let sw = mode === "avatar" ? 330 : 520;
    let sh = sw / ar;
    if (sh > 360) { sh = 360; sw = sh * ar; }
    return { w: Math.round(sw), h: Math.round(sh) };
  }, [mode, target.w, target.h]);

  const coverScale = useCallback(() => {
    const s = stageSize();
    const rotated = rot % 180 !== 0;
    const ew = rotated ? nat.h : nat.w;
    const eh = rotated ? nat.w : nat.h;
    if (!ew || !eh) return 1;
    return Math.max(s.w / ew, s.h / eh);
  }, [stageSize, rot, nat.w, nat.h]);

  // (re)load whenever the chosen file changes → capture natural size, reset view
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      offRef.current = { x: 0, y: 0 };
      setNat({ w: im.naturalWidth, h: im.naturalHeight });
      setZoom(1); setRot(0); setFlip(false);
    };
    im.src = source;
  }, [source]);

  // Lock the page and disable overscroll while the editor is open, so dragging
  // the image can never trigger the browser's pull-to-refresh or swipe-back.
  useEffect(() => {
    const body = document.body.style;
    const root = document.documentElement.style;
    const prevOverflow = body.overflow;
    const prevOB = root.overscrollBehavior;
    body.overflow = "hidden";
    root.overscrollBehavior = "none";
    return () => {
      body.overflow = prevOverflow;
      root.overscrollBehavior = prevOB;
    };
  }, []);

  // Built on every render (cheap string) and applied imperatively during drag.
  const buildTransform = () => {
    const scale = coverScale() * zoom;
    const o = offRef.current;
    return `translate(-50%,-50%) translate(${o.x}px, ${o.y}px) rotate(${rot}deg) ` +
      `scale(${flip ? -scale : scale}, ${scale})`;
  };

  // drag to pan — imperative, so no state update fires per mousemove
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    offRef.current = {
      x: offRef.current.x + e.clientX - drag.current.x,
      y: offRef.current.y + e.clientY - drag.current.y,
    };
    drag.current = { x: e.clientX, y: e.clientY };
    if (imgRef.current) imgRef.current.style.transform = buildTransform();
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.0012)));
  };

  const reset = () => { offRef.current = { x: 0, y: 0 }; setZoom(1); setRot(0); setFlip(false); };

  const pickNew = () => fileRef.current?.click();
  const onNewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => setSource(String(r.result));
    r.readAsDataURL(f);
  };

  const apply = () => {
    const s = stageSize();
    const ratio = target.w / s.w;
    const canvas = document.createElement("canvas");
    canvas.width = target.w;
    canvas.height = target.h;
    const ctx = canvas.getContext("2d");
    if (!ctx || !imgRef.current) return;
    ctx.clearRect(0, 0, target.w, target.h);
    ctx.save();
    ctx.translate(target.w / 2, target.h / 2);
    ctx.translate(offRef.current.x * ratio, offRef.current.y * ratio);
    ctx.rotate((rot * Math.PI) / 180);
    const sc = coverScale() * zoom * ratio;
    ctx.scale((flip ? -1 : 1) * sc, sc);
    ctx.drawImage(imgRef.current, -nat.w / 2, -nat.h / 2, nat.w, nat.h);
    ctx.restore();
    onApply(canvas.toDataURL("image/png"));
  };

  const s = stageSize();
  const pct = ((zoom - 1) / 2) * 100;

  return (
    <div className="oscrop-overlay" role="dialog" aria-modal="true" aria-label="Edit image">
      <style>{CSS}</style>
      <div className="oscrop">
        <div className="ohead">
          <button className="file" onClick={pickNew} disabled={busy}>
            <ImagePlus size={16} /> Select file
          </button>
          <div className="title">Edit image</div>
          <button className="x" onClick={onCancel} aria-label="Cancel" disabled={busy}>
            <X size={20} />
          </button>
        </div>

        <div className="stagewrap">
          <div
            ref={stageRef}
            className="stage"
            style={{ width: s.w, height: s.h }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDragStart={(e) => e.preventDefault()}
            onWheel={onWheel}
          >
            <img ref={imgRef} src={source} alt="" draggable={false} style={{ transform: buildTransform() }} />
            <div className={`frame${target.round ? " round" : ""}`} />
          </div>
        </div>

        <div className="tools">
          <div className="grp">
            <button className="iconbtn" onClick={() => setRot((r) => (r + 90) % 360)} title="Rotate 90°">
              <RotateCw size={18} />
            </button>
            <button className="iconbtn" onClick={() => setFlip((f) => !f)} title="Flip horizontal">
              <FlipHorizontal2 size={18} />
            </button>
          </div>
          <div className="grp zoom">
            <ZoomOut size={16} />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              style={{ "--pct": `${pct}%` } as React.CSSProperties}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <ZoomIn size={16} />
          </div>
        </div>

        <div className="ofoot">
          <button className="btn ghost" onClick={reset} disabled={busy}>Reset</button>
          <div className="rgrp">
            <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={apply} disabled={busy}>
              {busy ? (<><Loader2 size={15} className="spin" /> Saving…</>) : "Apply"}
            </button>
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="oscrop-hidden" onChange={onNewFile} />
    </div>
  );
}

const CSS = `
.oscrop-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;
  padding:20px;background:rgba(6,9,12,.72);backdrop-filter:blur(3px);
  overscroll-behavior:none;touch-action:none}
.oscrop-hidden{display:none}
.oscrop{width:min(680px,100%);background:rgb(var(--os-surface,22 27 34));
  border:1px solid rgba(255,255,255,.09);border-radius:16px;overflow:hidden;
  box-shadow:0 24px 70px rgba(0,0,0,.55);color:rgb(var(--os-body,182 194 207))}
.oscrop .ohead{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
  padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.09)}
.oscrop .file{justify-self:start;display:inline-flex;align-items:center;gap:8px;font:inherit;font-size:13px;
  color:rgb(var(--os-body,182 194 207));background:transparent;border:0;cursor:pointer}
.oscrop .file:hover{color:rgb(var(--os-heading,230 237 243))}
.oscrop .title{justify-self:center;font-size:15px;font-weight:700;color:rgb(var(--os-heading,230 237 243))}
.oscrop .x{justify-self:end;background:transparent;border:0;color:rgb(var(--os-faint,138 151 163));cursor:pointer;line-height:0}
.oscrop .x:hover{color:rgb(var(--os-heading,230 237 243))}
.oscrop .stagewrap{padding:26px;display:flex;justify-content:center}
.oscrop .stage{position:relative;overflow:hidden;border-radius:6px;background-color:#171c22;
  background-image:linear-gradient(45deg,#20262e 25%,transparent 25%),linear-gradient(-45deg,#20262e 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,#20262e 75%),linear-gradient(-45deg,transparent 75%,#20262e 75%);
  background-size:22px 22px;background-position:0 0,0 11px,11px -11px,-11px 0;touch-action:none;cursor:grab;user-select:none}
.oscrop .stage:active{cursor:grabbing}
.oscrop .stage img{position:absolute;left:50%;top:50%;transform-origin:center center;
  will-change:transform;pointer-events:none;max-width:none;
  -webkit-user-drag:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.oscrop .frame{position:absolute;inset:0;pointer-events:none;border-radius:6px;
  box-shadow:0 0 0 2px rgba(255,255,255,.92) inset}
.oscrop .frame.round::after{content:"";position:absolute;inset:0;border-radius:50%;
  box-shadow:0 0 0 2000px rgba(15,18,22,.55)}
.oscrop .tools{display:flex;align-items:center;justify-content:center;gap:14px;padding:0 26px 20px}
.oscrop .grp{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.09);border-radius:11px;padding:7px 12px}
.oscrop .iconbtn{border:0;background:transparent;color:rgb(var(--os-body,182 194 207));cursor:pointer;
  line-height:0;padding:5px;border-radius:7px;transition:.14s}
.oscrop .iconbtn:hover{background:rgba(255,255,255,.06);color:rgb(var(--os-heading,230 237 243))}
.oscrop .zoom{min-width:280px}
.oscrop .zoom input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:3px;flex:1;cursor:pointer;
  background:linear-gradient(90deg,#C9DBE6 var(--pct,0%),rgba(255,255,255,.14) var(--pct,0%))}
.oscrop .zoom input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;
  background:#C9DBE6;border:2px solid #0e1116;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.oscrop .zoom input[type=range]::-moz-range-thumb{width:15px;height:15px;border:2px solid #0e1116;border-radius:50%;background:#C9DBE6}
.oscrop .ofoot{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;
  border-top:1px solid rgba(255,255,255,.09)}
.oscrop .btn{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);
  color:rgb(var(--os-heading,230 237 243));font:inherit;font-size:13px;font-weight:600;
  padding:10px 18px;border-radius:10px;cursor:pointer;transition:.14s;display:inline-flex;align-items:center;gap:7px}
.oscrop .btn:hover{border-color:rgba(255,255,255,.18)}
.oscrop .btn.ghost{border-color:transparent;background:transparent;color:rgb(var(--os-faint,138 151 163))}
.oscrop .btn.ghost:hover{color:rgb(var(--os-heading,230 237 243))}
.oscrop .btn.primary{background:#C9DBE6;color:#0c1116;border-color:transparent}
.oscrop .btn.primary:hover{filter:brightness(1.06)}
.oscrop .btn:disabled{opacity:.6;cursor:not-allowed}
.oscrop .rgrp{display:flex;gap:10px}
.oscrop .spin{animation:oscropspin 1s linear infinite}
@keyframes oscropspin{to{transform:rotate(360deg)}}
`;
