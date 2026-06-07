# Operations & Monitoring

## Module (SpacetimeDB)

- **Logs:** `spacetime logs kalulu -f` (follow). The module logs user creation,
  clustering runs ("Clustering created N event(s)"), and reducer errors.
- **Inspect data:** `spacetime sql kalulu "SELECT COUNT(*) FROM post"` etc.
- **Schedule health:** confirm `clustering_schedule` has exactly one row:
  `spacetime sql kalulu "SELECT * FROM clustering_schedule"`. If clustering stops,
  the row was likely deleted — re-publish to re-run `init`, or insert it manually.
- **Energy/usage:** SpacetimeDB Maincloud bills by module "energy". Watch the
  dashboard; the 5-minute clustering job is the main recurring cost — widen the
  interval in `init` if posts are sparse.

## Image worker (Cloudflare)

- **Logs:** `npx wrangler tail kalulu-image-worker`.
- **Metrics:** Workers dashboard (requests, errors, CPU ms). `/img` is cached at
  the edge (`immutable`), so cache-hit ratio should be high.
- **R2:** monitor bucket size + class-A/B operations in the R2 dashboard.

## Web

- Host `web/dist` on Cloudflare Pages (or Netlify). Enable analytics there.
- Add an error reporter (Sentry) in `main.tsx` for production.

## Alerts to set up

1. Module reducer error rate > 0 sustained (parse `spacetime logs`).
2. Worker 5xx rate > 1%.
3. R2 storage approaching quota.
4. No new events created in 24h while posts are arriving (clustering broken).

## Backups

- SpacetimeDB: periodic `spacetime sql ... ` exports of `post`/`event`/`user`,
  or use the platform's snapshot/export feature.
- R2: enable bucket versioning; originals are immutable by key.
