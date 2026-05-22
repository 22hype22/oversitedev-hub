create or replace function public.get_available_bot_token_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.bot_token_pool where status = 'available'
$$;

grant execute on function public.get_available_bot_token_count() to anon, authenticated;