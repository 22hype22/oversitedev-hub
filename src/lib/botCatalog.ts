/**
 * Lightweight metadata maps for bot bases and add-ons.
 * Kept in sync with the BotBuilder catalog so the dashboard
 * "Add add-ons" dialog shows the same options and pricing.
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
  // Protection — included base features
  "verification-system": "Verification System",
  "mod-actions": "Warn / Mute / Ban / Kick",
  "anti-spam": "Anti-Spam",
  "anti-raid": "Anti-Raid",
  "basic-logging": "Basic Logging",
  "phishing-detection": "Phishing Link Detection",

  // Protection
  "advanced-logging": "Advanced Logging",
  "nsfw-invite-scanner": "NSFW Invite Scanner + Censored Logs",
  "avatar-nsfw-detection": "Avatar NSFW Detection",
  "bio-phrase-detection": "Bio Phrase Detection",
  
  "auto-escalating-warnings": "Auto-Escalating Warnings",
  "softban-massban": "/softban and /massban",
  "channel-lockdown": "Channel Lockdown Command",
  "staff-notes": "Staff Notes on Users",
  "moderation-history": "Moderation History",
  "auto-slowmode": "Auto Slowmode on Spam",
  "temp-bans": "Temporary Bans (Auto-Unban)",

  // Support
  "staff-performance": "Staff Performance Tracking",
  "ticket-logs": "Ticket Logs",
  "per-category-roles": "Per-Category Role Access",
  "ticket-notes": "Ticket Notes",
  "ticket-add-remove": "Add / Remove Members",
  "close-all-tickets": "Close All Tickets",
  "ticket-message-customization": "Ticket Message Customization",
  "priority-flagging": "Priority Ticket Flagging",
  "auto-close-inactive": "Auto-Close Inactive Tickets",
  "anonymous-reporting": "Anonymous Reporting",

  // Utilities
  "music-addon": "Music Add-On",
  "auto-radio": "Auto Radio by Genre",
  "roblox-verification": "Roblox Verification",
  starboard: "Starboard",
  "recurring-messages": "Recurring Messages",
  "giveaway-system": "Giveaway System",
  "birthday-announcements": "Birthday Announcements",
  "server-stats-channels": "Server Stats Channels",
  "live-notifications": "Twitch / YouTube Notifications",
  "leveling-system": "Leveling System",
  "economy-system": "Economy System",
  remindme: "/remindme",

  // Shared
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
  // Protection
  "advanced-logging": 2.99,
  "nsfw-invite-scanner": 2.99,
  "avatar-nsfw-detection": 1.99,
  "bio-phrase-detection": 0.99,
  
  "auto-escalating-warnings": 1.99,
  "softban-massban": 1.99,
  "channel-lockdown": 1.99,
  "staff-notes": 1.99,
  "moderation-history": 1.99,
  "auto-slowmode": 1.99,
  "temp-bans": 1.99,

  // Support
  "staff-performance": 1.99,
  "ticket-logs": 0.99,
  "per-category-roles": 0.99,
  "ticket-notes": 0.99,
  "ticket-add-remove": 0.99,
  "close-all-tickets": 0.99,
  "ticket-message-customization": 1.99,
  "priority-flagging": 0.99,
  "auto-close-inactive": 0.99,
  "anonymous-reporting": 0.99,

  // Utilities
  "music-addon": 1.99,
  "auto-radio": 0.99,
  "roblox-verification": 0.99,
  starboard: 0.99,
  "recurring-messages": 0.99,
  "giveaway-system": 0.99,
  "birthday-announcements": 0.99,
  "server-stats-channels": 0.99,
  "live-notifications": 0.99,
  "leveling-system": 2.99,
  "economy-system": 1.99,
  remindme: 0.99,

  // Shared
  branding: 25,
  dashboard: 149.99,
  "multi-server": 9.99,
};

const ADDON_IDS_BY_BASE: Record<string, string[]> = {
  protection: [
    "advanced-logging",
    "nsfw-invite-scanner",
    "avatar-nsfw-detection",
    "bio-phrase-detection",
    "account-age-gating",
    "auto-escalating-warnings",
    "softban-massban",
    "channel-lockdown",
    "staff-notes",
    "moderation-history",
    "auto-slowmode",
    "temp-bans",
  ],
  support: [
    "staff-performance",
    "ticket-logs",
    "per-category-roles",
    "ticket-notes",
    "ticket-add-remove",
    "close-all-tickets",
    "ticket-message-customization",
    "priority-flagging",
    "auto-close-inactive",
    "anonymous-reporting",
  ],
  utilities: [
    "music-addon",
    "auto-radio",
    "roblox-verification",
    "starboard",
    "recurring-messages",
    "giveaway-system",
    "birthday-announcements",
    "server-stats-channels",
    "live-notifications",
    "leveling-system",
    "economy-system",
    "remindme",
  ],
};

const SHARED_ADDON_IDS = ["branding", "dashboard", "multi-server"];

/**
 * Features included for free with each base bot. They're not "add-ons" you
 * buy — they ship with the base — but the dashboard renders config boxes
 * for them so customers can tweak the included behavior.
 */
export const BASE_INCLUDED_ADDONS: Record<string, string[]> = {
  protection: [
    "verification-system",
    "mod-actions",
    "anti-spam",
    "anti-raid",
    "basic-logging",
    "phishing-detection",
  ],
  support: [],
  utilities: [],
};

export function getIncludedAddonsForBase(baseId: string): string[] {
  if (baseId === "scratch") {
    return [
      ...BASE_INCLUDED_ADDONS.protection,
      ...BASE_INCLUDED_ADDONS.support,
      ...BASE_INCLUDED_ADDONS.utilities,
    ];
  }
  return BASE_INCLUDED_ADDONS[baseId] ?? [];
}

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
