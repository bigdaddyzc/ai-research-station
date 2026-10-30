import type { APIRoute } from 'astro';
import { getDb, listArticles } from '../lib/db';
const siteUrl = 'https://acp.dpdns.org';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const zhArticles = await listArticles(db, 'zh', { limit: 200 });
  const enArticles = await listArticles(db, 'en', { limit: 200 });

  const urls = [];

  urls.push({ loc: siteUrl + '/zh' });
  urls.push({ loc: siteUrl + '/en' });

  for (const cat of ['tools', 'news', 'resources', 'research', 'prompts', 'personal']) {
    urls.push({ loc: siteUrl + '/zh/' + cat });
    urls.push({ loc: siteUrl + '/en/' + cat });
  }

  const zhSlugs = new Set(zhArticles.map((a) => a.slug));

  for (const article of zhArticles) {
    const enArticle = enArticles.find((a) => a.slug === article.slug);
    const loc = siteUrl + '/' + article.language + '/' + article.category + '/' + article.slug;
    const lastmod = article.publishedAt ? new Date(article.publishedAt).toISOString().split('T')[0] : '';
    const alts = [];
    alts.push('<xhtml:link rel="alternate" hreflang="zh" href="' + siteUrl + '/zh/' + article.category + '/' + article.slug + '" />');
    if (enArticle) {
      alts.push('<xhtml:link rel="alternate" hreflang="en" href="' + siteUrl + '/en/' + enArticle.category + '/' + enArticle.slug + '" />');
    }
    urls.push({ loc, lastmod, alts: alts.join('\n    ') });
  }

  for (const article of enArticles) {
    if (!zhSlugs.has(article.slug)) {
      const loc = siteUrl + '/' + article.language + '/' + article.category + '/' + article.slug;
      urls.push({ loc });
    }
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls.map((url) => {
      let entry = '  <url>\n    <loc>' + url.loc + '</loc>\n';
      if (url.lastmod) entry += '    <lastmod>' + url.lastmod + '</lastmod>\n';
      if (url.alts) entry += '    ' + url.alts + '\n';
      entry += '  </url>';
      return entry;
    }).join('\n') +
    '\n</urlset>';

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
