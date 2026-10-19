// functions/admin/cities.js
// Lists and manages cities available for ad targeting
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
    'Access-Control-Max-Age': '86400'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth check (if configured)
  if (env && env.ADMIN_TOKEN && env.ADMIN_TOKEN.trim() !== '') {
    const tokenHeader = request.headers.get('x-admin-token') || '';
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const provided = tokenHeader || bearer;

    if (provided !== env.ADMIN_TOKEN.trim()) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: corsHeaders
      });
    }
  }

  // GET: List all cities
  if (request.method === 'GET') {
    let cities = ['global', 'Nizamabad', 'Hyderabad', 'Warangal'];
    if (env && env.ADS_KV) {
      try {
        const raw = await env.ADS_KV.get('__cities_index');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            cities = list;
          }
        }
      } catch (e) {
        console.error('Failed reading __cities_index', e);
      }
    }
    return new Response(JSON.stringify({ cities }), { status: 200, headers: corsHeaders });
  }

  // POST: Add new city
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }
    const cityName = (body && body.city ? String(body.city) : '').trim();
    if (!cityName) {
      return new Response(JSON.stringify({ error: 'city name required' }), { status: 400, headers: corsHeaders });
    }

    let cities = ['global', 'Nizamabad'];
    if (env && env.ADS_KV) {
      try {
        const raw = await env.ADS_KV.get('__cities_index');
        if (raw) cities = JSON.parse(raw);
      } catch (e) {}

      if (!cities.map(c => c.toLowerCase()).includes(cityName.toLowerCase())) {
        cities.push(cityName);
        await env.ADS_KV.put('__cities_index', JSON.stringify(cities));
      }
    }

    return new Response(JSON.stringify({ success: true, city: cityName, cities }), { status: 201, headers: corsHeaders });
  }

  // DELETE: Remove city
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const cityName = url.searchParams.get('city');
    if (!cityName || cityName.toLowerCase() === 'global') {
      return new Response(JSON.stringify({ error: 'Valid non-global city parameter required' }), { status: 400, headers: corsHeaders });
    }

    if (env && env.ADS_KV) {
      try {
        const raw = await env.ADS_KV.get('__cities_index');
        if (raw) {
          let list = JSON.parse(raw);
          list = list.filter(c => c.toLowerCase() !== cityName.toLowerCase());
          await env.ADS_KV.put('__cities_index', JSON.stringify(list));
        }
        await env.ADS_KV.delete(`ads:${cityName.toLowerCase()}`);
        await env.ADS_KV.delete(cityName.toLowerCase());
      } catch (e) {}
    }

    return new Response(JSON.stringify({ success: true, deleted: cityName }), { status: 200, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}
