import { useEffect, useState } from "react";

/**
 * The quiet toast in the bottom left after a bot is removed. The bot is
 * already gone from the list; Undo is the only way back. When the countdown
 * ends, or the toast is closed, the removal is committed for good.
 *
 * Rendered inside the `.osd` shell so the dashboard's own variables apply.
 */
export type RemovalUndoItem = {
  id: string;
  name: string;
  base: string;
  iconUrl: string | null;
  /** True when the bot billed monthly, so the wording says "cancelled". */
  subscription: boolean;
  startedAt: number;
  /** How long the way back stays open, in ms. */
  windowMs: number;
};

type Props = {
  items: RemovalUndoItem[];
  onUndo: (id: string) => void;
  onClose: (id: string) => void;
};

const CSS = `
.osd .undo-stack{position:fixed;left:18px;bottom:18px;z-index:160;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:calc(100vw - 36px)}
.osd .undo{pointer-events:auto;position:relative;display:flex;align-items:center;gap:6px;height:44px;padding:0 6px 0 14px;border-radius:12px;background:#12161b;color:var(--heading);border:1px solid rgba(168,180,191,.14);box-shadow:0 18px 40px -18px rgba(0,0,0,.9);animation:undo-in .32s cubic-bezier(.22,1,.36,1);white-space:nowrap}
@keyframes undo-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.osd .undo .msg{font-family:var(--bodyf);font-size:13px;font-weight:500;color:var(--heading);margin-right:8px;overflow:hidden;text-overflow:ellipsis}
.osd .undo .msg b{font-weight:700}
.osd .undo .cnt{font-family:var(--mono);font-size:11px;color:var(--faint);margin-right:2px;font-variant-numeric:tabular-nums}
.osd .undo .back{font-family:var(--bodyf);font-weight:700;font-size:12.5px;color:var(--accent);background:none;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;transition:background .15s}
.osd .undo .back:hover{background:color-mix(in srgb,var(--accent) 12%,transparent)}
.osd .undo .x{height:30px;width:30px;border-radius:8px;border:0;background:transparent;color:var(--faint);display:grid;place-items:center;cursor:pointer;padding:0;transition:.15s}
.osd .undo .x:hover{background:var(--surface2);color:var(--heading)}
.osd .undo .x svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none}
.osd .undo .drain{position:absolute;left:12px;right:12px;bottom:0;height:2px;border-radius:2px;background:color-mix(in srgb,var(--accent) 16%,transparent);overflow:hidden}
.osd .undo .drain i{position:absolute;inset:0;transform-origin:left center;background:var(--accent);animation:undo-drain linear forwards}
@keyframes undo-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){.osd .undo{animation:none}.osd .undo .drain i{animation:none;transform:none}}
@media (max-width:480px){.osd .undo-stack{left:12px;right:12px;max-width:none}.osd .undo{width:100%}.osd .undo .msg{flex:1}}
`;

const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
};

// The thin line that drains across the bottom. Its start offset is fixed once
// on mount so re-renders never nudge the animation.
function Drain({ windowMs, startedAt }: { windowMs: number; startedAt: number }) {
  const [offset] = useState(() => Math.max(0, Date.now() - startedAt));
  return (
    <div className="drain">
      <i style={{ animationDuration: `${windowMs}ms`, animationDelay: `-${offset}ms` }} />
    </div>
  );
}

export function RemovalUndoBar({ items, onUndo, onClose }: Props) {
  const now = useNow(items.length > 0);
  if (!items.length) return null;
  return (
    <div className="undo-stack" role="status" aria-live="polite">
      <style>{CSS}</style>
      {items.map((it) => {
        const elapsed = Math.max(0, now - it.startedAt);
        const left = Math.max(0, Math.ceil((it.windowMs - elapsed) / 1000));
        return (
          <div className="undo" key={it.id}>
            <span className="msg">
              {it.subscription ? "Cancelled" : "Deleted"} <b>{it.name}</b>
            </span>
            <span className="cnt">{left}s</span>
            <button type="button" className="back" onClick={() => onUndo(it.id)}>Undo</button>
            <button type="button" className="x" aria-label="Close and delete now" onClick={() => onClose(it.id)}>
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <Drain windowMs={it.windowMs} startedAt={it.startedAt} />
          </div>
        );
      })}
    </div>
  );
}
