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

**C. Webhook fulfillment (record tickets server-side) — `stripe-webhook`**
The client finalizes the ticket on return, but if the buyer closes the tab after
paying, that won't run. The `stripe-webhook` function records it regardless
(idempotent — upserts by ticket id, so it converges with the client finalize,
no duplicates). `create-checkout` attaches the order as session `metadata`; the
webhook denormalizes event details from the `events` table.

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
# STRIPE_SECRET_KEY is from the earlier step. SUPABASE_URL and
# SUPABASE_SERVICE_ROLE_KEY are auto-injected into functions — do NOT set them
# (the CLI blocks setting SUPABASE_* secrets).
```
Then in **Stripe → Developers → Webhooks → Add endpoint**, paste the function URL
(`https://<ref>.supabase.co/functions/v1/stripe-webhook`) and subscribe to
**`checkout.session.completed`**. Copy the signing secret (`whsec_…`) into the
secret above. `--no-verify-jwt` is required because Stripe (not a logged-in user)
calls it; the function verifies the Stripe signature instead.

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

## 3. Ticketmaster ingestion (auto-pull concerts/festivals)

Automatically populates the catalog with upcoming events near each metro, on top
of the curated free events.

**A. Prep the schema** (once): run [`../supabase/migration_006_ingest.sql`](../supabase/migration_006_ingest.sql)
— adds `source` + `external_id` so ingested rows upsert without touching curated
events (`source='curated'`).

**B. Deploy + secret:**
```bash
supabase functions deploy ingest-ticketmaster
supabase secrets set TICKETMASTER_API_KEY=...   # from developer.ticketmaster.com
```

**C. Run it:** hit the function URL (or schedule it daily). It pulls music events
within 50 mi of all 8 metros and upserts them (`source='ticketmaster'`, keyed by
`external_id`). Idempotent — re-running updates in place.
- `?free=1` → ingest only free events.
- Schedule via `supabase functions` cron or any scheduler.

**D. Run it automatically (daily cron):**
1. Dashboard → Database → Extensions: enable **pg_cron** and **pg_net**.
2. Run [`../supabase/migration_007_cron.sql`](../supabase/migration_007_cron.sql)
   after pasting your anon key into it. Schedules a daily 08:00 UTC pull.
   - Inspect: `select * from cron.job_run_details order by start_time desc;`
   - Stop: `select cron.unschedule('ingest-ticketmaster-daily');`

**Notes:** curated events are never overwritten (different `source`). To remove
ingested events: `delete from events where source='ticketmaster';`.

### Second source — NYC Parks (free municipal events, e.g. SummerStage)
Same pattern, from NYC Open Data (Socrata):
```bash
supabase functions deploy ingest-nyc-parks
# optional: supabase secrets set NYC_OPENDATA_APP_TOKEN=...  NYC_PARKS_DATASET=<resource_id>
```
Call the URL or schedule it (copy the cron pattern from migration_007, pointing
at `ingest-nyc-parks`). Upserts with `source='nyc-parks'`.

⚠️ Socrata field names vary by dataset — the function maps defensively and
defaults coordinates to the NYC center when a row has none; verify the mapping
against your chosen `NYC_PARKS_DATASET` and tweak as needed. This is the template
for adding any other city/open-data feed.

## 4. Background live-location (trip tracking)

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
