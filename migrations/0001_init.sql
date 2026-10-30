CREATE TABLE IF NOT EXISTS content_groups (
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

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  content_group_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  reading_time INTEGER NOT NULL DEFAULT 1,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_group_id) REFERENCES content_groups(id) ON DELETE CASCADE,
  UNIQUE (language, slug)
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  content_group_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  publisher TEXT,
  published_at TEXT,
  retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_type TEXT NOT NULL DEFAULT 'web',
  reliability_score INTEGER NOT NULL DEFAULT 60,
  FOREIGN KEY (content_group_id) REFERENCES content_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  started_at TEXT,
  finished_at TEXT,
  model_provider TEXT,
  model_name TEXT,
  input_summary TEXT,
  error_message TEXT,
  created_content_group_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personal_resources (
  id TEXT PRIMARY KEY,
  language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'link',
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_groups_category_status ON content_groups(category, status);
CREATE INDEX IF NOT EXISTS idx_content_groups_published_at ON content_groups(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_content_group_language ON articles(content_group_id, language);
CREATE INDEX IF NOT EXISTS idx_articles_language_slug ON articles(language, slug);
CREATE INDEX IF NOT EXISTS idx_sources_content_group ON sources(content_group_id);
CREATE INDEX IF NOT EXISTS idx_personal_resources_language_featured ON personal_resources(language, is_featured, sort_order);
