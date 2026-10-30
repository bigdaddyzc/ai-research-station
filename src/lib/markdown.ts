export function renderMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let listStack: Array<'ul' | 'ol'> = [];
  let codeBlock: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${paragraph.map(l => inlineFormat(l)).join(' ')}</p>`);
      paragraph = [];
    }
  };

  const closeAllLists = () => {
    while (listStack.length > 0) {
      html.push(`</${listStack.pop()}>`);
    }
  };

  const ensureList = (type: 'ul' | 'ol') => {
    if (listStack.length === 0 || listStack[listStack.length - 1] !== type) {
      closeAllLists();
      html.push(`<${type}>`);
      listStack.push(type);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      closeAllLists();
      if (codeBlock) {
        html.push(`<pre><code>${escapeHtml(codeBlock.join('\n'))}</code></pre>`);
        codeBlock = null;
      } else {
        codeBlock = [];
      }
      continue;
    }

    if (codeBlock) {
      codeBlock.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeAllLists();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeAllLists();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      html.push(`<h${level}>${inlineFormat(text)}</h${level}>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[*\-+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      ensureList('ul');
      html.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      ensureList('ol');
      html.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    const bqMatch = trimmed.match(/^>\s?(.*)$/);
    if (bqMatch) {
      flushParagraph();
      closeAllLists();
      html.push(`<blockquote><p>${inlineFormat(bqMatch[1])}</p></blockquote>`);
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushParagraph();
      closeAllLists();
      html.push('<hr />');
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  closeAllLists();
  if (codeBlock) html.push(`<pre><code>${escapeHtml(codeBlock.join('\n'))}</code></pre>`);
  return html.join('\n');
}

function inlineFormat(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\[\^(\d+)\^\]/g, '<sup>[$1]</sup>');
  return s;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
