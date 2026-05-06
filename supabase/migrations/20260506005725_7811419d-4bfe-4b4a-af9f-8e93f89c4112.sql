CREATE TABLE public.bot_say_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  bot_id uuid NOT NULL,
  name text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_say_drafts_user_bot ON public.bot_say_drafts(user_id, bot_id, updated_at DESC);

ALTER TABLE public.bot_say_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own say drafts" ON public.bot_say_drafts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own say drafts" ON public.bot_say_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own say drafts" ON public.bot_say_drafts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own say drafts" ON public.bot_say_drafts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bot_say_drafts_updated_at
  BEFORE UPDATE ON public.bot_say_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();