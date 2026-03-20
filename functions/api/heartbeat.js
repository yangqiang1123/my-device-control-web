export async function onRequestPost(context) {
  const { request, env } = context;
  const KV = env.SYNC_DATA;

  try {
    const body = await request.json();
    const heartbeat = {
      ...body,
      timestamp: new Date().toISOString(),
    };
    await KV.put('heartbeat', JSON.stringify(heartbeat), { expirationTtl: 120 });
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestGet(context) {
  const KV = context.env.SYNC_DATA;

  try {
    const data = await KV.get('heartbeat');
    if (!data) {
      return jsonResponse({ online: false, heartbeat: null });
    }
    const heartbeat = JSON.parse(data);
    const age = Date.now() - new Date(heartbeat.timestamp).getTime();
    return jsonResponse({
      online: age < 120000,
      heartbeat,
      age_seconds: Math.floor(age / 1000),
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
