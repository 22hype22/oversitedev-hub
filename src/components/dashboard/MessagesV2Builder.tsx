import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DiscordMarkdownTextarea } from "@/components/ui/discord-markdown-textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Columns3,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { GuildChannelPicker } from "./GuildChannelPicker";
import { useBotChannels, type BotGuild, type BotChannel } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { cn } from "@/lib/utils";
import { safeUrl, safeImageSrc } from "@/lib/sanitize";

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
const BotInfoContext = createContext<{ botId?: string; botName: string; botAvatarUrl?: string | null }>({ botName: "Bot" });
// True inside the Giveaway builder — swaps the button kinds for a "Counter"
// (enter) button and hides ticket/channel kinds that don't apply.
const GiveawayContext = createContext<boolean>(false);

const isChannelSectionButton = (
  b: V2SectionButton | null | undefined,
): b is { label: string; channel_id: string } => !!b && "channel_id" in b;

// A "Purchase" card: title + price on the left, a Purchase button on the right.
// Clicking it opens the package purchase flow (payment picker, gift/recipient,
// MSA agreement). Delivery reuses the bot's Gamepass / Roblox Select / Stripe.
type V2Purchase = {
  id: string;
  type: "purchase";
  title: string;
  price: string;
  button_label: string;
  methods: string[]; // any of "gamepass" | "select" | "stripe"
  msa_url: string;
};

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
  | { id: string; label: string; channel_id: string; style?: V2ButtonStyle }
  | { id: string; label: string; ticket: string; category_name?: string; access_roles?: string; open_components?: V2Item[]; style?: V2ButtonStyle }
  | { id: string; label: string; form: string; category_name?: string; access_roles?: string; open_components?: V2Item[]; style?: V2ButtonStyle }
  | { id: string; label: string; ephemeral: string; open_components?: V2Item[]; style?: V2ButtonStyle }
  | { id: string; label: string; counter: true; style?: V2ButtonStyle }
  | { id: string; label: string; buyrobux: true; style?: V2ButtonStyle }
  | { id: string; label: string; notify_roles: string; style?: V2ButtonStyle }
  | { id: string; label: string; orderstatus: true; style?: V2ButtonStyle }
  | { id: string; label: string; disabled: true; style?: V2ButtonStyle };

type V2ButtonRow = {
  id: string;
  type: "buttonRow";
  buttons: V2ButtonRowButton[];
};

type V2SelectMenuOption =
  | { label: string; description?: string; url: string }
  | { label: string; description?: string; category: string }
  | { label: string; description?: string; channel_id: string }
  | { label: string; description?: string; display: true }
  | { label: string; description?: string; ticket: string; category_name?: string; access_roles?: string; open_components?: V2Item[] }
  | { label: string; description?: string; form: string; category_name?: string; access_roles?: string; open_components?: V2Item[] }
  | { label: string; description?: string; ephemeral: string; open_components?: V2Item[] };

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
const isDisplayButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; disabled: true; style?: V2ButtonStyle } => "disabled" in b;
const isCounterButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; counter: true; style?: V2ButtonStyle } => "counter" in b;
const isBuyRobuxButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; buyrobux: true; style?: V2ButtonStyle } => "buyrobux" in b;
const isNotifyButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; notify_roles: string; style?: V2ButtonStyle } => "notify_roles" in b;
const isOrderStatusButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; orderstatus: true; style?: V2ButtonStyle } => "orderstatus" in b;
const isTicketButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; ticket: string; style?: V2ButtonStyle } => "ticket" in b;
const isEphemeralButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; ephemeral: string; style?: V2ButtonStyle } => "ephemeral" in b;
const isFormButton = (
  b: V2ButtonRowButton,
): b is { id: string; label: string; form: string; open_components?: V2Item[]; style?: V2ButtonStyle } => "form" in b;
const isCategoryOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; category: string } => "category" in o;
const isChannelOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; channel_id: string } => "channel_id" in o;
const isDisplayOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; display: true } => "display" in o;
const isTicketOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; ticket: string; open_components?: V2Item[] } => "ticket" in o;
const isEphemeralOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; ephemeral: string; open_components?: V2Item[] } => "ephemeral" in o;
const isFormOption = (
  o: V2SelectMenuOption,
): o is { label: string; description?: string; form: string; open_components?: V2Item[] } => "form" in o;

const BUTTON_STYLE_PREVIEW: Record<V2ButtonStyle, string> = {
  primary: "bg-[#5865F2] hover:bg-[#4752C4] text-white",
  secondary: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
  success: "bg-[#248046] hover:bg-[#1a6334] text-white",
  danger: "bg-[#da373c] hover:bg-[#a12d32] text-white",
  link: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
};

// Custom "Fields" component — side-by-side labeled text like a Discord embed's
// inline fields. Note: Discord's Components V2 has no real inline fields, so this
// renders side by side in the builder PREVIEW; when posted the bot flattens it to
// stacked lines. (It exists so the card can be designed with columns.)
type V2Field = { name: string; value: string; inline: boolean };
type V2Fields = { id: string; type: "fields"; fields: V2Field[] };

type V2Container = {
  id: string;
  type: "container";
  accentColor: string;
  children: V2Leaf[];
};
type V2Leaf = V2Text | V2Section | V2Purchase | V2Gallery | V2Separator | V2ButtonRow | V2SelectMenu | V2Fields;

const PURCHASE_METHODS: { value: string; label: string }[] = [
  { value: "gamepass", label: "Gamepass" },
  { value: "select", label: "Roblox Select" },
  { value: "stripe", label: "Stripe" },
];
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
    // Containers stay top-level, and media galleries are allowed to live
    // OUTSIDE a container (a full-width image, not boxed inside an embed).
    // Everything else buffers into an auto-container for the embed look.
    if (it.type === "container" || it.type === "gallery") {
      flush();
      out.push(it);
    } else {
      buffer.push(it);
    }
  }
  flush();
  return out;
}

// Discord requires a `url` for link-style buttons. Ticket / Ephemeral / Display
// buttons are interaction buttons (not links), so force them off the link style
// and strip any stray url — otherwise the send 400s with "A url is required".
function sanitizeButtonRowButton(b: V2ButtonRowButton): V2ButtonRowButton {
  const isInteraction = "ticket" in b || "form" in b || "ephemeral" in b || "disabled" in b || "counter" in b || "buyrobux" in b || "notify_roles" in b || "orderstatus" in b;
  if (!isInteraction) return b;
  const anyB = b as any;
  const { url: _dropUrl, ...rest } = anyB;
  const style: V2ButtonStyle = !anyB.style || anyB.style === "link" ? "secondary" : anyB.style;
  return { ...rest, style } as V2ButtonRowButton;
}
// A link button with an empty url is invalid and 400s the whole message, so drop
// those (they're the default "Add button" left unconfigured).
function isSendableButton(b: V2ButtonRowButton): boolean {
  if ("url" in b) return !!(b as any).url;
  return true;
}
function sanitizeItems(items: V2Item[]): V2Item[] {
  return items.map((it) => {
    if (it.type === "buttonRow") {
      return {
        ...it,
        buttons: it.buttons.map(sanitizeButtonRowButton).filter(isSendableButton),
      };
    }
    if (it.type === "container") {
      return { ...it, children: sanitizeItems(it.children) as V2Leaf[] };
    }
    return it;
  });
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
    case "purchase":
      return {
        id: uid(),
        type,
        title: "Oversite+",
        price: "R$650 | $4.55 USD",
        button_label: "Purchase",
        methods: ["gamepass", "select", "stripe"],
        msa_url: "",
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
          { id: uid(), label: "Click me", url: "https://example.com", style: "link" },
        ],
      };
    case "select_menu":
      return {
        id: uid(),
        type,
        placeholder: "Choose an option…",
        options: [{ label: "Option 1", url: "" }],
      };
    case "fields":
      return { id: uid(), type, fields: [{ name: "Packer", value: "@user", inline: true }] };
    case "container":
      return { id: uid(), type, accentColor: "#5865F2", children: [] };
  }
};

const FIELDS_OPTION: { type: V2Item["type"]; label: string; Icon: React.ComponentType<{ className?: string }> } = {
  type: "fields", label: "Add Fields (side by side)", Icon: Columns3,
};

const ADD_OPTIONS: { type: V2Item["type"]; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "text", label: "Add Text Display", Icon: Type },
  { type: "section", label: "Add Section", Icon: LayoutPanelTop },
  { type: "purchase", label: "Add Purchase", Icon: ShoppingCart },
  { type: "gallery", label: "Add Media Gallery", Icon: Images },
  { type: "separator", label: "Add Separator", Icon: Minus },
  { type: "container", label: "Add Container", Icon: Box },
  { type: "buttonRow", label: "Add Button Row", Icon: MousePointerClick },
  { type: "select_menu", label: "Add Select Menu", Icon: ChevronsUpDown },
];

const LEAF_OPTIONS = ADD_OPTIONS.filter((o) => o.type !== "container");

export type MessagesV2BuilderHandle = {
  send: () => Promise<boolean>;
  getItems: () => V2Item[];
  setItems: (items: V2Item[]) => void;
};

export type MessagesV2BuilderProps = {
  botId?: string;
  botName: string;
  botAvatarUrl?: string | null;
  /** When true, hides the channel picker and disables send(). Parent owns persistence. */
  embedded?: boolean;
  /** Optional initial items for embedded mode. */
  initialItems?: V2Item[];
  /** Extra preview content rendered after the user's components (e.g. a forced Open Ticket button). */
  previewExtras?: React.ReactNode;
  /** Optional banner shown above the editor stack. */
  editorNotice?: React.ReactNode;
  /** Names of ticket categories — populates the Category dropdown in Button Row / Select Menu. */
  categoryNames?: string[];
  /** When true, hides the built-in live preview pane (parent supplies its own). */
  hidePreview?: boolean;
  /** Controlled callback — fires whenever the editable items change (raw, un-normalized). */
  onItemsChange?: (items: V2Item[]) => void;
  /** Giveaway mode — button rows offer a "Counter" (enter) button instead of
   *  Channel/Ticket/Form/Ephemeral. Clicking a Counter enters the giveaway (+1). */
  giveaway?: boolean;
  /** When true, the Add Component menu offers a "Fields (side by side)" component
   *  (used by the Packages card). Off everywhere else. */
  allowFields?: boolean;
};

export const MessagesV2Builder = forwardRef<
  MessagesV2BuilderHandle,
  MessagesV2BuilderProps
>(function MessagesV2Builder(
  { botId, botName, botAvatarUrl, embedded = false, initialItems, previewExtras, editorNotice, categoryNames = [], hidePreview = false, onItemsChange, giveaway = false, allowFields = false },

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
    initialItems && initialItems.length > 0 ? initialItems : [newItem("text")],
  );
  // Controlled mode: push editable items up to a parent (used when this builder
  // is nested inside another button's Ticket/Ephemeral message editor).
  useEffect(() => {
    onItemsChange?.(sanitizeItems(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const addItem = (type: V2Item["type"]) =>
    setItems((prev) => [...prev, newItem(type)]);

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
    getItems: () => normalizeV2Items(sanitizeItems(items)),
    setItems: (next: V2Item[]) => setItems(next),
  }));

  return (
    <GiveawayContext.Provider value={giveaway}>
    <CategoryNamesContext.Provider value={categoryNames}>
    <ChannelsContext.Provider value={guildChannels}>
    <BotInfoContext.Provider value={{ botId, botName, botAvatarUrl }}>
    <div className={hidePreview ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(440px,500px)] gap-6"}>
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

        <AddComponentMenu onAdd={addItem} allowFields={allowFields} />
      </div>

      {/* Preview */}
      {hidePreview ? null : (
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
      )}

    </div>
    </BotInfoContext.Provider>
    </ChannelsContext.Provider>
    </CategoryNamesContext.Provider>
    </GiveawayContext.Provider>
  );
});

// ============================================================
// Add component menu
// ============================================================
function AddComponentMenu({
  onAdd,
  leafOnly = false,
  allowFields = false,
}: {
  onAdd: (type: V2Item["type"]) => void;
  leafOnly?: boolean;
  allowFields?: boolean;
}) {
  const base = leafOnly ? LEAF_OPTIONS : ADD_OPTIONS;
  const opts = allowFields ? [...base, FIELDS_OPTION] : base;
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
              style={{ borderLeftColor: item.accentColor || "transparent" }}
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
    case "purchase": return "Purchase";
    case "gallery": return "Media Gallery";
    case "separator": return "Separator";
    case "container": return "Container";
    case "buttonRow": return "Button Row";
    case "select_menu": return "Select Menu";
    case "fields": return "Fields";
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
  if (item.type === "fields") {
    const fields = item.fields;
    const setFields = (f: V2Field[]) => onUpdate({ fields: f } as Partial<V2Item>);
    const patch = (i: number, p: Partial<V2Field>) => setFields(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
    const move = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= fields.length) return;
      const next = [...fields];
      [next[i], next[j]] = [next[j], next[i]];
      setFields(next);
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
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setFields(fields.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setFields([...fields, { name: "", value: "", inline: true }])}>
          <Plus className="h-3.5 w-3.5" /> Add field
        </Button>
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
  if (item.type === "purchase") {
    const methods = Array.isArray(item.methods) ? item.methods : [];
    const toggleMethod = (v: string) => {
      const next = methods.includes(v) ? methods.filter((m) => m !== v) : [...methods, v];
      onUpdate({ methods: next } as Partial<V2Item>);
    };
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Product title</Label>
            <Input
              value={item.title}
              onChange={(e) => onUpdate({ title: e.target.value } as Partial<V2Item>)}
              placeholder="Oversite+"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Price line</Label>
            <Input
              value={item.price}
              onChange={(e) => onUpdate({ price: e.target.value } as Partial<V2Item>)}
              placeholder="R$650 | $4.55 USD"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The title is matched to a Gamepass; the <span className="font-medium">$</span> amount in the price line is charged for Stripe, and the <span className="font-medium">R$</span> amount for Roblox Select.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Button label</Label>
          <Input
            value={item.button_label}
            onChange={(e) => onUpdate({ button_label: e.target.value } as Partial<V2Item>)}
            placeholder="Purchase"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Payment methods offered</Label>
          <div className="flex flex-wrap gap-3">
            {PURCHASE_METHODS.map((m) => (
              <label key={m.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={methods.includes(m.value)} onChange={() => toggleMethod(m.value)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Master Service Agreement link (optional)</Label>
          <Input
            value={item.msa_url}
            onChange={(e) => onUpdate({ msa_url: e.target.value } as Partial<V2Item>)}
            placeholder="https://…"
          />
          <p className="text-[11px] text-muted-foreground">
            Buyers must tick an “I agree to the Master Service Agreement” box in the purchase form before checkout.
          </p>
        </div>
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
    const hasColor = !!item.accentColor;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Accent color</Label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={hasColor}
              onChange={(e) =>
                onUpdate({ accentColor: e.target.checked ? "#C9DBE6" : "" } as Partial<V2Item>)
              }
              className="accent-os-accent"
            />
            {hasColor ? "On" : "No color"}
          </label>
        </div>
        {hasColor && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={item.accentColor || "#C9DBE6"}
              onChange={(e) => onUpdate({ accentColor: e.target.value } as Partial<V2Item>)}
              className="h-9 w-12 rounded border border-border bg-background"
            />
            <Input
              value={item.accentColor}
              onChange={(e) => onUpdate({ accentColor: e.target.value } as Partial<V2Item>)}
              className="font-mono text-xs"
            />
          </div>
        )}
      </div>
    );
  }
  if (item.type === "buttonRow") {
    const buttons = item.buttons;
    const categoryNames = useContext(CategoryNamesContext);
    const channels = useContext(ChannelsContext);
    const botInfo = useContext(BotInfoContext);
    const giveaway = useContext(GiveawayContext);
    const [designingId, setDesigningId] = useState<string | null>(null);
    return (
      <div className="space-y-3">
        <Label className="text-xs">Buttons (up to 5)</Label>
        {buttons.map((b, i) => {
          const mode: "link" | "channel" | "display" | "ticket" | "form" | "ephemeral" | "counter" | "buyrobux" | "notify" | "orderstatus" = isTicketButton(b)
            ? "ticket"
            : isFormButton(b)
            ? "form"
            : isEphemeralButton(b)
            ? "ephemeral"
            : isCounterButton(b)
            ? "counter"
            : isBuyRobuxButton(b)
            ? "buyrobux"
            : isNotifyButton(b)
            ? "notify"
            : isOrderStatusButton(b)
            ? "orderstatus"
            : isDisplayButton(b)
            ? "display"
            : isChannelButton2(b)
            ? "channel"
            : "link";
          const style: V2ButtonStyle = b.style ?? "link";
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
                  {giveaway ? (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name={`btn-mode-${b.id}`}
                        checked={mode === "counter"}
                        onChange={() => update({ id: b.id, label: b.label, counter: true, style: style === "link" ? "primary" : style })}
                      />
                      Counter
                    </label>
                  ) : (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name={`btn-mode-${b.id}`}
                        checked={mode === "channel"}
                        onChange={() => update({ id: b.id, label: b.label, channel_id: channels[0]?.channel_id ?? "", style })}
                      />
                      Channel
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`btn-mode-${b.id}`}
                      checked={mode === "display"}
                      onChange={() => update({ id: b.id, label: b.label, disabled: true, style: "secondary" })}
                    />
                    Display
                  </label>
                  {!giveaway && (
                    <>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`btn-mode-${b.id}`}
                          checked={mode === "ticket"}
                          onChange={() => update({ id: b.id, label: b.label, ticket: "", category_name: (b as { category_name?: string }).category_name, access_roles: (b as { access_roles?: string }).access_roles, open_components: (b as { open_components?: V2Item[] }).open_components, style })}
                        />
                        Ticket
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`btn-mode-${b.id}`}
                          checked={mode === "form"}
                          onChange={() => update({ id: b.id, label: b.label, form: "", category_name: (b as { category_name?: string }).category_name, access_roles: (b as { access_roles?: string }).access_roles, open_components: (b as { open_components?: V2Item[] }).open_components, style })}
                        />
                        Form
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`btn-mode-${b.id}`}
                          checked={mode === "ephemeral"}
                          onChange={() => update({ id: b.id, label: b.label, ephemeral: "", open_components: (b as { open_components?: V2Item[] }).open_components, style })}
                        />
                        Ephemeral message
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`btn-mode-${b.id}`}
                          checked={mode === "buyrobux"}
                          onChange={() => update({ id: b.id, label: b.label || "Buy Robux", buyrobux: true, style: style === "link" ? "success" : style })}
                        />
                        Buy Robux
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`btn-mode-${b.id}`}
                          checked={mode === "notify"}
                          onChange={() => update({ id: b.id, label: b.label || "Notify me", notify_roles: (b as { notify_roles?: string }).notify_roles ?? "", style: style === "link" ? "secondary" : style })}
                        />
                        Notification
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`btn-mode-${b.id}`}
                          checked={mode === "orderstatus"}
                          onChange={() => update({ id: b.id, label: b.label || "Order Status", orderstatus: true, style: style === "link" ? "secondary" : style })}
                        />
                        Order Status
                      </label>
                    </>
                  )}
                </div>
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
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Label"
                  value={b.label}
                  onChange={(e) => {
                    const lbl = e.target.value;
                    update(
                      isTicketButton(b)
                        ? { id: b.id, label: lbl, ticket: b.ticket, category_name: (b as { category_name?: string }).category_name, access_roles: (b as { access_roles?: string }).access_roles, open_components: b.open_components, style }
                        : isFormButton(b)
                        ? { id: b.id, label: lbl, form: b.form, category_name: (b as { category_name?: string }).category_name, access_roles: (b as { access_roles?: string }).access_roles, open_components: b.open_components, style }
                        : isEphemeralButton(b)
                        ? { id: b.id, label: lbl, ephemeral: b.ephemeral, open_components: b.open_components, style }
                        : isDisplayButton(b)
                        ? { id: b.id, label: lbl, disabled: true, style }
                        : isCounterButton(b)
                        ? { id: b.id, label: lbl, counter: true, style }
                        : isBuyRobuxButton(b)
                        ? { id: b.id, label: lbl, buyrobux: true, style }
                        : isNotifyButton(b)
                        ? { id: b.id, label: lbl, notify_roles: b.notify_roles, style }
                        : isOrderStatusButton(b)
                        ? { id: b.id, label: lbl, orderstatus: true, style }
                        : isChannelButton2(b)
                        ? { id: b.id, label: lbl, channel_id: b.channel_id, style }
                        : { id: b.id, label: lbl, url: (b as { url: string }).url, style },
                    );
                  }}
                />
                {mode === "link" ? (
                  <Input
                    placeholder="URL"
                    value={(b as { url: string }).url}
                    onChange={(e) => update({ id: b.id, label: b.label, url: e.target.value, style })}
                  />
                ) : mode === "channel" ? (
                  <Select
                    value={(b as { channel_id: string }).channel_id || ""}
                    onValueChange={(v) => update({ id: b.id, label: b.label, channel_id: v, style })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={channels.length === 0 ? "No channels cached" : "Pick a channel"} />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.channel_id} value={c.channel_id}>#{c.channel_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : mode === "ticket" || mode === "form" ? (
                  <Input
                    placeholder="Category (e.g. Liveries)"
                    value={(b as { category_name?: string }).category_name ?? ""}
                    onChange={(e) => update({ ...b, category_name: e.target.value } as V2ButtonRowButton)}
                  />
                ) : mode === "ephemeral" ? (
                  <div className="flex items-center px-2 text-xs text-muted-foreground italic">
                    Edit the message below ↓
                  </div>
                ) : mode === "counter" ? (
                  <Select
                    value={style === "link" ? "primary" : style}
                    onValueChange={(v) => update({ id: b.id, label: b.label, counter: true, style: v as V2ButtonStyle })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Button color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Blurple</SelectItem>
                      <SelectItem value="success">Green</SelectItem>
                      <SelectItem value="secondary">Grey</SelectItem>
                      <SelectItem value="danger">Red</SelectItem>
                    </SelectContent>
                  </Select>
                ) : mode === "buyrobux" ? (
                  <Select
                    value={style === "link" ? "success" : style}
                    onValueChange={(v) => update({ id: b.id, label: b.label, buyrobux: true, style: v as V2ButtonStyle })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Button color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Blurple</SelectItem>
                      <SelectItem value="success">Green</SelectItem>
                      <SelectItem value="secondary">Grey</SelectItem>
                      <SelectItem value="danger">Red</SelectItem>
                    </SelectContent>
                  </Select>
                ) : mode === "notify" ? (
                  <Select
                    value={style === "link" ? "secondary" : style}
                    onValueChange={(v) => update({ id: b.id, label: b.label, notify_roles: (b as { notify_roles?: string }).notify_roles ?? "", style: v as V2ButtonStyle })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Button color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Blurple</SelectItem>
                      <SelectItem value="success">Green</SelectItem>
                      <SelectItem value="secondary">Grey</SelectItem>
                      <SelectItem value="danger">Red</SelectItem>
                    </SelectContent>
                  </Select>
                ) : mode === "orderstatus" ? (
                  <Select
                    value={style === "link" ? "secondary" : style}
                    onValueChange={(v) => update({ id: b.id, label: b.label, orderstatus: true, style: v as V2ButtonStyle })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Button color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Blurple</SelectItem>
                      <SelectItem value="success">Green</SelectItem>
                      <SelectItem value="secondary">Grey</SelectItem>
                      <SelectItem value="danger">Red</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center px-2 text-xs text-muted-foreground italic">
                    Not clickable — label only
                  </div>
                )}
              </div>
              {mode === "counter" && (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Each click enters the giveaway (+1). Put <code className="font-mono">{"{entries}"}</code> in the label for a live count.
                </p>
              )}
              {mode === "buyrobux" && (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Opens the buy flow. Auto-disabled (unclickable) whenever Available Stock is 0 — members
                  can only click it when there's Robux to purchase.
                </p>
              )}
              {mode === "notify" && (
                <>
                  <Input
                    placeholder="Notify roles — given when clicked (role names, comma-separated)"
                    value={(b as { notify_roles?: string }).notify_roles ?? ""}
                    onChange={(e) => update({ id: b.id, label: b.label, notify_roles: e.target.value, style })}
                  />
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Clicking toggles these roles on the member (click again to remove) — a ping/opt-in button.
                  </p>
                </>
              )}
              {mode === "orderstatus" && (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Shows the live Order Status embed (open / limited / closed per service). Configure the
                  services, thresholds, and emojis in the <span className="font-medium">Order Status</span> block.
                </p>
              )}
              {(mode === "ticket" || mode === "form") && (
                <Input
                  placeholder="Access roles — who can see this ticket (role names, comma-separated)"
                  value={(b as { access_roles?: string }).access_roles ?? ""}
                  onChange={(e) => update({ ...b, access_roles: e.target.value } as V2ButtonRowButton)}
                />
              )}
              {(mode === "ticket" || mode === "form" || mode === "ephemeral") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDesigningId(b.id)}
                >
                  {mode === "ticket" ? "Design ticket message →" : mode === "form" ? "Design form message →" : "Design ephemeral message →"}
                  {((b as { open_components?: V2Item[] }).open_components?.length ?? 0) > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">· edited</span>
                  )}
                </Button>
              )}
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
                  { id: uid(), label: "Button", url: "", style: "link" },
                ],
              } as Partial<V2Item>)
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add button
          </Button>
        )}
        {designingId && (() => {
          const dIdx = buttons.findIndex((x) => x.id === designingId);
          const bd = dIdx >= 0 ? buttons[dIdx] : null;
          if (!bd || !(isTicketButton(bd) || isFormButton(bd) || isEphemeralButton(bd))) return null;
          const isTicket = isTicketButton(bd);
          const isForm = isFormButton(bd);
          return (
            <Dialog open onOpenChange={(o) => { if (!o) setDesigningId(null); }}>
              <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isTicket ? "Ticket opening message" : isForm ? "Form message" : "Ephemeral message"}</DialogTitle>
                  {isForm && (
                    <DialogDescription>
                      Write the ticket message as normal. Anywhere you put{" "}
                      <code className="rounded bg-black/30 px-1">{"{Question: Your label}"}</code>{" "}
                      becomes a field in a popup form the user fills in before the ticket opens — their
                      answer replaces the token in the message. Up to 10 questions — Discord shows 5 per popup, with a Continue button for the rest.
                    </DialogDescription>
                  )}
                </DialogHeader>
                <MessagesV2Builder
                  key={`btnmsg-${bd.id}`}
                  embedded
                  botId={botInfo.botId}
                  botName={botInfo.botName}
                  botAvatarUrl={botInfo.botAvatarUrl}
                  initialItems={(bd as { open_components?: V2Item[] }).open_components ?? []}
                  onItemsChange={(next) => {
                    const list = buttons.slice();
                    list[dIdx] = { ...bd, open_components: next } as V2ButtonRowButton;
                    onUpdate({ buttons: list } as Partial<V2Item>);
                  }}
                />
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => setDesigningId(null)}>Done</Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
    );
  }
  if (item.type === "select_menu") {
    const options = item.options;
    const channels = useContext(ChannelsContext);
    const botInfo = useContext(BotInfoContext);
    const [designingIdx, setDesigningIdx] = useState<number | null>(null);
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
          const mode: "link" | "channel" | "display" | "ticket" | "form" | "ephemeral" = isTicketOption(o)
            ? "ticket"
            : isFormOption(o)
            ? "form"
            : isEphemeralOption(o)
            ? "ephemeral"
            : isDisplayOption(o)
            ? "display"
            : isChannelOption(o)
            ? "channel"
            : "link";
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
                      checked={mode === "channel"}
                      onChange={() => update({ label: o.label, channel_id: channels[0]?.channel_id ?? "" })}
                    />
                    Channel
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`opt-mode-${i}`}
                      checked={mode === "display"}
                      onChange={() => update({ label: o.label, display: true })}
                    />
                    Display
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`opt-mode-${i}`}
                      checked={mode === "ticket"}
                      onChange={() => update({ label: o.label, ticket: "", category_name: (o as { category_name?: string }).category_name, access_roles: (o as { access_roles?: string }).access_roles, open_components: (o as { open_components?: V2Item[] }).open_components })}
                    />
                    Ticket
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`opt-mode-${i}`}
                      checked={mode === "form"}
                      onChange={() => update({ label: o.label, form: "", category_name: (o as { category_name?: string }).category_name, access_roles: (o as { access_roles?: string }).access_roles, open_components: (o as { open_components?: V2Item[] }).open_components })}
                    />
                    Form
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`opt-mode-${i}`}
                      checked={mode === "ephemeral"}
                      onChange={() => update({ label: o.label, ephemeral: "", open_components: (o as { open_components?: V2Item[] }).open_components })}
                    />
                    Ephemeral message
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
                  onChange={(e) => {
                    const lbl = e.target.value;
                    update(
                      isTicketOption(o)
                        ? { label: lbl, ticket: o.ticket, category_name: (o as { category_name?: string }).category_name, access_roles: (o as { access_roles?: string }).access_roles, open_components: o.open_components }
                        : isFormOption(o)
                        ? { label: lbl, form: o.form, category_name: (o as { category_name?: string }).category_name, access_roles: (o as { access_roles?: string }).access_roles, open_components: o.open_components }
                        : isEphemeralOption(o)
                        ? { label: lbl, ephemeral: o.ephemeral, open_components: o.open_components }
                        : isDisplayOption(o)
                        ? { label: lbl, display: true }
                        : isChannelOption(o)
                        ? { label: lbl, channel_id: o.channel_id }
                        : { label: lbl, url: (o as { url: string }).url },
                    );
                  }}
                />
                {mode === "link" ? (
                  <Input
                    placeholder="URL"
                    value={(o as { url: string }).url}
                    onChange={(e) => update({ label: o.label, url: e.target.value })}
                  />
                ) : mode === "channel" ? (
                  <Select
                    value={(o as { channel_id: string }).channel_id || ""}
                    onValueChange={(v) => update({ label: o.label, channel_id: v })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={channels.length === 0 ? "No channels cached" : "Pick a channel"} />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.channel_id} value={c.channel_id}>#{c.channel_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : mode === "ticket" || mode === "form" ? (
                  <Input
                    placeholder="Category (e.g. Liveries)"
                    value={(o as { category_name?: string }).category_name ?? ""}
                    onChange={(e) => update({ ...o, category_name: e.target.value } as V2SelectMenuOption)}
                  />
                ) : mode === "ephemeral" ? (
                  <div className="flex items-center px-2 text-xs text-muted-foreground italic">
                    Edit the message below ↓
                  </div>
                ) : (
                  <div className="flex items-center px-2 text-xs text-muted-foreground italic">
                    Info only — no link
                  </div>
                )}
              </div>
              {(mode === "ticket" || mode === "form") && (
                <Input
                  placeholder="Access roles — who can see this ticket (role names, comma-separated)"
                  value={(o as { access_roles?: string }).access_roles ?? ""}
                  onChange={(e) => update({ ...o, access_roles: e.target.value } as V2SelectMenuOption)}
                />
              )}
              {(mode === "ticket" || mode === "form" || mode === "ephemeral") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDesigningIdx(i)}
                >
                  {mode === "ticket" ? "Design ticket message →" : mode === "form" ? "Design form message →" : "Design ephemeral message →"}
                  {((o as { open_components?: V2Item[] }).open_components?.length ?? 0) > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">· edited</span>
                  )}
                </Button>
              )}
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
        {designingIdx !== null && (() => {
          const od = options[designingIdx];
          if (!od || !(isTicketOption(od) || isFormOption(od) || isEphemeralOption(od))) return null;
          const isTicket = isTicketOption(od);
          const isForm = isFormOption(od);
          return (
            <Dialog open onOpenChange={(o) => { if (!o) setDesigningIdx(null); }}>
              <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isTicket ? "Ticket opening message" : isForm ? "Form message" : "Ephemeral message"}</DialogTitle>
                  {isForm && (
                    <DialogDescription>
                      Write the ticket message as normal. Anywhere you put{" "}
                      <code className="rounded bg-black/30 px-1">{"{Question: Your label}"}</code>{" "}
                      becomes a field in a popup form the user fills in before the ticket opens — their
                      answer replaces the token in the message. Up to 10 questions — Discord shows 5 per popup, with a Continue button for the rest.
                    </DialogDescription>
                  )}
                </DialogHeader>
                <MessagesV2Builder
                  key={`optmsg-${designingIdx}`}
                  embedded
                  botId={botInfo.botId}
                  botName={botInfo.botName}
                  botAvatarUrl={botInfo.botAvatarUrl}
                  initialItems={(od as { open_components?: V2Item[] }).open_components ?? []}
                  onItemsChange={(next) => {
                    const list = options.slice();
                    list[designingIdx] = { ...od, open_components: next } as V2SelectMenuOption;
                    onUpdate({ options: list } as Partial<V2Item>);
                  }}
                />
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => setDesigningIdx(null)}>Done</Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
    );
  }
  return null;
}

// ============================================================
// Section button editor (Link / Channel)
// ============================================================
function SectionButtonEditor({
  button,
  onChange,
}: {
  button: V2SectionButton | null;
  onChange: (b: V2SectionButton | null) => void;
}) {
  const channels = useContext(ChannelsContext);
  const mode: "link" | "channel" = isChannelSectionButton(button) ? "channel" : "link";

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
                onChange={() => onChange({ label: button.label, url: "https://example.com" })}
              />
              Link
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`section-btn-mode-${Math.random()}`}
                checked={mode === "channel"}
                onChange={() => onChange({ label: button.label, channel_id: channels[0]?.channel_id ?? "" })}
              />
              Channel
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
                  onChange({ ...(button as { label: string; channel_id: string }), label: e.target.value })
                }
              />
              <Select
                value={(button as { label: string; channel_id: string }).channel_id || ""}
                onValueChange={(v) =>
                  onChange({ ...(button as { label: string; channel_id: string }), channel_id: v })
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={channels.length === 0 ? "No channels cached" : "Pick a channel"} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.channel_id} value={c.channel_id}>
                      #{c.channel_name}
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
    // {|} splits a line into side-by-side columns (aligned across lines).
    if (item.text.includes("{|}")) {
      return (
        <div className="space-y-0.5">
          {item.text.split("\n").map((line, i) =>
            line.includes("{|}") ? (
              <div key={i} className="flex gap-4">
                {line.split("{|}").map((cell, j) => (
                  <div key={j} className="min-w-0 flex-1"><PreviewMarkdown text={cell.trim()} /></div>
                ))}
              </div>
            ) : (
              <PreviewMarkdown key={i} text={line} />
            ),
          )}
        </div>
      );
    }
    return <PreviewMarkdown text={item.text} />;
  }
  if (item.type === "fields") {
    const fs = item.fields.filter((f) => f.name || f.value);
    if (fs.length === 0) return <div className="text-xs text-[#949ba4] italic">[empty fields]</div>;
    // Group consecutive inline fields (max 3 across); full fields on their own row.
    const rows: V2Field[][] = [];
    let run: V2Field[] = [];
    for (const f of fs) {
      if (f.inline) { run.push(f); if (run.length === 3) { rows.push(run); run = []; } }
      else { if (run.length) { rows.push(run); run = []; } rows.push([f]); }
    }
    if (run.length) rows.push(run);
    return (
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-4">
            {row.map((f, j) => (
              <div key={j} className={f.inline ? "flex-1 min-w-0" : "w-full"}>
                <div className="text-xs font-semibold text-[#f2f3f5] break-words">{f.name}</div>
                <div className="text-xs text-[#dbdee1] whitespace-pre-wrap break-words">{f.value || "​"}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (item.type === "purchase") {
    return (
      <div className="flex gap-3 items-center">
        <div className="flex-1 min-w-0 space-y-0.5">
          <PreviewMarkdown text={item.title ? `**${item.title}**` : "**Product**"} />
          {item.price && <PreviewMarkdown text={item.price} />}
        </div>
        <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-[#4e5058] text-white shrink-0">
          {item.button_label || "Purchase"}
        </span>
      </div>
    );
  }
  if (item.type === "section") {
    return (
      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 space-y-1">
          <PreviewMarkdown text={item.title ? `**${item.title}**\n${item.text}` : item.text} />
          {item.button && (
            isChannelSectionButton(item.button) ? (
              <span className="inline-flex items-center px-3 py-1.5 mt-1 text-xs font-medium rounded bg-[#4e5058] text-white">
                {item.button.label || "Button"}
              </span>
            ) : (
              <a
                href={safeUrl(item.button.url)}
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
            src={safeImageSrc(item.thumbnailUrl)}
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
          <img key={i} src={safeImageSrc(u)} alt="" className="w-full h-auto object-cover" />
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
          const styleClass = BUTTON_STYLE_PREVIEW[b.style ?? "link"];
          if (isDisplayButton(b)) {
            return (
              <span
                key={b.id}
                className={cn("inline-flex items-center px-3 py-1.5 text-xs font-medium rounded opacity-60", styleClass)}
              >
                {b.label || "Button"}
              </span>
            );
          }
          if (isBuyRobuxButton(b)) {
            return (
              <span
                key={b.id}
                title="Auto-disabled when Available Stock is 0"
                className={cn("inline-flex items-center px-3 py-1.5 text-xs font-medium rounded opacity-80", styleClass)}
              >
                {b.label || "Buy Robux"}
              </span>
            );
          }
          return isCategoryButton2(b) || isChannelButton2(b) || isCounterButton(b) || isNotifyButton(b) || isOrderStatusButton(b) ? (
            <span
              key={b.id}
              className={cn("inline-flex items-center px-3 py-1.5 text-xs font-medium rounded", styleClass)}
            >
              {b.label || "Button"}
            </span>
          ) : (
            <a
              key={b.id}
              href={safeUrl((b as { url: string }).url)}
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
        style={{ borderLeftColor: item.accentColor || "transparent" }}
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
