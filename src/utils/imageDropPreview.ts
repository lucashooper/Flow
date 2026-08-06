import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from 'prosemirror-model';
import { dropPoint } from 'prosemirror-transform';
import { moveEditorNode } from './moveEditorNode';
import {
  describeDocImages,
  logImageDrop,
} from './imageDropDebug';

export type ImageDropKind = 'same-row-before' | 'same-row-after' | 'line' | 'block';

export interface ImageDropPreview {
  insertPos: number;
  kind: ImageDropKind;
  targetImagePos?: number;
  slotRect: DOMRect | null;
  line: { x: number; top: number; bottom: number } | null;
  label: string;
  autoFit: boolean;
}

const ROW_Y_TOLERANCE = 48;
const EDITOR_CONTENT_MAX = 800;
const IMAGE_GAP = 12;

function getEditorContentWidth(editor: Editor): number {
  const prose = editor.view.dom as HTMLElement;
  const rect = prose.getBoundingClientRect();
  return Math.min(EDITOR_CONTENT_MAX, rect.width - 48);
}

function findImageWrapper(el: Element | null): HTMLElement | null {
  return el?.closest?.('.resizable-image-wrapper') as HTMLElement | null;
}

/** Resolve document position for a resizable image DOM element. */
export function getImageNodePos(editor: Editor, el: HTMLElement): number | null {
  const { view, state } = editor;

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

/** Compute drop target + visual hints while dragging an image. */
export function getImageDropPreview(
  editor: Editor,
  clientX: number,
  clientY: number,
  fromPos: number,
  draggedWidth: number,
  draggedEl: HTMLElement | null,
): ImageDropPreview | null {
  const { view, state } = editor;
  const fromNode = state.doc.nodeAt(fromPos);
  const nodeSize = fromNode?.nodeSize ?? 1;

  const targetUnder = document.elementFromPoint(clientX, clientY);
  let targetWrapper = findImageWrapper(targetUnder);
  if (targetWrapper && draggedEl && (targetWrapper === draggedEl || draggedEl.contains(targetWrapper))) {
    return null;
  }

  if (!targetWrapper || targetWrapper === draggedEl) {
    const wrappers = editor.view.dom.querySelectorAll('.resizable-image-wrapper');
    for (const w of wrappers) {
      const el = w as HTMLElement;
      if (el === draggedEl) continue;
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

  if (targetWrapper && targetWrapper !== draggedEl) {
    const targetPos = getImageNodePos(editor, targetWrapper);
    if (targetPos != null && targetPos !== fromPos) {
      const targetRect = targetWrapper.getBoundingClientRect();
      const sameRow =
        clientY >= targetRect.top - ROW_Y_TOLERANCE &&
        clientY <= targetRect.bottom + ROW_Y_TOLERANCE;

      if (sameRow) {
        const insertAfter = clientX > targetRect.left + targetRect.width / 2;
        const targetNode = state.doc.nodeAt(targetPos);
        const targetWidth = (targetNode?.attrs.width as number) || targetRect.width;

        const slice = state.doc.slice(fromPos, fromPos + nodeSize);
        const rawInsert = insertAfter
          ? targetPos + (targetNode?.nodeSize ?? 1)
          : targetPos;
        const validDrop = dropPoint(state.doc, rawInsert, slice);

        const editorWidth = getEditorContentWidth(editor);
        const slotWidth = Math.floor((editorWidth - IMAGE_GAP) / 2);

        let slotLeft = insertAfter
          ? targetRect.right + IMAGE_GAP
          : targetRect.left - slotWidth - IMAGE_GAP;

        const proseRect = view.dom.getBoundingClientRect();
        slotLeft = Math.max(
          proseRect.left + 8,
          Math.min(slotLeft, proseRect.right - slotWidth - 8),
        );

        logImageDrop('same-row preview', {
          fromPos,
          targetPos,
          insertAfter,
          validDrop,
          targetWidth,
          draggedWidth,
        });

        return {
          insertPos: validDrop ?? rawInsert,
          kind: insertAfter ? 'same-row-after' : 'same-row-before',
          targetImagePos: targetPos,
          slotRect: new DOMRect(slotLeft, targetRect.top, slotWidth, targetRect.height),
          line: null,
          label: 'Drop — auto-fit both on one row',
          autoFit: true,
        };
      }
    }
  }

  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;

  const slice = state.doc.slice(fromPos, fromPos + nodeSize);
  const insertPos = dropPoint(state.doc, coords.pos, slice);
  if (insertPos == null) return null;
  if (insertPos >= fromPos && insertPos <= fromPos + nodeSize) return null;

  const lineCoords = view.coordsAtPos(insertPos);
  return {
    insertPos,
    kind: 'line',
    slotRect: null,
    line: {
      x: lineCoords.left,
      top: lineCoords.top,
      bottom: lineCoords.bottom,
    },
    label: 'Drop here',
    autoFit: false,
  };
}

export function autoFitImagesInParagraph(
  editor: Editor,
  posInDoc: number,
  force = false,
): boolean {
  const { state } = editor;
  const safePos = Math.min(Math.max(1, posInDoc), state.doc.content.size - 1);
  const $pos = state.doc.resolve(safePos);

  if ($pos.parent.type.name !== 'paragraph') {
    logImageDrop('autoFit skipped — parent is', $pos.parent.type.name);
    return false;
  }

  const paragraphStart = $pos.start();
  const images: { pos: number; node: PMNode }[] = [];

  $pos.parent.forEach((node, offset) => {
    if (node.type.name === 'resizableImage') {
      images.push({ pos: paragraphStart + offset, node });
    }
  });

  logImageDrop(`autoFit @${paragraphStart}: ${images.length} image(s), force=${force}`);

  if (images.length < 2) return false;

  const maxWidth = getEditorContentWidth(editor);
  const gaps = IMAGE_GAP * (images.length - 1);
  const fitWidth = Math.floor((maxWidth - gaps) / images.length);
  const finalWidth = Math.max(120, fitWidth);

  if (!force) {
    const total = images.reduce(
      (sum, img) => sum + ((img.node.attrs.width as number) || 320),
      0,
    );
    if (total + gaps <= maxWidth) return false;
  }

  let tr = state.tr;
  for (const img of [...images].sort((a, b) => b.pos - a.pos)) {
    const w = img.node.attrs.width as number | null;
    const h = img.node.attrs.height as number | null;
    const ratio = w && h && w > 0 ? h / w : 0.65;
    tr = tr.setNodeMarkup(img.pos, undefined, {
      ...img.node.attrs,
      width: finalWidth,
      height: Math.round(finalWidth * ratio),
    });
  }
  editor.view.dispatch(tr);
  logImageDrop(`autoFit done — width=${finalWidth}px × ${images.length}`);
  return true;
}

/** Rebuild target paragraph content so both images share one row. */
function moveImageToSameRow(
  editor: Editor,
  fromPos: number,
  preview: ImageDropPreview,
  draggedNode: PMNode,
): boolean {
  const targetPos = preview.targetImagePos;
  if (targetPos == null) {
    logImageDrop('FAIL: no targetImagePos');
    return false;
  }

  const { state, schema } = editor;
  const imageType = schema.nodes.resizableImage;
  if (!imageType) {
    logImageDrop('FAIL: resizableImage not in schema');
    return false;
  }

  logImageDrop('=== SAME ROW MOVE ===');
  describeDocImages(editor, 'before');

  const $from = state.doc.resolve(fromPos);
  const $target = state.doc.resolve(targetPos);

  if ($target.parent.type.name !== 'paragraph') {
    logImageDrop('FAIL: target parent is', $target.parent.type.name);
    return false;
  }

  const insertAfter = preview.kind === 'same-row-after';
  const draggedCopy = imageType.create(draggedNode.attrs);
  const fromSize = draggedNode.nodeSize;
  const sourceParaPos = $from.before();

  let tr = state.tr;
  tr = tr.delete(fromPos, fromPos + fromSize);

  const mappedSourcePara = tr.mapping.map(sourceParaPos);
  const sourceParaNode = tr.doc.nodeAt(mappedSourcePara);
  if (
    sourceParaNode?.type.name === 'paragraph' &&
    sourceParaNode.content.size === 0
  ) {
    tr = tr.delete(mappedSourcePara, mappedSourcePara + sourceParaNode.nodeSize);
    logImageDrop('removed empty source paragraph @', mappedSourcePara);
  }

  const mappedTargetPos = tr.mapping.map(targetPos);
  const $t = tr.doc.resolve(mappedTargetPos);

  if ($t.parent.type.name !== 'paragraph') {
    logImageDrop('FAIL: target not in paragraph after delete');
    editor.view.dispatch(tr);
    return false;
  }

  const paraStart = $t.start();
  const paraEnd = $t.end();
  const children: PMNode[] = [];
  let targetIndex = -1;
  let offset = 0;

  $t.parent.forEach((child) => {
    const childPos = paraStart + offset;
    if (childPos === mappedTargetPos) targetIndex = children.length;
    children.push(child);
    offset += child.nodeSize;
  });

  if (targetIndex < 0) {
    logImageDrop('FAIL: could not find target index in paragraph');
    editor.view.dispatch(tr);
    return false;
  }

  const insertIndex = insertAfter ? targetIndex + 1 : targetIndex;
  children.splice(insertIndex, 0, draggedCopy);

  logImageDrop('replace paragraph content', {
    paraStart,
    paraEnd,
    childCount: children.length,
    imageCount: children.filter((c) => c.type.name === 'resizableImage').length,
    insertIndex,
  });

  tr = tr.replaceWith(paraStart, paraEnd, children);
  editor.view.dispatch(tr.scrollIntoView());

  requestAnimationFrame(() => {
    describeDocImages(editor, 'after move');
    autoFitImagesInParagraph(editor, paraStart, true);
    describeDocImages(editor, 'after autoFit');
  });

  return true;
}

export function moveImageWithPreview(
  editor: Editor,
  fromPos: number,
  preview: ImageDropPreview,
  node: PMNode,
): boolean {
  logImageDrop('moveImageWithPreview', preview.kind, {
    fromPos,
    targetImagePos: preview.targetImagePos,
    insertPos: preview.insertPos,
  });

  if (preview.kind === 'same-row-after' || preview.kind === 'same-row-before') {
    return moveImageToSameRow(editor, fromPos, preview, node);
  }

  return moveEditorNode(editor, fromPos, preview.insertPos, node);
}

let overlayRoot: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {
  if (!overlayRoot) {
    overlayRoot = document.createElement('div');
    overlayRoot.id = 'flow-image-drop-overlay';
    overlayRoot.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(overlayRoot);
  }
  return overlayRoot;
}

export function showImageDropIndicator(preview: ImageDropPreview | null): void {
  const root = ensureOverlay();
  root.innerHTML = '';
  if (!preview) return;

  if (preview.slotRect) {
    const slot = document.createElement('div');
    slot.style.cssText = `
      position:fixed;
      left:${preview.slotRect.left}px;
      top:${preview.slotRect.top}px;
      width:${preview.slotRect.width}px;
      height:${preview.slotRect.height}px;
      border:2px dashed #38bdf8;
      border-radius:8px;
      background:rgba(56,189,248,0.12);
      box-shadow:0 0 0 1px rgba(56,189,248,0.25);
    `;
    root.appendChild(slot);
  }

  if (preview.line) {
    const line = document.createElement('div');
    line.style.cssText = `
      position:fixed;
      left:${preview.line.x - 1}px;
      top:${preview.line.top}px;
      width:3px;
      height:${Math.max(preview.line.bottom - preview.line.top, 24)}px;
      background:#38bdf8;
      border-radius:2px;
      box-shadow:0 0 6px rgba(56,189,248,0.6);
    `;
    root.appendChild(line);
  }

  const label = document.createElement('div');
  label.textContent = preview.label;
  label.style.cssText = `
    position:fixed;
    left:${preview.slotRect ? preview.slotRect.left : (preview.line?.x ?? 0) + 8}px;
    top:${preview.slotRect ? preview.slotRect.top - 28 : (preview.line?.top ?? 0) - 28}px;
    padding:3px 8px;
    border-radius:6px;
    font-size:11px;
    font-weight:600;
    color:#e0f2fe;
    background:rgba(15,23,42,0.9);
    border:1px solid rgba(56,189,248,0.4);
    white-space:nowrap;
  `;
  root.appendChild(label);
}

export function hideImageDropIndicator(): void {
  if (overlayRoot) overlayRoot.innerHTML = '';
}
