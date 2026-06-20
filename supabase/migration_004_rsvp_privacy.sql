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
