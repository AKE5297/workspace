import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-'
});

turndown.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`
});

turndown.addRule('imageLocal', {
  filter: 'img',
  replacement: (content, node) => {
    const img = node;
    const alt = img.getAttribute('alt') || '';
    const src = img.getAttribute('src') || '';
    if (!src) return '';
    return `![${alt}](${src})`;
  }
});

function escapePipe(text) {
  return String(text || '').replace(/\|/g, '\\|');
}

turndown.addRule('tableWrap', {
  filter: 'table',
  replacement: (content, node) => {
    const table = node;
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return '\n\n';
    const lines = [];
    rows.forEach((tr, i) => {
      const cells = Array.from(tr.children).map((td) => escapePipe(td.textContent.trim()));
      lines.push(`| ${cells.join(' | ')} |`);
      if (i === 0) {
        lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
      }
    });
    return `\n\n${lines.join('\n')}\n\n`;
  }
});

export function htmlToMarkdown(html) {
  if (!html) return '';
  try {
    return turndown.turndown(html);
  } catch (e) {
    return '';
  }
}
