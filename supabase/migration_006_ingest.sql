-- We Litt — migration 006: support automated event ingestion
-- Adds source/external_id so ingested events (Ticketmaster, city feeds) upsert
-- cleanly without colliding with curated rows. Run once. Safe to re-run.

alter table public.events add column if not exists source      text default 'curated';
alter table public.events add column if not exists external_id  text;

-- Unique external_id (nullable; Postgres allows many NULLs) → enables upsert
-- on conflict (external_id) for ingested rows.
do $$ begin
  alter table public.events add constraint events_external_id_key unique (external_id);
exception when duplicate_object then null; end $$;

-- Auto-assign ids for ingested rows (curated ids are 0–1029; start well above).
create sequence if not exists events_ext_id_seq start 2000000;
alter table public.events alter column id set default nextval('events_ext_id_seq');
