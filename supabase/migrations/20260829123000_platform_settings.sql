-- Global platform settings: owner/admin-only write, any signed-in user can read.
-- Backs the hidden "Extras" config (the cog on the Report a bug / Custom feature
-- cards) — it stores the destination channel id and the designed message for
-- those global flows. It is NOT tied to a specific bot, so it can't live in
-- bot_config (whose bot_id foreign-keys a real bot).
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

-- Any authenticated user can read: a bug-report submitter needs to look up the
-- configured destination channel + message design. Only non-sensitive config
-- (a channel id and a message layout) lives here.
drop policy if exists "platform_settings read" on public.platform_settings;
create policy "platform_settings read"
on public.platform_settings for select
to authenticated
using (true);

-- Only admins may create / update / delete.
drop policy if exists "platform_settings admin write" on public.platform_settings;
create policy "platform_settings admin write"
on public.platform_settings for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
