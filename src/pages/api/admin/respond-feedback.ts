import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { getDb, respondToFeedbackSubmission } from '../../../lib/db';
import { getRuntimeEnv } from '../../../lib/env';
import type { FeedbackStatus } from '../../../lib/types';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = await getRuntimeEnv(locals);

  if (!await isAdminAuthenticated(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const form = await request.formData();
  const id = String(form.get('id') ?? '').trim();
  const status = String(form.get('status') ?? 'reviewing') as FeedbackStatus;
  const adminResponse = String(form.get('adminResponse') ?? '').trim();

  const result = await respondToFeedbackSubmission(await getDb(locals), { id, status, adminResponse });
  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }

  return redirect('/admin#feedback', 303);
};
