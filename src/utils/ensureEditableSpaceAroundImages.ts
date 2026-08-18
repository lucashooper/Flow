import type { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';

function isImageOnlyParagraph(node: { type: { name: string }; childCount: number; firstChild?: { type: { name: string } } | null }) {
  return (
    node.type.name === 'paragraph' &&
    node.childCount === 1 &&
    (node.firstChild?.type.name === 'resizableImage' || node.firstChild?.type.name === 'image')
  );
}

/** Ensure there's an empty paragraph after a specific document position (e.g. after an image block). */
export function ensureParagraphAfterPos(view: EditorView, pos: number, focus = false): void {
  const { state } = view;
  const { doc, schema } = state;
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return;

  const $pos = doc.resolve(pos);
  const nodeAfter = $pos.nodeAfter;

  if (nodeAfter?.type.name === 'paragraph' && nodeAfter.content.size === 0) {
    if (focus) {
      view.dispatch(state.tr.setSelection(TextSelection.create(doc, pos + 1)));
      view.focus();
    }
    return;
  }

  const tr = state.tr.insert(pos, paragraph.create());
  if (focus) {
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  }
  view.dispatch(tr);
  if (focus) view.focus();
}

/** Ensure there's an empty paragraph after image-only blocks so the cursor can be placed below. */
export function ensureTrailingParagraph(view: EditorView, focus = false): void {
  const { state } = view;
  const { doc } = state;
  const lastNode = doc.lastChild;
  if (!lastNode || !isImageOnlyParagraph(lastNode)) return;
  ensureParagraphAfterPos(view, doc.content.size, focus);
}

/** Ensure there's an empty paragraph before the first image-only block. */
export function ensureLeadingParagraph(view: EditorView, focus = false): void {
  const { state } = view;
  const { doc, schema } = state;
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return;

  const firstNode = doc.firstChild;
  if (!firstNode || !isImageOnlyParagraph(firstNode)) return;

  const tr = state.tr.insert(0, paragraph.create());
  if (focus) {
    tr.setSelection(TextSelection.create(tr.doc, 1));
  }
  view.dispatch(tr);
}

/** Focus the editor at the end, creating a trailing paragraph if needed. */
export function focusEditorAtEnd(view: EditorView): void {
  const { state } = view;
  const { doc, schema } = state;
  const paragraph = schema.nodes.paragraph;
  const lastNode = doc.lastChild;
  let tr = state.tr;

  if (lastNode && isImageOnlyParagraph(lastNode) && paragraph) {
    const endPos = doc.content.size;
    tr = tr.insert(endPos, paragraph.create());
  }

  tr = tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size));
  view.dispatch(tr);
  view.focus();
}
