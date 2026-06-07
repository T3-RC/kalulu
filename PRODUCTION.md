# Kalulu — Production Build

This is the production architecture from `HANDOFF.md`, implemented. It replaces the
MVP's FastAPI + SQLite backend with a **SpacetimeDB** module (real-time sync),
stores images on **Cloudinary** (free, no credit card), and ships **web** + **mobile**
clients on a shared SpacetimeDB client layer.

> **Status: module compiles + core logic tested; not yet deployed.**
> The Rust module **compiles cleanly to WASM against `spacetimedb 1.12.0`**
> (`cargo build --target wasm32-unknown-unknown`), and the pure logic
> (DBSCAN clustering, neighborhood detection, haversine, civil-date) **passes
> `cargo test`**. The TypeScript client + hooks **pass `tsc`** against
> SDK-shaped stubs; the image worker passes `node --check`. Still outstanding:
> generating real bindings against a live module (`spacetime generate`) and an
> actual deploy (needs your SpacetimeDB/Cloudflare/AWS accounts). See test
> results in `deploy/TEST_RESULTS.md`.

## Architecture

```
React Native (Expo)        Web (Vite + React + Leaflet)
        \                        /
         \   @kalulu/client (shared TS wrapper + hooks)
          \        |  spacetimedb SDK (WebSocket, real-time)
           \       v
            SpacetimeDB module (Rust, WASM)
            - tables: users, posts, events, likes, comments, follows
            - reducers: create_post, like, comment, follow, set_profile, ...
            - scheduled reducer: run_clustering (DBSCAN every 5 min)
                         |
        images ->  Cloudinary (unsigned upload + on-the-fly thumbnails, CDN)
```

## Repository layout (added in this build)

```
kalulu/
├── spacetimedb/
│   ├── server/                 # Rust module (the backend)
│   │   ├── Cargo.toml
│   │   └── src/{lib.rs, geo.rs, clustering.rs}
│   └── client/                 # Shared TS client + React hooks
│       ├── package.json, tsconfig.json, README.md
│       └── src/{kalulu.ts, hooks.ts}   (+ module_bindings/ after generate)
├── web/                        # Vite + React + Leaflet production web app
│   └── src/{main.tsx, App.tsx, upload.ts, styles.css}
├── image-worker/               # LEGACY (Cloudflare R2) — unused with Cloudinary; safe to delete
│   └── src/index.js, wrangler.toml
├── mobile/src/services/realtime.ts   # RN adapter over @kalulu/client
├── deploy/{deploy.sh, MONITORING.md}
├── .github/workflows/ci.yml
└── .env.example
```

The MVP (`backend/`, `frontend/`, current `mobile/` screens) is kept intact for
reference and for data migration until the cutover is complete.

## Prerequisites

- Rust + `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- SpacetimeDB CLI — https://spacetimedb.com/install
- Node 20+ (the `spacetimedb` SDK and Wrangler require it; Node 18 will fail)
- Cloudinary account (free, no credit card) — for image storage + thumbnails
- (Optional) AWS account for Rekognition moderation

## Run locally

```bash
# 1. Module: start a local instance + publish
spacetime start &                                   # leave running
( cd spacetimedb/server && cargo test )             # unit tests (geo, clustering, dates)
spacetime publish --project-path spacetimedb/server kalulu

# 2. Generate TS bindings (creates spacetimedb/client/src/module_bindings/)
cd spacetimedb/client && npm install && npm run generate && cd ../..

# 3. (No separate image service needed — uploads go straight to Cloudinary.)
#    Just set your cloud name + unsigned preset in web/.env (next step).

# 4. Web app
cd web && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
```

## Deploy

```bash
./deploy/deploy.sh kalulu        # tests + publishes module, regenerates bindings,
                                 # deploys worker, builds web
```
CI is wired in `.github/workflows/ci.yml` (test module + typecheck on PRs; publish
module, deploy worker, deploy web on push to `main`). Secrets required:
`SPACETIMEDB_TOKEN`, `CLOUDFLARE_API_TOKEN`. See `.env.example` for the rest.

## Data model notes

- **Table names are plural** (`users`, `posts`, `likes`, …) on purpose: `user` and
  `like` are SQL reserved words and break subscription queries. The generated TS
  handles follow suit (`conn.db.posts`, …); row *types* keep struct names (`Post`).
- **Clustering** is a scheduled reducer (every 5 min), porting the MVP's DBSCAN
  (`eps=150`, `min_samples=3`) into dependency-free Rust (`clustering.rs`). It only
  touches public, un-clustered posts from the last 24h.
- **Images never enter the database** — only URLs. Upload flow: the web client
  does an unsigned upload straight to Cloudinary, then stores the returned
  `secure_url` (with `f_auto,q_auto`) as `media_url` and a `w_400` transformation
  URL as the thumbnail. No API key/secret in the client; thumbnails are generated
  on the fly by Cloudinary's CDN.

## Version-sensitive spots to check on first build

1. `init()`: `TimeDuration::from_micros` / `ScheduleAt::Interval` — **verified OK on
   1.12.0.** If a future version differs, use
   `ScheduleAt::Interval(std::time::Duration::from_secs(300).into())`.
2. `client_connected()`: `Identity::to_hex_string()` **did not exist on 1.12.0** —
   resolved to `ctx.sender.to_string()` (the compiler-suggested fix). ✅
3. `Cargo.toml` pins `spacetimedb = "1"` (resolved to 1.12.0). Match it to
   `spacetime --version` and re-run `spacetime generate` after any version change.

## Remaining integrations (need your credentials/services)

- **AI moderation (AWS Rekognition).** Not wired — it needs AWS creds and a
  decision on where to run. Recommended: in `image-worker` after a successful
  upload, call Rekognition `DetectModerationLabels`; on a hit, call a new
  `flag_post` reducer to set `visibility = "hidden"`. The hook point is the end of
  `presign`/a post-upload callback. (The MVP's `backend/moderation.py` has the
  label thresholds to port.)
- **Push notifications** (Phase 3 in the handoff) — Expo push + a notifications
  table/reducer.
- **Web map clustering of markers** at low zoom (perf) — add Leaflet.markercluster.
- **Data migration** from the SQLite MVP into SpacetimeDB (one-off script calling
  `create_post` per legacy row).

## What was verified vs. not

- **Verified by building/testing** (Rust 1.96, spacetimedb 1.12.0, Node 22):
  module compiles to WASM; `cargo test` passes for DBSCAN/geo/date; an independent
  Python DBSCAN reference reproduces the same clustering; `tsc` passes for the
  client + hooks (against SDK-shaped stubs); worker passes `node --check`. Two real
  bugs were caught and fixed during testing (see TEST_RESULTS.md).
- **Not yet verified:** real generated bindings (needs a live `spacetime generate`),
  end-to-end runtime behavior, and deployment — all require your accounts. The TS
  typecheck used hand-written stubs, so confirm generated names on first `npm run
  generate`.
```
