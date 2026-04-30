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
