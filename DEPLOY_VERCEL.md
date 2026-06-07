# Deploying the Kalulu web app to Vercel

Your backend (SpacetimeDB Maincloud) and images (Cloudinary) are already online,
so only the **web frontend** needs hosting. Vercel builds it from GitHub and gives
you a public URL that re-deploys on every push. Free, no credit card.

The repo is already configured for this:
- `vercel.json` — build command + output dir + SPA rewrites
- `package.json` (root) — monorepo build that installs the client + web and builds
- `.gitignore` — excludes `node_modules`, `dist`, `.env`
- `spacetimedb/client/src/module_bindings/` is **committed** so the build needs no
  SpacetimeDB CLI.

Verified: `npm run build` produces `web/dist` cleanly.

## 1. Push to GitHub

Create an empty repo on github.com (e.g. `kalulu`), then from **this folder**
(`…/kalulu`, so the repo root has `vercel.json`):

```bash
cd ~/Documents/Claude/Projects/Apps/files/kalulu-complete/kalulu
git init
git add .
git commit -m "Kalulu: production web + SpacetimeDB module"
git branch -M main
git remote add origin https://github.com/<your-username>/kalulu.git
git push -u origin main
```

## 2. Import into Vercel

1. Go to https://vercel.com → sign up **with GitHub** (no card).
2. **Add New… → Project** → import your `kalulu` repo.
3. Leave **Root Directory** as the repo root (Vercel auto-reads `vercel.json` —
   Framework = Other, Build = `npm run build`, Output = `web/dist`).
4. Expand **Environment Variables** and add these four (Production + Preview):

   | Name | Value |
   |------|-------|
   | `VITE_STDB_URI` | `wss://maincloud.spacetimedb.com` |
   | `VITE_STDB_DB` | `kalulu` |
   | `VITE_CLOUDINARY_CLOUD_NAME` | `dzgfrvhjf` |
   | `VITE_CLOUDINARY_UPLOAD_PRESET` | `kalulu_unsigned` |

5. **Deploy.** In ~1 minute you'll get a `https://kalulu-xxxx.vercel.app` URL.

After this, `git push` → Vercel auto-redeploys.

## 3. After it's live (optional hardening)

- **Lock down the Cloudinary preset.** It's unsigned (public), so anyone could
  upload to your account. In the preset settings, restrict allowed formats, set a
  max file size, and optionally enable incoming moderation.
- **Module is public.** Anyone can call reducers (post/like). Fine for a demo; add
  auth before you care about abuse.
- **Custom domain.** Add one free in Vercel → Project → Domains.

## Troubleshooting

- **Build fails resolving `spacetimedb`** — make sure `module_bindings/` got
  committed (it's not in `.gitignore`) and the root `package.json` build script ran
  (`npm install --prefix spacetimedb/client && …`).
- **Blank page / `schema.ts 'row'` error** — the committed bindings were generated
  by a different `spacetime` CLI than the `spacetimedb` npm version. Keep both at
  the same version (currently 2.4.1) and re-`spacetime generate` + commit.
- **Map unstyled** — Edge "Tracking Prevention" can block the Leaflet CDN CSS;
  harmless, or switch to a local Leaflet CSS import.
