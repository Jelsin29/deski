// A deliberately small Markdown subset for assistant replies: paragraphs,
// headings, lists, fenced code, inline code, bold and italic.
// All text is HTML-escaped before any markup is added, so the result is safe
// to assign to innerHTML.

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const FENCE = /```[^\n]*\n([\s\S]*?)(?:```|$)/g;
const UNORDERED_ITEM = /^\s*[-*]\s+/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+/;
const HEADING = /^(#{1,3})\s+(.*)$/;

function renderInline(text: string): string {
  // Odd segments are inside backticks and must stay literal.
  return text
    .split('`')
    .map((segment, index) => {
      const escaped = escapeHtml(segment);
      if (index % 2 === 1) return `<code>${escaped}</code>`;
      return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    })
    .join('');
}

type ListTag = 'ul' | 'ol';

interface OpenList {
  tag: ListTag;
  items: string[];
}

function listTagOf(line: string): ListTag | null {
  if (UNORDERED_ITEM.test(line)) return 'ul';
  if (ORDERED_ITEM.test(line)) return 'ol';
  return null;
}

/** Renders one blank-line separated block, line by line. */
function renderBlock(block: string): string {
  const html: string[] = [];
  let paragraph: string[] = [];
  // Annotated via `as` so TypeScript does not narrow it to null; the flush helpers reassign it.
  let list = null as OpenList | null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) html.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (list) {
      const items = list.items.map((item) => `<li>${renderInline(item)}</li>`).join('');
      html.push(`<${list.tag}>${items}</${list.tag}>`);
    }
    list = null;
  };

  for (const line of block.split('\n')) {
    const tag = listTagOf(line);
    if (tag) {
      flushParagraph();
      if (list?.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push(line.replace(tag === 'ul' ? UNORDERED_ITEM : ORDERED_ITEM, ''));
      continue;
    }

    flushList();
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      const level = (heading[1]?.length ?? 1) + 2; // # → h3, keeps replies below page titles
      html.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return html.join('');
}

function renderText(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map(renderBlock)
    .join('');
}

export function renderMarkdown(source: string): string {
  const normalized = source.replace(/\r\n?/g, '\n');
  let html = '';
  let cursor = 0;

  for (const match of normalized.matchAll(FENCE)) {
    html += renderText(normalized.slice(cursor, match.index));
    html += `<pre><code>${escapeHtml((match[1] ?? '').replace(/\n$/, ''))}</code></pre>`;
    cursor = match.index + match[0].length;
  }
  return html + renderText(normalized.slice(cursor));
}
