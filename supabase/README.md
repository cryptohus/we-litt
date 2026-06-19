# We Litt — Supabase backend

The app ships with ~200 sample events and runs fully on that demo data with no
setup. To switch to a **live backend** (real, editable events that persist and
sync across devices), connect a Supabase project. ~10 minutes.

## 1. Create a project
1. Go to <https://supabase.com> → **New project**. Pick a name + region, set a
   database password.
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon / public** key (this is publishable — safe to ship in the browser)

## 2. Create the schema and load data
In the Supabase dashboard → **SQL Editor**:
1. Paste the contents of [`schema.sql`](schema.sql) and **Run**. This creates the
   `cities`, `events`, `profiles`, `saved_events`, and `orders` tables with Row
   Level Security (public can read the catalog; users only touch their own rows).
2. Paste the contents of [`seed.sql`](seed.sql) and **Run**. This loads the 8
   cities and ~200 demo events.

## 3. Point the app at it
Edit [`../config.js`](../config.js) and paste your two values:

```js
window.WELITT_SUPABASE_URL = 'https://abcd1234.supabase.co';
window.WELITT_SUPABASE_ANON_KEY = 'eyJhbGciOi...';   // the anon/public key
```

Commit and push. On next load the app hydrates `CITIES`/`EVENTS` from the
database instead of the bundled sample data — every screen updates automatically.
Leave `config.js` empty to fall back to demo data.

## Regenerating the seed
`seed.sql` is generated from the data in `index.html`:

```bash
node scripts/gen-seed.mjs
```

Re-run it whenever you change the `CITIES` or `EVENTS` arrays. It's safe to run
the resulting SQL repeatedly (upserts on `id`).

## What's next (not yet wired to the UI)
The schema already supports the next increments:
- **Auth** — replace the localStorage-only login with Supabase Auth (`profiles`
  is auto-created via trigger on signup).
- **Saved events** — persist saves to `saved_events` instead of localStorage.
- **Ticketing** — write `orders` on checkout, then add Stripe + QR tickets.
