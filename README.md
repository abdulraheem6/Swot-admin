# Swot-admin — Ads Admin & Worker

This branch adds an enhanced admin UI and a Cloudflare Worker-backed admin API to manage city-scoped and global ad JSON documents.

What was added

- public/admin/index.html — improved admin UI with:
  - city selection, ads list, editor, preview
  - raw JSON editor (fetch & save full document)
  - import/export and bulk delete
  - token-based admin authentication (x-admin-token header)

- worker/index.js — Cloudflare Worker implementing an admin API:
  - GET /admin/ads/{city} — fetch full JSON document (returns ETag)
  - PUT /admin/ads/{city} — replace full document (body: { doc }) or update single ad (body: { id, ad })
  - POST /admin/ads/{city} — append single ad (body: { ad })
  - DELETE /admin/ads/{city}?id=... — delete ad by id
  - Uses KV namespace binding: ADS_KV
  - Admin auth via ADMIN_TOKEN secret (compare to x-admin-token or Bearer token)

- schema/ads.schema.json — JSON Schema (draft-07) for the ads document (superset fields). The Worker currently stores and serves the schema file; client-side validation can be added.

- scripts/example_kv_seed.json — example content you can seed into KV.

Deployment notes

1) Cloudflare Pages + Functions or Workers

- Host the static admin UI (public/) on Cloudflare Pages.
- Deploy the worker (worker/index.js) as a Pages Function or a separate Worker and add a route to match /admin/ads/*.

2) KV and secrets

- Create a KV namespace and bind it as ADS_KV to the Worker / Pages Function.
- Add a secret ADMIN_TOKEN in Pages/Workers environment (this is the admin token to use in the UI).

3) Routes

- Configure the Worker route for your Pages site (e.g., example.com/admin/ads/*) or deploy the Worker with a Worker subdomain.

4) Android client

- Use GET /admin/ads?scope=city&city=Nizamabad or GET /admin/ads/{city} (depending on routing) and use ETag header for caching and If-None-Match for 304 handling.

Next steps

- (Recommended) Add AJV validation in both the admin UI and the Worker to validate payloads against schema/ads.schema.json.
- (Recommended) Add optimistic concurrency with revisions/If-Match to avoid accidental overwrites.
- Add CI that validates example JSON using the schema on PRs.

