import type { APIRoute } from 'astro';
import { getDb } from '../lib/db';
const siteUrl = 'https://acp.dpdns.org';

// Every published article in both languages (not only the "fresh" ones on the
// homepage), with hreflang pairs, so search engines can index the whole archive.
export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const urls: string[] = [];
  const entry = (loc: string, lastmod?: string, alts = '') =>
    `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}${alts}  </url>`;

  urls.push(entry(siteUrl + '/zh'), entry(siteUrl + '/en'));
  for (const cat of ['tools', 'news', 'resources', 'research', 'prompts', 'personal']) {
    urls.push(entry(`${siteUrl}/zh/${cat}`), entry(`${siteUrl}/en/${cat}`));
  }

  if (db) {
    const rows = (
      await db
        .prepare(
          `SELECT a.language, a.slug, g.id AS gid, g.category, COALESCE(g.published_at, g.created_at) AS d
             FROM articles a JOIN content_groups g ON g.id = a.content_group_id
            WHERE g.status IN ('published', 'archived') AND g.category != 'personal'
            ORDER BY d DESC LIMIT 2000`,
        )
        .all<Record<string, unknown>>()
    ).results ?? [];
    const byGroup = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
      const k = String(r.gid);
      byGroup.set(k, [...(byGroup.get(k) ?? []), r]);
    }
    for (const group of byGroup.values()) {
      const links = group.map((r) => ({ lang: String(r.language), href: `${siteUrl}/${r.language}/${r.category}/${r.slug}` }));
      const alts = links.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.lang === 'zh' ? 'zh-CN' : 'en'}" href="${l.href}" />\n`).join('');
      for (const [i, r] of group.entries()) {
        const lastmod = r.d ? new Date(String(r.d).replace(' ', 'T') + 'Z').toISOString().slice(0, 10) : undefined;
        urls.push(entry(links[i].href, lastmod, links.length > 1 ? alts : ''));
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
