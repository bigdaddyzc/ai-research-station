import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/env';
import { runDailyGeneration, type GenerationResult } from '../../../lib/generation';
import { isAdminAuthenticated } from '../../../lib/auth';
import { DEFAULT_DAILY_PUBLISH_LIMIT, runAutoReview } from '../../../lib/auto-review';
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

export const GET: APIRoute = async ({ locals, url, request }) => {
  const runtimeEnv = await getRuntimeEnv(locals);
  // Only the scheduled trigger (x-cron-secret header) or a logged-in admin may run generation.
  if (!isLocalRequest(url)) {
    const cronSecret = runtimeEnv.CRON_SECRET;
    const fromCron = Boolean(cronSecret) && request.headers.get('x-cron-secret') === cronSecret;
    if (!fromCron && !(await isAdminAuthenticated(request, runtimeEnv.ADMIN_PASSWORD))) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const categoryParam = url.searchParams.get('category') as Category | null;
  const category = categoryParam && categories.includes(categoryParam) ? categoryParam : undefined;
  try {
    const dryRun = url.searchParams.get('dryRun') === '1';
    const result: GenerationResult & { autoReview?: unknown } = await runDailyGeneration(runtimeEnv, {
      topic: url.searchParams.get('topic') ?? undefined,
      category,
      dryRun,
    });

    // Auto-review: publish the best drafts (max N per day) and reject the rest.
    if (!dryRun && url.searchParams.get('autoReview') !== '0' && runtimeEnv.AUTO_REVIEW !== 'off') {
      const limit = Number(runtimeEnv.AUTO_PUBLISH_DAILY_LIMIT ?? DEFAULT_DAILY_PUBLISH_LIMIT) || DEFAULT_DAILY_PUBLISH_LIMIT;
      try {
        result.autoReview = await runAutoReview(runtimeEnv.DB, limit);
      } catch (reviewError) {
        result.autoReview = { error: reviewError instanceof Error ? reviewError.message : String(reviewError) };
      }
    }

    // Persist a run log so failed/empty cron runs are visible in D1 (generation_jobs).
    if (!dryRun && runtimeEnv.DB) {
      try {
        await runtimeEnv.DB
          .prepare("INSERT INTO generation_jobs (id, job_type, status, started_at, finished_at, model_provider, input_summary, error_message) VALUES (?, 'daily_run', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'vertex-ai', ?, ?)")
          .bind(crypto.randomUUID(), result.createdDrafts > 0 ? 'completed' : 'failed', JSON.stringify(result.autoReview ? { autoReview: { published: (result.autoReview as { published?: number }).published, rejected: (result.autoReview as { rejected?: number }).rejected } } : {}), result.message.slice(0, 2000))
          .run();
      } catch (logError) {
        console.error('[cron] failed to log run', logError);
      }
    }

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

    if (runtimeEnv.DB) {
      try {
        await runtimeEnv.DB
          .prepare("INSERT INTO generation_jobs (id, job_type, status, started_at, finished_at, model_provider, error_message) VALUES (?, 'daily_run', 'failed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'vertex-ai', ?)")
          .bind(crypto.randomUUID(), (error instanceof Error ? error.message : String(error)).slice(0, 2000))
          .run();
      } catch {}
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
