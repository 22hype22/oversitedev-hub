-- Dispatch bot productization: the only credential a customer supplies is
-- their ER:LC private-server API key. The Discord token is auto-assigned from
-- the pool on payment, and the ElevenLabs + Anthropic keys are Oversite-managed
-- (bundled), so neither is a customer-facing slot here.
INSERT INTO public.bot_secret_slots
  (addon_id, key, label, description, placeholder, is_required, sort_order)
VALUES
  (
    'dispatch',
    'ERLC_SERVER_KEY',
    'ER:LC server key',
    'Your Emergency Response: Liberty County private-server API key. In ER:LC open your private server settings, find the API section, and generate or copy the server key. Requires the ERLC API Pack enabled so 911 calls come through.',
    'Paste your ER:LC private server key',
    true,
    0
  )
ON CONFLICT (addon_id, key) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      placeholder = EXCLUDED.placeholder,
      is_required = EXCLUDED.is_required,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
