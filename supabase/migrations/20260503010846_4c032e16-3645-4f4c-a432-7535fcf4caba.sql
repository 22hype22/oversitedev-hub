ALTER TABLE public.bot_commands
  DROP CONSTRAINT IF EXISTS bot_commands_status_check;

ALTER TABLE public.bot_commands
  ADD CONSTRAINT bot_commands_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'claimed'::text,
    'done'::text,
    'completed'::text,
    'failed'::text,
    'canceled'::text
  ]));