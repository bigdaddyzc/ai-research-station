import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { getDb, upsertPersonalResource } from '../../../lib/db';
import { getRuntimeEnv } from '../../../lib/env';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = await getRuntimeEnv(locals);

  if (!await isAdminAuthenticated(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const form = await request.formData();
  const id = String(form.get('id') ?? '').trim() || undefined;
  const language = String(form.get('language') ?? 'zh');
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const url = String(form.get('url') ?? '').trim();
  const resourceType = String(form.get('resourceType') ?? 'link');
  const isFeatured = form.get('isFeatured') === 'on';
  const sortOrder = Number(form.get('sortOrder') ?? 0);

  if (!title || !description || !url) {
    return new Response('Missing required fields: title, description, url', { status: 400 });
  }

  const result = await upsertPersonalResource(await getDb(locals), {
    id, language, title, description, url, resourceType, isFeatured, sortOrder,
  });

  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }
  return redirect('/admin', 303);
};
