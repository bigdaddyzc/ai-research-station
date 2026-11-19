import type { Article } from './types';

// Homepage hero ("lead") selection rule:
// among articles published in the last LEAD_WINDOW_DAYS days with
// heat >= LEAD_HEAT_MIN, take the latest publishing day, then the
// highest-heat article of that day. If nothing qualifies, fall back to
// the latest article (the previous behaviour).
export const LEAD_HEAT_MIN = 85;
export const LEAD_WINDOW_DAYS = 3;

function parsePublishedAt(value: string | null): number | null {
  if (!value) return null;
  // published_at comes from SQLite CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS", UTC).
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

export function pickLeadArticle(articles: Article[], now = new Date(), briefingTopSlug?: string | null): Article | undefined {
  const cutoff = now.getTime() - LEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  // The day's briefing #1 already ranked the stories by importance. When it
  // links to a published article from the last 3 days, that article leads —
  // this keeps the hero and the Top 5 from telling two different stories
  // about what mattered most today. Otherwise fall back to the heat rule.
  if (briefingTopSlug) {
    const top = articles.find((article) => {
      if (article.slug !== briefingTopSlug) return false;
      const publishedMs = parsePublishedAt(article.publishedAt);
      return publishedMs !== null && publishedMs >= cutoff;
    });
    if (top) return top;
  }
  const candidates = articles
    .map((article) => ({ article, publishedMs: parsePublishedAt(article.publishedAt) }))
    .filter(
      (entry): entry is { article: Article; publishedMs: number } =>
        entry.publishedMs !== null &&
        entry.publishedMs >= cutoff &&
        entry.article.heatScore >= LEAD_HEAT_MIN,
    );
  if (candidates.length === 0) return articles[0];
  candidates.sort((a, b) => {
    const dayA = new Date(a.publishedMs).toISOString().slice(0, 10);
    const dayB = new Date(b.publishedMs).toISOString().slice(0, 10);
    if (dayA !== dayB) return dayB.localeCompare(dayA);
    if (a.article.heatScore !== b.article.heatScore) {
      return b.article.heatScore - a.article.heatScore;
    }
    return b.publishedMs - a.publishedMs;
  });
  return candidates[0].article;
}
