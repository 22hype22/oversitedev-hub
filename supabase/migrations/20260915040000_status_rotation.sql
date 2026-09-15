-- Status messages you set, and more than one of them.
--
-- Two problems. The status message the dashboard saves was never applied by
-- the Customs and Roleplay bots: their set_status handler ignored the payload
-- and re-applied a hardcoded "watching N members" line, and a loop re-applied
-- it every ten minutes, so anything typed into the dashboard was overwritten
-- within minutes even on the bots that did honour it.
--
-- Second, a bot could only ever hold one line. Rotation is stored here rather
-- than derived, so it survives redeploys and every bot reads it the same way.

alter table public.bot_orders
  -- Ordered list of status lines to cycle through. Each entry is
  -- { "text": "...", "activity_type": "watching" }, where activity_type is
  -- optional and falls back to the order's own activity_type.
  add column if not exists status_rotation jsonb,
  -- Seconds between switches. NULL or < 15 means no rotation, and Discord
  -- rate-limits presence updates, so the bots clamp this to a sane floor.
  add column if not exists status_rotation_seconds integer;

comment on column public.bot_orders.status_rotation is
  'Ordered status lines to cycle through; NULL or fewer than 2 entries means a single fixed status.';
comment on column public.bot_orders.status_rotation_seconds is
  'Seconds between status switches. Bots clamp to a minimum of 15.';

-- Every bot reads its presence through this, so rotation arrives everywhere at
-- once rather than each bot growing its own fetch.
create or replace function public.runtime_get_dispatch_presence(_bot_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT jsonb_build_object(
    'presence', o.presence_status,
    'activity_type', o.activity_type,
    'activity_text', o.activity_text,
    'bio', o.bot_bio,
    'rotation', o.status_rotation,
    'rotation_seconds', o.status_rotation_seconds
  )
  FROM public.bot_orders o
  WHERE o.id = _bot_id
  LIMIT 1;
$function$;
