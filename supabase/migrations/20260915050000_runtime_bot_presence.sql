-- Every bot reads its status from one place.
--
-- runtime_get_dispatch_presence was written for the dispatch bot and is now
-- what all of them use, so the name misleads. This is the same answer under a
-- name that means it. The old name stays so the deployed dispatch bot keeps
-- working until it redeploys; both return the same row.

create or replace function public.runtime_get_bot_presence(_bot_id uuid)
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

revoke all on function public.runtime_get_bot_presence(uuid) from public;
grant execute on function public.runtime_get_bot_presence(uuid) to anon, authenticated, service_role;
