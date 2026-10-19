// functions/ads/[city].json.js
// Public reader for /ads/<city>.json
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const city = params.city;
  const cache = caches.default;
  const url = new URL(request.url);
  // Ensure cache key matches the public reader path
  const cacheKey = new Request(url.toString());

  try {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  } catch (e) {
    // ignore cache errors
  }

  const raw = await env.ADS_KV.get(city);
  const body = raw ?? JSON.stringify(city === 'global' ? { scope: 'global', enabled: false, ads: [] } : { city, enabled: false, ads: [] }, null, 2);
  const etag = await generateETag(body);

  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400',
    'ETag': etag
  });

  // Handle conditional requests
  const ifNone = request.headers.get('If-None-Match');
  if (ifNone && ifNone === etag) {
    return new Response(null, { status: 304, headers });
  }

  const res = new Response(body, { status: 200, headers });

  // Prime edge cache
  try {
    await cache.put(cacheKey, res.clone());
  } catch (e) {
    // ignore cache put failures
  }

  return res;
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
    // fallback
    return `"${String(body.length)}-${Date.now()}"`;
  }
}
