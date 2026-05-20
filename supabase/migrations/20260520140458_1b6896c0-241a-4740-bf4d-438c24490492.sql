-- Single-row table holding the active override code
create table if not exists public.billing_override_code (
  id int primary key default 1,
  code text not null,
  rotated_at timestamptz not null default now(),
  constraint billing_override_code_single_row check (id = 1)
);

insert into public.billing_override_code (id, code)
values (1, upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)))
on conflict (id) do nothing;

alter table public.billing_override_code enable row level security;
-- intentionally no policies: only SECURITY DEFINER functions may read/write

-- Audit log of successful redemptions
create table if not exists public.billing_override_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_used text not null,
  redeemed_at timestamptz not null default now()
);

alter table public.billing_override_redemptions enable row level security;

create policy "Admins can view override redemptions"
  on public.billing_override_redemptions for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Admin fetch — auto-rotates if older than 15 minutes
create or replace function public.get_current_billing_override_code()
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

  select * into _row from public.billing_override_code where id = 1 for update;

  if _row.rotated_at < now() - interval '15 minutes' then
    update public.billing_override_code
       set code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
           rotated_at = now()
     where id = 1
     returning * into _row;
  end if;

  return query select _row.code, _row.rotated_at, _row.rotated_at + interval '15 minutes';
end
$$;

revoke all on function public.get_current_billing_override_code() from public;
grant execute on function public.get_current_billing_override_code() to authenticated;

-- User redeem — validates and marks billing as confirmed
create or replace function public.redeem_billing_override_code(_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.billing_override_code;
  _uid uuid := auth.uid();
  _email text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select * into _row from public.billing_override_code where id = 1 for update;

  -- If stale, rotate and reject — stale codes can never be redeemed
  if _row.rotated_at < now() - interval '15 minutes' then
    update public.billing_override_code
       set code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
           rotated_at = now()
     where id = 1;
    return false;
  end if;

  if upper(btrim(coalesce(_code, ''))) <> _row.code then
    return false;
  end if;

  select email into _email from auth.users where id = _uid;

  insert into public.dashboard_billing_info
    (owner_user_id, billing_name, billing_email, address_line1, country, needs_update, updated_at)
  values
    (_uid, 'Override (off-platform payment)', coalesce(_email, ''), 'Override', 'XX', false, now())
  on conflict (owner_user_id) do update
    set needs_update = false,
        updated_at = now();

  insert into public.billing_override_redemptions (user_id, code_used)
  values (_uid, _row.code);

  return true;
end
$$;

revoke all on function public.redeem_billing_override_code(text) from public;
grant execute on function public.redeem_billing_override_code(text) to authenticated;