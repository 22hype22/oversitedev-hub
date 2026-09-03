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
  CreditCard,
  ScrollText,
  Package,
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
  Store,
  Lightbulb,
  PartyPopper,
  Ban,
} from "lucide-react";

export type AddonFieldType =
  | "channel"
  | "multichannel"
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

// Watched role SETS for auto infraction/promotion. Each set = a role list + how
// many of those roles must change at once to trigger. Sets reveal progressively
// (the next one appears once the previous has roles) so the card stays clean.
const roleGroupFields = (verb: "removed" | "added"): AddonField[] => {
  const out: AddonField[] = [];
  const total = 4;
  for (let i = 1; i <= total; i++) {
    out.push({
      key: `group${i}_roles`,
      label: `Set ${i} — roles`,
      type: "multirole",
      placeholder: "@role",
      defaultValue: [],
      help:
        i === 1
          ? `A group of roles watched together. When enough of them are ${verb} from a member (within a few seconds of each other), it auto-logs. Put a whole team's roles here so one stray change doesn't trigger it.`
          : `Another independent set (optional) — watched separately from the others.`,
      visibleIf:
        i === 1
          ? undefined
          : (v) =>
              Array.isArray(v[`group${i - 1}_roles`]) &&
              (v[`group${i - 1}_roles`] as string[]).length > 0,
    });
    out.push({
      key: `group${i}_min`,
      label: `Set ${i} — how many trigger it`,
      type: "number",
      placeholder: "blank = all of them",
      help: `How many of Set ${i}'s roles must be ${verb} to fire a log. Leave blank to require ALL of them.`,
      visibleIf: (v) =>
        Array.isArray(v[`group${i}_roles`]) && (v[`group${i}_roles`] as string[]).length > 0,
    });
  }
  return out;
};

// Discord role -> Roblox group rank pairs. Each tier maps a set of Discord roles
// to one rank number in the group. Tiers reveal progressively so the card stays
// clean, and if a member matches more than one tier the HIGHEST rank wins.
const rankTierFields = (): AddonField[] => {
  const out: AddonField[] = [];
  const total = 8;
  for (let i = 1; i <= total; i++) {
    out.push({
      key: `tier${i}_roles`,
      label: `Rank ${i} — Discord role(s)`,
      type: "multirole",
      placeholder: "@role",
      defaultValue: [],
      help:
        i === 1
          ? "Members with any of these Discord roles get the Roblox rank you set below. Add more than one role if several should map to the same rank."
          : "Another Discord role → rank mapping (optional).",
      visibleIf:
        i === 1
          ? undefined
          : (v) =>
              Array.isArray(v[`tier${i - 1}_roles`]) &&
              (v[`tier${i - 1}_roles`] as string[]).length > 0,
    });
    out.push({
      key: `tier${i}_rank`,
      label: `Rank ${i} — Roblox rank number`,
      type: "number",
      placeholder: "e.g. 5",
      help: "The group rank NUMBER (the 1–255 value you set in Roblox → Group → Configure → Roles), not the rank's name.",
      visibleIf: (v) =>
        Array.isArray(v[`tier${i}_roles`]) && (v[`tier${i}_roles`] as string[]).length > 0,
    });
  }
  return out;
};


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
    summary: "Design the message posted when a new member joins.",
    icon: UserPlus,
    fields: [
      channel("channel_id", "Join channel", "Where new-member join messages are posted."),
    ],
  },

  "customs-messages": {
    title: "Messages",
    summary: "Send custom messages and rich embeds to any channel.",
    icon: Megaphone,
    fields: [
      channel("channel_id", "Post channel", "Where this message will be sent."),
    ],
  },

  "customs-suggestions": {
    title: "Suggestions",
    summary: "A /suggestion command that opens a form you design.",
    icon: Lightbulb,
    fields: [
      channel("channel_id", "Suggestions channel", "Where submitted suggestions are posted."),
    ],
  },

  "customs-feedback": {
    title: "Feedback",
    summary: "A /feedback command that opens a form you design.",
    icon: MessageSquare,
    fields: [
      channel("channel_id", "Feedback channel", "Where submitted feedback is posted."),
    ],
  },

  "customs-vouches": {
    title: "Vouches",
    summary: "/vouch lets buyers rate a designer 1 to 5 stars. Each vouch posts a card, and averages show on the pricing board.",
    icon: Star,
    fields: [
      channel("channel_id", "Vouch channel", "Where every vouch card is posted. The receipt's Leave a Review button also lands here once this is set."),
      multirole("designer_role_ids", "Who can be vouched for", "Only members with one of these roles can receive a vouch. Leave empty to allow anyone."),
      toggle("show_on_pricing", "Show ratings on the pricing board", true, "Adds each designer's star average next to their name in /pricing."),
      toggle("require_review", "Require a written review", false, "When on, a star rating alone isn't enough — buyers have to write a sentence too."),
    ],
  },

  "customs-sales": {
    title: "Sales Stats",
    summary: "/sales shows each designer's orders, packages and revenue. Posts a recap with the top designer on the 1st of every month.",
    icon: BarChart3,
    fields: [
      channel("channel_id", "Monthly recap channel", "Where the monthly recap is posted. Leave empty to skip the post and just use /sales."),
      multirole("staff_role_ids", "Who can run /sales", "Manage Server always can. Add designer or manager roles here to let them see the numbers too."),
      toggle("monthly_post", "Post a monthly recap", true, "On the 1st of each month, last month's totals per designer and the top designer."),
    ],
  },

  "customs-freerelease": {
    title: "Free Release",
    summary: "/freerelease posts a drop that unlocks a file at a reaction goal.",
    icon: PartyPopper,
    fields: [
      channel("channel_id", "File vault channel", "Optional staff-only channel where the release file is privately stored until the goal is reached. Falls back to your ticket log channel."),
    ],
  },

  "customs-blacklist": {
    title: "Blacklist Logs",
    summary: "A /blacklist command that posts the log message you design.",
    icon: Ban,
    fields: [
      channel("channel_id", "Blacklist log channel", "Where blacklist entries are posted."),
    ],
  },

  "customs-announce": {
    title: "Package Announcements",
    summary: "Auto-post promos on a schedule — every N days.",
    icon: Megaphone,
    fields: [
      channel("channel_id", "Announcement channel", "Where this promo is auto-posted."),
      {
        key: "interval_days",
        label: "Post every (days)",
        type: "number",
        defaultValue: 9,
        placeholder: "9",
        help: "How often each saved announcement is re-posted, in days.",
      },
    ],
  },

  "customs-reportbug": {
    title: "Report a Bug",
    summary: "The form behind the Report a bug button + /reportbug.",
    icon: MessageSquareX,
    fields: [
      channel("channel_id", "Bug reports channel", "Where submitted bug reports are posted."),
    ],
  },

  "customs-smallui": {
    title: "System Messages",
    summary: "Design the small ticket & system messages the bot sends.",
    icon: MessageSquareX,
    fields: [],
  },

  "customs-giveaway": {
    title: "Giveaway",
    summary: "Design how /giveaway looks; staff run it to launch one.",
    icon: Gift,
    fields: [
      multirole("manager_role_ids", "Who can run /giveaway", "Roles allowed to start giveaways, in addition to anyone with Manage Server. Optional."),
    ],
  },

  "customs-robux-locker": {
    title: "Robux Locker",
    summary: "Design the panel where members buy Robux.",
    icon: Lock,
    fields: [
      channel("channel_id", "Panel channel", "Where the Robux Locker panel is posted. Design it below; it posts here on Save."),
    ],
  },

  "customs-portfolio": {
    title: "Portfolio",
    summary: "Design a post; run /portfolio to send it to a channel.",
    icon: FileText,
    fields: [
      channel("channel_id", "Post channel", "Where /portfolio posts the design below."),
      multirole("allowed_role_ids", "Who can run /portfolio", "Members with any of these roles can run /portfolio. Anyone with Manage Server can too. Leave empty for Manage Server only."),
    ],
  },

  "customs-packages": {
    title: "Packages",
    summary: "Build a package card and post it with /package.",
    icon: Package,
    fields: [
      multirole("allowed_role_ids", "Who can run /package", "Members with any of these roles can run /package. Anyone with Manage Server can too. Leave empty for Manage Server only."),
    ],
  },

  "customs-orderlog": {
    title: "Order Logs",
    summary: "Log completed or active orders with /orderlog.",
    icon: ClipboardList,
    fields: [
      channel("channel_id", "Order-log channel", "Where the completed order log is posted when someone runs /orderlog."),
      multirole("allowed_role_ids", "Who can run /orderlog", "Only members with any of these roles (or Manage Server) can run /orderlog. Leave empty to allow anyone."),
    ],
  },

  "customs-infraction": {
    title: "Infraction Logs",
    summary: "Log infractions with /infraction, or auto-log a removed role.",
    icon: ClipboardList,
    fields: [
      channel("channel_id", "Infraction-log channel", "Where infraction logs are posted (both /infraction and auto-logged ones)."),
      header("Auto-infraction — watched role sets"),
      ...roleGroupFields("removed"),
      multirole("allowed_role_ids", "Who can run /infraction", "Only members with any of these roles (or Manage Server) can run /infraction. Leave empty to allow anyone."),
    ],
  },

  "customs-promotion": {
    title: "Promotion Logs",
    summary: "Log promotions with /promote, or auto-log an added role.",
    icon: ClipboardList,
    fields: [
      channel("channel_id", "Promotion-log channel", "Where promotion logs are posted (both /promote and auto-logged ones)."),
      header("Auto-promotion — watched role sets"),
      ...roleGroupFields("added"),
      multirole("allowed_role_ids", "Who can run /promote", "Only members with any of these roles (or Manage Server) can run /promote. Leave empty to allow anyone."),
    ],
  },

  "customs-qualitycheck": {
    title: "Quality Check",
    summary: "Members submit work with /qualitycheck for Accept/Deny review.",
    icon: ClipboardList,
    fields: [
      channel("channel_id", "Quality-check channel", "Where submitted quality checks are posted for review (with Accept / Deny buttons)."),
      multirole("run_role_ids", "Who can run /qualitycheck", "Only members with any of these roles (or Manage Server) can submit a quality check. Leave empty to allow anyone."),
      multirole("allowed_role_ids", "Who can Accept / Deny", "Only members with any of these roles (or Manage Server) can review quality checks. Leave empty to allow anyone with Manage Server."),
    ],
  },

  "customs-logging": {
    title: "Logging",
    summary: "Set the channels where purchase and event logs post.",
    icon: ScrollText,
    fields: [
      header("Purchase logs"),
      channel("purchase_log_channel_id", "Purchase logs channel", "Every completed /payment (Stripe) and Roblox group game-pass purchase is logged here, with the customer, Roblox account, amount, and a Payment ID."),
    ],
  },

  "customs-payment": {
    title: "Payment",
    summary: "Pick which roles can run /payment (Stripe, game-pass, shirt).",
    icon: CreditCard,
    fields: [
      multirole("allowed_role_ids", "Who can run /payment", "Only members with any of these roles (or Manage Server) can run /payment. Leave empty to fall back to your ticket support roles."),
    ],
  },

  "customs-gambling": {
    title: "Economy & Gambling",
    summary: "UnbelievaBoat-style currency + gambling. Set the command prefix.",
    icon: Coins,
    fields: [
      {
        key: "prefix",
        label: "Command prefix",
        type: "text",
        defaultValue: "!",
        placeholder: "! or - or ?",
        help: "The character members type before economy/gambling commands (e.g. ! → !balance, !bet). Slash commands work regardless.",
      },
      {
        key: "currency_symbol",
        label: "Currency symbol",
        type: "text",
        defaultValue: "🪙",
        placeholder: "🪙, $, 💵",
        help: "Shown next to balances and bets.",
      },
      {
        key: "currency_name",
        label: "Currency name",
        type: "text",
        defaultValue: "coins",
        placeholder: "coins, credits, bucks",
        help: "What one unit of currency is called.",
      },
      {
        key: "start_balance",
        label: "Starting balance",
        type: "number",
        defaultValue: 0,
        placeholder: "0",
        help: "How much cash a member starts with the first time they use an economy command.",
      },
      {
        key: "allowed_channel_ids",
        label: "Lock commands to channels",
        type: "multichannel",
        defaultValue: [],
        help: "Pick the channels where economy & gambling commands are allowed. Leave empty to allow them everywhere.",
      },
    ],
  },

  "customs-tts": {
    title: "Text-to-Speech",
    summary: "Voice, accent, speed, and the /join & /leave messages.",
    icon: Radio,
    fields: [
      {
        key: "accent",
        label: "Accent",
        type: "select",
        defaultValue: "co.uk",
        help: "Which English accent the gTTS voice uses.",
        options: [
          { value: "co.uk", label: "British (UK)" },
          { value: "com", label: "American (US)" },
          { value: "com.au", label: "Australian" },
          { value: "ca", label: "Canadian" },
          { value: "ie", label: "Irish" },
          { value: "co.in", label: "Indian" },
        ],
      },
      {
        key: "speed",
        label: "Speaking speed",
        type: "select",
        defaultValue: "1.1",
        help: "How fast messages are read.",
        options: [
          { value: "0.9", label: "Slower" },
          { value: "1.0", label: "Normal" },
          { value: "1.1", label: "Slightly quick" },
          { value: "1.25", label: "Fast" },
          { value: "1.4", label: "Very fast" },
        ],
      },
      {
        key: "engine",
        label: "Voice engine",
        type: "select",
        defaultValue: "gtts",
        help: "gTTS is the free Google voice (with the accent above). ElevenLabs uses your API key + voice ID for a premium voice.",
        options: [
          { value: "gtts", label: "Google (gTTS)" },
          { value: "eleven", label: "ElevenLabs" },
        ],
      },
      {
        key: "voice_id",
        label: "ElevenLabs voice ID",
        type: "text",
        placeholder: "e.g. s3TPKV1kjDlVtZbl4Ksh",
        help: "Only used when the engine is ElevenLabs. Leave blank to keep the current one.",
        visibleIf: (v) => v.engine === "eleven",
      },
      {
        key: "join_message",
        label: "/join message",
        type: "textarea",
        markdown: true,
        placeholder: "Blank = default. Tokens: {channel}, {user}",
        help: "The confirmation shown when the bot joins a voice channel. Use {channel} and {user}.",
      },
      {
        key: "leave_message",
        label: "/leave message",
        type: "textarea",
        markdown: true,
        placeholder: "Blank = 'Disconnected from voice.'",
        help: "The confirmation shown when the bot leaves the voice channel.",
      },
    ],
  },

  "customs-order-status": {
    title: "Order Status",
    summary: "Live open/limited/closed status per service, from open tickets.",
    icon: BarChart3,
    fields: [
      {
        key: "title",
        label: "Embed title",
        type: "text",
        defaultValue: "Order Status",
        placeholder: "Order Status",
        help: "Heading shown at the top of the status embed.",
      },
      header("Thresholds (same for every service)"),
      {
        key: "limited_at",
        label: "Oversite+ only at",
        type: "number",
        defaultValue: 8,
        help: "When a service reaches this many OPEN order tickets, its status flips to the “Oversite+ only” state.",
      },
      {
        key: "closed_at",
        label: "Closed at",
        type: "number",
        defaultValue: 10,
        help: "When a service reaches this many OPEN order tickets, its status flips to “Closed”.",
      },
      header("Statuses (emoji + label)"),
      {
        key: "emoji_open",
        label: "Open — emoji",
        type: "text",
        placeholder: ":green:",
        help: "Type your custom server emoji as :name: (e.g. :green:) or paste a normal emoji. Same for the others.",
      },
      { key: "label_open", label: "Open — label", type: "text", defaultValue: "Open", placeholder: "Open" },
      { key: "emoji_limited", label: "Oversite+ only — emoji", type: "text", placeholder: ":yellow:" },
      { key: "label_limited", label: "Oversite+ only — label", type: "text", defaultValue: "Oversite+ Only", placeholder: "Oversite+ Only" },
      { key: "emoji_closed", label: "Closed — emoji", type: "text", placeholder: ":red:" },
      { key: "label_closed", label: "Closed — label", type: "text", defaultValue: "Closed", placeholder: "Closed" },
      header("Services"),
      {
        key: "services",
        label: "Services (one per line)",
        type: "textarea",
        defaultValue: "Liveries = Liveries\nGFX = GFX\nBot Design = Bot Design",
        placeholder: "Liveries = Liveries\nGFX = GFX\nBot Design = Bot Design",
        help:
          "One service per line as “Display Name = Ticket Category” (the Discord category its order tickets open under; leave “= Category” off to reuse the name). NO braces here — this is plain text. " +
          "Each service also becomes a live variable for ANY message, panel, ticket, or button — the name (any case/spacing works): “Liveries” → {liveries}, “Bot Design” → {bot design}. " +
          "{liveries} shows “Liveries — 🟢” (name + icon, no Open/Closed word). {liveriesstatus} shows the icon + word (🟢 Open).",
      },
    ],
  },

  "customs-pricing": {
    title: "Pricing",
    summary: "Set service prices with /setpricing; members view them with /pricing.",
    icon: Coins,
    fields: [
      multirole("designer_role_ids", "Designer roles (can run /setpricing)", "Members with any of these roles can set prices. Anyone with Manage Server can too."),
      {
        key: "currency",
        label: "USD currency symbol",
        type: "text",
        defaultValue: "$",
        placeholder: "$",
        help: "Symbol for the USD price, e.g. $ or £. Robux prices always show as “R$”. Each item has both.",
      },
      {
        key: "title",
        label: "Pricing title",
        type: "text",
        defaultValue: "Pricing",
        placeholder: "Pricing",
        help: "Heading on the /pricing embed.",
      },
      header("Services & items"),
      {
        key: "services",
        label: "Services and their items (one service per line)",
        type: "textarea",
        defaultValue: "Liveries: Law Enforcement, Staff, Business, Fire Department\nClothing: Uniform, Casual\nGFX: Logo, Banner, Thumbnail",
        placeholder: "Liveries: Law Enforcement, Staff, Business, Fire Department",
        help:
          "One service per line as “Service: item1, item2, item3”. These are the choices in /pricing and /setpricing. " +
          "Each designer sets THEIR OWN prices from Discord with /setpricing (NOT here) — pick a service, pick an item, then enter its Robux and USD price. /pricing then lists every designer for that service (their @mention + prices), oldest member first.",
      },
    ],
  },

  "customs-tickets": {
    title: "Tickets",
    summary: "Support tickets with categories, staff roles, and transcripts.",
    icon: ClipboardList,
    fields: [
      {
        key: "category_id",
        label: "Ticket category",
        type: "channel",
        channelTypes: ["category"],
        help: "New ticket channels open under this category.",
      },
      multirole("support_role_ids", "Global support roles (see ALL tickets)", "Optional — roles that can see & manage EVERY ticket (e.g. admins/managers). Leave empty to keep each ticket restricted to its own Access roles, which you set per Ticket/Form in the panel below."),
      channel("log_channel_id", "Transcript log channel", "Where closed-ticket transcripts are posted."),
      toggle("one_per_user", "Limit each member to 2 open tickets per section", true),
      header("Ticket panel"),
      channel("panel_channel_id", "Panel channel", "Where the ticket panel is posted. Design it below; it posts here on Save."),
    ],
  },

  "marketplace": {
    title: "Marketplace",
    summary: "Post a marketplace panel — design it and choose the channel it posts to.",
    icon: Store,
    fields: [
      channel("panel_channel_id", "Panel channel", "Where the marketplace panel is posted. Design it below; it posts here on Save."),
      header("Advertisements"),
      channel("ad_post_channel_id", "Ad post channel", "Where approved ads are posted. (Approval channel, staff & designs live in the Advertisements box.)"),
      {
        key: "ad_interval_minutes",
        label: "How long between each ad post",
        type: "select",
        defaultValue: "1440",
        options: [
          { value: "60", label: "1 hour" },
          { value: "180", label: "3 hours" },
          { value: "360", label: "6 hours" },
          { value: "720", label: "12 hours" },
          { value: "1440", label: "1 day" },
          { value: "2880", label: "2 days" },
          { value: "4320", label: "3 days" },
          { value: "10080", label: "1 week" },
        ],
        help: "How often the bot posts the next queued ad. Bypass Queue posts first; Instant Post skips the queue.",
      },
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
    summary: "Members link their Roblox account for a role and matching nickname.",
    icon: ShieldCheck,
    fields: [
      channel("channel_id", "Verify channel", "Where the Verify button is posted."),
      multirole("verified_role_ids", "Roles to add on verify", "Given to members once they link their Roblox account. Pick one or more."),
      multirole("remove_role_ids", "Roles to remove on verify", "Taken from members when they verify — e.g. an Unverified role. Pick one or more. Optional."),
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

  "roblox-group-sync": {
    title: "Roblox Group Sync",
    summary: "Map a Discord role to a Roblox group rank, set automatically.",
    icon: Gamepad2,
    fields: [
      {
        key: "group_id",
        label: "Roblox group ID",
        type: "text",
        placeholder: "e.g. 1234567",
        help: "The number in your group's URL: roblox.com/groups/<THIS>/… The bot account (behind ROBLOX_COOKIE) must be ranked ABOVE the ranks it assigns and have “Manage lower-ranked members.”",
      },
      header("Role → rank mappings"),
      ...rankTierFields(),
      header("Everyone else"),
      {
        key: "demote_rank",
        label: "Rank for members with no mapped role (optional)",
        type: "number",
        placeholder: "blank = leave them alone",
        help: "If set, any verified member in the group who holds NONE of the mapped roles is moved to this rank number (a derank). Leave blank to never auto-demote — safest. The bot still can't touch the group owner or anyone ranked at/above the bot account.",
      },
    ],
  },

  "ads": {
    title: "Advertisements",
    summary: "Sell ad perks; members spend them to post ads through a staff-approved queue.",
    icon: Megaphone,
    fields: [
      toggle("enabled", "Enable the ad system", true,
        "Members buy ad perks (Purchase cards named to match below), then run /ads or a Post an Ad button to spend a ping credit and submit an ad for staff approval. The ad channel & post interval are set in the Marketplace box."),
      channel("approval_channel_id", "Staff approval channel", "Where submitted ads go for staff to Approve / Deny."),
      multirole("staff_role_ids", "Ad staff roles", "Roles that can approve or deny ads (Manage Server always can)."),
      header("Perk item names (match your Purchase cards)"),
      { key: "perk_ping_everyone", label: "Everyone Ping item", type: "text", placeholder: "Everyone Ping", help: "Buying this grants one @everyone post credit." },
      { key: "perk_ping_here", label: "Here Ping item", type: "text", placeholder: "Here Ping", help: "Buying this grants one @here post credit." },
      { key: "perk_ping_none", label: "No Ping item", type: "text", placeholder: "No Ping", help: "Buying this grants one no-ping post credit." },
      { key: "perk_instant", label: "Instant Post item", type: "text", placeholder: "Instant Post", help: "Add-on: skips the queue and posts immediately once approved." },
      { key: "perk_bypass", label: "Bypass Queue item", type: "text", placeholder: "Bypass Queue", help: "Add-on: jumps into the priority lane, posting before regular queued ads." },
      {
        key: "claim_button_label",
        label: "Post an Ad button label",
        type: "text",
        placeholder: "📢 Post an Ad",
        help: "Label for the Post an Ad button you can add to any message (button action “Post an Ad”).",
      },
      header("Claim panel wording (how the inventory pop-up looks)"),
      { key: "claim_title", label: "Panel title", type: "text", placeholder: "Your Ad Inventory" },
      { key: "claim_note", label: "Note under the inventory (optional)", type: "textarea", placeholder: "Shown under the list of what they own." },
      { key: "ping_placeholder", label: "Ping dropdown placeholder", type: "text", placeholder: "Which ping credit to use" },
      { key: "type_placeholder", label: "Post-type dropdown placeholder", type: "text", placeholder: "Post type" },
      { key: "regular_label", label: "“Regular Post” option label", type: "text", placeholder: "Regular Post" },
      { key: "giveaway_label", label: "“Sponsored Giveaway” option label", type: "text", placeholder: "Sponsored Giveaway" },
      { key: "addon_placeholder", label: "Add-on dropdown placeholder", type: "text", placeholder: "Apply an add-on (optional)" },
      { key: "continue_label", label: "Continue button label", type: "text", placeholder: "Continue" },
    ],
  },

  "invite-tracker": {
    title: "Invite Tracker",
    summary: "Log who invited each new member, with a /leaderboard invites board.",
    icon: UserPlus,
    fields: [
      toggle("enabled", "Enable invite tracking", true,
        "Counts each member's invites (regular + bonus − left − fake). Members run /leaderboard invites to see the board, and you can drop a {invite list} token into any message. Alt/fake accounts are flagged automatically from risk signals at the moment someone joins (a brand-new account, a still-default avatar) — there's no day count to set."),
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
    summary: "Music in voice — search, radio, favorites, AI DJ, and a Now Playing card.",
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
    title: "Auto Radio",
    summary: "24/7 genre-based music streaming in a voice channel.",
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
