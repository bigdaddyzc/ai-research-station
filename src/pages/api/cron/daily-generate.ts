import { postBriefingToTelegram, postPublishedToTelegram } from '../../../lib/telegram';
import { generateDailyBriefing } from '../../../lib/briefing';
import { submitIndexNow, urlsForGroups } from '../../../lib/indexnow';
import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/env';
import { runDailyGeneration, type GenerationResult } from '../../../lib/generation';
import { isAdminAuthenticated } from '../../../lib/auth';
import { DEFAULT_DAILY_PUBLISH_LIMIT, runAutoReview } from '../../../lib/auto-review';
import type { Category } from '../../../lib/types';

const categories: Category[] = ['tools', 'news', 'resources', 'research', 'prompts', 'personal'];

export const GET: APIRoute = async ({ locals, url, request }) => {
  const runtimeEnv = await getRuntimeEnv(locals);
  // Only the scheduled trigger (x-cron-secret header) or a logged-in admin may run generation.
  const cronSecret = runtimeEnv.CRON_SECRET;
  const fromCron = Boolean(cronSecret) && request.headers.get('x-cron-secret') === cronSecret;
  if (!fromCron && !(await isAdminAuthenticated(request, runtimeEnv.ADMIN_PASSWORD))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const categoryParam = url.searchParams.get('category') as Category | null;
  const category = categoryParam && categories.includes(categoryParam) ? categoryParam : undefined;
  try {
    const dryRun = url.searchParams.get('dryRun') === '1';
    // step=1: generate ONE draft for the next category that still needs one today.
    // The daily job is split into many small cron invocations to stay under the
    // Cloudflare free-plan limit of 50 subrequests per invocation.
    if (url.searchParams.get('step') === '1' && runtimeEnv.DB) {
      const db = runtimeEnv.DB;
      const order: Category[] = ['news', 'tools', 'research', 'resources', 'prompts'];
      const made = await db.prepare("SELECT category, COUNT(*) n FROM content_groups WHERE created_at >= date('now') AND category != 'personal' GROUP BY category").all<{ category: string; n: number }>();
      const fails = await db.prepare("SELECT input_summary s, COUNT(*) n FROM generation_jobs WHERE job_type = 'step' AND status = 'failed' AND started_at >= date('now') GROUP BY input_summary").all<{ s: string; n: number }>();
      const madeMap = new Map((made.results ?? []).map((r) => [r.category, r.n]));
      const failMap = new Map((fails.results ?? []).map((r) => [r.s, r.n]));
      // prompts/workflow articles get low attention: generate at most 1 draft, and only when
      // no prompts article was published in the last 7 days and none was drafted in the last 3 days.
      const promptsRecent = await db.prepare("SELECT (SELECT COUNT(*) FROM content_groups WHERE category = 'prompts' AND status = 'published' AND published_at > datetime('now', '-7 days')) AS pub, (SELECT COUNT(*) FROM content_groups WHERE category = 'prompts' AND created_at > datetime('now', '-3 days')) AS made").first<{ pub: number; made: number }>();
      const promptsAllowed = Number(promptsRecent?.pub ?? 0) === 0 && Number(promptsRecent?.made ?? 0) === 0;
      const quota = (c: Category) => (c === 'prompts' ? (promptsAllowed ? 1 : 0) : 2);
      const next = order.find((c) => (madeMap.get(c) ?? 0) < quota(c) && (failMap.get(`step:${c}`) ?? 0) < 3);
      if (!next) {
        return new Response(JSON.stringify({ step: 'done', made: Object.fromEntries(madeMap) }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
      }
      let gen: GenerationResult;
      try {
        gen = await runDailyGeneration(runtimeEnv, { category: next });
      } catch (stepError) {
        // Count thrown errors against this category too, so a category that keeps failing
        // is skipped after 3 attempts instead of eating the whole generation window.
        gen = { provider: 'vertex-ai', createdDrafts: 0, message: stepError instanceof Error ? stepError.message : String(stepError) } as GenerationResult;
      }
      if (gen.createdDrafts === 0) {
        await db.prepare("INSERT INTO generation_jobs (id, job_type, status, started_at, finished_at, model_provider, input_summary, error_message) VALUES (?, 'step', 'failed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?)")
          .bind(crypto.randomUUID(), gen.provider, `step:${next}`, gen.message.slice(0, 2000)).run();
      }
      return new Response(JSON.stringify({ step: next, ...gen }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    // publish=1: run auto-review and push newly published articles to Telegram.
    if (url.searchParams.get('publish') === '1') {
      const limit = Number(runtimeEnv.AUTO_PUBLISH_DAILY_LIMIT ?? DEFAULT_DAILY_PUBLISH_LIMIT) || DEFAULT_DAILY_PUBLISH_LIMIT;
      const review = await runAutoReview(runtimeEnv.DB, limit);
      const publishedIds = review.decisions.filter((d) => d.action === 'published').map((d) => d.id);
      const telegram = await postPublishedToTelegram(runtimeEnv, publishedIds);
      let indexnow: unknown = null;
      try {
        indexnow = await submitIndexNow(await urlsForGroups(runtimeEnv, publishedIds));
      } catch (e) {
        indexnow = { error: e instanceof Error ? e.message : String(e) };
      }
      return new Response(JSON.stringify({ review, telegram, indexnow }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    // briefing=1: generate + publish today's daily briefing, then post its link to Telegram.
    // Fully isolated from step=1/publish=1: any failure returns JSON here and touches nothing else.
    if (url.searchParams.get('briefing') === '1') {
      try {
        const force = url.searchParams.get('force') === '1';
        const briefing = await generateDailyBriefing(runtimeEnv, { force });
        let telegram: unknown = { sent: 0, errors: [] as string[] };
        if (briefing.published) {
          try {
            telegram = await postBriefingToTelegram(runtimeEnv, briefing.date);
          } catch (tgError) {
            telegram = { sent: 0, errors: [tgError instanceof Error ? tgError.message : String(tgError)] };
          }
        }
        return new Response(JSON.stringify({ briefing, telegram }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
      } catch (error) {
        return new Response(
          JSON.stringify({ briefing: { ok: false, error: error instanceof Error ? error.message : String(error) } }, null, 2),
          { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
        );
      }
    }
    // reviewOnly=1: skip generation and just run the auto-review (used after a batch).
    if (url.searchParams.get('reviewOnly') === '1') {
      const limit = Number(url.searchParams.get('publishLimit')) || DEFAULT_DAILY_PUBLISH_LIMIT;
      const review = await runAutoReview(runtimeEnv.DB, limit);
      return new Response(JSON.stringify(review, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    const result: GenerationResult & { autoReview?: unknown } = await runDailyGeneration(runtimeEnv, {
      topic: url.searchParams.get('topic') ?? undefined,
      category,
      dryRun,
      windowDays: Number(url.searchParams.get('windowDays')) || undefined,
    });

    // Auto-review: publish the best drafts (max N per day) and reject the rest.
    if (!dryRun && url.searchParams.get('autoReview') !== '0' && runtimeEnv.AUTO_REVIEW !== 'off') {
      const limit = Number(url.searchParams.get('publishLimit')) || Number(runtimeEnv.AUTO_PUBLISH_DAILY_LIMIT ?? DEFAULT_DAILY_PUBLISH_LIMIT) || DEFAULT_DAILY_PUBLISH_LIMIT;
      try {
        const review = await runAutoReview(runtimeEnv.DB, limit);
        result.autoReview = review;
        const publishedIds = review.decisions.filter((d) => d.action === 'published').map((d) => d.id);
        try {
          (result as unknown as Record<string, unknown>).telegram = await postPublishedToTelegram(runtimeEnv, publishedIds);
        } catch (tgError) {
          (result as unknown as Record<string, unknown>).telegram = { error: tgError instanceof Error ? tgError.message : String(tgError) };
        }
        try {
          (result as unknown as Record<string, unknown>).indexnow = await submitIndexNow(await urlsForGroups(runtimeEnv, publishedIds));
        } catch (inError) {
          (result as unknown as Record<string, unknown>).indexnow = { error: inError instanceof Error ? inError.message : String(inError) };
        }
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

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
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
