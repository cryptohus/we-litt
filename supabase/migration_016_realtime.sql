-- We Litt — migration 016: real-time accuracy fields for ingested events
-- Backs the "always current" pipeline: real timestamps (so nothing is guessed
-- from a string), event status (cancelled/postponed), venue operating status
-- (Google Places business_status), and freshness tracking for pruning.
-- Run once. Safe to re-run.

alter table public.events add column if not exists starts_at    timestamptz;        -- real start (ingested)
alter table public.events add column if not exists ends_at      timestamptz;        -- real end (ingested)
alter table public.events add column if not exists status       text default 'active'; -- active | cancelled | postponed
alter table public.events add column if not exists venue_status text;               -- OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
alter table public.events add column if not exists place_id     text;               -- Google Places id (status + dedup)
alter table public.events add column if not exists url          text;               -- source/ticket link
alter table public.events add column if not exists last_seen_at timestamptz default now(); -- last time ingestion saw it

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_place_id_idx  on public.events (place_id);

-- The app reads these: eventOccurrence() prefers starts_at/ends_at; isUnavailable()
-- hides status in (cancelled,postponed) and venue_status = CLOSED_PERMANENTLY.

-- Manual cleanup helpers:
--   -- hide a closed venue immediately:
--   update public.events set venue_status='CLOSED_PERMANENTLY' where venue ilike '%<name>%';
--   -- see what's stale (ingested rows not seen recently):
--   select source, count(*) from public.events
--     where source <> 'curated' and last_seen_at < now() - interval '2 days' group by source;
