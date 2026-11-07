import type { APIRoute } from 'astro';

const trainingBots = ['GPTBot', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'ClaudeBot', 'anthropic-ai', 'meta-externalagent', 'cohere-ai', 'Diffbot'];

export const GET: APIRoute = () => {
  const body = `User-agent: *
Content-Signal: search=yes,ai-input=yes,ai-train=no
Allow: /

${trainingBots.map((bot) => `User-agent: ${bot}`).join('\n')}
Disallow: /

Sitemap: https://acp.dpdns.org/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
