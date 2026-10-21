// functions/admin/verify.js
// Verifies the provided admin access token against the Cloudflare environment
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
    'Access-Control-Max-Age': '86400'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const tokenHeader = request.headers.get('x-admin-token') || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const provided = tokenHeader || bearer;

  const requiredToken = env && env.ADMIN_TOKEN ? env.ADMIN_TOKEN.trim() : null;

  if (requiredToken && requiredToken !== '') {
    if (!provided || provided !== requiredToken) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Invalid or missing admin access token' 
      }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }
  }

  return new Response(JSON.stringify({ 
    valid: true, 
    configured: Boolean(requiredToken && requiredToken !== ''),
    message: 'Token verified successfully'
  }), { 
    status: 200, 
    headers: corsHeaders 
  });
}
