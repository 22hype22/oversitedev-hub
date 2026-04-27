/**
 * Lightweight metadata maps for bot bases and add-ons.
 * Per-base add-ons are intentionally empty — pending a fresh list.
 */

export const BOT_BASE_LABELS: Record<string, string> = {
  protection: "Oversite Protection",
  support: "Oversite Support",
  utilities: "Oversite Utilities",
  scratch: "All-in-One Pack",
};

export const BOT_BASE_TAGLINES: Record<string, string> = {
  protection: "Automod, anti-raid, and a full mod toolkit.",
  support: "Tickets, appeals, reports, and welcomes.",
  utilities: "Announcements, roles, Roblox, music, more.",
  scratch: "Protection + Support + Utilities — every base in one bot.",
};

export const BOT_ADDON_LABELS: Record<string, string> = {
  // Shared add-ons only
  branding: "Custom Branding",
  dashboard: "Web Dashboard",
  "multi-server": "Multi-Server License",
};

export function getAddonLabel(id: string): string {
  return (
    BOT_ADDON_LABELS[id] ??
    id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export const BOT_ADDON_PRICES: Record<string, number> = {
  branding: 25,
  dashboard: 149.99,
  "multi-server": 9.99,
};

const ADDON_IDS_BY_BASE: Record<string, string[]> = {
  protection: [],
  support: [],
  utilities: [],
};

const SHARED_ADDON_IDS = ["branding", "dashboard", "multi-server"];

/** All add-on ids available for a given bot base, including shared ones. */
export function getAddonIdsForBase(baseId: string): string[] {
  if (baseId === "scratch") {
    return [
      ...ADDON_IDS_BY_BASE.protection,
      ...ADDON_IDS_BY_BASE.support,
      ...ADDON_IDS_BY_BASE.utilities,
      ...SHARED_ADDON_IDS,
    ];
  }
  return [...(ADDON_IDS_BY_BASE[baseId] ?? []), ...SHARED_ADDON_IDS];
}

export function getAddonPrice(id: string): number {
  return BOT_ADDON_PRICES[id] ?? 0;
}
