/**
 * Lightweight metadata maps for bot bases and add-ons.
 * Used by the Bot Dashboard to render human-friendly names from the
 * IDs persisted on `bot_orders` rows. Keep this in sync with
 * src/components/site/BotBuilder.tsx if new bases / add-ons are added.
 */

export const BOT_BASE_LABELS: Record<string, string> = {
  protection: "Protection",
  support: "Support",
  utilities: "Utilities",
  scratch: "From Scratch",
};

export const BOT_BASE_TAGLINES: Record<string, string> = {
  protection: "Automod, anti-raid, and a full mod toolkit.",
  support: "Tickets, appeals, reports, and welcomes.",
  utilities: "Announcements, roles, Roblox, music, more.",
  scratch: "Fully bespoke — designed from the ground up.",
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
  "anti-spam": "Anti-Spam",
  "anti-raid": "Anti-Raid Protection",
  "link-filter": "Link Filter",
  "profanity-filter": "Profanity Filter",
  "alt-detection": "Alt Account Detection",
  "mention-guard": "Mention Guard",
  "nsfw-filter": "NSFW Filter",
  "verification-gate": "Verification Gate",
  slowmode: "Slowmode Manager",
  "audit-logger": "Audit Logger",
  "vpn-blocker": "VPN / Proxy Blocker",
  "auto-mute": "Auto-Mute",
  "auto-kick": "Auto-Kick",
  "auto-ban": "Auto-Ban",
  "invite-control": "Invite Control",
  "caps-filter": "Caps Lock Filter",
  "scam-detector": "Scam Detector",
  "new-account-guard": "New Account Guard",
  "emoji-spam": "Emoji Spam Filter",
  "attachment-filter": "Attachment Filter",

  // Support
  "ticket-system": "Ticket System",
  welcome: "Welcome Message",
  goodbye: "Goodbye Message",
  "faq-bot": "FAQ Bot",
  "knowledge-base": "Knowledge Base",
  "reaction-roles": "Reaction Roles",
  "mod-mail": "Mod Mail",
  "staff-status": "Staff On-Duty Status",
  "report-system": "Report System",
  "auto-response": "Auto-Response",
  "suggestion-box": "Suggestion Box",
  "rule-reminder": "Rule Reminder",
  onboarding: "Onboarding Guide",
  "live-chat-escalation": "Live Chat Escalation",
  "feedback-collector": "Feedback Collector",
  "inactivity-notifier": "Inactivity Notifier",
  "poll-creator": "Poll Creator",
  "application-system": "Application System",
  "member-counter": "Member Counter",
  "support-hours": "Support Hours Announcer",

  // Utilities
  announcements: "Announcement System",
  "role-manager": "Role Manager",
  "scheduled-messages": "Scheduled Messages",
  "stats-dashboard": "Server Stats Dashboard",
  "custom-commands": "Custom Commands",
  "music-player": "Music Player",
  "giveaway-manager": "Giveaway Manager",
  "birthday-tracker": "Birthday Tracker",
  "reminder-system": "Reminder System",
  starboard: "Starboard",
  "message-purge": "Message Purge",
  "nickname-manager": "Nickname Manager",
  "channel-locker": "Channel Locker",
  "temp-channels": "Temp Channels",
  "afk-status": "AFK Status",
  "logging-system": "Logging System",
  "embed-builder": "Embed Builder",
  "tag-system": "Tag / Snippet System",
  "translation-bot": "Translation Bot",
  "server-backup": "Server Backup",
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
  "anti-spam": 1.99, "anti-raid": 2.99, "link-filter": 1.99, "profanity-filter": 1.99,
  "alt-detection": 4.99, "mention-guard": 1.99, "nsfw-filter": 3.99, "verification-gate": 2.99,
  slowmode: 1.99, "audit-logger": 3.99, "vpn-blocker": 5.99, "auto-mute": 2.99,
  "auto-kick": 2.99, "auto-ban": 3.99, "invite-control": 1.99, "caps-filter": 0.99,
  "scam-detector": 5.99, "new-account-guard": 3.99, "emoji-spam": 0.99, "attachment-filter": 2.99,
  // Support
  "ticket-system": 4.99, welcome: 1.99, goodbye: 0.99, "faq-bot": 3.99,
  "knowledge-base": 4.99, "reaction-roles": 2.99, "mod-mail": 4.99, "staff-status": 2.99,
  "report-system": 3.99, "auto-response": 2.99, "suggestion-box": 1.99, "rule-reminder": 0.99,
  onboarding: 3.99, "live-chat-escalation": 5.99, "feedback-collector": 2.99,
  "inactivity-notifier": 3.99, "poll-creator": 1.99, "application-system": 4.99,
  "member-counter": 0.99, "support-hours": 1.99,
  // Utilities
  announcements: 2.99, "role-manager": 3.99, "scheduled-messages": 2.99,
  "stats-dashboard": 4.99, "custom-commands": 3.99, "music-player": 5.99,
  "giveaway-manager": 3.99, "birthday-tracker": 1.99, "reminder-system": 1.99,
  starboard: 1.99, "message-purge": 2.99, "nickname-manager": 1.99,
  "channel-locker": 2.99, "temp-channels": 3.99, "afk-status": 0.99,
  "logging-system": 3.99, "embed-builder": 4.99, "tag-system": 2.99,
  "translation-bot": 5.99, "server-backup": 6.99,
};

const ADDON_IDS_BY_BASE: Record<string, string[]> = {
  protection: [
    "anti-spam","anti-raid","link-filter","profanity-filter","alt-detection",
    "mention-guard","nsfw-filter","verification-gate","slowmode","audit-logger",
    "vpn-blocker","auto-mute","auto-kick","auto-ban","invite-control","caps-filter",
    "scam-detector","new-account-guard","emoji-spam","attachment-filter",
  ],
  support: [
    "ticket-system","welcome","goodbye","faq-bot","knowledge-base","reaction-roles",
    "mod-mail","staff-status","report-system","auto-response","suggestion-box",
    "rule-reminder","onboarding","live-chat-escalation","feedback-collector",
    "inactivity-notifier","poll-creator","application-system","member-counter",
    "support-hours",
  ],
  utilities: [
    "announcements","role-manager","scheduled-messages","stats-dashboard",
    "custom-commands","music-player","giveaway-manager","birthday-tracker",
    "reminder-system","starboard","message-purge","nickname-manager",
    "channel-locker","temp-channels","afk-status","logging-system","embed-builder",
    "tag-system","translation-bot","server-backup",
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
