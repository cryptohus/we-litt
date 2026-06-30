-- We Litt — migration 019: schedule the event-ingestion → dedupe pipeline
-- Keeps the catalog fresh automatically, in dependency order:
--   1. ingest-ticketmaster  (concerts/sports, with map pins)
--   2. ingest-serpapi        (Google Events: festivals, day parties, culture)
--   3. dedupe-events         (drop SerpApi rows that duplicate a Ticketmaster one)
-- dedupe must run AFTER both ingests, so the times are staggered.
--
-- Prereqs (one-time, dashboard → Database → Extensions): enable pg_cron + pg_net.
-- Replace <ANON_KEY> below with your project's anon (publishable) key — the same
-- value in config.js (it is safe to use here; RLS still protects the data).
-- For production, prefer storing it in Supabase Vault and reading it here.
--
-- CADENCE NOTE — respects free-tier API limits:
--   • Ticketmaster (5000 calls/day free) → ingest DAILY.
--   • SerpApi (~100 searches/month free; 8 per run) → ingest WEEKLY (~32/mo).
--     Bump to daily only on a paid SerpApi plan (daily ≈ 240 searches/month).
--   • dedupe-events has no external cost → DAILY, so it also cleans up after the
--     daily Ticketmaster re-ingest.

-- 08:00 UTC daily — Ticketmaster (deep paging; allow a longer timeout)
select cron.unschedule('ingest-ticketmaster-daily') where exists (select 1 from cron.job where jobname='ingest-ticketmaster-daily');
select cron.schedule('ingest-ticketmaster-daily', '0 8 * * *', $$
  select net.http_post(
    url     := 'https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/ingest-ticketmaster',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    timeout_milliseconds := 150000);
$$);

-- 08:20 UTC Mondays only — SerpApi / Google Events (weekly to stay within free tier)
select cron.unschedule('ingest-serpapi-weekly') where exists (select 1 from cron.job where jobname='ingest-serpapi-weekly');
select cron.schedule('ingest-serpapi-weekly', '20 8 * * 1', $$
  select net.http_post(
    url     := 'https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/ingest-serpapi?pages=1',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    timeout_milliseconds := 120000);
$$);

-- 08:40 UTC daily — dedupe (runs after both ingests have finished)
select cron.unschedule('dedupe-events-daily') where exists (select 1 from cron.job where jobname='dedupe-events-daily');
select cron.schedule('dedupe-events-daily', '40 8 * * *', $$
  select net.http_post(
    url     := 'https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/dedupe-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    timeout_milliseconds := 120000);
$$);

-- Inspect:  select * from cron.job;
--           select * from cron.job_run_details order by start_time desc limit 20;
-- Stop all: select cron.unschedule(jobname) from cron.job
--             where jobname in ('ingest-ticketmaster-daily','ingest-serpapi-weekly','dedupe-events-daily');
