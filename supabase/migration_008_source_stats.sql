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
