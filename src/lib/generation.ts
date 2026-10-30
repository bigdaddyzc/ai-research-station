import {
  generateContent,
  generateGroundedContent,
  resolveGroundingRedirect,
  parseServiceAccountKey,
  type GroundingSource,
  type VertexAIConfig,
} from './vertex-ai';
import type { AppEnv } from './env';
import type { Category, Language } from './types';

export interface GenerationResult {
  provider: string;
  createdDrafts: number;
  message: string;
  contentGroupIds?: string[];
  previews?: GeneratedDraft[];
}

type GenerationOptions = {
  topic?: string;
  category?: Category;
  dryRun?: boolean;
};

type GeneratedArticle = {
  language: Language;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  tags: string[];
  readingTime: number;
  seoTitle: string;
  seoDescription: string;
};

type SourcePlatform = 'social' | 'code' | 'blog' | 'web';

type GeneratedSource = {
  url: string;
  title: string;
  publisher: string;
  publishedAt: string;
  reliabilityScore: number;
  platform: SourcePlatform;
  redirectUrl: string | null;
  groundingVerified: boolean;
  urlResolved: boolean;
};

type GeneratedDraft = {
  canonicalSlug: string;
  category: Category;
  heatScore: number;
  sourceQualityScore: number;
  articles: GeneratedArticle[];
  sources: GeneratedSource[];
};

type FactPack = {
  canonicalSlug?: string;
  topic?: string;
  heatScore?: number;
  sourceQualityScore?: number;
  sources?: GeneratedSource[];
  keyFacts?: string[];
  cautions?: string[];
};

type CategoryConfig = {
  zhName: string;
  enName: string;
  description: string;
  topicGuidance: string;
  zhSections: string[];
  enSections: string[];
};

const CATEGORY_CONFIGS: Record<Exclude<Category, 'personal'>, CategoryConfig> = {
  news: {
    zhName: 'AI新闻',
    enName: 'AI News',
    description:
      'Specific recent AI news from the past 24-48 hours: model releases, company announcements, funding rounds, policy changes, major product launches, and industry developments.',
    topicGuidance:
      'Search the web for one significant, verifiable AI news event from today or the past 48 hours. Focus on concrete details and practical impact.',
    zhSections: ['核心事件', '背景', '影响分析', '行业反应', '参考来源'],
    enSections: ['Key Event', 'Background', 'Impact Analysis', 'Industry Reactions', 'Sources'],
  },
  tools: {
    zhName: 'AI工具评测',
    enName: 'AI Tool Reviews',
    description: 'Evaluation of an active or recently updated AI tool, platform, or developer product.',
    topicGuidance:
      'Search the web for one AI tool or platform recently launched, updated, or gaining traction. Evaluate capabilities, target users, pricing, limits, and alternatives.',
    zhSections: ['工具概览', '核心功能', '适用场景', '优劣势分析', '定价与替代方案', '参考来源'],
    enSections: ['Tool Overview', 'Core Features', 'Use Cases', 'Pros and Cons', 'Pricing and Alternatives', 'Sources'],
  },
  resources: {
    zhName: 'AI资源',
    enName: 'AI Resources',
    description:
      'Practical AI resources available now: official free tiers and credits, community-built open-source tools and datasets, third-party API relay/proxy services (with high credibility), curated tutorials, courses, and redeemable coupons.',
    topicGuidance:
      'Search the web for one AI resource that users can actually use, claim, or access today. Include official resources (free credits, grants, free API quotas), community resources (open-source models/tools, datasets, community-maintained projects), AND credible third-party services (API relay/proxy platforms, aggregation tools). Prioritize resources with high credibility and active maintenance. Exclude low-quality or unverified third-party services.',
    zhSections: ['资源概览', '主要内容', '使用方式', '注意事项', '参考来源'],
    enSections: ['Resource Overview', 'Key Content', 'How to Use', 'Notes and Caveats', 'Sources'],
  },
  research: {
    zhName: '深度研究',
    enName: 'Deep Research',
    description:
      'Deep analysis of an AI concept, paradigm, architecture, or methodology, not a one-off news report.',
    topicGuidance:
      'Search the web for an important AI concept, architecture pattern, or technical methodology. Analyze how it works, why it matters, practical value, and limitations.',
    zhSections: ['核心结论', '概念背景', '技术原理', '关键演进', '实用价值', '风险与限制', '参考来源'],
    enSections: ['Core Takeaway', 'Concept Background', 'Technical Principles', 'Key Evolution', 'Practical Value', 'Risks and Limits', 'Sources'],
  },
  prompts: {
    zhName: '高质量提示词与工作流',
    enName: 'High-quality Prompts and Workflows',
    description:
      'Reusable, source-backed prompt templates and reproducible AI workflows with clear variables, steps, constraints, and quality checks.',
    topicGuidance:
      'Find a recently documented prompting technique or practical AI workflow from official model documentation, a credible repository, or an experienced practitioner. Turn it into one concrete reusable template, not a generic list of tips.',
    zhSections: ['适用场景', '核心提示词', '工作流步骤', '变量说明', '使用方法', '质量检查', '参考来源'],
    enSections: ['Best for', 'Core Prompt', 'Workflow Steps', 'Variables', 'How to Use', 'Quality Checks', 'Sources'],
  },
};

const GENERATION_CATEGORIES: Exclude<Category, 'personal'>[] = ['news', 'tools', 'resources', 'research', 'prompts'];

// Platforms that count as high-signal primary sources beyond ordinary news sites.
const REQUIRED_PLATFORMS: SourcePlatform[] = ['social', 'code', 'blog'];
// A source is "high confidence" only when Google Search actually grounded on it AND
// the model rated it reliable enough.
const HIGH_CONFIDENCE_MIN = 70;
// Categories that MUST include at least one high-confidence social/code/blog source.
const HARD_DIVERSITY_CATEGORIES: Exclude<Category, 'personal'>[] = ['news', 'tools'];

// Known individual AI researcher / practitioner blogs. Editable allowlist — these
// classify as `blog` even when hosted on github.io. Extend as needed.
const KNOWN_AI_BLOG_DOMAINS = [
  'karpathy.ai',
  'lilianweng.github.io',
  'simonwillison.net',
  'jalammar.github.io',
  'huyenchip.com',
  'sebastianraschka.com',
  'magazine.sebastianraschka.com',
  'colah.github.io',
  'distill.pub',
  'thegradient.pub',
  'interconnects.ai',
  'oneusefulthing.org',
  'eugeneyan.com',
  'hamel.dev',
  'bair.berkeley.edu',
  'newsletter.maartengrootendorst.com',
];

function extractDomain(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return '';
  }
}

function domainsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function classifyPlatform(url: string): SourcePlatform {
  const domain = extractDomain(url);
  if (!domain) return 'web';
  if (/^(.+\.)?(x\.com|twitter\.com|reddit\.com)$/.test(domain) || domain.includes('nitter.')) return 'social';
  // Check the known-blog allowlist before code hosts so github.io blogs classify as `blog`.
  if (KNOWN_AI_BLOG_DOMAINS.some((blog) => domainsMatch(domain, blog))) return 'blog';
  if (/^(.+\.)?(github\.com|github\.io|gitlab\.com|huggingface\.co)$/.test(domain)) return 'code';
  return 'web';
}

function isHighConfidencePlatformSource(source: GeneratedSource): boolean {
  // Note: we intentionally do NOT require source.groundingVerified here. Google Search
  // grounding rarely returns X/Reddit/GitHub chunks directly for AI news/tools queries,
  // so gating on it made news/tools nearly impossible to satisfy. groundingVerified is
  // still captured and surfaced in admin as provenance, just not a hard gate.
  return REQUIRED_PLATFORMS.includes(source.platform) && source.reliabilityScore >= HIGH_CONFIDENCE_MIN;
}

/**
 * Enrich model-declared sources with real Google Search grounding provenance:
 * classify the platform, mark whether grounding corroborated the URL, follow the
 * grounding redirect to recover the authoritative destination, and keep the redirect
 * for provenance. Each grounded chunk is matched to at most one source (by domain).
 * Preference for the stored url: grounding-resolved real URL > model's declared URL.
 */
async function crossCheckSources(sources: GeneratedSource[], grounding: GroundingSource[]): Promise<GeneratedSource[]> {
  const pool = grounding.filter((g) => g.domain);
  const result: GeneratedSource[] = [];
  for (const source of sources) {
    const domain = extractDomain(source.url);
    const idx = pool.findIndex((g) => domainsMatch(domain, g.domain));
    if (idx < 0) {
      // Not corroborated by grounding — keep the model's URL but flag it unverified.
      result.push({
        ...source,
        platform: classifyPlatform(source.url),
        redirectUrl: null,
        groundingVerified: false,
        urlResolved: true,
      });
      continue;
    }
    const [match] = pool.splice(idx, 1);
    const resolved = match.redirectUrl ? await resolveGroundingRedirect(match.redirectUrl) : null;
    const finalUrl = resolved ?? source.url;
    result.push({
      ...source,
      url: finalUrl,
      platform: classifyPlatform(finalUrl),
      redirectUrl: match.redirectUrl || null,
      groundingVerified: true,
      // true => url was recovered by following the real grounding redirect;
      // false => url is the model's (grounding-domain-verified) claim.
      urlResolved: Boolean(resolved),
    });
  }
  return result;
}

/**
 * Enforce the source-diversity policy: news/tools MUST have a high-confidence
 * social/code/blog source (throws to skip the topic otherwise); research/resources
 * only prefer one (logged, never fatal).
 */
function enforceSourceDiversity(sources: GeneratedSource[], category: Exclude<Category, 'personal'>): void {
  const hasHighConfidencePlatform = sources.some(isHighConfidencePlatformSource);
  if (hasHighConfidencePlatform) return;

  const message = `Category ${category} has no high-confidence source (reliability >= ${HIGH_CONFIDENCE_MIN}) from X/Reddit, GitHub/Hugging Face, or a known AI blog.`;
  if (HARD_DIVERSITY_CATEGORIES.includes(category)) {
    throw new Error(`${message} Skipping so we can retry with a better source mix.`);
  }
  console.warn(`[generation] ${message} (soft preference for ${category}; keeping draft.)`);
}

export async function runDailyGeneration(env: AppEnv | undefined, options: GenerationOptions = {}): Promise<GenerationResult> {
  const provider = env?.AI_PROVIDER ?? 'mock';

  if (provider === 'mock') {
    return {
      provider,
      createdDrafts: 0,
      message: 'Mock generation completed. Set AI_PROVIDER=vertex-ai to create real drafts.',
    };
  }

  if (provider === 'vertex-ai') {
    return runVertexAIGeneration(env!, options);
  }

  return {
    provider,
    createdDrafts: 0,
    message: `Provider ${provider} is configured but not implemented yet.`,
  };
}

async function runVertexAIGeneration(env: AppEnv, options: GenerationOptions): Promise<GenerationResult> {
  const project = env.GOOGLE_CLOUD_PROJECT;
  const location = env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';
  const keyJson = env.GOOGLE_SA_KEY_JSON;
  const db = env.DB;

  if (!project) {
    return { provider: 'vertex-ai', createdDrafts: 0, message: 'Missing GOOGLE_CLOUD_PROJECT.' };
  }
  if (!keyJson) {
    return {
      provider: 'vertex-ai',
      createdDrafts: 0,
      message: 'Missing GOOGLE_SA_KEY_JSON. Put the service account JSON in .env locally and Cloudflare secrets in production.',
    };
  }
  if (options.category === 'personal') {
    return {
      provider: 'vertex-ai',
      createdDrafts: 0,
      message: 'The personal category is owner-managed and is not generated by the daily AI job.',
    };
  }

  const config: VertexAIConfig = {
    project,
    location,
    serviceAccountKey: parseServiceAccountKey(keyJson),
  };

  if (options.category) {
    return generateSingleCategory(config, db, options as GenerationOptions & { category: Exclude<Category, 'personal'> });
  }

  return generateAllCategories(config, db, options);
}

async function generateSingleCategory(
  config: VertexAIConfig,
  db: D1Database | undefined,
  options: GenerationOptions & { category: Exclude<Category, 'personal'> },
): Promise<GenerationResult> {
  const normalizedDraft = await generateDraft(config, options.category, options.topic, db);

  if (options.dryRun || !db) {
    return {
      provider: 'vertex-ai',
      createdDrafts: 0,
      message: options.dryRun
        ? 'Vertex AI generated a draft preview. dryRun=1, so nothing was saved.'
        : 'Vertex AI generated a draft preview, but no D1 binding is available. Run with Wrangler or deploy to save drafts.',
      previews: [normalizedDraft],
    };
  }

  const contentGroupId = await saveDraft(db, normalizedDraft);
  return {
    provider: 'vertex-ai',
    createdDrafts: normalizedDraft.articles.length,
    contentGroupIds: [contentGroupId],
    message: `Created ${normalizedDraft.articles.length} draft articles in content group ${contentGroupId}. Review them at /admin.`,
  };
}

async function generateAllCategories(config: VertexAIConfig, db: D1Database | undefined, options: GenerationOptions): Promise<GenerationResult> {
  const results: Array<
    | { category: Exclude<Category, 'personal'>; draft: GeneratedDraft; contentGroupId?: string }
    | { category: Exclude<Category, 'personal'>; error: string }
  > = [];

  for (const category of GENERATION_CATEGORIES) {
    try {
      const normalizedDraft = await generateDraft(config, category, options.topic, db);      let contentGroupId: string | undefined;
      if (!options.dryRun && db) {
        contentGroupId = await saveDraft(db, normalizedDraft);
      }

      results.push({ category, draft: normalizedDraft, contentGroupId });
    } catch (error) {
      results.push({ category, error: formatGenerationError(error) });
    }
  }

  const successful = results.filter((result): result is Extract<typeof result, { draft: GeneratedDraft }> => 'draft' in result);
  const failed = results.filter((result): result is Extract<typeof result, { error: string }> => 'error' in result);
  const totalArticles = successful.reduce((sum, result) => sum + result.draft.articles.length, 0);
  const contentGroupIds = successful.map((result) => result.contentGroupId).filter(Boolean) as string[];

  let message = `Generated ${successful.length}/${GENERATION_CATEGORIES.length} categories with ${totalArticles} articles total.`;
  if (failed.length > 0) {
    message += ` Failed: ${failed.map((result) => `${result.category} (${result.error})`).join(', ')}.`;
  }
  if (options.dryRun) {
    message += ' dryRun=1, so nothing was saved.';
  } else if (!db) {
    message += ' No D1 binding available, nothing was saved.';
  }

  return {
    provider: 'vertex-ai',
    createdDrafts: options.dryRun || !db ? 0 : totalArticles,
    contentGroupIds: contentGroupIds.length > 0 ? contentGroupIds : undefined,
    previews: options.dryRun || !db ? successful.map((result) => result.draft) : undefined,
    message,
  };
}

async function generateDraft(config: VertexAIConfig, category: Exclude<Category, 'personal'>, topic?: string, db?: D1Database): Promise<GeneratedDraft> {
  const existingSlugs = db ? await getExistingSlugs(db, category) : [];
  const facts = await generateFactPack(config, category, topic, existingSlugs);

  if (facts.canonicalSlug && existingSlugs.some(s => s === facts.canonicalSlug || facts.canonicalSlug!.includes(s) || s.includes(facts.canonicalSlug!))) {
    throw new Error(`Duplicate topic detected: "${facts.canonicalSlug}" overlaps with an existing article. Skipping.`);
  }

  const draft = await generateDraftFromFactPack(config, category, facts);
  // The grounded, cross-checked fact-pack sources carry real provenance; the second
  // (ungrounded) model pass only rewrites prose, so it must not clobber them.
  if (Array.isArray(facts.sources) && facts.sources.length > 0) {
    draft.sources = facts.sources;
  }
  return normalizeDraft(draft, category);
}

async function getExistingSlugs(db: D1Database, category: Exclude<Category, 'personal'>): Promise<string[]> {
  const result = await db
    .prepare("SELECT canonical_slug FROM content_groups WHERE category = ? AND status IN ('published', 'needs_review', 'draft') ORDER BY created_at DESC LIMIT 100")
    .bind(category)
    .all<Record<string, unknown>>();
  return (result.results ?? []).map(r => String(r.canonical_slug));
}

function getModelForCategory(category: Exclude<Category, 'personal'>): string {
  // gemini-3.6-flash is the strongest model available in this project.
  // It's global-endpoint only (vertex-ai.ts auto-routes via GLOBAL_ONLY).
  // research gets extra output budget for deeper analysis.
  return 'gemini-3.6-flash';
}

async function generateFactPack(config: VertexAIConfig, category: Exclude<Category, 'personal'>, topic?: string, existingSlugs: string[] = []): Promise<FactPack> {
  const categoryConfig = CATEGORY_CONFIGS[category];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const freshnessWindow = getFreshnessWindow(category);
  const oldestAllowedDate = getOldestAllowedSourceDate(category).toISOString().slice(0, 10);
  const diversityRule = HARD_DIVERSITY_CATEGORIES.includes(category)
    ? `- MANDATORY source mix: at least ONE source MUST be a high-credibility primary source that Google Search actually returns, from ONE of these: an X/Twitter or Reddit post (e.g. r/MachineLearning, r/LocalLLaMA), a GitHub or Hugging Face repo/release page, OR a well-known individual AI researcher's blog (e.g. Simon Willison, Lilian Weng, Sebastian Raschka, Andrej Karpathy, Chip Huyen). It must be real and currently accessible. Do NOT fabricate this URL.`
    : `- STRONGLY PREFER to also include at least one primary source from X/Twitter or Reddit, GitHub or Hugging Face, or a well-known individual AI researcher's blog, alongside news outlets.`;
  const prompt = `Use Google Search to find current real information for ACP AI Research.

Today: ${today}
Oldest allowed source publication date: ${oldestAllowedDate}
Category: ${category} (${categoryConfig.zhName} / ${categoryConfig.enName})
Category definition: ${categoryConfig.description}
Task: ${topic || categoryConfig.topicGuidance}

CRITICAL INSTRUCTION: You MUST reply with a valid JSON object. NEVER reply with plain text, explanations, or apologies.
If you cannot find sources within the exact date range, broaden your search to find the most recent relevant topic in this category. Use the best available sources even if slightly older.
Start your response with { and end with }.

Return compact JSON only with this shape:
{
  "canonicalSlug": "lowercase-kebab-case-topic",
  "topic": "specific topic",
  "heatScore": 0-100,
  "sourceQualityScore": 0-100,
  "sources": [
    { "url": "https://...", "title": "source title", "publisher": "publisher", "publishedAt": "YYYY-MM-DD", "reliabilityScore": 0-100 }
  ],
  "keyFacts": ["6-10 concise source-backed facts"],
  "cautions": ["2-4 caveats or uncertainty notes"]
}

Rules:
- Use at least 2 credible, currently accessible source URLs published on or after ${oldestAllowedDate}; this category prefers sources from within ${freshnessWindow.label}.
- Prioritize primary sources (official repos/releases, author posts, first-hand announcements) over aggregators.
${diversityRule}
- Every source must include its visible publication date as publishedAt in YYYY-MM-DD format.
- If the category is resources, the topic must be a practical AI resource: official free tiers/credits/grants, community open-source tools/datasets, credible third-party API relay or proxy services, tutorials, or courses. Exclude ordinary paid products, generic news, and low-credibility services.
- Keep the topic strictly in the requested category. Do not reuse one topic across multiple categories.
- Keep this fact pack compact. Do not write the full article yet.
- NEVER respond with explanations or refusals. ALWAYS return JSON.${existingSlugs.length > 0 ? `\n- IMPORTANT: The following topics have ALREADY been covered. You MUST choose a DIFFERENT topic. Existing slugs: ${existingSlugs.slice(0, 30).join(', ')}` : ''}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text, groundingSources } = await generateGroundedContent(config, getModelForCategory(category), prompt, {
        temperature: attempt === 1 ? 0.25 : 0.6,
        maxOutputTokens: 8192,
      });
      const facts = parseFactJson(text);
      const rawSources = Array.isArray(facts.sources) ? facts.sources : [];
      facts.sources = await crossCheckSources(rawSources, groundingSources);
      // Fail fast (and retry) when a hard-requirement category lacks a verified
      // social/code/blog source; soft categories only log.
      enforceSourceDiversity(facts.sources, category);
      return facts;
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unreachable');
}

async function generateDraftFromFactPack(
  config: VertexAIConfig,
  category: Exclude<Category, 'personal'>,
  facts: FactPack,
): Promise<GeneratedDraft> {
  const categoryConfig = CATEGORY_CONFIGS[category];
  const oldestAllowedDate = getOldestAllowedSourceDate(category).toISOString().slice(0, 10);
  const prompt = `Create one bilingual content group for ACP AI Research from this verified fact pack.

Category: ${category} (${categoryConfig.zhName} / ${categoryConfig.enName})
Fact pack JSON:
${JSON.stringify(facts, null, 2)}

Return only valid JSON using this exact shape:
{
  "canonicalSlug": "lowercase-kebab-case-topic",
  "category": "${category}",
  "heatScore": 0-100,
  "sourceQualityScore": 0-100,
  "sources": [
    { "url": "https://...", "title": "source title", "publisher": "publisher", "publishedAt": "YYYY-MM-DD", "reliabilityScore": 0-100 }
  ],
  "articles": [
    {
      "language": "zh",
      "title": "Chinese title",
      "slug": "lowercase-kebab-case-topic",
      "summary": "2 sentence Chinese summary",
      "contentMarkdown": "Full Markdown article with sections: ${categoryConfig.zhSections.join(', ')}. Do not copy source paragraphs verbatim.",
      "tags": ["AI", "..."],
      "readingTime": 4,
      "seoTitle": "Chinese SEO title under 60 chars",
      "seoDescription": "Chinese SEO description under 155 chars"
    },
    {
      "language": "en",
      "title": "English title",
      "slug": "lowercase-kebab-case-topic",
      "summary": "2 sentence English summary",
      "contentMarkdown": "Full Markdown article with sections: ${categoryConfig.enSections.join(', ')}. Do not copy source paragraphs verbatim.",
      "tags": ["AI", "..."],
      "readingTime": 4,
      "seoTitle": "English SEO title under 60 chars",
      "seoDescription": "English SEO description under 155 chars"
    }
  ]
}

Rules:
- Preserve the facts and source URLs from the fact pack.
- Preserve each source publishedAt date from the fact pack.
- The Sources/参考来源 section MUST cite ONLY the fact-pack sources above, in the same order, with the same publishedAt dates. Never add a new source, URL, publisher, or date that is not in the fact pack — in particular do NOT cite the original research paper, official repository, or any other primary source unless it is already in the fact pack.
- Every inline citation [1], [2], ... must map to exactly one fact-pack source; never use a number higher than the fact-pack source count, and never cite a source whose publishedAt is before ${oldestAllowedDate} (sources older than ${getFreshnessWindow(category).label} are not allowed in this category).
- Mention source publisher and publication date in the final Sources/参考来源 section.
- Chinese and English should convey the same facts naturally, not as literal translations.
- Keep claims cautious when sources are not definitive.
- Return only the JSON object. No markdown fences.

Markdown formatting rules for contentMarkdown:
- Use ### for each section heading. Each heading MUST be on its own line with a blank line before and after it.
- Use **text** for bold emphasis within paragraphs.
- Use * or - for unordered lists. Each list item on its own line.
- Use 1. 2. 3. for ordered lists.
- Separate paragraphs with blank lines.
- Reference sources inline as [1], [2], etc.
- Do NOT use # or ## headings (reserved for page-level titles).
${category === 'prompts' ? `
Additional mandatory rules for prompts:
- The Core Prompt/核心提示词 section MUST contain one complete reusable template inside a fenced code block marked text.
- Every replaceable input MUST use double-brace syntax such as {{topic}} or {{研究主题}}.
- State the intended model/tool and exact use case in the article.
- If this is a workflow, include at least 3 numbered steps under Workflow Steps/工作流步骤.
- Include explicit quality checks and failure conditions. Avoid vague advice and prompt-engineering hype.
- Add either "Prompt"/"提示词" or "Workflow"/"工作流" to the tags so the frontend can classify it.` : ''}`;

  for (let retry = 0; retry < 3; retry++) {
    try {
      return parseDraftJson(
        await generateContent(config, getModelForCategory(category), prompt, {
          useGrounding: false,
          temperature: retry === 0 ? 0.45 : 0.15,
          maxOutputTokens: 24576,
        }),
      );
    } catch (err) {
      if (retry === 2) throw err;
    }
  }
  throw new Error('Unreachable');
}

function parseFactJson(response: string): FactPack {
  return parseJsonObject(response) as FactPack;
}

function parseDraftJson(response: string): GeneratedDraft {
  return parseJsonObject(response) as GeneratedDraft;
}

function parseJsonObject(response: string): unknown {
  const stripped = stripThinkingBlocks(response)
    .replace(/｛/g, '{').replace(/｝/g, '}')
    .replace(/［/g, '[').replace(/］/g, ']')
    .replace(/“|”/g, '"');
  const jsonStart = stripped.indexOf('{');
  if (jsonStart < 0) {
    throw new Error(`Vertex AI did not return JSON (len=${response.length}, parts may be thought-only). Response: ${response.slice(0, 500)}`);
  }

  // Find the matching closing } by scanning from the end (skip trailing ``` or other garbage)
  let jsonEnd = -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = jsonStart; i < stripped.length; i++) {
    const ch = stripped[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') { depth--; if (depth === 0) { jsonEnd = i; break; } }
  }

  const raw = jsonEnd > jsonStart ? stripped.slice(jsonStart, jsonEnd + 1) : stripped.slice(jsonStart);

  // Fast path: try parsing as-is
  try { return JSON.parse(raw); } catch {}

  // Use context-aware truncation to find valid JSON boundary
  const jsonStr = truncateToLastCompleteValue(raw);
  try { return JSON.parse(jsonStr); } catch {}

  // Repair pass: fix broken strings, trailing commas, then try again
  let repaired = repairBrokenJson(jsonStr);
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(repaired); } catch {}

  // Aggressive: close unclosed structures
  const closed = closeOpenStructures(repaired);
  try { return JSON.parse(closed); } catch {}

  // Last resort: truncate the repaired string again
  const finalAttempt = truncateToLastCompleteValue(repaired);
  try { return JSON.parse(finalAttempt); } catch {}

  throw new Error(`Vertex AI returned unparseable JSON after repair. Response: ${response.slice(0, 500)}`);
}

function stripThinkingBlocks(text: string): string {
  let result = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  if (result.trim().length < 10 && text.trim().length > 10) return text;
  return result;
}

function repairBrokenJson(json: string): string {
  let inString = false;
  let escapeNext = false;
  let result = '';
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escapeNext) {
      // Validate JSON escape sequences — fix invalid ones like \N, \a, etc.
      if ('"\\bfnrtu/'.includes(ch)) {
        result += ch;
      } else {
        // Invalid escape: double the backslash to make it literal
        result = result.slice(0, -1) + '\\\\' + ch;
      }
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) { result += ch; escapeNext = true; continue; }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        // Decide if this quote ends the string or is an unescaped internal quote
        const remaining = json.slice(i + 1).trimStart();
        if (remaining.length === 0 || ',:]}'.includes(remaining[0])) {
          inString = false;
          result += ch;
        } else {
          result += '\\"';
        }
      }
      continue;
    }
    if (inString) {
      if (ch === '\n') { result += '\\n'; }
      else if (ch === '\r') { result += '\\r'; }
      else if (ch === '\t') { result += '\\t'; }
      else if (ch.charCodeAt(0) >= 0 && ch.charCodeAt(0) <= 0x1f) { result += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'); }
      else { result += ch; }
      continue;
    }
    result += ch;
  }
  // If we ended inside an unclosed string, close it
  if (inString) result += '"';
  return result;
}

function closeOpenStructures(json: string): string {
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (const ch of json) {
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (stack.length > 0) {
    return json + stack.reverse().join('');
  }
  return json;
}

function truncateToLastCompleteValue(json: string): string {
  // Find the last position where a complete JSON value ended (after a quote, number, true/false/null, ] or })
  // Then close all open structures from that point
  let lastSafe = -1;
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"' && !inStr) { inStr = true; continue; }
    if (ch === '"' && inStr) {
      inStr = false;
      // Check if this closes a value (not a key — keys are followed by ':')
      const afterQuote = json.slice(i + 1).trimStart();
      if (afterQuote.length === 0 || afterQuote[0] === ',' || afterQuote[0] === '}' || afterQuote[0] === ']') {
        lastSafe = i;
      }
      continue;
    }
    if (inStr) continue;
    if (ch === '{') { stack.push('}'); continue; }
    if (ch === '[') { stack.push(']'); continue; }
    if (ch === '}' || ch === ']') { stack.pop(); lastSafe = i; continue; }
  }
  if (lastSafe < 0) lastSafe = json.length;
  let result = json.slice(0, lastSafe + 1);
  // Remove any trailing comma
  result = result.replace(/,\s*$/, '');
  // Re-scan to close open structures
  let depth = 0;
  const closers: string[] = [];
  inStr = false;
  esc = false;
  for (const ch of result) {
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') { closers.push('}'); depth++; }
    else if (ch === '[') { closers.push(']'); depth++; }
    else if (ch === '}' || ch === ']') { closers.pop(); depth--; }
  }
  return result + closers.reverse().join('');
}

/**
 * Guard against the prose pass inventing out-of-window references in the article
 * body. The fact-pack `sources` array is date-validated, but the ungrounded prose
 * pass writes the reference section itself and can add a source that was never in
 * the fact pack. We scan the reference section (the last 参考来源/Sources heading)
 * for dates older than the category's freshness window, and reject inline citations
 * that exceed the number of listed reference entries. Throwing forces the
 * generateDraftFromFactPack retry loop to rewrite the article.
 */
function assertArticleReferencesFresh(contentMarkdown: string, category: Exclude<Category, 'personal'>): void {
  const oldestAllowedDate = getOldestAllowedSourceDate(category).toISOString().slice(0, 10);
  const refIdx = Math.max(contentMarkdown.lastIndexOf('参考来源'), contentMarkdown.lastIndexOf('### Sources'));
  if (refIdx < 0) {
    // No reference section heading: nothing to date-check, but the publish
    // validation requires sources anyway, so a missing section is caught elsewhere.
    return;
  }
  const section = contentMarkdown.slice(refIdx);

  const dates = section.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  for (const date of dates) {
    if (date < oldestAllowedDate) {
      throw new Error(`Article body references a source older than ${getFreshnessWindow(category).label}: ${date} < ${oldestAllowedDate}.`);
    }
  }

  // Every inline [N] must map to a listed reference entry; never cite more than listed.
  // Reference entries may be bulleted (* / -) or numbered (1. 2. 3.) lists.
  // NOTE: the /g flag is required — without it match() returns only the first hit.
  const refEntryCount = (section.match(/^\s*(?:\d+\.|[*-])\s/mg) ?? []).length;
  const maxInlineIndex = Math.max(0, ...(contentMarkdown.match(/\[(\d+)\]/g) ?? []).map((m) => Number(m.slice(1, -1))));
  if (refEntryCount > 0 && maxInlineIndex > refEntryCount) {
    throw new Error(`Article body cites [${maxInlineIndex}] but the reference section lists only ${refEntryCount} source(s).`);
  }
}

function normalizeDraft(draft: GeneratedDraft, requestedCategory: Exclude<Category, 'personal'>): GeneratedDraft {
  const category = requestedCategory;
  const canonicalSlug = slugify(draft.canonicalSlug || draft.articles?.[0]?.slug || draft.articles?.[0]?.title || `ai-research-${Date.now()}`);
  const sources = Array.isArray(draft.sources)
    ? draft.sources.slice(0, 6).map((source) => tryNormalizeSource(source, category)).filter((s): s is GeneratedSource => s !== null)
    : [];
  const articles = (Array.isArray(draft.articles) ? draft.articles : [])
    .filter((article) => article.language === 'zh' || article.language === 'en')
    .map((article) => normalizeArticle(article, canonicalSlug));

  // The fact-pack `sources` array is date-validated above, but the ungrounded prose
  // pass writes the reference section itself and can add a source that was never in
  // the fact pack (e.g. the original research paper, as happened with a 2025 GitHub
  // repo slipping into a prompts article). Guard the body as well.
  for (const article of articles) {
    assertArticleReferencesFresh(article.contentMarkdown, category);
  }

  const hasZh = articles.some((article) => article.language === 'zh');
  const hasEn = articles.some((article) => article.language === 'en');

  if (!hasZh || !hasEn) {
    throw new Error('Generated draft must include both zh and en articles.');
  }
  const minSources = category === 'news' ? 1 : 2;
  if (sources.length < minSources) {
    throw new Error(`Generated draft must include at least ${minSources} source(s).`);
  }
  // Re-check after date filtering, in case the verified platform source was dropped.
  enforceSourceDiversity(sources, category);

  return {
    canonicalSlug,
    category,
    heatScore: clampScore(draft.heatScore, 70),
    sourceQualityScore: clampScore(draft.sourceQualityScore, 75),
    articles,
    sources,
  };
}

function normalizeArticle(article: GeneratedArticle, fallbackSlug: string): GeneratedArticle {
  return {
    language: article.language,
    title: requiredText(article.title, `${article.language} title`),
    slug: slugify(article.slug || fallbackSlug),
    summary: requiredText(article.summary, `${article.language} summary`),
    contentMarkdown: requiredText(article.contentMarkdown, `${article.language} contentMarkdown`),
    tags: Array.isArray(article.tags) ? article.tags.map(String).filter(Boolean).slice(0, 8) : ['AI'],
    readingTime: Math.max(1, Math.min(20, Math.round(Number(article.readingTime) || 4))),
    seoTitle: requiredText(article.seoTitle || article.title, `${article.language} seoTitle`),
    seoDescription: requiredText(article.seoDescription || article.summary, `${article.language} seoDescription`),
  };
}

function normalizeSource(source: GeneratedSource, category: Exclude<Category, 'personal'>): GeneratedSource {
  const publishedAt = normalizeRecentDate(source.publishedAt, 'source publishedAt', category);
  return {
    url: requiredText(source.url, 'source url'),
    title: requiredText(source.title, 'source title'),
    publisher: source.publisher ? String(source.publisher) : 'Unknown',
    publishedAt,
    reliabilityScore: clampScore(source.reliabilityScore, 75),
    platform: source.platform ?? classifyPlatform(source.url),
    redirectUrl: source.redirectUrl ?? null,
    groundingVerified: Boolean(source.groundingVerified),
    urlResolved: source.urlResolved ?? true,
  };
}

function tryNormalizeSource(source: GeneratedSource, category: Exclude<Category, 'personal'>): GeneratedSource | null {
  try {
    return normalizeSource(source, category);
  } catch {
    return null;
  }
}

async function saveDraft(db: D1Database, draft: GeneratedDraft): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const contentGroupId = `group-${draft.canonicalSlug}-${suffix}`;
  const canonicalSlug = `${draft.canonicalSlug}-${suffix}`;

  const statements = [
    db
      .prepare('INSERT INTO content_groups (id, canonical_slug, category, status, heat_score, source_quality_score) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(contentGroupId, canonicalSlug, draft.category, 'needs_review', draft.heatScore, draft.sourceQualityScore),
    ...draft.articles.map((article) =>
      db
        .prepare(
          `INSERT INTO articles (id, content_group_id, language, title, slug, summary, content_markdown, tags_json, reading_time, seo_title, seo_description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `article-${article.language}-${canonicalSlug}`,
          contentGroupId,
          article.language,
          article.title,
          `${article.slug}-${suffix}`,
          article.summary,
          article.contentMarkdown,
          JSON.stringify(article.tags),
          article.readingTime,
          article.seoTitle,
          article.seoDescription,
        ),
    ),
    ...draft.sources.map((source, index) =>
      db
        .prepare('INSERT INTO sources (id, content_group_id, url, title, publisher, published_at, source_type, reliability_score, redirect_url, grounding_verified, url_resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(
          `source-${canonicalSlug}-${index + 1}`,
          contentGroupId,
          source.url,
          source.title,
          source.publisher,
          source.publishedAt,
          source.platform ?? 'web',
          source.reliabilityScore,
          source.redirectUrl ?? null,
          source.groundingVerified ? 1 : 0,
          source.urlResolved === false ? 0 : 1,
        ),
    ),
    db
      .prepare("INSERT INTO generation_jobs (id, job_type, status, started_at, finished_at, model_provider, model_name, input_summary, created_content_group_ids_json) VALUES (?, 'daily_generate', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'vertex-ai', ?, ?, ?)")
      .bind(`job-${canonicalSlug}`, getModelForCategory(draft.category as Exclude<Category, 'personal'>), `Generated draft for ${draft.canonicalSlug} [${draft.category}]`, JSON.stringify([contentGroupId])),
  ];

  await db.batch(statements);
  return contentGroupId;
}

function requiredText(value: unknown, fieldName: string): string {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(`Generated draft is missing ${fieldName}.`);
  }
  return text;
}

function clampScore(value: unknown, fallback: number): number {
  const score = Math.round(Number(value));
  if (!Number.isFinite(score)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, score));
}

function getFreshnessWindow(category: Exclude<Category, 'personal'>): { label: string } {
  if (category === 'news') return { label: '7 days' };
  if (category === 'resources') return { label: '4 months' };
  if (category === 'prompts') return { label: '3 months' };
  return { label: '6 months' };
}

function getOldestAllowedSourceDate(category: Exclude<Category, 'personal'>): Date {
  const date = new Date();
  if (category === 'news') {
    date.setUTCDate(date.getUTCDate() - 7);
  } else if (category === 'resources') {
    date.setUTCMonth(date.getUTCMonth() - 4);
  } else if (category === 'prompts') {
    date.setUTCMonth(date.getUTCMonth() - 3);
  } else {
    date.setUTCMonth(date.getUTCMonth() - 6);
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function normalizeRecentDate(value: unknown, fieldName: string, category: Exclude<Category, 'personal'>): string {
  const text = requiredText(value, fieldName).slice(0, 10);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Generated draft has invalid ${fieldName}: ${String(value)}`);
  }
  if (date < getOldestAllowedSourceDate(category)) {
    throw new Error(`Generated draft source is older than ${getFreshnessWindow(category).label}: ${text}.`);
  }
  return text;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || `ai-research-${Date.now()}`;
}

function formatGenerationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('internal error; reference =')) {
    return `${message}. In local Wrangler, this can be caused by workerd outbound proxy/TLS handling. Try npm run generate:local as a local fallback, or run in deployed Cloudflare with configured secrets.`;
  }
  return message;
}
