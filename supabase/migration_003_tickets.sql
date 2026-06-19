-- We Litt — migration 003: tickets & reservations
-- Holds both purchased tickets (kind='ticket') and table reservations
-- (kind='reservation'), denormalized so My Tickets renders without joins.
-- Run once in the Supabase SQL editor (after schema.sql). Safe to re-run.

create table if not exists public.tickets (
  id           text primary key,            -- app id: TKT-… / RSV-…
  user_id      uuid   references auth.users(id) on delete cascade,
  event_id     bigint references public.events(id) on delete set null,
  kind         text default 'ticket',       -- 'ticket' | 'reservation'
  code         text,
  event_name   text,
  venue        text,
  neighborhood text,
  emoji        text,
  gradient     text,
  date         text,
  "time"       text,
  qty_ga       int default 0,
  qty_vip      int default 0,
  total        int default 0,
  party_size   int,
  status       text default 'confirmed',
  created_at   timestamptz default now()
);
create index if not exists tickets_user_idx on public.tickets(user_id);

alter table public.tickets enable row level security;

-- Tickets are private to the owner.
drop policy if exists "tickets own" on public.tickets;
create policy "tickets own" on public.tickets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
