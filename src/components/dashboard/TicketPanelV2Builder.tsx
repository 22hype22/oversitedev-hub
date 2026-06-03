import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DiscordMarkdownTextarea } from "@/components/ui/discord-markdown-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  LayoutPanelTop,
  Images,
  Minus,
  Box,
  MousePointerClick,
  Info,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { GuildChannelPicker } from "./GuildChannelPicker";
import { useBotChannels, type BotGuild, type BotChannel } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { cn } from "@/lib/utils";

/**
 * Component V2 message builder.
 *
 * Shown in place of SayCommandBuilder for bots running the V2 engine.
 * Left column: stack of composable component blocks.
 * Right column: live Discord-style preview.
 */

type V2Text = { id: string; type: "text"; text: string };
type V2SectionButton =
  | { label: string; url: string }
  | { label: string; category: string }
  | { label: string; channel_id: string };
type V2Section = {
  id: string;
  type: "section";
  title: string;
  text: string;
  thumbnailUrl: string;
  button: V2SectionButton | null;
};

const CategoryNamesContext = createContext<string[]>([]);
const ChannelsContext = createContext<BotChannel[]>([]);
const isCategoryButton = (
  b: V2SectionButton | null | undefined,
): b is { label: string; category: string } =>
  !!b && "category" in b;
const isChannelButton = (
  b: V2SectionButton | null | undefined,
): b is { label: string; channel_id: string } =>
  !!b && "channel_id" in b;
type V2Gallery = { id: string; type: "gallery"; images: string[] };
type V2Separator = {
  id: string;
  type: "separator";
  divider: boolean;
  spacing: "small" | "large";
};
type V2ButtonStyle = "primary" | "secondary" | "success" | "danger" | "link";
type V2ButtonRowButton =
  | { id: string; label: string; url: string; style?: V2ButtonStyle }
  | { id: string; label: string; category: string; style?: V2ButtonStyle }
  | { id: string; label: string; channel_id: string; style?: V2ButtonStyle };
type V2ButtonRow = {
  id: string;
  type: "buttonRow";
  buttons: V2ButtonRowButton[];
};
type V2SelectMenuOption =
  | { label: string; description?: string; url: string }
  | { label: string; description?: string; category: string }
  | { label: string; description?: string; channel_id: string };
type V2SelectMenu = {
  id: string;
  type: "select_menu";
  placeholder: string;
  options: V2SelectMenuOption[];
};
const isCategoryButton2 = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; category: string; style?: V2ButtonStyle } => "category" in b;
const isChannelButton2 = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; channel_id: string; style?: V2ButtonStyle } => "channel_id" in b;
const isCategoryOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; category: string } => "category" in o;
const isChannelOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; channel_id: string } => "channel_id" in o;


const BUTTON_STYLE_OPTIONS: { value: V2ButtonStyle; label: string }[] = [
  { value: "primary", label: "Purple" },
  { value: "secondary", label: "Grey" },
  { value: "success", label: "Green" },
  { value: "danger", label: "Red" },
];

const BUTTON_STYLE_PREVIEW: Record<V2ButtonStyle, string> = {
  primary: "bg-[#5865F2] hover:bg-[#4752C4] text-white",
  secondary: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
  success: "bg-[#248046] hover:bg-[#1a6334] text-white",
  danger: "bg-[#da373c] hover:bg-[#a12d32] text-white",
  link: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
};

type V2Container = {
  id: string;
  type: "container";
  accentColor: string;
  children: V2Leaf[];
};
type V2Leaf = V2Text | V2Section | V2Gallery | V2Separator | V2ButtonRow | V2SelectMenu;
export type V2Item = V2Leaf | V2Container;

const uid = () => crypto.randomUUID();

/**
 * Discord V2 messages require top-level components to be either:
 *  - only TextDisplay/Separator, or
 *  - wrapped in Container(s) (containers cannot be nested).
 * Mixed structures (e.g. a bare Section or Gallery at top level, or a
 * Container alongside loose leaves) get rejected by Discord.
 *
 * This normalizer groups consecutive top-level leaves into Containers,
 * leaving existing Containers intact and preserving order.
 */
export function normalizeV2Items(items: V2Item[]): V2Item[] {
  const out: V2Item[] = [];
  let buffer: V2Leaf[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    out.push({
      id: uid(),
      type: "container",
      accentColor: "#5865F2",
      children: buffer,
    });
    buffer = [];
  };
  for (const it of items) {
    if (it.type === "container") {
      flush();
      out.push(it);
    } else {
      buffer.push(it);
    }
  }
  flush();
  return out;
}

const newItem = (type: V2Item["type"]): V2Item => {
  switch (type) {
    case "text":
      return { id: uid(), type, text: "Hello **world** — this is a text display." };
    case "section":
      return {
        id: uid(),
        type,
        title: "",
        text: "Section body text. Supports **markdown**.",
        thumbnailUrl: "",
        button: null,
      };
    case "gallery":
      return { id: uid(), type, images: [""] };
    case "separator":
      return { id: uid(), type, divider: true, spacing: "small" };
    case "buttonRow":
      return {
        id: uid(),
        type,
        buttons: [
          { id: uid(), label: "Click me", url: "https://example.com", style: "primary" },
        ],
      };

    case "select_menu":
      return {
        id: uid(),
        type,
        placeholder: "Choose an option…",
        options: [{ label: "Option 1", url: "" }],
      };
    case "container":
      return { id: uid(), type, accentColor: "#5865F2", children: [] };
  }
};

const ADD_OPTIONS: { type: V2Item["type"]; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "text", label: "Add Text Display", Icon: Type },
  { type: "section", label: "Add Section", Icon: LayoutPanelTop },
  { type: "gallery", label: "Add Media Gallery", Icon: Images },
  { type: "separator", label: "Add Separator", Icon: Minus },
  { type: "container", label: "Add Container", Icon: Box },
  { type: "buttonRow", label: "Add Button Row", Icon: MousePointerClick },
  { type: "select_menu", label: "Add Select Menu", Icon: ChevronsUpDown },
];

const LEAF_OPTIONS = ADD_OPTIONS.filter((o) => o.type !== "container");

export type TicketPanelV2BuilderHandle = {
  send: () => Promise<boolean>;
  getItems: () => V2Item[];
  setItems: (items: V2Item[]) => void;
};

export type TicketPanelV2BuilderProps = {
  botId?: string;
  botName: string;
  botAvatarUrl?: string | null;
  /** When true, hides the channel picker and disables send(). Parent owns persistence. */
  embedded?: boolean;
  /** Optional initial items for embedded mode. */
  initialItems?: V2Item[];
  /** Called whenever the internal items state changes (used for parent-side persistence). */
  onItemsChange?: (items: V2Item[]) => void;
  /** Extra preview content rendered after the user's components (e.g. a forced Open Ticket button). */
  previewExtras?: React.ReactNode;
  /** Optional banner shown above the editor stack (e.g. "Open Ticket button is added automatically"). */
  editorNotice?: React.ReactNode;
  /** Names of ticket categories — populates the Category dropdown in Section buttons. */
  categoryNames?: string[];
};

export const TicketPanelV2Builder = forwardRef<
  TicketPanelV2BuilderHandle,
  TicketPanelV2BuilderProps
>(function TicketPanelV2Builder(
  { botId, botName, botAvatarUrl, embedded = false, initialItems, onItemsChange, previewExtras, editorNotice, categoryNames = [] },
  ref,
) {
  const { guild: activeGuild, setGuild: setActiveGuild } = useActiveGuild();
  const [guild, setGuildLocal] = useState<BotGuild | null>(activeGuild);
  const setGuild = (g: BotGuild | null) => {
    setGuildLocal(g);
    if (g) setActiveGuild(g);
  };
  const [channel, setChannel] = useState<BotChannel | null>(null);
  const effectiveGuildId = guild?.guild_id ?? activeGuild?.guild_id ?? undefined;
  const { channels: guildChannels } = useBotChannels(botId, effectiveGuildId);

  const [items, setItems] = useState<V2Item[]>(
    initialItems && initialItems.length > 0
      ? initialItems
      : [
          {
            id: uid(),
            type: "container",
            accentColor: "#5865F2",
            children: [newItem("text") as V2Leaf],
          },
        ],
  );

  // Notify parent of items changes (skip the very first synchronous emission to
  // avoid clobbering parent-side hydrated state with the empty default).
  const firstItemsEmit = useRef(true);
  useEffect(() => {
    if (firstItemsEmit.current) {
      firstItemsEmit.current = false;
      return;
    }
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  const addItem = (_type: V2Item["type"]) =>
    setItems((prev) => [...prev, newItem("container")]);

  const updateItem = (id: string, patch: Partial<V2Item>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? ({ ...it, ...patch } as V2Item) : it)),
    );

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const moveItem = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const out = prev.slice();
      [out[idx], out[next]] = [out[next], out[idx]];
      return out;
    });

  // ---------- container children helpers ----------
  const addChild = (containerId: string, type: V2Leaf["type"]) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === containerId && it.type === "container"
          ? { ...it, children: [...it.children, newItem(type) as V2Leaf] }
          : it,
      ),
    );
  const updateChild = (containerId: string, childId: string, patch: Partial<V2Leaf>) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === containerId && it.type === "container"
          ? {
              ...it,
              children: it.children.map((c) =>
                c.id === childId ? ({ ...c, ...patch } as V2Leaf) : c,
              ),
            }
          : it,
      ),
    );
  const removeChild = (containerId: string, childId: string) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === containerId && it.type === "container"
          ? { ...it, children: it.children.filter((c) => c.id !== childId) }
          : it,
      ),
    );
  const moveChild = (containerId: string, childId: string, dir: -1 | 1) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== containerId || it.type !== "container") return it;
        const idx = it.children.findIndex((c) => c.id === childId);
        if (idx < 0) return it;
        const next = idx + dir;
        if (next < 0 || next >= it.children.length) return it;
        const children = it.children.slice();
        [children[idx], children[next]] = [children[next], children[idx]];
        return { ...it, children };
      }),
    );

  // ---------- send ----------
  const send = async (): Promise<boolean> => {
    if (embedded) return false;
    if (!botId) {
      toast.error("Bot not ready yet.");
      return false;
    }
    if (!channel?.channel_id) {
      toast.error("Pick a channel to post in.");
      return false;
    }
    if (items.length === 0) {
      toast.error("Add at least one component first.");
      return false;
    }
    try {
      const payload = {
        channel_id: channel.channel_id,
        components_v2: normalizeV2Items(items),
      };
      const { data, error } = await supabase.rpc("enqueue_post_message", {
        _bot_id: botId,
        _payload: payload as any,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        toast.error(result?.error || "Could not queue the message.");
        return false;
      }
      toast.success("Message queued — your bot will post it shortly.");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message.");
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    send,
    getItems: () => normalizeV2Items(items),
    setItems: (next: V2Item[]) => setItems(next),
  }));

  return (
    <CategoryNamesContext.Provider value={categoryNames}>
    <ChannelsContext.Provider value={guildChannels}>

    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(440px,500px)] gap-6">
      {/* Editor */}
      <div className="space-y-3">
        {editorNotice}
        {embedded ? null : botId ? (
          <GuildChannelPicker
            botId={botId}
            guildId={guild?.guild_id ?? null}
            channelId={channel?.channel_id ?? null}
            onGuildChange={setGuild}
            onChannelChange={setChannel}
            guildLabel="Server to post in"
            channelLabel="Channel"
          />
        ) : (
          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Channel picker appears once your bot is online.</span>
            </div>
          </div>
        )}


        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>All components must be inside a Container for the ticket panel to work.</span>
        </div>

        <div className="space-y-2">
          {items.map((it, i) => (
            <ItemBlock
              key={it.id}
              item={it}
              index={i}
              total={items.length}
              onUpdate={(patch) => updateItem(it.id, patch)}
              onRemove={() => removeItem(it.id)}
              onMove={(dir) => moveItem(it.id, dir)}
              addChild={(t) => addChild(it.id, t)}
              updateChild={(cid, p) => updateChild(it.id, cid, p)}
              removeChild={(cid) => removeChild(it.id, cid)}
              moveChild={(cid, d) => moveChild(it.id, cid, d)}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => addItem("container")}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Container
        </Button>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-border bg-[#313338] p-4 text-white min-h-[300px]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
            {botAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-white">{botName || "Bot"}</span>
              <span className="text-[10px] bg-[#5865F2] text-white px-1 rounded">APP</span>
              <span className="text-[11px] text-[#949ba4]">Today at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <div className="mt-1 space-y-2">
              {items.length === 0 && !previewExtras ? (
                <div className="text-xs text-[#949ba4] italic">No components yet — add one to see a preview.</div>
              ) : (
                items.map((it) => <PreviewItem key={it.id} item={it} />)
              )}
              {previewExtras}
            </div>

          </div>
        </div>
      </div>
    </div>
    </ChannelsContext.Provider>
    </CategoryNamesContext.Provider>

  );
});

// ============================================================
// Add component menu
// ============================================================
function AddComponentMenu({
  onAdd,
  leafOnly = false,
}: {
  onAdd: (type: V2Item["type"]) => void;
  leafOnly?: boolean;
}) {
  const opts = leafOnly ? LEAF_OPTIONS : ADD_OPTIONS;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Component
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {opts.map((o) => (
          <DropdownMenuItem key={o.type} onSelect={() => onAdd(o.type)}>
            <o.Icon className="h-4 w-4 mr-2" />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// Item block (editor side)
// ============================================================
function ItemBlock({
  item,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
  addChild,
  updateChild,
  removeChild,
  moveChild,
}: {
  item: V2Item;
  index: number;
  total: number;
  onUpdate: (patch: Partial<V2Item>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  addChild: (t: V2Leaf["type"]) => void;
  updateChild: (cid: string, p: Partial<V2Leaf>) => void;
  removeChild: (cid: string) => void;
  moveChild: (cid: string, d: -1 | 1) => void;
}) {
  const label = labelFor(item.type);
  return (
    <div className="rounded-lg border border-border bg-card/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="text-xs font-semibold text-foreground">{label}</div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <ItemEditor item={item} onUpdate={onUpdate} />
        {item.type === "container" && (
          <div className="mt-3 space-y-2">
            <Label className="text-xs">Container children</Label>
            <div
              className="space-y-2 rounded-md border-l-4 pl-3 py-2 bg-muted/30"
              style={{ borderLeftColor: item.accentColor }}
            >
              {item.children.length === 0 && (
                <div className="text-xs text-muted-foreground italic">
                  No components in this container yet.
                </div>
              )}
              {item.children.map((c, i) => (
                <div key={c.id} className="rounded border border-border bg-background/50">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-border/60">
                    <span className="text-[11px] font-medium text-muted-foreground">{labelFor(c.type)}</span>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => moveChild(c.id, -1)}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === item.children.length - 1} onClick={() => moveChild(c.id, 1)}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeChild(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-2">
                    <ItemEditor item={c} onUpdate={(p) => updateChild(c.id, p as Partial<V2Leaf>)} />
                  </div>
                </div>
              ))}
              <AddComponentMenu leafOnly onAdd={(t) => addChild(t as V2Leaf["type"])} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function labelFor(t: V2Item["type"]): string {
  switch (t) {
    case "text": return "Text Display";
    case "section": return "Section";
    case "gallery": return "Media Gallery";
    case "separator": return "Separator";
    case "container": return "Container";
    case "buttonRow": return "Button Row";
    case "select_menu": return "Select Menu";
  }
}

// ============================================================
// Per-type editors
// ============================================================
function ItemEditor({ item, onUpdate }: { item: V2Item; onUpdate: (p: Partial<V2Item>) => void }) {
  if (item.type === "text") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Markdown text</Label>
        <DiscordMarkdownTextarea
          value={item.text}
          onValueChange={(v) => onUpdate({ text: v } as Partial<V2Item>)}
          rows={3}
          placeholder="Supports **markdown**."
        />
      </div>
    );
  }
  if (item.type === "section") {
    return (
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input
            value={item.title}
            onChange={(e) => onUpdate({ title: e.target.value } as Partial<V2Item>)}
            placeholder="Optional bold title"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Markdown text</Label>
          <DiscordMarkdownTextarea
            value={item.text}
            onValueChange={(v) => onUpdate({ text: v } as Partial<V2Item>)}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Thumbnail URL (optional)</Label>
          <Input
            value={item.thumbnailUrl}
            onChange={(e) => onUpdate({ thumbnailUrl: e.target.value } as Partial<V2Item>)}
            placeholder="https://…"
          />
        </div>
        <SectionButtonEditor
          button={item.button}
          onChange={(b) => onUpdate({ button: b } as Partial<V2Item>)}
        />
      </div>
    );
  }
  if (item.type === "gallery") {
    const images = item.images;
    return (
      <div className="space-y-2">
        <Label className="text-xs">Image URLs (up to 4)</Label>
        {images.map((url, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={url}
              onChange={(e) => {
                const next = images.slice();
                next[i] = e.target.value;
                onUpdate({ images: next } as Partial<V2Item>);
              }}
              placeholder={`Image ${i + 1} URL`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onUpdate({ images: images.filter((_, j) => j !== i) } as Partial<V2Item>)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {images.length < 4 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUpdate({ images: [...images, ""] } as Partial<V2Item>)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add image
          </Button>
        )}
      </div>
    );
  }
  if (item.type === "separator") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show divider line</Label>
          <Switch
            checked={item.divider}
            onCheckedChange={(c) => onUpdate({ divider: c } as Partial<V2Item>)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Spacing</Label>
          <Select
            value={item.spacing}
            onValueChange={(v) => onUpdate({ spacing: v as "small" | "large" } as Partial<V2Item>)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (item.type === "container") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Accent color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={item.accentColor}
            onChange={(e) => onUpdate({ accentColor: e.target.value } as Partial<V2Item>)}
            className="h-9 w-12 rounded border border-border bg-background"
          />
          <Input
            value={item.accentColor}
            onChange={(e) => onUpdate({ accentColor: e.target.value } as Partial<V2Item>)}
            className="font-mono text-xs"
          />
        </div>
      </div>
    );
  }
  if (item.type === "buttonRow") {
    const buttons = item.buttons;
    const categoryNames = useContext(CategoryNamesContext);
    return (
      <div className="space-y-3">
        <Label className="text-xs">Buttons (up to 5)</Label>
        {buttons.map((b, i) => {
          const mode: "link" | "category" = isCategoryButton2(b) ? "category" : "link";
          const style: V2ButtonStyle = b.style ?? "primary";
          const update = (next: V2ButtonRowButton) => {
            const list = buttons.slice();
            list[i] = next;
            onUpdate({ buttons: list } as Partial<V2Item>);
          };
          return (
            <div key={b.id} className="space-y-2 rounded border border-border bg-background/40 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`btn-mode-${b.id}`}
                      checked={mode === "link"}
                      onChange={() => update({ id: b.id, label: b.label, url: "", style })}
                    />
                    Link
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`btn-mode-${b.id}`}
                      checked={mode === "category"}
                      onChange={() => update({ id: b.id, label: b.label, category: categoryNames[0] ?? "", style })}
                    />
                    Category
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={style}
                    onValueChange={(v) =>
                      update(
                        isCategoryButton2(b)
                          ? { id: b.id, label: b.label, category: b.category, style: v as V2ButtonStyle }
                          : { id: b.id, label: b.label, url: b.url, style: v as V2ButtonStyle },
                      )
                    }
                  >
                    <SelectTrigger className="h-7 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUTTON_STYLE_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onUpdate({ buttons: buttons.filter((_, j) => j !== i) } as Partial<V2Item>)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Label"
                  value={b.label}
                  onChange={(e) =>
                    update(
                      isCategoryButton2(b)
                        ? { id: b.id, label: e.target.value, category: b.category, style }
                        : { id: b.id, label: e.target.value, url: b.url, style },
                    )
                  }
                />
                {mode === "link" ? (
                  <Input
                    placeholder="URL"
                    value={(b as { url: string }).url}
                    onChange={(e) => update({ id: b.id, label: b.label, url: e.target.value, style })}
                  />
                ) : (
                  <Select
                    value={(b as { category: string }).category || ""}
                    onValueChange={(v) => update({ id: b.id, label: b.label, category: v, style })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={categoryNames.length === 0 ? "No categories yet" : "Pick a category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryNames.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          );
        })}
        {buttons.length < 5 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdate({
                buttons: [
                  ...buttons,
                  { id: uid(), label: "Button", url: "", style: "primary" },
                ],
              } as Partial<V2Item>)
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add button
          </Button>
        )}
      </div>

    );
  }
  if (item.type === "select_menu") {
    const options = item.options;
    const categoryNames = useContext(CategoryNamesContext);
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={item.placeholder}
            onChange={(e) => onUpdate({ placeholder: e.target.value } as Partial<V2Item>)}
            placeholder="Choose an option…"
          />
        </div>
        <Label className="text-xs">Options (up to 25)</Label>
        {options.map((o, i) => {
          const mode: "link" | "category" = isCategoryOption(o) ? "category" : "link";
          const update = (next: V2SelectMenuOption) => {
            const list = options.slice();
            list[i] = next;
            onUpdate({ options: list } as Partial<V2Item>);
          };
          return (
            <div key={i} className="space-y-2 rounded border border-border bg-background/40 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`opt-mode-${i}`}
                      checked={mode === "link"}
                      onChange={() => update({ label: o.label, url: "" })}
                    />
                    Link
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`opt-mode-${i}`}
                      checked={mode === "category"}
                      onChange={() => update({ label: o.label, category: categoryNames[0] ?? "" })}
                    />
                    Category
                  </label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onUpdate({ options: options.filter((_, j) => j !== i) } as Partial<V2Item>)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Label"
                  value={o.label}
                  onChange={(e) =>
                    update(
                      isCategoryOption(o)
                        ? { label: e.target.value, category: o.category }
                        : { label: e.target.value, url: o.url },
                    )
                  }
                />
                {mode === "link" ? (
                  <Input
                    placeholder="URL"
                    value={(o as { url: string }).url}
                    onChange={(e) => update({ label: o.label, url: e.target.value })}
                  />
                ) : (
                  <Select
                    value={(o as { category: string }).category || ""}
                    onValueChange={(v) => update({ label: o.label, category: v })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={categoryNames.length === 0 ? "No categories yet" : "Pick a category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryNames.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          );
        })}
        {options.length < 25 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdate({
                options: [
                  ...options,
                  { label: `Option ${options.length + 1}`, url: "" },
                ],
              } as Partial<V2Item>)
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add option
          </Button>
        )}
      </div>
    );
  }
  return null;
}

// ============================================================
// Section button editor (Link / Category)
// ============================================================
function SectionButtonEditor({
  button,
  onChange,
}: {
  button: V2SectionButton | null;
  onChange: (b: V2SectionButton | null) => void;
}) {
  const categoryNames = useContext(CategoryNamesContext);
  const mode: "link" | "category" = isCategoryButton(button) ? "category" : "link";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Button (optional)</Label>
        <Switch
          checked={!!button}
          onCheckedChange={(c) =>
            onChange(c ? { label: "Click me", url: "https://example.com" } : null)
          }
        />
      </div>
      {button && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`section-btn-mode-${Math.random()}`}
                checked={mode === "link"}
                onChange={() =>
                  onChange({ label: button.label, url: "https://example.com" })
                }
              />
              Link
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`section-btn-mode-${Math.random()}`}
                checked={mode === "category"}
                onChange={() =>
                  onChange({ label: button.label, category: categoryNames[0] ?? "" })
                }
              />
              Category
            </label>
          </div>
          {mode === "link" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Label"
                value={button.label}
                onChange={(e) =>
                  onChange({ ...(button as { label: string; url: string }), label: e.target.value })
                }
              />
              <Input
                placeholder="URL"
                value={(button as { label: string; url: string }).url}
                onChange={(e) =>
                  onChange({ ...(button as { label: string; url: string }), url: e.target.value })
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Label"
                value={button.label}
                onChange={(e) =>
                  onChange({ ...(button as { label: string; category: string }), label: e.target.value })
                }
              />
              <Select
                value={(button as { label: string; category: string }).category || ""}
                onValueChange={(v) =>
                  onChange({ ...(button as { label: string; category: string }), category: v })
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={categoryNames.length === 0 ? "No categories yet" : "Pick a category"} />
                </SelectTrigger>
                <SelectContent>
                  {categoryNames.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Preview
// ============================================================
function PreviewItem({ item }: { item: V2Item }) {
  if (item.type === "text") {
    return <PreviewMarkdown text={item.text} />;
  }
  if (item.type === "section") {
    return (
      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 space-y-1">
          <PreviewMarkdown text={item.title ? `**${item.title}**\n${item.text}` : item.text} />
          {item.button && (
            isCategoryButton(item.button) ? (
              <span className="inline-flex items-center px-3 py-1.5 mt-1 text-xs font-medium rounded bg-[#4e5058] text-white">
                {item.button.label || "Button"}
              </span>
            ) : (
              <a
                href={item.button.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-1.5 mt-1 text-xs font-medium rounded bg-[#4e5058] hover:bg-[#6d6f78] text-white"
              >
                {item.button.label || "Button"}
              </a>
            )
          )}
        </div>
        {item.thumbnailUrl && (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-16 w-16 rounded object-cover shrink-0"
          />
        )}
      </div>
    );
  }
  if (item.type === "gallery") {
    const imgs = item.images.filter((u) => u.trim());
    if (imgs.length === 0)
      return <div className="text-xs text-[#949ba4] italic">[empty gallery]</div>;
    return (
      <div className={cn("grid gap-1 rounded overflow-hidden", imgs.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {imgs.slice(0, 4).map((u, i) => (
          <img key={i} src={u} alt="" className="w-full h-auto object-cover" />
        ))}
      </div>
    );
  }
  if (item.type === "separator") {
    return (
      <div
        className={cn(
          "w-full",
          item.spacing === "small" ? "py-1" : "py-3",
        )}
      >
        {item.divider && <div className="h-px bg-white/10" />}
      </div>
    );
  }
  if (item.type === "buttonRow") {
    return (
      <div className="flex flex-wrap gap-2">
        {item.buttons.map((b) => {
          const styleClass = BUTTON_STYLE_PREVIEW[b.style ?? "primary"];
          return isCategoryButton2(b) ? (
            <span
              key={b.id}
              className={cn("inline-flex items-center px-3 py-1.5 text-xs font-medium rounded", styleClass)}
            >
              {b.label || "Button"}
            </span>
          ) : (
            <a
              key={b.id}
              href={b.url || "#"}
              target="_blank"
              rel="noreferrer"
              className={cn("inline-flex items-center px-3 py-1.5 text-xs font-medium rounded", styleClass)}
            >
              {b.label || "Button"}
            </a>
          );
        })}
      </div>

    );
  }
  if (item.type === "container") {
    return (
      <div
        className="rounded border-l-4 bg-[#2b2d31] p-3 space-y-2"
        style={{ borderLeftColor: item.accentColor }}
      >
        {item.children.length === 0 ? (
          <div className="text-xs text-[#949ba4] italic">[empty container]</div>
        ) : (
          item.children.map((c) => <PreviewItem key={c.id} item={c} />)
        )}
      </div>
    );
  }
  if (item.type === "select_menu") {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between rounded bg-[#1e1f22] border border-[#1e1f22] px-3 py-2 text-sm text-[#949ba4]">
          <span className="truncate">{item.placeholder || "Choose an option…"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-70" />
        </div>
      </div>
    );
  }
  return null;
}

// Very light markdown renderer for preview (bold, italic, code, links).
function PreviewMarkdown({ text }: { text: string }) {
  const html = useMemo(() => renderDiscordMarkdown(text), [text]);
  return (
    <div
      className="text-sm text-[#dbdee1] whitespace-pre-wrap break-words"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderDiscordMarkdown(src: string): string {
  let s = escapeHtml(src);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/~~(.+?)~~/g, "<s>$1</s>");
  s = s.replace(/`([^`]+?)`/g, '<code class="bg-black/30 px-1 rounded text-[12px]">$1</code>');
  s = s.replace(
    /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="text-[#00a8fc] hover:underline">$1</a>',
  );
  return s;
}
