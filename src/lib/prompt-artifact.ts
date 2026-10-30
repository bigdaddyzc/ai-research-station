import type { Article } from './types';

export type PromptArtifactKind = 'prompt' | 'workflow';

export interface PromptArtifact {
  kind: PromptArtifactKind;
  copyText: string | null;
  variables: string[];
  tools: string[];
  stepCount: number;
}

const TOOL_NAMES = [
  'ChatGPT',
  'Claude',
  'Gemini',
  'OpenAI',
  'Cursor',
  'Codex',
  'Perplexity',
  'Notion',
  'n8n',
  'Zapier',
  'Make',
];

export function getPromptArtifact(article: Pick<Article, 'contentMarkdown' | 'tags'>): PromptArtifact {
  const markdown = article.contentMarkdown;
  const kind = inferKind(markdown, article.tags);
  const copyText = extractPrimaryCodeBlock(markdown);
  const variables = extractVariables(copyText ?? markdown);
  const tools = TOOL_NAMES.filter((name) =>
    article.tags.some((tag) => tag.toLowerCase() === name.toLowerCase()) ||
    markdown.toLowerCase().includes(name.toLowerCase()),
  ).slice(0, 4);

  return {
    kind,
    copyText,
    variables,
    tools,
    stepCount: kind === 'workflow' ? countWorkflowSteps(markdown) : 0,
  };
}

function inferKind(markdown: string, tags: string[]): PromptArtifactKind {
  const text = `${tags.join(' ')} ${markdown}`.toLowerCase();
  return /workflow|工作流|自动化|automation|n8n|zapier/.test(text) ? 'workflow' : 'prompt';
}

function extractPrimaryCodeBlock(markdown: string): string | null {
  const preferredSection = markdown.match(
    /(?:^|\n)#{2,4}\s+(?:核心提示词|完整提示词|core prompt|prompt template)[^\n]*\n([\s\S]*?)(?=\n#{2,4}\s+|$)/i,
  )?.[1];
  const source = preferredSection ?? markdown;
  const fenced = source.match(/```(?:text|prompt|markdown|md)?\s*\r?\n([\s\S]*?)```/i)?.[1];
  return fenced?.trim() || null;
}

function extractVariables(text: string): string[] {
  const variables = new Set<string>();
  for (const match of text.matchAll(/\{\{\s*([A-Za-z0-9_\u4e00-\u9fff-]+)\s*\}\}/g)) {
    variables.add(match[1]);
  }
  return [...variables].slice(0, 12);
}

function countWorkflowSteps(markdown: string): number {
  const section = markdown.match(
    /(?:^|\n)#{2,4}\s+(?:工作流步骤|执行步骤|workflow steps|steps)[^\n]*\n([\s\S]*?)(?=\n#{2,4}\s+|$)/i,
  )?.[1] ?? markdown;
  return [...section.matchAll(/^\s*\d+[.)]\s+/gm)].length;
}
