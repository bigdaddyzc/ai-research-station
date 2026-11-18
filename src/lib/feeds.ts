import type { Category } from './types';

/**
 * Fresh-source discovery for the Gemini API free tier, which has no Google Search
 * grounding quota. The Worker pulls recent items from public RSS/Atom feeds and hands
 * them to the model as candidates; the model reads the chosen pages with the
 * URL-context tool (free tier) and cites them.
 */

export type FeedItem = { title: string; url: string; publishedAt: string; feed: string };

const FEEDS: Record<Exclude<Category, 'personal'>, string[]> = {
  news: [
    'https://hnrss.org/newest?q=AI+OR+LLM+OR+OpenAI+OR+Anthropic+OR+Gemini&points=100',
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day',
    'https://simonwillison.net/atom/everything/',
  ],
  tools: [
    'https://hnrss.org/show?q=AI+OR+LLM+OR+agent&points=40',
    'https://huggingface.co/blog/feed.xml',
    'https://github.blog/ai-and-ml/feed/',
    'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=week',
    'https://simonwillison.net/atom/everything/',
  ],
  resources: [
    'https://hnrss.org/newest?q=free+AI+OR+open-source+LLM+OR+dataset&points=50',
    'https://huggingface.co/blog/feed.xml',
    'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=week',
    'https://github.blog/ai-and-ml/feed/',
  ],
  research: [
    'https://huggingface.co/blog/feed.xml',
    'https://www.interconnects.ai/feed',
    'https://magazine.sebastianraschka.com/feed',
    'https://simonwillison.net/atom/everything/',
    'https://hnrss.org/newest?q=paper+LLM+OR+transformer+OR+reasoning&points=80',
  ],
  prompts: [
    'https://simonwillison.net/atom/everything/',
    'https://hnrss.org/newest?q=prompt+OR+prompting+OR+workflow+LLM&points=30',
    'https://www.reddit.com/r/PromptEngineering/top/.rss?t=week',
    'https://www.oneusefulthing.org/feed',
  ],
};

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

function parseFeed(xml: string, feed: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const block of blocks) {
    const title = pick(block, 'title');
    let url = pick(block, 'link');
    if (!url) {
      const href = block.match(/<link[^>]*href="([^"]+)"/i);
      url = href ? href[1] : '';
    }
    const dateRaw = pick(block, 'pubDate') || pick(block, 'published') || pick(block, 'updated') || pick(block, 'dc:date');
    const ms = Date.parse(dateRaw);
    if (!title || !/^https?:\/\//.test(url) || Number.isNaN(ms)) continue;
    items.push({ title: title.slice(0, 200), url, publishedAt: new Date(ms).toISOString().slice(0, 10), feed });
  }
  return items;
}

export async function fetchCandidateSources(category: Exclude<Category, 'personal'>, oldestAllowed: Date, limit = 25): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    FEEDS[category].map(async (feed) => {
      const res = await fetch(feed, {
        headers: { 'user-agent': 'ACP-AI-Research/1.0 (+https://acp.dpdns.org)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [] as FeedItem[];
      return parseFeed(await res.text(), feed);
    }),
  );
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value) {
      if (seen.has(item.url) || new Date(item.publishedAt) < oldestAllowed) continue;
      seen.add(item.url);
      items.push(item);
    }
  }
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return items.slice(0, limit);
}
