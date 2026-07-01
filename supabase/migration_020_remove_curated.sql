-- We Litt — migration 020: remove the fabricated demo catalog
-- Real events now flow from Ticketmaster + Google Events (SerpApi), so the
-- hand-written sample rows (source='curated') are inaccurate and must go —
-- including the fabricated "community" ones (fake block parties/festivals with
-- invented dates). Real community/civic events come from the ingesters instead
-- (ingest-serpapi is tuned for block parties / festivals / free concerts /
-- cultural events; add city open-data feeds like ingest-nyc-parks per metro).
--
-- ⚠️ One-way for the demo data. FKs (saved_events, rsvps, reviews) cascade, so
-- any test saves/RSVPs on demo events are cleared too. Run once.
-- NOTE: after this, do NOT re-run seed.sql against production (it re-adds curated).

delete from public.events where source = 'curated';

-- Sanity: remaining rows should all be ingested (ticketmaster / serpapi / …).
-- select source, count(*) from public.events group by source order by count(*) desc;
