-- Track real Google Search grounding provenance on each source.
-- redirect_url:        the Vertex grounding-api-redirect URL Google actually retrieved
-- grounding_verified:  1 when the model's source URL was corroborated by grounding metadata
-- url_resolved:        1 when `url` is a real destination; 0 when it is still a grounding redirect
ALTER TABLE sources ADD COLUMN redirect_url TEXT;
ALTER TABLE sources ADD COLUMN grounding_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sources ADD COLUMN url_resolved INTEGER NOT NULL DEFAULT 1;
