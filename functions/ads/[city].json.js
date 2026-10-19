// functions/ads/[city].json.js
// Public reader for /ads/<city>.json (served to Android app)
export async function onRequest(context) {
  const { request, env, params } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const rawCityParam = params.city || 'global';
  const cleanCity = decodeURIComponent(rawCityParam).replace(/\.json$/i, '').trim();
  const cityKey = cleanCity.toLowerCase();
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const url = new URL(request.url);
  const cacheKey = new Request(url.toString());

  // Check edge cache
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch (e) {
      // ignore cache errors
    }
  }

  let body = null;

  // Try reading from KV
  if (env && env.ADS_KV) {
    try {
      let raw = await env.ADS_KV.get(`ads:${cityKey}`);
      if (!raw) raw = await env.ADS_KV.get(cityKey);
      if (!raw && cleanCity !== cityKey) raw = await env.ADS_KV.get(cleanCity);
      if (raw) {
        body = raw;
      }
    } catch (e) {
      console.error('KV read error:', e);
    }
  }

  // Fallback defaults matching the user's exact specification
  if (!body) {
    const defaultDoc = getSeedFallback(cleanCity);
    body = JSON.stringify(defaultDoc, null, 2);
  }

  const etag = await generateETag(body);

  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    'ETag': etag
  });

  // Handle conditional ETag requests from Android app (saves bandwidth)
  const ifNone = request.headers.get('If-None-Match');
  if (ifNone && ifNone === etag) {
    return new Response(null, { status: 304, headers });
  }

  const res = new Response(body, { status: 200, headers });

  // Prime edge cache
  if (cache) {
    try {
      await cache.put(cacheKey, res.clone());
    } catch (e) {
      // ignore cache put failures
    }
  }

  return res;
}

function getSeedFallback(city) {
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

  // Default empty doc for any other city
  const formattedCity = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    city: formattedCity,
    enabled: true,
    ads: []
  };
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
