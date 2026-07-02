-- We Litt — migration 021: first-party telemetry (usage + errors)
-- Privacy-respecting, self-hosted analytics + error logging. No third party, no
-- cross-site cookies, no PII — just an anonymous client id so sessions can be
-- counted. Clients can only INSERT; reading is service-role/dashboard only
-- (like reports). Run once. Safe to re-run.

create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  event      text not null,                 -- 'screen_view' | 'event_open' | 'search' | 'rsvp' | 'tickets_open' | 'sign_in' | …
  props      jsonb default '{}'::jsonb,      -- small, non-PII context (ids, view name, query text)
  path       text,
  client_id  text,                           -- anonymous device id (localStorage)
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_evt_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_time_idx on public.analytics_events (created_at desc);

create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  message    text,
  stack      text,
  url        text,
  user_agent text,
  client_id  text,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_time_idx on public.client_errors (created_at desc);

alter table public.analytics_events enable row level security;
alter table public.client_errors    enable row level security;

-- Anyone (incl. signed-out) may insert; nobody can read via the anon/auth key.
drop policy if exists "analytics insert" on public.analytics_events;
create policy "analytics insert" on public.analytics_events for insert with check (true);
drop policy if exists "client_errors insert" on public.client_errors;
create policy "client_errors insert" on public.client_errors for insert with check (true);

-- Owner dashboards (run in the SQL editor):
--   -- top events, last 7 days
--   select event, count(*) from public.analytics_events
--     where created_at > now() - interval '7 days' group by event order by count(*) desc;
--   -- daily active (anonymous) devices
--   select date_trunc('day',created_at) d, count(distinct client_id)
--     from public.analytics_events group by d order by d desc;
--   -- recent errors
--   select created_at, message, url from public.client_errors order by created_at desc limit 50;
--   -- housekeeping: keep 90 days
--   delete from public.analytics_events where created_at < now() - interval '90 days';
