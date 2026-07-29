import type { OwnedBot } from "@/hooks/useOwnedBots";

// The dispatch voice-channel picker now lives inside the API keys card
// (see BotSecretsCard's "Voice channel" section), so this standalone card
// renders nothing. Kept as a no-op because BotDashboard still imports and
// mounts it — this avoids having to edit that large file. Safe to delete
// this file and its import/mount in BotDashboard.tsx later for tidiness.
export function DispatchVoiceCard(_props: { bot: OwnedBot }) {
  return null;
}
