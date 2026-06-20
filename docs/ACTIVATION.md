# We Litt — Activation Runbook

Everything to turn on the live functionality, in order. Project ref:
`gipxgiiinscugtzxebyv`. Each section is independent — do the ones you want.

> Already done: Supabase project + schema + seed, `config.js` keys, Auth URL
> config, custom SMTP (Resend), and magic-link sign-in (working).

Legend: 🟢 = required for core features · 🔵 = optional (payments/SMS) · ⏳ = needs a Mac/Xcode.

---

## 0. One-time CLI setup (for deploying Edge Functions)
```bash
npm i -g supabase
supabase login
supabase link --project-ref gipxgiiinscugtzxebyv
```
(If you only run SQL migrations, you can skip this and use the dashboard SQL editor.)

---

## 1. 🟢 Database migrations (run in order)
Supabase dashboard → **SQL editor** → paste each file's contents → **Run**.
`migration_002` is already done.

1. [`supabase/migration_003_tickets.sql`](../supabase/migration_003_tickets.sql) — tickets/reservations sync.
2. [`supabase/migration_004_rsvp_privacy.sql`](../supabase/migration_004_rsvp_privacy.sql) — real going-counts + RSVP privacy.

**Verify:** after each, you should see "Success." Then in the app, RSVP on one
device and confirm the count is right; book a ticket and confirm it appears in
My Tickets on another device after sign-in.

---

## 2. 🟢 Account deletion function (App Store requirement)
No third-party keys needed — Supabase auto-injects `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` into functions.
```bash
supabase functions deploy delete-account
```
**Verify:** Profile → Privacy & Data → Delete account → confirm. The account +
data should be gone (try signing in again — it should create a fresh account).

---

## 3. 🔵 Stripe payments (real ticket checkout)
**A. Stripe account →** test keys from the Stripe dashboard (Developers → API keys).

**B. Deploy functions + set the secret key** (Supabase's own keys are auto-injected):
```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

**C. Add the webhook in Stripe →** Developers → Webhooks → **Add endpoint**:
- URL: `https://gipxgiiinscugtzxebyv.supabase.co/functions/v1/stripe-webhook`
- Event: **`checkout.session.completed`**
- Copy the signing secret, then:
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

**D. Turn it on in the app —** edit [`../config.js`](../config.js):
```js
window.WELITT_STRIPE_PK = 'pk_test_...';
```
Commit + push.

**Verify (Stripe test mode):** book a paid event → you land on Stripe Checkout →
pay with card `4242 4242 4242 4242` → you return and the ticket shows as paid;
confirm a `tickets` row exists even if you close the tab right after paying.

---

## 4. 🔵 Twilio auto-SMS (automatic safety alerts)
**A. Twilio account →** get a phone number + Account SID + Auth Token.

**B. Deploy + secrets:**
```bash
supabase functions deploy send-sos
supabase secrets set TWILIO_ACCOUNT_SID=AC... \
                     TWILIO_AUTH_TOKEN=... \
                     TWILIO_FROM=+1XXXXXXXXXX
```

**C. Turn it on —** edit [`../config.js`](../config.js):
```js
window.WELITT_SMS_AUTO = true;
```

**Verify:** Safety Center → add your own number as a contact → Emergency Alert →
Text contacts. You should receive an SMS automatically (no "tap to send"). If
Twilio is down/misconfigured it falls back to the device messaging app.

---

## 5. 🔵 Resend domain (email real users, not just yourself)
Until a domain is verified, magic-link emails only reach your own Resend
account email. To onboard real users:
1. Resend → **Domains → Add Domain** → add a domain you own.
2. Add the shown DNS records at your registrar; wait for **Verified**.
3. Supabase → Auth → SMTP → change **Sender email** to `something@yourdomain.com`.

---

## 6. ⏳ iOS app (native build — needs a Mac with Xcode)
See [ios-setup.md](ios-setup.md): `npm run ios:add` → `npm run ios:open`.
Background live-location (continuous trip tracking) lands here — see
[automation.md](automation.md) §3.

---

## Quick reference — secrets
Set only third-party secrets (never Supabase's own — they're auto-injected and
the CLI blocks setting `SUPABASE_*`):

| Secret | Used by | From |
|---|---|---|
| `STRIPE_SECRET_KEY` | create-checkout, stripe-webhook | Stripe API keys |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Stripe webhook endpoint |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | send-sos | Twilio console |

`config.js` flags: `WELITT_STRIPE_PK` (publishable), `WELITT_SMS_AUTO` (true/false).

---

## Post-activation smoke test
- [ ] Sign in on phone **and** laptop; RSVP/save on one → appears on the other.
- [ ] Book a paid event (Stripe test card) → ticket recorded.
- [ ] Emergency alert → SMS arrives automatically.
- [ ] Delete account → data gone; re-signup works.
- [ ] Add to Calendar, Share link, reservation, review — all persist.
