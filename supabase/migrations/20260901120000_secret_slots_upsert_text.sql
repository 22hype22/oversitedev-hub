-- Keep secret-slot label/description/placeholder in sync when the bot re-seeds.
-- The original runtime_seed_secret_slots used ON CONFLICT DO NOTHING, so edits
-- to a slot's wording (e.g. explaining that Store Experience ID now accepts
-- several comma-separated games) never reached bots whose slots already existed.
-- Now the seed refreshes the display text on conflict. Stored secret VALUES live
-- in a separate table and are never touched. Body is identical to the original
-- except the ON CONFLICT clause.

CREATE OR REPLACE FUNCTION public.runtime_seed_secret_slots(_token text, _slots jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _slot jsonb;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  FOR _slot IN SELECT * FROM jsonb_array_elements(_slots) LOOP
    INSERT INTO public.bot_secret_slots (addon_id, key, label, description, placeholder, is_required, sort_order)
    VALUES (
      COALESCE(_slot->>'addon_id', _slot->>'bot_id'),
      _slot->>'key', _slot->>'label', _slot->>'description', _slot->>'placeholder',
      COALESCE((_slot->>'required')::boolean, (_slot->>'is_required')::boolean, true),
      COALESCE((_slot->>'sort_order')::integer, 0))
    ON CONFLICT (addon_id, key) DO UPDATE SET
      label       = EXCLUDED.label,
      description = EXCLUDED.description,
      placeholder = EXCLUDED.placeholder,
      is_required = EXCLUDED.is_required,
      sort_order  = EXCLUDED.sort_order;
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.runtime_seed_secret_slots(text, jsonb) TO anon, authenticated;

-- Refresh the existing Store Experience ID slot right now so current bots show
-- the multi-game wording immediately (the bot's next boot would also do this via
-- the updated seed above).
UPDATE public.bot_secret_slots
SET label       = 'Store experience ID(s)',
    placeholder = 'e.g. 10357040169, 128739314806275  (one or more, comma-separated)',
    description = 'The Roblox experience(s) where Purchase dev products are created. Paste '
               || 'either a place ID (roblox.com/games/<ID>/…) OR an experience ID (the number '
               || 'in the Creator Dashboard URL, create.roblox.com/dashboard/creations/'
               || 'experiences/<ID>/overview) — both work. Have more than one game? List several '
               || 'separated by commas — new items fill the first experience, and once it''s full '
               || 'they roll over into the next one automatically. Each MUST be authorized for '
               || 'your Open Cloud API key (add it to the key with developer-product write). '
               || 'Leave blank for the default store.'
WHERE key = 'ROBLOX_DEVPRODUCT_PLACE_ID';
