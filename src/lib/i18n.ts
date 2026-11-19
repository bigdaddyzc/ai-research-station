export const languages = ['zh', 'en'] as const;

export type UiLanguage = (typeof languages)[number];

export const ui = {
  zh: {
    today: '今日情报',
    tools: 'AI工具评测',
    news: 'AI新闻',
    resources: 'AI资源',
    research: '深度研究',
    prompts: 'AI提示词 / 工作流',
    personal: '个人资源',
    feedback: '提交建议',
    feedbackTitle: '给站长提建议',
    feedbackDesc: '发现内容缺口、工具更新或页面问题，欢迎直接告诉站长。',
    feedbackName: '称呼（可选）',
    feedbackEmail: '邮箱（可选，便于回复）',
    feedbackMessage: '你的建议',
    feedbackSubmit: '提交建议',
    feedbackSent: '已收到，谢谢你的建议。',
    briefing: '简报',
    briefingDesc: '每日 Top 10 故事排名：标题、分数、摘要、为什么重要与来源。',
    briefingTop5: '今日 Top 5',
    briefingArchive: '往日简报',
    briefingEmpty: '暂无简报，明早 10:05 生成后这里会出现。',
    whyItMatters: '为什么重要',
    readBriefing: '阅读完整简报',
    briefingLatest: '最新简报',
    more: '更多',
    source: '来源',
    scoreHow: '评分说明',
    scoreNote: 'Quality 与 Heat 由本站内容生产流程中的模型按 0–100 打分：Quality 看来源的可靠程度，Heat 看话题热度与新鲜度。只有至少引用 2 个来源的内容才能通过质量门槛发布。分数取不到有效值时会回落到 70（Heat）/ 75（Quality），所以分数整体偏高，仅供参考。',
    search: '搜索工具、概念、新闻、资源，例如：MCP、Gemini、AI Browser',
    searchNoResults: '没有找到相关文章',
    admin: 'Admin',
    reviewed: '每篇附来源',
    bilingual: '中文/English 双语同步',
    readMore: '阅读全文',
    moreReviews: '更多评测',
    newsArchive: '新闻归档',
    resourceLibrary: '资源库',
    researchTopics: '研究专题',
    promptLibrary: '提示词与工作流库',
    manageResources: '管理资源',
    sourceCount: '来源',
    pendingReview: '待站长审核',
    draft: '草稿',
    published: '已发布',
    minutes: '分钟',
    appTitle: 'ACP APP 宣传页',
    appDesc: '原有APP宣传内容将保留为独立 /app 页面，并作为个人资源区的固定入口展示。',
    openApp: '打开 /app',
    footer: 'ACP AI Research · AI 根据公开来源整理，自动评分筛选后发布',
  },
  en: {
    today: 'Today',
    tools: 'Tool Reviews',
    news: 'AI News',
    resources: 'Resources',
    research: 'Research',
    prompts: 'Prompts / Workflows',
    personal: 'Personal',
    feedback: 'Feedback',
    feedbackTitle: 'Send feedback',
    feedbackDesc: 'Share missing topics, tool updates, page issues, or ideas you want covered. The site owner can review and respond from the admin desk.',
    feedbackName: 'Name (optional)',
    feedbackEmail: 'Email (optional, for replies)',
    feedbackMessage: 'Your suggestion',
    feedbackSubmit: 'Submit feedback',
    feedbackSent: 'Received. Thanks for the suggestion.',
    briefing: 'Briefing',
    briefingDesc: 'The day’s top 10 stories, ranked — with scores, summaries, why they matter, and sources.',
    briefingTop5: 'Today’s Top 5',
    briefingArchive: 'Past briefings',
    briefingEmpty: 'No briefing yet — the first one appears after the 10:05 generation run.',
    whyItMatters: 'Why it matters',
    readBriefing: 'Read the full briefing',
    briefingLatest: 'Latest briefing',
    more: 'More',
    source: 'Source',
    scoreHow: 'How scores work',
    scoreNote: 'Quality and Heat are scored 0–100 by the model in this site’s editorial pipeline: Quality reflects source reliability, Heat reflects topic heat and recency. Only items citing at least 2 sources pass the quality gate. When no usable score is returned, the pipeline falls back to 70 (Heat) / 75 (Quality), so scores run high by design — treat them as a rough guide.',
    search: 'Search tools, concepts, news, and resources, such as MCP, Gemini, AI Browser',
    searchNoResults: 'No articles found',
    admin: 'Admin',
    reviewed: 'Every post cites sources',
    bilingual: 'Chinese/English parity',
    readMore: 'Read more',
    moreReviews: 'More reviews',
    newsArchive: 'News archive',
    resourceLibrary: 'Resource library',
    researchTopics: 'Research topics',
    promptLibrary: 'Prompt and workflow library',
    manageResources: 'Manage resources',
    sourceCount: 'sources',
    pendingReview: 'Pending review',
    draft: 'Draft',
    published: 'Published',
    minutes: 'min',
    appTitle: 'ACP App Page',
    appDesc: 'The original app promotion page remains available at /app and appears as a featured personal resource.',
    openApp: 'Open /app',
    footer: 'ACP AI Research · AI-compiled from public sources, published after automated quality checks',
  },
};

export const categoryLabels = {  zh: {
    tools: '工具评测',
    news: 'AI新闻',
    resources: '资源分享',
    research: '深度研究',
    prompts: '提示词 / 工作流',
    personal: '个人资源',
  },
  en: {
    tools: 'Tool Review',
    news: 'AI News',
    resources: 'Resource',
    research: 'Deep Research',
    prompts: 'Prompt / Workflow',
    personal: 'Personal',
  },
};

/** Normalize mixed-language keyword tags to one display form per language. */
const tagDisplay: Record<string, { zh: string; en: string }> = {
  prompt: { zh: '提示词', en: 'Prompt' },
  workflow: { zh: '工作流', en: 'Workflow' },
  llm: { zh: '大模型', en: 'LLM' },
  'prompt engineering': { zh: '提示词工程', en: 'Prompt Engineering' },
  'prompt-engineering': { zh: '提示词工程', en: 'Prompt Engineering' },
};

export function displayTag(tag: string, lang: UiLanguage): string {
  const hit = tagDisplay[tag.trim().toLowerCase()];
  return hit ? hit[lang] : tag;
}

/** All display variants of a category's label (nav label vs card label, zh vs en). */
const categoryLabelVariants: Record<string, string[]> = {
  tools: ['工具评测', 'AI工具评测', 'Tool Review', 'Tool Reviews'],
  news: ['AI新闻', 'AI News'],
  resources: ['资源分享', 'AI资源', 'Resource', 'Resources'],
  research: ['深度研究', 'Deep Research'],
  prompts: ['提示词 / 工作流', 'AI提示词 / 工作流', 'Prompt / Workflow', 'AI Prompts / Workflows', 'Prompts / Workflows'],
  personal: ['个人资源', 'Personal', 'Personal Resources'],
};

/** True when a keyword tag just restates its own category label. */
export function isCategoryLabel(tag: string, category: string): boolean {
  return (categoryLabelVariants[category] ?? []).includes(tag.trim());
}
