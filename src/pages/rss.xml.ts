import type { APIRoute } from 'astro';
import { getDb, listArticles } from '../lib/db';

const siteUrl = 'https://acp.dpdns.org';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const zhArticles = await listArticles(db, 'zh', { limit: 30 });
  const enArticles = await listArticles(db, 'en', { limit: 30 });
  const allArticles = [...zhArticles, ...enArticles].sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  }).slice(0, 30);

  const itemXml = allArticles.map((article) => {
    let item = '    <item>\n';
    item += '      <title><![CDATA[' + article.title + ' (' + article.language.toUpperCase() + ')]]></title>\n';
    item += '      <link>' + siteUrl + '/' + article.language + '/' + article.category + '/' + article.slug + '</link>\n';
    item += '      <description><![CDATA[' + article.summary + ']]></description>\n';
    if (article.publishedAt) {
      item += '      <pubDate>' + new Date(article.publishedAt).toUTCString() + '</pubDate>\n';
    }
    item += '      <guid isPermaLink="true">' + siteUrl + '/' + article.language + '/' + article.category + '/' + article.slug + '</guid>\n';
    item += '    </item>';
    return item;
  }).join('\n');

  const rss = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '  <channel>\n' +
    '    <title>ACP AI Research</title>\n' +
    '    <link>' + siteUrl + '</link>\n' +
    '    <description>Bilingual AI research and intelligence website. AI-assisted, owner-reviewed before publication.</description>\n' +
    '    <language>zh-CN, en</language>\n' +
    '    <lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n' +
    '    <atom:link href="' + siteUrl + '/rss.xml" rel="self" type="application/rss+xml" />\n' +
    itemXml + '\n' +
    '  </channel>\n' +
    '</rss>';

  return new Response(rss, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
