/**
 * Addon registry.
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
};
