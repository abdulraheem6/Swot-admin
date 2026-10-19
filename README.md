# Cloudflare Pages Ads Manager (Pages Functions + KV)

This project adds a lightweight ads manager to Cloudflare Pages using Pages Functions and Workers KV.

What it provides
- Public reader endpoints:
  - GET /ads/<city>.json — serves city-specific JSON (e.g. /ads/global.json, /ads/nizamabad.json)
  - Uses edge cache (caches.default) with Cache-Control and ETag. Reads are cached at the Cloudflare edge to minimize KV reads and cost.

- Admin API:
  - /admin/ads/<city> (GET, POST, PUT, DELETE) — manage ads for a city
  - Protected by ADMIN_TOKEN (set in Pages environment variables). The admin UI sends this token via `x-admin-token` header or `Authorization: Bearer <token>`.
  - On writes, the admin function updates KV and primes the edge cache so public reads reflect updates immediately.

- Admin UI: `public/admin/index.html` — minimal single-page UI to list/add/edit/delete ads.

Setup
1. Create a Cloudflare Pages project connected to this repository and branch `pages/ads-admin`.
2. Create a Workers KV namespace in the Cloudflare dashboard (Workers > KV > Create Namespace).
3. In Pages project settings, under Functions > Variables & Secrets > KV Namespace Bindings, add a binding:
   - Variable name: `ADS_KV`
   - Namespace: (select the KV namespace you created)
4. In Pages project settings > Environment variables, add the secret:
   - `ADMIN_TOKEN` = (a strong random secret used by the admin UI)
5. Deploy the Pages site. After deploy the endpoints will be available on your pages domain.
6. Optional: map a custom domain in Pages settings (e.g. `mycloudpfarepages.dev`) to use that hostname.

Usage notes
- The public endpoint path is `/ads/<city>.json` (matches Android client expectations).
- The admin UI is available at `/admin/` and uses the admin token to call the admin API.
- Do NOT commit your ADMIN_TOKEN to git. Set it only in Pages secrets.
- For production, consider protecting `/admin/*` with Cloudflare Access instead of a static token.

Security & caching
- The public endpoint sets `Cache-Control: public, max-age=60, s-maxage=86400, stale-while-revalidate=86400` so Cloudflare edge caches the JSON for 24 hours by default while clients cache a short time.
- Admin writes prime the cache so readers see updates quickly — KV is eventually consistent but cache priming reduces stale reads.

Next steps
- Add more cities by updating KV via the admin UI or by writing directly to KV in the Workers dashboard.
- Add tracking endpoint (`/track`) if you need to collect batched impressions/clicks.
- Integrate FCM notifications to trigger clients to refresh when immediate updates are needed.

