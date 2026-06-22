-- We Litt — migration 013: remove summer NBA watch parties (offseason)
-- The NBA season ends in June and resumes in late October, so these had no
-- games to watch. (Fall NBA "Game Night" events are kept.) Run once.
delete from public.events where id in (1030, 1034);
delete from public.events where type='sports' and (name ilike '%Knicks Playoff Watch%' or name ilike '%Heat Watch Party%');
