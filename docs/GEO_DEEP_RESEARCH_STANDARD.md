# GEO Deep Research Standard

## Purpose

Deep Research articles should be complete, accurate, opinionated, and easy for both humans and AI systems to cite. They are not long-form news summaries. They are durable knowledge assets with clear evidence, structured claims, and ACP's own analysis.

## Required Article Structure

Every Deep Research article should follow this structure unless the owner explicitly overrides it:

1. Executive Summary
2. Definition
3. Why It Matters Now
4. Background
5. Technical Or Product Logic
6. Key Players
7. Use Cases
8. Evidence And Sources
9. ACP Analysis
10. Limitations And Risks
11. Future Outlook
12. Practical Recommendations
13. FAQ
14. Source List

## ACP Analysis Requirements

The `ACP Analysis` section must contain original thinking. It should answer at least four of these questions:

- Is this trend overestimated, underestimated, or correctly priced by the market?
- Who benefits most in the short term?
- Which use cases are practical now?
- Which claims are still weak or unsupported?
- What could change in the next 3 to 12 months?
- What should developers, product teams, founders, or learners do next?
- What risks are being ignored by mainstream coverage?

Do not present ACP analysis as sourced fact. Label it as analysis, judgment, forecast, or recommendation.

## Claim Types

Structured claims should be extracted and stored separately from article prose.

Allowed claim types:

- `fact`: verifiable statement supported by sources
- `analysis`: ACP interpretation based on facts
- `prediction`: future-facing expectation
- `recommendation`: practical advice for a reader group

Confidence levels:

- `high`: multiple reliable sources or official documentation
- `medium`: credible but incomplete evidence
- `low`: early signal, weak evidence, or conflicting sources

## Citation Rules

- Important factual claims should reference one or more source records.
- Source records should include title, publisher, URL, publication date, and retrieval date when available.
- If sources conflict, state the disagreement explicitly.
- Do not cite a source that does not support the claim.
- Avoid long copied passages from source material.

## GEO Formatting Rules

Research pages should be easy for generative search systems to parse.

Required page elements:

- Clear H1 that names the entity, concept, or question.
- Concise summary near the top.
- 5 to 8 key takeaways or claims near the top when available.
- Stable canonical URL.
- Visible last updated or published date.
- FAQ block with direct questions and direct answers.
- Source list with publication and retrieval metadata.
- JSON-LD Article metadata.
- JSON-LD FAQPage metadata when FAQs exist.
- JSON-LD BreadcrumbList metadata.

Recommended writing style:

- Use concrete nouns and direct statements.
- Keep each paragraph focused on one idea.
- Avoid vague phrases such as "many people say" without evidence.
- Use cautious language for uncertain claims.
- Prefer descriptive section headings over clever headings.

## Bilingual Rules

Chinese and English versions should be generated from the same fact base and claim set. One language must not be treated as a low-quality translation of the other.

Each language version should preserve:

- Same core conclusions
- Same claim confidence
- Same source grounding
- Same practical recommendations
- Same uncertainty boundaries

The wording may be localized for readability.

## Publish Checklist

Before publishing Deep Research, confirm:

- The article has a complete structure or a deliberate reason for deviation.
- ACP Analysis includes original judgment.
- Important factual claims are supported by sources.
- Weak claims are labeled with uncertainty.
- FAQ answers are concise and directly answer the questions.
- SEO title and description are present.
- JSON-LD can be generated without invalid values.
- Sources are not stale for the article topic.
- Chinese and English versions are aligned in conclusions.

## Refresh Rules

Deep Research should be refreshed when:

- A major source changes the facts.
- A key player launches, deprecates, or changes a relevant product.
- The article receives correction feedback.
- The article ranks for important search/GEO queries but lacks key answers.
- The article is older than its topic freshness window.

Each refresh should add an update note rather than silently rewriting history.
