CREATE TABLE IF NOT EXISTS article_claims (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('fact', 'analysis', 'prediction', 'recommendation')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_faqs (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_entities (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'concept' CHECK (entity_type IN ('company', 'product', 'model', 'protocol', 'concept', 'person', 'organization', 'other')),
  canonical_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_updates (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  update_note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_claims_article_order ON article_claims(article_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_article_faqs_article_order ON article_faqs(article_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_article_entities_article_order ON article_entities(article_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_article_entities_name ON article_entities(entity_name);
CREATE INDEX IF NOT EXISTS idx_article_updates_article_created ON article_updates(article_id, created_at DESC);
