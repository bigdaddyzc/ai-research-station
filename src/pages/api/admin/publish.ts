import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { getDb, publishContentGroup } from '../../../lib/db';
import { getRuntimeEnv } from '../../../lib/env';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = await getRuntimeEnv(locals);

  if (!await isAdminAuthenticated(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const form = await request.formData();
  const groupId = String(form.get('groupId') ?? '');

  if (!groupId) {
    return new Response('Missing groupId', { status: 400 });
  }

  const result = await publishContentGroup(await getDb(locals), groupId);
  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }
  return redirect('/admin', 303);
};
