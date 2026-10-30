import type { Article, Category, ContentGroup, Language, PersonalResource, Source } from './types';

const now = '2026-07-01T08:00:00.000Z';

export const sampleGroups: ContentGroup[] = [
  {
    id: 'group-agent-runtime',
    canonicalSlug: 'ai-agent-runtime-landscape',
    category: 'news',
    status: 'published',
    heatScore: 92,
    sourceQualityScore: 88,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-devin-like-tools',
    canonicalSlug: 'devin-like-ai-engineer-tools',
    category: 'tools',
    status: 'needs_review',
    heatScore: 84,
    sourceQualityScore: 81,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  },
  {
    id: 'group-rag-evolution',
    canonicalSlug: 'rag-is-evolving-not-dead',
    category: 'news',
    status: 'published',
    heatScore: 78,
    sourceQualityScore: 85,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-video-models',
    canonicalSlug: 'multimodal-video-models-heat',
    category: 'news',
    status: 'published',
    heatScore: 90,
    sourceQualityScore: 82,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-cloud-credits',
    canonicalSlug: 'ai-cloud-trial-credits',
    category: 'resources',
    status: 'published',
    heatScore: 76,
    sourceQualityScore: 74,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-moe-architecture',
    canonicalSlug: 'mixture-of-experts-architecture-deep-dive',
    category: 'research',
    status: 'published',
    heatScore: 88,
    sourceQualityScore: 93,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-ai-alignment',
    canonicalSlug: 'ai-alignment-technical-roadmap',
    category: 'research',
    status: 'published',
    heatScore: 82,
    sourceQualityScore: 91,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-prompt-research-brief',
    canonicalSlug: 'source-grounded-research-brief',
    category: 'prompts',
    status: 'published',
    heatScore: 89,
    sourceQualityScore: 94,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-workflow-content-repurpose',
    canonicalSlug: 'long-form-content-repurpose-workflow',
    category: 'prompts',
    status: 'published',
    heatScore: 86,
    sourceQualityScore: 91,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 'group-prompt-code-review',
    canonicalSlug: 'risk-first-code-review-prompt',
    category: 'prompts',
    status: 'published',
    heatScore: 84,
    sourceQualityScore: 90,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
];

const bilingual = {
  zh: {
    agentTitle: 'AI Agent 正在从演示走向生产，但真正的门槛变成了工作流可靠性',
    agentSummary: '梳理AI Agent平台、MCP生态、浏览器自动化和企业工作流产品的变化，解释为什么稳定执行、权限边界和可审计性才是下一阶段关键。',
    devinTitle: 'Devin类AI工程师产品：适合谁，风险在哪里？',
    devinSummary: '评估端到端编码代理在真实团队中的可用性、成本和对现有研发流程的要求。',
    ragTitle: 'RAG没有过时，但它正在变得不再显眼',
    ragSummary: '研究模型长上下文、检索增强和企业知识库之间的新分工。',
    newsTitle: '多模态模型发布节奏加快，视频理解成为新战场',
    newsSummary: '关注点从演示效果转向长视频理解、检索成本和开发者API稳定性。',
    resourceTitle: '云端AI开发试用额度整理',
    resourceSummary: '适合搭建原型、跑批量生成任务和测试模型API，需注意试用期和区域限制。',
    moeTitle: 'Mixture of Experts架构深度解析：为什么MoE正在重塑大模型效率范式',
    moeSummary: '从技术原理到工程实践，系统分析MoE架构如何在保持模型能力的同时大幅降低推理成本，以及它对模型训练和部署的深远影响。',
    alignmentTitle: 'AI对齐技术路线图：从RLHF到Constitutional AI的范式演进',
    alignmentSummary: '梳理AI对齐领域的核心技术路线，比较不同方法论的优劣势，探讨对齐研究对未来AI安全的关键影响。',
  },
  en: {
    agentTitle: 'AI agents are moving from demos to production, and workflow reliability is becoming the real barrier',
    agentSummary: 'A research briefing on agent platforms, MCP, browser automation, and enterprise workflows, with a focus on reliability, permissions, and auditability.',
    devinTitle: 'Devin-like AI engineering tools: who should use them, and where are the risks?',
    devinSummary: 'An evaluation of end-to-end coding agents across practical value, cost, and fit with real development teams.',
    ragTitle: 'RAG is not dead, but it is becoming less visible',
    ragSummary: 'How long-context models, retrieval, and enterprise knowledge systems are being redistributed across the AI stack.',
    newsTitle: 'Multimodal model releases accelerate as video understanding becomes the next battleground',
    newsSummary: 'The discussion is shifting from flashy demos to long-video understanding, retrieval cost, and developer API stability.',
    resourceTitle: 'AI cloud trial credits worth tracking',
    resourceSummary: 'Useful for prototypes, batch generation, and model API testing, with attention to region, expiration, and payment requirements.',
    moeTitle: 'Mixture of Experts architecture deep dive: why MoE is reshaping large model efficiency',
    moeSummary: 'A systematic analysis of how MoE architectures dramatically reduce inference cost while maintaining model capability, and their implications for training and deployment.',
    alignmentTitle: 'AI alignment technical roadmap: the paradigm evolution from RLHF to Constitutional AI',
    alignmentSummary: 'A review of core alignment techniques, comparison of different methodologies, and exploration of how alignment research shapes future AI safety.',
  },
};

export const sampleArticles: Article[] = [
  ...(['zh', 'en'] as Language[]).flatMap((language) => [
    article('article-agent-' + language, 'group-agent-runtime', language, 'news', 'published', bilingual[language].agentTitle, 'ai-agent-runtime-landscape', bilingual[language].agentSummary, ['MCP', 'Agent Runtime', 'Enterprise AI'], 9, 92, 88),
    article('article-devin-' + language, 'group-devin-like-tools', language, 'tools', 'needs_review', bilingual[language].devinTitle, 'devin-like-ai-engineer-tools', bilingual[language].devinSummary, ['Coding Agent', 'AI Engineer', 'Developer Tools'], 7, 84, 81),
    article('article-rag-' + language, 'group-rag-evolution', language, 'news', 'published', bilingual[language].ragTitle, 'rag-is-evolving-not-dead', bilingual[language].ragSummary, ['RAG', 'Knowledge Base', 'Long Context'], 10, 78, 85),
    article('article-video-' + language, 'group-video-models', language, 'news', 'published', bilingual[language].newsTitle, 'multimodal-video-models-heat', bilingual[language].newsSummary, ['Multimodal', 'Video AI', 'Model API'], 4, 90, 82),
    article('article-cloud-' + language, 'group-cloud-credits', language, 'resources', 'published', bilingual[language].resourceTitle, 'ai-cloud-trial-credits', bilingual[language].resourceSummary, ['Free Credits', 'Cloud AI', 'API'], 5, 76, 74),
    article('article-moe-' + language, 'group-moe-architecture', language, 'research', 'published', bilingual[language].moeTitle, 'mixture-of-experts-architecture-deep-dive', bilingual[language].moeSummary, ['MoE', 'Model Architecture', 'Inference Efficiency'], 12, 88, 93),
    article('article-alignment-' + language, 'group-ai-alignment', language, 'research', 'published', bilingual[language].alignmentTitle, 'ai-alignment-technical-roadmap', bilingual[language].alignmentSummary, ['AI Alignment', 'RLHF', 'AI Safety'], 14, 82, 91),
  ]),
  article('article-prompt-research-zh', 'group-prompt-research-brief', 'zh', 'prompts', 'published', '来源驱动的 AI 研究简报提示词', 'source-grounded-research-brief', '把一个宽泛主题转化为带来源、反方观点和行动建议的研究简报，适合选题判断与决策准备。', ['Claude', 'Gemini', '研究', '提示词'], 6, 89, 94, promptResearchMarkdown('zh')),
  article('article-prompt-research-en', 'group-prompt-research-brief', 'en', 'prompts', 'published', 'Source-grounded AI research brief prompt', 'source-grounded-research-brief', 'Turn a broad topic into a research brief with sources, counterarguments, and action-oriented conclusions.', ['Claude', 'Gemini', 'Research', 'Prompt'], 6, 89, 94, promptResearchMarkdown('en')),
  article('article-workflow-repurpose-zh', 'group-workflow-content-repurpose', 'zh', 'prompts', 'published', '长内容多平台再创作工作流', 'long-form-content-repurpose-workflow', '把一篇长文系统拆解为社交帖子、邮件摘要和短视频脚本，并用事实检查避免信息走样。', ['ChatGPT', 'Notion', '内容创作', '工作流'], 8, 86, 91, repurposeWorkflowMarkdown('zh')),
  article('article-workflow-repurpose-en', 'group-workflow-content-repurpose', 'en', 'prompts', 'published', 'Long-form content repurposing workflow', 'long-form-content-repurpose-workflow', 'Transform one long article into social posts, an email brief, and a short-video script without losing factual fidelity.', ['ChatGPT', 'Notion', 'Content', 'Workflow'], 8, 86, 91, repurposeWorkflowMarkdown('en')),
  article('article-prompt-code-review-zh', 'group-prompt-code-review', 'zh', 'prompts', 'published', '风险优先的代码审查提示词', 'risk-first-code-review-prompt', '让模型先识别真实缺陷、回归风险和测试缺口，再给出按严重程度排序的审查意见。', ['Codex', 'Claude', '代码审查', '提示词'], 5, 84, 90, codeReviewMarkdown('zh')),
  article('article-prompt-code-review-en', 'group-prompt-code-review', 'en', 'prompts', 'published', 'Risk-first code review prompt', 'risk-first-code-review-prompt', 'Focus an AI reviewer on real defects, regression risk, and missing tests, with findings ordered by severity.', ['Codex', 'Claude', 'Code Review', 'Prompt'], 5, 84, 90, codeReviewMarkdown('en')),
];

export const sampleSources: Source[] = [
  source('source-openai', 'group-agent-runtime', 'https://openai.com/news/', 'OpenAI official updates', 'OpenAI', 92),
  source('source-anthropic', 'group-agent-runtime', 'https://www.anthropic.com/news', 'Anthropic official updates', 'Anthropic', 90),
  source('source-hn', 'group-devin-like-tools', 'https://news.ycombinator.com/', 'Developer discussion on AI coding agents', 'Hacker News', 76),
  source('source-hf', 'group-video-models', 'https://huggingface.co/', 'Hugging Face model community updates', 'Hugging Face', 82),
  source('source-google-cloud', 'group-cloud-credits', 'https://cloud.google.com/free', 'Google Cloud Free Program', 'Google Cloud', 84),
  source('source-moe-arxiv', 'group-moe-architecture', 'https://arxiv.org/abs/2401.04088', 'Mixtral of Experts paper', 'arXiv', 95),
  source('source-moe-blog', 'group-moe-architecture', 'https://huggingface.co/blog/moe', 'MoE explained', 'Hugging Face', 88),
  source('source-alignment-arxiv', 'group-ai-alignment', 'https://arxiv.org/abs/2212.08073', 'Constitutional AI paper', 'arXiv', 94),
  source('source-alignment-blog', 'group-ai-alignment', 'https://www.anthropic.com/research', 'Anthropic alignment research', 'Anthropic', 92),
  source('source-anthropic-prompting', 'group-prompt-research-brief', 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview', 'Anthropic prompt engineering overview', 'Anthropic', 95),
  source('source-google-prompting', 'group-prompt-research-brief', 'https://ai.google.dev/gemini-api/docs/prompting-strategies', 'Gemini prompting strategies', 'Google AI', 93),
  source('source-openai-prompting', 'group-workflow-content-repurpose', 'https://platform.openai.com/docs/guides/prompt-engineering', 'OpenAI prompt engineering guide', 'OpenAI', 94),
  source('source-notion-ai', 'group-workflow-content-repurpose', 'https://www.notion.com/help/guides/category/ai', 'Notion AI guides', 'Notion', 86),
  source('source-openai-code', 'group-prompt-code-review', 'https://platform.openai.com/docs/guides/prompt-engineering', 'OpenAI prompt engineering guide', 'OpenAI', 94),
  source('source-anthropic-code', 'group-prompt-code-review', 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview', 'Anthropic prompt engineering overview', 'Anthropic', 95),
];

export const samplePersonalResources: PersonalResource[] = [
  {
    id: 'personal-app-zh',
    language: 'zh',
    title: 'ACP APP 宣传页',
    description: '原有APP宣传内容保留为独立页面，并作为个人资源区固定入口。',
    url: '/app',
    resourceType: 'app',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    id: 'personal-app-en',
    language: 'en',
    title: 'ACP App Page',
    description: 'The original app promotion page remains available as an independent page and a featured personal resource.',
    url: '/app',
    resourceType: 'app',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    id: 'personal-toolbox-zh',
    language: 'zh',
    title: '我的AI工具箱与提示词收藏',
    description: '站长手动维护的真实使用清单，不进入自动生成流程。',
    url: '/zh/personal',
    resourceType: 'collection',
    isFeatured: false,
    sortOrder: 2,
  },
  {
    id: 'personal-toolbox-en',
    language: 'en',
    title: 'My AI toolbox and prompt collection',
    description: 'A manually curated collection maintained by the site owner.',
    url: '/en/personal',
    resourceType: 'collection',
    isFeatured: false,
    sortOrder: 2,
  },
];

function article(
  id: string,
  contentGroupId: string,
  language: Language,
  category: Category,
  status: Article['status'],
  title: string,
  slug: string,
  summary: string,
  tags: string[],
  readingTime: number,
  heatScore: number,
  sourceQualityScore: number,
  contentMarkdown?: string,
): Article {
  return {
    id,
    contentGroupId,
    language,
    title,
    slug,
    summary,
    contentMarkdown: contentMarkdown ?? makeMarkdown(language, title, summary),
    tags,
    readingTime,
    seoTitle: title,
    seoDescription: summary,
    category,
    status,
    heatScore,
    sourceQualityScore,
    publishedAt: status === 'published' ? now : null,
  };
}

function promptResearchMarkdown(language: Language): string {
  if (language === 'zh') return `### 适用场景

用于市场扫描、技术选型或新主题调研。先收集证据，再要求模型形成判断。

### 核心提示词

\`\`\`text
你是一名严谨的研究分析师。围绕 {{研究主题}} 制作一份供 {{目标读者}} 使用的研究简报。

目标：帮助读者在 {{决策期限}} 前决定 {{待决策事项}}。

请按以下流程工作：
1. 先列出需要验证的 5-8 个关键问题，不要立即下结论。
2. 仅使用我提供的材料与可访问的一手来源；每个事实标注来源与日期。
3. 区分“已证实事实”“分析判断”“仍不确定事项”。
4. 主动寻找至少两个反方观点，并说明它们在什么条件下成立。
5. 输出：执行摘要、证据表、关键分歧、三种情景、行动建议、待验证清单。

约束：缺少证据时明确写“证据不足”，不得补造数据或引用。
\`\`\`

### 变量说明

- **研究主题**：需要调查的具体问题。
- **目标读者**：最终使用简报的人或团队。
- **决策期限**：结论需要支持的时间窗口。
- **待决策事项**：需要做出的具体选择。

### 使用方法

先附上已有资料，再粘贴提示词。首轮只让模型输出研究问题，确认范围后再继续完整简报。

### 质量检查

- 每个关键事实都有来源和日期。
- 事实、分析与不确定性明确分开。
- 建议能直接映射到待决策事项。

### 参考来源

结构设计参考 Anthropic 与 Google 的官方提示工程指南。`;

  return `### Best for

Market scans, technical evaluations, and unfamiliar research topics where evidence must come before conclusions.

### Core Prompt

\`\`\`text
You are a rigorous research analyst. Produce a research brief on {{research_topic}} for {{target_reader}}.

Goal: help the reader decide {{decision_to_make}} before {{decision_deadline}}.

Follow this process:
1. List 5-8 questions that must be verified before drawing conclusions.
2. Use only supplied material and accessible primary sources; attach a source and date to every factual claim.
3. Separate verified facts, analysis, and unresolved uncertainty.
4. Find at least two counterarguments and state the conditions under which each is valid.
5. Output: executive summary, evidence table, key disagreements, three scenarios, recommendations, and an open verification list.

Constraint: when evidence is missing, write "insufficient evidence." Never invent data or citations.
\`\`\`

### Variables

- **research_topic**: the specific question to investigate.
- **target_reader**: the person or team using the brief.
- **decision_deadline**: the time window the analysis must support.
- **decision_to_make**: the concrete choice at stake.

### How to use

Attach your existing material first. Ask for only the research questions in the first turn, confirm scope, then request the complete brief.

### Quality checks

- Every important fact has a source and date.
- Facts, analysis, and uncertainty are visibly separated.
- Recommendations map directly to the decision.

### Sources

The structure follows official prompting guidance from Anthropic and Google.`;
}

function repurposeWorkflowMarkdown(language: Language): string {
  if (language === 'zh') return `### 适用场景

适合将研究文章、访谈或教程转成多个渠道的内容资产。

### 核心提示词

\`\`\`text
把下面的 {{原始内容}} 改造成面向 {{目标受众}} 的内容包，品牌语气为 {{品牌语气}}。

必须保留原文的事实边界。任何原文没有支持的说法都标记为 [需核验]。
输出：
- 1 份 200 字邮件摘要
- 3 条各自角度不同的社交帖子
- 1 份 60 秒短视频脚本
- 5 个标题备选
- 1 张“原始事实 -> 改写内容”核对表
\`\`\`

### 工作流步骤

1. 提取原文中的事实、观点、案例和可引用句。
2. 确定每个渠道唯一的传播目标，避免简单缩写。
3. 使用核心提示词生成首稿。
4. 根据核对表逐项检查数字、专有名词与结论边界。
5. 人工选择标题并完成最终语气调整。

### 变量说明

- **原始内容**：完整原文或可访问的正文。
- **目标受众**：内容需要影响的具体人群。
- **品牌语气**：例如冷静、专业、直接。

### 质量检查

- 各渠道内容角度不同，但事实一致。
- 所有 [需核验] 项均在发布前处理。
- 短视频脚本可以在 60 秒内自然读完。

### 参考来源

工作流设计参考 OpenAI 提示工程指南与 Notion AI 内容工作方法。`;

  return `### Best for

Turning research articles, interviews, or tutorials into a coordinated set of channel-ready assets.

### Core Prompt

\`\`\`text
Transform {{source_content}} into a content package for {{target_audience}} using a {{brand_voice}} voice.

Preserve the source's factual boundaries. Mark every unsupported statement as [VERIFY].
Output:
- one 200-word email brief
- three social posts with distinct angles
- one 60-second short-video script
- five headline options
- one source-fact-to-output verification table
\`\`\`

### Workflow steps

1. Extract facts, opinions, examples, and quotable lines from the source.
2. Assign one distinct communication goal to each channel.
3. Generate the first draft with the core prompt.
4. Use the verification table to check numbers, names, and claim boundaries.
5. Select headlines and complete a final human voice edit.

### Variables

- **source_content**: the complete source text.
- **target_audience**: the specific people the assets should reach.
- **brand_voice**: for example calm, expert, and direct.

### Quality checks

- Channels use different angles while preserving the same facts.
- Every [VERIFY] marker is resolved before publishing.
- The video script reads naturally in 60 seconds.

### Sources

The workflow draws on OpenAI prompting guidance and Notion AI content practices.`;
}

function codeReviewMarkdown(language: Language): string {
  if (language === 'zh') return `### 适用场景

用于审查拉取请求、补丁或高风险模块，优先寻找会影响真实用户的缺陷。

### 核心提示词

\`\`\`text
你是负责 {{系统类型}} 的高级代码审查员。审查下面的 {{变更内容}}。

按以下优先级寻找问题：
1. 正确性、安全性、数据丢失与并发缺陷
2. 行为回归和接口契约破坏
3. 缺失或无效的测试
4. 仅在影响维护或可靠性时指出设计问题

每条发现必须包含：严重程度、文件与行号、触发条件、实际影响、最小修复方向。
不要复述代码，不要报告纯风格偏好。若没有发现问题，明确说明并列出剩余测试风险。
\`\`\`

### 变量说明

- **系统类型**：服务端、前端、数据管道等。
- **变更内容**：diff、相关文件或提交内容。

### 使用方法

同时提供变更说明、diff 和相关测试。对高风险发现要求模型给出最小复现步骤。

### 质量检查

- 每条问题都有具体触发路径。
- 严重程度与用户影响一致。
- 没有把格式偏好误报为缺陷。

### 参考来源

提示词结构参考 OpenAI 与 Anthropic 的官方提示工程建议。`;

  return `### Best for

Reviewing pull requests, patches, or high-risk modules with a focus on defects that affect real users.

### Core Prompt

\`\`\`text
You are a senior code reviewer responsible for a {{system_type}}. Review the following {{change_set}}.

Find issues in this order:
1. correctness, security, data loss, and concurrency defects
2. behavioral regressions and broken contracts
3. missing or ineffective tests
4. design issues only when they affect maintainability or reliability

Every finding must include severity, file and line, trigger condition, real impact, and the smallest viable fix direction.
Do not summarize the code or report style preferences. If no issues are found, say so and list residual testing risks.
\`\`\`

### Variables

- **system_type**: backend, frontend, data pipeline, and so on.
- **change_set**: the diff, relevant files, or commit.

### How to use

Provide the change description, diff, and relevant tests together. Ask for a minimal reproduction path for every high-risk finding.

### Quality checks

- Every issue includes a concrete trigger path.
- Severity matches user impact.
- Formatting preferences are not misreported as defects.

### Sources

The prompt structure follows official guidance from OpenAI and Anthropic.`;
}

function source(id: string, contentGroupId: string, url: string, title: string, publisher: string, reliabilityScore: number): Source {
  return {
    id,
    contentGroupId,
    url,
    title,
    publisher,
    publishedAt: now,
    retrievedAt: now,
    sourceType: 'web',
    reliabilityScore,
    redirectUrl: null,
    groundingVerified: false,
    urlResolved: true,
  };
}

function makeMarkdown(language: Language, title: string, summary: string): string {
  if (language === 'zh') {
    return `## 核心判断\n\n${summary}\n\n## 为什么值得关注\n\n《${title}》这个主题近期的讨论热度来自产品发布、开发者社区反馈和企业落地需求的共同推动。ACP AI Research 会优先关注它对实际用户的价值，而不是只看演示效果。\n\n## 风险与限制\n\n当前结论仍需要结合更多一手来源验证。正式文章发布前，站长会检查来源、修正措辞，并补充必要的上下文。`; 
  }

  return `## Core Takeaway\n\n${summary}\n\n## Why It Matters\n\n${title} is gaining attention through product launches, developer discussions, and enterprise adoption needs. ACP AI Research focuses on practical value rather than demo appeal alone.\n\n## Risks and Limits\n\nThe current conclusion still requires source review. Before publication, the site owner checks sources, adjusts wording, and adds missing context.`;
}
