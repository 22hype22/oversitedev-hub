
ALTER TABLE public.bot_commands DROP CONSTRAINT IF EXISTS bot_commands_action_check;
ALTER TABLE public.bot_commands ADD CONSTRAINT bot_commands_action_check
  CHECK (action = ANY (ARRAY[
    'start','stop','restart','update','redeploy','shutdown',
    'list_channels','list_guilds','list_roles',
    'apply_config','post_message','start_giveaway','setup_stats'
  ]));
