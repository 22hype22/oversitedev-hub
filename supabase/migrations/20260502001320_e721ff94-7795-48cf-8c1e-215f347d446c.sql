REVOKE ALL ON FUNCTION public.assign_pool_token_to_bot(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_bot_order_paid_assign_token() FROM PUBLIC, anon, authenticated;