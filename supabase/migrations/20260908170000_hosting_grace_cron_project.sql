-- The daily hosting-grace job was still posting to the previous Supabase
-- project, so it never ran here. Point it at this project and send the shared
-- internal secret, which enforce-hosting-grace now requires.
--
-- This job cancels every monthly-hosted bot of an owner whose hosting
-- subscription is past due and past its 10-day grace period. Run it only when
-- that behaviour is wanted on this project.
DO $$
BEGIN
  PERFORM cron.unschedule('enforce-hosting-grace-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'enforce-hosting-grace-daily',
  '15 3 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://kqhyjxtylvigrezlxzpl.supabase.co/functions/v1/enforce-hosting-grace',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_l0o6Ar9o7M7oG4jNBimoiw_X8cxmfeE',
      'Authorization', 'Bearer sb_publishable_l0o6Ar9o7M7oG4jNBimoiw_X8cxmfeE',
      'x-internal-secret', (SELECT internal_secret FROM public.deploy_config WHERE id = 1)
    ),
    body := '{}'::jsonb
  );
  $job$
);
