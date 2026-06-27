-- We Litt — migration 015: ownership + viral-buzz curation fields
-- Adds two optional, curator-filled columns so the app can spotlight
-- minority-owned spots and food businesses that have gone viral — on brand
-- with Litt standards. Both are NULL until a human curates them, so nothing is
-- fabricated. Run once. Safe to re-run.

alter table public.events add column if not exists owned text;  -- e.g. 'black','latino','women','asian','lgbtq','minority'
alter table public.events add column if not exists buzz  text;  -- short highlight, e.g. 'Viral birria tacos'

-- The app maps `owned` codes to labels (Black-owned, Latino-owned, …), shows a
-- badge + a "Black & Brown-owned" filter, and surfaces `buzz` as a viral
-- highlight that also boosts the "Litt Right Now" heat ranking.

-- How to curate (examples — replace with VERIFIED real businesses only):
--   update public.events set owned='black',  buzz='Viral oxtail egg rolls'  where id = <id>;
--   update public.events set owned='latina', buzz='TikTok-famous birria'    where id = <id>;
--   update public.events set owned='women'                                  where id = <id>;
--
-- Accepted `owned` values (others fall back to "<Value>-owned"):
--   black, latino, latina, hispanic, asian, aapi, women, lgbtq, queer,
--   immigrant, indigenous, veteran, minority
--
-- ⚠️ Only set `owned`/`buzz` for businesses where the claim is verified —
-- these are public statements about real establishments.
