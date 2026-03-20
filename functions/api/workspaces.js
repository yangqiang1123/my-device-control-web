// GET  /api/workspaces - List workspaces
// POST /api/workspaces - Sync workspaces (from Tauri app or manual add)
// DELETE /api/workspaces?id=xxx - Delete a workspace

export async function onRequestGet(context) {
  const KV = context.env.SYNC_DATA;

  try {
    const data = await KV.get('workspaces');
    const workspaces = data ? JSON.parse(data) : [];
    return jsonResponse({ workspaces });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const KV = env.SYNC_DATA;

  try {
    const body = await request.json();

    // Bulk sync from Tauri app
    if (body.workspaces && Array.isArray(body.workspaces)) {
      await KV.put('workspaces', JSON.stringify(body.workspaces));
      return jsonResponse({ ok: true, count: body.workspaces.length });
    }

    // Single workspace add
    if (body.workspace) {
      const existing = JSON.parse(await KV.get('workspaces') || '[]');
      const idx = existing.findIndex(w => w.id === body.workspace.id);
      if (idx >= 0) {
        existing[idx] = body.workspace;
      } else {
        existing.push(body.workspace);
      }
      await KV.put('workspaces', JSON.stringify(existing));
      return jsonResponse({ ok: true, count: existing.length });
    }

    return jsonResponse({ error: 'Invalid body' }, 400);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const KV = env.SYNC_DATA;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonResponse({ error: 'Missing id' }, 400);
  }

  try {
    const existing = JSON.parse(await KV.get('workspaces') || '[]');
    const filtered = existing.filter(w => w.id !== id);
    await KV.put('workspaces', JSON.stringify(filtered));
    return jsonResponse({ ok: true });
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
