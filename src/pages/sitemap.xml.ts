import type { APIRoute } from 'astro';
import { getDb, listSitemapArticles } from '../lib/db';

const siteUrl = 'https://acp.dpdns.org';
const categories = ['tools', 'news', 'resources', 'research', 'prompts', 'personal'];

function alt(hreflang: string, href: string): string {
  return `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`;
}

function urlEntry(loc: string, lastmod: string, alts: string[]): string {
  let entry = '  <url>\n    <loc>' + loc + '</loc>\n';
  if (lastmod) entry += '    <lastmod>' + lastmod + '</lastmod>\n';
  if (alts.length > 0) entry += '    ' + alts.join('\n    ') + '\n';
  entry += '  </url>';
  return entry;
}

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const articles = await listSitemapArticles(db);

  // Group versions by slug so each URL can declare its zh/en alternates.
  const bySlug = new Map<string, { zh?: { category: string; slug: string }; en?: { category: string; slug: string } }>();
  for (const article of articles) {
    const pair = bySlug.get(article.slug) ?? {};
    pair[article.language] = { category: article.category, slug: article.slug };
    bySlug.set(article.slug, pair);
  }

  const entries: string[] = [];

  // Home pages, both languages.
  entries.push(urlEntry(siteUrl + '/zh', '', [alt('zh', siteUrl + '/zh'), alt('en', siteUrl + '/en'), alt('x-default', siteUrl + '/zh')]));
  entries.push(urlEntry(siteUrl + '/en', '', [alt('zh', siteUrl + '/zh'), alt('en', siteUrl + '/en'), alt('x-default', siteUrl + '/zh')]));

  // Category pages, both languages.
  for (const cat of categories) {
    entries.push(urlEntry(siteUrl + '/zh/' + cat, '', [alt('zh', siteUrl + '/zh/' + cat), alt('en', siteUrl + '/en/' + cat), alt('x-default', siteUrl + '/zh/' + cat)]));
    entries.push(urlEntry(siteUrl + '/en/' + cat, '', [alt('zh', siteUrl + '/zh/' + cat), alt('en', siteUrl + '/en/' + cat), alt('x-default', siteUrl + '/zh/' + cat)]));
  }

  // Every published article as its own URL, both languages.
  for (const article of articles) {
    const pair = bySlug.get(article.slug);
    if (!pair) continue;
    const loc = siteUrl + '/' + article.language + '/' + article.category + '/' + article.slug;
    const lastmod = article.publishedAt ? new Date(article.publishedAt).toISOString().split('T')[0] : '';
    const alts: string[] = [];
    if (pair.zh) alts.push(alt('zh', siteUrl + '/zh/' + pair.zh.category + '/' + pair.zh.slug));
    if (pair.en) alts.push(alt('en', siteUrl + '/en/' + pair.en.category + '/' + pair.en.slug));
    alts.push(alt('x-default', siteUrl + '/zh/' + (pair.zh?.category ?? article.category) + '/' + article.slug));
    entries.push(urlEntry(loc, lastmod, alts));
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    entries.join('\n') +
    '\n</urlset>';

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
