import { generateContent, parseServiceAccountKey, type VertexAIConfig } from './vertex-ai';
import type { AppEnv } from './env';
import { fetchRankedStories, type StoryCluster } from './feeds';
import { normalizeSourceUrl } from './generation';
import { getBriefingByDate, saveBriefing } from './db';
import type { Briefing, BriefingItem, Category, Language } from './types';

/**
 * Daily briefing digest.
 *
 * Data: at generation time the same ranked-story pipeline article generation
 * uses (`fetchRankedStories`) is re-run across the four news-bearing
 * categories and merged into one top-10 list, plus today's published
 * articles (linked by shared primary source URL — an article's first source
 * only). The generation_jobs input_summary audit trail is NOT used as the
 * source: it stores only `Title (score); ...` strings with no URLs, and the
 * briefing needs original links per item.
 *
 * Three invariants the merge must keep:
 * - One story, one slot: stories sharing a normalized title or a normalized
 *   source URL collapse to the higher-scored copy.
 * - Every one of today's published articles has its story in the top-10,
 *   even when its story score alone would not make the cut.
 * - An item links to a published article only when the story's primary
 *   source (its first URL) is that article's primary source.
 *
 * Generation is one short model call per language. Scores are overwritten
 * with the ranking score and article links are resolved in code — the model
 * only writes prose, never scores or slugs.
 */

export type MergedStory = {
  title: string;
  score: number;
  latest: string;
  urls: string[];
  sourceLabels: string[];
  categories: Category[];
};

export type BriefingInput = {
  date: string;
  stories: MergedStory[];
  articles: {
    groupId: string;
    category: Category;
    heatScore: number;
    /** First source by rowid — the article's primary source. */
    primarySourceUrl: string | null;
    zh: { slug: string; title: string; summary: string } | null;
    en: { slug: string; title: string; summary: string } | null;
  }[];
};

/** Asia/Shanghai calendar date (YYYY-MM-DD) for a briefing. */
export function briefingDate(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

function oldestAllowedDate(category: Exclude<Category, 'personal'>): Date {
  // Same freshness windows as article generation (generation.ts).
  const date = new Date();
  if (category === 'news') date.setUTCDate(date.getUTCDate() - 7);
  else if (category === 'resources') date.setUTCMonth(date.getUTCMonth() - 4);
  else date.setUTCMonth(date.getUTCMonth() - 6);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
}

/** Merge per-category ranked stories into one deduplicated list, best first. Pure: unit-testable.
 * Two stories are the same story when their normalized titles match OR they share
 * a normalized source URL (the same underlying post can surface in two categories'
 * feeds). The higher-scored copy wins; categories, URLs and labels are unioned.
 * A story's URL list is representative-first, so urls[0] is its primary source. */
export function mergeStories(byCategory: { category: Category; stories: StoryCluster[] }[]): MergedStory[] {
  const flat: MergedStory[] = [];
  for (const { category, stories } of byCategory) {
    for (const s of stories) {
      const urls = [s.representative.url, ...s.items.map((it) => it.url).filter((u) => u !== s.representative.url)];
      flat.push({
        title: s.representative.title,
        score: s.score,
        latest: s.latest,
        urls,
        sourceLabels: s.sourceLabels,
        categories: [category],
      });
    }
  }
  flat.sort((a, b) => b.score - a.score || b.latest.localeCompare(a.latest));
  const kept: MergedStory[] = [];
  const byTitle = new Map<string, MergedStory>();
  const byUrl = new Map<string, MergedStory>();
  const claim = (story: MergedStory) => {
    byTitle.set(normalizeTitle(story.title), story);
    for (const url of story.urls) {
      const key = normalizeSourceUrl(url);
      if (key) byUrl.set(key, story);
    }
  };
  for (const story of flat) {
    let existing = byTitle.get(normalizeTitle(story.title));
    if (!existing) {
      for (const url of story.urls) {
        const key = normalizeSourceUrl(url);
        if (key && byUrl.has(key)) {
          existing = byUrl.get(key);
          break;
        }
      }
    }
    if (existing) {
      if (!existing.categories.includes(story.categories[0])) existing.categories.push(story.categories[0]);
      for (const url of story.urls) if (!existing.urls.includes(url)) existing.urls.push(url);
      for (const label of story.sourceLabels) if (!existing.sourceLabels.includes(label)) existing.sourceLabels.push(label);
      claim(existing);
      continue;
    }
    kept.push(story);
    claim(story);
  }
  return kept;
}

/** Merge per-category ranked stories into one top-N list. Pure: unit-testable. */
export function mergeTopStories(byCategory: { category: Category; stories: StoryCluster[] }[], limit = 10): MergedStory[] {
  return mergeStories(byCategory).slice(0, limit);
}

/** Guarantee every one of today's published articles has its story in the
 * briefing's top-N list. Pure: unit-testable. A missing article story is
 * swapped in for the lowest-scored story that is not itself one of today's
 * articles' stories; if the story is not in the ranked pool at all (e.g. it
 * fell outside the per-category top-15), a minimal story is synthesized from
 * the article itself, scored by its heat so the day's headline still leads
 * on importance. */
export function ensureArticleStories(
  top: MergedStory[],
  pool: MergedStory[],
  articles: BriefingInput['articles'],
  limit = 10,
): MergedStory[] {
  const result = [...top];
  const primaryKey = (url: string | null): string | null => {
    if (!url) return null;
    const key = normalizeSourceUrl(url);
    return key || null;
  };
  const storyHasKey = (story: MergedStory, key: string): boolean =>
    story.urls.some((u) => normalizeSourceUrl(u) === key);
  const findStory = (article: BriefingInput['articles'][number]): MergedStory | null => {
    const key = primaryKey(article.primarySourceUrl);
    if (!key) return null;
    return pool.find((s) => storyHasKey(s, key)) ?? null;
  };
  const isArticleStory = (story: MergedStory): boolean =>
    articles.some((a) => {
      const key = primaryKey(a.primarySourceUrl);
      return key !== null && storyHasKey(story, key);
    });
  for (const article of articles) {
    const key = primaryKey(article.primarySourceUrl);
    let story = findStory(article);
    if (!story && key && article.primarySourceUrl) {
      // Not in the ranked pool: synthesize from the article itself.
      let host = '';
      try {
        host = new URL(article.primarySourceUrl).hostname.replace(/^www\./, '');
      } catch {
        host = '';
      }
      story = {
        title: article.en?.title ?? article.zh?.title ?? '',
        score: article.heatScore,
        latest: '',
        urls: [article.primarySourceUrl],
        sourceLabels: host ? [host] : [],
        categories: [article.category],
      };
    }
    if (!story) continue;
    if (key && result.some((s) => storyHasKey(s, key))) continue;
    if (result.length < limit) {
      result.push(story);
    } else {
      const replaceable = result
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !isArticleStory(s))
        .sort((a, b) => a.s.score - b.s.score || a.s.latest.localeCompare(b.s.latest));
      if (replaceable.length === 0) continue;
      result[replaceable[0].i] = story;
    }
  }
  result.sort((a, b) => b.score - a.score || b.latest.localeCompare(a.latest));
  return result.slice(0, limit);
}

export async function assembleBriefingInput(db: D1Database): Promise<BriefingInput> {
  const date = briefingDate();

  // Today's published articles (UTC date; the 10:00 CST publish run is 02:00 UTC).
  const articleRows = (
    await db
      .prepare(
        `SELECT g.id AS gid, g.category, g.heat_score, a.language, a.title, a.slug, a.summary
         FROM content_groups g JOIN articles a ON a.content_group_id = g.id
         WHERE g.status = 'published' AND g.published_at >= date('now')`,
      )
      .all<Record<string, unknown>>()
  ).results ?? [];
  const articlesByGroup = new Map<string, BriefingInput['articles'][number]>();
  for (const row of articleRows) {
    const gid = String(row.gid);
    let entry = articlesByGroup.get(gid);
    if (!entry) {
      entry = { groupId: gid, category: row.category as Category, heatScore: Number(row.heat_score ?? 0), primarySourceUrl: null, zh: null, en: null };
      articlesByGroup.set(gid, entry);
    }
    const article = { slug: String(row.slug), title: String(row.title), summary: String(row.summary) };
    if (row.language === 'zh') entry.zh = article;
    else if (row.language === 'en') entry.en = article;
  }
  const articles = [...articlesByGroup.values()].sort((a, b) => b.heatScore - a.heatScore);

  // Primary source per article (first source by rowid): used to seed the
  // article's story into the top-10 and to link items to it.
  try {
    const srcRows = (
      await db
        .prepare(
          `SELECT s.content_group_id, s.url FROM sources s
           WHERE s.content_group_id IN (SELECT id FROM content_groups WHERE status = 'published' AND published_at >= date('now'))
           ORDER BY s.rowid`,
        )
        .all<Record<string, unknown>>()
    ).results ?? [];
    const primaryByGroup = new Map<string, string>();
    for (const row of srcRows) {
      const gid = String(row.content_group_id);
      if (!primaryByGroup.has(gid)) primaryByGroup.set(gid, String(row.url));
    }
    for (const article of articles) {
      article.primarySourceUrl = primaryByGroup.get(article.groupId) ?? null;
    }
  } catch {
    // No sources to seed/link with: stories simply carry original links.
  }

  // Ranked stories, same pipeline as article generation.
  const categories: Exclude<Category, 'personal'>[] = ['news', 'tools', 'research', 'resources'];
  const ranked = await Promise.all(
    categories.map(async (category) => ({
      category,
      stories: await fetchRankedStories(category, oldestAllowedDate(category), 15),
    })),
  );
  const pool = mergeStories(ranked);
  const stories = ensureArticleStories(pool.slice(0, 10), pool, articles, 10);

  return { date, stories, articles };
}

function briefingModelConfig(env: AppEnv): VertexAIConfig | null {
  const provider = env.AI_PROVIDER ?? 'gemini-api';
  if (provider === 'gemini-api') {
    if (!env.GEMINI_API_KEY) return null;
    return { project: '', location: '', apiKey: env.GEMINI_API_KEY, modelOverride: env.GEMINI_MODEL || 'gemini-3.5-flash' };
  }
  if (provider === 'vertex-ai') {
    if (!env.GOOGLE_CLOUD_PROJECT || !env.GOOGLE_SA_KEY_JSON) return null;
    return {
      project: env.GOOGLE_CLOUD_PROJECT,
      location: env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
      serviceAccountKey: parseServiceAccountKey(env.GOOGLE_SA_KEY_JSON),
    };
  }
  return null;
}

/** Same model as article generation (generation.ts getModelForCategory). */
function briefingModel(): string {
  return 'gemini-3.6-flash';
}

function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`Briefing model did not return JSON. Response: ${text.slice(0, 300)}`);
  return JSON.parse(stripped.slice(start, end + 1));
}

function briefingPrompt(input: BriefingInput, language: Language): string {
  const langName = language === 'zh' ? 'Chinese' : 'English';
  const storyBlock = input.stories
    .map(
      (s, i) =>
        `${i + 1}. [score ${s.score}] ${s.title} — sources: ${s.sourceLabels.join(', ')}\n${s.urls.map((u) => `   - ${u}`).join('\n')}`,
    )
    .join('\n');
  const articleBlock =
    input.articles.length === 0
      ? 'None published today yet.'
      : input.articles
          .map(
            (a, i) =>
              `${i + 1}. [${a.category}] ${a.zh?.title ?? a.en?.title ?? ''} — slug zh: ${a.zh?.slug ?? '-'}, en: ${a.en?.slug ?? '-'} — ${a.zh?.summary ?? a.en?.summary ?? ''}`,
          )
          .join('\n');
  return `Write the daily briefing for ACP AI Research for ${input.date}, in ${langName}.
The briefing is a ranked digest of the day's top stories. Write in ${langName} throughout.

TOP STORIES (ranked by importance score out of 100; keep this exact order and rank):
${storyBlock}

TODAY'S PUBLISHED ARTICLES on this site (for reference only — a story that matches one of these was already covered in depth):
${articleBlock}

CRITICAL: reply with a valid JSON object only, no explanations. Start with { and end with }.
{
  "title": "briefing title in ${langName}, e.g. ${language === 'zh' ? '2026年11月19日 AI 简报' : 'AI Briefing — November 19, 2026'}",
  "overview": "one sentence: what the day's single most important story is and why it matters (in ${langName})",
  "items": [
    {
      "rank": 1,
      "title": "story title in ${langName}",
      "summary": "2-3 sentence summary in ${langName} that opens with the key fact",
      "whyItMatters": "1-2 sentences in ${langName}: why a reader should care",
      "sources": [{"title": "source title", "publisher": "publisher", "url": "https://..."}]
    }
  ]
}

Rules:
- One item per story above, same order, same rank. Do not add, drop, or reorder stories.
- summary: 2-3 sentences, opens with the key fact or conclusion, never with a date phrase.
- whyItMatters: concrete impact for an AI user or developer, not generic praise.
- sources: copy 1-3 entries from the story's source list above (title, publisher, URL exactly as given). NEVER invent a URL, title, or publisher. If a story lists only one source, use that one.
- Titles: translate/adapt the story title into ${langName} faithfully; keep product, company, and model names as-is.
- Do not mention the score in the prose. Do not add a Sources section — sources live on each item.`;
}

/** Resolve the published article a story links to, primary source only. Pure: unit-testable.
 * A story links to an article only when the story's primary source (its first URL,
 * the cluster representative) is that article's primary source. Matching on any
 * secondary source mislinks stories that merely cite the same post. */
export function resolveArticleLink(
  story: MergedStory,
  sourceUrlToGroup: Map<string, BriefingInput['articles'][number]>,
  language: Language,
): { slug: string | null; category: Category | null } {
  const primaryUrl = story.urls[0];
  if (!primaryUrl) return { slug: null, category: null };
  const group = sourceUrlToGroup.get(normalizeSourceUrl(primaryUrl));
  if (!group) return { slug: null, category: null };
  const article = language === 'zh' ? group.zh : group.en;
  if (!article) return { slug: null, category: null };
  return { slug: article.slug, category: group.category };
}

function validateBriefingItems(
  parsed: unknown,
  input: BriefingInput,
  language: Language,
  sourceUrlToGroup: Map<string, BriefingInput['articles'][number]>,
): { title: string; overview: string; items: BriefingItem[] } {
  const obj = (parsed ?? {}) as { title?: unknown; overview?: unknown; items?: unknown };
  const title = String(obj.title ?? '').trim();
  const overview = String(obj.overview ?? '').trim();
  if (!title || !overview) throw new Error('Briefing model returned no title or overview.');
  if (!Array.isArray(obj.items) || obj.items.length === 0) throw new Error('Briefing model returned no items.');
  const items: BriefingItem[] = [];
  const count = Math.min(obj.items.length, input.stories.length);
  for (let i = 0; i < count; i++) {
    const raw = obj.items[i] as { title?: unknown; summary?: unknown; whyItMatters?: unknown; sources?: unknown };
    const story = input.stories[i];
    const itemTitle = String(raw?.title ?? '').trim() || story.title;
    const summary = String(raw?.summary ?? '').trim();
    const whyItMatters = String(raw?.whyItMatters ?? '').trim();
    if (!summary || !whyItMatters) throw new Error(`Briefing item ${i + 1} is missing summary or whyItMatters.`);
    // Sources: only URLs from the story's own list (the model must not invent any).
    const allowed = new Set(story.urls.map((u) => u));
    const sources: BriefingItem['sources'] = [];
    if (Array.isArray(raw?.sources)) {
      for (const s of raw.sources as { title?: unknown; publisher?: unknown; url?: unknown }[]) {
        const url = String(s?.url ?? '').trim();
        if (!url || !/^https?:\/\//.test(url) || !allowed.has(url) || sources.length >= 3) continue;
        sources.push({ title: String(s?.title ?? ''), publisher: String(s?.publisher ?? ''), url });
      }
    }
    if (sources.length === 0) {
      // Fall back to the story's first source so no item ships sourceless.
      const firstUrl = story.urls[0];
      if (firstUrl) sources.push({ title: story.title, publisher: story.sourceLabels[0] ?? '', url: firstUrl });
    }
    // Link to today's published article when the story's primary source is
    // that article's primary source.
    const { slug: articleSlug, category: articleCategory } = resolveArticleLink(story, sourceUrlToGroup, language);
    items.push({
      rank: i + 1,
      title: itemTitle,
      score: story.score,
      summary,
      whyItMatters,
      sources,
      articleSlug,
      articleCategory,
    });
  }
  return { title, overview, items };
}

export type BriefingResult = {
  ok: boolean;
  date: string;
  published: boolean;
  skipped?: boolean;
  items?: number;
  topTitle?: string;
  message: string;
};

export async function generateDailyBriefing(env: AppEnv, options: { date?: string; force?: boolean } = {}): Promise<BriefingResult> {
  const date = options.date ?? briefingDate();
  if (!env.DB) {
    return { ok: false, date, published: false, message: 'Database is unavailable.' };
  }
  const db = env.DB;

  // Idempotency: never generate twice for the same day unless forced.
  if (!options.force) {
    const existingZh = await getBriefingByDate(db, 'zh', date);
    const existingEn = await getBriefingByDate(db, 'en', date);
    if (existingZh && existingEn) {
      return { ok: true, date, published: false, skipped: true, message: `Briefing for ${date} already published.` };
    }
  }

  const config = briefingModelConfig(env);
  if (!config) {
    return { ok: false, date, published: false, message: 'No model configured for briefing generation (missing GEMINI_API_KEY or service-account key).' };
  }

  let input: BriefingInput;
  try {
    input = await assembleBriefingInput(db);
  } catch (error) {
    return { ok: false, date, published: false, message: `Failed to assemble briefing input: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (input.stories.length === 0 && input.articles.length === 0) {
    return { ok: false, date, published: false, message: 'No fresh stories or published articles for a briefing today.' };
  }

  // Map normalized PRIMARY source URL -> today's published article group (for internal links).
  // Primary-only on both sides: an article's secondary sources must not link
  // unrelated stories to it.
  const sourceUrlToGroup = new Map<string, BriefingInput['articles'][number]>();
  for (const article of input.articles) {
    if (!article.primarySourceUrl) continue;
    const key = normalizeSourceUrl(article.primarySourceUrl);
    if (key && !sourceUrlToGroup.has(key)) sourceUrlToGroup.set(key, article);
  }

  const model = briefingModel();
  const results: { language: Language; title: string; overview: string; items: BriefingItem[] }[] = [];
  try {
    for (const language of ['zh', 'en'] as Language[]) {
      const text = await generateContent(config, model, briefingPrompt(input, language), {
        useGrounding: false,
        temperature: 0.3,
        maxOutputTokens: 8192,
      });
      const parsed = extractJsonObject(text);
      results.push({ language, ...validateBriefingItems(parsed, input, language, sourceUrlToGroup) });
    }
  } catch (error) {
    await logBriefingJob(db, env.AI_PROVIDER ?? 'gemini-api', model, date, 'failed', error instanceof Error ? error.message : String(error)).catch(() => {});
    return { ok: false, date, published: false, message: `Briefing generation failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  // Save both languages; a failure here must not leave a half-published day.
  try {
    for (const result of results) {
      await saveBriefing(db, { date, language: result.language, title: result.title, overview: result.overview, items: result.items, status: 'published', publishedAt: null });
    }
  } catch (error) {
    await logBriefingJob(db, env.AI_PROVIDER ?? 'gemini-api', model, date, 'failed', error instanceof Error ? error.message : String(error)).catch(() => {});
    return { ok: false, date, published: false, message: `Failed to save briefing: ${error instanceof Error ? error.message : String(error)}` };
  }

  const topTitle = results[0]?.items[0]?.title ?? '';
  await logBriefingJob(
    db,
    env.AI_PROVIDER ?? 'gemini-api',
    model,
    date,
    'completed',
    undefined,
    `Briefing ${date}: ${results[0]?.items.map((it) => `${it.title} (${it.score})`).join('; ') ?? ''}`.slice(0, 1000),
  ).catch(() => {});
  return { ok: true, date, published: true, items: results[0]?.items.length ?? 0, topTitle, message: `Published briefing for ${date} (${results[0]?.items.length ?? 0} items, top: ${topTitle}).` };
}

async function logBriefingJob(
  db: D1Database,
  provider: string,
  model: string,
  date: string,
  status: 'completed' | 'failed',
  errorMessage?: string,
  inputSummary?: string,
): Promise<void> {
  await db
    .prepare("INSERT INTO generation_jobs (id, job_type, status, started_at, finished_at, model_provider, model_name, input_summary, error_message) VALUES (?, 'briefing', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), status, provider, model, inputSummary ?? '', (errorMessage ?? '').slice(0, 2000))
    .run();
}
