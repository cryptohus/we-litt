-- We Litt — migration 017: daily freshness pipeline
-- Keeps the catalog current automatically: ingest new events, refresh venue
-- open/closed status, then prune dead listings. Order matters (ingest → status
-- → prune). Requires those functions deployed + their secrets set.
--
-- Prereqs (one-time, dashboard → Database → Extensions): enable pg_cron + pg_net.
-- Replace <ANON_KEY> with your project's anon (publishable) key (same as config.js).

-- Helper: schedule a daily POST to one of our functions at a given UTC time.
-- (Re-running replaces each job.)

-- 08:00 — ingest events (Ticketmaster; add eventbrite/nyc-parks lines as deployed)
select cron.unschedule('ingest-ticketmaster-daily') where exists (select 1 from cron.job where jobname='ingest-ticketmaster-daily');
select cron.schedule('ingest-ticketmaster-daily', '0 8 * * *', $$
  select net.http_post(
    url     := 'https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/ingest-ticketmaster',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    timeout_milliseconds := 60000);
$$);

-- 08:20 — refresh venue open/closed status (Google Places)
select cron.unschedule('refresh-venue-status-daily') where exists (select 1 from cron.job where jobname='refresh-venue-status-daily');
select cron.schedule('refresh-venue-status-daily', '20 8 * * *', $$
  select net.http_post(
    url     := 'https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/refresh-venue-status',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    timeout_milliseconds := 120000);
$$);

-- 08:40 — prune past / cancelled / closed / stale listings
select cron.unschedule('prune-events-daily') where exists (select 1 from cron.job where jobname='prune-events-daily');
select cron.schedule('prune-events-daily', '40 8 * * *', $$
  select net.http_post(
    url     := 'https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/prune-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    timeout_milliseconds := 60000);
$$);

-- Inspect:  select * from cron.job;   select * from cron.job_run_details order by start_time desc limit 20;
-- Stop all: select cron.unschedule(jobname) from cron.job where jobname like '%-daily';
