// Cloudflare Worker: admin API for ads (KV-backed)
// Bindings required in Pages/Worker: ADS_KV (KV Namespace), ADMIN_TOKEN (secret)

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const KV = ADS_KV; // KV namespace binding
const ADMIN = typeof ADMIN_TOKEN !== 'undefined' ? ADMIN_TOKEN : null;

async function handle(req) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/+/, '').split('/');
  // expected: /admin/ads/{city}
  if (parts.length < 2 || parts[0] !== 'admin' || parts[1] !== 'ads') {
    return new Response('Not found', { status: 404 });
  }
  const city = parts[2] ? decodeURIComponent(parts[2]) : 'global';

  if (req.method === 'GET') return await handleGet(city, req);

  if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 });

  if (req.method === 'PUT') return await handlePut(city, req);
  if (req.method === 'POST') return await handlePost(city, req);
  if (req.method === 'DELETE') return await handleDelete(city, req);

  return new Response('Method not allowed', { status: 405 });
}

function isAuthorized(req) {
  try {
    const h = req.headers.get('x-admin-token') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!h) return false;
    if (!ADMIN) return false;
    return h === ADMIN;
  } catch (e) { return false; }
}

function kvKey(city) { return `ads:city:${city.toLowerCase()}`; }

async function handleGet(city, req) {
  const key = kvKey(city);
  const raw = await KV.get(key);
  if (!raw) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  const etag = `W/"${hashString(raw)}"`;
  const inm = req.headers.get('if-none-match');
  if (inm && inm === etag) return new Response(null, { status: 304 });
  return new Response(raw, { status: 200, headers: { 'content-type': 'application/json', 'etag': etag, 'cache-control': 'public, max-age=60, stale-while-revalidate=300' } });
}

async function handlePut(city, req) {
  // Two modes:
  // 1) full-document replace: body { doc: { ... } }
  // 2) ad update: body { id: 'adId', ad: { ... } }
  let body;
  try { body = await req.json(); } catch (e) { return new Response('Invalid JSON', { status: 400 }); }
  const key = kvKey(city);
  if (body.doc) {
    // full replace
    const doc = body.doc;
    // set metadata
    doc.scope = doc.scope || 'city';
    doc.city = city;
    doc.updatedAt = new Date().toISOString();
    if (!doc.createdAt) doc.createdAt = new Date().toISOString();
    const str = JSON.stringify(doc);
    await KV.put(key, str);
    const etag = `W/"${hashString(str)}"`;
    return new Response(str, { status: 200, headers: { 'content-type': 'application/json', 'etag': etag } });
  }

  if (!body.id || !body.ad) return new Response('Missing id or ad', { status: 400 });
  // ad update
  const raw = await KV.get(key);
  const doc = raw ? JSON.parse(raw) : { scope: 'city', city, enabled: true, ads: [] };
  const idx = doc.ads.findIndex(a => String(a.id) === String(body.id));
  if (idx === -1) return new Response('ad not found', { status: 404 });
  doc.ads[idx] = body.ad;
  doc.updatedAt = new Date().toISOString();
  const out = JSON.stringify(doc);
  await KV.put(key, out);
  return new Response(JSON.stringify({ ok: true, id: body.id }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function handlePost(city, req) {
  // append single ad: body { ad: { ... } }
  let body;
  try { body = await req.json(); } catch (e) { return new Response('Invalid JSON', { status: 400 }); }
  if (!body.ad) return new Response('missing ad', { status: 400 });
  const key = kvKey(city);
  const raw = await KV.get(key);
  const doc = raw ? JSON.parse(raw) : { scope: 'city', city, enabled: true, ads: [] };
  const id = body.ad.id || `ad_${Date.now()}`;
  body.ad.id = id;
  doc.ads = doc.ads || [];
  doc.ads.push(body.ad);
  doc.updatedAt = new Date().toISOString();
  const out = JSON.stringify(doc);
  await KV.put(key, out);
  return new Response(JSON.stringify({ id }), { status: 201, headers: { 'content-type': 'application/json' } });
}

async function handleDelete(city, req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('id required', { status: 400 });
  const key = kvKey(city);
  const raw = await KV.get(key);
  if (!raw) return new Response('not found', { status: 404 });
  const doc = JSON.parse(raw);
  doc.ads = (doc.ads || []).filter(a => String(a.id) !== String(id));
  doc.updatedAt = new Date().toISOString();
  await KV.put(key, JSON.stringify(doc));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}

// helper hash for ETag
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 16777619); }
  return (h >>> 0).toString(16);
}
