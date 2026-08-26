-- Bot-wide credential slot for Customs bots: the group's Roblox account cookie.
-- Adding this row makes the "API keys & credentials" card show a Roblox cookie
-- field on every customs bot (the card scopes slots by addon_id === bot.base).
-- Stored encrypted in bot_secrets; the bot reads it at runtime via
-- runtime_get_bot_secret. Optional — when unset, functions fall back to the
-- shared project-level ROBLOX_COOKIE secret, so this changes nothing until set.
INSERT INTO public.bot_secret_slots (addon_id, key, label, description, placeholder, is_required, sort_order)
VALUES (
  'customs',
  'ROBLOX_COOKIE',
  'Roblox account cookie',
  'The .ROBLOSECURITY cookie of your group''s Roblox bot account. Powers payments, gamepasses, the Robux Locker, and Roblox group-rank sync. Encrypted, and only ever read by your bot — never shown back to us or anyone. Use a dedicated account.',
  '_|WARNING:-DO-NOT-SHARE-THIS...  (paste the full .ROBLOSECURITY value)',
  false,
  0
)
ON CONFLICT (addon_id, key) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      placeholder = EXCLUDED.placeholder,
      is_required = EXCLUDED.is_required,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
