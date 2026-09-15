-- Roleplay bots can hold an ER:LC server key too.
--
-- The session messages can now say what the game server is called, how many
-- players are in it, how many are queued and how many staff are on. All four
-- come from the ER:LC API, which needs the owner's server key, and until now
-- only dispatch bots had a slot to save one in. The key is stored and read
-- exactly like the dispatch one: encrypted, and handed to the bot through
-- runtime_get_bot_secret against its worker token.
--
-- Not required: a roleplay bot without a key works as it always did, and the
-- four variables read "unknown" until one is saved.

insert into public.bot_secret_slots (addon_id, key, label, description, placeholder, is_required, sort_order)
select 'roleplay', 'ERLC_SERVER_KEY', 'ER:LC server key',
       'Lets the session messages show your ER:LC server name, how many are playing, how many are queued and how many staff are on. From the ER:LC server settings, under the API tab.',
       'e.g. a1b2c3d4-...', false, 2
where not exists (
  select 1 from public.bot_secret_slots where addon_id = 'roleplay' and key = 'ERLC_SERVER_KEY'
);
