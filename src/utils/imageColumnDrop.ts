import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from 'prosemirror-model';
import { IMAGE_ROW_GAP } from './editorLayout';
import { getImageNodePos } from './imageDomUtils';
import type { DropLineIndicator, ImageDropPreview } from './imageDropPreview';

/** Left/right 25% of image width = side-by-side column drop. */
const COLUMN_SIDE_ZONE = 0.25;
const COLUMN_Y_PAD = 36;

export type ImageHit = {
  wrapper: HTMLElement;
  pos: number;
  rect: DOMRect;
};

export function collectEditorImageHits(
  editor: Editor,
  fromPos: number,
  draggedEl: HTMLElement | null,
): ImageHit[] {
  const hits: ImageHit[] = [];
  const wrappers = editor.view.dom.querySelectorAll('.resizable-image-wrapper');

  for (const w of wrappers) {
    const el = w as HTMLElement;
    if (draggedEl && (el === draggedEl || draggedEl.contains(el))) continue;

    const pos = getImageNodePos(editor, el);
    if (pos == null || pos === fromPos) continue;

    hits.push({ wrapper: el, pos, rect: el.getBoundingClientRect() });
  }

  return hits;
}

/** Nearest image block under the pointer (ignores drag ghost — uses geometry only). */
export function findImageHitAtPointer(
  editor: Editor,
  clientX: number,
  clientY: number,
  fromPos: number,
  draggedEl: HTMLElement | null,
): ImageHit | null {
  let best: { hit: ImageHit; score: number } | null = null;

  for (const hit of collectEditorImageHits(editor, fromPos, draggedEl)) {
    const r = hit.rect;
    const padX = IMAGE_ROW_GAP * 2;
    const inX = clientX >= r.left - padX && clientX <= r.right + padX;
    const inY = clientY >= r.top - COLUMN_Y_PAD && clientY <= r.bottom + COLUMN_Y_PAD;
    if (!inX || !inY) continue;

    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(clientX - cx, clientY - cy);
    const score = -dist;
    if (!best || score > best.score) best = { hit, score };
  }

  return best?.hit ?? null;
}

function buildVerticalLine(x: number, top: number, bottom: number): DropLineIndicator {
  return {
    orientation: 'vertical',
    x,
    y: top,
    length: Math.max(bottom - top, 40),
  };
}

function buildHorizontalLine(y: number, centerX: number, width = 96): DropLineIndicator {
  return {
    orientation: 'horizontal',
    x: centerX - width / 2,
    y,
    length: width,
  };
}

/**
 * Per-image drop zones:
 * - left 25%  → join column on left  (thin vertical bar on target's left edge)
 * - right 25% → join column on right (thin vertical bar on target's right edge)
 * - center    → null (caller falls back to block above/below line)
 */
export function previewColumnDropOnImage(
  editor: Editor,
  clientX: number,
  clientY: number,
  target: ImageHit,
): ImageDropPreview | null {
  const rect = target.rect;

  if (clientY < rect.top - COLUMN_Y_PAD || clientY > rect.bottom + COLUMN_Y_PAD) {
    return null;
  }

  const relX = (clientX - rect.left) / Math.max(rect.width, 1);
  const targetNode = editor.state.doc.nodeAt(target.pos);

  if (relX <= COLUMN_SIDE_ZONE) {
    return {
      insertPos: target.pos,
      kind: 'same-row-before',
      targetImagePos: target.pos,
      dropLine: buildVerticalLine(rect.left - IMAGE_ROW_GAP / 2, rect.top, rect.bottom),
      label: 'insert-column-left',
      autoFit: true,
    };
  }

  if (relX >= 1 - COLUMN_SIDE_ZONE) {
    const insertPos = target.pos + (targetNode?.nodeSize ?? 1);
    return {
      insertPos,
      kind: 'same-row-after',
      targetImagePos: target.pos,
      dropLine: buildVerticalLine(rect.right + IMAGE_ROW_GAP / 2, rect.top, rect.bottom),
      label: 'insert-column-right',
      autoFit: true,
    };
  }

  return null;
}

export function previewBlockLineDrop(
  editor: Editor,
  clientX: number,
  clientY: number,
  insertPos: number,
): DropLineIndicator | null {
  try {
    const coords = editor.view.coordsAtPos(insertPos);
    return buildHorizontalLine(coords.top, clientX, 120);
  } catch {
    return buildHorizontalLine(clientY, clientX, 120);
  }
}

export function isColumnDropKind(kind: ImageDropPreview['kind']): boolean {
  return kind === 'same-row-before' || kind === 'same-row-after';
}

/** Execute side-by-side column merge via explicit ProseMirror transaction. */
export function executeColumnDrop(
  editor: Editor,
  fromPos: number,
  preview: ImageDropPreview,
  fallbackNode?: PMNode,
): boolean {
  const targetPos = preview.targetImagePos;
  if (targetPos == null) {
    console.error('[ColumnDrop] aborted: missing targetImagePos');
    return false;
  }

  const { state, schema } = editor;
  const imageType = schema.nodes.resizableImage;
  if (!imageType) {
    console.error('[ColumnDrop] aborted: resizableImage not in schema');
    return false;
  }

  const sourceNode = state.doc.nodeAt(fromPos) ?? fallbackNode;
  if (!sourceNode || sourceNode.type.name !== 'resizableImage') {
    console.error('[ColumnDrop] aborted: invalid source node at', fromPos);
    return false;
  }

  const targetNode = state.doc.nodeAt(targetPos);
  if (!targetNode || targetNode.type.name !== 'resizableImage') {
    console.error('[ColumnDrop] aborted: invalid target node at', targetPos);
    return false;
  }

  const $from = state.doc.resolve(fromPos);
  const $target = state.doc.resolve(targetPos);
  const sourceParaPos = $from.before();
  const targetParaPos = $target.before();

  const insertAfter = preview.kind === 'same-row-after';
  let insertPos = insertAfter ? targetPos + targetNode.nodeSize : targetPos;
  const fromSize = sourceNode.nodeSize;
  const draggedCopy = imageType.create(sourceNode.attrs);

  try {
    let tr = state.tr;

    if (fromPos < insertPos) {
      tr = tr.delete(fromPos, fromPos + fromSize);
      insertPos = tr.mapping.map(insertPos);
    } else {
      tr = tr.delete(fromPos, fromPos + fromSize);
      insertPos = tr.mapping.map(insertPos);
    }

    const $ins = tr.doc.resolve(insertPos);
    if ($ins.parent.type.name !== 'paragraph') {
      console.error('[ColumnDrop] aborted: insert parent is', $ins.parent.type.name);
      return false;
    }

    tr = tr.insert(insertPos, draggedCopy);

    const mappedSourcePara = tr.mapping.map(sourceParaPos);
    const mappedTargetPara = tr.mapping.map(targetParaPos);

    if (mappedSourcePara !== mappedTargetPara) {
      const emptyPara = tr.doc.nodeAt(mappedSourcePara);
      if (emptyPara?.type.name === 'paragraph' && emptyPara.content.size === 0) {
        tr = tr.delete(mappedSourcePara, mappedSourcePara + emptyPara.nodeSize);
      }
    }

    editor.view.dispatch(tr.scrollIntoView());

    console.log('[ColumnDrop] success', {
      fromPos,
      targetPos,
      insertPos,
      kind: preview.kind,
    });

    return true;
  } catch (error) {
    console.error('[ColumnDrop] transaction failed:', error);
    return false;
  }
}
