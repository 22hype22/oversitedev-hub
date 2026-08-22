// Renders the Packages design the way the bot actually posts it — a Discord
// embed. Mirrors the bot's _pkg_build_embed: a heading becomes the linked title,
// {|} rows (a labels line + a values line) and Fields components become aligned
// inline fields, the container accent becomes the color bar, a Media Gallery photo
// sits INSIDE the embed at the bottom, and a Button Row becomes a button.
// Keeping this in lockstep with the bot means the preview matches the post.

import type { ReactNode } from "react";
import type { V2Item } from "./MessagesV2Builder";

// Render a single line of Discord markdown: **bold**, `code`, [text](url), and
// <@id> mentions — so the preview looks like the posted embed.
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(<@!?\d+>)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      nodes.push(<code key={key++} className="rounded px-1 py-0.5 font-mono text-[0.85em]" style={{ background: "#1e1f22", color: "#dbdee1" }}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key++} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      nodes.push(<span key={key++} className="text-[#00a8fc]">{lm ? lm[1] : tok}</span>);
    } else {
      nodes.push(<span key={key++} className="rounded bg-[#3c4270] px-0.5 text-[#c9cdfb]">@user</span>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Md({ text, className }: { text: string; className?: string }) {
  const lines = String(text ?? "").split("\n");
  return (
    <span className={className}>
      {lines.map((l, i) => (
        <span key={i}>
          {renderInline(l)}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </span>
  );
}

type Field = { name: string; value: string; inline: boolean };
type Built = {
  color: string;
  title: string;
  titleUrl: string;
  desc: string[];
  fields: Field[];
  button: string;
  image: string;
};

const HEADING_LINK = /^\[(.*?)\]\((.*?)\)$/;

function build(items: V2Item[]): Built {
  const b: Built = { color: "", title: "", titleUrl: "", desc: [], fields: [], button: "", image: "" };
  let started = false;
  // Discord renders the description above every field, so once a columns/fields
  // block appears, later text must also become a (headerless) field or it would
  // jump above the columns. `fstarted` tracks that; `trailing` buffers the text.
  let fstarted = false;
  let trailing: string[] = [];
  const flushTrailing = () => {
    const txt = trailing.join("\n").trim();
    trailing = [];
    if (!txt) return;
    // First line becomes the field name (a blank name renders an extra empty
    // line above the text); the rest is the value.
    const parts = txt.split("\n");
    const name = parts[0].replace(/^#+/, "").replace(/\*\*/g, "").trim() || "​";
    const value = parts.slice(1).join("\n").trim() || "​";
    b.fields.push({ name, value, inline: false });
  };
  const addLine = (text: string) => { (fstarted ? trailing : b.desc).push(text); };

  const walk = (list: V2Item[]) => {
    for (const c of list) {
      const t = (c as any).type;
      if (t === "container") {
        if (!b.color && (c as any).accentColor) b.color = (c as any).accentColor;
        walk((c as any).children || []);
      } else if (t === "gallery") {
        const imgs = ((c as any).images || []).filter((u: string) => u && u.trim());
        if (!b.image && imgs.length) b.image = imgs[0];
      } else if (t === "text") {
        const lines = String((c as any).text || "").split("\n");
        let i = 0;
        while (i < lines.length) {
          const line = lines[i];
          const s = line.trim();
          if (line.includes("{|}") && i + 1 < lines.length && lines[i + 1].includes("{|}")) {
            const names = line.split("{|}").map((x) => x.trim());
            const vals = lines[i + 1].split("{|}").map((x) => x.trim());
            if (names.length === vals.length) {
              flushTrailing();
              names.forEach((n, k) => b.fields.push({ name: n || "​", value: vals[k] || "​", inline: true }));
              started = true;
              fstarted = true;
              i += 2;
              continue;
            }
          }
          if (!b.title && s.startsWith("#")) {
            const h = s.replace(/^#+/, "").trim();
            const m = HEADING_LINK.exec(h);
            if (m) { b.title = m[1].trim(); b.titleUrl = m[2].trim().replace(/^<|>$/g, ""); }
            else b.title = h;
          } else if (line.includes("{|}")) {
            addLine(line.replace(/\{\|\}/g, " | "));
            started = true;
          } else {
            addLine(line);
            if (s) started = true;
          }
          i += 1;
        }
      } else if (t === "section") {
        if ((c as any).title) addLine(`**${(c as any).title}**`);
        if ((c as any).text) addLine(String((c as any).text));
        started = true;
      } else if (t === "fields") {
        flushTrailing();
        for (const f of (c as any).fields || []) {
          if (f && f.name) b.fields.push({ name: String(f.name), value: String(f.value || "​"), inline: !!f.inline });
        }
        started = true;
        fstarted = true;
      } else if (t === "buttonRow") {
        for (const btn of (c as any).buttons || []) {
          if (btn && btn.label && !b.button) b.button = String(btn.label);
        }
      }
    }
  };
  walk(items || []);
  flushTrailing();
  return b;
}

// The accent bar is blended into the embed background so it reads as invisible,
// matching the reference embed (no visible side stripe).
function Bar() {
  return <span className="absolute left-0 top-0 h-full w-1" style={{ background: "#2b2d31" }} />;
}

export function PackageEmbedPreview({ items, botName, botAvatarUrl }: { items: V2Item[]; botName?: string; botAvatarUrl?: string }) {
  const b = build(items || []);
  const empty = !b.title && b.desc.length === 0 && b.fields.length === 0 && !b.image;

  // Group inline fields (max 3 across); full fields on their own row.
  const rows: Field[][] = [];
  let run: Field[] = [];
  for (const f of b.fields) {
    if (f.inline) { run.push(f); if (run.length === 3) { rows.push(run); run = []; } }
    else { if (run.length) { rows.push(run); run = []; } rows.push([f]); }
  }
  if (run.length) rows.push(run);

  // Discord message/embed colors so the preview matches a real post.
  return (
    <div className="rounded-lg p-3" style={{ background: "#313338" }}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full" style={{ background: "#1e1f22" }}>
          {botAvatarUrl ? <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "#f2f3f5" }}>{botName || "Bot"}</span>
            <span className="rounded px-1 text-[10px] font-semibold uppercase text-white" style={{ background: "#5865f2" }}>App</span>
          </div>
          {empty ? (
            <p className="text-xs" style={{ color: "#949ba4" }}>Add components to build the card.</p>
          ) : (
            <>
              <div className="relative overflow-hidden rounded p-3 pl-4" style={{ background: "#2b2d31", maxWidth: 432 }}>
                <Bar />
                {b.title && (
                  <p className="mb-1 break-words font-semibold" style={{ color: b.titleUrl ? "#00a8fc" : "#f2f3f5" }}>{b.title}</p>
                )}
                {b.desc.filter((l) => l.trim() !== "").length > 0 && (
                  <p className="mb-2 break-words text-sm" style={{ color: "#dbdee1" }}>
                    <Md text={b.desc.join("\n").trim()} />
                  </p>
                )}
                {rows.map((row, i) => (
                  <div key={i} className="mb-2 flex gap-6">
                    {row.map((f, j) => (
                      <div key={j} className={f.inline ? "min-w-0 flex-1" : "w-full"}>
                        <div className="mb-0.5 break-words text-xs font-semibold" style={{ color: "#f2f3f5" }}><Md text={f.name} /></div>
                        <div className="break-words text-sm" style={{ color: "#dbdee1" }}><Md text={f.value || "​"} /></div>
                      </div>
                    ))}
                  </div>
                ))}
                {b.image && (
                  <img src={b.image} alt="" className="mt-2 max-h-64 w-full rounded object-cover" />
                )}
                <div className="mt-1 text-[10px]" style={{ color: "#949ba4" }}>Today at 12:00 PM</div>
              </div>
              {b.button && (
                <span className="inline-block rounded px-3 py-1.5 text-sm font-medium text-white" style={{ background: "#4e5058" }}>{b.button}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
