// PUT /api/commands/:id - Update command status (for Tauri app)
// GET /api/commands/:id - Get single command (with cache-bypass for results)

function resultBucket(ts) {
  return Math.floor(ts / 5000);
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const KV = env.COMMANDS;
  const id = params.id;

  try {
    const existing = await KV.get(`command:${id}`);
    if (!existing) {
      return jsonResponse({ error: 'Command not found' }, 404);
    }

    const command = JSON.parse(existing);
    const body = await request.json();

    if (body.status) command.status = body.status;
    if (body.result !== undefined) command.result = body.result;
    if (body.task_id) command.task_id = body.task_id;
    command.updated_at = new Date().toISOString();

    await KV.put(`command:${id}`, JSON.stringify(command), { expirationTtl: 604800 });

    if (body.status === 'success' || body.status === 'failed' || body.status === 'running') {
      const resultPayload = JSON.stringify({
        status: command.status,
        result: command.result,
        task_id: command.task_id || null,
        updated_at: command.updated_at,
      });
      // Write to static result key
      await KV.put(`cmdresult:${id}`, resultPayload, { expirationTtl: 3600 });
      // Write to time-bucketed result keys so GET hits a fresh (uncached) key.
      // Frontend may have negatively cached cmdresult:{id} as null, but these
      // bucket keys are new and will return fresh data on first read.
      const rb = resultBucket(Date.now());
      for (let i = 0; i <= 2; i++) {
        await KV.put(`cmdresult_b:${rb + i}:${id}`, resultPayload, { expirationTtl: 300 });
      }
    }

    return jsonResponse({ ok: true, command });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const KV = env.COMMANDS;
  const id = params.id;

  // 1) Try static result-bypass key
  const resultData = await KV.get(`cmdresult:${id}`);
  if (resultData) {
    try {
      const result = JSON.parse(resultData);
      if (result.status === 'success' || result.status === 'failed') {
        const baseData = await KV.get(`command:${id}`);
        if (baseData) {
          const command = JSON.parse(baseData);
          command.status = result.status;
          command.result = result.result;
          command.task_id = result.task_id;
          command.updated_at = result.updated_at;
          return jsonResponse({ command });
        }
        return jsonResponse({ command: { id, ...result } });
      }
    } catch (e) { /* fall through */ }
  }

  // 2) Scan time-bucketed result keys (avoids negative-cache on cmdresult:{id})
  const rb = resultBucket(Date.now());
  for (let i = 0; i <= 23; i++) {
    const brd = await KV.get(`cmdresult_b:${rb - i}:${id}`);
    if (brd) {
      try {
        const result = JSON.parse(brd);
        if (result.status === 'success' || result.status === 'failed') {
          const baseData = await KV.get(`command:${id}`);
          if (baseData) {
            const command = JSON.parse(baseData);
            command.status = result.status;
            command.result = result.result;
            command.task_id = result.task_id;
            command.updated_at = result.updated_at;
            return jsonResponse({ command });
          }
          return jsonResponse({ command: { id, ...result } });
        }
      } catch (e) { /* continue scanning */ }
    }
  }

  // 3) Fall back to base command key
  const data = await KV.get(`command:${id}`);
  if (!data) {
    return jsonResponse({ error: 'Command not found' }, 404);
  }

  return jsonResponse({ command: JSON.parse(data) });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
