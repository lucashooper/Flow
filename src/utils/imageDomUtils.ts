import type { Editor } from '@tiptap/react';
import type { EditorView } from 'prosemirror-view';

export function findImageWrapper(el: Element | null): HTMLElement | null {
  return el?.closest?.('.resizable-image-wrapper') as HTMLElement | null;
}

/** Resolve document position for a resizable image DOM element. */
export function getImageNodePos(editor: Editor, el: HTMLElement): number | null {
  return getImageNodePosFromView(editor.view, el);
}

export function getImageNodePosFromView(view: EditorView, el: HTMLElement): number | null {
  const { state } = view;

  try {
    const domPos = view.posAtDOM(el, 0);
    if (domPos >= 0) {
      const nodeAt = state.doc.nodeAt(domPos);
      if (nodeAt?.type.name === 'resizableImage') return domPos;

      const $pos = state.doc.resolve(domPos);
      if ($pos.nodeAfter?.type.name === 'resizableImage') return domPos;
      if ($pos.nodeBefore?.type.name === 'resizableImage') {
        return domPos - $pos.nodeBefore.nodeSize;
      }
    }
  } catch {
    // posAtDOM can throw for detached nodes
  }

  const img =
    el.tagName === 'IMG'
      ? (el as HTMLImageElement)
      : (el.querySelector('img') as HTMLImageElement | null);
  const src = img?.getAttribute('src');
  if (!src) return null;

  let found: number | null = null;
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'resizableImage' && node.attrs.src === src) {
      found = pos;
      return false;
    }
  });
  return found;
}
