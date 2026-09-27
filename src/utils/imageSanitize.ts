import type { Editor } from '@tiptap/react';

/**
 * Remove orphan "drag" text nodes left in image paragraphs by broken HTML5 drag attempts.
 * Only strips exact "drag" text when the parent paragraph also contains an image.
 */
export function stripStrayDragTextNodes(editor: Editor): boolean {
  const { state } = editor;
  const ranges: Array<[number, number]> = [];

  state.doc.descendants((node, pos, parent) => {
    if (!node.isText || node.text !== 'drag' || !parent) return;

    let hasImage = false;
    parent.forEach((child) => {
      if (child.type.name === 'resizableImage') hasImage = true;
    });

    if (hasImage) {
      ranges.push([pos, pos + node.nodeSize]);
    }
  });

  if (ranges.length === 0) return false;

  let tr = state.tr;
  ranges
    .sort((a, b) => b[0] - a[0])
    .forEach(([from, to]) => {
      tr = tr.delete(from, to);
    });

  editor.view.dispatch(tr);
  console.log('[EditorDrag] stripped stray drag text nodes:', ranges.length);
  return true;
}
