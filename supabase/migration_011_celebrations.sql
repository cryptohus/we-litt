-- We Litt — migration 011: city celebrations (live, overrides app defaults)
-- A per-city celebratory banner the app reads on load. Set by the sports-ingest
-- function or manually for real milestones; falls back to built-in fan-spirit
-- defaults when a city has no row. Run once. Safe to re-run.

create table if not exists public.celebrations (
  city_id    text primary key references public.cities(id) on delete cascade,
  emoji      text,
  text       text,
  gradient   text,
  active     boolean default true,
  updated_at timestamptz default now()
);

alter table public.celebrations enable row level security;

-- Publicly readable; writes only via the service role (ingest function / admin).
drop policy if exists "celebrations read" on public.celebrations;
create policy "celebrations read" on public.celebrations for select using (true);

-- Example (uncomment for a real milestone):
-- insert into public.celebrations (city_id, emoji, text, gradient) values
--   ('nyc','🏆','Congratulations Knicks — NBA Champions!','linear-gradient(135deg,#F58426,#1D428A)')
--   on conflict (city_id) do update set emoji=excluded.emoji, text=excluded.text,
--     gradient=excluded.gradient, active=true, updated_at=now();
