// functions/admin/ads/[city].js
// Admin CRUD for /admin/ads/<city>
// Protects using ADMIN_TOKEN set in Pages environment (env.ADMIN_TOKEN).
export async function onRequest(context) {
  const { request, env, params } = context;
  const city = params.city;

  // Auth
  const tokenHeader = request.headers.get('x-admin-token') || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const provided = tokenHeader || bearer;
  if (!env.ADMIN_TOKEN || provided !== env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // helpers
  async function readDoc() {
    const raw = await env.ADS_KV.get(city);
    if (!raw) return city === 'global' ? { scope: 'global', enabled: false, ads: [] } : { city, enabled: false, ads: [] };
    try { return JSON.parse(raw); } catch (e) { return { city, enabled: false, ads: [] }; }
  }
  async function writeDoc(doc) {
    await env.ADS_KV.put(city, JSON.stringify(doc));

    // Prime the public /ads/<city>.json cache so readers see updated content immediately
    try {
      const origin = new URL(request.url).origin;
      const publicUrl = `${origin}/ads/${city}.json`;
      const body = JSON.stringify(doc, null, 2);
      const etag = await generateETag(body);
      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400',
        'ETag': etag
      });
      const res = new Response(body, { status: 200, headers });
      try {
        await caches.default.put(new Request(publicUrl), res.clone());
      } catch (e) {
        // ignore cache put errors
      }
    } catch (e) {
      // ignore priming errors
    }
  }

  if (request.method === 'GET') {
    const doc = await readDoc();
    return new Response(JSON.stringify(doc, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'POST') {
    const body = await safeJson(request);
    if (!body || !body.ad) return new Response(JSON.stringify({ error: 'missing ad in body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const doc = await readDoc();
    doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
    const newAd = body.ad;
    if (!newAd.id) {
      try { newAd.id = crypto.randomUUID(); } catch (e) { newAd.id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`; }
    }
    doc.ads.push(newAd);
    await writeDoc(doc);
    return new Response(JSON.stringify(newAd, null, 2), { status: 201, headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'PUT') {
    const body = await safeJson(request);
    if (!body || !body.id || !body.ad) return new Response(JSON.stringify({ error: 'missing id or ad in body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const doc = await readDoc();
    doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
    const idx = doc.ads.findIndex(a => String(a.id) === String(body.id));
    if (idx === -1) return new Response(JSON.stringify({ error: 'ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    doc.ads[idx] = Object.assign({}, doc.ads[idx], body.ad);
    await writeDoc(doc);
    return new Response(JSON.stringify(doc.ads[idx], null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'missing id query param' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const doc = await readDoc();
    doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
    const newAds = doc.ads.filter(a => String(a.id) !== String(id));
    if (newAds.length === doc.ads.length) return new Response(JSON.stringify({ error: 'ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    doc.ads = newAds;
    await writeDoc(doc);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
}

async function safeJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}

async function generateETag(body) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(body);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `"${hashHex}"`;
  } catch (e) {
    return `"${String(body.length)}-${Date.now()}"`;
  }
}
