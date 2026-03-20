// POST /api/commands - Create a new command
// GET  /api/commands - List commands (query: ?status=pending&limit=50)
// GET  /api/commands?poll=true - Long-poll for pending commands (for Tauri app)

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

    // Store individual command (TTL: 7 days)
    await KV.put(`command:${id}`, JSON.stringify(command), { expirationTtl: 604800 });

    // Add to command list index
    const index = JSON.parse(await KV.get('command_index') || '[]');
    index.unshift(id);
    // Keep only last 200 entries
    if (index.length > 200) index.length = 200;
    await KV.put('command_index', JSON.stringify(index));

    // Add to pending queue
    const pending = JSON.parse(await KV.get('pending_queue') || '[]');
    pending.push(id);
    await KV.put('pending_queue', JSON.stringify(pending));

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
    // Poll mode: return pending commands and clear them
    if (poll) {
      const pending = JSON.parse(await KV.get('pending_queue') || '[]');
      if (pending.length === 0) {
        return jsonResponse({ commands: [] });
      }

      const commands = [];
      for (const id of pending) {
        const data = await KV.get(`command:${id}`);
        if (data) {
          const cmd = JSON.parse(data);
          if (cmd.status === 'pending') {
            commands.push(cmd);
          }
        }
      }

      // Clear the pending queue (Tauri app has received them)
      await KV.put('pending_queue', '[]');

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
