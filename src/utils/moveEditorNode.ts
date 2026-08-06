import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from 'prosemirror-model';
import { dropPoint } from 'prosemirror-transform';

/** Move an inline/block atom node to a new document position. */
export function moveEditorNode(
  editor: Editor,
  fromPos: number,
  rawToPos: number,
  node: PMNode,
): boolean {
  const { state } = editor;
  const nodeSize = node.nodeSize;
  const slice = state.doc.slice(fromPos, fromPos + nodeSize);

  const targetDrop = dropPoint(state.doc, rawToPos, slice);
  if (targetDrop == null) return false;

  let insertPos = targetDrop;
  if (insertPos >= fromPos && insertPos <= fromPos + nodeSize) return false;

  const tr = state.tr;
  tr.delete(fromPos, fromPos + nodeSize);
  const mappedInsert = tr.mapping.map(insertPos);
  tr.replace(mappedInsert, mappedInsert, slice);

  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
