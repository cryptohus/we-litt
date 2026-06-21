-- We Litt — migration 009: remove the fabricated "Knicks Championship Parade"
-- event (id 122) from the live catalog. It was invented seed content (no such
-- championship occurred). Run once.

delete from public.events where id = 122;
-- belt-and-suspenders in case the id differs in your DB:
delete from public.events where name ilike '%Knicks Championship Parade%';
