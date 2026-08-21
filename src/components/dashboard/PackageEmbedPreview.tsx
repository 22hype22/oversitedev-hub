// Renders the Packages design the way the bot actually posts it — a Discord
// embed. Mirrors the bot's _pkg_build_embed: a heading becomes the linked title,
// {|} rows (a labels line + a values line) and Fields components become aligned
// inline fields, the container accent becomes the color bar, galleries before the
// text sit above and galleries after sit below, and a Button Row becomes a button.
// Keeping this in lockstep with the bot means the preview matches the post.

import type { V2Item } from "./MessagesV2Builder";

type Field = { name: string; value: string; inline: boolean };
type Built = {
  color: string;
  title: string;
  titleUrl: string;
  desc: string[];
  fields: Field[];
  button: string;
  top: string[];
  bottom: string[];
};

const HEADING_LINK = /^\[(.*?)\]\((.*?)\)$/;

function build(items: V2Item[]): Built {
  const b: Built = { color: "", title: "", titleUrl: "", desc: [], fields: [], button: "", top: [], bottom: [] };
  let started = false;

  const walk = (list: V2Item[]) => {
    for (const c of list) {
      const t = (c as any).type;
      if (t === "container") {
        if (!b.color && (c as any).accentColor) b.color = (c as any).accentColor;
        walk((c as any).children || []);
      } else if (t === "gallery") {
        const imgs = ((c as any).images || []).filter((u: string) => u && u.trim());
        (started ? b.bottom : b.top).push(...imgs);
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
              names.forEach((n, k) => b.fields.push({ name: n || "​", value: vals[k] || "​", inline: true }));
              started = true;
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
            b.desc.push(line.replace(/\{\|\}/g, " | "));
            started = true;
          } else {
            b.desc.push(line);
            if (s) started = true;
          }
          i += 1;
        }
      } else if (t === "section") {
        if ((c as any).title) b.desc.push(`**${(c as any).title}**`);
        if ((c as any).text) b.desc.push(String((c as any).text));
        started = true;
      } else if (t === "fields") {
        for (const f of (c as any).fields || []) {
          if (f && f.name) b.fields.push({ name: String(f.name), value: String(f.value || "​"), inline: !!f.inline });
        }
        started = true;
      } else if (t === "buttonRow") {
        for (const btn of (c as any).buttons || []) {
          if (btn && btn.label && !b.button) b.button = String(btn.label);
        }
      }
    }
  };
  walk(items || []);
  return b;
}

// Minimal markdown: **bold** and [text](url). Tokens like {Question:…} show as-is.
function mini(text: string): string {
  return text;
}

function Bar({ color }: { color: string }) {
  const hex = /^#?[0-9a-fA-F]{6}$/.test(color) ? (color.startsWith("#") ? color : `#${color}`) : "hsl(var(--muted-foreground))";
  return <span className="absolute left-0 top-0 h-full w-1 rounded-l" style={{ background: hex }} />;
}

export function PackageEmbedPreview({ items, botName, botAvatarUrl }: { items: V2Item[]; botName?: string; botAvatarUrl?: string }) {
  const b = build(items || []);
  const empty = !b.title && b.desc.length === 0 && b.fields.length === 0 && b.top.length === 0 && b.bottom.length === 0;

  // Group inline fields (max 3 across); full fields on their own row.
  const rows: Field[][] = [];
  let run: Field[] = [];
  for (const f of b.fields) {
    if (f.inline) { run.push(f); if (run.length === 3) { rows.push(run); run = []; } }
    else { if (run.length) { rows.push(run); run = []; } rows.push([f]); }
  }
  if (run.length) rows.push(run);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
          {botAvatarUrl ? <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{botName || "Bot"}</span>
            <span className="rounded bg-primary px-1 text-[10px] font-semibold uppercase text-primary-foreground">App</span>
          </div>
          {empty ? (
            <p className="text-xs text-muted-foreground">Add components to build the card.</p>
          ) : (
            <>
              {b.top.map((u, i) => (
                <img key={`t${i}`} src={u} alt="" className="max-h-56 w-full rounded object-cover" />
              ))}
              <div className="relative overflow-hidden rounded-md border border-border bg-background/40 p-3 pl-4">
                <Bar color={b.color} />
                {b.title && (
                  <p className={`mb-1 break-words font-semibold ${b.titleUrl ? "text-[#00a8fc]" : "text-foreground"}`}>{b.title}</p>
                )}
                {b.desc.filter((l) => l.trim() !== "").length > 0 && (
                  <p className="mb-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {b.desc.join("\n").trim()}
                  </p>
                )}
                {rows.map((row, i) => (
                  <div key={i} className="mb-2 flex gap-4">
                    {row.map((f, j) => (
                      <div key={j} className={f.inline ? "min-w-0 flex-1" : "w-full"}>
                        <div className="break-words text-xs font-semibold text-foreground">{f.name}</div>
                        <div className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{f.value || "​"}</div>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="mt-1 text-[10px] text-muted-foreground">Today at 12:00 PM</div>
              </div>
              {b.bottom.map((u, i) => (
                <img key={`bt${i}`} src={u} alt="" className="max-h-56 w-full rounded object-cover" />
              ))}
              {b.button && (
                <span className="inline-block rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{b.button}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
