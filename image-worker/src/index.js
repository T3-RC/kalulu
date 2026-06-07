/**
 * Kalulu image pipeline — Cloudflare Worker.
 *
 * Routes:
 *   POST /uploads/presign   -> { key, uploadUrl, publicUrl, thumbnailUrl }
 *                              Client PUTs the file directly to `uploadUrl` (R2,
 *                              S3-presigned). Keeps large bodies off the Worker.
 *   GET  /img/:key          -> serves the original from R2 (cached).
 *   GET  /img/:key?w=400    -> serves an on-demand resized variant via the
 *                              Images binding (falls back to original if unset).
 *
 * Then store `publicUrl` as the post's media_url and `thumbnailUrl` as its
 * thumbnail via the `create_post` / `set_thumbnail` reducers.
 *
 * Secrets / vars (see wrangler.toml):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, PUBLIC_BASE
 *   UPLOAD_TOKEN (shared secret required on /uploads/presign)
 * Bindings: BUCKET (R2), IMAGES (Cloudflare Images, optional)
 */
import { AwsClient } from "aws4fetch";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/avif"]);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/avif": "avif" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/uploads/presign" && request.method === "POST") {
      return presign(request, env);
    }
    if (url.pathname.startsWith("/img/") && request.method === "GET") {
      return serveImage(url, env, ctx);
    }
    if (url.pathname === "/health") return json({ ok: true });

    return json({ error: "Not found" }, 404);
  },
};

async function presign(request, env) {
  // Simple bearer-token gate. In production, verify a signed token minted by
  // your auth layer (or the SpacetimeDB identity) instead of a shared secret.
  const auth = request.headers.get("Authorization") || "";
  if (!env.UPLOAD_TOKEN || auth !== `Bearer ${env.UPLOAD_TOKEN}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const contentType = String(body.contentType || "");
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: `Unsupported content type: ${contentType}` }, 415);
  }

  const key = `posts/${crypto.randomUUID()}.${EXT[contentType]}`;
  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;

  const aws = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  // Presign a PUT valid for 10 minutes.
  const signed = await aws.sign(
    new Request(endpoint + "?X-Amz-Expires=600", { method: "PUT", headers: { "Content-Type": contentType } }),
    { aws: { signQuery: true } },
  );

  const base = env.PUBLIC_BASE.replace(/\/$/, "");
  return json({
    key,
    uploadUrl: signed.url,
    contentType,
    maxBytes: MAX_BYTES,
    publicUrl: `${base}/img/${key}`,
    thumbnailUrl: `${base}/img/${key}?w=400`,
  });
}

async function serveImage(url, env, ctx) {
  const key = decodeURIComponent(url.pathname.slice("/img/".length));
  if (!key || key.includes("..")) return json({ error: "Bad key" }, 400);

  const width = clampWidth(url.searchParams.get("w"));

  // Edge cache keyed by full URL (so each width caches separately).
  const cache = caches.default;
  const cacheKey = new Request(url.toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const object = await env.BUCKET.get(key);
  if (!object) return json({ error: "Not found" }, 404);

  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);

  let bodyStream = object.body;

  // Optional resize via the Images binding.
  if (width && env.IMAGES) {
    try {
      const result = await env.IMAGES.input(object.body)
        .transform({ width, fit: "scale-down" })
        .output({ format: "image/webp" });
      const resp = result.response();
      const out = new Response(resp.body, { headers });
      out.headers.set("Content-Type", "image/webp");
      ctx.waitUntil(cache.put(cacheKey, out.clone()));
      return out;
    } catch (e) {
      // Fall through to original on transform failure.
      bodyStream = (await env.BUCKET.get(key))?.body ?? null;
    }
  }

  const out = new Response(bodyStream, { headers });
  ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

function clampWidth(w) {
  if (!w) return null;
  const n = parseInt(w, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(64, Math.min(2048, n));
}
