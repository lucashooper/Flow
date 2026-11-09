import type { Editor } from '@tiptap/react';
import { pendingBlobUploads } from './insertImageFast';

type UploadFn = (file: File) => Promise<string | null>;

/**
 * Safety net for images that land in a note as temporary `blob:` URLs without
 * going through our paste handlers. On Linux the desktop app's WebKit pastes
 * screenshots natively like this, and those links stop working on reload.
 * Each one is uploaded once, and its src swapped for the saved copy.
 */
export function watchStrayBlobImages(editor: Editor, uploadImage: UploadFn): () => void {
  const handled = new Set<string>();

  const replaceSrc = (from: string, to: string) => {
    if (editor.isDestroyed) return;
    const { state } = editor;
    let tr = state.tr;
    state.doc.descendants((node, pos) => {
      if ((node.type.name === 'resizableImage' || node.type.name === 'image') && node.attrs.src === from) {
        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to });
      }
    });
    if (tr.docChanged) editor.view.dispatch(tr);
  };

  const scan = () => {
    if (editor.isDestroyed) return;
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'resizableImage' && node.type.name !== 'image') return;
      const src = node.attrs.src;
      if (typeof src !== 'string' || !src.startsWith('blob:')) return;
      if (handled.has(src) || pendingBlobUploads.has(src)) return;
      handled.add(src);
      void fetch(src)
        .then((res) => res.blob())
        .then((blob) => {
          const type = blob.type || 'image/png';
          return uploadImage(new File([blob], `pasted-image.${type.split('/')[1] || 'png'}`, { type }));
        })
        .then((url) => {
          if (url) replaceSrc(src, url);
        })
        .catch((err) => console.warn('Could not save pasted image', err));
    });
  };

  editor.on('update', scan);
  return () => {
    editor.off('update', scan);
  };
}
