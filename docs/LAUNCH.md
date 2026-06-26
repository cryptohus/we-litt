# We Litt — Launch Checklist

The ordered runbook to take We Litt from "looks great in preview" to "open to the
public." Work top-to-bottom: **Phase 1–3 are hard blockers** (don't launch
without them), **Phase 4–6 are launch hygiene** (do before or at launch), and
**Phase 7 (iOS)** is optional/after a web launch.

**Ownership legend:** 👤 = you (accounts/decisions) · 🛠️ = Claude can build it ·
⚖️ = needs a lawyer · ✅ = already done.

> **Recommended path:** launch the **web PWA first** (no app-review gate, fastest
> feedback), do a **soft beta in 1–2 cities**, then pursue iOS. See
> [PROJECT.md](PROJECT.md) for architecture and [ACTIVATION.md](ACTIVATION.md)
> for the exact backend commands.

---

## Phase 1 — Backend go-live  (BLOCKER)
*The app currently runs on ~250 seed events; Supabase is wired but the schema
isn't fully live. Full commands: [ACTIVATION.md](ACTIVATION.md).*

- [ ] 👤 Run migrations **002 → 014** in order in the Supabase SQL editor
      (002_social, 003_tickets, 004_rsvp_privacy, 005_free_events, 006_ingest,
      007_cron, 008_source_stats, 009_remove_knicks, 010_sports, 011_celebrations,
      012_marquee_sports, 013_remove_offseason_nba, 014_reports).
- [ ] 👤 Deploy the Edge Functions you need
      (`create-checkout`, `stripe-webhook`, `send-sos`, `delete-account`,
      `ingest-ticketmaster`, `ingest-nyc-parks`, `ingest-sports-celebrations`)
      and set their secrets — see [automation.md](automation.md).
- [ ] 👤 **Resend domain verification** so magic-link emails reach real inboxes
      (not just your own test address).
- [ ] 👤 Confirm `config.js` points at the live Supabase URL + anon key (it does).
- [ ] 🛠️ Verify end-to-end against the live DB: sign in, RLS (public read /
      owner-only write), hydration, RSVP counts, save/review sync.
- [ ] 👤 Turn on **Supabase backups** (Point-in-Time Recovery) and confirm a
      restore plan.

## Phase 2 — Legal & compliance  (BLOCKER)

- [x] ✅ Privacy Policy ([privacy.html](../privacy.html)) + Terms of Service
      ([terms.html](../terms.html)) drafted and linked in-app.
- [x] ✅ In-app **account deletion + data export** (App Store requirement; PR #27).
- [x] ✅ **Age gate** (18+) on first visit.
- [ ] ⚖️ **Attorney review** of Privacy + Terms; fill the `[bracketed]`
      placeholders (legal entity, address, governing law, contact email).
- [ ] 👤 Decide the gate age: **18+ (current)** vs 21+ (one-line change).
- [ ] 👤 Stand up the contact addresses referenced in the docs
      (`privacy@welitt.app`, `support@welitt.app`).
- [ ] 👤 Confirm GDPR/CCPA posture if you'll have EU/CA users (we don't sell data;
      rights + deletion are covered).

## Phase 3 — Real, accurate content  (BLOCKER)
*A discovery app with stale/fake listings loses trust instantly.*

- [ ] 👤 Turn on **Ticketmaster** + **NYC Parks** ingestion so the catalog is
      real and current (functions exist; [automation.md](automation.md) §3).
- [x] ✅ **Report/moderation flow** on events + reviews → private `reports` queue.
- [ ] 🛠️/👤 Define a lightweight **moderation cadence** (who checks the `reports`
      table, how often, what actions).
- [ ] 🛠️ Final accuracy sweep: no fabricated events, past events filtered, sports
      content season-gated (already enforced — re-verify against live data).

## Phase 4 — Payments  (blocker only if selling tickets at launch)

- [ ] 👤 Stripe **live** keys; deploy `stripe-webhook`; set `WELITT_STRIPE_PK`.
- [ ] 👤 Test a full purchase in Stripe **test mode** first (checkout → webhook →
      ticket appears in My Tickets).
- [ ] ⚖️/👤 Refund/dispute policy, sales-tax handling, organizer payout terms.
- [ ] 👤 ⚠️ On iOS, the **Litt Pass subscription must use Apple IAP**, not Stripe
      (tickets-to-real-events can use Stripe). See
      [ios-compliance.md](ios-compliance.md).

## Phase 5 — Security hardening  ✅ DONE (PR #55)

- [x] ✅ Lock down **CORS** on Edge Functions — allowlist via `_shared/cors.ts`
      (welitt.app + cryptohus.github.io; `ALLOWED_ORIGINS` secret to override).
      👤 redeploy the 3 functions for it to take effect.
- [x] ✅ **Content-Security-Policy** meta on index + legal pages (locked
      connect-src/img-src, base-uri/form-action 'self'). Note: `frame-ancestors`
      is inert in `<meta>` — set `X-Content-Type-Options`/`Referrer-Policy`/
      frame-ancestors as HTTP **headers** once off GitHub Pages.
- [x] ✅ **SRI hashes** + pinned versions on all CDN tags (supabase-js@2.108.2,
      Leaflet 1.9.4 css/js).
- [x] ✅ `rel="noopener noreferrer"` on the SOS live-location link.
- [x] ✅ Secrets audit — only the publishable anon key is client-side.
- [ ] 🛠️ Run `/security-review` on a release branch before launch (final pass).

## Phase 6 — Infra, quality & ops  (do at launch)

- [ ] 👤 **Custom domain** + HTTPS (move off `cryptohus.github.io/we-litt` for
      trust + a clean PWA install). Update `manifest.json` start_url + any
      hardcoded URLs.
- [ ] 🛠️/👤 **Error monitoring** (e.g. Sentry) — you currently have zero crash
      visibility.
- [ ] 🛠️/👤 **Privacy-respecting analytics** (e.g. Plausible) for basic usage.
- [ ] 🛠️ **Cross-browser/device QA**, especially **iOS Safari** (PWA quirks:
      install, safe-area, geolocation prompts).
- [~] 🛠️ **Accessibility pass** — code-side done (PR #56): all onclick `div`/`span`
      keyboard-operable, inputs labeled, `role="switch"` toggle, `aria-current`
      nav; contrast (PR #52) + dialog focus-trap/Escape (PR #25) already in.
      👤 Remaining: manual VoiceOver sweep (Mac + iOS).
- [ ] 🛠️ **Performance check** — the single ~500 KB file over mobile data.
      (✅ `sw.js` v4 now precaches `privacy.html`/`terms.html` — PR #55.)
- [ ] 👤 Basic **support channel** (the support email + a way to reach you).

## Phase 7 — iOS App Store  (optional / after web launch)
*See [ios-setup.md](ios-setup.md) + [ios-compliance.md](ios-compliance.md).*

- [ ] 👤 A **Mac with Xcode + CocoaPods** (this dev machine lacks them) to build
      the Capacitor wrapper (`npm run ios:add`).
- [ ] 👤 **Apple Developer account** ($99/yr).
- [ ] 👤 App icons, screenshots, App Store listing copy.
- [ ] 👤 Privacy "nutrition labels", age rating (nightlife/alcohol → 17+),
      and confirm IAP for Litt Pass.
- [ ] 👤 Submit for review; address feedback.

---

## Pre-launch smoke test (run right before going live)
- [ ] Fresh device, no cache: age gate → sign in (real email) → location prompt →
      see real nearby events.
- [ ] Save / RSVP / write a review → reload → still there (synced).
- [ ] Buy a ticket (test mode) → appears in My Tickets.
- [ ] Report an event + a review → row lands in `reports`.
- [ ] Privacy + Terms pages load; account deletion + data export work.
- [ ] Light/dark theme both readable; no console errors.

## Launch-day
- [ ] Flip ingestion crons on; confirm fresh events flowing.
- [ ] Monitor error tracker + `reports` table for the first hours.
- [ ] Announce to the soft-beta city/audience first.

---

*Keep this file updated as items are checked off. Companion docs:
[PROJECT.md](PROJECT.md) · [ACTIVATION.md](ACTIVATION.md) ·
[automation.md](automation.md) · [ios-setup.md](ios-setup.md) ·
[ios-compliance.md](ios-compliance.md).*
