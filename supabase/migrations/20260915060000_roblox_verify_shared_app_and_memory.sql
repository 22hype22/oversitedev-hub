-- Roblox verification: a shared OAuth app, and a memory that spans servers.
--
-- Verification runs on Roblox OAuth, which needs an app from
-- create.roblox.com — and Roblox gates creating one behind ID verification,
-- so some communities cannot get one at all. A bot may now leave its own
-- client id and secret blank and verify through Oversite's app instead. The
-- callback has to exchange the code with the SAME app that started the flow,
-- so each session records which bot's credentials it was opened with.
--
-- A member who has verified through any Oversite bot has proven the link
-- between their Discord account and their Roblox account. Making them do it
-- again in the next server is friction for nothing, so that link is now
-- looked up across every bot, which needs an index on the Discord id alone.

alter table public.roblox_verify_sessions
  add column if not exists oauth_bot_id uuid;

comment on column public.roblox_verify_sessions.oauth_bot_id is
  'Bot whose Roblox OAuth app opened this session; the callback must use the same one. NULL = the session''s own bot.';

create index if not exists roblox_verifications_discord_user
  on public.roblox_verifications (discord_user_id, verified_at desc);
