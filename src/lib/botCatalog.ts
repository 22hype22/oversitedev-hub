/**
 * Lightweight metadata maps for bot bases and add-ons.
 * Kept in sync with the BotBuilder catalog so the dashboard
 * "Add add-ons" dialog shows the same options and pricing.
 */

// ER:LC / Roblox bots are one-time purchases hosted free — never billed a
// monthly hosting fee. A `base` value can be compound (e.g. "protection+dispatch")
// so isRobloxBase is true only when EVERY part is a Roblox base.
export const ROBLOX_BASE_IDS = new Set<string>(["dispatch", "erlc-spec", "customs", "roleplay"]);
export function isRobloxBase(base: string | null | undefined): boolean {
  if (!base) return false;
  const parts = String(base).split(/[^a-z0-9-]+/i).filter(Boolean);
  return parts.length > 0 && parts.every((p) => ROBLOX_BASE_IDS.has(p));
}

export const BOT_BASE_LABELS: Record<string, string> = {
  protection: "Oversite Protection",
  support: "Oversite Support",
  utilities: "Oversite Utilities",
  scratch: "All in One Pack",
  dispatch: "Oversite Dispatch",
  customs: "Oversite Customs",
  roleplay: "Oversite Roleplay",
};

export const BOT_BASE_TAGLINES: Record<string, string> = {
  protection: "Automod, anti-raid, and a full mod toolkit.",
  support: "Tickets, appeals, reports, and welcomes.",
  utilities: "Announcements, roles, Roblox, music, more.",
  scratch: "Protection + Support + Utilities — every base in one bot.",
  dispatch: "AI voice dispatcher for ER:LC — reads 911 calls and talks back.",
  customs: "Tickets, messaging, credits, and join logs — all dashboard-driven.",
  roleplay: "Everything an ER:LC roleplay community runs on, all dashboard-driven.",
};

export const BOT_ADDON_LABELS: Record<string, string> = {
  // Dispatch — included base features
  "dispatch-region": "Dispatcher Region",
  "dispatch-voice": "Dispatch Voice Channel",

  // Protection — included base features
  "verification-system": "Verification System",
  "mod-actions": "Warn / Mute / Ban / Kick",
  "anti-spam": "Anti-Spam",
  "anti-raid": "Anti-Raid",
  "auto-role": "Auto Role on Join",

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
  "temp-ban": "Temporary Bans (Auto-Unban)",

  // Support — included base features
  messages: "Messages",
  rules: "Rules",

  // Support
  "staff-performance": "Staff Performance Tracking",
  "ticket-logs": "Ticket Logs",
  "ticket-notes": "Ticket Notes",
  "ticket-add-remove": "Add / Remove Members",
  "close-all-tickets": "Close All Tickets",
  "ticket-message-customization": "Post Ticket",
  "ticket-lifecycle-messages": "Ticket Messages",
  "ticket-editor": "Ticket Panel Edit",
  "priority-flagging": "Priority Ticket Flagging",
  "auto-close-inactive": "Auto-Close Inactive Tickets",
  "anonymous-reporting": "Anonymous Reporting",
  "post-system": "Post System",

  // Utilities
  "music-addon": "Music Add-On",
  "auto-radio": "Auto Radio",

  starboard: "Starboard",
  "recurring-messages": "Recurring Messages",
  "giveaway-system": "Giveaway System",
  "server-stats-channels": "Server Stats Channels",
  "live-notifications": "Twitch / YouTube Notifications",
  "leveling-system": "Leveling System",
  "economy-system": "Economy System",
  remindme: "/remindme",

  "roblox-group-sync": "Roblox Group Sync",
  "invite-tracker": "Invite Tracker",
  "marketplace": "Marketplace",
  "ads": "Advertisements",
  "customs-tts": "Text-to-Speech",
  "customs-gambling": "Economy & Gambling",
  "customs-suggestions": "Suggestions",
  "customs-feedback": "Feedback",
  "customs-vouches": "Vouches",
  "customs-sales": "Sales Stats",
  "roleplay-shifts": "Shifts",
  "customs-freerelease": "Free Release",
  "customs-blacklist": "Blacklist Logs",
  "customs-reportbug": "Report a Bug",
  "customs-announce": "Package Announcements",
  "customs-smallui": "System Messages",

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
  "temp-ban": 1.99,

  // Support
  "staff-performance": 1.99,
  "ticket-logs": 0.99,
  "ticket-notes": 0.99,
  "ticket-add-remove": 0.99,
  "close-all-tickets": 0.99,
  "ticket-message-customization": 1.99,
  "priority-flagging": 0.99,
  "auto-close-inactive": 0.99,
  "anonymous-reporting": 0.99,
  "post-system": 1.99,

  // Utilities
  "music-addon": 1.99,
  "auto-radio": 0.99,

  starboard: 0.99,
  "recurring-messages": 0.99,
  "giveaway-system": 0.99,
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

    "auto-escalating-warnings",
    "softban-massban",
    "channel-lockdown",
    "moderation-history",
    "auto-slowmode",
    "temp-ban",
  ],
  support: [
    "staff-performance",
    "ticket-logs",
    "ticket-notes",
    "ticket-add-remove",
    "close-all-tickets",
    "ticket-message-customization",
    "priority-flagging",
    "auto-close-inactive",
    "post-system",
  ],
  utilities: [
    "music-addon",
    "auto-radio",

    "starboard",
    "recurring-messages",
    "giveaway-system",
    "server-stats-channels",
    "live-notifications",
    "leveling-system",
    "economy-system",
    "remindme",
    "staff-notes",
  ],
};

const SHARED_ADDON_IDS = ["branding", "dashboard", "multi-server"];

/**
 * Features included for free with each base bot. They're not "add-ons" you
 * buy — they ship with the base — but the dashboard renders config boxes
 * for them so customers can tweak the included behavior.
 */
export const BASE_INCLUDED_ADDONS: Record<string, string[]> = {
  // The dispatch bot's dashboard-driven settings, shown as config blocks like
  // every other base (they used to hide inside the API-keys card only).
  dispatch: ["dispatch-region", "dispatch-voice"],
  protection: [
    "verification-system",
    "mod-actions",
    "anti-spam",
    "anti-raid",
    "phishing-detection",
    "auto-role",
    "messages",
    "rules",
  ],
  // Support and Utilities bases should surface every configured section in the dashboard.
  support: [
    "ticket-message-customization",
    "ticket-lifecycle-messages",
    "ticket-editor",
    "messages",
    ...ADDON_IDS_BY_BASE.support.filter((id) => id !== "ticket-message-customization"),
  ],
  utilities: [...ADDON_IDS_BY_BASE.utilities, "messages"],
  customs: ["invite-message", "customs-messages", "customs-tickets", "customs-verification", "customs-giveaway", "customs-robux-locker", "customs-order-status", "customs-pricing", "customs-portfolio", "customs-packages", "customs-orderlog", "customs-infraction", "customs-promotion", "customs-qualitycheck", "customs-payment", "customs-logging", "music-addon", "auto-radio", "roblox-group-sync", "invite-tracker", "marketplace", "ads", "customs-tts", "customs-gambling", "customs-suggestions", "customs-feedback", "customs-vouches", "customs-sales", "customs-freerelease", "customs-blacklist", "customs-announce", "customs-smallui"],
  // Oversite Roleplay: the Network feature set minus the shop pieces (packages,
  // pricing, portfolio, robux locker, order status, vouches, sales).
  roleplay: ["invite-message", "customs-messages", "customs-tickets", "customs-verification", "roblox-group-sync",
    "customs-infraction", "customs-promotion", "customs-logging", "customs-giveaway", "music-addon",
    "auto-radio", "invite-tracker", "marketplace", "ads", "customs-tts", "customs-gambling", "customs-suggestions",
    "customs-blacklist", "customs-smallui", "roleplay-shifts"],
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

export function getAddonPrice(_id: string): number {
  // Every add-on is included for free now — nothing costs anything.
  // The BOT_ADDON_PRICES map is kept for reference only.
  return 0;
}

export type AddonCategory = "protection" | "support" | "utilities" | "shared";

/** Which catalog category a given add-on id belongs to. */
export function getAddonCategory(id: string): AddonCategory {
  if (SHARED_ADDON_IDS.includes(id) || id === "branding-multi-server") return "shared";
  if (
    ADDON_IDS_BY_BASE.protection.includes(id) ||
    BASE_INCLUDED_ADDONS.protection.includes(id)
  )
    return "protection";
  if (
    ADDON_IDS_BY_BASE.support.includes(id) ||
    BASE_INCLUDED_ADDONS.support.includes(id)
  )
    return "support";
  return "utilities";
}
