// POST /api/commands - Create a new command
// GET  /api/commands - List commands (query: ?status=pending&limit=50)
// GET  /api/commands?poll=true - Poll for pending commands (for Tauri app)

function getBucket(ts) {
  return Math.floor(ts / 5000);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const KV = env.COMMANDS;

  try {
    const body = await request.json();
    const { action, workspace_id, workspace_no, workspace_name, device_id, params } = body;

    if (!action) {
      return jsonResponse({ error: 'Missing action' }, 400);
    }

    const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const command = {
      id,
      action,
      workspace_id: workspace_id || null,
      workspace_no: workspace_no || null,
      workspace_name: workspace_name || null,
      device_id: device_id || null,
      params: params || {},
      status: 'pending',
      result: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await KV.put(`command:${id}`, JSON.stringify(command), { expirationTtl: 604800 });

    const index = JSON.parse(await KV.get('command_index') || '[]');
    index.unshift(id);
    if (index.length > 200) index.length = 200;
    await KV.put('command_index', JSON.stringify(index));

    // Write to time-bucketed pending keys (5-second buckets).
    // Write to current + 2 future buckets so the desktop always hits
    // at least one fresh (uncached) bucket key on its next poll.
    const bucket = getBucket(Date.now());
    for (let offset = 0; offset <= 2; offset++) {
      const bk = `pending_b:${bucket + offset}`;
      const bd = JSON.parse(await KV.get(bk) || '[]');
      if (!bd.includes(id)) bd.push(id);
      await KV.put(bk, JSON.stringify(bd), { expirationTtl: 300 });
    }

    return jsonResponse({ ok: true, command });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const KV = env.COMMANDS;
  const url = new URL(request.url);

  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const poll = url.searchParams.get('poll') === 'true';

  try {
    if (poll) {
      const now = Date.now();
      const currentBucket = getBucket(now);
      const bucketsToCheck = [];
      for (let i = 0; i <= 23; i++) bucketsToCheck.push(currentBucket - i);
      const seen = new Set();
      const commands = [];

      for (const b of bucketsToCheck) {
        const ids = JSON.parse(await KV.get(`pending_b:${b}`) || '[]');
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          const data = await KV.get(`command:${id}`);
          if (data) {
            const cmd = JSON.parse(data);
            if (cmd.status === 'pending') {
              commands.push(cmd);
            }
          }
        }
      }

      // Fallback: scan command_index for pending commands missed by time buckets
      // (e.g. when desktop restarts and bucket keys have expired)
      const index = JSON.parse(await KV.get('command_index') || '[]');
      for (const id of index.slice(0, 30)) {
        if (seen.has(id)) continue;
        seen.add(id);
        const data = await KV.get(`command:${id}`);
        if (data) {
          const cmd = JSON.parse(data);
          if (cmd.status === 'pending') {
            commands.push(cmd);
          }
        }
      }

      return jsonResponse({ commands });
    }

    // Normal list mode
    const index = JSON.parse(await KV.get('command_index') || '[]');
    const commands = [];

    for (const id of index.slice(0, limit)) {
      const data = await KV.get(`command:${id}`);
      if (data) {
        const cmd = JSON.parse(data);
        if (!status || cmd.status === status) {
          commands.push(cmd);
        }
      }
    }

    return jsonResponse({ commands });
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
