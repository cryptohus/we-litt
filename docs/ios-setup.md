# We Litt — iOS (Capacitor) setup

This wraps the existing web app in a native iOS shell with Capacitor. The web
PWA stays at the repo root (served by GitHub Pages); Capacitor bundles a copy
into `www/` and builds a native app around it. One codebase, two targets.

## Prerequisites (on a Mac)
- **Xcode** (full app from the Mac App Store — Command Line Tools alone are not
  enough). After install: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- **CocoaPods**: `brew install cocoapods` (or `sudo gem install cocoapods`)
- **Node 18+** and this repo's deps: `npm install`
- **Apple Developer Program** membership ($99/yr) to run on a device / submit.
  Enroll as an **organization** (needs a D-U-N-S number) so the app ships under
  the company, not a personal name. Start this early — verification takes days.

## Generate and run the native project
```bash
npm run ios:add     # copies web assets -> www/, then `cap add ios` (runs pod install)
npm run ios:open    # opens ios/App/App.xcworkspace in Xcode
```
In Xcode: select a Simulator (or your device), set your Team under
**Signing & Capabilities**, and press Run.

After any change to the web app, re-sync:
```bash
npm run sync        # copy:web + cap sync
```

## Finalize the bundle identifier FIRST
`capacitor.config.json` sets `"appId": "com.welitt.app"` as a placeholder.
**Change it to a reverse-DNS id on a domain you control before creating any
provisioning profile** (changing it later means redoing signing/provisioning and
losing TestFlight continuity). Then keep it stable forever.

## Native features to wire (after the shell runs)
The plugins are already in `package.json`. Each needs an `Info.plist` entry and
a small code path:

| Feature | Plugin | Info.plist key | Notes |
|---|---|---|---|
| Location | `@capacitor/geolocation` | `NSLocationWhenInUseUsageDescription` = "We use your location to show events near you." | Request **when-in-use** only. The app's web `navigator.geolocation` also works in the WKWebView, but the usage string is mandatory or the app crashes on first request. |
| Push | `@capacitor/push-notifications` | (Push Notifications capability + APNs key) | Ask permission contextually, not on launch. |
| Status bar | `@capacitor/status-bar` | — | Match the dark theme. |
| App lifecycle | `@capacitor/app` | — | Handle resume/deep links. |

## Deep links (Universal Links)
Set up an `apple-app-site-association` file on your web domain so event links open
the app. Needed for share links and marketing.

See [ios-compliance.md](ios-compliance.md) for the App Store + ethics checklist —
read it before submitting.
