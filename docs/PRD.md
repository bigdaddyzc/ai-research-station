# AI Research Station PRD

## 1. Document Info

- Project name: AI Research Station
- Working directory: `D:\codex-workspace\ai-research-station`
- Target domain: `acp.dpdns.org`
- Deployment target: Cloudflare
- Product type: Bilingual AI research and intelligence website
- Primary languages: Chinese and English, equal priority
- Release mode: AI-generated drafts reviewed and approved by the site owner before publishing
- Original APP promotion page: preserved as an independent page and linked from Personal Resources

## 2. Background

The current website at `acp.dpdns.org` is mainly used for APP promotion. This does not fully use the domain and traffic potential. The new project will turn the site into a bilingual AI research station that automatically discovers high-value AI information, generates structured research content, and lets the site owner review content before publishing.

The website should not feel like a generic AI news blog. Its positioning is closer to an AI research station: curated, analytical, source-backed, bilingual, and useful for readers who want to understand AI trends, tools, resources, and concepts without manually following many scattered sources.

## 3. Product Positioning

### 3.1 One-sentence Positioning

A bilingual AI research station that turns daily AI signals into reviewed, source-backed research articles, tool evaluations, news briefings, and practical resource collections.

### 3.2 Core Value

- Help users quickly understand what is happening in AI today.
- Explain new AI tools, projects, and concepts in a structured and reliable way.
- Provide bilingual content for both Chinese and English readers.
- Reduce noisy information by using AI to collect, summarize, classify, and draft content.
- Preserve human control through owner review before publication.

### 3.3 Product Tone

- Research-oriented, calm, credible, practical.
- Avoid exaggerated marketing language.
- Prefer evidence, sources, pros and cons, uncertainty notes, and user-fit analysis.
- The site should feel like a trustworthy AI analyst, not a content farm.

## 4. Target Users

### 4.1 Primary Users

- AI practitioners and developers who want trend summaries and tool evaluations.
- Product managers, founders, and operators watching AI market movement.
- Students and self-learners who need clear explanations of AI concepts.
- Bilingual readers who want Chinese and English content with similar quality.

### 4.2 Secondary Users

- Users looking for free AI resources, trial credits, courses, prompts, open-source tools, and useful links.
- Visitors interested in the site owner's APP or personal shared resources.

## 5. Information Architecture

The website contains five major sections.

### 5.1 AI Tool Reviews

Purpose: Evaluate active or recently popular AI tools and projects.

Content scope:

- AI apps
- Developer tools
- AI agents
- AI coding tools
- Open-source AI projects
- Model platforms
- Workflow automation tools
- Design, video, audio, image, productivity, and research tools

Recommended article structure:

- What it is
- What problem it solves
- Key features
- Target users
- Typical use cases
- Pricing and free tier
- Strengths
- Limitations
- Reliability assessment
- Privacy and security notes
- Alternatives
- Final verdict
- Structured score
- Sources

Suggested scoring dimensions:

- Practical value
- Innovation
- Ease of use
- Reliability
- Documentation quality
- Community activity
- Pricing value
- Risk level

### 5.2 AI News

Purpose: Provide daily AI news briefings based on high-heat articles and official updates.

Content should be summarized and analyzed, not copied.

Recommended article structure:

- What happened
- Why it matters
- Who is affected
- Key facts
- Context
- Potential impact
- Source links

Expected content volume for MVP:

- 3 to 5 draft news items per day.

### 5.3 AI Resource Sharing

Purpose: Share useful AI-related free or low-cost resources.

Content scope:

- Free credits
- Trial offers
- Open-source models
- Open-source tools
- Courses
- Prompt libraries
- Datasets
- Templates
- API credit promotions
- Model hosting resources
- Useful research or productivity assets

Recommended fields:

- Resource name
- Resource type
- What users get
- Eligibility
- Region limitation
- Whether a credit card is required
- Expiration date, if available
- Claim difficulty
- Recommended users
- Risk or limitation notes
- Source link

### 5.4 Deep Research

Purpose: Explain hot AI concepts, market movements, technical ideas, or ecosystem changes in long-form articles.

Example topics:

- AI agents
- MCP
- RAG evolution
- AI browsers
- Local LLM deployment
- Multimodal models
- AI coding tools
- Open-source model ecosystems
- AI workflow automation
- Model context and memory
- AI search

Recommended article structure:

- Executive summary
- Definition
- Why the topic is hot now
- Historical context
- Core technical or product logic
- Main players
- Use cases
- Limitations and controversies
- Future outlook
- Practical recommendations
- Source links

Expected content volume for MVP:

- 2 deep research drafts per week.

### 5.5 Personal Resources

Purpose: Human-authored or owner-managed section for personal sharing.

Content scope:

- Original APP promotion page link
- Owner's APP introduction
- Personal tools
- Tutorials
- Prompts
- Notes
- Resource collections
- Project updates

Requirement:

- The original APP promotion page must be preserved as an independent page, for example `/app` or `/apps/main`.
- Personal Resources should include an entry pointing to this APP page.
- Personal Resources are not required to be AI-generated.

## 6. Bilingual Requirements

### 6.1 Equal Language Priority

Chinese and English are equal first-class languages. The site must not treat English as a rough machine translation afterthought.

### 6.2 Language Routing

Recommended routing:

- Chinese: `/zh`
- English: `/en`
- Chinese article example: `/zh/research/ai-agents-2026`
- English article example: `/en/research/ai-agents-2026`

Alternative routing can be decided during technical design.

### 6.3 Language Switch

Each page should include a visible language switch.

Requirements:

- Switching language on an article page should navigate to the corresponding article in the other language when available.
- If the corresponding language version is unavailable, navigate to the same section homepage in the selected language.

### 6.4 Content Generation Strategy

Recommended strategy:

1. Collect sources.
2. Extract language-neutral structured facts.
3. Generate Chinese article from facts.
4. Generate English article from the same facts.
5. Store both articles under the same canonical content group.

This avoids one language being a lower-quality translation of the other.

## 7. Content Automation Workflow

### 7.1 Daily Pipeline

The daily automation should run on a fixed schedule.

Recommended flow:

1. Source discovery
2. Candidate extraction
3. Deduplication
4. Category classification
5. Heat and quality scoring
6. Source collection
7. Fact extraction
8. Draft generation in Chinese and English
9. Automated quality checks
10. Save as drafts
11. Owner review
12. Manual approval and publish

### 7.2 Publishing Policy

AI-generated content must not be published automatically in the MVP.

All generated content should enter a review queue with one of these statuses:

- Draft
- Needs review
- Approved
- Published
- Rejected
- Archived

### 7.3 Suggested Source Types

International sources:

- Official AI company blogs
- Product Hunt
- GitHub Trending
- Hacker News
- Reddit AI communities
- arXiv
- Hugging Face
- Google News or Bing News
- Major technology media

Chinese sources:

- AI-focused media and official accounts where legally and technically appropriate
- Search results from major Chinese search engines, if accessible
- Public official announcements

Important: copied articles must not be republished. The site should generate summaries, analysis, and source-backed commentary.

### 7.4 Quality Checks

Before saving a draft, the system should check:

- At least one source link exists.
- Title and summary are not empty.
- Category is valid.
- Chinese and English versions are both generated.
- No obvious duplicated article already exists.
- Claims are phrased cautiously when sources are weak.
- The article does not pretend uncertain information is confirmed.
- The article does not include raw copied paragraphs from source articles.

## 8. Admin Requirements

### 8.1 Admin Goals

The owner needs a lightweight admin area to review, edit, approve, reject, and publish AI-generated content.

### 8.2 Admin Features for MVP

- Login protection
- Draft list
- Filter by category, language, status, and date
- Preview Chinese and English article pair
- Edit title, summary, tags, and body
- View source links
- View generation metadata
- Approve article
- Publish article
- Reject article
- Archive published article
- Create or edit Personal Resources manually

### 8.3 Recommended Review Experience

For bilingual content, the admin should show the Chinese and English versions as a paired content group. The owner should be able to approve the pair together or mark one language as needing revision.

## 9. Public Website Requirements

### 9.1 Homepage

The homepage should be content-first, not a marketing landing page.

Recommended modules:

- Top navigation
- Language switch
- Search
- Today's AI briefing
- Latest AI Tool Reviews
- Latest AI News
- Latest AI Resources
- Latest Deep Research
- Personal Resources entry
- Popular tags

### 9.2 Section Pages

Each section page should support:

- Article list
- Category-specific filters where useful
- Tags
- Pagination or infinite loading
- Search integration

### 9.3 Article Detail Page

Article page should include:

- Title
- Category
- Publish date
- Updated date, if changed
- Summary
- Reading time
- Tags
- Main content
- Source list
- Language switch
- Related articles
- Disclaimer for AI-assisted content

### 9.4 Search

MVP search should support:

- Title search
- Summary search
- Tag search
- Category filter
- Language-aware results

Full-text search can be improved later.

### 9.5 SEO

Requirements:

- Static or server-rendered pages where practical
- SEO-friendly URLs
- Sitemap
- RSS feed
- Article metadata
- Open Graph metadata
- `hreflang` links for bilingual pairs
- Canonical URLs

## 10. Data Model Draft

### 10.1 Content Group

Represents one topic shared by Chinese and English versions.

Suggested fields:

- `id`
- `canonicalSlug`
- `category`
- `status`
- `sourceQualityScore`
- `heatScore`
- `createdAt`
- `updatedAt`
- `publishedAt`

### 10.2 Article

Represents one language version.

Suggested fields:

- `id`
- `contentGroupId`
- `language`
- `title`
- `slug`
- `summary`
- `contentMarkdown`
- `tags`
- `readingTime`
- `seoTitle`
- `seoDescription`
- `createdAt`
- `updatedAt`

### 10.3 Source

Suggested fields:

- `id`
- `contentGroupId`
- `url`
- `title`
- `publisher`
- `publishedAt`
- `retrievedAt`
- `sourceType`
- `reliabilityScore`

### 10.4 Generation Job

Suggested fields:

- `id`
- `jobType`
- `status`
- `startedAt`
- `finishedAt`
- `modelProvider`
- `modelName`
- `inputSummary`
- `errorMessage`
- `createdContentGroupIds`

### 10.5 Personal Resource

Suggested fields:

- `id`
- `language`
- `title`
- `description`
- `url`
- `resourceType`
- `isFeatured`
- `sortOrder`
- `createdAt`
- `updatedAt`

## 11. Technical Direction

### 11.1 Recommended Stack

Recommended initial stack:

- Frontend and app framework: Next.js + TypeScript
- Styling: Tailwind CSS
- Content rendering: Markdown or MDX rendering with sanitization
- Database: PostgreSQL, Supabase, Neon, or Cloudflare D1
- Deployment: Cloudflare Pages or Cloudflare Workers
- Scheduled jobs: Cloudflare Workers Cron Triggers
- AI provider abstraction: support switching providers later

### 11.2 Cloudflare Notes

The project is intended for Cloudflare deployment.

Recommended Cloudflare services:

- Cloudflare Pages for the web app, or Workers if using an edge-first framework mode
- Cloudflare Workers Cron Triggers for scheduled generation
- Cloudflare D1 or external PostgreSQL for content storage
- Cloudflare R2 for media assets if needed
- Cloudflare Turnstile for admin login protection or anti-abuse flows if needed

### 11.3 Credential Handling

API tokens and secrets must not be committed into the project repository.

Use environment variables for:

- Cloudflare API token
- AI provider keys
- Search API keys
- Database credentials
- Admin password or auth secret

Security note: any Cloudflare token shared in chat or stored in plaintext should be rotated before production use.

## 12. MVP Scope

### 12.1 MVP Must Have

- Bilingual public website
- Five content sections
- Original APP page preserved as independent route
- Personal Resources includes APP page entry
- Article list pages
- Article detail pages
- Source links on AI-generated articles
- Admin login
- Draft review queue
- Approve/reject/publish workflow
- Manual personal resource management
- Daily AI draft generation job
- SEO basics: sitemap, metadata, RSS

### 12.2 MVP Daily Generation Target

- AI News: 3 to 5 drafts per day
- AI Tool Review: 1 draft per day
- AI Resource Sharing: 1 to 3 drafts per day
- Deep Research: 2 drafts per week
- Personal Resources: manual only

### 12.3 Not in MVP

- User accounts for public visitors
- Comments
- Paid subscription
- Newsletter automation
- Complex recommendation engine
- Advanced analytics dashboard
- Fully automatic publishing
- Mobile app

## 13. Success Metrics

### 13.1 Content Metrics

- Number of reviewed and published articles per week
- Approval rate of generated drafts
- Rejection reasons
- Average source count per article
- Chinese and English publication parity

### 13.2 User Metrics

- Daily visitors
- Returning visitors
- Search traffic
- Article reading time
- Section-level click-through rate
- Language switch usage

### 13.3 Operational Metrics

- Daily generation success rate
- Average generation cost
- Failed job count
- Average review time per article
- Duplicate content rate

## 14. Risks and Mitigations

### 14.1 Content Hallucination

Risk: AI may generate unsupported claims.

Mitigation:

- Require source links.
- Generate from extracted facts.
- Add automated claim caution checks.
- Keep manual approval before publishing.

### 14.2 Copyright Risk

Risk: Republishing source content may violate copyright.

Mitigation:

- Summarize and analyze instead of copying.
- Always link to original sources.
- Avoid long verbatim excerpts.

### 14.3 Low Content Quality

Risk: The site may look like generic AI-generated content.

Mitigation:

- Use fixed article templates.
- Require pros and cons.
- Require uncertainty notes.
- Review before publishing.
- Add source quality scores.

### 14.4 Source Access Instability

Risk: Some sites block scraping or change page structures.

Mitigation:

- Prefer official APIs, RSS, and public feeds when available.
- Make source adapters modular.
- Keep fallback search providers.

### 14.5 Credential Exposure

Risk: API credentials may leak.

Mitigation:

- Store secrets only in Cloudflare or local `.env` files.
- Add `.env` to `.gitignore`.
- Rotate any token exposed in chat or logs.

## 15. Open Questions

These items need confirmation before detailed technical design or implementation.

1. Site name: should the public brand be `ACP AI Research`, `AI Research Station`, or another name?
2. Original APP page path: should it be `/app`, `/apps`, or use the existing route if one already exists?
3. Admin authentication: is a simple password-protected admin enough for MVP, or do you want email login/OAuth?
4. Database choice: do you prefer Cloudflare D1 for simplicity in the Cloudflare ecosystem, or external PostgreSQL for stronger relational querying?
5. AI provider: which model/provider should be used first for content generation?
6. Search provider: do you have access to a search API, or should MVP start with RSS/public feeds and add web search later?
7. Review workflow: should approval publish immediately, or should approval and publish be two separate actions?
8. Content style: should Chinese content use a more formal research tone, or a slightly more readable media-style tone?
9. Legal footer: should the site include explicit AI-generated content and source disclaimer on every article?
10. Existing APP page: where is the current page source code or deployment project located?

## 16. Recommended Next Step

After confirming the open questions, the next step is to create the technical design document covering:

- Framework and deployment choice
- Routing plan
- Database schema
- Admin workflow
- Content generation worker architecture
- Source adapter design
- AI prompt and review pipeline
- Cloudflare deployment plan
