/**
 * Per-add-on configuration schema for the Bot Dashboard.
 *
 * Each entry describes the fields a customer would tweak for that add-on
 * (channel, message, role, toggle, etc.). The Bot Dashboard renders a
 * config "box" for every add-on the bot owns, and each box opens a dialog
 * built from this schema.
 *
 * Currently scoped to Protection add-ons. Support / Utilities will follow.
 *
 * NOTE: This is mock UI only — values are kept in component state and a
 * "save" toast is shown. No DB writes.
 */

import type { LucideIcon } from "lucide-react";
import {
  ScrollText,
  ShieldAlert,
  Image as ImageIcon,
  MessageSquareWarning,
  Gavel,
  Hammer,
  Users,
  Lock,
  StickyNote,
  History,
  Snowflake,
  Clock,
  ShieldCheck,
  Shield,
  MessageSquareX,
  Swords,
  ClipboardList,
  Link2Off,
  Sparkles,
  BarChart3,
  FileText,
  UserPlus,
  XCircle,
  MessageSquare,
  Flag,
  Timer,
  EyeOff,
  Music,
  Radio,
  Gamepad2,
  Star,
  Repeat,
  Gift,
  Cake,
  BarChart,
  Bell,
  TrendingUp,
  Coins,
  AlarmClock,
  Megaphone,
} from "lucide-react";

export type AddonFieldType =
  | "channel"
  | "role"
  | "text"
  | "textarea"
  | "number"
  | "toggle"
  | "select"
  | "multiselect";

export type AddonField = {
  key: string;
  label: string;
  type: AddonFieldType;
  placeholder?: string;
  help?: string;
  defaultValue?: string | number | boolean | string[];
  options?: { value: string; label: string }[];
};

export type AddonConfig = {
  /** Short headline shown on the box & dialog title. */
  title: string;
  /** One-liner shown on the box. */
  summary: string;
  /** Lucide icon for the box. */
  icon: LucideIcon;
  /** Form fields rendered inside the dialog. */
  fields: AddonField[];
};

const channel = (key: string, label: string, help?: string): AddonField => ({
  key,
  label,
  type: "channel",
  placeholder: "#channel-name",
  help,
});

const role = (key: string, label: string, help?: string): AddonField => ({
  key,
  label,
  type: "role",
  placeholder: "@role",
  help,
});

const toggle = (
  key: string,
  label: string,
  defaultValue = true,
  help?: string,
): AddonField => ({ key, label, type: "toggle", defaultValue, help });

/**
 * Standard embed-styling fields. Author + Title are meant to render ABOVE
 * the main message/content field; Footer renders below.
 */
const embedHeaderFields = (prefix = ""): AddonField[] => [
  {
    key: `${prefix}embed_author`,
    label: "Embed author",
    type: "text",
    placeholder: "e.g. Server Staff",
    help: "Small line shown above the title. Leave blank to hide.",
  },
  {
    key: `${prefix}embed_title`,
    label: "Embed title",
    type: "text",
    placeholder: "e.g. Welcome!",
    help: "Bold heading at the top of the embed.",
  },
];

const embedFooterFields = (prefix = ""): AddonField[] => [
  {
    key: `${prefix}embed_footer`,
    label: "Embed footer",
    type: "text",
    placeholder: "e.g. Powered by Oversite",
    help: "Small line shown at the bottom of the embed.",
  },
];

/** Backwards-compat: header + footer in one go (author/title first). */
const embedFields = (prefix = ""): AddonField[] => [
  ...embedHeaderFields(prefix),
  ...embedFooterFields(prefix),
];

export const ADDON_CONFIGS: Record<string, AddonConfig> = {
  // ─── Protection: included base features ──────────────────────
  "verification-system": {
    title: "Verification System",
    summary: "Gate new joiners behind a verification step.",
    icon: ShieldCheck,
    fields: [
      channel("channel_id", "Verification channel", "Where the verify button is posted."),
      role("role_id", "Verified role", "Granted once a user verifies."),
      ...embedHeaderFields(),
      {
        key: "message",
        label: "Verification message",
        type: "textarea",
        placeholder: "Click the button below to verify and unlock the server.",
        defaultValue: "Click the button below to verify and unlock the server.",
      },
      ...embedFooterFields(),
      {
        key: "button_label",
        label: "Button label",
        type: "text",
        placeholder: "Verify",
        defaultValue: "Verify",
      },
      {
        key: "min_account_age_days",
        label: "Minimum account age",
        type: "select",
        defaultValue: "0",
        help: "Reject verification from accounts younger than this.",
        options: [
          { value: "0", label: "No minimum" },
          { value: "7", label: "7 days" },
          { value: "14", label: "14 days" },
          { value: "20", label: "20 days" },
          { value: "30", label: "30 days" },
        ],
      },
    ],
  },

  "mod-actions": {
    title: "Warn / Mute / Ban / Kick",
    summary: "Core moderation commands and defaults.",
    icon: Shield,
    fields: [
      role("modRole", "Moderator role", "Who can use these commands."),
      channel("logChannel", "Mod-action log channel"),
      {
        key: "defaultMuteDuration",
        label: "Default mute duration",
        type: "select",
        defaultValue: "1h",
        options: [
          { value: "10m", label: "10 minutes" },
          { value: "1h", label: "1 hour" },
          { value: "6h", label: "6 hours" },
          { value: "1d", label: "1 day" },
        ],
      },
      toggle("dmOnAction", "DM the user when they're warned/muted/banned/kicked"),
      toggle("requireReason", "Require a reason for every action"),
    ],
  },

  "anti-spam": {
    title: "Anti-Spam",
    summary: "Auto-mute users who flood chat.",
    icon: MessageSquareX,
    fields: [
      {
        key: "messageThreshold",
        label: "Messages per 5 seconds before triggering",
        type: "number",
        defaultValue: 6,
      },
      {
        key: "action",
        label: "Action on spam",
        type: "select",
        defaultValue: "mute",
        options: [
          { value: "delete", label: "Delete messages" },
          { value: "mute", label: "Mute user" },
          { value: "kick", label: "Kick user" },
          { value: "ban", label: "Ban user" },
        ],
      },
      {
        key: "muteDuration",
        label: "Mute duration",
        type: "select",
        defaultValue: "10m",
        options: [
          { value: "5m", label: "5 minutes" },
          { value: "10m", label: "10 minutes" },
          { value: "1h", label: "1 hour" },
        ],
      },
      channel("logChannel", "Log channel"),
      toggle("ignoreStaff", "Ignore staff & mods", true),
      {
        key: "exemptRoles",
        label: "Exempt roles from anti-spam",
        type: "text",
        placeholder: "@role, @role, @role",
        help: "Comma-separated roles that bypass anti-spam.",
      },
      {
        key: "pingExemptRoles",
        label: "Exempt roles from mass-ping protection",
        type: "text",
        placeholder: "@role, @role, @role",
        help: "Comma-separated roles allowed to ping multiple members/roles without being flagged.",
      },
    ],
  },

  "anti-raid": {
    title: "Anti-Raid",
    summary: "Detect and shut down mass-join raids automatically.",
    icon: Swords,
    fields: [
      {
        key: "joinThreshold",
        label: "Joins per 10 seconds before triggering",
        type: "number",
        defaultValue: 8,
      },
      {
        key: "actions",
        label: "Actions when raid detected",
        type: "multiselect",
        defaultValue: ["lockdown"],
        help: "Pick one or more — e.g. lock the server AND kick raiders.",
        options: [
          { value: "lockdown", label: "Lock the server" },
          { value: "kick", label: "Kick raiders" },
          { value: "ban", label: "Ban raiders" },
          { value: "timeout", label: "Timeout raiders" },
          { value: "alert", label: "Alert staff only" },
        ],
      },
      channel("alertChannel", "Alert channel"),
      role("pingRole", "Role to ping on raid"),
      toggle("autoUnlock", "Auto-unlock after the raid stops"),
    ],
  },

  "basic-logging": {
    title: "Basic Logging",
    summary: "Logs bans, kicks, and member joins.",
    icon: ClipboardList,
    fields: [
      channel("channel", "Log channel"),
      toggle("logJoins", "Log member joins"),
      toggle("logLeaves", "Log member leaves"),
      toggle("logBans", "Log bans"),
      toggle("logKicks", "Log kicks"),
    ],
  },

  "phishing-detection": {
    title: "Phishing Link Detection",
    summary: "Auto-delete known phishing & scam links.",
    icon: Link2Off,
    fields: [
      {
        key: "action",
        label: "On phishing link",
        type: "select",
        defaultValue: "delete",
        options: [
          { value: "delete", label: "Delete only" },
          { value: "purge-kick", label: "Delete all their messages and kick" },
          { value: "purge-ban", label: "Delete all their messages and ban" },
        ],
      },
      channel("logChannel", "Log channel"),
      {
        key: "extraDomains",
        label: "Extra blocked domains (one per line)",
        type: "textarea",
        placeholder: "scam-site.com\nfake-nitro.gg",
      },
      toggle("scanEdits", "Re-scan messages when edited"),
    ],
  },

  // ─── Protection: paid add-ons ────────────────────────────────
  "advanced-logging": {
    title: "Advanced Logging",
    summary: "Pick which events get logged and where they go.",
    icon: ScrollText,
    fields: [
      channel("channel", "Log channel", "Where every logged event is posted."),
      toggle("logMessages", "Log message edits & deletes"),
      toggle("logMembers", "Log member joins, leaves, role changes"),
      toggle("logVoice", "Log voice channel activity", false),
      toggle("logModeration", "Log moderation actions"),
    ],
  },

  "nsfw-invite-scanner": {
    title: "NSFW Invite Scanner + Censored Logs",
    summary: "Scan invite links and censor logged NSFW content.",
    icon: ShieldAlert,
    fields: [
      channel("channel", "Alert channel"),
      {
        key: "action",
        label: "On NSFW invite",
        type: "select",
        defaultValue: "delete",
        options: [
          { value: "delete", label: "Delete all messages" },
          { value: "purge-kick", label: "Delete all messages and kick" },
          { value: "purge-ban", label: "Delete all messages and ban" },
        ],
      },
      toggle("censorLogs", "Censor NSFW content in log channels"),
      toggle("scanDms", "Scan DMs sent through the bot", false),
    ],
  },

  "avatar-nsfw-detection": {
    title: "Avatar NSFW Detection",
    summary: "Catch NSFW profile pictures on join.",
    icon: ImageIcon,
    fields: [
      channel("channel", "Alert channel"),
      {
        key: "sensitivity",
        label: "Detection sensitivity",
        type: "select",
        defaultValue: "medium",
        options: [
          { value: "low", label: "Low (fewer false positives)" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High (catch more)" },
        ],
      },
      {
        key: "action",
        label: "On detection",
        type: "select",
        defaultValue: "delete",
        options: [
          { value: "delete", label: "Delete all messages" },
          { value: "purge-kick", label: "Delete all messages and kick" },
          { value: "purge-ban", label: "Delete all messages and ban" },
        ],
      },
      ...embedHeaderFields(),
      {
        key: "alertMessage",
        label: "Alert message",
        type: "textarea",
        placeholder: "User {user} joined with a flagged avatar.",
        defaultValue: "User {user} joined with a flagged avatar.",
      },
      ...embedFooterFields(),
    ],
  },

  "bio-phrase-detection": {
    title: "Bio Phrase Detection",
    summary: "Flag members whose bio contains banned phrases.",
    icon: MessageSquareWarning,
    fields: [
      channel("channel", "Alert channel"),
      {
        key: "phrases",
        label: "Banned phrases (one per line)",
        type: "textarea",
        placeholder: "discord.gg/\nfree nitro\nonlyfans",
      },
      {
        key: "action",
        label: "On match",
        type: "select",
        defaultValue: "delete",
        options: [
          { value: "delete", label: "Delete all messages" },
          { value: "purge-kick", label: "Delete all messages and kick" },
          { value: "purge-ban", label: "Delete all messages and ban" },
        ],
      },
    ],
  },

  "auto-escalating-warnings": {
    title: "Auto-Escalating Warnings",
    summary: "Automatically punish users after X warnings.",
    icon: Gavel,
    fields: [
      { key: "muteAt", label: "Mute after X warnings", type: "number", defaultValue: 3 },
      { key: "kickAt", label: "Kick after X warnings", type: "number", defaultValue: 5 },
      { key: "banAt", label: "Ban after X warnings", type: "number", defaultValue: 7 },
      {
        key: "muteDuration",
        label: "Mute duration",
        type: "select",
        defaultValue: "1h",
        options: [
          { value: "10m", label: "10 minutes" },
          { value: "1h", label: "1 hour" },
          { value: "6h", label: "6 hours" },
          { value: "1d", label: "1 day" },
        ],
      },
      channel("channel", "Notification channel"),
    ],
  },

  "softban-massban": {
    title: "/softban and /massban",
    summary: "Power tools for cleaning up raids and spam.",
    icon: Hammer,
    fields: [
      role("allowedRole", "Role allowed to use these commands"),
      channel("logChannel", "Log channel"),
      {
        key: "softbanDeleteDays",
        label: "Softban: delete messages from last N days",
        type: "number",
        defaultValue: 1,
      },
      toggle("requireReason", "Require a reason for every action"),
    ],
  },

  "channel-lockdown": {
    title: "Channel Lockdown Command",
    summary: "Lock channels instantly during raids.",
    icon: Lock,
    fields: [
      role("allowedRole", "Role allowed to lock channels"),
      ...embedHeaderFields(),
      {
        key: "lockMessage",
        label: "Lock announcement",
        type: "textarea",
        defaultValue: "🔒 This channel is now locked. We'll be back shortly.",
      },
      {
        key: "unlockMessage",
        label: "Unlock announcement",
        type: "textarea",
        defaultValue: "🔓 Channel unlocked — thanks for your patience.",
      },
      toggle("lockServerOption", "Allow /lockdown server (locks all channels)"),
      ...embedFooterFields(),
    ],
  },

  "staff-notes": {
    title: "Staff Notes on Users",
    summary: "Private notes only your staff can see.",
    icon: StickyNote,
    fields: [
      role("staffRole", "Staff role (can view & add notes)"),
      toggle("notifyOnNote", "Ping staff role when a new note is added", false),
      {
        key: "maxNotesPerUser",
        label: "Max notes stored per user",
        type: "number",
        defaultValue: 50,
      },
    ],
  },

  "moderation-history": {
    title: "Moderation History",
    summary: "Full punishment history for any user.",
    icon: History,
    fields: [
      role("staffRole", "Role allowed to view history"),
      toggle("includeExpired", "Include expired punishments"),
      {
        key: "retentionDays",
        label: "Retention (days, 0 = forever)",
        type: "number",
        defaultValue: 0,
      },
    ],
  },

  "auto-slowmode": {
    title: "Auto Slowmode on Spam",
    summary: "Slow channels down automatically when activity spikes.",
    icon: Snowflake,
    fields: [
      {
        key: "trigger",
        label: "Trigger: messages per 10 seconds",
        type: "number",
        defaultValue: 15,
      },
      {
        key: "slowmodeSeconds",
        label: "Slowmode to apply (seconds)",
        type: "number",
        defaultValue: 5,
      },
      {
        key: "duration",
        label: "Keep slowmode on for",
        type: "select",
        defaultValue: "5m",
        options: [
          { value: "1m", label: "1 minute" },
          { value: "5m", label: "5 minutes" },
          { value: "15m", label: "15 minutes" },
          { value: "1h", label: "1 hour" },
        ],
      },
      channel("logChannel", "Log channel", "Notifies mods when slowmode triggers."),
    ],
  },

  "temp-ban": {
    title: "Temporary Bans (Auto-Unban)",
    summary: "Bans that automatically expire.",
    icon: Clock,
    fields: [
      role("allowedRole", "Role allowed to issue tempbans"),
      {
        key: "defaultDuration",
        label: "Default duration",
        type: "select",
        defaultValue: "1d",
        options: [
          { value: "1h", label: "1 hour" },
          { value: "1d", label: "1 day" },
          { value: "7d", label: "7 days" },
          { value: "30d", label: "30 days" },
        ],
      },
      channel("logChannel", "Log channel"),
      toggle("dmOnBan", "DM the user when they're banned"),
      toggle("dmOnUnban", "DM the user when they're unbanned", false),
    ],
  },

  // ─── Support add-ons ─────────────────────────────────────────
  messages: {
    title: "Messages",
    summary: "Send custom messages and rich embeds with a Discohook-style builder.",
    icon: Megaphone,
    fields: [],
  },

  "staff-performance": {
    title: "Staff Performance Tracking",
    summary: "Track tickets handled, response times, and activity per staff member.",
    icon: BarChart3,
    fields: [
      role("staffRole", "Staff role to track"),
      channel("reportChannel", "Weekly report channel"),
      {
        key: "reportFrequency",
        label: "Report frequency",
        type: "select",
        defaultValue: "weekly",
        options: [
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ],
      },
      toggle("trackResponseTime", "Track first-response time"),
      toggle("trackResolutionTime", "Track ticket resolution time"),
    ],
  },

  "ticket-logs": {
    title: "Ticket Logs",
    summary: "Save full transcripts of every closed ticket.",
    icon: FileText,
    fields: [
      channel("logChannel", "Transcript log channel"),
      {
        key: "format",
        label: "Transcript format",
        type: "select",
        defaultValue: "html",
        options: [
          { value: "html", label: "HTML file" },
          { value: "txt", label: "Plain text" },
          { value: "embed", label: "Discord embed" },
        ],
      },
      toggle("dmUser", "DM the transcript to the user", false),
      toggle("includeAttachments", "Include attachments"),
    ],
  },

  "ticket-notes": {
    title: "Ticket Notes",
    summary: "Internal staff-only notes attached to tickets.",
    icon: StickyNote,
    fields: [
      role("staffRole", "Role allowed to add notes"),
      toggle("notifyOnNote", "Ping staff when a new note is added", false),
      toggle("includeInTranscript", "Include notes in ticket transcripts", false),
    ],
  },

  "ticket-add-remove": {
    title: "Add / Remove Members",
    summary: "Pull other members or roles into a ticket.",
    icon: UserPlus,
    fields: [
      role("staffRole", "Role allowed to add/remove members"),
      toggle("logChanges", "Log every add/remove inside the ticket"),
      toggle("allowUserAdd", "Let ticket opener add their own friends", false),
    ],
  },

  "close-all-tickets": {
    title: "Close All Tickets",
    summary: "Mass-close every open ticket with one command.",
    icon: XCircle,
    fields: [
      role("allowedRole", "Role allowed to use /closeall"),
      toggle("requireConfirmation", "Require a confirmation prompt"),
      toggle("saveTranscripts", "Save transcripts before closing"),
      {
        key: "closeMessage",
        label: "Closing message",
        type: "textarea",
        defaultValue: "This ticket is being closed as part of a mass close. Reopen if needed.",
      },
    ],
  },

  "ticket-message-customization": {
    title: "Ticket Message Customization",
    summary: "Customize the panel, opening, and closing messages.",
    icon: MessageSquare,
    fields: [
      ...embedHeaderFields(),
      {
        key: "panelTitle",
        label: "Panel title",
        type: "text",
        defaultValue: "Need help? Open a ticket",
      },
      {
        key: "panelDescription",
        label: "Panel description",
        type: "textarea",
        defaultValue: "Click the button below to open a ticket with our staff.",
      },
      {
        key: "openMessage",
        label: "Ticket opening message",
        type: "textarea",
        defaultValue: "Hey {user}, a staff member will be with you shortly.",
      },
      {
        key: "closeMessage",
        label: "Ticket closing message",
        type: "textarea",
        defaultValue: "This ticket has been closed. Thanks for reaching out!",
      },
      { key: "embedColor", label: "Embed accent color (hex)", type: "text", placeholder: "#5865F2" },
      ...embedFooterFields(),
    ],
  },

  "priority-flagging": {
    title: "Priority Ticket Flagging",
    summary: "Mark tickets as low / normal / high / urgent.",
    icon: Flag,
    fields: [
      role("staffRole", "Role allowed to set priority"),
      role("urgentPingRole", "Role to ping on urgent tickets"),
      channel("urgentChannel", "Urgent ticket alert channel"),
      toggle("colorCodeChannel", "Color-code ticket channel names by priority"),
    ],
  },

  "auto-close-inactive": {
    title: "Auto-Close Inactive Tickets",
    summary: "Automatically close tickets with no activity.",
    icon: Timer,
    fields: [
      {
        key: "inactivityHours",
        label: "Close after X hours of inactivity",
        type: "number",
        defaultValue: 48,
      },
      {
        key: "warnHoursBefore",
        label: "Warn user X hours before closing",
        type: "number",
        defaultValue: 12,
      },
      ...embedHeaderFields(),
      {
        key: "warnMessage",
        label: "Inactivity warning message",
        type: "textarea",
        defaultValue: "This ticket will close soon due to inactivity. Reply to keep it open.",
      },
      toggle("saveTranscript", "Save a transcript on auto-close"),
      ...embedFooterFields(),
    ],
  },

  "anonymous-reporting": {
    title: "Anonymous Reporting",
    summary: "Let members report users without revealing their identity.",
    icon: EyeOff,
    fields: [
      channel("reportChannel", "Anonymous report channel"),
      role("staffRole", "Role that can view reports"),
      toggle("requireEvidence", "Require evidence (screenshot/link)", false),
      {
        key: "cooldownMinutes",
        label: "Cooldown between reports per user (minutes)",
        type: "number",
        defaultValue: 10,
      },
    ],
  },

  // ─── Utilities add-ons ───────────────────────────────────────
  "music-addon": {
    title: "Music Add-On",
    summary: "Play music in voice channels from YouTube, Spotify, and more.",
    icon: Music,
    fields: [
      role("djRole", "DJ role (can skip / control playback)"),
      toggle("everyoneCanQueue", "Let everyone add songs to the queue"),
      {
        key: "maxQueueLength",
        label: "Max queue length",
        type: "number",
        defaultValue: 100,
      },
      {
        key: "defaultVolume",
        label: "Default volume (1-100)",
        type: "number",
        defaultValue: 50,
      },
      toggle("autoLeaveEmpty", "Auto-leave when voice channel is empty"),
    ],
  },

  "auto-radio": {
    title: "Auto Radio by Genre",
    summary: "24/7 music streaming by genre in a voice channel.",
    icon: Radio,
    fields: [
      channel("voiceChannel", "Voice channel for radio"),
      {
        key: "genre",
        label: "Default genre",
        type: "select",
        defaultValue: "lofi",
        options: [
          { value: "lofi", label: "Lo-fi" },
          { value: "pop", label: "Pop" },
          { value: "rock", label: "Rock" },
          { value: "edm", label: "EDM" },
          { value: "hiphop", label: "Hip-hop" },
          { value: "classical", label: "Classical" },
          { value: "jazz", label: "Jazz" },
          { value: "country", label: "Country" },
        ],
      },
      toggle("autoStart", "Start automatically when bot comes online"),
      toggle("allowGenreVote", "Let members vote to change the genre"),
    ],
  },

  "roblox-verification": {
    title: "Roblox Verification",
    summary: "Link Discord accounts to Roblox profiles.",
    icon: Gamepad2,
    fields: [
      channel("verifyChannel", "Verification channel"),
      role("verifiedRole", "Role given to verified users"),
      {
        key: "groupId",
        label: "Roblox group ID (optional)",
        type: "text",
        placeholder: "123456",
        help: "If set, only members of this group can verify.",
      },
      toggle("syncNickname", "Sync Discord nickname to Roblox username"),
      toggle("syncGroupRoles", "Sync Discord roles to Roblox group ranks", false),
    ],
  },

  starboard: {
    title: "Starboard",
    summary: "Highlight popular messages in a starboard channel.",
    icon: Star,
    fields: [
      channel("starboardChannel", "Starboard channel"),
      {
        key: "starsRequired",
        label: "Stars required to post",
        type: "number",
        defaultValue: 5,
      },
      {
        key: "emoji",
        label: "Reaction emoji",
        type: "text",
        defaultValue: "⭐",
      },
      toggle("allowSelfStar", "Allow users to star their own messages", false),
      toggle("ignoreNsfw", "Ignore messages from NSFW channels"),
    ],
  },

  "recurring-messages": {
    title: "Recurring Messages",
    summary: "Auto-post messages on a schedule.",
    icon: Repeat,
    fields: [
      {
        key: "messages",
        label: "Scheduled messages (one per line)",
        type: "textarea",
        placeholder: "#general | 6h | Don't forget to read the rules!\n#announcements | 1d | Daily check-in",
        help: "Format: #channel | interval | message",
      },
      toggle("deletePrevious", "Delete the previous post before sending the next"),
    ],
  },

  "giveaway-system": {
    title: "Giveaway System",
    summary: "Run timed giveaways with auto-picked winners.",
    icon: Gift,
    fields: [
      role("hostRole", "Role allowed to host giveaways"),
      channel("defaultChannel", "Default giveaway channel"),
      {
        key: "emoji",
        label: "Entry reaction emoji",
        type: "text",
        defaultValue: "🎉",
      },
      toggle("requireMembership", "Require a specific role to enter", false),
      toggle("dmWinners", "DM winners when picked"),
    ],
  },

  "birthday-announcements": {
    title: "Birthday Announcements",
    summary: "Wish members happy birthday in a channel.",
    icon: Cake,
    fields: [
      channel("channel", "Birthday channel"),
      role("birthdayRole", "Role to give on someone's birthday"),
      ...embedHeaderFields(),
      {
        key: "message",
        label: "Birthday message",
        type: "textarea",
        defaultValue: "🎂 Happy birthday {user}! Have an amazing day!",
      },
      {
        key: "announceTime",
        label: "Announce at (24h, server time)",
        type: "select",
        defaultValue: "09:00",
        options: [
          { value: "00:00", label: "Midnight" },
          { value: "09:00", label: "9:00 AM" },
          { value: "12:00", label: "Noon" },
          { value: "18:00", label: "6:00 PM" },
        ],
      },
      ...embedFooterFields(),
    ],
  },

  "server-stats-channels": {
    title: "Server Stats Channels",
    summary: "Voice channels showing live member counts.",
    icon: BarChart,
    fields: [
      toggle("showTotalMembers", "Show total members"),
      toggle("showOnlineMembers", "Show online members"),
      toggle("showBots", "Show bot count", false),
      toggle("showBoosts", "Show boost count"),
      {
        key: "format",
        label: "Channel name format",
        type: "text",
        defaultValue: "📊 Members: {count}",
        help: "Use {count} as the placeholder.",
      },
      {
        key: "updateMinutes",
        label: "Update interval (minutes)",
        type: "number",
        defaultValue: 10,
      },
    ],
  },

  "live-notifications": {
    title: "Twitch / YouTube Notifications",
    summary: "Ping a channel when streamers go live or post videos.",
    icon: Bell,
    fields: [
      channel("channel", "Notification channel"),
      role("pingRole", "Role to ping"),
      {
        key: "twitchChannels",
        label: "Twitch channels (one per line)",
        type: "textarea",
        placeholder: "username1\nusername2",
      },
      {
        key: "youtubeChannels",
        label: "YouTube channels (one per line)",
        type: "textarea",
        placeholder: "UCxxxxxxxxxxxxxxxxxxxxxx\nUCyyyyyyyyyyyyyyyyyyyyyy",
      },
      {
        key: "message",
        label: "Notification message",
        type: "textarea",
        defaultValue: "🔴 {streamer} just went live! {url}",
      },
      ...embedFields(),
    ],
  },

  "leveling-system": {
    title: "Leveling System",
    summary: "XP and levels for chat activity, with role rewards.",
    icon: TrendingUp,
    fields: [
      channel("levelUpChannel", "Level-up announcement channel", "Leave blank to ping in current channel."),
      {
        key: "xpPerMessage",
        label: "XP per message",
        type: "number",
        defaultValue: 15,
      },
      {
        key: "cooldownSeconds",
        label: "XP cooldown (seconds)",
        type: "number",
        defaultValue: 60,
      },
      {
        key: "roleRewards",
        label: "Level role rewards (one per line)",
        type: "textarea",
        placeholder: "5: @Active\n10: @Regular\n25: @Veteran",
        help: "Format: level: @role",
      },
      toggle("stackRoles", "Stack roles (keep old ones on level up)", false),
      toggle("ignoreBots", "Ignore bot messages"),
    ],
  },

  "economy-system": {
    title: "Economy System",
    summary: "Virtual currency, daily rewards, and a shop.",
    icon: Coins,
    fields: [
      {
        key: "currencyName",
        label: "Currency name",
        type: "text",
        defaultValue: "coins",
      },
      {
        key: "currencyEmoji",
        label: "Currency emoji",
        type: "text",
        defaultValue: "🪙",
      },
      {
        key: "dailyAmount",
        label: "Daily reward amount",
        type: "number",
        defaultValue: 100,
      },
      {
        key: "workCooldownMinutes",
        label: "/work cooldown (minutes)",
        type: "number",
        defaultValue: 30,
      },
      toggle("enableShop", "Enable role shop"),
      toggle("enableGambling", "Enable gambling commands", false),
    ],
  },

  remindme: {
    title: "/remindme",
    summary: "Personal reminders sent via DM or in-channel.",
    icon: AlarmClock,
    fields: [
      {
        key: "maxPerUser",
        label: "Max active reminders per user",
        type: "number",
        defaultValue: 25,
      },
      {
        key: "deliveryMethod",
        label: "Delivery method",
        type: "select",
        defaultValue: "dm",
        options: [
          { value: "dm", label: "Direct message" },
          { value: "channel", label: "Original channel" },
          { value: "both", label: "Both" },
        ],
      },
      toggle("allowRecurring", "Allow recurring reminders"),
    ],
  },

  // ─── Shared extras ───────────────────────────────────────────
  "branding-multi-server": {
    title: "Multi-Server License & Custom Branding",
    summary: "Run your bot across multiple servers and match your brand.",
    icon: Sparkles,
    fields: [
      toggle("multiServerEnabled", "Enable multi-server license", true,
        "Allow this bot to be added to more than one Discord server."),
      {
        key: "allowedServerIds",
        label: "Allowed server IDs (one per line)",
        type: "textarea",
        placeholder: "123456789012345678\n987654321098765432",
        help: "Leave blank to allow every server you invite the bot to.",
      },
      { key: "brandName", label: "Brand / bot display name", type: "text",
        placeholder: "Your community name" },
      { key: "brandColor", label: "Accent color (hex)", type: "text",
        placeholder: "#5865F2" },
      { key: "brandFooter", label: "Footer text on embeds", type: "text",
        placeholder: "Powered by Your Community" },
      { key: "brandIconUrl", label: "Embed icon URL", type: "text",
        placeholder: "https://..." },
    ],
  },
};

export function getAddonConfig(id: string): AddonConfig | null {
  return ADDON_CONFIGS[id] ?? null;
}
