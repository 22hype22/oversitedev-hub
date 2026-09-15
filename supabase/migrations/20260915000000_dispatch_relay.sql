-- Traffic passed between the dispatch desks of one community.
--
-- Police, fire and DOT dispatch are separate bots, because Discord allows one
-- voice connection per server per bot and each desk needs its own channel.
-- Separate bots are separate processes, so a unit asking police dispatch for an
-- ambulance has no way to reach the fire desk without somewhere to leave the
-- message. This is that somewhere.
--
-- Rows are short-lived: written by the desk that was asked, read once by the
-- desk that sends it, and swept after a day. Nothing here is a record of
-- anything, so nothing is kept.

create table if not exists public.dispatch_relay (
  id          uuid primary key default gen_random_uuid(),
  -- The community. Every desk serving one Discord server shares this, and it
  -- is what keeps one customer's traffic out of another's.
  guild_id    text not null,
  from_bot    uuid not null references public.bot_orders(id) on delete cascade,
  from_agency text not null,
  to_agency   text not null,
  -- What the receiving desk should put on its air, already worded.
  body        text not null,
  -- Where it came from, so the receiving desk can say so.
  callsign    text not null default '',
  place       text not null default '',
  created_at  timestamptz not null default now(),
  consumed_at timestamptz
);

-- The only query this table serves: what is waiting for this desk, oldest
-- first. Partial, because a consumed row is never looked at again.
create index if not exists dispatch_relay_waiting
  on public.dispatch_relay (guild_id, to_agency, created_at)
  where consumed_at is null;

alter table public.dispatch_relay enable row level security;

-- No policies on purpose. Bots reach this only through the dispatch-relay edge
-- function, which authenticates them by worker token and confirms the guild is
-- one they are actually in. Nothing client-side has any business reading it.

comment on table public.dispatch_relay is
  'Cross-agency dispatch traffic: one desk asking another to send something.';
