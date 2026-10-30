import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const CATEGORY_CONFIGS = {
  news: {
    zhName: 'AI新闻',
    enName: 'AI News',
    description:
      'Specific recent AI news from the past 24-48 hours: model releases, company announcements, funding, policy, product launches, or industry developments.',
    guidance:
      'Find one significant, verifiable AI news event from today or the past 48 hours. Focus on concrete details and practical impact.',
    zhSections: ['核心事件', '背景', '影响分析', '行业反应', '参考来源'],
    enSections: ['Key Event', 'Background', 'Impact Analysis', 'Industry Reactions', 'Sources'],
  },
  tools: {
    zhName: 'AI工具评测',
    enName: 'AI Tool Reviews',
    description: 'Evaluation of an active or recently updated AI tool/platform/developer product.',
    guidance:
      'Find one AI tool or platform recently launched, updated, or gaining traction. Evaluate capabilities, users, pricing, limits, and alternatives.',
    zhSections: ['工具概览', '核心功能', '适用场景', '优劣势分析', '定价与替代方案', '参考来源'],
    enSections: ['Tool Overview', 'Core Features', 'Use Cases', 'Pros and Cons', 'Pricing and Alternatives', 'Sources'],
  },
  resources: {
    zhName: 'AI资源',
    enName: 'AI Resources',
    description:
      'Practical AI freebie resources available now: free credits, grants, redeemable coupons, free tiers, open-source tools, datasets, or courses with no-cost access.',
    guidance:
      'Find one AI resource that users can actually claim, redeem, use for free, or access at no cost today. Prioritize free credits, grants, coupons, free API quotas, open-source models/tools, datasets, and courses. Exclude ordinary paid products, generic product news, and non-claimable announcements.',
    zhSections: ['资源概览', '主要内容', '使用方式', '注意事项', '参考来源'],
    enSections: ['Resource Overview', 'Key Content', 'How to Use', 'Notes and Caveats', 'Sources'],
  },
  research: {
    zhName: '深度研究',
    enName: 'Deep Research',
    description:
      'Deep analysis of an AI concept, paradigm, architecture, or methodology, not a one-off news report.',
    guidance:
      'Choose an important AI concept or technical pattern. Analyze how it works, why it matters, practical value, and limitations, using current sources.',
    zhSections: ['核心结论', '概念背景', '技术原理', '关键演进', '实用价值', '风险与限制', '参考来源'],
    enSections: ['Core Takeaway', 'Concept Background', 'Technical Principles', 'Key Evolution', 'Practical Value', 'Risks and Limits', 'Sources'],
  },
  prompts: {
    zhName: '高质量提示词与工作流',
    enName: 'High-quality Prompts and Workflows',
    description: 'Reusable, source-backed prompt templates and reproducible AI workflows with clear variables, steps, constraints, and quality checks.',
    guidance: 'Find a recently documented prompting technique or practical AI workflow from official documentation, a credible repository, or an experienced practitioner. Produce one concrete reusable template rather than generic tips.',
    zhSections: ['适用场景', '核心提示词', '工作流步骤', '变量说明', '使用方法', '质量检查', '参考来源'],
    enSections: ['Best for', 'Core Prompt', 'Workflow Steps', 'Variables', 'How to Use', 'Quality Checks', 'Sources'],
  },
};

const allCategories = ['news', 'tools', 'resources', 'research', 'prompts'];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { categories: allCategories, dryRun: false, topic: undefined };
  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      const category = arg.slice('--category='.length);
      if (!allCategories.includes(category)) throw new Error(`Unsupported category: ${category}`);
      options.categories = [category];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--topic=')) {
      options.topic = arg.slice('--topic='.length);
    }
  }
  return options;
}

function loadEnvFile() {
  const text = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function loadServiceAccount() {
  if (fs.existsSync('service-account-key.json')) {
    return JSON.parse(fs.readFileSync('service-account-key.json', 'utf8'));
  }

  const keyJson = process.env.GOOGLE_SA_KEY_JSON || env.GOOGLE_SA_KEY_JSON;
  if (!keyJson) {
    throw new Error('Missing service-account-key.json or GOOGLE_SA_KEY_JSON.');
  }
  return JSON.parse(keyJson);
}

const env = loadEnvFile();
const serviceAccount = loadServiceAccount();
const location = env.GOOGLE_CLOUD_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const project = env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || serviceAccount.project_id;
const MODEL = 'gemini-3.6-flash';
// gemini-3.6-flash is global-endpoint only
const endpoint = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${MODEL}:generateContent`;
let cachedToken = null;
let tokenExpiresAt = 0;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiresAt - 60) return cachedToken;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), serviceAccount.private_key).toString('base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);

  cachedToken = data.access_token;
  tokenExpiresAt = now + Number(data.expires_in || 3600);
  return cachedToken;
}

async function vertex(prompt, options = {}) {
  const { grounding = false, json = false, maxOutputTokens = 8192, temperature = 0.4 } = options;
  const generationConfig = { temperature, maxOutputTokens };
  if (json) generationConfig.responseMimeType = 'application/json';

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (grounding) body.tools = [{ googleSearch: {} }];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await getAccessToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Vertex AI ${res.status}: ${raw.slice(0, 1000)}`);

  const data = JSON.parse(raw);
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const responseParts = parts.filter((p) => !p.thought);
  const text = (responseParts.length > 0 ? responseParts : parts).map((p) => p.text || '').join('');

  const groundingSources = [];
  const seen = new Set();
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const redirectUrl = String(chunk.web?.uri ?? '').trim();
    const domain = String(chunk.web?.domain ?? chunk.web?.title ?? '').trim().toLowerCase();
    if (!redirectUrl && !domain) continue;
    const key = redirectUrl || domain;
    if (seen.has(key)) continue;
    seen.add(key);
    groundingSources.push({ redirectUrl, domain, resolvedUrl: null });
  }
  return { text, groundingSources };
}

// --- Google Search grounding provenance (mirrors src/lib/generation.ts) ---

const REQUIRED_PLATFORMS = ['social', 'code', 'blog'];
const HIGH_CONFIDENCE_MIN = 70;
const HARD_DIVERSITY_CATEGORIES = ['news', 'tools'];
const KNOWN_AI_BLOG_DOMAINS = [
  'karpathy.ai', 'lilianweng.github.io', 'simonwillison.net', 'jalammar.github.io',
  'huyenchip.com', 'sebastianraschka.com', 'magazine.sebastianraschka.com', 'colah.github.io',
  'distill.pub', 'thegradient.pub', 'interconnects.ai', 'oneusefulthing.org',
  'eugeneyan.com', 'hamel.dev', 'bair.berkeley.edu', 'newsletter.maartengrootendorst.com',
];

function extractDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return '';
  }
}

function domainsMatch(a, b) {
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function classifyPlatform(url) {
  const domain = extractDomain(url);
  if (!domain) return 'web';
  if (/^(.+\.)?(x\.com|twitter\.com|reddit\.com)$/.test(domain) || domain.includes('nitter.')) return 'social';
  if (KNOWN_AI_BLOG_DOMAINS.some((blog) => domainsMatch(domain, blog))) return 'blog';
  if (/^(.+\.)?(github\.com|github\.io|gitlab\.com|huggingface\.co)$/.test(domain)) return 'code';
  return 'web';
}

function isHighConfidencePlatformSource(source) {
  // groundingVerified intentionally not required — see src/lib/generation.ts.
  return REQUIRED_PLATFORMS.includes(source.platform) && source.reliabilityScore >= HIGH_CONFIDENCE_MIN;
}

async function resolveGroundingRedirect(redirectUrl) {
  if (!redirectUrl) return null;
  try {
    const res = await fetch(redirectUrl, { method: 'HEAD', redirect: 'manual' });
    const location = res.headers.get('location');
    if (location) return location;
    if (res.url && res.url !== redirectUrl) return res.url;
  } catch {}
  try {
    const res = await fetch(redirectUrl, { method: 'GET', redirect: 'follow' });
    if (res.url && res.url !== redirectUrl) return res.url;
  } catch {}
  return null;
}

async function crossCheckSources(sources, grounding) {
  const pool = grounding.filter((g) => g.domain);
  const result = [];
  for (const source of sources) {
    const domain = extractDomain(source.url);
    const idx = pool.findIndex((g) => domainsMatch(domain, g.domain));
    if (idx < 0) {
      result.push({ ...source, platform: classifyPlatform(source.url), redirectUrl: null, groundingVerified: false, urlResolved: true });
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
      urlResolved: Boolean(resolved),
    });
  }
  return result;
}

function enforceSourceDiversity(sources, category) {
  if (sources.some(isHighConfidencePlatformSource)) return;
  const message = `Category ${category} has no high-confidence source (reliability >= ${HIGH_CONFIDENCE_MIN}) from X/Reddit, GitHub/Hugging Face, or a known AI blog.`;
  if (HARD_DIVERSITY_CATEGORIES.includes(category)) {
    throw new Error(`${message} Skipping so we can retry with a better source mix.`);
  }
  console.warn(`[generation] ${message} (soft preference for ${category}; keeping draft.)`);
}

function parseJson(text) {
  const stripped = stripThinkingBlocks(text);
  const trimmed = stripped.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  if (start < 0) throw new Error(`Vertex AI did not return JSON: ${trimmed.slice(0, 240)}`);

  const raw = trimmed.slice(start);

  // Fast path: try parsing as-is
  try { return JSON.parse(raw); } catch {}

  // Use context-aware truncation to find valid JSON boundary
  const jsonStr = truncateToLastCompleteValue(raw);
  try { return JSON.parse(jsonStr); } catch {}

  // Repair pass: fix broken strings, trailing commas, then try again
  let repaired = repairJsonString(jsonStr);
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(repaired); } catch {}

  // Close unclosed structures
  const closed = closeOpenStructures(repaired);
  try { return JSON.parse(closed); } catch {}

  // Last resort: truncate the repaired string again
  const finalAttempt = truncateToLastCompleteValue(repaired);
  try { return JSON.parse(finalAttempt); } catch {}

  throw new Error('Vertex AI returned unparseable JSON after all repairs');
}

function closeOpenStructures(json) {
  const stack = [];
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
  if (stack.length > 0) return json + stack.reverse().join('');
  return json;
}

function truncateToLastCompleteValue(json) {
  let lastSafe = -1;
  let inStr = false;
  let esc = false;
  const stack = [];
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"' && !inStr) { inStr = true; continue; }
    if (ch === '"' && inStr) {
      inStr = false;
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
  let result = json.slice(0, lastSafe + 1).replace(/,\s*$/, '');
  const closers = [];
  inStr = false;
  esc = false;
  for (const ch of result) {
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') closers.push('}');
    else if (ch === '[') closers.push(']');
    else if (ch === '}' || ch === ']') closers.pop();
  }
  return result + closers.reverse().join('');
}

function stripThinkingBlocks(text) {
  var result = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  result = result.replace(/<response>[\s\S]*?<\/response>/gi, '');
  if (result.trim().length < 10 && text.trim().length > 10) return text;
  return result;
}


function repairJsonString(json) {
  let inString = false;
  let escapeNext = false;
  let result = '';
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escapeNext) {
      if ('"\\bfnrtu/'.includes(ch)) {
        result += ch;
      } else {
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
  if (inString) result += '"';
  return result;
}

function slugify(value) {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || `ai-research-${Date.now()}`;
}

function clampScore(value, fallback) {
  const score = Math.round(Number(value));
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, score));
}

function getFreshnessWindow(category) {
  if (category === 'news') return { label: '7 days' };
  if (category === 'resources') return { label: '4 months' };
  if (category === 'prompts') return { label: '3 months' };
  return { label: '6 months' };
}

function getOldestAllowedSourceDate(category) {
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

function normalizeRecentDate(value, field, category) {
  const text = requiredText(value, field).slice(0, 10);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Generated draft has invalid ${field}: ${String(value)}`);
  if (date < getOldestAllowedSourceDate(category)) throw new Error(`Generated draft source is older than ${getFreshnessWindow(category).label}: ${text}.`);
  return text;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`Generated draft is missing ${field}.`);
  return text;
}

function normalizeSources(rawSources, category) {
  return (Array.isArray(rawSources) ? rawSources : []).slice(0, 6).map((source) => ({
    url: requiredText(source.url, 'source url'),
    title: requiredText(source.title, 'source title'),
    publisher: String(source.publisher || 'Unknown'),
    publishedAt: normalizeRecentDate(source.publishedAt, 'source publishedAt', category),
    reliabilityScore: clampScore(source.reliabilityScore, 75),
    platform: source.platform || classifyPlatform(source.url),
    redirectUrl: source.redirectUrl || null,
    groundingVerified: Boolean(source.groundingVerified),
    urlResolved: source.urlResolved === false ? false : true,
  }));
}

function assertArticleReferencesFresh(contentMarkdown, category) {
  const oldestAllowedDate = getOldestAllowedSourceDate(category).toISOString().slice(0, 10);
  const refIdx = Math.max(contentMarkdown.lastIndexOf('参考来源'), contentMarkdown.lastIndexOf('### Sources'));
  if (refIdx < 0) return;
  const section = contentMarkdown.slice(refIdx);

  const dates = section.match(/\d{4}-\d{2}-\d{2}/g) || [];
  for (const date of dates) {
    if (date < oldestAllowedDate) {
      throw new Error(`Article body references a source older than ${getFreshnessWindow(category).label}: ${date} < ${oldestAllowedDate}.`);
    }
  }

  // Reference entries may be bulleted (* / -) or numbered (1. 2. 3.) lists.
  // NOTE: the /g flag is required — without it match() returns only the first hit.
  const refEntryCount = (section.match(/^\s*(?:\d+\.|[*-])\s/mg) || []).length;
  const maxInlineIndex = Math.max(0, ...(contentMarkdown.match(/\[(\d+)\]/g) || []).map((m) => Number(m.slice(1, -1))));
  if (refEntryCount > 0 && maxInlineIndex > refEntryCount) {
    throw new Error(`Article body cites [${maxInlineIndex}] but the reference section lists only ${refEntryCount} source(s).`);
  }
}

function normalizeDraft(draft, category) {
  const canonicalSlug = slugify(draft.canonicalSlug || draft.topic || draft.articles?.[0]?.title || `${category}-${Date.now()}`);
  const sources = normalizeSources(draft.sources, category);
  const articles = (Array.isArray(draft.articles) ? draft.articles : [])
    .filter((article) => article.language === 'zh' || article.language === 'en')
    .map((article) => ({
      language: article.language,
      title: requiredText(article.title, `${article.language} title`),
      slug: slugify(article.slug || canonicalSlug),
      summary: requiredText(article.summary, `${article.language} summary`),
      contentMarkdown: requiredText(article.contentMarkdown, `${article.language} contentMarkdown`),
      tags: Array.isArray(article.tags) ? article.tags.map(String).filter(Boolean).slice(0, 8) : ['AI'],
      readingTime: Math.max(1, Math.min(20, Math.round(Number(article.readingTime) || 5))),
      seoTitle: requiredText(article.seoTitle || article.title, `${article.language} seoTitle`),
      seoDescription: requiredText(article.seoDescription || article.summary, `${article.language} seoDescription`),
    }));

  for (const article of articles) {
    assertArticleReferencesFresh(article.contentMarkdown, category);
  }

  var minSources = category === 'news' ? 1 : 2;
  if (sources.length < minSources) throw new Error('Generated draft must include at least ' + minSources + ' source(s).');
  if (!articles.some((article) => article.language === 'zh') || !articles.some((article) => article.language === 'en')) {
    throw new Error('Generated draft must include both zh and en articles.');
  }
  enforceSourceDiversity(sources, category);

  return {
    canonicalSlug,
    category,
    heatScore: clampScore(draft.heatScore, 70),
    sourceQualityScore: clampScore(draft.sourceQualityScore, 75),
    sources,
    articles,
  };
}

async function generateFacts(category, topic) {
  const config = CATEGORY_CONFIGS[category];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const freshnessWindow = getFreshnessWindow(category);
  const oldestAllowedDate = getOldestAllowedSourceDate(category).toISOString().slice(0, 10);
  const diversityRule = HARD_DIVERSITY_CATEGORIES.includes(category)
    ? ` MANDATORY source mix: at least ONE source MUST be a high-credibility primary source that Google Search actually returns, from ONE of: an X/Twitter or Reddit post (e.g. r/MachineLearning, r/LocalLLaMA), a GitHub or Hugging Face repo/release page, OR a well-known individual AI researcher blog (e.g. Simon Willison, Lilian Weng, Sebastian Raschka, Andrej Karpathy, Chip Huyen). Must be real and accessible; do NOT fabricate it.`
    : ` STRONGLY PREFER to also include one primary source from X/Twitter or Reddit, GitHub or Hugging Face, or a well-known individual AI researcher blog, alongside news outlets.`;
  const prompt = `Use Google Search to find current real information for ACP AI Research. Today is ${today}. Oldest allowed source publication date is ${oldestAllowedDate}.
Category: ${category} (${config.zhName}/${config.enName}). ${config.description}
Task: ${topic || config.guidance}
IMPORTANT: Reply with RAW JSON only. No markdown fences, no thinking tags, no explanations. Start with { and end with }.
Return compact JSON only with: canonicalSlug, topic, heatScore, sourceQualityScore, sources (2-5 real URLs with title/publisher/publishedAt YYYY-MM-DD/reliabilityScore), keyFacts (6-10 concise bullet strings), cautions (2-4 strings).
Rules: every source must be published on or after ${oldestAllowedDate}; this category requires sources from within ${freshnessWindow.label}; every source must include publishedAt; prioritize primary sources over aggregators;${diversityRule} keep the topic strictly in the requested category; do not reuse one topic across multiple categories. If category is resources, only choose claimable or no-cost AI resources such as free credits, grants, coupons, free tiers/API quotas, open-source models/tools, datasets, or courses. Avoid long prose.`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { text, groundingSources } = await vertex(prompt, { grounding: true, maxOutputTokens: 8192, temperature: attempt === 1 ? 0.25 : 0.6 });
      const facts = parseJson(text);
      facts.sources = await crossCheckSources(Array.isArray(facts.sources) ? facts.sources : [], groundingSources);
      enforceSourceDiversity(facts.sources, category);
      return facts;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

async function generateDraft(category, facts) {
  const config = CATEGORY_CONFIGS[category];
  const oldestAllowedDate = getOldestAllowedSourceDate(category).toISOString().slice(0, 10);
  const prompt = `Create a bilingual ACP AI Research draft from this verified fact pack. Return valid JSON only.

Category: ${category} (${config.zhName}/${config.enName})
Fact pack JSON:
${JSON.stringify(facts, null, 2)}

Return shape exactly:
{ "canonicalSlug":"...", "category":"${category}", "heatScore":0, "sourceQualityScore":0, "sources":[{"url":"...","title":"...","publisher":"...","publishedAt":"YYYY-MM-DD","reliabilityScore":0}], "articles":[{"language":"zh","title":"...","slug":"...","summary":"...","contentMarkdown":"...","tags":["AI"],"readingTime":5,"seoTitle":"...","seoDescription":"..."},{"language":"en","title":"...","slug":"...","summary":"...","contentMarkdown":"...","tags":["AI"],"readingTime":5,"seoTitle":"...","seoDescription":"..."}] }

Chinese article sections: ${config.zhSections.join(', ')}. English article sections: ${config.enSections.join(', ')}. Each article should be substantive, cautious, source-backed, and natural in its language. Preserve each source publishedAt date. Do not copy source text. Include source publisher and publication date in the final source notes section.
The Sources/参考来源 section MUST cite ONLY the fact-pack sources above, in the same order, with the same publishedAt dates. Never add a new source, URL, publisher, or date that is not in the fact pack — in particular do NOT cite the original research paper, official repository, or any other primary source unless it is already in the fact pack. Every inline citation [1], [2], ... must map to exactly one fact-pack source; never use a number higher than the fact-pack source count, and never cite a source published before ${oldestAllowedDate} (sources older than ${getFreshnessWindow(category).label} are not allowed in this category).

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
- Core Prompt/核心提示词 MUST contain one complete reusable template in a fenced code block marked text.
- Every replaceable input uses double braces, for example {{topic}} or {{研究主题}}.
- Name the intended model/tool and use case.
- Workflows include at least 3 numbered steps.
- Include quality checks and failure conditions.
- Add Prompt/提示词 or Workflow/工作流 to tags.` : ''}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { text } = await vertex(prompt, { json: true, maxOutputTokens: 24576, temperature: attempt === 1 ? 0.45 : 0.2 });
      const draft = normalizeDraft(parseJson(text), category);
      // Grounded fact-pack sources carry real provenance; the ungrounded rewrite only
      // touches prose, so re-apply the fact-pack sources over the draft's rewritten ones.
      if (Array.isArray(facts.sources) && facts.sources.length > 0) {
        draft.sources = normalizeSources(facts.sources, category);
        enforceSourceDiversity(draft.sources, category);
      }
      return draft;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

async function generateCategories(options) {
  const drafts = [];
  for (const category of options.categories) {
    const facts = await generateFacts(category, options.topic);
    const draft = await generateDraft(category, facts);
    drafts.push(draft);
  }
  return drafts;
}

function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function makeSql(drafts) {
  const lines = ['BEGIN TRANSACTION;'];

  for (const draft of drafts) {
    const suffix = crypto.randomUUID().slice(0, 8);
    const contentGroupId = `group-${draft.canonicalSlug}-${suffix}`;
    const canonicalSlug = `${draft.canonicalSlug}-${suffix}`;
    draft.contentGroupId = contentGroupId;
    draft.savedCanonicalSlug = canonicalSlug;

    lines.push(
      `INSERT INTO content_groups (id, canonical_slug, category, status, heat_score, source_quality_score) VALUES (${sqlString(contentGroupId)}, ${sqlString(canonicalSlug)}, ${sqlString(draft.category)}, 'needs_review', ${draft.heatScore}, ${draft.sourceQualityScore});`,
    );

    for (const article of draft.articles) {
      lines.push(
        `INSERT INTO articles (id, content_group_id, language, title, slug, summary, content_markdown, tags_json, reading_time, seo_title, seo_description) VALUES (${sqlString(`article-${article.language}-${canonicalSlug}`)}, ${sqlString(contentGroupId)}, ${sqlString(article.language)}, ${sqlString(article.title)}, ${sqlString(`${article.slug}-${suffix}`)}, ${sqlString(article.summary)}, ${sqlString(article.contentMarkdown)}, ${sqlString(JSON.stringify(article.tags))}, ${article.readingTime}, ${sqlString(article.seoTitle)}, ${sqlString(article.seoDescription)});`,
      );
    }

    draft.sources.forEach((source, index) => {
      lines.push(
        `INSERT INTO sources (id, content_group_id, url, title, publisher, published_at, source_type, reliability_score, redirect_url, grounding_verified, url_resolved) VALUES (${sqlString(`source-${canonicalSlug}-${index + 1}`)}, ${sqlString(contentGroupId)}, ${sqlString(source.url)}, ${sqlString(source.title)}, ${sqlString(source.publisher)}, ${sqlString(source.publishedAt)}, ${sqlString(source.platform || 'web')}, ${source.reliabilityScore}, ${source.redirectUrl ? sqlString(source.redirectUrl) : 'NULL'}, ${source.groundingVerified ? 1 : 0}, ${source.urlResolved === false ? 0 : 1});`,
      );
    });

    lines.push(
      `INSERT INTO generation_jobs (id, job_type, status, started_at, finished_at, model_provider, model_name, input_summary, created_content_group_ids_json) VALUES (${sqlString(`job-${canonicalSlug}`)}, 'daily_generate', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'vertex-ai', 'gemini-3.6-flash', ${sqlString(`Generated local fallback draft for ${draft.canonicalSlug} [${draft.category}]`)}, ${sqlString(JSON.stringify([contentGroupId]))});`,
    );
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

const options = parseArgs();
const drafts = await generateCategories(options);

if (!options.dryRun) {
  const sqlPath = '.codex-local-generation.sql';
  fs.writeFileSync(sqlPath, makeSql(drafts), 'utf8');
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'acp_ai_research', '--local', '--file', sqlPath], { stdio: 'ignore', shell: true });
}

const contentGroupIds = drafts.map((draft) => draft.contentGroupId).filter(Boolean);
console.log(
  JSON.stringify(
    {
      provider: 'vertex-ai',
      createdDrafts: options.dryRun ? 0 : drafts.reduce((sum, draft) => sum + draft.articles.length, 0),
      contentGroupIds: contentGroupIds.length ? contentGroupIds : undefined,
      previews: options.dryRun ? drafts : undefined,
      message: options.dryRun
        ? `Local fallback generated ${drafts.length} categories in dryRun mode.`
        : `Local fallback generated ${drafts.length} categories with ${drafts.reduce((sum, draft) => sum + draft.articles.length, 0)} articles total.`,
    },
    null,
    2,
  ),
);
