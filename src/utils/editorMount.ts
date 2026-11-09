import type { Editor } from '@tiptap/core';

/**
 * Tiptap throws if `editor.view.dom` is read before the editor is attached to
 * the page. React effects can run in that gap (WebKit — Safari and the
 * desktop app — hits it reliably), which blanked the whole app.
 */
export function mountedEditorDom(editor: Editor | null | undefined): HTMLElement | null {
  if (!editor || editor.isDestroyed) return null;
  const view = (editor as unknown as { editorView?: { dom?: HTMLElement } | null }).editorView;
  return view?.dom ?? null;
}

/** Run `setup` once the editor is mounted (now, or on its 'mount' event). Returns a cleanup. */
export function whenEditorMounted(
  editor: Editor | null | undefined,
  setup: (dom: HTMLElement) => void | (() => void),
): () => void {
  if (!editor || editor.isDestroyed) return () => {};
  let cleanup: void | (() => void);
  const dom = mountedEditorDom(editor);
  if (dom) {
    cleanup = setup(dom);
    return () => cleanup?.();
  }
  const onMount = () => {
    const mounted = mountedEditorDom(editor);
    if (mounted) cleanup = setup(mounted);
  };
  editor.on('mount', onMount);
  return () => {
    editor.off('mount', onMount);
    cleanup?.();
  };
}
