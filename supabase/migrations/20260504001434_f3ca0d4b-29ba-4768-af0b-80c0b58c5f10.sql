CREATE TABLE public.bot_addon_state (
  bot_id uuid NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
  addon_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, addon_id)
);

ALTER TABLE public.bot_addon_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own bot addon state"
ON public.bot_addon_state
FOR ALL
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Service can read bot addon state"
ON public.bot_addon_state
FOR SELECT
USING (true);