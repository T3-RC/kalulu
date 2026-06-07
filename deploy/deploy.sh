#!/usr/bin/env bash
# Kalulu production deploy. Run from the repo root: ./deploy/deploy.sh [module-name]
set -euo pipefail

MODULE="${1:-kalulu}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> 1/5  Verifying toolchain"
command -v spacetime >/dev/null || { echo "Install SpacetimeDB CLI: https://spacetimedb.com/install"; exit 1; }
command -v cargo >/dev/null || { echo "Install Rust: https://rustup.rs"; exit 1; }
command -v npm >/dev/null || { echo "Install Node 18+"; exit 1; }

echo "==> 2/5  Testing + publishing the module ($MODULE)"
( cd spacetimedb/server && cargo test )
spacetime publish --project-path spacetimedb/server "$MODULE"

echo "==> 3/5  Regenerating TypeScript bindings"
spacetime generate --lang typescript \
  --out-dir spacetimedb/client/src/module_bindings \
  --module-path spacetimedb/server

echo "==> 4/5  Images: Cloudinary (no deploy needed)"
echo "    Ensure web/.env has VITE_CLOUDINARY_CLOUD_NAME + VITE_CLOUDINARY_UPLOAD_PRESET."

echo "==> 5/5  Building + deploying the web app"
( cd web && npm ci && npm run build )
# Host web/dist on Cloudflare Pages / Netlify / S3+CloudFront, e.g.:
#   npx wrangler pages deploy web/dist --project-name kalulu-web

echo "Done. Module '$MODULE' published; worker + web built."
