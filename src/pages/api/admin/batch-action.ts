import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { getDb, publishContentGroup, rejectContentGroup } from '../../../lib/db';
import { getRuntimeEnv } from '../../../lib/env';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = await getRuntimeEnv(locals);

  if (!await isAdminAuthenticated(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { action?: string; groupIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { action, groupIds } = body;
  if ((action !== 'publish' && action !== 'reject') || !Array.isArray(groupIds) || groupIds.length === 0) {
    return new Response('Required: action ("publish"|"reject") and non-empty groupIds array', { status: 400 });
  }

  const db = await getDb(locals);
  const fn = action === 'publish' ? publishContentGroup : rejectContentGroup;
  const results: Array<{ id: string; ok: boolean; message: string }> = [];

  for (const id of groupIds) {
    const result = await fn(db, id);
    results.push({ id, ...result });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'content-type': 'application/json' },
  });
};
