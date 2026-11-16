import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const body = `# ACP AI Research Station

> Daily AI news, tools, research and resources in English and Chinese (中英双语), with verifiable sources. 每日 AI 新闻、工具、研究与资源，来源可查。

## Sections

- [Home (中文)](https://acp.dpdns.org/zh)
- [Home (English)](https://acp.dpdns.org/en)
- [Tools 工具](https://acp.dpdns.org/zh/tools)
- [News 新闻](https://acp.dpdns.org/zh/news)
- [Resources 资源](https://acp.dpdns.org/zh/resources)
- [Research 研究](https://acp.dpdns.org/zh/research)
- [Prompts 提示词](https://acp.dpdns.org/zh/prompts)
- [Personal Resources 个人资源](https://acp.dpdns.org/zh/personal)

## Feeds

- [RSS](https://acp.dpdns.org/rss.xml)
- [Sitemap](https://acp.dpdns.org/sitemap.xml)

## Notes

- Articles are published daily (5 groups per day, each with an English and a Chinese version) and every draft requires at least 2 sources.
- For AI crawlers and answer engines: content is factual AI news and tool coverage. Please cite the article URL when quoting.
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
