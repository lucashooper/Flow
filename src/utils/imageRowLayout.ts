import type { Editor } from '@tiptap/react';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { getEditorContentMaxWidth, IMAGE_ROW_GAP } from './editorLayout';
import { logImageDrop } from './imageDropDebug';

export interface RowImage {
  pos: number;
  node: PMNode;
  width: number;
  height: number;
}

function getEditorContentWidthFromDom(dom: HTMLElement): number {
  const rect = dom.getBoundingClientRect();
  return Math.min(getEditorContentMaxWidth(), rect.width - 48);
}

/** Collect resizableImage nodes in the same paragraph as `pos`. */
export function getRowImagesAtPos(view: EditorView, pos: number): {
  paragraphStart: number;
  images: RowImage[];
} | null {
  const { state } = view;
  const safePos = Math.min(Math.max(1, pos), state.doc.content.size - 1);
  const $pos = state.doc.resolve(safePos);

  if ($pos.parent.type.name !== 'paragraph') return null;

  const paragraphStart = $pos.start();
  const images: RowImage[] = [];

  $pos.parent.forEach((node, offset) => {
    if (node.type.name === 'resizableImage') {
      const w = (node.attrs.width as number) || 320;
      const h = (node.attrs.height as number) || Math.round(w * 0.65);
      images.push({ pos: paragraphStart + offset, node, width: w, height: h });
    }
  });

  if (images.length === 0) return null;
  return { paragraphStart, images };
}

/** Evenly distribute widths across a multi-image row. */
export function autoFitImagesInParagraph(
  editorOrView: Editor | EditorView,
  posInDoc: number,
  force = false,
): boolean {
  const view = 'view' in editorOrView ? editorOrView.view : editorOrView;
  const row = getRowImagesAtPos(view, posInDoc);
  if (!row || row.images.length < 2) return false;

  const maxWidth = getEditorContentWidthFromDom(view.dom as HTMLElement);
  const gaps = IMAGE_ROW_GAP * (row.images.length - 1);
  const fitWidth = Math.floor((maxWidth - gaps) / row.images.length);
  const finalWidth = Math.max(120, fitWidth);

  if (!force) {
    const total = row.images.reduce((sum, img) => sum + img.width, 0);
    if (total + gaps <= maxWidth) return false;
  }

  let tr = view.state.tr;
  for (const img of [...row.images].sort((a, b) => b.pos - a.pos)) {
    const ratio = img.width > 0 ? img.height / img.width : 0.65;
    tr = tr.setNodeMarkup(img.pos, undefined, {
      ...img.node.attrs,
      width: finalWidth,
      height: Math.round(finalWidth * ratio),
    });
  }
  view.dispatch(tr);
  logImageDrop(`autoFit done — width=${finalWidth}px × ${row.images.length}`);
  return true;
}

/** Resize one column; redistribute remaining width across siblings. */
export function resizeImageInRow(
  editor: Editor,
  imagePos: number,
  newWidth: number,
): void {
  const row = getRowImagesAtPos(editor.view, imagePos);
  if (!row) return;

  const { images } = row;
  const maxWidth = getEditorContentWidthFromDom(editor.view.dom as HTMLElement);
  const gaps = IMAGE_ROW_GAP * Math.max(0, images.length - 1);
  const available = maxWidth - gaps;
  const minCol = 120;

  if (images.length === 1) {
    const clamped = Math.max(minCol, Math.min(newWidth, available));
    const ratio = images[0].width > 0 ? images[0].height / images[0].width : 0.65;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(imagePos, undefined, {
        ...images[0].node.attrs,
        width: Math.round(clamped),
        height: Math.round(clamped * ratio),
      }),
    );
    return;
  }

  const resizedIndex = images.findIndex((img) => img.pos === imagePos);
  if (resizedIndex < 0) return;

  const others = images.filter((_, i) => i !== resizedIndex);
  const maxForResized = available - minCol * others.length;
  const clampedNew = Math.max(minCol, Math.min(newWidth, maxForResized));
  const remaining = available - clampedNew;
  const otherTotal = others.reduce((s, img) => s + img.width, 0);

  let tr = editor.state.tr;
  for (const img of images) {
    let w: number;
    if (img.pos === imagePos) {
      w = clampedNew;
    } else {
      w =
        otherTotal > 0
          ? Math.round((img.width / otherTotal) * remaining)
          : Math.round(remaining / others.length);
      w = Math.max(minCol, w);
    }
    const ratio = img.width > 0 ? img.height / img.width : 0.65;
    tr = tr.setNodeMarkup(img.pos, undefined, {
      ...img.node.attrs,
      width: Math.round(w),
      height: Math.round(w * ratio),
    });
  }
  editor.view.dispatch(tr);
  logImageDrop('row resize', { imagePos, clampedNew, siblings: others.length });
}

/** Apply a spring snap-in animation to the dropped image DOM node. */
export function animateImageSnap(view: EditorView, nodePos: number): void {
  requestAnimationFrame(() => {
    try {
      const dom = view.nodeDOM(nodePos);
      const el =
        dom instanceof HTMLElement
          ? dom.classList.contains('resizable-image-wrapper')
            ? dom
            : (dom.querySelector('.resizable-image-wrapper') as HTMLElement | null)
          : null;
      if (!el) return;
      el.classList.remove('flow-image-snap');
      void el.offsetWidth;
      el.classList.add('flow-image-snap');
      el.addEventListener(
        'animationend',
        () => el.classList.remove('flow-image-snap'),
        { once: true },
      );
    } catch {
      // nodeDOM can fail after rapid updates
    }
  });
}

export type BlockInsertAction =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'blockquote'
  | 'bulletList'
  | 'taskList'
  | 'code'
  | 'image';

/** Insert a block in the gap between two adjacent row images. */
export function insertBlockBetweenImages(
  editor: Editor,
  leftImagePos: number,
  action: BlockInsertAction,
): void {
  const leftNode = editor.state.doc.nodeAt(leftImagePos);
  if (!leftNode || leftNode.type.name !== 'resizableImage') return;

  const insertPos = leftImagePos + leftNode.nodeSize;
  logImageDrop('insert between images', action, 'after', leftImagePos);

  if (action === 'image') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      window.dispatchEvent(
        new CustomEvent('flow:insertMediaAtPos', {
          detail: { pos: insertPos, file },
        }),
      );
    };
    input.click();
    return;
  }

  if (action === 'text') {
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, ' ')
      .setTextSelection(insertPos + 1)
      .run();
    return;
  }

  // Block-level types: split row — insert new paragraph after the image row
  const $pos = editor.state.doc.resolve(leftImagePos);
  const rowEnd = $pos.after();

  const chain = editor.chain().focus().insertContentAt(rowEnd, '<p></p>');
  chain.run();

  const newPos = rowEnd + 1;
  const blockChain = editor.chain().focus().setTextSelection(newPos);

  switch (action) {
    case 'heading1':
      blockChain.toggleHeading({ level: 1 }).run();
      break;
    case 'heading2':
      blockChain.toggleHeading({ level: 2 }).run();
      break;
    case 'heading3':
      blockChain.toggleHeading({ level: 3 }).run();
      break;
    case 'blockquote':
      blockChain.toggleBlockquote().run();
      break;
    case 'bulletList':
      blockChain.toggleBulletList().run();
      break;
    case 'taskList':
      blockChain.toggleTaskList().run();
      break;
    case 'code':
      blockChain.toggleCodeBlock().run();
      break;
    default:
      break;
  }
}

/** Resolve DOM position for gutter between two adjacent image wrappers. */
export function getImageGutterRects(editor: Editor): Array<{
  left: number;
  top: number;
  height: number;
  leftImagePos: number;
}> {
  const gutters: Array<{
    left: number;
    top: number;
    height: number;
    leftImagePos: number;
  }> = [];

  const { view } = editor;
  const root = view.dom as HTMLElement;

  const paragraphs = root.querySelectorAll(
    'p:has(.resizable-image-wrapper + .resizable-image-wrapper)',
  );

  paragraphs.forEach((p) => {
    const wrappers = Array.from(
      p.querySelectorAll(':scope > .resizable-image-wrapper'),
    ) as HTMLElement[];

    for (let i = 0; i < wrappers.length - 1; i++) {
      const leftRect = wrappers[i].getBoundingClientRect();
      const rightRect = wrappers[i + 1].getBoundingClientRect();
      const gapCenter = (leftRect.right + rightRect.left) / 2;

      try {
        let leftPos = view.posAtDOM(wrappers[i], 0);
        const nodeAt = view.state.doc.nodeAt(leftPos);
        if (nodeAt?.type.name !== 'resizableImage') {
          const $pos = view.state.doc.resolve(leftPos);
          if ($pos.nodeBefore?.type.name === 'resizableImage') {
            leftPos = leftPos - $pos.nodeBefore.nodeSize;
          } else if ($pos.nodeAfter?.type.name !== 'resizableImage') {
            continue;
          }
        }

        gutters.push({
          left: gapCenter,
          top: Math.min(leftRect.top, rightRect.top),
          height: Math.max(leftRect.height, rightRect.height),
          leftImagePos: leftPos,
        });
      } catch {
        // posAtDOM can fail during rapid updates
      }
    }
  });

  return gutters;
}
