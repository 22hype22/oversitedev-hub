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

export const ADDON_CONFIGS: Record<string, AddonConfig> = {
  // ─── Protection: included base features ──────────────────────
  "verification-system": {
    title: "Verification System",
    summary: "Gate new joiners behind a verification step.",
    icon: ShieldCheck,
    fields: [
      channel("channel", "Verification channel", "Where the verify button is posted."),
      role("verifiedRole", "Verified role", "Granted once a user verifies."),
      {
        key: "message",
        label: "Verification message",
        type: "textarea",
        defaultValue:
          "Welcome to {server}! Click the button below to verify and unlock the server.",
      },
      {
        key: "method",
        label: "Verification method",
        type: "select",
        defaultValue: "button",
        options: [
          { value: "button", label: "Click a button" },
          { value: "captcha", label: "Solve a captcha" },
          { value: "reaction", label: "React to a message" },
        ],
      },
      {
        key: "buttonLabel",
        label: "Button label",
        type: "text",
        defaultValue: "Verify me",
      },
      {
        key: "minAccountAge",
        label: "Minimum account age to verify",
        type: "select",
        defaultValue: "0",
        help: "Reject verification from accounts younger than this.",
        options: [
          { value: "0", label: "No minimum" },
          { value: "1", label: "1 day" },
          { value: "5", label: "5 days" },
          { value: "10", label: "10 days" },
          { value: "20", label: "20 days" },
          { value: "30", label: "30 days" },
          { value: "60", label: "60 days" },
          { value: "90", label: "90 days" },
        ],
      },
      toggle("kickUnverified", "Kick users who don't verify within 74h", false),
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
      {
        key: "alertMessage",
        label: "Alert message",
        type: "textarea",
        placeholder: "User {user} joined with a flagged avatar.",
        defaultValue: "User {user} joined with a flagged avatar.",
      },
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

  "temp-bans": {
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
