# ACP AI Research Overall Optimization Plan

## Positioning

ACP AI Research should evolve from a runnable bilingual AI content MVP into a credible AI research and intelligence station. The site should combine daily signal tracking, source-backed analysis, bilingual publishing, owner review, and AI-friendly structured knowledge.

The strongest long-term position is not generic AI news. It is:

- Bilingual AI intelligence desk
- Source-backed deep research library
- Owner-reviewed knowledge base
- GEO-ready citation source for search engines and AI assistants

## Product Priorities

1. Content credibility and original analysis
2. Owner review and editorial efficiency
3. SEO and GEO discoverability
4. Security, anti-abuse, and credential hygiene
5. Feedback loop and operating metrics
6. Frontend readability and exploration

## Phase 1: Engineering Hygiene And Security

Immediate work:

- Keep `.env`, service account JSON, Wrangler state, logs, and build outputs out of versioned source.
- Exclude `dist`, `dist-verify*`, `.astro`, `.wrangler`, and `node_modules` from type checking.
- Strengthen admin authentication beyond a raw password cookie.
- Add logout, session expiry, and failed login throttling.
- Add Cloudflare Turnstile or request-rate limiting to public feedback forms.
- Centralize admin API authorization checks.
- Rotate any credential that has been exposed in chat, logs, or local files intended for sharing.

Expected outcome: lower operational risk before traffic and automation scale.

## Phase 2: Deep Research And GEO Foundation

Deep Research should become the highest-value content type. Each research article needs complete information, accurate source support, and the site's own thinking.

Immediate work:

- Define a fixed Deep Research template.
- Add structured claims, FAQs, entities, and update notes.
- Label claims by type: fact, analysis, prediction, recommendation.
- Attach confidence levels and source references to important claims.
- Add JSON-LD for Article, FAQPage, and BreadcrumbList.
- Add stable descriptive URLs and canonical metadata.
- Add last-updated timestamps and visible source metadata.

Expected outcome: content can be understood, cited, refreshed, and reused by humans and AI systems.

## Phase 3: Admin Editorial Desk

The admin page should become a lightweight editorial desk, not only a publish/reject page.

Needed capabilities:

- Draft detail page per content group.
- Edit title, summary, tags, body, SEO title, and SEO description.
- Edit bilingual versions side by side.
- Manage sources: add, remove, edit, mark source type and reliability.
- Edit core claims, FAQs, entities, and ACP analysis blocks.
- Reject with structured reason.
- Trigger partial regeneration: summary only, English only, source refresh, full rewrite.
- Convert user feedback into research topics or revision tasks.

Expected outcome: faster review and better editorial consistency.

## Phase 4: SEO And GEO Distribution

Search and AI assistant discoverability should be first-class.

Needed capabilities:

- `sitemap.xml`
- `rss.xml`, optionally language-specific feeds later
- `robots.txt`
- Canonical URLs
- `hreflang` links for bilingual pages
- Open Graph and Twitter Card metadata
- JSON-LD Article metadata
- JSON-LD FAQPage for research articles with FAQs
- Archive pages that are not limited by freshness filters
- Tag/entity pages for durable topics such as MCP, AI Agents, RAG, Gemini, Claude Code, and AI Browsers

Expected outcome: each article becomes a durable content asset, not only homepage inventory.

## Phase 5: Generation Quality Pipeline

The generation flow should move from direct article generation to fact-grounded research generation.

Recommended flow:

1. Topic selection
2. Source discovery
3. Source credibility scoring
4. Source deduplication
5. Fact extraction
6. Claim extraction
7. Contradiction check
8. Outline generation
9. Analysis generation
10. Citation alignment
11. FAQ generation
12. GEO metadata generation
13. Human review
14. Publish
15. Scheduled refresh

Quality gates:

- At least one strong source for news, preferably two or more for research.
- No unsupported factual claims in published research.
- Explicit uncertainty labels when sources conflict or evidence is weak.
- Chinese and English generated from the same fact base, not one low-quality translation of the other.
- All Deep Research articles include original ACP analysis.

Expected outcome: quality becomes repeatable instead of dependent on one prompt.

## Phase 6: Feedback And Operating Metrics

The feedback feature should become an operating loop.

Needed capabilities:

- Feedback categories: content suggestion, correction, tool recommendation, collaboration, page issue.
- Status flow: new, reviewing, planned, responded, closed.
- Optional email notification when the owner responds.
- Convert feedback into content ideas or revision tasks.
- Dashboard metrics: generated drafts, published articles, rejection reasons, feedback volume, average review time, generation failures, average source count.

Expected outcome: users help steer content quality and topic selection.

## Implementation Order

Recommended order for the current codebase:

1. Add documentation and standards.
2. Add Deep Research structured tables and read methods.
3. Improve article pages with citation-friendly blocks and JSON-LD.
4. Add sitemap, RSS, and robots routes.
5. Exclude generated build directories from checks.
6. Add admin editing for structured research fields.
7. Add Turnstile/rate limiting to feedback.
8. Add source adapters and generation quality pipeline.

## Success Criteria

The project is improving if:

- Deep Research articles contain clear original judgment and source-backed claims.
- AI assistants can extract concise answers from research pages without guessing context.
- Search engines can discover article, FAQ, source, and language metadata.
- The owner can review and edit drafts without touching raw database rows.
- Feedback turns into visible content improvements.
- Build and check output stays clean enough to trust.
