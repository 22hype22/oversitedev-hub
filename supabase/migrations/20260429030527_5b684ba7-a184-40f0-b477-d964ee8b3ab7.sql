CREATE TABLE public.bot_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL,
  user_id UUID NOT NULL, -- owner of the bot (for RLS)
  requested_by UUID NOT NULL, -- who clicked the button (owner or support admin)
  action TEXT NOT NULL CHECK (action IN ('start','stop','restart','update')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','completed','failed','canceled')),
  worker_id TEXT,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_commands_bot_created ON public.bot_commands (bot_id, created_at DESC);
CREATE INDEX idx_bot_commands_pending ON public.bot_commands (status, created_at) WHERE status = 'pending';

ALTER TABLE public.bot_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their bot commands"
  ON public.bot_commands FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bot commands"
  ON public.bot_commands FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support: view bot commands"
  ON public.bot_commands FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

CREATE POLICY "Service role manages bot commands"
  ON public.bot_commands FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_bot_commands_updated_at
  BEFORE UPDATE ON public.bot_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enqueue helper (called from the dashboard)
CREATE OR REPLACE FUNCTION public.enqueue_bot_command(_bot_id UUID, _action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF _action NOT IN ('start','stop','restart','update') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid action.');
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.');
  END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;

  INSERT INTO public.bot_commands (bot_id, user_id, requested_by, action)
  VALUES (_bot_id, _bot_owner, _user_id, _action)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'action', _action);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_bot_command(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_bot_command(uuid, text) TO authenticated;