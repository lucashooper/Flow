import type { Editor } from '@tiptap/react';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { dropPoint } from 'prosemirror-transform';
import { moveEditorNode } from './moveEditorNode';
import {
  animateImageSnap,
  autoFitImagesInParagraph,
} from './imageRowLayout';
import {
  describeDocImages,
  logImageDrop,
} from './imageDropDebug';
import {
  executeColumnDrop,
  findImageHitAtPointer,
  isColumnDropKind,
  previewBlockLineDrop,
  previewColumnDropOnImage,
} from './imageColumnDrop';
import { findImageWrapper, getImageNodePosFromView } from './imageDomUtils';

export { getImageNodePos } from './imageDomUtils';

export { autoFitImagesInParagraph } from './imageRowLayout';

export type ImageDropKind = 'same-row-before' | 'same-row-after' | 'line' | 'block';

export interface DropLineIndicator {
  orientation: 'vertical' | 'horizontal';
  x: number;
  y: number;
  length: number;
}

export interface ImageDropPreview {
  insertPos: number;
  kind: ImageDropKind;
  targetImagePos?: number;
  dropLine: DropLineIndicator | null;
  label: string;
  autoFit: boolean;
}

const ROW_Y_TOLERANCE = 48;

export type FileDropPreview = {
  insertPos: number;
  kind: 'same-row-before' | 'same-row-after' | 'line';
  targetImagePos?: number;
  autoFit?: boolean;
};

/** Resolve drop target when dragging files from the OS onto the canvas. */
export function getFileDropPreview(
  view: EditorView,
  clientX: number,
  clientY: number,
): FileDropPreview | null {
  const targetUnder = document.elementFromPoint(clientX, clientY);
  let targetWrapper = findImageWrapper(targetUnder);

  if (!targetWrapper) {
    const wrappers = view.dom.querySelectorAll('.resizable-image-wrapper');
    for (const w of wrappers) {
      const el = w as HTMLElement;
      const rect = el.getBoundingClientRect();
      const onRow =
        clientY >= rect.top - ROW_Y_TOLERANCE &&
        clientY <= rect.bottom + ROW_Y_TOLERANCE;
      const nearHorizontally =
        clientX >= rect.left - 160 && clientX <= rect.right + 160;
      if (onRow && nearHorizontally) {
        targetWrapper = el;
        break;
      }
    }
  }

  if (targetWrapper) {
    const targetPos = getImageNodePosFromView(view, targetWrapper);
    if (targetPos != null) {
      const targetRect = targetWrapper.getBoundingClientRect();
      const sameRow =
        clientY >= targetRect.top - ROW_Y_TOLERANCE &&
        clientY <= targetRect.bottom + ROW_Y_TOLERANCE;

      if (sameRow) {
        const insertAfter = clientX > targetRect.left + targetRect.width / 2;
        const targetNode = view.state.doc.nodeAt(targetPos);
        const rawInsert = insertAfter
          ? targetPos + (targetNode?.nodeSize ?? 1)
          : targetPos;

        logImageDrop('file drop preview same-row', {
          targetPos,
          insertAfter,
          rawInsert,
        });

        return {
          insertPos: rawInsert,
          kind: insertAfter ? 'same-row-after' : 'same-row-before',
          targetImagePos: targetPos,
          autoFit: true,
        };
      }
    }
  }

  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;

  logImageDrop('file drop preview line', { pos: coords.pos });
  return {
    insertPos: coords.pos,
    kind: 'line',
  };
}

/** Compute drop target + visual hints while dragging an image. */
export function getImageDropPreview(
  editor: Editor,
  clientX: number,
  clientY: number,
  fromPos: number,
  _draggedWidth: number,
  draggedEl: HTMLElement | null,
): ImageDropPreview | null {
  const { view, state } = editor;
  const fromNode = state.doc.nodeAt(fromPos);
  const nodeSize = fromNode?.nodeSize ?? 1;

  const targetHit = findImageHitAtPointer(
    editor,
    clientX,
    clientY,
    fromPos,
    draggedEl,
  );
  if (targetHit) {
    const columnPreview = previewColumnDropOnImage(editor, clientX, clientY, targetHit);
    if (columnPreview) {
      console.log('[DropTarget] column', {
        fromPos,
        label: columnPreview.label,
        targetImagePos: columnPreview.targetImagePos,
        kind: columnPreview.kind,
      });
      return columnPreview;
    }
  }

  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;

  const slice = state.doc.slice(fromPos, fromPos + nodeSize);
  const insertPos = dropPoint(state.doc, coords.pos, slice);
  if (insertPos == null) return null;
  if (insertPos >= fromPos && insertPos <= fromPos + nodeSize) return null;

  console.log('[DropTarget] line', { insertPos, clientX, clientY });

  return {
    insertPos,
    kind: 'line',
    dropLine: previewBlockLineDrop(editor, clientX, clientY, insertPos),
    label: 'insert-block',
    autoFit: false,
  };
}

export function moveImageWithPreview(
  editor: Editor,
  fromPos: number,
  preview: ImageDropPreview,
  node: PMNode,
): boolean {
  console.log('[DropExecute] schema move', {
    kind: preview.kind,
    fromPos,
    targetImagePos: preview.targetImagePos,
    insertPos: preview.insertPos,
    nodeSize: node.nodeSize,
  });

  try {
    if (isColumnDropKind(preview.kind)) {
      logImageDrop('=== COLUMN DROP ===');
      describeDocImages(editor, 'before');

      const moved = executeColumnDrop(editor, fromPos, preview, node);
      if (!moved) {
        console.error('[ColumnDrop] executeColumnDrop returned false');
        return false;
      }

      const targetPos = preview.targetImagePos ?? fromPos;
      requestAnimationFrame(() => {
        describeDocImages(editor, 'after column drop');
        autoFitImagesInParagraph(editor, targetPos, true);
        animateImageSnap(editor.view, targetPos);
      });
      return true;
    }

    const moved = moveEditorNode(editor, fromPos, preview.insertPos, node);
    if (moved) {
      animateImageSnap(editor.view, preview.insertPos);
    } else {
      console.error('[ColumnDrop] block line move rejected by dropPoint', {
        fromPos,
        insertPos: preview.insertPos,
      });
    }
    return moved;
  } catch (error) {
    console.error('[ColumnDrop] drop failed:', error);
    return false;
  }
}

let overlayRoot: HTMLDivElement | null = null;
let activePreviewKey = '';

function ensureOverlay(): HTMLDivElement {
  if (!overlayRoot || !document.body.contains(overlayRoot)) {
    overlayRoot = document.createElement('div');
    overlayRoot.id = 'flow-image-drop-overlay';
    overlayRoot.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(overlayRoot);
  }
  return overlayRoot;
}

function renderDropLine(line: DropLineIndicator): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'flow-drop-line';

  if (line.orientation === 'vertical') {
    el.style.cssText = `
      position:fixed;
      left:${line.x - 2}px;
      top:${line.y}px;
      width:4px;
      height:${line.length}px;
      background:linear-gradient(180deg, #38bdf8 0%, #2563eb 100%);
      border-radius:4px;
      box-shadow:0 0 12px rgba(56,189,248,0.75);
      transform-origin:center;
      animation:flowDropLinePulse 0.9s ease-in-out infinite alternate;
    `;
  } else {
    el.style.cssText = `
      position:fixed;
      left:${line.x}px;
      top:${line.y - 2}px;
      width:${line.length}px;
      height:4px;
      background:linear-gradient(90deg, #38bdf8 0%, #2563eb 100%);
      border-radius:4px;
      box-shadow:0 0 12px rgba(56,189,248,0.75);
      transform-origin:center;
      animation:flowDropLinePulse 0.9s ease-in-out infinite alternate;
    `;
  }
  return el;
}

export function showImageDropIndicator(preview: ImageDropPreview | null): void {
  if (!preview) {
    hideImageDropIndicator();
    return;
  }

  const previewKey = `${preview.kind}:${preview.insertPos}:${preview.targetImagePos ?? ''}`;
  const root = ensureOverlay();

  if (previewKey === activePreviewKey && root.childElementCount > 0) {
    return;
  }
  activePreviewKey = previewKey;
  root.innerHTML = '';

  if (preview.dropLine) {
    root.appendChild(renderDropLine(preview.dropLine));
  }
}

export function hideImageDropIndicator(): void {
  activePreviewKey = '';
  if (overlayRoot) {
    overlayRoot.innerHTML = '';
  }
}

/** Force-remove overlay (e.g. on unmount or drag cancel). */
export function destroyImageDropOverlay(): void {
  hideImageDropIndicator();
  if (overlayRoot?.parentNode) {
    overlayRoot.parentNode.removeChild(overlayRoot);
  }
  overlayRoot = null;
}
