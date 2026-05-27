/**
 * Addon registry — Oversite Worker
 *
 * Each addon registers slash commands and event listeners. The runtime calls
 * `register()` for every addon listed on the bot's order at startup.
 *
 * To add a new addon:
 *   1. Create `worker/src/addons/<name>.ts` exporting an `Addon` object.
 *   2. Import it below and add to ADDONS by id.
 *   3. The id MUST match the addon id stored in `bot_orders.addons`.
 */
import type {
  Client,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

// ── Reference addon ──
import { sayAddon } from "./say.js";

// ── Protection: Base ──
import { protectionBaseAddon } from "./protection-base.js";

// ── Protection: Addons ──
import { advancedLoggingAddon } from "./advanced-logging.js";
import { nsfwInviteScannerAddon } from "./nsfw-invite-scanner.js";
import { avatarNsfwDetectionAddon } from "./avatar-nsfw-detection.js";
import { bioPhraseDetectionAddon } from "./bio-phrase-detection.js";
import { accountAgeGatingAddon } from "./account-age-gating.js";
import { autoEscalatingWarningsAddon } from "./auto-escalating-warnings.js";
import { softbanMassbanAddon } from "./softban-massban.js";
import { channelLockdownAddon } from "./channel-lockdown.js";
import { staffNotesAddon } from "./staff-notes.js";
import { moderationHistoryAddon } from "./moderation-history.js";
import { autoSlowmodeAddon } from "./auto-slowmode.js";
import { tempBanAddon } from "./temp-ban.js";

// ── Support: Base ──
import { supportBaseAddon } from "./support-base.js";

// ── Support: Addons ──
import { staffPerformanceAddon } from "./staff-performance.js";
import { ticketLogsAddon } from "./ticket-logs.js";
import {
  perCategoryRolesAddon,
  ticketNotesAddon,
  ticketMembersAddon,
  closeAllTicketsAddon,
  ticketMessageCustomizationAddon,
  priorityTicketAddon,
  autoCloseTicketsAddon,
  anonymousReportingAddon,
} from "./support-addons.js";

// ── Utilities: Base ──
import { utilitiesBaseAddon } from "./utilities-base.js";

// ── Utilities: Addons ──
import { musicAddon, autoRadioAddon } from "./music.js";
import {
  robloxVerificationAddon,
  starboardAddon,
  recurringMessagesAddon,
  giveawayAddon,
  birthdayAddon,
  serverStatsAddon,
  streamNotificationsAddon,
  levelingAddon,
  economyAddon,
  reminderAddon,
} from "./utilities-addons.js";

export type SlashBuilder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface AddonContext {
  botId: string;
  userId: string;
  client: Client;
  recordMetric: (deltas: {
    commands?: number;
    messages?: number;
    errors?: number;
  }) => Promise<void>;
  log: (
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
  ) => Promise<void>;
}

export interface Addon {
  id: string;
  name: string;
  commands?: SlashBuilder[];
  onCommand?: (
    interaction: ChatInputCommandInteraction,
    ctx: AddonContext,
  ) => Promise<void>;
  register?: (ctx: AddonContext) => Promise<void> | void;
}

export const ADDONS: Record<string, Addon> = {
  // Reference
  [sayAddon.id]: sayAddon,

  // Protection base
  [protectionBaseAddon.id]: protectionBaseAddon,

  // Protection addons
  [advancedLoggingAddon.id]: advancedLoggingAddon,
  [nsfwInviteScannerAddon.id]: nsfwInviteScannerAddon,
  [avatarNsfwDetectionAddon.id]: avatarNsfwDetectionAddon,
  [bioPhraseDetectionAddon.id]: bioPhraseDetectionAddon,
  [accountAgeGatingAddon.id]: accountAgeGatingAddon,
  [autoEscalatingWarningsAddon.id]: autoEscalatingWarningsAddon,
  [softbanMassbanAddon.id]: softbanMassbanAddon,
  [channelLockdownAddon.id]: channelLockdownAddon,
  [staffNotesAddon.id]: staffNotesAddon,
  [moderationHistoryAddon.id]: moderationHistoryAddon,
  [autoSlowmodeAddon.id]: autoSlowmodeAddon,
  [tempBanAddon.id]: tempBanAddon,

  // Support base
  [supportBaseAddon.id]: supportBaseAddon,

  // Support addons
  [staffPerformanceAddon.id]: staffPerformanceAddon,
  [ticketLogsAddon.id]: ticketLogsAddon,
  [perCategoryRolesAddon.id]: perCategoryRolesAddon,
  [ticketNotesAddon.id]: ticketNotesAddon,
  [ticketMembersAddon.id]: ticketMembersAddon,
  [closeAllTicketsAddon.id]: closeAllTicketsAddon,
  [ticketMessageCustomizationAddon.id]: ticketMessageCustomizationAddon,
  [priorityTicketAddon.id]: priorityTicketAddon,
  [autoCloseTicketsAddon.id]: autoCloseTicketsAddon,
  [anonymousReportingAddon.id]: anonymousReportingAddon,

  // Utilities base
  [utilitiesBaseAddon.id]: utilitiesBaseAddon,

  // Utilities addons
  [musicAddon.id]: musicAddon,
  [autoRadioAddon.id]: autoRadioAddon,
  [robloxVerificationAddon.id]: robloxVerificationAddon,
  [starboardAddon.id]: starboardAddon,
  [recurringMessagesAddon.id]: recurringMessagesAddon,
  [giveawayAddon.id]: giveawayAddon,
  [birthdayAddon.id]: birthdayAddon,
  [serverStatsAddon.id]: serverStatsAddon,
  [streamNotificationsAddon.id]: streamNotificationsAddon,
  [levelingAddon.id]: levelingAddon,
  [economyAddon.id]: economyAddon,
  [reminderAddon.id]: reminderAddon,
};

/**
 * Catalog IDs (as stored on `bot_orders.addons` and the dashboard catalog)
 * don't always match the internal addon `id`. This map translates catalog
 * IDs to the runtime addon id. If a catalog id is missing here, we fall back
 * to a direct `ADDONS[id]` lookup (which works when the names already match).
 *
 * Keep this in sync with the dashboard catalog (`src/data/addons.ts`).
 */
export const CATALOG_TO_ADDON_ID: Record<string, string> = {
  "auto-close-inactive": "auto-close-tickets",
  "birthday-announcements": "birthday",
  "economy-system": "economy",
  "giveaway-system": "giveaway",
  "leveling-system": "leveling",
  "live-notifications": "stream-notifications",
  "music-addon": "music",
  "priority-flagging": "priority-ticket",
  "server-stats-channels": "server-stats",
  "ticket-add-remove": "ticket-members",
};

/**
 * Website-only catalog entries the worker should never try to load — they're
 * features of the hosted dashboard, not the Discord bot.
 */
export const WEBSITE_ONLY_CATALOG = new Set<string>([
  "dashboard",
  "branding",
  "multi-server",
]);

/**
 * Resolve a catalog id (whatever shape `bot_orders.addons` stores) to the
 * runtime `Addon` object, or `undefined` when there's no matching addon.
 */
export function resolveAddon(catalogId: string): Addon | undefined {
  const mapped = CATALOG_TO_ADDON_ID[catalogId];
  if (mapped && ADDONS[mapped]) return ADDONS[mapped];
  return ADDONS[catalogId];
}
