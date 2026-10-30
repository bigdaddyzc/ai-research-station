// cache-bust: 20260704210321
import { getRuntimeEnv } from './env';
import { sampleArticles, sampleGroups, samplePersonalResources, sampleSources } from './sample-data';
import type { AdminDraftGroup, Article, ArticleClaim, ArticleEntity, ArticleFaq, ArticleUpdate, Category, ContentGroup, FeedbackStatus, FeedbackSubmission, Language, PersonalResource, ResearchArtifacts, Source } from './types';

export async function getDb(locals: App.Locals): Promise<D1Database | undefined> {
  return (await getRuntimeEnv(locals)).DB;
}

export async function listArticles(db: D1Database | undefined, language: Language, options: { category?: Category; status?: 'published' | 'needs_review' | 'draft'; limit?: number } = {}): Promise<Article[]> {
  const status = options.status ?? 'published';
  if (!db) {
    return sampleArticles
      .filter((article) => article.language === language)
      .filter((article) => !options.category || article.category === options.category)
      .filter((article) => article.status === status)
      .filter((article) => status !== 'published' || isSampleArticleFresh(article))
      .sort(compareArticlesByDateDesc)
      .slice(0, options.limit ?? 20);
  }

  const filters = ['a.language = ?'];
  const params: unknown[] = [language];

  if (options.category) {
    filters.push('g.category = ?');
    params.push(options.category);
  }

  filters.push('g.status = ?');
  params.push(status);

  if (status === 'published') {
    filters.push("COALESCE(g.published_at, g.created_at) >= CASE WHEN g.category = 'news' THEN date('now', '-7 days') WHEN g.category = 'resources' THEN date('now', '-4 months') WHEN g.category = 'prompts' THEN date('now', '-3 months') ELSE date('now', '-6 months') END");
    filters.push("(SELECT COUNT(*) FROM sources s WHERE s.content_group_id = g.id) >= 2");
    filters.push("NOT EXISTS (SELECT 1 FROM sources s WHERE s.content_group_id = g.id AND (s.published_at IS NULL OR s.published_at = '' OR s.published_at < CASE WHEN g.category = 'news' THEN date('now', '-7 days') WHEN g.category = 'resources' THEN date('now', '-4 months') WHEN g.category = 'prompts' THEN date('now', '-3 months') ELSE date('now', '-6 months') END))");
  }

  const result = await db
    .prepare(
      `SELECT a.*, g.category, g.status, g.heat_score, g.source_quality_score, g.published_at
       FROM articles a
       JOIN content_groups g ON g.id = a.content_group_id
       WHERE ${filters.join(' AND ')}
       ORDER BY COALESCE(g.published_at, g.created_at) DESC, g.heat_score DESC
       LIMIT ?`,
    )
    .bind(...params, options.limit ?? 20)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map(mapArticle);
}

export async function getArticleBySlug(db: D1Database | undefined, language: Language, slug: string): Promise<Article | null> {
  if (!db) {
    return sampleArticles.find((article) => article.language === language && article.slug === slug && article.status === 'published') ?? null;
  }

  const row = await db
    .prepare(
      `SELECT a.*, g.category, g.status, g.heat_score, g.source_quality_score, g.published_at
       FROM articles a
       JOIN content_groups g ON g.id = a.content_group_id
       WHERE a.language = ? AND a.slug = ? AND g.status = 'published'
       LIMIT 1`,
    )
    .bind(language, slug)
    .first<Record<string, unknown>>();

  return row ? mapArticle(row) : null;
}

export async function getSourcesForGroup(db: D1Database | undefined, contentGroupId: string): Promise<Source[]> {
  if (!db) {
    return sampleSources.filter((source) => source.contentGroupId === contentGroupId);
  }

  const result = await db
    .prepare('SELECT * FROM sources WHERE content_group_id = ? ORDER BY reliability_score DESC')
    .bind(contentGroupId)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map(mapSource);
}

export async function getResearchArtifactsForArticle(db: D1Database | undefined, articleId: string): Promise<ResearchArtifacts> {
  const empty: ResearchArtifacts = { claims: [], faqs: [], entities: [], updates: [] };
  if (!db) return empty;

  try {
    const [claims, faqs, entities, updates] = await Promise.all([
      db.prepare('SELECT * FROM article_claims WHERE article_id = ? ORDER BY sort_order ASC, created_at ASC').bind(articleId).all<Record<string, unknown>>(),
      db.prepare('SELECT * FROM article_faqs WHERE article_id = ? ORDER BY sort_order ASC, created_at ASC').bind(articleId).all<Record<string, unknown>>(),
      db.prepare('SELECT * FROM article_entities WHERE article_id = ? ORDER BY sort_order ASC, created_at ASC').bind(articleId).all<Record<string, unknown>>(),
      db.prepare('SELECT * FROM article_updates WHERE article_id = ? ORDER BY created_at DESC').bind(articleId).all<Record<string, unknown>>(),
    ]);

    return {
      claims: (claims.results ?? []).map(mapArticleClaim),
      faqs: (faqs.results ?? []).map(mapArticleFaq),
      entities: (entities.results ?? []).map(mapArticleEntity),
      updates: (updates.results ?? []).map(mapArticleUpdate),
    };
  } catch {
    return empty;
  }
}

export async function listPersonalResources(db: D1Database | undefined, language: Language): Promise<PersonalResource[]> {
  if (!db) {
    return samplePersonalResources.filter((resource) => resource.language === language).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const result = await db
    .prepare('SELECT * FROM personal_resources WHERE language = ? ORDER BY is_featured DESC, sort_order ASC')
    .bind(language)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map(mapPersonalResource);
}

export async function listAdminDraftGroups(db: D1Database | undefined): Promise<AdminDraftGroup[]> {
  const draftGroups = db ? await listDbDraftGroups(db) : sampleGroups.filter((group) => group.status === 'needs_review' || group.status === 'draft');
  const adminGroups: AdminDraftGroup[] = [];

  for (const group of draftGroups) {
    const articles = db
      ? await listArticlesForGroup(db, group.id)
      : sampleArticles.filter((article) => article.contentGroupId === group.id);
    const sources = await getSourcesForGroup(db, group.id);
    adminGroups.push({ group, articles, sources });
  }

  return adminGroups;
}

export async function publishContentGroup(db: D1Database | undefined, groupId: string): Promise<{ ok: boolean; message: string }> {
  if (!db) {
    return { ok: true, message: 'Sample mode: publish action accepted. Configure D1 to persist changes.' };
  }

  const validation = await validateContentGroupForPublish(db, groupId);
  if (!validation.ok) {
    return validation;
  }

  await db
    .prepare("UPDATE content_groups SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(groupId)
    .run();

  await db
    .prepare("INSERT INTO admin_events (id, event_type, entity_type, entity_id, detail_json) VALUES (?, 'publish', 'content_group', ?, '{}')")
    .bind(crypto.randomUUID(), groupId)
    .run();

  return { ok: true, message: 'Published.' };
}

export async function unpublishContentGroup(db: D1Database | undefined, groupId: string): Promise<{ ok: boolean; message: string }> {
  if (!db) {
    return { ok: true, message: 'Sample mode: unpublish action accepted. Configure D1 to persist changes.' };
  }

  const group = await db.prepare("SELECT id, status FROM content_groups WHERE id = ?").bind(groupId).first<Record<string, unknown>>();
  if (!group) {
    return { ok: false, message: 'Content group not found.' };
  }
  if (group.status !== 'published') {
    return { ok: false, message: 'Only published content groups can be unpublished.' };
  }

  await db
    .prepare("UPDATE content_groups SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(groupId)
    .run();

  await db
    .prepare("INSERT INTO admin_events (id, event_type, entity_type, entity_id, detail_json) VALUES (?, 'unpublish', 'content_group', ?, '{}')")
    .bind(crypto.randomUUID(), groupId)
    .run();

  return { ok: true, message: 'Unpublished.' };
}

export async function listAdminPublishedGroups(db: D1Database | undefined): Promise<AdminDraftGroup[]> {
  const publishedGroups = db
    ? (await db.prepare("SELECT * FROM content_groups WHERE status = 'published' ORDER BY published_at DESC LIMIT 50").all<Record<string, unknown>>()).results?.map(mapContentGroup) ?? []
    : sampleGroups.filter((group) => group.status === 'published');
  const adminGroups: AdminDraftGroup[] = [];

  for (const group of publishedGroups) {
    const articles = db
      ? await listArticlesForGroup(db, group.id)
      : sampleArticles.filter((article) => article.contentGroupId === group.id);
    const sources = await getSourcesForGroup(db, group.id);
    adminGroups.push({ group, articles, sources });
  }

  return adminGroups;
}

async function validateContentGroupForPublish(db: D1Database, groupId: string): Promise<{ ok: boolean; message: string }> {
  const sourceSummary = await db
    .prepare(
      `SELECT
         g.category AS category,
         COUNT(s.id) AS source_count,
         SUM(CASE WHEN s.id IS NOT NULL AND (s.published_at IS NULL OR s.published_at = '') THEN 1 ELSE 0 END) AS missing_dates,
         SUM(
           CASE
             WHEN s.id IS NOT NULL
              AND s.published_at IS NOT NULL
              AND s.published_at != ''
              AND s.published_at < CASE WHEN g.category = 'news' THEN date('now', '-7 days') WHEN g.category = 'resources' THEN date('now', '-4 months') WHEN g.category = 'prompts' THEN date('now', '-3 months') ELSE date('now', '-6 months') END
             THEN 1
             ELSE 0
           END
         ) AS old_dates
       FROM content_groups g
       LEFT JOIN sources s ON s.content_group_id = g.id
       WHERE g.id = ?
       GROUP BY g.category`,
    )
    .bind(groupId)
    .first<Record<string, unknown>>();

  const category = sourceSummary?.category as Category | undefined;
  const sourceCount = Number(sourceSummary?.source_count ?? 0);
  const missingDates = Number(sourceSummary?.missing_dates ?? 0);
  const oldDates = Number(sourceSummary?.old_dates ?? 0);

  const minPublishSources = category === 'news' ? 1 : 2;
  if (sourceCount < minPublishSources) {
    return { ok: false, message: `Cannot publish: at least ${minPublishSources} source(s) are required.` };
  }
  if (missingDates > 0) {
    return { ok: false, message: `Cannot publish: ${missingDates} source(s) are missing publication dates.` };
  }
  if (oldDates > 0) {
    return { ok: false, message: `Cannot publish: ${oldDates} source(s) are older than ${getFreshnessLabel(category)}.` };
  }

  const categorySummary = await db
    .prepare(
      `SELECT COUNT(DISTINCT g.category) AS category_count
       FROM articles a
       JOIN content_groups g ON g.id = a.content_group_id
       WHERE a.slug IN (SELECT slug FROM articles WHERE content_group_id = ?)`,
    )
    .bind(groupId)
    .first<Record<string, unknown>>();

  if (Number(categorySummary?.category_count ?? 0) > 1) {
    return { ok: false, message: 'Cannot publish: an article slug appears in multiple categories.' };
  }

  return { ok: true, message: 'Ready to publish.' };
}

async function listDbDraftGroups(db: D1Database): Promise<ContentGroup[]> {
  const result = await db
    .prepare("SELECT * FROM content_groups WHERE status IN ('draft', 'needs_review') ORDER BY created_at DESC LIMIT 50")
    .all<Record<string, unknown>>();

  return (result.results ?? []).map(mapContentGroup);
}

async function listArticlesForGroup(db: D1Database, groupId: string): Promise<Article[]> {
  const result = await db
    .prepare(
      `SELECT a.*, g.category, g.status, g.heat_score, g.source_quality_score, g.published_at
       FROM articles a
       JOIN content_groups g ON g.id = a.content_group_id
       WHERE a.content_group_id = ?
       ORDER BY a.language`,
    )
    .bind(groupId)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map(mapArticle);
}

function mapContentGroup(row: Record<string, unknown>): ContentGroup {
  return {
    id: String(row.id),
    canonicalSlug: String(row.canonical_slug),
    category: row.category as ContentGroup['category'],
    status: row.status as ContentGroup['status'],
    heatScore: Number(row.heat_score ?? 0),
    sourceQualityScore: Number(row.source_quality_score ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

function mapArticle(row: Record<string, unknown>): Article {
  return {
    id: String(row.id),
    contentGroupId: String(row.content_group_id),
    language: row.language as Language,
    title: String(row.title),
    slug: String(row.slug),
    summary: String(row.summary),
    contentMarkdown: String(row.content_markdown),
    tags: safeJsonArray(row.tags_json),
    readingTime: Number(row.reading_time ?? 1),
    seoTitle: row.seo_title ? String(row.seo_title) : null,
    seoDescription: row.seo_description ? String(row.seo_description) : null,
    category: row.category as Category,
    status: row.status as Article['status'],
    heatScore: Number(row.heat_score ?? 0),
    sourceQualityScore: Number(row.source_quality_score ?? 0),
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

function mapSource(row: Record<string, unknown>): Source {
  return {
    id: String(row.id),
    contentGroupId: String(row.content_group_id),
    url: String(row.url),
    title: String(row.title),
    publisher: row.publisher ? String(row.publisher) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    retrievedAt: String(row.retrieved_at),
    sourceType: String(row.source_type),
    reliabilityScore: Number(row.reliability_score ?? 0),
    redirectUrl: row.redirect_url ? String(row.redirect_url) : null,
    groundingVerified: Number(row.grounding_verified ?? 0) === 1,
    urlResolved: Number(row.url_resolved ?? 1) === 1,
  };
}

function mapArticleClaim(row: Record<string, unknown>): ArticleClaim {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    claimText: String(row.claim_text),
    claimType: row.claim_type as ArticleClaim['claimType'],
    confidence: row.confidence as ArticleClaim['confidence'],
    sourceIds: safeJsonArray(row.source_ids_json),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapArticleFaq(row: Record<string, unknown>): ArticleFaq {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    question: String(row.question),
    answer: String(row.answer),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapArticleEntity(row: Record<string, unknown>): ArticleEntity {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    entityName: String(row.entity_name),
    entityType: row.entity_type as ArticleEntity['entityType'],
    canonicalUrl: row.canonical_url ? String(row.canonical_url) : null,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapArticleUpdate(row: Record<string, unknown>): ArticleUpdate {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    updateNote: String(row.update_note),
    createdAt: String(row.created_at),
  };
}

function mapPersonalResource(row: Record<string, unknown>): PersonalResource {
  return {
    id: String(row.id),
    language: row.language as Language,
    title: String(row.title),
    description: String(row.description),
    url: String(row.url),
    resourceType: String(row.resource_type),
    isFeatured: Number(row.is_featured) === 1,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function safeJsonArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isSampleArticleFresh(article: Article): boolean {
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;
  if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt < getOldestAllowedDate(article.category)) {
    return false;
  }

  const sources = sampleSources.filter((source) => source.contentGroupId === article.contentGroupId);
  return sources.length >= 2 && sources.every((source) => {
    if (!source.publishedAt) return false;
    const sourceDate = new Date(source.publishedAt);
    return !Number.isNaN(sourceDate.getTime()) && sourceDate >= getOldestAllowedDate(article.category);
  });
}

function compareArticlesByDateDesc(a: Article, b: Article): number {
  const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
  const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
  return bTime - aTime || b.heatScore - a.heatScore;
}

function getOldestAllowedDate(category: Category): Date {
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

function getFreshnessLabel(category: Category | undefined): string {
  if (category === 'news') return 'one week';
  if (category === 'resources') return 'four months';
  if (category === 'prompts') return 'three months';
  return 'six months';
}

export async function listAllPersonalResources(db: D1Database | undefined): Promise<PersonalResource[]> {
  if (!db) {
    return samplePersonalResources.sort((a, b) => a.language.localeCompare(b.language) || a.sortOrder - b.sortOrder);
  }
  const result = await db
    .prepare('SELECT * FROM personal_resources ORDER BY language, sort_order ASC')
    .all<Record<string, unknown>>();
  return (result.results ?? []).map(mapPersonalResource);
}

export async function upsertPersonalResource(
  db: D1Database | undefined,
  resource: { id?: string; language: string; title: string; description: string; url: string; resourceType: string; isFeatured: boolean; sortOrder: number },
): Promise<{ ok: boolean; message: string }> {
  if (!db) {
    return { ok: true, message: 'Sample mode: save action accepted. Configure D1 to persist changes.' };
  }
  const id = resource.id || `pr-${crypto.randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO personal_resources (id, language, title, description, url, resource_type, is_featured, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, url=excluded.url, resource_type=excluded.resource_type, is_featured=excluded.is_featured, sort_order=excluded.sort_order, updated_at=CURRENT_TIMESTAMP`,
    )
    .bind(id, resource.language, resource.title, resource.description, resource.url, resource.resourceType, resource.isFeatured ? 1 : 0, resource.sortOrder)
    .run();
  return { ok: true, message: 'Saved.' };
}

export async function deletePersonalResource(db: D1Database | undefined, id: string): Promise<{ ok: boolean; message: string }> {
  if (!db) {
    return { ok: true, message: 'Sample mode: delete action accepted. Configure D1 to persist changes.' };
  }
  await db.prepare('DELETE FROM personal_resources WHERE id = ?').bind(id).run();
  return { ok: true, message: 'Deleted.' };
}

export async function rejectContentGroup(db: D1Database | undefined, groupId: string): Promise<{ ok: boolean; message: string }> {
  if (!db) {
    return { ok: true, message: 'Sample mode: reject action accepted. Configure D1 to persist changes.' };
  }

  const group = await db.prepare("SELECT id, status FROM content_groups WHERE id = ?").bind(groupId).first<Record<string, unknown>>();
  if (!group) {
    return { ok: false, message: 'Content group not found.' };
  }
  if (group.status !== 'draft' && group.status !== 'needs_review') {
    return { ok: false, message: 'Only draft or needs_review content groups can be rejected.' };
  }

  await db
    .prepare("UPDATE content_groups SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(groupId)
    .run();

  await db
    .prepare("INSERT INTO admin_events (id, event_type, entity_type, entity_id, detail_json) VALUES (?, 'reject', 'content_group', ?, '{}')")
    .bind(crypto.randomUUID(), groupId)
    .run();

  return { ok: true, message: 'Rejected.' };
}

export async function createFeedbackSubmission(
  db: D1Database | undefined,
  feedback: { language: Language; name?: string; email?: string; message: string; sourcePath?: string },
): Promise<{ ok: boolean; message: string }> {
  if (!feedback.message.trim()) {
    return { ok: false, message: 'Feedback message is required.' };
  }
  if (feedback.email && !/^\S+@\S+\.\S+$/.test(feedback.email)) {
    return { ok: false, message: 'Email address is invalid.' };
  }
  if (!db) {
    return { ok: true, message: 'Sample mode: feedback accepted. Configure D1 to persist submissions.' };
  }

  const id = `fb-${crypto.randomUUID().slice(0, 12)}`;
  await db
    .prepare(
      `INSERT INTO feedback_submissions (id, language, name, email, message, source_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, feedback.language, emptyToNull(feedback.name), emptyToNull(feedback.email), feedback.message.trim(), emptyToNull(feedback.sourcePath))
    .run();

  await db
    .prepare("INSERT INTO admin_events (id, event_type, entity_type, entity_id, detail_json) VALUES (?, 'submit', 'feedback', ?, '{}')")
    .bind(crypto.randomUUID(), id)
    .run();

  return { ok: true, message: 'Feedback submitted.' };
}

export async function listFeedbackSubmissions(db: D1Database | undefined): Promise<FeedbackSubmission[]> {
  if (!db) return [];

  const result = await db
    .prepare("SELECT * FROM feedback_submissions ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 WHEN 'responded' THEN 2 ELSE 3 END, created_at DESC LIMIT 100")
    .all<Record<string, unknown>>();
  return (result.results ?? []).map(mapFeedbackSubmission);
}

export async function respondToFeedbackSubmission(
  db: D1Database | undefined,
  feedback: { id: string; status: FeedbackStatus; adminResponse?: string },
): Promise<{ ok: boolean; message: string }> {
  if (!feedback.id) return { ok: false, message: 'Missing feedback id.' };
  if (!['new', 'reviewing', 'responded', 'closed'].includes(feedback.status)) {
    return { ok: false, message: 'Invalid feedback status.' };
  }
  if (!db) {
    return { ok: true, message: 'Sample mode: response action accepted. Configure D1 to persist changes.' };
  }

  const existing = await db.prepare('SELECT id FROM feedback_submissions WHERE id = ?').bind(feedback.id).first<Record<string, unknown>>();
  if (!existing) return { ok: false, message: 'Feedback not found.' };

  const adminResponse = feedback.adminResponse?.trim() || null;
  const respondedAtSql = feedback.status === 'responded' && adminResponse ? 'CURRENT_TIMESTAMP' : 'responded_at';
  await db
    .prepare(`UPDATE feedback_submissions SET status = ?, admin_response = ?, responded_at = ${respondedAtSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(feedback.status, adminResponse, feedback.id)
    .run();

  await db
    .prepare("INSERT INTO admin_events (id, event_type, entity_type, entity_id, detail_json) VALUES (?, 'respond', 'feedback', ?, ?)")
    .bind(crypto.randomUUID(), feedback.id, JSON.stringify({ status: feedback.status }))
    .run();

  return { ok: true, message: 'Feedback updated.' };
}

function mapFeedbackSubmission(row: Record<string, unknown>): FeedbackSubmission {
  return {
    id: String(row.id),
    language: row.language as Language,
    name: row.name ? String(row.name) : null,
    email: row.email ? String(row.email) : null,
    message: String(row.message),
    sourcePath: row.source_path ? String(row.source_path) : null,
    status: row.status as FeedbackStatus,
    adminResponse: row.admin_response ? String(row.admin_response) : null,
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}
