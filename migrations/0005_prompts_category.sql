-- 0005_prompts_category.sql
--
-- Add the 'prompts' category to content_groups.category CHECK.
--
-- D1 applies migrations inside a transaction, where `PRAGMA foreign_keys = OFF`
-- is a silent no-op. Recreating content_groups via `DROP TABLE content_groups`
-- would therefore still perform the implicit DELETE that fires the
-- `ON DELETE CASCADE` from articles/sources, wiping every child row.
--
-- To stay safe we snapshot the child rows first, swap the parent table, then
-- restore the children. The group rows themselves are preserved by copying
-- them into the new table before the swap (the original 0005 approach).
PRAGMA foreign_keys = OFF;

-- 1. Snapshot child rows so the swap's cascade cannot lose them.
DROP TABLE IF EXISTS _articles_save_0005;
DROP TABLE IF EXISTS _sources_save_0005;
CREATE TABLE _articles_save_0005 AS SELECT * FROM articles;
CREATE TABLE _sources_save_0005 AS SELECT * FROM sources;

-- 2. Recreate content_groups with the extended category CHECK.
CREATE TABLE content_groups_with_prompts (
  id TEXT PRIMARY KEY,
  canonical_slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('tools', 'news', 'resources', 'research', 'prompts', 'personal')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'needs_review', 'published', 'rejected', 'archived')),
  heat_score INTEGER NOT NULL DEFAULT 0,
  source_quality_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);

INSERT INTO content_groups_with_prompts (
  id, canonical_slug, category, status, heat_score, source_quality_score, created_at, updated_at, published_at
)
SELECT
  id, canonical_slug, category, status, heat_score, source_quality_score, created_at, updated_at, published_at
FROM content_groups;

-- 3. Swap parent tables (the implicit DELETE only removes rows we snapshotted).
DROP TABLE content_groups;
ALTER TABLE content_groups_with_prompts RENAME TO content_groups;

-- 4. Restore the child rows into the recreated parent.
INSERT INTO articles SELECT * FROM _articles_save_0005;
INSERT INTO sources SELECT * FROM _sources_save_0005;

-- 5. Drop the snapshots.
DROP TABLE _articles_save_0005;
DROP TABLE _sources_save_0005;

CREATE INDEX IF NOT EXISTS idx_content_groups_category_status ON content_groups(category, status);
CREATE INDEX IF NOT EXISTS idx_content_groups_published_at ON content_groups(published_at DESC);

PRAGMA foreign_keys = ON;
