# We Litt — Automation layer (Stripe & Twilio)

These are **optional** and **off by default** — the app behaves exactly as today
until you configure them. Both run as Supabase Edge Functions (so secrets stay
server-side) with config-gated client hooks. Neither is verified end-to-end yet;
test in Stripe/Twilio test mode before going live.

> ⚠️ Payments compliance (iOS): tickets to in-person events may use Stripe.
> The **Litt Pass subscription must use Apple In-App Purchase** on iOS — do not
> route it through Stripe. See [ios-compliance.md](ios-compliance.md).

## Prerequisites
- The [Supabase CLI](https://supabase.com/docs/guides/cli): `npm i -g supabase`
- `supabase login` then `supabase link --project-ref gipxgiiinscugtzxebyv`

---

## 1. Stripe checkout (real ticket payments)

**A. Deploy the function**
```bash
supabase functions deploy create-checkout
supabase secrets set STRIPE_SECRET_KEY=sk_test_...   # test key first
```

**B. Turn it on in the app** — edit [`../config.js`](../config.js):
```js
window.WELITT_STRIPE_PK = 'pk_test_...';   // your Stripe publishable key
```
Now "Reserve Now" on a paid event redirects to Stripe Checkout; on success the
app finalizes the ticket (status `paid`) and opens My Tickets. Leave
`WELITT_STRIPE_PK` empty to keep the current confirm-and-save flow.

**C. Production hardening (recommended next):** add a Stripe **webhook** →
an Edge Function that records the order server-side from `checkout.session.completed`,
so fulfillment doesn't depend on the browser returning. The current client-side
finalize is fine for testing.

---

## 2. Twilio auto-SMS (automatic safety alerts)

By default the Safety Center opens the phone's messaging app (you tap Send). With
this on, emergency alerts send **automatically**.

**A. Deploy the function**
```bash
supabase functions deploy send-sos
supabase secrets set TWILIO_ACCOUNT_SID=AC... \
                     TWILIO_AUTH_TOKEN=... \
                     TWILIO_FROM=+1XXXXXXXXXX
```

**B. Turn it on** — edit [`../config.js`](../config.js):
```js
window.WELITT_SMS_AUTO = true;
```
The emergency alert now calls `send-sos`; if it fails for any reason it **falls
back to the device messaging app**, so alerts are never silently lost.

---

## 3. Background live-location (trip tracking)

Continuous "share my trip" tracking needs a native capability and can't be done
from the web shell. Plan:
- Add `@capacitor-community/background-geolocation` to the iOS project.
- Add `NSLocationAlwaysAndWhenInUseUsageDescription` to `Info.plist`.
- Stream coordinates to a `trips` table (new) while a trip is active; share a
  read-only live link with the chosen contact.
- Requires the native project (see [ios-setup.md](ios-setup.md)) — do this once
  the Capacitor app is building.

---

## Security notes
- Secret keys (`STRIPE_SECRET_KEY`, Twilio token) live **only** in Supabase
  function secrets — never in `config.js` or the client.
- `config.js` holds only publishable values (`pk_...`, the anon key).
- The functions set permissive CORS for the browser; tighten `Access-Control-Allow-Origin`
  to your domain before launch.
