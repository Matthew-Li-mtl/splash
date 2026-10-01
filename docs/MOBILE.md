# Splash on phones

There is **one codebase**. The mobile app is the same React build, wrapped by
[Capacitor](https://capacitorjs.com). Any feature you add to the web app is in the mobile app
after one sync. Nothing gets written twice.

## Option A: Install from the browser (works today, free)

Once deployed, open the site on a phone:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ → **Install app**

It opens full-screen with its own icon (the manifest and icons are in `apps/client/public`).
This is the cheapest way to get it in people's hands.

## Option B: Real app-store apps (Capacitor, already set up)

The native projects are generated and committed in `apps/client/android` and `apps/client/ios`.

### One-time setup

1. Deploy the server first ([DEPLOY.md](DEPLOY.md)).
2. Put your Render URL in `apps/client/.env.mobile`:
   ```
   VITE_API_URL=https://splash-abcd.onrender.com
   VITE_PUBLIC_URL=https://splash-abcd.onrender.com
   ```
3. In `apps/client/capacitor.config.ts`, change `appId` (`com.splash.app`) to your own
   reverse-domain id, e.g. `com.yourname.splash`. Stores need it to be unique, and it's hard to
   change after publishing.

### Android (works on Windows)

Install [Android Studio](https://developer.android.com/studio) (it includes the JDK), then:

```bash
npm run mobile:android
```

This builds the web app in mobile mode, copies it into `android/`, and opens Android Studio.
Press ▶ to run on an emulator or a USB-connected phone.

### iOS (needs a Mac)

On a Mac with Xcode: `npm install`, then `npm run mobile:ios`, then press ▶ in Xcode.
Publishing needs an Apple Developer account ($99/year). Google Play is $25 once.

### Shipping updates

```bash
npm run mobile:sync     # rebuild the web app + copy into both native projects
```

Then build or run from Android Studio or Xcode as usual. Native code only changes if you add a
Capacitor plugin (camera, push notifications…).

### Bundled vs. live mode

| | **Bundled** (default) | **Live** |
| --- | --- | --- |
| How | The web build ships inside the app and calls your API | The app loads your deployed website |
| Web deploys reach the app | After `mobile:sync` + store update | Instantly, no rebuild |
| Opens when the free server is asleep | Yes: UI is instant, shows "waking up" while data loads | Blank screen until the server wakes |
| App Store review | Safer | Apple may reject "just a website" apps (guideline 4.2) |

To try live mode (Git Bash):

```bash
CAP_SERVER_URL=https://splash-abcd.onrender.com npm run mobile:sync
```

PowerShell: `$env:CAP_SERVER_URL="https://splash-abcd.onrender.com"; npm run mobile:sync`

Running `npm run mobile:sync` again without the variable switches back to bundled mode.

A middle path, if update speed becomes important: keep bundled mode and add an over-the-air
update service (e.g. Capgo or Capawesome Live Updates) that pushes new web bundles to installed apps.

## Icons and splash screens

The source icon is `apps/client/assets/icon-only.png` (1024×1024). To regenerate every native
icon size after changing it:

```bash
cd apps/client
npx @capacitor/assets generate --android --ios --iconBackgroundColor "#fbf6ee" --splashBackgroundColor "#fbf6ee"
```

Keep `--android --ios`: without them the tool also rewrites the web manifest in `public/`.

## Things already handled for mobile

- **Auth** uses bearer tokens (not cookies), so the API works from the app's own origin.
- **CORS** already allows Capacitor's origins (`capacitor://localhost`, `https://localhost`).
- **Safe areas** (notches, home indicator) are handled in CSS with `--safe-area-inset-*`/`env()`.
- **Touch:** collage pieces drag with a finger, Minesweeper flags with a long-press, the song grid
  is tap-to-place with swipe-to-scroll, and sound plays even with the iPhone's silent switch on.
- **Images** are served with `Cross-Origin-Resource-Policy: cross-origin` so the app can load them.
