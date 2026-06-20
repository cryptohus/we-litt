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
- ✅ **Per-user persistence** — saved events, RSVPs, reviews, tickets/reservations, emergency contacts sync to Supabase; guest data merges in on first login.
- ◻️ **Automation (scaffolded, off by default):** Stripe checkout + Twilio auto-SMS Edge Functions ready to deploy (`docs/automation.md`).
- ✅ **Discovery** — **location + adjustable radius** (Eventbrite-style): use-my-location / city / ZIP, 10–100 mi, spanning city lines; search-first home feed, map, calendar, filters.
- ✅ **Ticketing** — real ticket creation + My Tickets + add-to-calendar + share (local; cloud sync in progress).
- ✅ **Restaurant reservations** — party size / date / time.
- ✅ **Reviews** — user-written, verified-attendee badge; ratings reflect real reviews ("New" when none).
- ✅ **Real RSVP** — honest "going" counts (no fabricated numbers).
- ✅ **Safety Center** — emergency alert (contacts / 911 / both), get-home-safe trip check-in, trusted contacts.
- ✅ **Notifications** — real preference toggles + permission flow.
- ✅ **Security** — user-generated content escaped (`escHtml`); service worker network-first so updates land.

---

## 3. Configuration & setup references

> 🚀 **Going live? Follow [`docs/ACTIVATION.md`](ACTIVATION.md)** — the single ordered runbook for migrations, Edge Function deploys, secrets, and config flags.


- **Supabase schema:** [`supabase/schema.sql`](../supabase/schema.sql) → run first.
- **Seed data:** [`supabase/seed.sql`](../supabase/seed.sql) (regenerate via `npm run gen:seed`).
- **Migrations (run in order):** [`migration_002_social.sql`](../supabase/migration_002_social.sql) (reviews/rsvps/contacts), [`migration_003_tickets.sql`](../supabase/migration_003_tickets.sql) (tickets), [`migration_004_rsvp_privacy.sql`](../supabase/migration_004_rsvp_privacy.sql) (RSVP privacy + counts RPC).
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
| #16 | Living Project Hub (this doc) |
| #17 | Tickets sync (migration 003 + cloud) |
| #18 | Merge guest data into account on first login |
| #19 | Automation scaffold: Stripe checkout & Twilio auto-SMS (config-gated) |
| #21 | True cross-user counts (privacy-preserving: numbers, not names) |
| #23 | Audit pass: removed fake latency, real distances, honesty fixes |
| #24 | Stripe webhook fulfillment (record tickets server-side) |
| #25 | Accessibility: dialog semantics, focus mgmt, keyboard, reduced-motion |
| #27 | In-app account deletion + data export |
| #28 | Activation runbook (docs) |
| #29 | **Location + radius discovery (Eventbrite-style) + search-first home** |

---

## 5. Roadmap / pathways (next)

### Near-term
- [x] **Tickets sync** — `tickets` table (migration 003) + cloud sync. *Run `migration_003_tickets.sql`.*
- [x] **Polish** — merge guest data into the account on first login.
- [x] **True cross-user counts** — RSVP counts + reviews reflect all users. *Run `migration_004_rsvp_privacy.sql`.* **Privacy: RSVP shows counts only, never who's going (rows owner-only + counts via RPC); review authors show (opted-in public content).**

### Automation layer (scaffolded, config-gated — see `docs/automation.md`)
- [~] **Stripe checkout** — Edge Function + client hook + **webhook fulfillment** shipped (inert until `WELITT_STRIPE_PK` + function deploy + secrets). Litt Pass → Apple IAP on iOS.
- [~] **Twilio auto-SMS** — Edge Function + client hook shipped (inert until `WELITT_SMS_AUTO` + Twilio secrets); falls back to device SMS.
- [ ] **Background live-location** — needs the native iOS build (plan in `docs/automation.md`).

### Pre-launch (see `ios-compliance.md`)
- [ ] Verify a sending domain in Resend; finalize iOS bundle id.
- [ ] Apple Developer Program (org); account deletion flow; privacy labels; age rating.
- [~] Accessibility: core pass done (#25); full WCAG / on-device VoiceOver audit (Dynamic Type, contrast, every control) still recommended.

### Scale (later)
- [ ] Boot loads all events + all RSVP counts; move to per-city queries + pagination at thousands of events.

---

## 6. Known limitations / debt

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
