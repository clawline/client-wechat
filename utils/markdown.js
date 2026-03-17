/**
 * Lightweight Markdown parser for WeChat miniprogram.
 * Converts markdown text to an array of typed nodes for WXML rendering.
 *
 * Supported: paragraphs, headings (#/##/###), bold (**), inline code (`),
 * code blocks (```), unordered lists (- / *), ordered lists (1.), blockquotes (>), links ([]()), hr (---).
 */

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseInline(text) {
  // Returns an array of inline segments: { type: 'text'|'bold'|'code'|'link', text, href? }
  const segments = [];
  let remaining = text;

  while (remaining.length > 0) {
    // inline code
    let m = remaining.match(/^`([^`]+)`/);
    if (m) {
      segments.push({ type: 'code', text: m[1] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // bold
    m = remaining.match(/^\*\*(.+?)\*\*/);
    if (m) {
      segments.push({ type: 'bold', text: m[1] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // link
    m = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (m) {
      segments.push({ type: 'link', text: m[1], href: m[2] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // plain text until next special char
    m = remaining.match(/^[^`*\[]+/);
    if (m) {
      segments.push({ type: 'text', text: m[0] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // fallback: consume one char
    segments.push({ type: 'text', text: remaining[0] });
    remaining = remaining.slice(1);
  }

  return segments;
}

function parseMarkdown(text) {
  if (!text) return [{ type: 'paragraph', segments: [{ type: 'text', text: '' }] }];

  const lines = text.split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push({ type: 'codeblock', text: codeLines.join('\n'), lang: lang || '' });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      nodes.push({ type: 'heading', level: level, segments: parseInline(headingMatch[2]) });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      nodes.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s?/, '');
      nodes.push({ type: 'blockquote', segments: parseInline(quoteText) });
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push({ segments: parseInline(lines[i].replace(/^\s*[-*]\s+/, '')) });
        i++;
      }
      nodes.push({ type: 'ul', items: items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push({ segments: parseInline(lines[i].replace(/^\s*\d+\.\s+/, '')) });
        i++;
      }
      nodes.push({ type: 'ol', items: items });
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    nodes.push({ type: 'paragraph', segments: parseInline(line) });
    i++;
  }

  return nodes.length > 0 ? nodes : [{ type: 'paragraph', segments: [{ type: 'text', text: text }] }];
}

module.exports = { parseMarkdown };
