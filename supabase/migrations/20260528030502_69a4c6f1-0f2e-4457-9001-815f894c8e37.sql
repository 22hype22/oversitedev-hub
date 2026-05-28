DROP POLICY IF EXISTS "Anon bots can read bot_config" ON public.bot_config;
CREATE POLICY "Anon bots can read bot_config"
ON public.bot_config
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.bot_orders
    WHERE bot_orders.id = bot_config.bot_id
  )
);

DROP POLICY IF EXISTS "Anon bots can update bot_config applied_at" ON public.bot_config;
CREATE POLICY "Anon bots can update bot_config applied_at"
ON public.bot_config
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.bot_orders
    WHERE bot_orders.id = bot_config.bot_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bot_orders
    WHERE bot_orders.id = bot_config.bot_id
  )
);

DROP POLICY IF EXISTS "Users can manage their own bot config" ON public.bot_config;
CREATE POLICY "Users can manage their own bot config"
ON public.bot_config
FOR ALL
TO authenticated
USING (
  bot_id IN (
    SELECT id
    FROM public.bot_orders
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bot_id IN (
    SELECT id
    FROM public.bot_orders
    WHERE user_id = auth.uid()
  )
);