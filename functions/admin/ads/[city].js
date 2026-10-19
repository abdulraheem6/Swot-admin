// functions/admin/ads/[city].js
// Admin CRUD for /admin/ads/<city>
// Protects using ADMIN_TOKEN set in Pages environment (env.ADMIN_TOKEN) if configured.
export async function onRequest(context) {
  const { request, env, params } = context;

  const corsHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token, If-None-Match',
    'Access-Control-Max-Age': '86400'
  };

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const rawCity = params.city || 'global';
  const cleanCity = decodeURIComponent(rawCity).trim();
  const cityKey = cleanCity.toLowerCase();
  const isGlobal = cityKey === 'global';

  // Auth check (only if ADMIN_TOKEN is configured in Pages environment)
  if (env && env.ADMIN_TOKEN && env.ADMIN_TOKEN.trim() !== '') {
    const tokenHeader = request.headers.get('x-admin-token') || '';
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const provided = tokenHeader || bearer;

    if (provided !== env.ADMIN_TOKEN.trim()) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid or missing admin token' }), {
        status: 401,
        headers: corsHeaders
      });
    }
  }

  // Helper to read document
  async function readDoc() {
    if (env && env.ADS_KV) {
      try {
        let raw = await env.ADS_KV.get(`ads:${cityKey}`);
        if (!raw) raw = await env.ADS_KV.get(cityKey);
        if (!raw && cleanCity !== cityKey) raw = await env.ADS_KV.get(cleanCity);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.ads)) return parsed;
        }
      } catch (e) {
        console.error('KV read error:', e);
      }
    }
    return getDefaultDoc(cleanCity);
  }

  // Helper to write document
  async function writeDoc(doc) {
    if (!env || !env.ADS_KV) {
      console.warn('ADS_KV binding is not set; changes will not persist across worker restarts until bound.');
      return;
    }

    const jsonStr = JSON.stringify(doc);
    // Write under both standardized key and simple key for compatibility
    await env.ADS_KV.put(`ads:${cityKey}`, jsonStr);
    await env.ADS_KV.put(cityKey, jsonStr);

    // Keep __cities_index up to date
    try {
      await recordCityInIndex(env, doc.city || cleanCity);
    } catch (e) {
      console.error('City index update error:', e);
    }

    // Prime the public /ads/<city>.json cache so clients get immediate updates
    try {
      const origin = new URL(request.url).origin;
      const publicUrl = `${origin}/ads/${cityKey}.json`;
      const body = JSON.stringify(doc, null, 2);
      const etag = await generateETag(body);
      const pubHeaders = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'ETag': etag
      });
      const res = new Response(body, { status: 200, headers: pubHeaders });
      if (typeof caches !== 'undefined' && caches.default) {
        await caches.default.put(new Request(publicUrl), res.clone());
      }
    } catch (e) {
      // ignore cache priming errors
    }
  }

  // GET: Fetch Document
  if (request.method === 'GET') {
    const doc = await readDoc();
    return new Response(JSON.stringify(doc, null, 2), {
      status: 200,
      headers: corsHeaders
    });
  }

  // POST: Append Single Ad
  if (request.method === 'POST') {
    const body = await safeJson(request);
    if (!body || !body.ad) {
      return new Response(JSON.stringify({ error: 'missing ad in body' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const doc = await readDoc();
    doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
    const newAd = body.ad;
    if (!newAd.id) {
      const prefix = isGlobal ? 'global' : cityKey.slice(0, 3);
      newAd.id = `${prefix}_${newAd.type || 'ad'}_${Date.now().toString(36)}`;
    }

    doc.ads.push(newAd);
    doc.updatedAt = new Date().toISOString();
    await writeDoc(doc);

    return new Response(JSON.stringify(newAd, null, 2), {
      status: 201,
      headers: corsHeaders
    });
  }

  // PUT: Replace Full Document OR Update Single Ad
  if (request.method === 'PUT') {
    const body = await safeJson(request);
    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Mode 1: Full Document Replace (e.g. { doc: {...} } or direct document object)
    if (body.doc || Array.isArray(body.ads) || body.scope || body.city) {
      const doc = body.doc || body;
      doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
      if (isGlobal) {
        doc.scope = 'global';
        delete doc.city;
      } else {
        doc.city = doc.city || (cleanCity.charAt(0).toUpperCase() + cleanCity.slice(1));
      }
      if (doc.enabled === undefined) doc.enabled = true;
      doc.updatedAt = new Date().toISOString();

      await writeDoc(doc);
      return new Response(JSON.stringify(doc, null, 2), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Mode 2: Update Single Ad by ID (body: { id: "...", ad: {...} })
    if (body.id && body.ad) {
      const doc = await readDoc();
      doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
      const idx = doc.ads.findIndex(a => String(a.id) === String(body.id));
      if (idx === -1) {
        return new Response(JSON.stringify({ error: 'Ad not found with id ' + body.id }), {
          status: 404,
          headers: corsHeaders
        });
      }
      doc.ads[idx] = Object.assign({}, doc.ads[idx], body.ad);
      doc.updatedAt = new Date().toISOString();

      await writeDoc(doc);
      return new Response(JSON.stringify(doc.ads[idx], null, 2), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ error: 'Missing doc or id+ad in request' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // DELETE: Delete Ad by ID or Delete Entire City
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      // Delete whole city document if not global
      if (isGlobal) {
        return new Response(JSON.stringify({ error: 'Cannot delete global scope document' }), {
          status: 400,
          headers: corsHeaders
        });
      }
      if (env && env.ADS_KV) {
        await env.ADS_KV.delete(`ads:${cityKey}`);
        await env.ADS_KV.delete(cityKey);
        await removeCityFromIndex(env, cleanCity);
      }
      return new Response(JSON.stringify({ success: true, message: `City ${cleanCity} deleted` }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Delete single ad by ID
    const doc = await readDoc();
    doc.ads = Array.isArray(doc.ads) ? doc.ads : [];
    const origCount = doc.ads.length;
    doc.ads = doc.ads.filter(a => String(a.id) !== String(id));

    if (doc.ads.length === origCount) {
      return new Response(JSON.stringify({ error: 'Ad not found with id ' + id }), {
        status: 404,
        headers: corsHeaders
      });
    }

    doc.updatedAt = new Date().toISOString();
    await writeDoc(doc);

    return new Response(JSON.stringify({ success: true, remaining: doc.ads.length }), {
      status: 200,
      headers: corsHeaders
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: corsHeaders
  });
}

function getDefaultDoc(city) {
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

async function recordCityInIndex(env, cityName) {
  if (!env || !env.ADS_KV) return;
  try {
    const raw = await env.ADS_KV.get('__cities_index');
    let list = raw ? JSON.parse(raw) : ['global', 'nizamabad'];
    const clean = cityName.trim();
    if (!list.map(c => c.toLowerCase()).includes(clean.toLowerCase())) {
      list.push(clean);
      await env.ADS_KV.put('__cities_index', JSON.stringify(list));
    }
  } catch (e) {
    // ignore index tracking errors
  }
}

async function removeCityFromIndex(env, cityName) {
  if (!env || !env.ADS_KV) return;
  try {
    const raw = await env.ADS_KV.get('__cities_index');
    if (!raw) return;
    let list = JSON.parse(raw);
    list = list.filter(c => c.toLowerCase() !== cityName.trim().toLowerCase());
    await env.ADS_KV.put('__cities_index', JSON.stringify(list));
  } catch (e) {
    // ignore
  }
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
