import type { APIRoute } from 'astro';
import { adminCookie } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/env';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = await getRuntimeEnv(locals);
  const form = await request.formData();
  const password = String(form.get('password') ?? '');

  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': await adminCookie(password),
    },
  });
};
