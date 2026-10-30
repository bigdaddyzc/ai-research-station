import type { APIRoute } from 'astro';
import { createFeedbackSubmission, getDb } from '../../lib/db';
import type { Language } from '../../lib/types';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const language = String(form.get('language') ?? 'zh') === 'en' ? 'en' : 'zh';
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();
  const sourcePath = String(form.get('sourcePath') ?? '').trim();

  if (!message) {
    return new Response('Missing required field: message', { status: 400 });
  }
  if (message.length > 2000) {
    return new Response('Feedback message is too long', { status: 400 });
  }

  const result = await createFeedbackSubmission(await getDb(locals), {
    language: language as Language,
    name,
    email,
    message,
    sourcePath,
  });

  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }

  const cleanPath = sourcePath.split('?')[0];
  const target = cleanPath === `/${language}` ? `${cleanPath}?feedback=sent#feedback` : `/${language}?feedback=sent#feedback`;
  return redirect(target, 303);
};
