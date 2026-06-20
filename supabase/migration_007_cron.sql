-- We Litt — migration 007: schedule automatic Ticketmaster ingestion
-- Runs the ingest-ticketmaster Edge Function daily so new concerts/festivals
-- appear automatically. Requires the function deployed + TICKETMASTER_API_KEY set.
--
-- Prereqs (one-time, in the dashboard → Database → Extensions): enable
--   pg_cron  and  pg_net.
--
-- Then replace <ANON_KEY> below with your project's anon (publishable) key —
-- the same value in config.js. (For production, store it in Supabase Vault and
-- read it here instead of pasting inline.)

-- (Re)schedule: daily at 08:00 UTC. Re-running replaces the existing job.
select cron.unschedule('ingest-ticketmaster-daily')
  where exists (select 1 from cron.job where jobname = 'ingest-ticketmaster-daily');

select cron.schedule(
  'ingest-ticketmaster-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/ingest-ticketmaster',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- To ingest free events only, append ?free=1 to the url above.
-- To stop:   select cron.unschedule('ingest-ticketmaster-daily');
-- To inspect: select * from cron.job;   /   select * from cron.job_run_details order by start_time desc limit 10;
