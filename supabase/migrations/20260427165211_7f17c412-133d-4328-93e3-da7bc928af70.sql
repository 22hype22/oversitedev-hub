-- =====================================================
-- Bot Orders + Build Jobs
-- =====================================================
-- bot_orders: a saved customer bot configuration (their selections from the Bot Builder)
-- bot_build_jobs: a queue row picked up by an external worker (Railway + Claude)
--                 to actually generate the bot. One order can have many jobs (rebuilds, retries).

-- ---------- bot_orders ----------
CREATE TABLE public.bot_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Identity
  bot_name TEXT NOT NULL,
  bot_description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  -- Configuration
  base TEXT NOT NULL,                 -- 'protection' | 'support' | 'utilities' | 'scratch'
  addons TEXT[] NOT NULL DEFAULT '{}',
  monthly_hosting BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  -- Pricing snapshot at time of order (so future price changes don't rewrite history)
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  -- Linkage to payment (optional — set when checkout completes)
  purchase_id UUID,
  subscription_id UUID,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | paid | cancelled
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_orders_user_id ON public.bot_orders(user_id);
CREATE INDEX idx_bot_orders_status ON public.bot_orders(status);

ALTER TABLE public.bot_orders ENABLE ROW LEVEL SECURITY;

-- Users see and manage only their own orders
CREATE POLICY "Users can view their own bot orders"
  ON public.bot_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bot orders"
  ON public.bot_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bot orders"
  ON public.bot_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own draft orders"
  ON public.bot_orders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'draft');

-- Admins can see and manage every order
CREATE POLICY "Admins can view all bot orders"
  ON public.bot_orders FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any bot order"
  ON public.bot_orders FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any bot order"
  ON public.bot_orders FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_bot_orders_updated_at
  BEFORE UPDATE ON public.bot_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- bot_build_jobs ----------
CREATE TABLE public.bot_build_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  -- Snapshot of selections so the worker has everything it needs in one row
  selections JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Worker lifecycle
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | claimed | building | ready | failed | cancelled
  attempts INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,            -- which worker picked it up (for visibility)
  claimed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Output
  delivery_url TEXT,         -- final invite URL, dashboard URL, or download link
  artifact_url TEXT,         -- download link to generated source/zip if applicable
  build_log TEXT,            -- short log/summary
  error_message TEXT,        -- error if failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_build_jobs_order_id ON public.bot_build_jobs(order_id);
CREATE INDEX idx_bot_build_jobs_user_id ON public.bot_build_jobs(user_id);
CREATE INDEX idx_bot_build_jobs_status ON public.bot_build_jobs(status);

ALTER TABLE public.bot_build_jobs ENABLE ROW LEVEL SECURITY;

-- Customers can see the status of their own builds (read-only)
CREATE POLICY "Users can view their own build jobs"
  ON public.bot_build_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins manage everything
CREATE POLICY "Admins can view all build jobs"
  ON public.bot_build_jobs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert build jobs"
  ON public.bot_build_jobs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update build jobs"
  ON public.bot_build_jobs FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete build jobs"
  ON public.bot_build_jobs FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- (Service role bypasses RLS, so the Railway worker authenticated with the
--  service role key can claim/update jobs without a separate policy.)

CREATE TRIGGER update_bot_build_jobs_updated_at
  BEFORE UPDATE ON public.bot_build_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- Helper: queue a build job when an order is paid ----------
-- When an order transitions to 'paid', auto-create a pending build job so the
-- worker can pick it up. Avoids duplicates if the order is updated again.
CREATE OR REPLACE FUNCTION public.queue_bot_build_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bot_build_jobs
      WHERE order_id = NEW.id
        AND status IN ('pending','claimed','building','ready')
    ) THEN
      INSERT INTO public.bot_build_jobs (order_id, user_id, selections)
      VALUES (
        NEW.id,
        NEW.user_id,
        jsonb_build_object(
          'bot_name', NEW.bot_name,
          'bot_description', NEW.bot_description,
          'icon_url', NEW.icon_url,
          'banner_url', NEW.banner_url,
          'base', NEW.base,
          'addons', to_jsonb(NEW.addons),
          'monthly_hosting', NEW.monthly_hosting,
          'notes', NEW.notes
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_bot_build_after_paid
  AFTER UPDATE ON public.bot_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_bot_build_on_paid();