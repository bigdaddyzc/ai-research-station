import { publishContentGroup, rejectContentGroup, unpublishContentGroup } from './db';

/**
 * Automatic editorial desk.
 *
 * Runs after the daily generation job. It scores every pending content group
 * (status draft / needs_review), publishes the best ones up to a daily cap,
 * and rejects everything else so the review queue never piles up.
 *
 * Quality gates (a group failing any gate is rejected, never published):
 *  - has both a Chinese and an English article
 *  - each article body is long enough to be a real article
 *  - source quality score >= MIN_SOURCE_QUALITY
 *  - created within MAX_AGE_HOURS (stale drafts are rejected)
 *  - passes the existing publish validation (source count, source dates, slug conflicts)
 *
 * Ranking score (0-100):
 *  45% source quality + 30% heat + 15% avg source reliability + 10% share of grounding-verified sources.
 * Selection prefers one article per category before filling remaining slots by score.
 */

export const DEFAULT_DAILY_PUBLISH_LIMIT = 3;
const MIN_SOURCE_QUALITY = 60;
const MIN_ZH_BODY_CHARS = 600;
const MIN_EN_BODY_CHARS = 1200;
const MAX_AGE_HOURS = 48;

type Candidate = {
  id: string;
  category: string;
  slug: string;
  heat: number;
  sourceQuality: number;
  createdAt: string;
  zhLength: number;
  enLength: number;
  sourceCount: number;
  avgReliability: number;
  verifiedShare: number;
  score: number;
  primaryUrl: string;
  gateFailure?: string;
};

export type AutoReviewDecision = { id: string; slug: string; category: string; score: number; action: 'published' | 'rejected'; reason: string };

export type AutoReviewResult = {
  limit: number;
  alreadyPublishedToday: number;
  published: number;
  rejected: number;
  decisions: AutoReviewDecision[];
  replaced: { newId: string; archivedId: string; archivedSlug: string; category: string }[];
};

/** How long a published article stays current, per category (matches source freshness rules). */
const EXPIRY_DAYS: Record<string, number> = { news: 7, prompts: 90, resources: 120, tools: 180, research: 180 };

function hoursSince(sqliteTimestamp: string): number {
  // D1 CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC.
  const ms = Date.parse(sqliteTimestamp.replace(' ', 'T') + (sqliteTimestamp.endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(ms)) return Infinity;
  return (Date.now() - ms) / 3_600_000;
}

async function loadCandidates(db: D1Database): Promise<Candidate[]> {
  const rows = (
    await db
      .prepare(
        `SELECT g.id, g.category, g.canonical_slug, g.heat_score, g.source_quality_score, g.created_at,
                (SELECT MAX(LENGTH(content_markdown)) FROM articles WHERE content_group_id = g.id AND language = 'zh') AS zh_len,
                (SELECT MAX(LENGTH(content_markdown)) FROM articles WHERE content_group_id = g.id AND language = 'en') AS en_len,
                (SELECT COUNT(*) FROM sources WHERE content_group_id = g.id) AS source_count,
                (SELECT AVG(reliability_score) FROM sources WHERE content_group_id = g.id) AS avg_rel,
                (SELECT AVG(CASE WHEN grounding_verified = 1 THEN 1.0 ELSE 0.0 END) FROM sources WHERE content_group_id = g.id) AS verified_share,
                (SELECT url FROM sources WHERE content_group_id = g.id ORDER BY rowid LIMIT 1) AS primary_url
           FROM content_groups g
          WHERE g.status IN ('draft', 'needs_review') AND g.category != 'personal'
          ORDER BY g.created_at DESC`,
      )
      .all<Record<string, unknown>>()
  ).results ?? [];

  return rows.map((row) => {
    const c: Candidate = {
      id: String(row.id),
      category: String(row.category),
      slug: String(row.canonical_slug),
      heat: Number(row.heat_score ?? 0),
      sourceQuality: Number(row.source_quality_score ?? 0),
      createdAt: String(row.created_at ?? ''),
      zhLength: Number(row.zh_len ?? 0),
      enLength: Number(row.en_len ?? 0),
      sourceCount: Number(row.source_count ?? 0),
      avgReliability: Number(row.avg_rel ?? 0),
      verifiedShare: Number(row.verified_share ?? 0),
      score: 0,
      primaryUrl: String(row.primary_url ?? ''),
    };
    c.score = Math.round(0.45 * c.sourceQuality + 0.3 * c.heat + 0.15 * c.avgReliability + 10 * c.verifiedShare);

    if (hoursSince(c.createdAt) > MAX_AGE_HOURS) c.gateFailure = `stale draft (older than ${MAX_AGE_HOURS}h)`;
    else if (c.zhLength < MIN_ZH_BODY_CHARS) c.gateFailure = 'missing or too-short Chinese article';
    else if (c.enLength < MIN_EN_BODY_CHARS) c.gateFailure = 'missing or too-short English article';
    else if (c.sourceQuality < MIN_SOURCE_QUALITY) c.gateFailure = `source quality ${c.sourceQuality} < ${MIN_SOURCE_QUALITY}`;
    return c;
  });
}

async function countPublishedToday(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM content_groups WHERE status = 'published' AND category != 'personal' AND date(published_at) = date('now')")
    .first<Record<string, unknown>>();
  return Number(row?.n ?? 0);
}

async function logEvent(db: D1Database, type: string, id: string, detail: Record<string, unknown>) {
  await db
    .prepare("INSERT INTO admin_events (id, event_type, entity_type, entity_id, detail_json) VALUES (?, ?, 'content_group', ?, ?)")
    .bind(crypto.randomUUID(), type, id, JSON.stringify(detail))
    .run();
}

export async function runAutoReview(db: D1Database | undefined, limit = DEFAULT_DAILY_PUBLISH_LIMIT): Promise<AutoReviewResult> {
  const result: AutoReviewResult = { limit, alreadyPublishedToday: 0, published: 0, rejected: 0, decisions: [], replaced: [] };
  if (!db) return result;

  const candidates = await loadCandidates(db);
  result.alreadyPublishedToday = await countPublishedToday(db);
  let slots = Math.max(0, limit - result.alreadyPublishedToday);

  const eligible = candidates.filter((c) => !c.gateFailure).sort((a, b) => b.score - a.score);
  // Category diversity first: best of each category, then the rest by score.
  const seen = new Set<string>();
  const firstPass = eligible.filter((c) => (seen.has(c.category) ? false : (seen.add(c.category), true)));
  const ordered = [...firstPass, ...eligible.filter((c) => !firstPass.includes(c))];

  // Topics already covered: primary sources of everything published in the last 14 days.
  const usedUrls = new Set(
    ((await db
      .prepare(`SELECT s.url FROM sources s JOIN content_groups g ON g.id = s.content_group_id
                 WHERE g.status = 'published' AND g.published_at > datetime('now', '-14 days')`)
      .all<Record<string, unknown>>()).results ?? []).map((r) => String(r.url)),
  );

  const handled = new Set<string>();
  for (const c of ordered) {
    if (slots <= 0) break;
    if (c.primaryUrl && usedUrls.has(c.primaryUrl)) {
      c.gateFailure = 'duplicate topic (primary source already covered)';
      continue;
    }
    const pub = await publishContentGroup(db, c.id);
    handled.add(c.id);
    if (pub.ok) {
      slots -= 1;
      const urls = (await db.prepare('SELECT url FROM sources WHERE content_group_id = ?').bind(c.id).all<Record<string, unknown>>()).results ?? [];
      for (const r of urls) usedUrls.add(String(r.url));
      result.published += 1;
      result.decisions.push({ id: c.id, slug: c.slug, category: c.category, score: c.score, action: 'published', reason: `score ${c.score}` });
      await logEvent(db, 'auto_publish', c.id, { score: c.score });
    } else {
      c.gateFailure = pub.message;
      handled.delete(c.id);
    }
  }

  for (const c of candidates) {
    if (handled.has(c.id)) continue;
    const reason = c.gateFailure ?? `daily limit of ${limit} reached (score ${c.score})`;
    const rej = await rejectContentGroup(db, c.id);
    if (rej.ok) {
      result.rejected += 1;
      result.decisions.push({ id: c.id, slug: c.slug, category: c.category, score: c.score, action: 'rejected', reason });
      await logEvent(db, 'auto_reject', c.id, { score: c.score, reason });
    }
  }

  // Replace expired articles: each newly published article retires the oldest expired
  // published article in the same category (archived, reversible via admin).
  const newIds = new Set(result.decisions.filter((d) => d.action === 'published').map((d) => d.id));
  for (const d of result.decisions) {
    if (d.action !== 'published') continue;
    const days = EXPIRY_DAYS[d.category] ?? 180;
    const old = await db
      .prepare(
        `SELECT id, canonical_slug FROM content_groups
          WHERE status = 'published' AND category = ? AND published_at < datetime('now', ?)
          ORDER BY published_at ASC LIMIT 1`,
      )
      .bind(d.category, `-${days} days`)
      .first<Record<string, unknown>>();
    if (!old || newIds.has(String(old.id))) continue;
    const un = await unpublishContentGroup(db, String(old.id));
    if (un.ok) {
      result.replaced.push({ newId: d.id, archivedId: String(old.id), archivedSlug: String(old.canonical_slug), category: d.category });
      await logEvent(db, 'auto_replace_expired', String(old.id), { replacedBy: d.id, expiryDays: days });
    }
  }

  return result;
}
