# We Litt — Project Hub

The living source of truth for what We Litt is, how it's built, what's done, and
where it's going. Update this as the project evolves.

> **One-liner:** A culture-first events & nightlife discovery + ticketing PWA
> (iOS via Capacitor), aiming to be a practical Eventbrite alternative with a
> stronger discovery experience and real-world safety tools.

---

## 1. Architecture at a glance

| Layer | Choice | Notes |
|---|---|---|
| **Frontend** | Single-file PWA — `index.html` (~6k lines) + `sw.js` | No build step; ships as-is to GitHub Pages |
| **Hosting (web)** | GitHub Pages | https://cryptohus.github.io/we-litt/ (deploys from `main`) |
| **iOS** | Capacitor wrap (keeps one codebase) | Native project generated locally with `npm run ios:add` (needs Xcode + CocoaPods) |
| **Backend** | Supabase (Postgres + Auth + RLS) | Project ref `gipxgiiinscugtzxebyv`; client config in `config.js` |
| **Auth** | Supabase magic link | Email via custom SMTP (Resend) |
| **Email** | Resend (custom SMTP in Supabase) | Fixes built-in rate limits + deliverability |
| **Data layer** | In-memory `CITIES`/`EVENTS`, hydrated from Supabase on boot; `localStorage` for guest/offline | Single hydration point — every screen reads the global arrays |

**Key design principle:** every feature works for guests on `localStorage`, and
*upgrades* to Supabase when configured + signed in. Nothing hard-breaks without a
backend.

---

## 2. Current state (what's real)

- ✅ **Live data** — 8 cities + ~200 events served from Supabase.
- ✅ **Real auth** — magic-link sign-in, sessions persist across devices.
- ✅ **Per-user persistence** — saved events, RSVPs, reviews, emergency contacts sync to Supabase.
- ✅ **Discovery** — geo-first boot, city/zip search, filters, map, calendar, "Near You".
- ✅ **Ticketing** — real ticket creation + My Tickets + add-to-calendar + share (local; cloud sync in progress).
- ✅ **Restaurant reservations** — party size / date / time.
- ✅ **Reviews** — user-written, verified-attendee badge; ratings reflect real reviews ("New" when none).
- ✅ **Real RSVP** — honest "going" counts (no fabricated numbers).
- ✅ **Safety Center** — emergency alert (contacts / 911 / both), get-home-safe trip check-in, trusted contacts.
- ✅ **Notifications** — real preference toggles + permission flow.
- ✅ **Security** — user-generated content escaped (`escHtml`); service worker network-first so updates land.

---

## 3. Configuration & setup references

- **Supabase schema:** [`supabase/schema.sql`](../supabase/schema.sql) → run first.
- **Seed data:** [`supabase/seed.sql`](../supabase/seed.sql) (regenerate via `npm run gen:seed`).
- **Migrations:** [`supabase/migration_002_social.sql`](../supabase/migration_002_social.sql) (reviews/rsvps/contacts).
- **Client config:** [`../config.js`](../config.js) — Supabase URL + anon key (publishable; RLS-protected).
- **Supabase Auth URL config:** Site URL + redirect allowlist = `https://cryptohus.github.io/we-litt/`.
- **Email (Resend SMTP):** sender `onboarding@resend.dev` (test) / verified domain (prod); `smtp.resend.com:465`, user `resend`, password = Resend API key.
- **iOS setup:** [`docs/ios-setup.md`](ios-setup.md) · **App Store compliance:** [`docs/ios-compliance.md`](ios-compliance.md).

---

## 4. Milestones (shipped)

All merged to `main`. Dates 2026.

| PR | Milestone |
|---|---|
| #1 | Geo-first boot + city search + service-worker cache fix |
| #2 | Optional Supabase backend (schema, seed, hydration) |
| #3 | iOS foundation via Capacitor |
| #4 | Safety Center (emergency alert, get-home-safe, contacts) |
| #5 | Real ticketing, My Tickets, add-to-calendar, share |
| #6 | XSS hardening (`escHtml` on all user content) |
| #7 | User-written reviews + verified badge |
| #8 | Honest ratings (real reviews, not fabricated) |
| #9 | Real RSVP — honest "going" counts |
| #10 | Restaurant reservations (+ `fmtTime` collision fix) |
| #11 | Notification preferences |
| #12 | Go live: connect Supabase project |
| #13 | Supabase magic-link auth |
| #14 | Migration 002: social tables |
| #15 | Cloud persistence (saved/RSVP/reviews/contacts) |

---

## 5. Roadmap / pathways (next)

### Near-term
- [ ] **Tickets sync** — extend `orders` (or a `tickets` table) so tickets/reservations persist to the cloud.
- [ ] **Polish** — merge guest data into the account on first login; true cross-user aggregate counts (RSVPs/reviews) via async loading.

### Automation layer (needs external accounts; scaffold behind config)
- [ ] **Stripe checkout** — real payments. Tickets to in-person events → Stripe; **Litt Pass subscription → Apple IAP** on iOS (compliance). Needs a backend endpoint (Supabase Edge Function).
- [ ] **Twilio auto-SMS** — safety alerts send automatically (vs. opening the messaging app). Needs Edge Function + Twilio creds.
- [ ] **Background live-location** — continuous trip tracking via Capacitor background geolocation (needs native iOS build).

### Pre-launch (see `ios-compliance.md`)
- [ ] Verify a sending domain in Resend; finalize iOS bundle id.
- [ ] Apple Developer Program (org); account deletion flow; privacy labels; age rating; accessibility pass.

---

## 6. Known limitations / debt

- Tickets/reservations not yet cloud-synced (local only).
- Guest data created before first login isn't merged up (login pulls cloud as source of truth).
- `littScore` is a brand/algorithm metric (not user-derived); seed `distance` strings are static.
- "Going"/reviews show the signed-in user's own + cached data until async cross-user aggregation lands.
- Native iOS project must be generated on a Mac with Xcode (not committed).

---

## 7. Dev quickstart

```bash
npm install
# Web preview: serve the repo root over http (any static server)
# iOS (on a Mac with Xcode + CocoaPods):
npm run ios:add && npm run ios:open
# After web changes, re-sync the native shell:
npm run sync
# Regenerate seed.sql from the in-app data:
npm run gen:seed
```
