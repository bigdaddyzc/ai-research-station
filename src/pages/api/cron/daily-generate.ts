import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/env';
import { runDailyGeneration } from '../../../lib/generation';
import type { Category } from '../../../lib/types';

const categories: Category[] = ['tools', 'news', 'resources', 'research', 'prompts', 'personal'];

export const GET: APIRoute = async ({ locals, url }) => {
  const categoryParam = url.searchParams.get('category') as Category | null;
  const category = categoryParam && categories.includes(categoryParam) ? categoryParam : undefined;
  try {
    const result = await runDailyGeneration(await getRuntimeEnv(locals), {
      topic: url.searchParams.get('topic') ?? undefined,
      category,
      dryRun: url.searchParams.get('dryRun') === '1',
    });

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
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
