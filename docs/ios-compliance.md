# We Litt — iOS launch: compliance & ethics checklist

Read this before submitting to the App Store. It covers the rules Apple enforces
*and* the ethical commitments that build user trust. Items marked 🚫 are common
rejection causes for events/ticketing apps.

## Payments (get this right first)
- 🚫 **Tickets to real, in-person events may use third-party payment (Stripe).**
  In-person events are "physical services" — Apple does **not** require In-App
  Purchase for them. This is how Eventbrite, DICE, and StubHub operate.
- 🚫 **A subscription that unlocks in-app features (the "Litt Pass") DOES require
  Apple In-App Purchase** and is subject to Apple's commission. Don't route the
  Pass through Stripe inside the app.
- Don't show external "buy on our website" links to dodge IAP for digital goods —
  that gets rejected. Keep the ticket(physical)/Pass(IAP) split clean.

## Privacy (the sensitive surface for this app)
- **Location:** request **"While Using the App"** only, with a clear purpose
  string. Never request "Always." Don't store raw coordinates longer than needed;
  compute "near me" then discard. **Never sell or share location data.**
- **Privacy nutrition labels:** declare every data type collected (email,
  location, purchases, usage) accurately in App Store Connect.
- **App Tracking Transparency:** only if you track users across other apps/sites.
  Best path: don't, and you avoid the prompt entirely.
- **Privacy policy URL** is required, reachable in-app and on the listing.

## Account & data rights
- 🚫 **In-app account deletion is mandatory** (not just "email us"). Build a
  "Delete my account" flow that removes the user's data.
- Support data export and honor deletion (GDPR / CCPA obligations).
- 🚫 If you offer any third-party social login, you must also offer
  **Sign in with Apple**.

## Honesty (don't ship fabricated data)
- 🚫 The current app uses **simulated** reviews, ratings, "X people going," the
  "squad," and an AI "concierge." Shipping these as if real is deceptive and an
  App Review risk. Before launch: back them with real data or clearly label them
  "sample / coming soon," and make the concierge's nature obvious.
- No fake scarcity or countdowns that don't reflect reality.

## Age rating & alcohol
- Nightlife + alcohol references → **17+** rating.
- If you ever facilitate alcohol purchase or 21+ entry, add real age
  verification — a checkbox is not enough.

## Real-world safety (this app sends people to venues at night)
- User reporting and blocking; moderation for user-posted photos/text.
- Don't expose a user's attendance/location to strangers by default — make
  "who's going" opt-in.
- Surface venue safety info and a clear way to report problems.

## Accessibility (also an Apple review checkpoint)
- VoiceOver labels on interactive elements, Dynamic Type support, sufficient
  color contrast (the dark theme needs checking), and adequate tap targets.

## Submission mechanics
- App icons + launch screen, screenshots for required device sizes.
- A demo account for the App Review team (since content is gated behind login).
- TestFlight beta round before public submission.

---
**Suggested order:** real backend + auth (so data is honest) → payments split →
privacy/account-deletion → safety/moderation → accessibility → TestFlight → submit.
