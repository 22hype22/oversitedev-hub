/**
 * Lightweight metadata maps for bot bases and add-ons.
 * Used by the Bot Dashboard to render human-friendly names from the
 * IDs persisted on `bot_orders` rows. Keep this in sync with
 * src/components/site/BotBuilder.tsx if new bases / add-ons are added.
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

/**
 * id -> display name for every add-on currently sold by the Bot Builder.
 * Unknown ids fall back to a humanized version of the id.
 */
export const BOT_ADDON_LABELS: Record<string, string> = {
  // Shared
  branding: "Custom Branding",
  dashboard: "Web Dashboard",
  "multi-server": "Multi-Server License",

  // Protection
  "advanced-logging": "Advanced Logging",
  "nsfw-invite-scanner": "NSFW Invite Scanner",
  "avatar-nsfw-detection": "Avatar NSFW Detection",
  "bio-phrase-detection": "Bio Phrase Detection",
  "admin-abuse-detection": "Admin Abuse Detection",
  "new-account-age-gate": "New Account Age Gate",
  "auto-escalating-warns": "Auto-Escalating Warnings",
  "softban-massban": "/softban & /massban",
  "channel-lockdown": "Channel Lockdown Command",
  "unban-command": "/unban Command",
  "staff-notes": "Staff Notes on Users",
  modlog: "User Moderation History (/modlog)",
  "slowmode-auto": "Auto-Slowmode on Spam",
  "temp-bans": "Temporary Bans",

  // Support
  "unlimited-categories": "Unlimited Ticket Categories",
  "ticket-transcripts": "Ticket Transcripts",
  "per-category-roles": "Per-Category Role Access",
  "ticket-notes": "Ticket Notes",
  "ticketadd-remove": "/ticketadd & /ticketremove",
  "suggestion-approve-deny": "Suggestion System (Approve/Deny)",
  "ticket-claim": "Ticket Claim System",
  closeall: "/closeall Command",
  "ticket-customization": "Ticket Message Customization",
  "priority-flagging": "Priority Ticket Flagging",
  "ticket-stats": "Ticket Stats Dashboard",
  "auto-close-inactive": "Auto-Close Inactive Tickets",
  "anonymous-reporting": "Anonymous Reporting",
  "staff-performance": "Staff Performance Tracking",

  // Utilities
  "spotify-music": "Spotify Music Integration",
  "auto-radio": "Auto-Radio by Genre",
  "roblox-verification": "Roblox Verification + Role Sync",
  starboard: "Starboard",
  "custom-commands": "Custom Commands",
  "recurring-messages": "Recurring Messages",
  "reaction-roles-unlimited": "Unlimited Reaction Roles",
  "sticky-messages": "Sticky / Repeating Messages",
  "review-system": "Review System",
  "purge-bulk-delete": "/purge Bulk Delete",
  "giveaway-system": "Giveaway System",
  "birthday-announcements": "Birthday Announcements",
  "stats-channels": "Server Stats Channels",
  "live-notifications": "Twitch / YouTube Live Notifications",
  "leveling-system": "Leveling System",
  "economy-system": "Economy System",
  remindme: "/remindme Personal Reminders",
};

export function getAddonLabel(id: string): string {
  return (
    BOT_ADDON_LABELS[id] ??
    id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * id -> price for every add-on currently sold by the Bot Builder.
 * Keep in sync with src/components/site/BotBuilder.tsx.
 */
export const BOT_ADDON_PRICES: Record<string, number> = {
  // Shared
  branding: 25,
  dashboard: 149.99,
  "multi-server": 9.99,

  // Protection
  "advanced-logging": 4.99,
  "nsfw-invite-scanner": 5.99,
  "avatar-nsfw-detection": 5.99,
  "bio-phrase-detection": 4.99,
  "admin-abuse-detection": 6.99,
  "new-account-age-gate": 3.99,
  "auto-escalating-warns": 4.99,
  "softban-massban": 3.99,
  "channel-lockdown": 2.99,
  "unban-command": 1.99,
  "staff-notes": 2.99,
  modlog: 3.99,
  "slowmode-auto": 2.99,
  "temp-bans": 3.99,

  // Support
  "unlimited-categories": 2.99,
  "ticket-transcripts": 3.99,
  "per-category-roles": 2.99,
  "ticket-notes": 1.99,
  "ticketadd-remove": 1.99,
  "suggestion-approve-deny": 2.99,
  "ticket-claim": 1.99,
  closeall: 1.99,
  "ticket-customization": 2.99,
  "priority-flagging": 2.99,
  "ticket-stats": 4.99,
  "auto-close-inactive": 2.99,
  "anonymous-reporting": 3.99,
  "staff-performance": 4.99,

  // Utilities
  "spotify-music": 5.99,
  "auto-radio": 4.99,
  "roblox-verification": 5.99,
  starboard: 1.99,
  "custom-commands": 3.99,
  "recurring-messages": 2.99,
  "reaction-roles-unlimited": 2.99,
  "sticky-messages": 2.99,
  "review-system": 2.99,
  "purge-bulk-delete": 1.99,
  "giveaway-system": 3.99,
  "birthday-announcements": 1.99,
  "stats-channels": 2.99,
  "live-notifications": 3.99,
  "leveling-system": 4.99,
  "economy-system": 5.99,
  remindme: 1.99,
};

const ADDON_IDS_BY_BASE: Record<string, string[]> = {
  protection: [
    "advanced-logging", "nsfw-invite-scanner", "avatar-nsfw-detection",
    "bio-phrase-detection", "admin-abuse-detection", "new-account-age-gate",
    "auto-escalating-warns", "softban-massban", "channel-lockdown",
    "unban-command", "staff-notes", "modlog", "slowmode-auto", "temp-bans",
  ],
  support: [
    "unlimited-categories", "ticket-transcripts", "per-category-roles",
    "ticket-notes", "ticketadd-remove", "suggestion-approve-deny",
    "ticket-claim", "closeall", "ticket-customization", "priority-flagging",
    "ticket-stats", "auto-close-inactive", "anonymous-reporting",
    "staff-performance",
  ],
  utilities: [
    "spotify-music", "auto-radio", "roblox-verification", "starboard",
    "custom-commands", "recurring-messages", "reaction-roles-unlimited",
    "sticky-messages", "review-system", "purge-bulk-delete", "giveaway-system",
    "birthday-announcements", "stats-channels", "live-notifications",
    "leveling-system", "economy-system", "remindme",
  ],
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
