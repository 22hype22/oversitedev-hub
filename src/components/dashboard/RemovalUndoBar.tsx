import { useEffect, useState } from "react";
import { botBaseIcon } from "@/lib/botCatalog";

/**
 * The card that drops in at the top after a bot is removed. The bot is
 * already gone from the list; Undo is the only way back, and the ring inside
 * it empties over the window. When it runs out, or the card is closed, the
 * removal is committed for good.
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
.osd .undo-stack{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:160;width:min(520px,calc(100vw - 24px));display:flex;flex-direction:column;gap:8px;pointer-events:none}
.osd .undo{pointer-events:auto;display:flex;align-items:center;gap:12px;padding:10px 8px 10px 12px;border-radius:14px;background:var(--panel);border:1px solid var(--hair);box-shadow:0 22px 50px -22px rgba(0,0,0,.85);animation:undo-in .36s cubic-bezier(.22,1,.36,1)}
@keyframes undo-in{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
.osd .undo .ic{height:34px;width:34px;flex:none;border-radius:10px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,var(--surface2),var(--surface));color:var(--accent)}
.osd .undo .ic img{height:100%;width:100%;object-fit:cover}
.osd .undo .ic svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none}
.osd .undo .tx{flex:1;min-width:0}
.osd .undo .t{font-family:var(--disp);font-weight:700;font-size:13.5px;color:var(--heading);line-height:1.15;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.osd .undo .s{font-size:12px;color:var(--faint);margin-top:3px}
.osd .undo .s b{color:var(--body);font-weight:600;font-variant-numeric:tabular-nums}
.osd .undo .back{position:relative;flex:none;display:grid;place-items:center;height:38px;padding:0 14px 0 40px;border-radius:10px;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--heading);font-family:var(--bodyf);font-weight:700;font-size:12.5px;cursor:pointer;transition:background .15s,border-color .15s}
.osd .undo .back:hover{background:color-mix(in srgb,var(--accent) 16%,transparent);border-color:color-mix(in srgb,var(--accent) 60%,transparent)}
.osd .undo .back svg{position:absolute;left:9px;top:50%;width:22px;height:22px;transform:translateY(-50%) rotate(-90deg)}
.osd .undo .back circle{fill:none;stroke-width:2.4}
.osd .undo .back .bg{stroke:color-mix(in srgb,var(--accent) 18%,transparent)}
.osd .undo .back .fg{stroke:var(--accent);stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:0;animation:undo-ring linear forwards}
@keyframes undo-ring{from{stroke-dashoffset:0}to{stroke-dashoffset:100}}
.osd .undo .x{flex:none;height:30px;width:30px;border-radius:8px;border:0;background:transparent;color:var(--faint);display:grid;place-items:center;cursor:pointer;padding:0;transition:.15s}
.osd .undo .x:hover{background:var(--surface2);color:var(--heading)}
.osd .undo .x svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none}
@media (prefers-reduced-motion:reduce){.osd .undo{animation:none}.osd .undo .back .fg{animation:none}}
@media (max-width:480px){.osd .undo .s{display:none}}
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

// The ring inside the Undo button empties over the window. Its start offset
// is fixed once on mount so re-renders never nudge the animation.
function Ring({ windowMs, startedAt }: { windowMs: number; startedAt: number }) {
  const [offset] = useState(() => Math.max(0, Date.now() - startedAt));
  return (
    <svg viewBox="0 0 36 36" aria-hidden>
      <circle className="bg" cx="18" cy="18" r="15.9" />
      <circle
        className="fg"
        cx="18"
        cy="18"
        r="15.9"
        pathLength="100"
        style={{ animationDuration: `${windowMs}ms`, animationDelay: `-${offset}ms` }}
      />
    </svg>
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
            <div className="ic">{it.iconUrl ? <img src={it.iconUrl} alt="" /> : <Icon />}</div>
            <div className="tx">
              <div className="t">{it.name} {it.subscription ? "cancelled" : "deleted"}</div>
              <div className="s">
                Gone for good in <b>{left}</b>s
              </div>
            </div>
            <button type="button" className="back" onClick={() => onUndo(it.id)}>
              <Ring windowMs={it.windowMs} startedAt={it.startedAt} />
              Undo
            </button>
            <button type="button" className="x" aria-label="Close and delete now" onClick={() => onClose(it.id)}>
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
