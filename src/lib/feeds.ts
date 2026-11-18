import type { Category } from './types';

/**
 * Fresh-source discovery for the Gemini API free tier, which has no Google Search
 * grounding quota. The Worker pulls recent items from public RSS/Atom feeds and hands
 * them to the model as candidates; the model reads the chosen pages with the
 * URL-context tool (free tier) and cites them.
 *
 * Ranking (2026-11-18 redesign): candidates are grouped into STORIES first —
 * near-duplicate titles about the same event collapse into one story, so one
 * fast-moving event can no longer flood the list (on 2026-11-18 the Nvidia
 * CEO-ouster story took 5 of the top 10 slots as separate articles, while the
 * GPT-6.2 release sat at #9 and was nearly invisible). Each story then gets an
 * explicit importance score out of 100:
 *   recency 30 + independent-source coverage 30 + official-announcement
 *   authority 30 + engagement 10 (+5 when sources span >= 3 types).
 * Authority counts in full only when a story is corroborated by >= 2 sources,
 * so routine single-source announcements cannot flood the list either.
 * Weights were tuned 2026-11-18: HN engagement was dominating the list (only
 * HN reports points), and official announcements were underweighted.
 */

export type FeedItem = { title: string; url: string; publishedAt: string; feed: string; points?: number };

export type FeedType = 'official' | 'mainstream' | 'social' | 'blog';

export type StoryScore = { recency: number; coverage: number; authority: number; engagement: number; bonus: number; total: number };

export type StoryCluster = {
  representative: FeedItem;
  items: FeedItem[];
  sources: string[];
  sourceLabels: string[];
  types: FeedType[];
  latest: string;
  score: number;
  breakdown: StoryScore;
};

const FEEDS: Record<Exclude<Category, 'personal'>, string[]> = {
  news: [
    'https://hnrss.org/newest?q=AI+OR+LLM+OR+OpenAI+OR+Anthropic+OR+Gemini&points=100',
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    // Official OpenAI announcements (added 2026-11-18): major model releases
    // previously had only one entry point (a single blog post) and could be
    // crowded out of the candidate list entirely.
    'https://openai.com/news/rss.xml',
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

/** Authority weight per feed type (max 30). */
const AUTHORITY: Record<FeedType, number> = { official: 30, mainstream: 18, social: 18, blog: 12 };

function feedType(feed: string): FeedType {
  if (feed.includes('openai.com') || feed.includes('github.blog') || feed.includes('huggingface.co')) return 'official';
  if (feed.includes('hnrss.org') || feed.includes('reddit.com')) return 'social';
  if (feed.includes('techcrunch.com') || feed.includes('theverge.com')) return 'mainstream';
  return 'blog';
}

export function feedLabel(feed: string): string {
  if (feed.includes('hnrss.org')) return 'HN';
  if (feed.includes('techcrunch.com')) return 'TechCrunch';
  if (feed.includes('theverge.com')) return 'The Verge';
  if (feed.includes('openai.com')) return 'OpenAI';
  if (feed.includes('reddit.com')) return 'Reddit';
  if (feed.includes('simonwillison.net')) return 'Simon Willison';
  if (feed.includes('huggingface.co')) return 'Hugging Face';
  if (feed.includes('github.blog')) return 'GitHub Blog';
  if (feed.includes('interconnects.ai')) return 'Interconnects';
  if (feed.includes('sebastianraschka.com')) return 'Raschka';
  if (feed.includes('oneusefulthing.org')) return 'One Useful Thing';
  try {
    return new URL(feed).hostname.replace(/^www\./, '');
  } catch {
    return feed;
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
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
    // Keep the FULL timestamp (was: date only). Sorting by day alone made every
    // item from the same day tie, and the stable sort then fell back to feed
    // order — the last feed (Simon Willison's blog) was systematically crowded
    // out whenever earlier feeds filled the 25-item cap. On 2026-11-17/18 that
    // hid the GPT-6.2 release (whose only entry was Simon's post) from the model.
    const item: FeedItem = { title: title.slice(0, 200), url, publishedAt: new Date(ms).toISOString(), feed };
    // HN points, when the feed reports them ("123 points by ..."): the only
    // free engagement signal in the pipeline; used for the story score.
    const pointsMatch = pick(block, 'description').match(/(\d+)\s+points?/i);
    if (pointsMatch) item.points = Number(pointsMatch[1]);
    items.push(item);
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

// --- Story clustering -------------------------------------------------------

/** Words that carry no topical signal inside an AI-news corpus. */
const STOPWORDS = new Set(
  'a an the and or of to in on for with after before says say said is are was were will would it its it\'s this that these those by at as from into about over under now new not no do does don doesn t re ve ll d s m ai introducing announces announced announcing launches launched launching unveils unveil releases released'.split(' '),
);

function tokenize(title: string): string[] {
  return title
    .replace(/[‐‑]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function idfWeights(items: FeedItem[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const it of items) {
    for (const w of new Set(tokenize(it.title))) df.set(w, (df.get(w) ?? 0) + 1);
  }
  const n = items.length;
  const out = new Map<string, number>();
  for (const [w, c] of df) out.set(w, Math.log((n + 1) / (c + 1)) + 1);
  return out;
}

function cosine(a: string[], b: string[], idf: Map<string, number>): number {
  const wa = new Map<string, number>();
  for (const w of new Set(a)) wa.set(w, idf.get(w) ?? 1);
  const wb = new Map<string, number>();
  for (const w of new Set(b)) wb.set(w, idf.get(w) ?? 1);
  let num = 0;
  for (const [w, v] of wa) {
    const v2 = wb.get(w);
    if (v2 !== undefined) num += v * v2;
  }
  let na = 0;
  for (const v of wa.values()) na += v * v;
  let nb = 0;
  for (const v of wb.values()) nb += v * v;
  return na > 0 && nb > 0 ? num / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function sharedTokenCount(a: string[], b: string[]): number {
  const sb = new Set(b);
  return new Set(a.filter((w) => sb.has(w))).size;
}

/**
 * Group near-duplicate titles into one story. Merge only on strong evidence:
 * either >= 3 shared content tokens, or an IDF-weighted cosine >= 0.45 (which
 * covers very short titles). A single shared word, or two generic words
 * ("open source", "Sam Altman", "Claude Code"), is NOT a story — lexical
 * clustering cannot tell "same person, different story" apart, so precision
 * beats recall here: an unmerged story only ranks lower, a wrong merge hides
 * one entirely.
 */
function clusterItems(items: FeedItem[]): FeedItem[][] {
  const idf = idfWeights(items);
  const toks = new Map<FeedItem, string[]>();
  for (const it of items) toks.set(it, tokenize(it.title));
  const sorted = [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const clusters: FeedItem[][] = [];
  for (const it of sorted) {
    const itToks = toks.get(it) ?? [];
    let best: FeedItem[] | null = null;
    let bestSim = 0;
    let bestShared = 0;
    for (const c of clusters) {
      let sim = 0;
      let shared = 0;
      for (const m of c) {
        const mToks = toks.get(m) ?? [];
        sim = Math.max(sim, cosine(itToks, mToks, idf));
        shared = Math.max(shared, sharedTokenCount(itToks, mToks));
      }
      if ((shared >= 3 || sim >= 0.45) && sim > bestSim) {
        best = c;
        bestSim = sim;
        bestShared = shared;
      }
    }
    if (best && (bestShared >= 3 || bestSim >= 0.45)) best.push(it);
    else clusters.push([it]);
  }
  return clusters;
}

// --- Story scoring ----------------------------------------------------------

/** Same normalization as generation.ts's normalizeSourceUrl (kept local to avoid a circular import). */
function normalizeFeedUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

function scoreStory(items: FeedItem[], category: Exclude<Category, 'personal'>, now: Date): { score: number; breakdown: StoryScore; latest: string; sources: string[]; types: FeedType[] } {
  const latestMs = Math.max(...items.map((i) => Date.parse(i.publishedAt)));
  const latest = new Date(latestMs);
  const ageH = (now.getTime() - latestMs) / 3_600_000;
  let recency: number;
  if (category === 'news') {
    // News decays fast: full marks within 24h, -5 per 12h after, floor 10 past 48h.
    recency = ageH <= 24 ? 30 : ageH <= 36 ? 25 : ageH <= 48 ? 20 : 10;
  } else {
    // Longer windows decay over weeks: full marks within 7 days, -5 per extra week, floor 10.
    const ageDays = ageH / 24;
    recency = 30 - 5 * Math.min(4, Math.floor(Math.max(0, ageDays - 7) / 7));
  }
  const feeds = [...new Set(items.map((i) => i.feed))];
  const coverage = feeds.length === 1 ? 10 : feeds.length === 2 ? 20 : feeds.length === 3 ? 25 : feeds.length === 4 ? 28 : 30;
  const authFull = Math.max(...items.map((i) => AUTHORITY[feedType(i.feed)]));
  // Authority counts in full only when corroborated by >= 2 independent sources.
  const authority = feeds.length >= 2 ? authFull : Math.floor(authFull / 2);
  const points = items.map((i) => i.points).filter((p): p is number => typeof p === 'number');
  const engagement = points.length === 0 ? 4 : Math.max(...points) >= 300 ? 10 : Math.max(...points) >= 100 ? 6 : 3;
  const types = [...new Set(items.map((i) => feedType(i.feed)))];
  const bonus = types.length >= 3 ? 5 : 0;
  const total = Math.min(100, recency + coverage + authority + engagement + bonus);
  return { score: total, breakdown: { recency, coverage, authority, engagement, bonus, total }, latest: latest.toISOString(), sources: feeds, types };
}

/**
 * Fetch fresh candidates, group them into stories, score each story, and
 * return the top ones ranked by importance — not by recency alone.
 */
export async function fetchRankedStories(
  category: Exclude<Category, 'personal'>,
  oldestAllowed: Date,
  limit = 15,
  excludeUrls?: Set<string>,
): Promise<StoryCluster[]> {
  const items = await fetchCandidateSources(category, oldestAllowed, 60);
  const fresh = excludeUrls ? items.filter((it) => !excludeUrls.has(normalizeFeedUrl(it.url))) : items;
  const clusters = clusterItems(fresh);
  const now = new Date();
  const ranked: StoryCluster[] = clusters.map((c) => {
    const s = scoreStory(c, category, now);
    // Representative: the highest-authority item, newest first on ties.
    const representative = [...c].sort((a, b) => {
      const d = AUTHORITY[feedType(b.feed)] - AUTHORITY[feedType(a.feed)];
      return d !== 0 ? d : b.publishedAt.localeCompare(a.publishedAt);
    })[0];
    return {
      representative,
      items: c,
      sources: s.sources,
      sourceLabels: s.sources.map(feedLabel),
      types: s.types,
      latest: s.latest,
      score: s.score,
      breakdown: s.breakdown,
    };
  });
  ranked.sort((a, b) => b.score - a.score || b.latest.localeCompare(a.latest));
  return ranked.slice(0, limit);
}
