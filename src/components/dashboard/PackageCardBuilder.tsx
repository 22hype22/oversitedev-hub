// PackageCardBuilder — a component-card builder for the Packages embed card,
// styled like MessagesV2Builder: add/remove/reorder component cards on the left,
// a live Discord-style preview on the right. Because the card is a Discord embed
// (the only thing that can do side-by-side "inline" fields), the components here
// map to embed pieces — Title, Text, Fields, Image, Color, Button.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";

export type PkgField = { name: string; value: string; inline: boolean };
export type PkgComponent =
  | { id: string; type: "title"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "fields"; fields: PkgField[] }
  | { id: string; type: "image"; url: string }
  | { id: string; type: "color"; hex: string }
  | { id: string; type: "button"; label: string };

const TYPE_LABEL: Record<PkgComponent["type"], string> = {
  title: "Title",
  text: "Text",
  fields: "Fields (side by side)",
  image: "Image",
  color: "Color",
  button: "Button",
};

let _idc = 0;
const newId = () => `pc_${Date.now().toString(36)}_${_idc++}`;

function make(type: PkgComponent["type"]): PkgComponent {
  switch (type) {
    case "title": return { id: newId(), type, text: "" };
    case "text": return { id: newId(), type, text: "" };
    case "fields": return { id: newId(), type, fields: [{ name: "", value: "", inline: true }] };
    case "image": return { id: newId(), type, url: "" };
    case "color": return { id: newId(), type, hex: "#5865F2" };
    case "button": return { id: newId(), type, label: "Claim" };
  }
}

// ---- assemble a preview model from the component list ----
export function assemblePackageCard(components: PkgComponent[]) {
  let title = "";
  const textParts: string[] = [];
  let color = "";
  let image = "";
  let button = "";
  const fields: PkgField[] = [];
  for (const c of components) {
    if (c.type === "title" && c.text) title = c.text;
    else if (c.type === "text" && c.text) textParts.push(c.text);
    else if (c.type === "color" && c.hex) color = c.hex;
    else if (c.type === "image" && c.url) image = c.url;
    else if (c.type === "button" && c.label) button = c.label;
    else if (c.type === "fields") for (const f of c.fields) if (f.name) fields.push(f);
  }
  return { title, description: textParts.join("\n\n"), color, image, button, fields };
}

function PreviewCard({ components, botName, botAvatarUrl }: { components: PkgComponent[]; botName?: string; botAvatarUrl?: string }) {
  const card = assemblePackageCard(components);
  const colorRaw = card.color.trim().replace(/^#/, "");
  const bar = /^[0-9a-fA-F]{6}$/.test(colorRaw) ? `#${colorRaw}` : "hsl(var(--muted-foreground))";
  const empty = !card.title && !card.description && card.fields.length === 0 && !card.image;

  // Group inline fields (max 3 across); full fields on their own row.
  const rows: PkgField[][] = [];
  let run: PkgField[] = [];
  for (const f of card.fields) {
    if (f.inline) { run.push(f); if (run.length === 3) { rows.push(run); run = []; } }
    else { if (run.length) { rows.push(run); run = []; } rows.push([f]); }
  }
  if (run.length) rows.push(run);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
          {botAvatarUrl ? <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{botName || "Bot"}</span>
            <span className="rounded bg-primary px-1 text-[10px] font-semibold uppercase text-primary-foreground">App</span>
          </div>
          {empty ? (
            <p className="text-xs text-muted-foreground">Add components to build the card.</p>
          ) : (
            <div className="rounded-md border border-border bg-background/40 p-3 pl-4 relative overflow-hidden">
              <span className="absolute left-0 top-0 h-full w-1" style={{ background: bar }} />
              {card.title && <p className="mb-1 break-words font-semibold text-foreground">{card.title}</p>}
              {card.description && <p className="mb-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{card.description}</p>}
              {rows.map((row, i) => (
                <div key={i} className="mb-2 flex gap-4">
                  {row.map((f, j) => (
                    <div key={j} className={f.inline ? "min-w-0 flex-1" : "w-full"}>
                      <p className="break-words text-xs font-semibold text-foreground">{f.name}</p>
                      <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{f.value || "​"}</p>
                    </div>
                  ))}
                </div>
              ))}
              {card.image && <img src={card.image} alt="" className="mt-1 max-h-48 max-w-full rounded" />}
              {card.button && (
                <div className="mt-2">
                  <span className="inline-block rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{card.button}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldsRows({ fields, onChange }: { fields: PkgField[]; onChange: (f: PkgField[]) => void }) {
  const patch = (i: number, p: Partial<PkgField>) => onChange(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="rounded-md border border-border bg-background/50 p-2">
          <div className="flex gap-2">
            <Input className="h-8" placeholder="Name (e.g. Packer)" value={f.name} onChange={(e) => patch(i, { name: e.target.value })} />
            <Input className="h-8" placeholder="Value (e.g. @user)" value={f.value} onChange={(e) => patch(i, { value: e.target.value })} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={f.inline} onCheckedChange={(c) => patch(i, { inline: c })} />
              Inline (side by side)
            </label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ChevronDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onChange(fields.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => onChange([...fields, { name: "", value: "", inline: true }])}>
        <Plus className="h-4 w-4" /> Add field
      </Button>
    </div>
  );
}

function ComponentCard({ comp, index, count, onPatch, onMove, onRemove }: {
  comp: PkgComponent;
  index: number;
  count: number;
  onPatch: (p: Partial<PkgComponent>) => void;
  onMove: (d: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{TYPE_LABEL[comp.type]}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === count - 1} onClick={() => onMove(1)}><ChevronDown className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {comp.type === "title" && (
        <Input placeholder="Card title" value={comp.text} onChange={(e) => onPatch({ text: e.target.value })} />
      )}
      {comp.type === "text" && (
        <Textarea placeholder="Text — markdown and masked links [Text](<https://…>) work." value={comp.text} onChange={(e) => onPatch({ text: e.target.value })} />
      )}
      {comp.type === "fields" && (
        <FieldsRows fields={comp.fields} onChange={(fields) => onPatch({ fields })} />
      )}
      {comp.type === "image" && (
        <Input placeholder="https://…/image.png" value={comp.url} onChange={(e) => onPatch({ url: e.target.value })} />
      )}
      {comp.type === "color" && (
        <div className="flex items-center gap-2">
          <input type="color" className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(comp.hex) ? comp.hex : "#5865F2"} onChange={(e) => onPatch({ hex: e.target.value })} />
          <Input className="h-8 w-32" placeholder="#5865F2" value={comp.hex} onChange={(e) => onPatch({ hex: e.target.value })} />
          <span className="text-xs text-muted-foreground">Left color bar</span>
        </div>
      )}
      {comp.type === "button" && (
        <Input placeholder="Button label (e.g. Claim Package)" value={comp.label} onChange={(e) => onPatch({ label: e.target.value })} />
      )}
    </div>
  );
}

export function PackageCardBuilder({ value, onChange, botName, botAvatarUrl }: {
  value: PkgComponent[];
  onChange: (v: PkgComponent[]) => void;
  botName?: string;
  botAvatarUrl?: string;
}) {
  const [items, setItems] = useState<PkgComponent[]>(() => (Array.isArray(value) ? value : []));
  useEffect(() => {
    // Re-sync if the config loads/changes from outside.
    if (JSON.stringify(items) !== JSON.stringify(value)) setItems(Array.isArray(value) ? value : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const push = (next: PkgComponent[]) => { setItems(next); onChange(next); };
  const patch = (i: number, p: Partial<PkgComponent>) => push(items.map((c, idx) => (idx === i ? ({ ...c, ...p } as PkgComponent) : c)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    push(next);
  };

  const TYPES: PkgComponent["type"][] = ["title", "text", "fields", "image", "color", "button"];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        {items.map((c, i) => (
          <ComponentCard
            key={c.id}
            comp={c}
            index={i}
            count={items.length}
            onPatch={(p) => patch(i, p)}
            onMove={(d) => move(i, d)}
            onRemove={() => push(items.filter((_, idx) => idx !== i))}
          />
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" /> Add Component
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {TYPES.map((t) => (
              <DropdownMenuItem key={t} onClick={() => push([...items, make(t)])}>
                {TYPE_LABEL[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="lg:sticky lg:top-2 self-start">
        <PreviewCard components={items} botName={botName} botAvatarUrl={botAvatarUrl} />
      </div>
    </div>
  );
}
