// Cloudflare Worker: Ads Engine API & Public Ad Server
// Bindings required: ADS_KV (KV Namespace), ADMIN_TOKEN (secret, optional)

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};

// Legacy service worker format fallback
if (typeof addEventListener !== 'undefined') {
  addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request, (typeof ADS_KV !== 'undefined' ? { ADS_KV, ADMIN_TOKEN: typeof ADMIN_TOKEN !== 'undefined' ? ADMIN_TOKEN : null } : {})));
  });
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token, If-None-Match',
  'Access-Control-Max-Age': '86400'
};

async function handleRequest(req, env) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/+/, '');
  const parts = path.split('/');

  // 1. Public endpoint: /ads/{city}.json or /ads/{city}
  if (parts[0] === 'ads' && parts.length >= 2) {
    const rawCity = parts[1].replace(/\.json$/i, '');
    return handlePublicGet(rawCity, req, env);
  }

  // 2. Admin endpoint: /admin/cities
  if (parts[0] === 'admin' && parts[1] === 'cities') {
    return handleCities(req, env);
  }

  // 2b. Admin endpoint: /admin/verify
  if (parts[0] === 'admin' && parts[1] === 'verify') {
    if (!isAuthorized(req, env)) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid or missing admin access token' }), {
        status: 401,
        headers: CORS_HEADERS
      });
    }
    const requiredToken = env && env.ADMIN_TOKEN ? env.ADMIN_TOKEN.trim() : null;
    return new Response(JSON.stringify({ valid: true, configured: Boolean(requiredToken && requiredToken !== '') }), {
      status: 200,
      headers: CORS_HEADERS
    });
  }

  // 3. Admin endpoint: /admin/ads/{city}
  if (parts[0] === 'admin' && parts[1] === 'ads' && parts.length >= 3) {
    const city = decodeURIComponent(parts[2]).trim();

    if (req.method === 'GET') {
      return handleAdminGet(city, req, env);
    }

    if (!isAuthorized(req, env)) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid admin token' }), {
        status: 401,
        headers: CORS_HEADERS
      });
    }

    if (req.method === 'PUT') return handleAdminPut(city, req, env);
    if (req.method === 'POST') return handleAdminPost(city, req, env);
    if (req.method === 'DELETE') return handleAdminDelete(city, req, env);

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  return new Response('Not found', { status: 404 });
}

function isAuthorized(req, env) {
  const secret = env && env.ADMIN_TOKEN ? env.ADMIN_TOKEN.trim() : null;
  if (!secret) return true; // Unlocked if not configured

  const tokenHeader = req.headers.get('x-admin-token') || '';
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const provided = tokenHeader || bearer;

  return provided === secret;
}

function kvKey(city) {
  return `ads:${city.toLowerCase().trim()}`;
}

async function handlePublicGet(city, req, env) {
  const key = kvKey(city);
  let raw = null;

  if (env && env.ADS_KV) {
    raw = await env.ADS_KV.get(key);
    if (!raw) raw = await env.ADS_KV.get(city.toLowerCase().trim());
  }

  if (!raw) {
    const def = getFallbackDoc(city);
    raw = JSON.stringify(def, null, 2);
  }

  const etag = `W/"${hashString(raw)}"`;
  const inm = req.headers.get('if-none-match');
  if (inm && inm === etag) {
    return new Response(null, { status: 304, headers: CORS_HEADERS });
  }

  const headers = Object.assign({}, CORS_HEADERS, {
    'ETag': etag,
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
  });

  return new Response(raw, { status: 200, headers });
}

async function handleAdminGet(city, req, env) {
  const key = kvKey(city);
  let raw = null;

  if (env && env.ADS_KV) {
    raw = await env.ADS_KV.get(key);
    if (!raw) raw = await env.ADS_KV.get(city.toLowerCase().trim());
  }

  if (!raw) {
    const def = getFallbackDoc(city);
    raw = JSON.stringify(def, null, 2);
  }

  return new Response(raw, { status: 200, headers: CORS_HEADERS });
}

async function handleAdminPut(city, req, env) {
  let body;
  try { body = await req.json(); } catch (e) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS }); }

  const key = kvKey(city);
  const isGlobal = city.toLowerCase() === 'global';

  // Mode 1: Full Document Replace
  if (body.doc || Array.isArray(body.ads) || body.scope || body.city) {
    const doc = body.doc || body;
    doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
    if (isGlobal) {
      doc.scope = 'global';
      delete doc.city;
    } else {
      doc.city = doc.city || (city.charAt(0).toUpperCase() + city.slice(1));
    }
    if (doc.enabled === undefined) doc.enabled = true;
    doc.updatedAt = new Date().toISOString();

    const str = JSON.stringify(doc, null, 2);
    if (env && env.ADS_KV) {
      await env.ADS_KV.put(key, str);
      await env.ADS_KV.put(city.toLowerCase().trim(), str);
    }
    return new Response(str, { status: 200, headers: CORS_HEADERS });
  }

  // Mode 2: Update Ad by ID
  if (body.id && body.ad) {
    let raw = env && env.ADS_KV ? await env.ADS_KV.get(key) : null;
    const doc = raw ? JSON.parse(raw) : getFallbackDoc(city);
    doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
    const idx = doc.ads.findIndex(a => String(a.id) === String(body.id));
    if (idx === -1) return new Response(JSON.stringify({ error: 'Ad not found' }), { status: 404, headers: CORS_HEADERS });

    doc.ads[idx] = Object.assign({}, doc.ads[idx], body.ad);
    doc.updatedAt = new Date().toISOString();

    const out = JSON.stringify(doc, null, 2);
    if (env && env.ADS_KV) {
      await env.ADS_KV.put(key, out);
      await env.ADS_KV.put(city.toLowerCase().trim(), out);
    }
    return new Response(JSON.stringify(doc.ads[idx], null, 2), { status: 200, headers: CORS_HEADERS });
  }

  return new Response(JSON.stringify({ error: 'Missing doc or id+ad' }), { status: 400, headers: CORS_HEADERS });
}

async function handleAdminPost(city, req, env) {
  let body;
  try { body = await req.json(); } catch (e) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS }); }
  if (!body.ad) return new Response(JSON.stringify({ error: 'Missing ad in body' }), { status: 400, headers: CORS_HEADERS });

  const key = kvKey(city);
  const isGlobal = city.toLowerCase() === 'global';
  let raw = env && env.ADS_KV ? await env.ADS_KV.get(key) : null;
  const doc = raw ? JSON.parse(raw) : getFallbackDoc(city);

  const newAd = body.ad;
  if (!newAd.id) {
    const prefix = isGlobal ? 'global' : city.toLowerCase().slice(0, 3);
    newAd.id = `${prefix}_${newAd.type || 'ad'}_${Date.now().toString(36)}`;
  }

  doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
  doc.ads.push(newAd);
  doc.updatedAt = new Date().toISOString();

  const out = JSON.stringify(doc, null, 2);
  if (env && env.ADS_KV) {
    await env.ADS_KV.put(key, out);
    await env.ADS_KV.put(city.toLowerCase().trim(), out);
  }

  return new Response(JSON.stringify(newAd, null, 2), { status: 201, headers: CORS_HEADERS });
}

async function handleAdminDelete(city, req, env) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const key = kvKey(city);

  if (!id) {
    if (city.toLowerCase() === 'global') {
      return new Response(JSON.stringify({ error: 'Cannot delete global document' }), { status: 400, headers: CORS_HEADERS });
    }
    if (env && env.ADS_KV) {
      await env.ADS_KV.delete(key);
      await env.ADS_KV.delete(city.toLowerCase().trim());
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
  }

  let raw = env && env.ADS_KV ? await env.ADS_KV.get(key) : null;
  if (!raw) return new Response(JSON.stringify({ error: 'City document not found' }), { status: 404, headers: CORS_HEADERS });

  const doc = JSON.parse(raw);
  doc.ads = (doc.ads || []).filter(a => String(a.id) !== String(id));
  doc.updatedAt = new Date().toISOString();

  if (env && env.ADS_KV) {
    await env.ADS_KV.put(key, JSON.stringify(doc, null, 2));
  }

  return new Response(JSON.stringify({ success: true, remaining: doc.ads.length }), { status: 200, headers: CORS_HEADERS });
}

async function handleCities(req, env) {
  if (req.method === 'GET') {
    let cities = ['global', 'Nizamabad', 'Hyderabad', 'Warangal'];
    if (env && env.ADS_KV) {
      const raw = await env.ADS_KV.get('__cities_index');
      if (raw) {
        try { cities = JSON.parse(raw); } catch(e){}
      }
    }
    return new Response(JSON.stringify({ cities }), { status: 200, headers: CORS_HEADERS });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
}

function getFallbackDoc(city) {
  const isGlobal = city.toLowerCase() === 'global';
  if (isGlobal) {
    return {
      scope: 'global',
      enabled: true,
      ads: [
        {
          id: 'global_banner_01',
          type: 'banner',
          title: 'Global Secure Cloud Backup Pro',
          subtitle: 'Zero-knowledge encrypted cloud vault synchronization across Android & Web.',
          description: 'Protect all your passwords, documents, and family records with military-grade AES-256 encryption.',
          mediaUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
          actionUrl: 'https://example.com/cloud-backup-pro',
          actionLabel: 'Upgrade',
          sponsorTag: 'Global Sponsor · Featured',
          badgeText: 'PRO',
          isDismissible: true,
          locationInfo: 'Worldwide Service',
          rating: 4.9
        },
        {
          id: 'global_video_02',
          type: 'video',
          title: 'Smart Home AI Security Hub',
          subtitle: 'Seamless Integration with Vault Alarms & Sensors',
          description: 'Get instant intrusion alerts and automated emergency calling right on your phone.',
          mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          actionUrl: 'https://example.com/smart-home-hub',
          actionLabel: 'Learn More',
          sponsorTag: 'Global Sponsor · Tech',
          badgeText: 'NEW',
          isDismissible: true,
          locationInfo: 'Global Availability',
          rating: 4.7
        }
      ]
    };
  }

  if (city.toLowerCase() === 'nizamabad') {
    return {
      city: 'Nizamabad',
      enabled: true,
      ads: [
        {
          id: 'nzb_banner_01',
          type: 'banner',
          title: 'Nizamabad Fresh Organic Farm Mart',
          subtitle: 'Farm fresh spices, cold-pressed oils & grains directly from Armoor & Bodhan farms.',
          description: 'Get same-day door delivery across Nizamabad town. Special 25% launch discount on your first grocery basket.',
          mediaUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
          actionUrl: 'https://example.com/nizamabad-mart',
          actionLabel: 'Order Now',
          sponsorTag: 'Sponsored · Nizamabad',
          badgeText: '25% OFF',
          isDismissible: true,
          locationInfo: 'Khaleelwadi, Nizamabad',
          rating: 4.8
        },
        {
          id: 'nzb_photo_02',
          type: 'photo',
          title: 'Sri Mahalaxmi Jewellers — Nizamabad',
          subtitle: 'Festive Gold & Silver Collection',
          description: 'Exquisite 916 BIS Hallmarked wedding jewellery, lightweight daily wear gold, and pure silver artifacts. Visit our main showroom on Subhash Road.',
          mediaUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
          actionUrl: 'https://example.com/mahalaxmi-jewellers',
          actionLabel: 'View Catalogue',
          sponsorTag: 'Local Partner · Subhash Road',
          badgeText: 'FESTIVE SALE',
          isDismissible: true,
          locationInfo: 'Subhash Road, Nizamabad',
          rating: 4.9
        },
        {
          id: 'nzb_video_03',
          type: 'video',
          title: 'Nizamabad Smart E-Bikes & Scooters',
          subtitle: 'Zero Emission, 120km Range per Charge',
          description: 'Experience silent high-torque electric mobility designed for Telangana roads. Book a free test ride at our Khaleelwadi dealership.',
          mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          actionUrl: 'https://example.com/ev-testride',
          actionLabel: 'Book Test Ride',
          sponsorTag: 'Sponsored · Nizamabad EV',
          badgeText: 'SUBSIDY AVAILABLE',
          isDismissible: true,
          locationInfo: 'Near RTC Complex, Nizamabad',
          rating: 4.7
        }
      ]
    };
  }

  const formattedCity = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    city: formattedCity,
    enabled: true,
    ads: []
  };
}

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return (h >>> 0).toString(16);
}
