-- 0006_briefings.sql
--
-- Daily briefing digest: one row per (date, language).
-- A briefing is a derived daily digest (ranked top-10 stories + links to
-- today's published articles), not a content group, so it gets its own
-- table instead of reusing articles/content_groups.
-- date is the Asia/Shanghai calendar date (YYYY-MM-DD) the briefing covers.
-- items_json: [{ rank, title, score, summary, whyItMatters,
--   sources: [{ title, publisher, url }],
--   articleSlug: string|null, articleCategory: string|null }]
CREATE TABLE IF NOT EXISTS briefings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  title TEXT NOT NULL,
  overview TEXT NOT NULL,
  items_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_briefings_date_language ON briefings(date, language);
CREATE INDEX IF NOT EXISTS idx_briefings_published_at ON briefings(published_at DESC);
