import { useEffect, useState } from "react";
import { botBaseIcon } from "@/lib/botCatalog";

/**
 * The strip that drops from the top of the dashboard after a bot is removed.
 * The bot is already gone from the list; this is the only way back. When the
 * countdown ends, or the strip is closed, the removal is committed for good.
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
.osd .undo-stack{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:160;width:min(560px,calc(100vw - 24px));display:flex;flex-direction:column;gap:8px;pointer-events:none}
.osd .undo{pointer-events:auto;position:relative;overflow:hidden;border:1px solid var(--hair);border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--bad) 6%,var(--surface)),var(--panel));box-shadow:0 24px 60px -22px rgba(0,0,0,.8),0 0 0 1px rgba(0,0,0,.25);animation:undo-in .38s cubic-bezier(.22,1,.36,1)}
@keyframes undo-in{from{opacity:0;transform:translateY(-18px) scale(.985)}to{opacity:1;transform:none}}
.osd .undo .row{display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px}
.osd .undo .ic{height:36px;width:36px;flex:none;border-radius:11px;overflow:hidden;display:grid;place-items:center;background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--bad) 26%,transparent)}
.osd .undo .ic img{height:100%;width:100%;object-fit:cover;filter:saturate(.35);opacity:.8}
.osd .undo .ic svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.8;fill:none}
.osd .undo .tx{min-width:0;flex:1}
.osd .undo .t{font-family:var(--disp);font-weight:700;font-size:13.5px;color:var(--heading);line-height:1.15;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.osd .undo .s{font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:4px;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.osd .undo .s b{color:var(--body);font-weight:400}
.osd .undo .back{flex:none;height:32px;padding:0 13px;border-radius:10px;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--hair));background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--heading);font-family:var(--bodyf);font-weight:700;font-size:12.5px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:background .15s,border-color .15s,transform .12s}
.osd .undo .back svg{width:13px;height:13px;stroke:currentColor;stroke-width:2.2;fill:none}
.osd .undo .back:hover{background:color-mix(in srgb,var(--accent) 22%,transparent);border-color:color-mix(in srgb,var(--accent) 70%,var(--hair))}
.osd .undo .back:active{transform:scale(.97)}
.osd .undo .x{flex:none;height:28px;width:28px;border-radius:9px;border:1px solid transparent;background:transparent;color:var(--faint);display:grid;place-items:center;cursor:pointer;padding:0;transition:.15s}
.osd .undo .x:hover{background:var(--surface2);color:var(--heading);border-color:var(--hair)}
.osd .undo .x svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none}
.osd .undo .drain{position:absolute;left:0;right:0;bottom:0;height:2px;background:color-mix(in srgb,var(--hair) 60%,transparent)}
.osd .undo .drain i{position:absolute;inset:0;transform-origin:left center;background:linear-gradient(90deg,var(--bad),color-mix(in srgb,var(--bad) 45%,transparent));animation:undo-drain linear forwards}
@keyframes undo-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){.osd .undo{animation:none}.osd .undo .drain i{animation:none;transform:none}}
@media (max-width:480px){.osd .undo .back span{display:none}.osd .undo .back{padding:0 11px}}
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
        const Icon = botBaseIcon(it.base);
        return (
          <div className="undo" key={it.id}>
            <div className="row">
              <div className="ic">
                {it.iconUrl ? <img src={it.iconUrl} alt="" /> : <Icon />}
              </div>
              <div className="tx">
                <div className="t">{it.subscription ? "Cancelled" : "Deleted"} {it.name}</div>
                <div className="s">
                  Gone for good in <b>{left}s</b>. Go back to keep it.
                </div>
              </div>
              <button type="button" className="back" onClick={() => onUndo(it.id)}>
                <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
                <span>Go back</span>
              </button>
              <button type="button" className="x" aria-label="Close and delete now" onClick={() => onClose(it.id)}>
                <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <Drain windowMs={it.windowMs} startedAt={it.startedAt} />
          </div>
        );
      })}
    </div>
  );
}
