/**
 * Sanitize pasted HTML from external sources (Gemini, ChatGPT, Google Docs, etc.).
 * Preserves structure (headings, lists, paragraphs, bold/italic) and spacing,
 * while stripping font-family and color so pasted text stays readable on any theme.
 */

const BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE',
  'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'DIV',
]);

const STRIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE', 'NOSCRIPT']);

function parseInlineStyle(style: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of style.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const key = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (key && value) map.set(key, value);
  }
  return map;
}

function fontSizeToHeadingLevel(fontSize: string): number | null {
  const lower = fontSize.toLowerCase();
  const pxMatch = lower.match(/^([\d.]+)\s*px$/);
  if (pxMatch) {
    const px = parseFloat(pxMatch[1]);
    if (px >= 28) return 1;
    if (px >= 22) return 2;
    if (px >= 18) return 3;
    if (px >= 15) return 4;
    return null;
  }
  const emMatch = lower.match(/^([\d.]+)\s*(em|rem)$/);
  if (emMatch) {
    const em = parseFloat(emMatch[1]);
    if (em >= 1.75) return 2;
    if (em >= 1.4) return 3;
    if (em >= 1.15) return 4;
  }
  if (lower === 'x-large' || lower === 'xx-large') return 2;
  if (lower === 'large') return 3;
  return null;
}

function isBoldStyle(styles: Map<string, string>): boolean {
  const weight = styles.get('font-weight');
  return weight === 'bold' || weight === '700' || weight === '800' || weight === '900';
}

function isItalicStyle(styles: Map<string, string>): boolean {
  const style = styles.get('font-style');
  return style === 'italic' || style === 'oblique';
}

function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

function wrapChildren(el: Element, wrapperTag: string): Element {
  const wrapper = el.ownerDocument.createElement(wrapperTag);
  while (el.firstChild) {
    wrapper.appendChild(el.firstChild);
  }
  el.appendChild(wrapper);
  return wrapper;
}

function promoteBlockToHeading(el: HTMLElement, level: number): void {
  const tag = `H${Math.min(6, Math.max(1, level))}`;
  const heading = el.ownerDocument.createElement(tag);
  while (el.firstChild) {
    heading.appendChild(el.firstChild);
  }
  el.replaceWith(heading);
}

function sanitizeElement(el: Element, options: { preserveColors: boolean }): void {
  const tag = el.tagName;

  if (STRIP_TAGS.has(tag)) {
    el.remove();
    return;
  }

  // Process children first (copy list — tree may mutate)
  for (const child of [...el.children]) {
    sanitizeElement(child, options);
  }

  if (tag === 'FONT') {
    unwrapElement(el);
    return;
  }

  if (el instanceof HTMLElement) {
    const styles = el.getAttribute('style')
      ? parseInlineStyle(el.getAttribute('style')!)
      : new Map<string, string>();

    const bold = isBoldStyle(styles) || tag === 'B' || tag === 'STRONG';
    const italic = isItalicStyle(styles) || tag === 'I' || tag === 'EM';
    const headingLevel = fontSizeToHeadingLevel(styles.get('font-size') ?? '');

    // Strip visual-only attributes; keep semantic structure
    el.removeAttribute('class');
    el.removeAttribute('color');
    el.removeAttribute('bgcolor');
    el.removeAttribute('face');
    el.removeAttribute('size');
    el.removeAttribute('id');
    el.removeAttribute('data-id');

    if (!options.preserveColors) {
      el.removeAttribute('style');
    } else {
      // Internal paste: drop color/font but keep other layout styles if needed
      const kept: string[] = [];
      for (const [key, value] of styles) {
        if (key === 'color' || key === 'font-family' || key === 'background' || key === 'background-color') {
          continue;
        }
        kept.push(`${key}: ${value}`);
      }
      if (kept.length) el.setAttribute('style', kept.join('; '));
      else el.removeAttribute('style');
    }

    // Convert block elements with large font to headings
    if (headingLevel && (tag === 'P' || tag === 'DIV')) {
      promoteBlockToHeading(el, headingLevel);
      return;
    }

    if (tag === 'DIV') {
      const hasBlockChild = [...el.children].some(c => BLOCK_TAGS.has(c.tagName));
      if (!hasBlockChild && el.textContent?.trim()) {
        const p = el.ownerDocument.createElement('p');
        while (el.firstChild) p.appendChild(el.firstChild);
        el.replaceWith(p);
        return;
      }
    }

    if (tag === 'SPAN') {
      const hasBlockChild = [...el.children].some(c => BLOCK_TAGS.has(c.tagName));
      if (!hasBlockChild) {
        if (bold && italic) {
          const strong = wrapChildren(el, 'strong');
          const em = el.ownerDocument.createElement('em');
          while (strong.firstChild) em.appendChild(strong.firstChild);
          strong.appendChild(em);
        } else if (bold) {
          wrapChildren(el, 'strong');
        } else if (italic) {
          wrapChildren(el, 'em');
        } else {
          unwrapElement(el);
        }
      }
      return;
    }

    if ((tag === 'P' || tag === 'DIV') && bold && !el.querySelector('strong, b') && el.textContent?.trim()) {
      const onlyText = el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE;
      if (onlyText || headingLevel) {
        wrapChildren(el, 'strong');
      }
    }
  }
}

function removeOfficeArtifacts(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<o:p>[\s\S]*?<\/o:p>/g, '')
    .replace(/<\/o:p>/g, '')
    .replace(/<w:[\s\S]*?>/g, '')
    .replace(/<m:[\s\S]*?>/g, '')
    .replace(/<xml>[\s\S]*?<\/xml>/g, '')
    .replace(/<\?xml[\s\S]*?\?>/g, '');
}

/** True when clipboard HTML carries structure worth preserving over plain text. */
export function htmlHasStructure(html: string): boolean {
  if (!html.trim()) return false;

  const doc = new DOMParser().parseFromString(removeOfficeArtifacts(html), 'text/html');
  const body = doc.body;
  if (!body?.textContent?.trim()) return false;

  const blocks = body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, table, div, br');
  if (blocks.length > 1) return true;

  if (body.querySelector('h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, table')) {
    return true;
  }

  if (body.querySelector('[style*="font-size"], [style*="font-weight"]')) {
    return true;
  }

  const lineBreaks = (body.innerHTML.match(/<br\s*\/?>/gi) ?? []).length;
  if (lineBreaks >= 2) return true;

  const text = body.textContent ?? '';
  const lines = text.split(/\n/).filter(l => l.trim());
  return lines.length > 2;
}

export function isInternalFlowPaste(html: string): boolean {
  return (
    html.includes('data-type="') ||
    html.includes('class="ProseMirror') ||
    html.includes('style="color:') ||
    html.includes('style="font-size:') ||
    html.includes('<mark ') ||
    (html.includes('<span') && html.includes('style=') &&
      (html.includes('color') || html.includes('font-size')))
  );
}

/** Build Tiptap blocks from plain text, preserving paragraph breaks and markdown headings. */
export function plainTextToDocBlocks(text: string): Array<Record<string, unknown>> {
  const normalized = text.replace(/\r\n/g, '\n');
  const chunks = normalized.split(/\n{2,}/);
  const blocks: Array<Record<string, unknown>> = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        blocks.push({
          type: 'heading',
          attrs: { level: headingMatch[1].length },
          content: [{ type: 'text', text: headingMatch[2] }],
        });
        continue;
      }

      const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (orderedMatch) {
        const last = blocks[blocks.length - 1];
        const listItem = {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: orderedMatch[2] }] }],
        };
        if (last?.type === 'orderedList') {
          (last.content as Array<Record<string, unknown>>).push(listItem);
        } else {
          blocks.push({ type: 'orderedList', content: [listItem] });
        }
        continue;
      }

      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: trimmed }],
      });
    }
  }

  return blocks.length ? blocks : [{ type: 'paragraph' }];
}

export function sanitizePastedHtml(
  html: string,
  options: { preserveColors?: boolean } = {},
): string {
  const preserveColors = options.preserveColors ?? false;
  const cleaned = removeOfficeArtifacts(html);

  const doc = new DOMParser().parseFromString(cleaned, 'text/html');
  const body = doc.body;

  // Drop wrapper noise
  for (const el of [...body.querySelectorAll('style, meta, link, script, head')]) {
    el.remove();
  }

  for (const child of [...body.children]) {
    sanitizeElement(child, { preserveColors });
  }

  // Unwrap redundant nested paragraphs/divs
  body.querySelectorAll('p p, div p:only-child').forEach(el => {
    if (el.parentElement && (el.parentElement.tagName === 'P' || el.parentElement.tagName === 'DIV')) {
      unwrapElement(el);
    }
  });

  // Promote bold-only paragraphs to headings (common in Gemini / ChatGPT exports)
  body.querySelectorAll('p').forEach(p => {
    const text = p.textContent?.trim();
    if (!text || text.length > 120) return;

    const children = [...p.childNodes].filter(n => n.nodeType !== Node.TEXT_NODE || n.textContent?.trim());
    const isSingleStrong =
      children.length === 1 &&
      children[0] instanceof Element &&
      (children[0].tagName === 'STRONG' || children[0].tagName === 'B') &&
      children[0].textContent?.trim() === text;

    if (isSingleStrong) {
      promoteBlockToHeading(p, 3);
    }
  });

  return body.innerHTML.trim();
}
