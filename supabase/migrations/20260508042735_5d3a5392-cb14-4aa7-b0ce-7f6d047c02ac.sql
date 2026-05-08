CREATE OR REPLACE FUNCTION public.sweep_preorders_for_confirmation()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_count integer := 0;
BEGIN
  FOR v_order IN
    SELECT id
      FROM public.bot_orders
     WHERE status = 'preorder'
       AND discord_user_id IS NOT NULL
       AND stripe_payment_method_id IS NOT NULL
       AND confirmation_state = 'none'
  LOOP
    IF public.start_order_confirmation(v_order.id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sweep_preorders_for_confirmation() TO authenticated, service_role;
