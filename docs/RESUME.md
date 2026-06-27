# We Litt — Resume Here

> **Snapshot of where the project stands and the practical path forward.**
> Last updated: 2026-06-26. Companion docs: [LAUNCH.md](LAUNCH.md) (full checklist),
> [PROJECT.md](PROJECT.md) (architecture), [ACTIVATION.md](ACTIVATION.md),
> [automation.md](automation.md).

---

## ✅ What's live & working right now

- **App:** single-file PWA, deployed to GitHub Pages → https://cryptohus.github.io/we-litt/
- **Backend:** Supabase project `gipxgiiinscugtzxebyv` — **live**, serving real data.
  - **251 events**, 8 cities, served from the DB (app hydrates on load).
  - Feature tables all live: reviews, RSVPs, saved events, tickets/orders,
    emergency contacts, **celebrations**, **reports**.
  - RPCs working: `event_rsvp_counts`, `event_source_stats`.
- **Auth:** real passwordless sign-in (Supabase built-in email).
  - Sign in via **emailed code** (8-digit) → profile persists to `user_metadata`.
  - PKCE flow + a code-entry fallback (robust for phone mail apps).

### Shipped milestones (all merged to `main`)
- Legal + trust pack: `privacy.html`, `terms.html`, 18+ age gate, report/moderation (PR #53)
- Launch checklist (PR #54)
- **Phase 5 — Security hardening:** CORS allowlist, SRI + pinned CDN, CSP, noopener, SW precache (PR #55)
- **Phase 6 — Accessibility:** keyboard operability, labels, card/detail a11y; Mac VoiceOver pass ✅ (PRs #56, #57)
- **Phase 7 Part A — Database activation** (migrations 004–014 + seed refresh → 251 events)
- **Phase 7 Part B — Auth** (code sign-in working)

---

## ▶️ Practical path forward (pick up here)

Everything below is **config/account work** (your accounts), with me guiding +
verifying. Do them in roughly this order; each is independent enough to do solo.

### 1. Phase 9 — Custom domain (`welitt.app`)  ⭐ highest leverage
*Why first: it unlocks Resend email AND gives a real URL for trust/PWA install.*
- Buy/confirm the domain at a registrar.
- GitHub Pages → Settings → custom domain; add DNS records; enable HTTPS.
- Update `manifest.json` start_url + the Supabase Auth Site/redirect URLs.
- After it's live: update the Edge Function `ALLOWED_ORIGINS` if needed.

### 2. Email deliverability — Resend  (needs the domain from step 1)
- Verify the sending domain in Resend.
- Add Resend SMTP in Supabase → Auth → SMTP settings.
- Removes the built-in mailer's rate limit + spam issues.

### 3. Phase 7 Part C — Edge functions  (needs the Supabase CLI)
- One-time: `npm i -g supabase` then `supabase login` + `supabase link --project-ref gipxgiiinscugtzxebyv`
- Deploy the functions that matter:
  - `delete-account` — makes in-app account deletion work server-side (**App Store requirement**).
  - `ingest-ticketmaster`, `ingest-nyc-parks` — auto-pull real events (set their API keys).
  - `create-checkout` + `stripe-webhook` — only when doing payments (Phase 8).
- All deploy commands are in [automation.md](automation.md). Re-deploy the 3
  CORS-updated functions (`create-checkout`, `delete-account`, `send-sos`) so the
  allowlist takes effect.

### 4. Phase 8 — Payments (Stripe)  *only if selling tickets at launch*
- Stripe account + keys; deploy `stripe-webhook`; test in test mode.
- iOS: Litt Pass subscription must use Apple IAP, not Stripe (see ios-compliance.md).

### 5. Phase 10 — Legal review
- Have an attorney review `privacy.html` / `terms.html`; fill the `[bracketed]` placeholders.

### Later — iOS App Store
- Needs a Mac with Xcode + CocoaPods (not on this machine). See [ios-setup.md](ios-setup.md).

---

## 🍽️ Curating food & ownership (viral spots + minority-owned)

The feature is built (PR #59) but **empty until curated** — by design, so nothing
is fabricated. Two optional columns power it: `owned` (a tasteful badge + the
"★ Black & Brown-owned" filter) and `buzz` (a "🔥 \<what they're known for\>"
highlight that also boosts a spot in **Litt Right Now**).

**Steps**
1. Run `supabase/migration_015_food_curation.sql` once (adds the `owned` + `buzz` columns).
2. In the Supabase SQL editor, set them on **verified** events only:
   ```sql
   update public.events set owned='black',  buzz='Viral oxtail egg rolls' where id = <id>;
   update public.events set owned='latina', buzz='TikTok-famous birria'    where id = <id>;
   update public.events set owned='women'                                  where id = <id>;
   ```
3. Accepted `owned` values (others fall back to "\<Value\>-owned"):
   `black, latino, latina, hispanic, asian, aapi, women, lgbtq, queer, immigrant, indigenous, veteran, minority`.

**Rules of the road**
- ⚠️ Only set `owned`/`buzz` for businesses where the claim is **verified** —
  these are public statements about real establishments.
- Keep it **on brand with Litt standards** (quality, culture-first) and weighted
  toward **Black, Brown & minority-owned** spots that have genuinely gone viral
  for a dish, dessert, or boundary-pushing culinary work.
- To find what's been curated: `select id, name, owned, buzz from public.events where owned is not null or buzz is not null;`

> **Distinction baked into the app:** *Happening now* = the clock (event is on
> right now). *Litt Right Now* = heat/energy (trending, packed, great DJ / live
> performance / viral buzz) — these are scored differently on purpose.

---

## ⚠️ Gotchas to remember (so we don't relearn them)

- **OTP codes are 8 digits** on this project; the code input accepts up to 10.
- **On phones, use the emailed CODE, not the link** — mail apps open links in an
  in-app browser where the session doesn't reach your real browser. (Resend + a
  real domain improves this.)
- **Email templates need `{{ .Token }}`** to show the code. The **Magic Link**
  template has it; add the same block to **Confirm signup** for brand-new emails.
- **All SQL is idempotent** — safe to re-run. `seed.sql` is the catalog source of
  truth; re-run it to refresh content. `supabase/activate_phase7.sql` bundles the
  structural migrations.
- **`config.js`** holds only the publishable anon key (RLS-protected; safe to commit).
- **Verify live backend state** anytime with a REST probe using the anon key
  (e.g. `GET /rest/v1/events?select=id` with `Prefer: count=exact`).

---

## How to verify things are working
- App loads real data: open the site, confirm events appear; DevTools console
  shows `[auth] session on load: …`.
- Sign-in: 👤 → email → **Email me a magic link** → enter the code → signed in.
- Backend counts: probe the REST API (see gotchas) — events should be **251**.
