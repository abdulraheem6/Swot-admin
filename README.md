# Ads Manager — Cloudflare Pages (pages/ads-admin)

This branch adds a lightweight ads manager built on Cloudflare Pages + Pages Functions + Workers KV. It serves per-city JSON files for mobile apps and provides a small admin UI + admin API for editing ads.

Repository
- Repo: https://github.com/abdulraheem6/Swot-admin
- Branch with changes: `pages/ads-admin`

What this project provides
- Public reader endpoints (no auth):
  - GET /ads/<city>.json (e.g. `/ads/global.json`, `/ads/nizamabad.json`)
  - Implemented at `functions/ads/[city].json.js` — uses edge cache (caches.default), ETag, and Cache-Control headers.
- Admin API (protected by secret):
  - /admin/ads/<city> (GET, POST, PUT, DELETE)
  - Implemented at `functions/admin/ads/[city].js` — requires `ADMIN_TOKEN` (see setup).
  - On writes the admin function updates KV and attempts to prime the public edge cache so readers see updates immediately.
- Admin UI: static single-file UI at `public/admin/index.html` — calls the admin API using `x-admin-token` or `Authorization: Bearer <token>`.

Design principles and recommended workflow
- Pull-based client model: Android apps should fetch `/ads/global.json` and `/ads/<city>.json` and cache locally. Use `If-None-Match` with ETag to avoid downloading unchanged payloads.
- Keep JSON small and host media (images/videos) on a CDN / R2.
- Enable aggressive edge caching (s-maxage) so Cloudflare edge serves most client requests without hitting KV.
- Protect admin routes — use `ADMIN_TOKEN` for initial setup and migrate to Cloudflare Access (SSO) for production.

Setup (step-by-step)
1. Create the Cloudflare Pages project
   - In the Cloudflare Dashboard → Pages → Create a project.
   - Connect the project to this GitHub repo and select branch `pages/ads-admin`.
   - Build settings are not required for Pages Functions only, but keep the defaults if prompted.

2. Create a Workers KV namespace
   - Cloudflare Dashboard → Workers → KV → Create namespace.
   - Give it a friendly name (e.g., `ads-kv-namespace`).

3. Bind the KV namespace to Pages
   - Pages project → Functions → Variables & Secrets → KV Namespace Bindings → Add binding
     - Variable name: `ADS_KV`
     - Namespace: select the namespace you created

4. Add the admin secret (ADMIN_TOKEN)
   - Pages project → Functions → Variables & Secrets → Environment Variables & Secrets → Add secret
     - Key: `ADMIN_TOKEN`
     - Value: a strong random secret (do NOT commit this to git)
   - The admin UI sends this token in the `x-admin-token` header or `Authorization: Bearer <token>`.

5. Deploy the Pages site
   - Trigger a deploy in Pages (the repo/branch is already connected so Pages will build). After deployment, your Pages domain will host:
     - `https://<your-pages-domain>/ads/global.json`
     - `https://<your-pages-domain>/ads/nizamabad.json`
     - `https://<your-pages-domain>/admin/`

6. (Optional) Add a custom domain
   - Pages → Custom domains → Add domain (e.g. `mycloudpfarepages.dev`)
   - Follow the DNS instructions Cloudflare provides. Once added, the same endpoints will be available at your custom domain.

Example curl commands (replace <DOMAIN> and <ADMIN_TOKEN>)
- Public read (no auth):
  curl -i https://<DOMAIN>/ads/nizamabad.json

- Admin GET:
  curl -i -H "x-admin-token: <ADMIN_TOKEN>" https://<DOMAIN>/admin/ads/nizamabad

- Add an ad (POST):
  curl -i -X POST -H "Content-Type: application/json" -H "x-admin-token: <ADMIN_TOKEN>" \
    -d '{"ad": {"type":"banner","title":"Farm Mart","subtitle":"25% off","description":"Local offer","mediaUrl":"https://example.com/img.jpg","actionUrl":"https://example.com","actionLabel":"Order Now","sponsorTag":"Local","badgeText":"25% OFF","isDismissible":true,"locationInfo":"Nizamabad","rating":4.8}}' \
    https://<DOMAIN>/admin/ads/nizamabad

- Update an ad (PUT):
  curl -i -X PUT -H "Content-Type: application/json" -H "x-admin-token: <ADMIN_TOKEN>" \
    -d '{"id":"<ad-id>","ad":{"title":"Updated title","rating":4.9}}' \
    https://<DOMAIN>/admin/ads/nizamabad

- Delete an ad (DELETE):
  curl -i -X DELETE -H "x-admin-token: <ADMIN_TOKEN>" "https://<DOMAIN>/admin/ads/nizamabad?id=<ad-id>"

Seeding KV with initial data
- Option A: Use the admin UI once deployed to create sample ads (Admin UI → Create sample).
- Option B: Use Cloudflare CLI (wrangler) or API to write keys directly to KV. Example using Wrangler local runtime (or in Workers):
  - `wrangler kv:namespace create "ads-kv-namespace"` (if you use wrangler for local dev)
  - Or use the Cloudflare dashboard to edit KV keys manually.

Notes about caching, ETag, and client behavior
- The public reader sets these headers:
  - `Cache-Control: public, max-age=60, s-maxage=86400, stale-while-revalidate=86400`
  - `ETag: "<sha256>"`
- Clients should:
  - Store the last JSON and ETag locally.
  - Use `If-None-Match` header on subsequent requests; handle `304 Not Modified` by keeping local JSON.
  - Refresh on app cold start and then periodically (e.g., every 6–24 hours depending on how often ads change).
  - On receiving a push-notification signal (optional), perform a conditional GET to update immediately.

Compression and bandwidth
- Cloudflare serves compressed responses (brotli/gzip) automatically when clients support it. Keep JSON compact. Host large media on R2 or a CDN instead of embedding them.

Admin protection: ADMIN_TOKEN vs Cloudflare Access
- ADMIN_TOKEN (current implementation)
  - Quick to set up. Admin API and UI require this secret.
  - Store the token only in Pages secrets; never commit it.
- Cloudflare Access (recommended for production)
  - Replace or augment ADMIN_TOKEN by protecting the `/admin/*` path with Cloudflare Access (SSO, JWT). This avoids sharing a static token and integrates with your identity provider.

Priming the cache after admin writes
- The admin function attempts to prime the edge cache for `/ads/<city>.json` after writing to KV. KV is eventually consistent; priming reduces the window where readers might see stale data.

Android client best practices (summary)
1. Pull-based fetch with conditional GET (If-None-Match + ETag).
2. Local cache for offline and immediate display.
3. Background refresh schedule (e.g., 6–24h) and on-app-start refresh.
4. Batch impression/click events and upload periodically.
5. Enforce local frequency caps and consent checks.
6. Verify payload integrity optionally using an HMAC signature if you require tamper detection.

Optional: FCM signaling for near-real-time updates
- Use FCM only as a lightweight signal (topic message) telling devices to refresh — do NOT send full JSON via push.
- On admin update, publish a topic message (e.g., `city_nizamabad`) and devices subscribed to that topic will perform a conditional GET.
- Implement topic publishing in a secure backend (do not expose FCM server credentials in client-side code). The admin Pages function could trigger a server webhook that performs the FCM publish.

Monitoring and observability
- Monitor Pages/Workers analytics (edge request counts, cache hit ratio, bandwidth) from the Cloudflare dashboard.
- Measure origin (KV) read counts and tune `s-maxage` to reduce origin hits.

Merging and next steps
- If you want this merged into your repository default branch, open a PR from `pages/ads-admin` → `main` (or your default branch). I can open a PR for you if you want.
- Next optional work I can do for you:
  - Seed KV with sample JSON for multiple cities (scripted),
  - Add a `/track` endpoint for batched impressions/clicks,
  - Add server-side FCM publishing integration (secure webhook + sample code),
  - Provide an Android sample (Kotlin) showing conditional GET + local caching + batching.

Contact
- If you want me to open a PR updating `README.md` in this branch with further edits, or to perform any of the next steps above, tell me which action to take and I will proceed.
