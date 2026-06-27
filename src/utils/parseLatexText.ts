import type { Editor, JSONContent } from '@tiptap/core';
import { migrateMathStrings } from '@tiptap/extension-mathematics';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

export type LatexSegment =
  | { kind: 'text'; content: string }
  | { kind: 'inline'; latex: string }
  | { kind: 'block'; latex: string };

const INLINE_LATEX_PATTERN =
  /\$\$[\s\S]+?\$\$|\$(?!\d+\$)(?!\$)[^$\n]+?\$(?!\d)|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;

/** True if text contains LaTeX in any common delimiter form. */
export function textContainsLatex(text: string): boolean {
  return INLINE_LATEX_PATTERN.test(text);
}

/** Normalize escaped backslashes from HTML clipboard data. */
export function normalizeLatex(latex: string): string {
  return latex.replace(/\\\\/g, '\\').trim();
}

function mergeTextSegments(segments: LatexSegment[]): LatexSegment[] {
  const merged: LatexSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (seg.kind === 'text' && last?.kind === 'text') {
      last.content += seg.content;
    } else if (seg.kind === 'text' && !seg.content) {
      continue;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

function findNextDelimiter(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text.startsWith('$$', i)) return i;
    if (text.startsWith('\\[', i)) return i;
    if (text.startsWith('\\(', i)) return i;
    if (text[i] === '$' && text[i + 1] !== '$') return i;
  }
  return text.length;
}

/**
 * Split plain text into text / inline / block segments.
 * Supports $...$, $$...$$, \\(...\\), and \\[...\\] (Gemini / ChatGPT style).
 */
export function splitLatexSegments(text: string): LatexSegment[] {
  const segments: LatexSegment[] = [];
  let i = 0;

  while (i < text.length) {
    if (text.startsWith('$$', i)) {
      const close = text.indexOf('$$', i + 2);
      if (close !== -1) {
        segments.push({ kind: 'block', latex: normalizeLatex(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    if (text.startsWith('\\[', i)) {
      const close = text.indexOf('\\]', i + 2);
      if (close !== -1) {
        segments.push({ kind: 'block', latex: normalizeLatex(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    if (text.startsWith('\\(', i)) {
      const close = text.indexOf('\\)', i + 2);
      if (close !== -1) {
        segments.push({ kind: 'inline', latex: normalizeLatex(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    if (text[i] === '$' && text[i + 1] !== '$') {
      const close = text.indexOf('$', i + 1);
      if (close !== -1 && text[close + 1] !== '$') {
        const latex = text.slice(i + 1, close);
        if (latex && !/^\d+([.,]\d+)?$/.test(latex.trim())) {
          segments.push({ kind: 'inline', latex: normalizeLatex(latex) });
          i = close + 1;
          continue;
        }
      }
    }

    const next = findNextDelimiter(text, i + 1);
    segments.push({ kind: 'text', content: text.slice(i, next) });
    i = next;
  }

  return mergeTextSegments(segments);
}

export function latexSegmentsToInlineContent(segments: LatexSegment[]): JSONContent[] {
  const content: JSONContent[] = [];
  for (const seg of segments) {
    if (seg.kind === 'text' && seg.content) {
      content.push({ type: 'text', text: seg.content });
    } else if (seg.kind === 'inline') {
      content.push({ type: 'inlineMath', attrs: { latex: seg.latex } });
    }
  }
  return content;
}

/** Build Tiptap doc fragment from plain text that may contain LaTeX. */
export function latexTextToDocContent(text: string): JSONContent {
  const segments = splitLatexSegments(text);
  const hasBlock = segments.some(s => s.kind === 'block');

  if (!hasBlock) {
    const inlineContent = latexSegmentsToInlineContent(segments);
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: inlineContent.length ? inlineContent : undefined }],
    };
  }

  const blocks: JSONContent[] = [];
  let inlineBuffer: JSONContent[] = [];

  const flushParagraph = () => {
    if (inlineBuffer.length > 0) {
      blocks.push({ type: 'paragraph', content: [...inlineBuffer] });
      inlineBuffer = [];
    }
  };

  for (const seg of segments) {
    if (seg.kind === 'text') {
      const parts = seg.content.split('\n');
      parts.forEach((part, idx) => {
        if (part) inlineBuffer.push({ type: 'text', text: part });
        if (idx < parts.length - 1) flushParagraph();
      });
    } else if (seg.kind === 'inline') {
      inlineBuffer.push({ type: 'inlineMath', attrs: { latex: seg.latex } });
    } else if (seg.kind === 'block') {
      flushParagraph();
      blocks.push({ type: 'blockMath', attrs: { latex: seg.latex } });
    }
  }

  flushParagraph();
  if (blocks.length === 0) blocks.push({ type: 'paragraph' });

  return { type: 'doc', content: blocks };
}

function migrateDelimitedMathInEditor(
  editor: Editor,
  pattern: RegExp,
  nodeName: 'inlineMath' | 'blockMath',
): void {
  const nodeType = editor.schema.nodes[nodeName];
  if (!nodeType || editor.isDestroyed || !editor.view) return;

  const matches: Array<{ from: number; to: number; latex: string }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(node.text)) !== null) {
      matches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        latex: normalizeLatex(match[1]),
      });
    }
  });

  if (matches.length === 0) return;

  let tr = editor.state.tr;
  matches.sort((a, b) => b.from - a.from);
  for (const { from, to, latex } of matches) {
    tr.replaceWith(tr.mapping.map(from), tr.mapping.map(to), nodeType.create({ latex }));
  }
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}

/**
 * Convert remaining LaTeX delimiters in the document to rendered math nodes.
 */
export function migrateAllMathInEditor(editor: Editor): void {
  if (!editor.schema.nodes.inlineMath || editor.isDestroyed || !editor.view) return;

  migrateDelimitedMathInEditor(editor, /\$\$([\s\S]+?)\$\$/g, 'blockMath');
  migrateDelimitedMathInEditor(editor, /\\\[([\s\S]+?)\\\]/g, 'blockMath');
  migrateDelimitedMathInEditor(editor, /\\\(([\s\S]+?)\\\)/g, 'inlineMath');
  migrateMathStrings(editor);
}

function mergeAdjacentTextNodes(root: Node): void {
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  let child = root.firstChild;
  while (child) {
    const next = child.nextSibling;
    if (child.nodeType === Node.TEXT_NODE && next?.nodeType === Node.TEXT_NODE) {
      child.textContent = (child.textContent ?? '') + (next.textContent ?? '');
      next.remove();
      continue;
    }
    mergeAdjacentTextNodes(child);
    child = next;
  }
}

function convertLatexInTextNodes(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (let i = textNodes.length - 1; i >= 0; i--) {
    const textNode = textNodes[i];
    const text = textNode.textContent ?? '';
    if (!textContainsLatex(text)) continue;

    const segments = splitLatexSegments(text);
    if (!segments.some(s => s.kind !== 'text')) continue;

    const fragment = document.createDocumentFragment();
    for (const seg of segments) {
      if (seg.kind === 'text') {
        if (seg.content) fragment.appendChild(document.createTextNode(seg.content));
      } else if (seg.kind === 'inline') {
        const span = document.createElement('span');
        span.setAttribute('data-type', 'inline-math');
        span.setAttribute('data-latex', seg.latex);
        fragment.appendChild(span);
      } else if (seg.kind === 'block') {
        const div = document.createElement('div');
        div.setAttribute('data-type', 'block-math');
        div.setAttribute('data-latex', seg.latex);
        fragment.appendChild(div);
      }
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

const MATH_INJECT_SELECTORS =
  'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, div';

/**
 * Replace \\(...\\), \\[...\\], and $...$ in HTML with Tiptap math nodes before parsing.
 * Merges split text nodes so delimiters fragmented by Gemini spans still resolve.
 */
export function injectLatexMathInHtml(html: string): string {
  if (!textContainsLatex(html)) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  body.querySelectorAll(MATH_INJECT_SELECTORS).forEach(el => {
    if (el.querySelector('[data-type="inline-math"], [data-type="block-math"]')) return;
    mergeAdjacentTextNodes(el);
    convertLatexInTextNodes(el);
  });

  return body.innerHTML;
}

/** Insert plain text that may contain LaTeX, rendering math where possible. */
export function insertTextWithLatex(view: EditorView, editor: Editor, text: string): boolean {
  if (!textContainsLatex(text) || editor.isDestroyed) return false;

  const blocks = latexTextToDocContent(text.replace(/\r\n/g, '\n')).content ?? [];
  if (blocks.length === 0) return false;

  try {
    const nodes = blocks.map(block => editor.schema.nodeFromJSON(block));
    const fragment = Fragment.from(nodes);
    const { state } = view;
    view.dispatch(state.tr.replaceSelection(new Slice(fragment, 0, 0)).scrollIntoView());
    return true;
  } catch (error) {
    console.error('LaTeX insert via view failed, trying commands fallback:', error);
    try {
      return editor.commands.insertContent(blocks);
    } catch {
      return false;
    }
  }
}
