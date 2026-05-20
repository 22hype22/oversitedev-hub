/**
 * Add-on id sets grouped by bot category.
 *
 * Kept here so both the marketing-side BotBuilder and the authenticated
 * BotDashboard agree on which add-ons belong to which bot type. This is
 * what powers splitting the All-in-One Pack into three separate bots
 * (Protection / Support / Utilities), each with only the add-ons that
 * match its category.
 */

export const PROTECTION_ADDON_IDS = [
  "moderation-history",
  "advanced-logging",
  "auto-escalating-warnings",
  "verification-system",
  "mod-actions",
  "anti-spam",
  "anti-raid",
  "auto-role",
  "phishing-detection",
  "nsfw-invite-scanner",
  "avatar-nsfw-detection",
  "bio-phrase-detection",
  "channel-lockdown",
  "auto-slowmode",
  "ban-tools",
  "softban-massban",
  "temp-ban",
  "messages",
  "rules",
] as const;

export const SUPPORT_ADDON_IDS = [
  "ticket-message-customization",
  "staff-performance",
  "ticket-logs",
  "ticket-notes",
  "ticket-add-remove",
  "close-all-tickets",
  "priority-flagging",
  "auto-close-inactive",
  "anonymous-reporting",
  "messages",
] as const;

export const UTILITIES_ADDON_IDS = [
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
  "messages",
] as const;

const CATEGORY_MAP: Record<string, ReadonlyArray<string>> = {
  protection: PROTECTION_ADDON_IDS,
  support: SUPPORT_ADDON_IDS,
  utilities: UTILITIES_ADDON_IDS,
};

/**
 * Return only the add-ons that belong to the given base category.
 * Add-ons that don't belong to any of the three known categories
 * (shared/extras like "branding", "dashboard", "multi-server") are
 * always kept — they apply to every bot.
 */
export function filterAddonsForBase(addons: string[], base: string): string[] {
  const known = new Set<string>([
    ...PROTECTION_ADDON_IDS,
    ...SUPPORT_ADDON_IDS,
    ...UTILITIES_ADDON_IDS,
  ]);
  const allowed = new Set<string>(CATEGORY_MAP[base] ?? []);
  return addons.filter((id) => allowed.has(id) || !known.has(id));
}
