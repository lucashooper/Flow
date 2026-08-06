import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from 'prosemirror-model';

export function logImageDrop(...args: unknown[]): void {
  // Always log — helps debug in devtools even when filters hide other noise
  console.log('[ImageDrop]', ...args);
}

export function describeDocImages(editor: Editor, label = 'doc'): void {

  const rows: string[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') {
      const images: string[] = [];
      node.forEach((child, offset) => {
        if (child.type.name === 'resizableImage') {
          images.push(
            `@${pos + 1 + offset} w=${child.attrs.width ?? '?'} src=${String(child.attrs.src ?? '').slice(0, 40)}`,
          );
        }
      });
      if (images.length) {
        rows.push(`  p@${pos} (${images.length} img): ${images.join(' | ')}`);
      }
    }
  });

  logImageDrop(`${label} — ${rows.length ? rows.join('\n') : '(no image paragraphs)'}`);
}

export function describeParagraphAt(editor: Editor, pos: number): void {
  const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size - 1));
  logImageDrop(`resolve(${pos}) → parent=${$pos.parent.type.name} depth=${$pos.depth} start=${$pos.start()} end=${$pos.end()}`);
}

export function extractImagesFromHtml(html: string): Array<{
  src: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('img[src]');
  const results: Array<{
    src: string;
    width: number | null;
    height: number | null;
    alt: string | null;
  }> = [];

  imgs.forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;

    const widthAttr = img.getAttribute('width');
    const heightAttr = img.getAttribute('height');
    const style = img.getAttribute('style') ?? '';
    const widthStyle = style.match(/(?:^|;)\s*width:\s*([\d.]+)px/i);
    const heightStyle = style.match(/(?:^|;)\s*height:\s*([\d.]+)px/i);

    results.push({
      src,
      width: widthAttr
        ? parseInt(widthAttr, 10)
        : widthStyle
          ? parseInt(widthStyle[1], 10)
          : null,
      height: heightAttr
        ? parseInt(heightAttr, 10)
        : heightStyle
          ? parseInt(heightStyle[1], 10)
          : null,
      alt: img.getAttribute('alt'),
    });
  });

  return results;
}

/** Insert resizableImage nodes parsed from clipboard HTML (internal copy/paste). */
export function pasteImagesFromHtml(html: string, view: Editor['view']): boolean {
  const images = extractImagesFromHtml(html);
  if (!images.length) return false;

  const imageNode =
    view.state.schema.nodes.resizableImage || view.state.schema.nodes.image;
  if (!imageNode) return false;

  logImageDrop('pasteImagesFromHtml', images);

  let tr = view.state.tr;
  images.forEach((img, index) => {
    const attrs: Record<string, unknown> = { src: img.src };
    if (img.width) attrs.width = img.width;
    if (img.height) attrs.height = img.height;
    if (img.alt) attrs.alt = img.alt;

    const node = imageNode.create(attrs);
    if (index === 0) {
      tr = tr.replaceSelectionWith(node);
    } else {
      const pos = tr.selection.to;
      tr = tr.insert(pos, node);
    }
  });

  view.dispatch(tr.scrollIntoView());
  return true;
}

export function countImagesInParagraph(parent: PMNode): number {
  let count = 0;
  parent.forEach((child) => {
    if (child.type.name === 'resizableImage') count++;
  });
  return count;
}
