-- Let the bot (anon key) read the owner-only Extras config so the Discord
-- /suggestion and /reportbug commands can use the same channel the dashboard's
-- Custom Feature / Report a Bug editor saves.
--
-- platform_settings is otherwise readable only by authenticated users. Grant
-- anon SELECT, but scope the policy to the 'extras-*' keys only, so the bot can
-- read the Custom Feature / Report a Bug settings and nothing else.

GRANT SELECT ON public.platform_settings TO anon;

DROP POLICY IF EXISTS "platform_settings anon read extras" ON public.platform_settings;
CREATE POLICY "platform_settings anon read extras"
ON public.platform_settings
FOR SELECT
TO anon
USING (key LIKE 'extras-%');

NOTIFY pgrst, 'reload schema';
