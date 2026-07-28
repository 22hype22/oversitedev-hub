-- Dispatch bot: besides the ER:LC key, the bot needs to know which Discord
-- server and voice channel to sit in. These aren't secret, but reusing the
-- secret-slot form is the cleanest way to collect them on the dashboard and
-- inject them at deploy. Copy the IDs with Discord Developer Mode on.
INSERT INTO public.bot_secret_slots
  (addon_id, key, label, description, placeholder, is_required, sort_order)
VALUES
  (
    'dispatch',
    'DISPATCH_GUILD_ID',
    'Discord server ID',
    'The ID of the Discord server your dispatcher runs in. Turn on Developer Mode in Discord (Settings → Advanced), then right-click your server and Copy Server ID.',
    'e.g. 1234567890123456789',
    true,
    1
  ),
  (
    'dispatch',
    'DISPATCH_VOICE_CHANNEL_ID',
    'Voice channel ID',
    'The voice channel the dispatcher joins and speaks in. Right-click the voice channel and Copy Channel ID (Developer Mode must be on).',
    'e.g. 1234567890123456789',
    true,
    2
  )
ON CONFLICT (addon_id, key) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      placeholder = EXCLUDED.placeholder,
      is_required = EXCLUDED.is_required,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
