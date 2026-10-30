import type { APIRoute } from 'astro';
import { getDb, listArticles } from '../lib/db';
import type { Category } from '../lib/types';

const site = 'https://acp.dpdns.org';
const sections: { category: Exclude<Category, 'personal'>; en: string; zh: string }[] = [
  { category: 'news', en: 'AI News (last 7 days)', zh: 'AI 新闻' },
  { category: 'tools', en: 'AI Tools', zh: 'AI 工具评测' },
  { category: 'research', en: 'Research Explainers', zh: '深度研究' },
  { category: 'resources', en: 'Free AI Resources', zh: 'AI 资源' },
  { category: 'prompts', en: 'Prompts & Workflows', zh: '提示词 / 工作流' },
];

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [en, zh] = await Promise.all([listArticles(db, 'en', { limit: 60 }), listArticles(db, 'zh', { limit: 60 })]);
  const lines: string[] = [
    '# ACP AI Research (ACP AI 研究站)',
    '',
    '> Bilingual (English / Simplified Chinese) daily AI briefing: AI news, AI tool reviews, research explainers, free AI resources and reusable prompt workflows. Every article lists its original sources with publication dates. Content is AI-compiled from public sources and published after automated quality checks.',
    '',
    'Citation: welcome for search and AI answers with attribution to "ACP AI Research" and a link. Not licensed for AI model training.',
    '',
    '## Key pages',
    `- [English home](${site}/en): latest articles in English`,
    `- [中文首页](${site}/zh): 最新中文文章`,
    `- [About / methodology](${site}/en/about): how content is sourced, scored and updated`,
    `- [RSS](${site}/rss.xml)`,
    `- [Sitemap](${site}/sitemap.xml)`,
    '',
  ];
  for (const s of sections) {
    const items = en.filter((a) => a.category === s.category).slice(0, 10);
    const zhItems = zh.filter((a) => a.category === s.category).slice(0, 10);
    if (!items.length && !zhItems.length) continue;
    lines.push(`## ${s.en} / ${s.zh}`);
    lines.push(`- [${s.en} index](${site}/en/${s.category}) · [${s.zh}](${site}/zh/${s.category})`);
    for (const a of items) lines.push(`- [${a.title}](${site}/en/${a.category}/${a.slug}): ${a.summary.replace(/\s+/g, ' ').slice(0, 200)}`);
    for (const a of zhItems) lines.push(`- [${a.title}](${site}/zh/${a.category}/${a.slug}): ${a.summary.replace(/\s+/g, ' ').slice(0, 120)}`);
    lines.push('');
  }
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
