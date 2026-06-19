-- We Litt — migration 002: social tables (reviews, RSVPs, emergency contacts)
-- These features were added after the initial schema. Run once in the Supabase
-- SQL editor (after schema.sql). Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Reviews
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid   references auth.users(id) on delete cascade,
  event_id   bigint references public.events(id) on delete cascade,
  rating     int    not null check (rating between 1 and 5),
  text       text,
  author     text,
  verified   boolean default false,
  created_at timestamptz default now(),
  unique (user_id, event_id)            -- one review per user per event (editable)
);
create index if not exists reviews_event_idx on public.reviews(event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RSVPs ("I'm going")
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.rsvps (
  user_id    uuid   references auth.users(id) on delete cascade,
  event_id   bigint references public.events(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);
create index if not exists rsvps_event_idx on public.rsvps(event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Emergency contacts (private to each user)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.emergency_contacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  name       text,
  phone      text not null,
  created_at timestamptz default now()
);
create index if not exists emergency_contacts_user_idx on public.emergency_contacts(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.reviews            enable row level security;
alter table public.rsvps              enable row level security;
alter table public.emergency_contacts enable row level security;

-- Reviews & RSVPs: publicly readable (powers community ratings + going counts),
-- but each user writes only their own rows.
drop policy if exists "reviews read"   on public.reviews;
create policy "reviews read"   on public.reviews for select using (true);
drop policy if exists "reviews write"  on public.reviews;
create policy "reviews write"  on public.reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "rsvps read"     on public.rsvps;
create policy "rsvps read"     on public.rsvps for select using (true);
drop policy if exists "rsvps write"    on public.rsvps;
create policy "rsvps write"    on public.rsvps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Emergency contacts: strictly private — only the owner can read or write.
drop policy if exists "contacts own" on public.emergency_contacts;
create policy "contacts own" on public.emergency_contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
