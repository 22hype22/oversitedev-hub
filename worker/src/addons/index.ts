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
import { sayAddon } from "./addons/say.js";

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
  [sayAddon.id]: sayAddon,
};
