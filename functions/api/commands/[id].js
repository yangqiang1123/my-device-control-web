// PUT /api/commands/:id - Update command status (for Tauri app to report results)
// GET /api/commands/:id - Get single command

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

    return jsonResponse({ ok: true, command });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const KV = env.COMMANDS;
  const id = params.id;

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
