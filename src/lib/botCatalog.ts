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
