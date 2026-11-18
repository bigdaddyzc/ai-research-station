export function renderMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let listStack: Array<'ul' | 'ol'> = [];
  let codeBlock: string[] | null = null;
  let inTable = false;
  const closeTable = () => {
    if (inTable) {
      html.push('</tbody></table></div>');
      inTable = false;
    }
  };

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
      closeTable();
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

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph();
      closeAllLists();
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!inTable) {
        html.push('<div class="table-wrap"><table><thead><tr>' + cells.map((c) => `<th>${inlineFormat(c)}</th>`).join('') + '</tr></thead><tbody>');
        inTable = true;
      } else {
        html.push('<tr>' + cells.map((c) => `<td>${inlineFormat(c)}</td>`).join('') + '</tr>');
      }
      continue;
    }
    closeTable();

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

    // GFM table: header row + separator row (| --- | --- |) + data rows.
    // Only treated as a table when the next line is a valid separator row
    // with the same number of cells; otherwise the line stays a paragraph.
    const headerCells = parseTableRow(trimmed);
    if (headerCells && i + 1 < lines.length) {
      const separatorCells = parseTableRow(lines[i + 1].trim());
      if (separatorCells && separatorCells.length === headerCells.length && isSeparatorRow(separatorCells)) {
        flushParagraph();
        closeAllLists();
        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length) {
          const rowCells = parseTableRow(lines[j].trim());
          if (!rowCells) break;
          rows.push(rowCells);
          j++;
        }
        const normalize = (cells: string[]): string[] => {
          const out = cells.slice(0, headerCells.length);
          while (out.length < headerCells.length) out.push('');
          return out;
        };
        html.push(`<div class="table-scroll"><table><thead><tr>${headerCells.map((c) => `<th>${inlineFormat(shortenHeader(c))}</th>`).join('')}</tr></thead><tbody>`);
        for (const row of rows) {
          html.push(`<tr>${normalize(row).map((c) => `<td>${inlineFormat(c)}</td>`).join('')}</tr>`);
        }
        html.push('</tbody></table></div>');
        i = j - 1;
        continue;
      }
    }

    paragraph.push(trimmed);
  }

  closeTable();
  flushParagraph();
  closeAllLists();
  if (codeBlock) html.push(`<pre><code>${escapeHtml(codeBlock.join('\n'))}</code></pre>`);
  return html.join('\n');
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const cells = trimmed.split('|').map((c) => c.trim());
  if (cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  if (cells.length === 0) return null;
  return cells;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** Shorten the known long pricing-table headers so columns don't crush. */
const SHORT_HEADERS: Record<string, string> = {
  '比较维度': '维度',
  '开放权重模型平均价格': '开源模型均价',
  '闭源私有模型参考价格': '闭源模型参考价',
  '策略控制后缀': '策略后缀',
  '对应支持 API 结构': '支持 API',
};

function shortenHeader(cell: string): string {
  return SHORT_HEADERS[cell.trim()] ?? cell;
}

/** Strip Markdown syntax to plain text (for summaries shown in cards/feeds). */
export function stripMarkdown(text: string): string {
  let s = text;
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function inlineFormat(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/(^|[\s(（：:])(https?:\/\/[^\s<>"'）)]+)/g, (_m, pre: string, url: string) => {
    let label = url;
    try { label = new URL(url.replaceAll('&amp;', '&')).hostname.replace(/^www\./, ''); } catch { /* keep url */ }
    return `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
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
