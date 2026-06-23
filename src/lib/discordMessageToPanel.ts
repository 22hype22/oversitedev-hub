// Converts a raw Discord message (as returned by GET /channels/:c/messages/:m)
// into the dashboard's V2 ticket-panel builder shape so that the editor can
// faithfully display a panel that was discovered via backfill — i.e. one
// where the original V2Items builder state was never persisted to bot_config.
//
// Handles both:
//   - Components v2 messages (Container/Section/TextDisplay/MediaGallery/
//     Separator/ActionRow with buttons, StringSelect) — type ids 17/9/10/12/14/1/2/3.
//   - Legacy embed + select-menu / button-row panels (the slash /ticket
//     command and original dashboard posts).
//
// Fields that CANNOT be reconstructed from the message alone and must keep
// whatever the dashboard already has (or fall back to defaults) — surfaced via
// `unrecoverable`:
//   - cooldown_minutes
//   - log channel id + log toggles + include_attachments
//   - per-category opening message templates
//   - per-category staff role mappings
//   - stable category internal ids (we generate fresh uuids)
//   - panel_channel name (we know channel_id from editTarget)
//   - button styles for legacy embed panels (no buttons present)
//   - text formatting that Discord normalized (e.g. mention rendering)

import type { V2Item } from "@/components/dashboard/TicketPanelV2Builder";

type Category = {
  id: string;
  name: string;
  roles: string[];
  openingMessage: string;
};

export type ReconstructedPanel = {
  /** V2-shaped items the editor can drop into the V2 builder. */
  v2Items: V2Item[];
  /** For v1 (legacy embed) panels we also return the flat fields. */
  panelTitle: string;
  panelDescription: string;
  embedColor: string;
  /** Category names parsed from a select-menu / button row, if any. */
  categories: Category[] | null;
  /** Whether the source message used Discord components v2. */
  isV2Message: boolean;
  /** Things the message JSON cannot tell us — surface to the user. */
  unrecoverable: string[];
};

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const intToHex = (n: number | undefined | null): string => {
  if (typeof n !== "number" || !Number.isFinite(n)) return "#5865F2";
  return "#" + (n & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
};

const STYLE_MAP: Record<number, "primary" | "secondary" | "success" | "danger" | "link"> = {
  1: "primary",
  2: "secondary",
  3: "success",
  4: "danger",
  5: "link",
};

// Detect ticket-related custom_ids. The dashboard's panel buttons that map to
// "category" use custom_ids like `ticket_open:<cat>` or `ticket_create:<cat>`,
// and the slash-command select menu uses `ticket_category_select`.
const parseCategoryFromCustomId = (cid: string | undefined): string | null => {
  if (!cid) return null;
  const m = cid.match(/^(?:ticket_open|ticket_create|ticket_panel):(.+)$/);
  return m ? m[1] : null;
};

function leafFromComponent(c: any, notes: Set<string>): V2Item | null {
  if (!c || typeof c !== "object") return null;
  switch (c.type) {
    case 10: // TextDisplay
      return { id: uid(), type: "text", text: String(c.content ?? "") };
    case 14: // Separator
      return {
        id: uid(),
        type: "separator",
        divider: c.divider !== false,
        spacing: c.spacing === 2 ? "large" : "small",
      };
    case 12: { // MediaGallery
      const items: any[] = Array.isArray(c.items) ? c.items : [];
      const images = items
        .map((it) => String(it?.media?.url ?? ""))
        .filter(Boolean);
      return { id: uid(), type: "gallery", images };
    }
    case 9: { // Section
      const accessory = c.accessory ?? null;
      const children: any[] = Array.isArray(c.components) ? c.components : [];
      const textParts = children
        .filter((ch) => ch?.type === 10)
        .map((ch) => String(ch.content ?? ""));
      let button: any = null;
      let thumbnailUrl = "";
      if (accessory?.type === 2) {
        // Button accessory
        const label = String(accessory.label ?? "");
        if (accessory.style === 5 && accessory.url) {
          button = { label, url: String(accessory.url) };
        } else {
          const cat = parseCategoryFromCustomId(accessory.custom_id);
          if (cat) {
            button = { label, category: cat };
          } else {
            // Unknown custom_id — best-effort: stash custom_id under url so the
            // editor still shows the button; user can re-bind.
            notes.add(
              `Section button custom_id "${accessory.custom_id ?? ""}" is unrecognized — re-bind to a category in the editor.`,
            );
            button = { label, category: label };
          }
        }
      } else if (accessory?.type === 11 && accessory.media?.url) {
        thumbnailUrl = String(accessory.media.url);
      }
      return {
        id: uid(),
        type: "section",
        title: "",
        text: textParts.join("\n"),
        thumbnailUrl,
        button,
      };
    }
    case 1: { // ActionRow
      const children: any[] = Array.isArray(c.components) ? c.components : [];
      // Select menu?
      const select = children.find((ch) => ch?.type === 3);
      if (select) {
        const opts: any[] = Array.isArray(select.options) ? select.options : [];
        return {
          id: uid(),
          type: "select_menu",
          placeholder: String(select.placeholder ?? ""),
          options: opts.map((o) => {
            const label = String(o.label ?? "");
            const description = o.description ? String(o.description) : undefined;
            // Slash-command select uses option.value as the category name.
            const value = String(o.value ?? label);
            return { label, description, category: value };
          }),
        };
      }
      // Otherwise button row.
      const buttons = children
        .filter((ch) => ch?.type === 2)
        .map((b: any) => {
          const id = uid();
          const label = String(b.label ?? "");
          const style = STYLE_MAP[b.style as number] ?? "secondary";
          if (b.style === 5 && b.url) {
            return { id, label, url: String(b.url), style };
          }
          const cat = parseCategoryFromCustomId(b.custom_id);
          if (cat) return { id, label, category: cat, style };
          notes.add(
            `Button custom_id "${b.custom_id ?? ""}" is unrecognized — re-bind it in the editor.`,
          );
          return { id, label, category: label, style };
        });
      if (buttons.length === 0) return null;
      return { id: uid(), type: "buttonRow", buttons };
    }
    default:
      notes.add(`Unsupported component type ${c.type} skipped.`);
      return null;
  }
}

function fromComponentsV2(
  components: any[],
  notes: Set<string>,
): V2Item[] {
  const out: V2Item[] = [];
  for (const top of components) {
    if (!top || typeof top !== "object") continue;
    if (top.type === 17) {
      // Container
      const children: any[] = Array.isArray(top.components) ? top.components : [];
      const leaves: any[] = [];
      for (const ch of children) {
        const leaf = leafFromComponent(ch, notes);
        if (leaf && leaf.type !== "container") leaves.push(leaf);
      }
      out.push({
        id: uid(),
        type: "container",
        accentColor: intToHex(top.accent_color),
        children: leaves as any,
      });
    } else {
      const leaf = leafFromComponent(top, notes);
      if (leaf) out.push(leaf);
    }
  }
  return out;
}

function fromLegacyEmbed(
  message: any,
  notes: Set<string>,
): {
  v2Items: V2Item[];
  panelTitle: string;
  panelDescription: string;
  embedColor: string;
  categories: Category[] | null;
} {
  const embed = Array.isArray(message.embeds) ? message.embeds[0] : null;
  const panelTitle = String(embed?.title ?? "");
  const panelDescription = String(embed?.description ?? message.content ?? "");
  const embedColor = intToHex(embed?.color);

  // Parse categories from the first select menu or button row in components.
  let categories: Category[] | null = null;
  const rows: any[] = Array.isArray(message.components) ? message.components : [];
  for (const row of rows) {
    const children: any[] = Array.isArray(row?.components) ? row.components : [];
    const select = children.find((c) => c?.type === 3);
    if (select) {
      categories = (select.options ?? []).map((o: any) => ({
        id: uid(),
        name: String(o.label ?? o.value ?? ""),
        roles: [],
        openingMessage: "",
      }));
      break;
    }
    const btns = children.filter((c) => c?.type === 2 && c.style !== 5);
    if (btns.length > 0) {
      categories = btns.map((b: any) => {
        const cat = parseCategoryFromCustomId(b.custom_id) ?? String(b.label ?? "");
        return { id: uid(), name: cat, roles: [], openingMessage: "" };
      });
      break;
    }
  }

  // Build a V2 representation too (single container with text + the row).
  const v2Leaves: V2Item[] = [];
  if (panelTitle || panelDescription) {
    const text = [panelTitle ? `## ${panelTitle}` : "", panelDescription]
      .filter(Boolean)
      .join("\n");
    v2Leaves.push({ id: uid(), type: "text", text } as V2Item);
  }
  for (const row of rows) {
    const leaf = leafFromComponent(row, notes);
    if (leaf) v2Leaves.push(leaf);
  }
  const v2Items: V2Item[] =
    v2Leaves.length > 0
      ? [{
          id: uid(),
          type: "container",
          accentColor: embedColor,
          children: v2Leaves as any,
        }]
      : [];

  if (categories) {
    notes.add(
      "Category role mappings and opening-message templates are not stored in the Discord message — re-enter them in the editor.",
    );
  }
  notes.add("Cooldown, ticket log channel, and log toggles are not in the message — keeping current dashboard values.");

  return { v2Items, panelTitle, panelDescription, embedColor, categories };
}

/**
 * Detect whether the message used Components v2. Discord sets bit 1<<15
 * (32768) on `flags` for v2 messages, but we also fall back to a structural
 * check (any top-level component type 17 = Container) for safety.
 */
function isV2Message(message: any): boolean {
  const flags = Number(message?.flags ?? 0);
  if (flags & 32768) return true;
  const comps: any[] = Array.isArray(message?.components) ? message.components : [];
  return comps.some((c) => c?.type === 17);
}

export function discordMessageToPanel(message: any): ReconstructedPanel {
  const notes = new Set<string>();
  if (!message || typeof message !== "object") {
    return {
      v2Items: [],
      panelTitle: "",
      panelDescription: "",
      embedColor: "#5865F2",
      categories: null,
      isV2Message: false,
      unrecoverable: ["Message could not be fetched."],
    };
  }

  const v2 = isV2Message(message);
  if (v2) {
    const v2Items = fromComponentsV2(message.components ?? [], notes);
    notes.add("Cooldown, ticket log channel, and log toggles are not in the message — keeping current dashboard values.");
    notes.add("Category staff-role mappings and opening-message templates aren't in the message — re-enter them in the editor.");
    return {
      v2Items,
      panelTitle: "",
      panelDescription: "",
      embedColor: "#5865F2",
      categories: null,
      isV2Message: true,
      unrecoverable: Array.from(notes),
    };
  }

  const legacy = fromLegacyEmbed(message, notes);
  return {
    ...legacy,
    isV2Message: false,
    unrecoverable: Array.from(notes),
  };
}
