# Kalulu Mobile (Expo + SpacetimeDB)

**Status: increment 1 — connection + Feed + Upload (the core post/view loop).**
Wired to the same backend as the web app: SpacetimeDB Maincloud + Cloudinary.
Map / Events / Profile come next, after we confirm the SDK runs on a device.

> ⚠️ Not yet tested on a device — the SpacetimeDB SDK isn't officially supported in
> React Native, so this is the step where we find out if the polyfills are enough.
> Run it on your phone and report what happens.

## What changed from the old MVP
- `src/spacetime/` — vendored SpacetimeDB client (`kalulu.ts`, `hooks.ts`) + generated
  `module_bindings`, so Metro doesn't have to reach outside `mobile/`.
- `src/polyfills.js` — `crypto.getRandomValues`, `TextEncoder`/`TextDecoder`, `Buffer`.
- `metro.config.js` — enables package-exports resolution (RN/browser build of the SDK).
- `src/services/cloudinary.js` — unsigned RN upload.
- `App.js` — loads polyfills, connects anonymously, gates on connection, shows Feed + Upload.
- The old REST screens (Map, Events, Profile, …) are still in `src/screens/` but **not
  wired into navigation yet** — they used the retired FastAPI backend.

## Run it

```bash
cd mobile
npm install
npx expo start
```

Then on your phone:
1. Install **Expo Go** (App Store / Play Store).
2. Make sure phone + computer are on the **same Wi-Fi**.
3. Scan the QR code (iOS Camera / Expo Go on Android).

Config is already in `mobile/.env` (Maincloud + your Cloudinary cloud/preset).

## What to verify
1. App shows "Connecting to Kalulu…" then lands on the **Feed**.
2. **Share** tab → pick a photo → it uploads and appears in the Feed within ~1s.
3. Posting from the **web app** shows up live in the mobile Feed (and vice-versa).
4. Tapping ♥ toggles the like count.

## Troubleshooting / known risks (RN + SpacetimeDB)
- **Stuck on "Connecting…" or a red error mentioning `crypto`, `TextEncoder`,
  `WebSocket`, or `getRandomValues`** → a polyfill/runtime gap. Confirm `polyfills.js`
  is the first import in `App.js` and that `npm install` pulled
  `react-native-get-random-values`, `text-encoding`, `buffer`.
- **"Unable to resolve module spacetimedb"** → run `npm install` in `mobile/`.
- **Connects on web but not in Expo Go** → Expo Go can't add native modules. Try a
  dev client: `npx expo install expo-dev-client` then `eas build --profile development`.
- **If the SDK simply won't run in RN**, the fallback is to talk to SpacetimeDB over
  its **HTTP API** with `fetch` (call reducers + SQL reads, poll instead of realtime).
  Say the word and I'll swap `src/spacetime/` for an HTTP client — more robust in RN,
  just without live push.

## Next increment
Map (react-native-maps), Events + EventDetail, PostDetail, Profile — all on the same
hooks (`usePosts`, `useEvents`, `useEvent`, `useFollowingFeed`).
