import type { Editor, JSONContent } from '@tiptap/core';
import { migrateMathStrings } from '@tiptap/extension-mathematics';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

export type LatexSegment =
  | { kind: 'text'; content: string }
  | { kind: 'inline'; latex: string }
  | { kind: 'block'; latex: string };

/** True if text contains Markdown/Gemini LaTeX delimiters. */
export function textContainsLatex(text: string): boolean {
  return /\$\$[\s\S]+?\$\$|\$(?!\d+\$)(?!\$)[^$\n]+?\$(?!\d)/.test(text);
}

/**
 * Split plain text into text / inline ($...$) / block ($$...$$) segments.
 */
export function splitLatexSegments(text: string): LatexSegment[] {
  const segments: LatexSegment[] = [];
  let i = 0;

  while (i < text.length) {
    if (text.startsWith('$$', i)) {
      const close = text.indexOf('$$', i + 2);
      if (close !== -1) {
        segments.push({ kind: 'block', latex: text.slice(i + 2, close).trim() });
        i = close + 2;
        continue;
      }
    }

    if (text[i] === '$' && text[i + 1] !== '$') {
      const close = text.indexOf('$', i + 1);
      if (close !== -1 && text[close + 1] !== '$') {
        const latex = text.slice(i + 1, close);
        if (latex && !/^\d+([.,]\d+)?$/.test(latex.trim())) {
          segments.push({ kind: 'inline', latex: latex.trim() });
          i = close + 1;
          continue;
        }
      }
    }

    let next = i + 1;
    while (next < text.length && text[next] !== '$') next++;
    segments.push({ kind: 'text', content: text.slice(i, next) });
    i = next;
  }

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

/** Build Tiptap doc fragment from plain text that may contain LaTeX. */
export function latexTextToDocContent(text: string): JSONContent {
  const segments = splitLatexSegments(text);
  const hasBlock = segments.some(s => s.kind === 'block');

  if (!hasBlock) {
    const inlineContent: JSONContent[] = [];
    for (const seg of segments) {
      if (seg.kind === 'text' && seg.content) {
        inlineContent.push({ type: 'text', text: seg.content });
      } else if (seg.kind === 'inline') {
        inlineContent.push({ type: 'inlineMath', attrs: { latex: seg.latex } });
      }
    }
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

/**
 * Convert remaining $...$ and $$...$$ in the document to rendered math nodes.
 */
export function migrateAllMathInEditor(editor: Editor): void {
  if (!editor.schema.nodes.inlineMath || editor.isDestroyed || !editor.view) return;

  const blockMath = editor.schema.nodes.blockMath;
  const blockMatches: Array<{ from: number; to: number; latex: string }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text?.includes('$$')) return;
    const regex = /\$\$([\s\S]+?)\$\$/g;
    let match;
    while ((match = regex.exec(node.text)) !== null) {
      blockMatches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        latex: match[1].trim(),
      });
    }
  });

  if (blockMatches.length > 0 && blockMath) {
    let tr = editor.state.tr;
    blockMatches.sort((a, b) => b.from - a.from);
    for (const { from, to, latex } of blockMatches) {
      tr.replaceWith(tr.mapping.map(from), tr.mapping.map(to), blockMath.create({ latex }));
    }
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }

  migrateMathStrings(editor);
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
