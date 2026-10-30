import type { APIRoute } from 'astro';
import { clearAdminCookie } from '../../../lib/auth';

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': clearAdminCookie(),
    },
  });
};
