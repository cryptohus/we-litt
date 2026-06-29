-- We Litt — migration 018: external ticket/source link for ingested events
-- Aggregated events (Ticketmaster, Google Events via SerpApi) aren't sold through
-- We Litt, so they carry a real source URL that the app's "Get Tickets" button
-- deep-links to instead of opening the internal checkout. Run once. Safe to re-run.

alter table public.events add column if not exists url text;
