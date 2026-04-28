
-- Fixes / changelog notes shown at the top of the dashboard
CREATE TABLE public.dashboard_fixes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active fixes"
  ON public.dashboard_fixes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert fixes"
  ON public.dashboard_fixes FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update fixes"
  ON public.dashboard_fixes FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete fixes"
  ON public.dashboard_fixes FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX dashboard_fixes_active_created_idx
  ON public.dashboard_fixes (is_active, created_at DESC);

-- Per-user saved card ordering for the bot dashboard
CREATE TABLE public.dashboard_addon_order (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  bot_id uuid NOT NULL,
  group_key text NOT NULL,
  ordered_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, bot_id, group_key)
);

ALTER TABLE public.dashboard_addon_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own addon order"
  ON public.dashboard_addon_order FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addon order"
  ON public.dashboard_addon_order FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addon order"
  ON public.dashboard_addon_order FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addon order"
  ON public.dashboard_addon_order FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX dashboard_addon_order_user_idx
  ON public.dashboard_addon_order (user_id, bot_id);
