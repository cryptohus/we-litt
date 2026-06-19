-- We Litt — database schema (Supabase / Postgres)
-- Run this once in the Supabase SQL editor, then run seed.sql.
-- Safe to re-run: uses "if not exists" / "drop policy if exists".

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cities (
  id          text primary key,
  name        text not null,
  state       text not null,
  emoji       text,
  lat         double precision not null,
  lng         double precision not null,
  zoom        int  default 12,
  tagline     text,
  event_count int  default 0
);

create table if not exists public.events (
  id           bigint primary key,
  city_id      text references public.cities(id) on delete cascade,
  name         text not null,
  type         text,
  type_label   text,
  venue        text,
  neighborhood text,
  date         text,
  "time"       text,
  price        text,
  litt_score   int,
  rating       numeric(2,1),
  reviews      int  default 0,
  going        int  default 0,
  lat          double precision,
  lng          double precision,
  vibes        text[] default '{}',
  description  text,
  emoji        text,
  featured     boolean default false,
  trending     boolean default false,
  tonight      boolean default false,
  tier         text,
  zip          text,
  created_at   timestamptz default now()
);
create index if not exists events_city_idx on public.events(city_id);
create index if not exists events_type_idx on public.events(type);

-- 1:1 with auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  created_at timestamptz default now()
);

create table if not exists public.saved_events (
  user_id    uuid   references auth.users(id) on delete cascade,
  event_id   bigint references public.events(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid   references auth.users(id) on delete cascade,
  event_id   bigint references public.events(id),
  qty_ga     int default 0,
  qty_vip    int default 0,
  total_cents int default 0,
  status     text default 'reserved',   -- reserved | paid | cancelled
  created_at timestamptz default now()
);
create index if not exists orders_user_idx on public.orders(user_id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cities       enable row level security;
alter table public.events       enable row level security;
alter table public.profiles     enable row level security;
alter table public.saved_events enable row level security;
alter table public.orders       enable row level security;

-- Public catalog: anyone (incl. anon) can read cities & events. No public writes.
drop policy if exists "cities read"  on public.cities;
create policy "cities read"  on public.cities for select using (true);
drop policy if exists "events read"  on public.events;
create policy "events read"  on public.events for select using (true);

-- Profiles: a user sees and edits only their own row.
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Saved events: a user fully manages only their own saves.
drop policy if exists "own saves" on public.saved_events;
create policy "own saves" on public.saved_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Orders: a user reads and creates only their own orders.
drop policy if exists "own orders select" on public.orders;
create policy "own orders select" on public.orders for select using (auth.uid() = user_id);
drop policy if exists "own orders insert" on public.orders;
create policy "own orders insert" on public.orders for insert with check (auth.uid() = user_id);
