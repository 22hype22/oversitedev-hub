create or replace function public.rotate_billing_override_code()
returns table(code text, rotated_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.billing_override_code;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  update public.billing_override_code
     set code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
         rotated_at = now()
   where id = 1
   returning * into _row;

  return query select _row.code, _row.rotated_at, _row.rotated_at + interval '15 minutes';
end
$$;

revoke all on function public.rotate_billing_override_code() from public;
grant execute on function public.rotate_billing_override_code() to authenticated;