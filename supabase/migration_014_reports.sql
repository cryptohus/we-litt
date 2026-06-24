-- We Litt — migration 014: content reports (moderation queue)
-- Backs the in-app "Report" flow on events and reviews. Anyone (incl. signed-out
-- users) can file a report; only the service role / admin can read the queue.
-- Run once. Safe to re-run.

create table if not exists public.reports (
  id           bigint generated always as identity primary key,
  content_type text not null check (content_type in ('event','review')),
  content_id   text not null,
  reason       text not null,
  detail       text,
  reporter_id  uuid references auth.users(id) on delete set null,
  status       text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at   timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Anyone may submit a report (anon + authenticated). No one can read them via
-- the anon/auth key — moderation happens with the service role or in the
-- Supabase dashboard.
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert with check (true);

-- (No select policy on purpose: the queue is private to the service role.)

-- Moderation tips:
--   select * from public.reports where status='open' order by created_at desc;
--   update public.reports set status='resolved' where id = <id>;
