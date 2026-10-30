import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/env';
import { runDailyGeneration } from '../../../lib/generation';
import type { Category } from '../../../lib/types';

const categories: Category[] = ['tools', 'news', 'resources', 'research', 'prompts', 'personal'];

function isLocalRequest(url: URL): boolean {
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]' || url.hostname === '::1';
}

function shouldUseLocalFallback(result: { createdDrafts: number; message: string }, url: URL): boolean {
  return isLocalRequest(url) && result.createdDrafts === 0 && result.message.includes('internal error; reference =');
}

async function runLocalFallback(url: URL): Promise<Response> {
  const fallbackUrl = new URL('http://127.0.0.1:8790/generate');
  for (const [key, value] of url.searchParams.entries()) {
    fallbackUrl.searchParams.append(key, value);
  }

  const response = await fetch(fallbackUrl, {
    headers: { accept: 'application/json' },
  });
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ locals, url }) => {
  const categoryParam = url.searchParams.get('category') as Category | null;
  const category = categoryParam && categories.includes(categoryParam) ? categoryParam : undefined;
  try {
    const result = await runDailyGeneration(await getRuntimeEnv(locals), {
      topic: url.searchParams.get('topic') ?? undefined,
      category,
      dryRun: url.searchParams.get('dryRun') === '1',
    });

    if (shouldUseLocalFallback(result, url)) {
      return runLocalFallback(url);
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    if (isLocalRequest(url)) {
      try {
        return await runLocalFallback(url);
      } catch (fallbackError) {
        return new Response(
          JSON.stringify(
            {
              provider: 'vertex-ai',
              createdDrafts: 0,
              message: `Daily generation failed. Worker error: ${error instanceof Error ? error.message : String(error)}. Local fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}.`,
            },
            null,
            2,
          ),
          {
            status: 500,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          },
        );
      }
    }

    return new Response(
      JSON.stringify(
        {
          provider: 'vertex-ai',
          createdDrafts: 0,
          message: error instanceof Error ? error.message : 'Daily generation failed.',
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      },
    );
  }
};
