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
  | "multirole"
  | "text"
  | "textarea"
  | "number"
  | "toggle"
  | "select"
  | "multiselect"
  | "header";

export type AddonField = {
  key: string;
  label: string;
  type: AddonFieldType;
  placeholder?: string;
  help?: string;
  defaultValue?: string | number | boolean | string[];
  options?: { value: string; label: string }[];
  /** For type: "channel" — restrict which channel_type values are selectable. */
  channelTypes?: string[];
  /** For type: "textarea" — render with the Discord markdown formatting toolbar. */
  markdown?: boolean;
  /** Optional: only render this field when the predicate returns true for current form values. */
  visibleIf?: (values: Record<string, string | number | boolean | string[]>) => boolean;
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

const voiceChannel = (key: string, label: string, help?: string): AddonField => ({
  key,
  label,
  type: "channel",
  placeholder: "Select a voice channel",
  help,
  channelTypes: ["voice"],
});

const role = (key: string, label: string, help?: string): AddonField => ({
  key,
  label,
  type: "role",
  placeholder: "@role",
  help,
});

const multirole = (key: string, label: string, help?: string): AddonField => ({
  key,
  label,
  type: "multirole",
  placeholder: "@role",
  help,
  defaultValue: [],
});

const toggle = (
  key: string,
  label: string,
  defaultValue = true,
  help?: string,
): AddonField => ({ key, label, type: "toggle", defaultValue, help });

const header = (label: string): AddonField => ({ key: `__header_${label}`, label, type: "header" });


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
      channel("log_channel_id", "Verification logging channel", "Where verification attempts and results are logged."),
      role("role_id", "Verified role", "Granted once a user verifies."),
      {
        key: "verification_type",
        label: "Verification type",
        type: "select",
        defaultValue: "one_click",
        help: "How users prove they're human.",
        options: [
          { value: "one_click", label: "One-Click" },
          { value: "captcha_code", label: "Captcha Text" },
          { value: "web_captcha", label: "Web Captcha" },
        ],
      },
      {
        key: "captcha_length",
        label: "Captcha length",
        type: "number",
        defaultValue: 6,
        help: "Number of characters in the captcha code (4–8).",
        visibleIf: (v) => v.verification_type === "captcha_code",
      },
      {
        key: "captcha_difficulty",
        label: "Captcha difficulty",
        type: "select",
        defaultValue: "medium",
        options: [
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" },
        ],
        visibleIf: (v) => v.verification_type === "captcha_code",
      },
      {
        key: "web_captcha_provider",
        label: "Web captcha provider",
        type: "select",
        defaultValue: "hcaptcha",
        options: [
          { value: "hcaptcha", label: "hCaptcha" },
          { value: "turnstile", label: "Cloudflare Turnstile" },
        ],
        visibleIf: (v) => v.verification_type === "web_captcha",
      },
      {
        key: "web_captcha_site_key",
        label: "Site key",
        type: "text",
        placeholder: "Your hCaptcha / Turnstile site key",
        help: "Public site key issued by your captcha provider.",
        visibleIf: (v) => v.verification_type === "web_captcha",
      },
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
      toggle("vpn_block_enabled", "VPN Blocking", false, "Block users connecting through VPNs during verification."),
      {
        key: "vpn_block_iphub_key",
        label: "IPHub API Key",
        type: "text",
        placeholder: "Your IPHub API key",
        help: "API key for IPHub VPN detection service.",
        visibleIf: (v) => !!v.vpn_block_enabled,
      },
    ],

  },

  "mod-actions": {
    title: "Moderate Commands",
    summary: "Core moderation commands and defaults.",
    icon: Shield,
    fields: [
      multirole("modRole", "Moderator roles", "Roles allowed to use these commands."),
      channel("logChannel", "Mod-action log channel"),
      {
        key: "defaultMuteDuration",
        label: "Default mute duration",
        type: "select",
        defaultValue: "60",
        options: [
          { value: "10", label: "10 minutes" },
          { value: "60", label: "1 hour" },
          { value: "360", label: "6 hours" },
          { value: "1440", label: "1 day" },
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
        type: "multiselect",
        defaultValue: ["mute"],
        help: "Pick one or more — e.g. delete the messages AND mute the user.",
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
      multirole("exemptRoles", "Exempt roles from anti-spam", "Roles that bypass anti-spam."),
      multirole(
        "pingExemptRoles",
        "Exempt roles from mass-ping protection",
        "Roles allowed to ping multiple members/roles without being flagged.",
      ),
    ],
  },

  "anti-raid": {
    title: "Anti-Raid",
    summary: "Detect and shut down mass-join raids automatically.",
    icon: Swords,
    fields: [
      header("Detection"),
      {
        key: "score_limit",
        label: "Score limit",
        type: "number",
        defaultValue: 20,
        help: "Combined score needed within the window to trigger raid protection.",
      },
      {
        key: "score_window",
        label: "Score window",
        type: "select",
        defaultValue: "5",
        help: "How long to track combined scores.",
        options: [
          { value: "1", label: "1 minute" },
          { value: "2", label: "2 minutes" },
          { value: "5", label: "5 minutes" },
          { value: "10", label: "10 minutes" },
        ],
      },
      {
        key: "no_avatar_score",
        label: "No avatar score",
        type: "number",
        defaultValue: 2,
        help: "Points added for accounts with no profile picture.",
      },
      {
        key: "account_age_score",
        label: "Account age score",
        type: "number",
        defaultValue: 5,
        help: "Points added for new accounts.",
      },
      {
        key: "join_speed_score",
        label: "Join speed score",
        type: "number",
        defaultValue: 3,
        help: "Points added when a member joins within the threshold of the previous join.",
      },
      {
        key: "join_speed_threshold",
        label: "Join speed threshold (seconds)",
        type: "number",
        defaultValue: 5,
        help: "How fast between joins counts as 'too fast'.",
      },
      {
        key: "join_row_score",
        label: "Join row score",
        type: "number",
        defaultValue: 4,
        help: "Extra points when multiple rapid joins happen consecutively.",
      },
      header("Bypass"),
      toggle(
        "badge_bypass",
        "Badge bypass",
        true,
        "Accounts with Nitro / Partner / HypeSquad / Verified badges skip detection.",
      ),
      {
        key: "account_age_bypass_days",
        label: "Account age bypass (days)",
        type: "number",
        defaultValue: 0,
        help: "Accounts older than this many days skip detection. Set to 0 to disable.",
      },
      header("Punishment"),
      {
        key: "punishment_type",
        label: "Punishment type",
        type: "select",
        defaultValue: "ban",
        options: [
          { value: "ban", label: "Ban" },
          { value: "kick", label: "Kick" },
          { value: "mute", label: "Mute" },
        ],
      },
      {
        key: "punishment_duration",
        label: "Punishment duration",
        type: "select",
        defaultValue: "1d",
        options: [
          { value: "1h", label: "1 hour" },
          { value: "6h", label: "6 hours" },
          { value: "1d", label: "1 day" },
          { value: "2d", label: "2 days" },
          { value: "7d", label: "7 days" },
          { value: "permanent", label: "Permanent" },
        ],
        visibleIf: (v) => v.punishment_type === "ban" || v.punishment_type === "mute",
      },
      toggle(
        "auto_recovery",
        "Auto recovery",
        false,
        "Automatically unban and reinvite members banned during a raid.",
      ),
      header("Logging"),
      channel("alert_channel_id", "Alert channel", "Where raid alerts and per-join score logs are posted."),
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
      role("alertRole", "Alert role", "Role pinged when a phishing link is detected."),
      {
        key: "extraDomains",
        label: "Extra blocked domains (one per line)",
        type: "textarea",
        placeholder: "scam-site.com\nfake-nitro.gg",
      },
      toggle("scanEdits", "Re-scan messages when edited"),
    ],
  },

  "auto-role": {
    title: "Auto Role on Join",
    summary: "Automatically give roles to new members when they join.",
    icon: UserPlus,
    fields: [
      multirole("roles", "Roles to assign on join", "Every new member will receive these roles automatically."),
      toggle("skipBots", "Skip bots", true, "Don't auto-assign roles to bot accounts."),
    ],
  },

  // ─── Protection: paid add-ons ────────────────────────────────
  "advanced-logging": {
    title: "Advanced Logging",
    summary: "Pick which events get logged and where they go.",
    icon: ScrollText,
    fields: [
      channel("channel", "Log channel", "Where every logged event is posted."),
      toggle("logMessagesSent", "Log messages sent"),
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
      channel("alertChannel", "Alert channel"),
      role("alertRole", "Alert role", "Role pinged when an NSFW invite is detected."),
      {
        key: "action",
        label: "On NSFW invite",
        type: "select",
        defaultValue: "delete",
        options: [
          { value: "delete", label: "Delete message" },
          { value: "ban", label: "Ban user" },
          { value: "delete_and_ban", label: "Delete message and ban" },
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
      { key: "strikeLimit", label: "Strikes before mute", type: "number", defaultValue: 3 },
      {
        key: "muteDurationMinutes",
        label: "Mute duration (minutes)",
        type: "number",
        defaultValue: 60,
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
      multirole("softbanRole", "Softban allowed roles", "Roles allowed to use /softban."),
      multirole("massbanRole", "Massban allowed roles", "Roles allowed to use /massban."),
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

  "ban-tools": {
    title: "/softban, /massban & Temp Bans",
    summary: "Power ban tools — softban, massban, and time-limited bans in one place.",
    icon: Hammer,
    fields: [
      // ── Softban / Massban ──
      multirole("softbanRole", "Softban allowed roles", "Roles allowed to use /softban."),
      multirole("massbanRole", "Massban allowed roles", "Roles allowed to use /massban."),
      channel("logChannel", "Softban / Massban log channel"),
      {
        key: "softbanDeleteDays",
        label: "Softban: delete messages from last N days",
        type: "number",
        defaultValue: 1,
      },
      toggle("requireReason", "Require a reason for softban / massban"),
      // ── Temp Ban ──
      multirole("tempbanAllowedRole", "Tempban allowed roles", "Roles allowed to use /tempban."),
      {
        key: "tempbanDefaultDuration",
        label: "Tempban default duration",
        type: "select",
        defaultValue: "1d",
        options: [
          { value: "1h", label: "1 hour" },
          { value: "1d", label: "1 day" },
          { value: "7d", label: "7 days" },
          { value: "30d", label: "30 days" },
        ],
      },
      channel("tempbanLogChannel", "Tempban log channel"),
      toggle("tempbanDmOnBan", "DM the user when they're tempbanned"),
      toggle("tempbanDmOnUnban", "DM the user when they're auto-unbanned", false),
    ],
  },

  "channel-lockdown": {
    title: "Channel Lockdown Command",
    summary: "Lock channels instantly during raids.",
    icon: Lock,
    fields: [
      multirole("allowedRoles", "Allowed roles", "Roles allowed to use /lock and /unlock."),
      {
        key: "lockMessage",
        label: "Lock message (plain text)",
        type: "text",
        placeholder: "🔒 This channel is now locked.",
      },
      {
        key: "unlockMessage",
        label: "Unlock message (plain text)",
        type: "text",
        placeholder: "🔓 Channel unlocked.",
      },
    ],
  },

  "staff-notes": {
    title: "Staff Notes on Users",
    summary: "Private notes only your staff can see.",
    icon: StickyNote,
    fields: [
      multirole("allowedRoles", "Allowed roles", "Roles allowed to view and add staff notes."),
    ],
  },

  "moderation-history": {
    title: "Moderation History",
    summary: "Full punishment history for any user.",
    icon: History,
    fields: [
      multirole("viewerRole", "Viewer roles", "Roles allowed to view moderation history."),
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

  rules: {
    title: "Rules",
    summary: "Write your server rules with the same builder as Messages. Posted when members run /rules.",
    icon: ScrollText,
    fields: [],
  },

  "invite-message": {
    title: "Join Message",
    summary: "Design the message posted when a new member joins, using the same builder as Messages.",
    icon: UserPlus,
    fields: [
      channel("channel_id", "Join channel", "Where new-member join messages are posted."),
    ],
  },

  "customs-messages": {
    title: "Messages",
    summary: "Send custom messages and rich embeds to any channel with the Discohook-style builder.",
    icon: Megaphone,
    fields: [
      channel("channel_id", "Post channel", "Where this message will be sent."),
    ],
  },

  "customs-tickets": {
    title: "Tickets",
    summary: "Support ticket categories, staff roles, and transcript logging.",
    icon: ClipboardList,
    fields: [
      {
        key: "category_id",
        label: "Ticket Channel",
        type: "channel",
        channelTypes: ["category", "text", "announcement"],
        help: "Where tickets go — pick a category (tickets open under it) or a channel.",
      },
      channel("panel_channel_id", "Panel channel", "The channel the ticket panel message is posted to on Save."),
      channel("log_channel_id", "Ticket Log Channel", "Where closed-ticket transcripts are posted."),
      toggle("ping_support", "Ping support roles when a ticket opens", true),
      toggle("one_per_user", "Limit each member to one open ticket", true),
      toggle(
        "delete_category_when_empty",
        "Delete the ticket category when empty",
        false,
        "On: the category is removed when it has no open tickets and recreated when the next ticket opens. Off: it's always kept — and created as soon as you save.",
      ),
    ],
  },

  "customs-credits": {
    title: "Credits",
    summary: "Server credit balances — manager roles, currency name, and a log channel.",
    icon: Coins,
    fields: [
      multirole("manager_role_ids", "Credit manager roles", "Roles allowed to grant, remove, and adjust credits."),
      {
        key: "currency_name",
        label: "Currency name",
        type: "text",
        defaultValue: "credits",
        placeholder: "credits",
        help: "What one unit is called (e.g. credits, points, tokens).",
      },
      channel("log_channel_id", "Credit log channel", "Where credit grants/removals are logged."),
    ],
  },

  "customs-verification": {
    title: "Verification",
    summary: "Roblox verification — members link their Roblox account, get a role, and their nickname is set to their Roblox name.",
    icon: ShieldCheck,
    fields: [
      channel("channel_id", "Verify channel", "Where the Verify button is posted."),
      role("verified_role_id", "Verified role", "Given to members once they link their Roblox account."),
      toggle("set_nickname", "Set nickname to Roblox username", true, "Rename the member to their Roblox display name after they verify."),
      channel("log_channel_id", "Verification log channel", "Where successful verifications are logged. Optional."),
      header("Verify button"),
      {
        key: "verify_button_label",
        label: "Button label",
        type: "text",
        defaultValue: "Verify",
        placeholder: "Verify",
        help: "Text on the Verify button. Add an emoji by typing it in, e.g. ✅ Verify.",
      },
      {
        key: "verify_button_style",
        label: "Button color",
        type: "select",
        defaultValue: "primary",
        options: [
          { value: "primary", label: "Blurple" },
          { value: "success", label: "Green" },
          { value: "secondary", label: "Grey" },
          { value: "danger", label: "Red" },
        ],
      },
      header("Roblox OAuth app"),
      {
        key: "roblox_client_id",
        label: "Roblox OAuth Client ID",
        type: "text",
        placeholder: "e.g. 1234567890123456789",
        help: "From create.roblox.com → Credentials. Set the app's redirect URL to your bot's verify callback.",
      },
      {
        key: "roblox_client_secret",
        label: "Roblox OAuth Client Secret",
        type: "text",
        placeholder: "RBX-…",
        help: "Keep this private — it's the secret from your Roblox OAuth app.",
      },
    ],
  },

  "staff-performance": {
    title: "Staff Performance Tracking",
    summary: "Track tickets handled, response times, and activity per staff member.",
    icon: BarChart3,
    fields: [
      multirole("staffRoles", "Staff roles to track", "Members with any of these roles will be tracked."),
      multirole("viewerRoleIds", "Roles allowed to view stats", "Members with any of these roles can run /staffstats."),
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
      header("Tracked Metrics"),
      toggle("trackClaimed", "Tickets Claimed", true),
      toggle("trackClosed", "Tickets Closed", true),
      toggle("trackMessages", "Messages Sent", false),
      toggle("trackCommands", "Commands Used", false),
      toggle("trackProactive", "Proactive Claims", false),
      toggle("trackResponseTime", "Avg Response Time", true),
      toggle("trackResolutionTime", "Avg Resolution Time", true),
    ],
  },


  "ticket-notes": {
    title: "Ticket Notes",
    summary: "Internal staff-only notes attached to tickets.",
    icon: StickyNote,
    fields: [
      multirole("allowedRoleIds", "Roles allowed to add notes"),
      toggle("pingStaff", "Ping staff when a new note is added", false),
      toggle("includeInTranscript", "Include notes in ticket transcripts", false),
    ],
  },

  "ticket-add-remove": {
    title: "Add / Remove Members",
    summary: "Pull other members or roles into a ticket.",
    icon: UserPlus,
    fields: [
      multirole("allowedRoleIds", "Roles allowed to add/remove members"),
      toggle("logActions", "Log every add/remove inside the ticket"),
      toggle("openerCanAdd", "Let ticket opener add their own friends", false),
    ],
  },

  "close-all-tickets": {
    title: "Close All Tickets",
    summary: "Mass-close every open ticket with one command.",
    icon: XCircle,
    fields: [
      multirole("allowedRoleIds", "Roles allowed to use /closeall"),
      toggle("requireConfirmation", "Require a confirmation prompt"),
      toggle("saveTranscripts", "Save transcripts before closing"),
      {
        key: "closingMessage",
        label: "Closing message",
        type: "textarea",
        defaultValue: "This ticket is being closed as part of a mass close. Reopen if needed.",
      },
    ],
  },

  "ticket-message-customization": {
    title: "Post Ticket",
    summary: "Panel channel, panel message, categories, and logging.",
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

  "ticket-lifecycle-messages": {
    title: "Ticket Lifecycle Messages",
    summary: "Reword the bot's claim, close, reopen, and priority messages using the V2 component builder.",
    icon: MessageSquare,
    fields: [],
  },


  "ticket-editor": {
    title: "Ticket Panel Edit",
    summary: "Edit the contents of ticket panels you've already posted.",
    icon: ClipboardList,
    fields: [],
  },


  "priority-flagging": {
    title: "Priority Ticket Flagging",
    summary: "Mark tickets as low / normal / high / urgent.",
    icon: Flag,
    fields: [
      multirole("setterRoleIds", "Roles allowed to set priority"),
      multirole("pingRoleIds", "Roles to ping on urgent tickets"),
      channel("urgentChannel", "Urgent ticket alert channel"),
      toggle("colorCodeNames", "Color-code ticket channel names by priority"),
    ],
  },

  "auto-close-inactive": {
    title: "Auto-Close Inactive Tickets",
    summary: "Automatically close tickets with no activity.",
    icon: Timer,
    fields: [
      {
        key: "close_after_hours",
        label: "Close after X hours of inactivity",
        type: "number",
        defaultValue: 48,
      },
      {
        key: "warn_before_hours",
        label: "Warn user X hours before closing",
        type: "number",
        defaultValue: 12,
      },
      ...embedHeaderFields(),
      {
        key: "warning_message",
        label: "Inactivity warning message",
        type: "textarea",
        defaultValue: "This ticket will close soon due to inactivity. Reply to keep it open.",
      },
      toggle("save_transcript", "Save a transcript on auto-close"),
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

  "post-system": {
    title: "Post System",
    summary: "Configurable post templates members can submit via /post.",
    icon: FileText,
    fields: [],
  },



  // ─── Utilities add-ons ───────────────────────────────────────
  "music-addon": {
    title: "Music Add-On",
    summary: "Play music in voice channels from YouTube, Spotify, and more.",
    icon: Music,
    fields: [
      multirole("dj_role_ids", "DJ roles (can skip / control playback)"),
      toggle("everyone_can_queue", "Let everyone add songs to the queue"),
      {
        key: "max_queue_length",
        label: "Max queue length",
        type: "number",
        defaultValue: 100,
      },
      {
        key: "default_volume",
        label: "Default volume (1-100)",
        type: "number",
        defaultValue: 50,
      },
      toggle("auto_leave", "Auto-leave when voice channel is empty"),
      toggle(
        "now_playing_v2",
        "Modern Now Playing UI",
        false,
        "Use Discord's new card-style Now Playing layout with built-in controls instead of the classic embed.",
      ),
    ],
  },

  "auto-radio": {
    title: "Auto Radio by Genre",
    summary: "24/7 music streaming by genre in a voice channel.",
    icon: Radio,
    fields: [
      voiceChannel("voice_channel_id", "Voice channel for radio"),
      {
        key: "genre",
        label: "Default genre",
        type: "select",
        defaultValue: "pop",
        options: [
          { value: "pop", label: "Pop" },
          { value: "country", label: "Country" },
          { value: "classical", label: "Classical" },
          { value: "jazz", label: "Jazz" },
          { value: "world", label: "World" },
          { value: "rockalternative", label: "Rock & Alternative" },
          { value: "rnbhiphop", label: "R&B / Hip-Hop" },
          { value: "latin", label: "Latin" },
          { value: "dance", label: "Dance" },
          { value: "christian", label: "Christian" },
          { value: "gospel", label: "Gospel" },
          { value: "all", label: "All Genres" },
        ],
      },
      toggle("auto_start", "Start automatically when bot comes online"),
      toggle("allow_vote", "Let members vote to change the genre"),
    ],
  },


  starboard: {
    title: "Starboard",
    summary: "Highlight popular messages in a starboard channel.",
    icon: Star,
    fields: [
      channel("starboard_channel_id", "Starboard channel", "Where messages are reposted."),
      channel("showcase_channel_id", "Showcase channel", "Optional channel for highlighted spotlights."),
      {
        key: "mode",
        label: "Posting mode",
        type: "select",
        defaultValue: "threshold",
        options: [
          { value: "threshold", label: "Post when threshold reached" },
          { value: "timed", label: "Post top starred after interval" },
        ],
      },
      {
        key: "threshold",
        label: "Stars required to post",
        type: "number",
        defaultValue: 5,
        visibleIf: (v) => (v.mode ?? "threshold") === "threshold",
      },
      {
        key: "timed_interval",
        label: "Interval",
        type: "select",
        defaultValue: "weekly",
        options: [
          { value: "weekly", label: "Weekly" },
          { value: "biweekly", label: "Biweekly" },
          { value: "monthly", label: "Monthly" },
        ],
        visibleIf: (v) => v.mode === "timed",
      },
      {
        key: "reaction_emoji",
        label: "Reaction emoji",
        type: "text",
        defaultValue: "⭐",
      },
      {
        key: "spotlight_message",
        label: "Spotlight message",
        type: "textarea",
        placeholder: "Check out this week's top message!",
        help: "Short message the bot includes when posting to the spotlight channel.",
      },
      role("spotlight_ping_role_id", "Spotlight ping role", "Pinged when a spotlight post is published."),
      toggle("allow_self_star", "Allow users to star their own messages", false),
      toggle("ignore_nsfw", "Ignore messages from NSFW channels"),
    ],
  },

  "recurring-messages": {
    title: "Recurring Messages",
    summary: "Auto-post messages on a schedule.",
    icon: Repeat,
    fields: [
      // Custom UI — rendered in AddonConfigCard. These entries exist only so
      // the card preview shows a sensible "N settings" count.
      { key: "messages", label: "Scheduled messages", type: "textarea" },
      toggle("delete_previous", "Delete the previous post before sending the next"),
      role("allowed_role_ids", "Roles allowed to use /repeating"),
    ],
  },

  "giveaway-system": {
    title: "Giveaway System",
    summary: "Run timed giveaways with auto-picked winners.",
    icon: Gift,
    // Rendered with a custom form in AddonConfigCard (see isGiveaway branch).
    fields: [],
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
        help: "Minimum 10 minutes to avoid Discord rate limits.",
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
      ...embedHeaderFields(),
      {
        key: "message",
        label: "Notification message",
        type: "textarea",
        defaultValue: "🔴 {streamer} just went live! {url}",
      },
      ...embedFooterFields(),
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
          { value: "dm", label: "Direct Message" },
          { value: "channel", label: "In Channel" },
          { value: "both", label: "Both" },
        ],
      },
      toggle("allowRecurring", "Allow recurring reminders"),
      { key: "embed_title", label: "Reminder embed title", type: "text", defaultValue: "Reminder", placeholder: "Reminder" },
      { key: "footer_text", label: "Footer text", type: "text", placeholder: "e.g. Set with /remindme" },
      toggle("show_original", "Show original reminder message in embed", true),
      toggle("ping_user", "Ping the user when the reminder fires", true),
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
