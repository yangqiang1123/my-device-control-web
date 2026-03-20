export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // API Key auth
  // Sec-Fetch-Site is a browser-only forbidden header that cannot be set by JS,
  // so "same-origin" reliably identifies requests from the web console itself.
  const apiKey = env.API_KEY;
  if (apiKey) {
    const secFetchSite = request.headers.get('Sec-Fetch-Site');
    const isBrowserSameOrigin = secFetchSite === 'same-origin';

    if (!isBrowserSameOrigin) {
      const provided = request.headers.get('X-API-Key');
      if (provided !== apiKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  }

  const response = await context.next();

  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
