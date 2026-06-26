-- We Litt — Phase 7 activation bundle (run once in the Supabase SQL editor).
-- Idempotent: safe to re-run. Adds the structural pieces missing from this
-- project (RSVP-count RPC, ingest columns, source view, celebrations, reports)
-- plus cleanup deletes. Run this FIRST, then run seed.sql to refresh content.
-- Generated 2026-06-26 from migrations 004,006,008,011,014,009,013.

-- ═══════════════════════════════════════════════════════════════════════
-- migration_004_rsvp_privacy
-- ═══════════════════════════════════════════════════════════════════════
-- We Litt — migration 004: RSVP privacy + public counts
-- Attendance is private: who is going is visible only to that user. The public
-- can see aggregate counts (numbers), never names/identities. Run once.

-- 1) Lock RSVP rows to the owner (was publicly readable). Each user still sees
--    only their own RSVPs; nobody can read the attendee list.
drop policy if exists "rsvps read"      on public.rsvps;
drop policy if exists "rsvps own read"  on public.rsvps;
create policy "rsvps own read" on public.rsvps for select using (auth.uid() = user_id);
-- (the existing owner-only "rsvps write" policy stays as-is)

-- 2) Expose ONLY aggregate counts per event — no user ids, no names.
--    security definer lets it count across all rows without exposing them.
create or replace function public.event_rsvp_counts()
returns table (event_id bigint, going bigint)
language sql
security definer
set search_path = public
as $$
  select event_id, count(*)::bigint as going
  from public.rsvps
  group by event_id;
$$;

grant execute on function public.event_rsvp_counts() to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- migration_006_ingest
-- ═══════════════════════════════════════════════════════════════════════
-- We Litt — migration 006: support automated event ingestion
-- Adds source/external_id so ingested events (Ticketmaster, city feeds) upsert
-- cleanly without colliding with curated rows. Run once. Safe to re-run.

alter table public.events add column if not exists source      text default 'curated';
alter table public.events add column if not exists external_id  text;

-- Unique external_id (nullable; Postgres allows many NULLs) → enables upsert
-- on conflict (external_id) for ingested rows.
do $$ begin
  alter table public.events add constraint events_external_id_key unique (external_id);
exception when duplicate_object or duplicate_table then null; end $$;

-- Auto-assign ids for ingested rows (curated ids are 0–1029; start well above).
create sequence if not exists events_ext_id_seq start 2000000;
alter table public.events alter column id set default nextval('events_ext_id_seq');


-- ═══════════════════════════════════════════════════════════════════════
-- migration_008_source_stats
-- ═══════════════════════════════════════════════════════════════════════
-- We Litt — migration 008: event source stats (for the in-app ingestion view)
-- Public aggregate of events by source (curated / ticketmaster / nyc-parks…)
-- with counts and the most recent add. Run after migration_006. Safe to re-run.

create or replace function public.event_source_stats()
returns table (source text, n bigint, last_added timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(source, 'curated') as source,
         count(*)::bigint            as n,
         max(created_at)             as last_added
  from public.events
  group by coalesce(source, 'curated')
  order by n desc;
$$;

grant execute on function public.event_source_stats() to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- migration_011_celebrations
-- ═══════════════════════════════════════════════════════════════════════
-- We Litt — migration 011: city celebrations (live, overrides app defaults)
-- A per-city celebratory banner the app reads on load. Set by the sports-ingest
-- function or manually for real milestones; falls back to built-in fan-spirit
-- defaults when a city has no row. Run once. Safe to re-run.

create table if not exists public.celebrations (
  city_id    text primary key references public.cities(id) on delete cascade,
  emoji      text,
  text       text,
  gradient   text,
  active     boolean default true,
  updated_at timestamptz default now()
);

alter table public.celebrations enable row level security;

-- Publicly readable; writes only via the service role (ingest function / admin).
drop policy if exists "celebrations read" on public.celebrations;
create policy "celebrations read" on public.celebrations for select using (true);

-- Example (uncomment for a real milestone):
-- insert into public.celebrations (city_id, emoji, text, gradient) values
--   ('nyc','🏆','Congratulations Knicks — NBA Champions!','linear-gradient(135deg,#F58426,#1D428A)')
--   on conflict (city_id) do update set emoji=excluded.emoji, text=excluded.text,
--     gradient=excluded.gradient, active=true, updated_at=now();


-- ═══════════════════════════════════════════════════════════════════════
-- migration_014_reports
-- ═══════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════
-- migration_009_remove_knicks
-- ═══════════════════════════════════════════════════════════════════════
-- We Litt — migration 009: remove the fabricated "Knicks Championship Parade"
-- event (id 122) from the live catalog. It was invented seed content (no such
-- championship occurred). Run once.

delete from public.events where id = 122;
-- belt-and-suspenders in case the id differs in your DB:
delete from public.events where name ilike '%Knicks Championship Parade%';


-- ═══════════════════════════════════════════════════════════════════════
-- migration_013_remove_offseason_nba
-- ═══════════════════════════════════════════════════════════════════════
-- We Litt — migration 013: remove summer NBA watch parties (offseason)
-- The NBA season ends in June and resumes in late October, so these had no
-- games to watch. (Fall NBA "Game Night" events are kept.) Run once.
delete from public.events where id in (1030, 1034);
delete from public.events where type='sports' and (name ilike '%Knicks Playoff Watch%' or name ilike '%Heat Watch Party%');


