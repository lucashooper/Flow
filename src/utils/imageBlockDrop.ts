import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from 'prosemirror-model';
import type { DropLineIndicator, ImageDropPreview } from './imageDropPreview';

export type BlockDropResolution = {
  blockPos: number;
  blockNode: PMNode;
  insertBefore: boolean;
};

/** Resolve nearest block paragraph and whether drop is above or below it. */
export function resolveBlockDropTarget(
  editor: Editor,
  clientX: number,
  clientY: number,
): BlockDropResolution | null {
  const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;

  const $pos = editor.state.doc.resolve(coords.pos);

  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (!node.isBlock) continue;

    const blockPos = $pos.before(depth);
    const blockDom = editor.view.nodeDOM(blockPos);
    let insertBefore = true;

    if (blockDom instanceof HTMLElement) {
      const rect = blockDom.getBoundingClientRect();
      insertBefore = clientY < rect.top + rect.height / 2;
    }

    if (node.type.name === 'paragraph') {
      return { blockPos, blockNode: node, insertBefore };
    }

    // Headings, blockquote, etc. — still treat as block boundary
    if (node.type.spec.group?.includes('block')) {
      return { blockPos, blockNode: node, insertBefore };
    }
  }

  return null;
}

export function buildFullWidthHorizontalLine(
  editor: Editor,
  y: number,
): DropLineIndicator {
  const proseRect = editor.view.dom.getBoundingClientRect();
  const padding = 16;
  return {
    orientation: 'horizontal',
    x: proseRect.left + padding,
    y,
    length: Math.max(proseRect.width - padding * 2, 120),
  };
}

export function previewBlockLevelDrop(
  editor: Editor,
  _clientX: number,
  clientY: number,
  block: BlockDropResolution,
): ImageDropPreview {
  const { blockPos, blockNode, insertBefore } = block;
  const blockDom = editor.view.nodeDOM(blockPos);
  let lineY = clientY;

  if (blockDom instanceof HTMLElement) {
    const rect = blockDom.getBoundingClientRect();
    lineY = insertBefore ? rect.top : rect.bottom;
  } else {
    try {
      const coords = editor.view.coordsAtPos(
        insertBefore ? blockPos : blockPos + blockNode.nodeSize,
      );
      lineY = coords.top;
    } catch {
      lineY = clientY;
    }
  }

  const insertPos = insertBefore ? blockPos : blockPos + blockNode.nodeSize;
  const dropLine = buildFullWidthHorizontalLine(editor, lineY);

  return {
    insertPos,
    kind: 'block',
    dropLine,
    label: insertBefore ? 'insert-block-above' : 'insert-block-below',
    autoFit: false,
    blockPos,
    insertBefore,
  };
}

/** Move image into its own paragraph block above/below a target block — never inline into text. */
export function executeBlockDrop(
  editor: Editor,
  fromPos: number,
  preview: ImageDropPreview,
  fallbackNode?: PMNode,
): boolean {
  const sourceNode = editor.state.doc.nodeAt(fromPos) ?? fallbackNode;
  if (!sourceNode || sourceNode.type.name !== 'resizableImage') {
    console.error('[ColumnDrop] block drop: invalid source at', fromPos);
    return false;
  }

  const { schema } = editor;
  const imageType = schema.nodes.resizableImage;
  const paraType = schema.nodes.paragraph;
  if (!imageType || !paraType) {
    console.error('[ColumnDrop] block drop: schema missing nodes');
    return false;
  }

  try {
    let tr = editor.state.tr;
    const fromSize = sourceNode.nodeSize;
    const $from = editor.state.doc.resolve(fromPos);
    const sourceBlockPos = $from.before($from.depth);

    tr = tr.delete(fromPos, fromPos + fromSize);

    const mappedSourceBlock = tr.mapping.map(sourceBlockPos);
    const sourceBlock = tr.doc.nodeAt(mappedSourceBlock);
    if (
      sourceBlock?.type.name === 'paragraph' &&
      sourceBlock.content.size === 0
    ) {
      tr = tr.delete(mappedSourceBlock, mappedSourceBlock + sourceBlock.nodeSize);
    }

    let insertPos = tr.mapping.map(preview.insertPos);
    const newParagraph = paraType.create(null, imageType.create(sourceNode.attrs));
    tr = tr.insert(insertPos, newParagraph);

    editor.view.dispatch(tr.scrollIntoView());
    console.log('[ColumnDrop] block drop success', {
      fromPos,
      insertPos,
      label: preview.label,
    });
    return true;
  } catch (error) {
    console.error('[ColumnDrop] block drop failed:', error);
    return false;
  }
}

export function logDropTargetPreview(preview: ImageDropPreview | null): void {
  if (!preview) {
    console.log('[DropTarget] Type: none, Height: 0');
    return;
  }

  const indicatorHeight =
    preview.dropLine?.orientation === 'vertical'
      ? preview.dropLine.length
      : preview.dropLine?.length ?? 0;

  console.log(`[DropTarget] Type: ${preview.label}, Height: ${indicatorHeight}`, {
    kind: preview.kind,
    insertPos: preview.insertPos,
    targetImagePos: preview.targetImagePos ?? null,
  });
}
