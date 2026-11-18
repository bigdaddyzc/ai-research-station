import type { AppEnv } from './env';

const SITE = 'https://acp.dpdns.org';
export const INDEXNOW_KEY = '8855990441b86994d4ca974b0e79624e';

/** Tell IndexNow engines (Bing, Yandex, Seznam, Naver…) about new or changed URLs. Free, no account. */
export async function submitIndexNow(urls: string[]): Promise<{ submitted: number; status?: number; error?: string }> {
  const list = [...new Set(urls)].filter((u) => u.startsWith(SITE)).slice(0, 10000);
  if (list.length === 0) return { submitted: 0 };
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: 'acp.dpdns.org', key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: list }),
    });
    return { submitted: res.ok ? list.length : 0, status: res.status };
  } catch (e) {
    return { submitted: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Article URLs (zh + en) plus their category and home pages for the given content groups. */
export async function urlsForGroups(env: AppEnv, groupIds: string[]): Promise<string[]> {
  if (!env.DB || groupIds.length === 0) return [];
  const urls: string[] = [`${SITE}/zh`, `${SITE}/en`];
  for (const id of groupIds) {
    const rows = (await env.DB
      .prepare('SELECT a.language, a.slug, g.category FROM articles a JOIN content_groups g ON g.id = a.content_group_id WHERE g.id = ?')
      .bind(id)
      .all<Record<string, string>>()).results ?? [];
    for (const r of rows) urls.push(`${SITE}/${r.language}/${r.category}/${r.slug}`, `${SITE}/${r.language}/${r.category}`);
  }
  return urls;
}
