
ALTER TABLE public.hosting_subscriptions
  ADD COLUMN IF NOT EXISTS billing_override boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.redeem_billing_override_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _row public.billing_override_code;
  _uid uuid := auth.uid();
  _email text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select * into _row from public.billing_override_code where id = 1 for update;

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

  -- Mark billing info as confirmed
  insert into public.dashboard_billing_info
    (owner_user_id, billing_name, billing_email, address_line1, country, needs_update, updated_at)
  values
    (_uid, 'Override (off-platform payment)', coalesce(_email, ''), 'Override', 'XX', false, now())
  on conflict (owner_user_id) do update
    set needs_update = false,
        updated_at = now();

  -- Flip hosting subscription into override/active mode so the user is
  -- never charged monthly through Stripe and never falls into past_due.
  insert into public.hosting_subscriptions
    (user_id, status, billing_override, past_due_since, grace_period_ends_at, updated_at)
  values
    (_uid, 'active', true, null, null, now())
  on conflict (user_id) do update
    set status = 'active',
        billing_override = true,
        past_due_since = null,
        grace_period_ends_at = null,
        updated_at = now();

  insert into public.billing_override_redemptions (user_id, code_used)
  values (_uid, _row.code);

  return true;
end
$$;
