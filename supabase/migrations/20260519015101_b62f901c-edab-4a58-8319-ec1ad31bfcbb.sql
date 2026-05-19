-- Hosting subscription per user (monthly bot hosting: $5 solo / $10 multi)
create table if not exists public.hosting_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  stripe_subscription_id text,
  stripe_customer_id text,
  price_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  past_due_since timestamptz,
  grace_period_ends_at timestamptz,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hosting_subscriptions_user on public.hosting_subscriptions(user_id);
create index if not exists idx_hosting_subscriptions_grace on public.hosting_subscriptions(grace_period_ends_at) where status = 'past_due';

alter table public.hosting_subscriptions enable row level security;

create policy "Users view own hosting subscription"
  on public.hosting_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins view all hosting subscriptions"
  on public.hosting_subscriptions for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create policy "Support views hosting subscriptions"
  on public.hosting_subscriptions for select
  to authenticated
  using (has_support_access(auth.uid(), user_id));

create policy "Service role manages hosting subscriptions"
  on public.hosting_subscriptions for all
  to service_role
  using (true)
  with check (true);

create trigger hosting_subscriptions_set_updated
  before update on public.hosting_subscriptions
  for each row execute function public.update_updated_at_column();

-- Daily cron: expire grace periods
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previous schedule with the same name (idempotent re-run)
do $$
begin
  perform cron.unschedule('enforce-hosting-grace-daily');
exception when others then null;
end $$;

select cron.schedule(
  'enforce-hosting-grace-daily',
  '15 3 * * *',
  $$
  select net.http_post(
    url := 'https://prvqfjairnketwhmfshu.supabase.co/functions/v1/enforce-hosting-grace',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBydnFmamFpcm5rZXR3aG1mc2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NDIsImV4cCI6MjA5MjM3OTY0Mn0.7IRfiBSkw5tM67fxYADmd8MQ619AjEb1v7exa2ZRth8"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);