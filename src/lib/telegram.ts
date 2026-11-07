import type { AppEnv } from './env';

const SITE = 'https://acp.dpdns.org';
const CATEGORY_ZH: Record<string, string> = { news: 'AI 新闻', tools: 'AI 工具', research: '深度研究', resources: 'AI 资源', prompts: '提示词' };

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Post newly published content groups (Chinese version) to the Telegram channel. */
export async function postPublishedToTelegram(env: AppEnv, groupIds: string[]): Promise<{ sent: number; errors: string[] }> {
  const out = { sent: 0, errors: [] as string[] };
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || !env.DB || groupIds.length === 0) return out;
  const chat = env.TELEGRAM_CHANNEL || '@acprelation';
  for (const id of groupIds) {
    const row = await env.DB
      .prepare("SELECT a.title, a.summary, a.slug, g.category FROM articles a JOIN content_groups g ON g.id = a.content_group_id WHERE g.id = ? AND a.language = 'zh' LIMIT 1")
      .bind(id)
      .first<Record<string, string>>();
    if (!row) continue;
    const url = `${SITE}/zh/${row.category}/${row.slug}?utm_source=telegram`;
    const text = `<b>【${esc(CATEGORY_ZH[row.category] ?? 'AI')}】${esc(row.title)}</b>\n\n${esc(row.summary)}\n\n<a href="${url}">阅读全文 →</a>`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { url, prefer_large_media: true } }),
      });
      const data = (await res.json()) as { ok: boolean; description?: string };
      if (data.ok) out.sent += 1;
      else out.errors.push(data.description ?? `HTTP ${res.status}`);
    } catch (e) {
      out.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}
