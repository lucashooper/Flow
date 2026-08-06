import type { Editor } from '@tiptap/react';
import type { EditorView } from 'prosemirror-view';

type UploadFn = (file: File) => Promise<string | null>;

/** Insert an image immediately with a blob preview, upload in background. */
export function insertImageFast(
  view: EditorView,
  file: File,
  uploadImage: UploadFn,
): void {
  const blobUrl = URL.createObjectURL(file);
  const imageNode =
    view.state.schema.nodes.resizableImage || view.state.schema.nodes.image;

  if (!imageNode) {
    URL.revokeObjectURL(blobUrl);
    return;
  }

  view.dispatch(
    view.state.tr.replaceSelectionWith(
      imageNode.create({
        src: blobUrl,
        'data-uploading': 'true',
        'data-blob-url': blobUrl,
      }),
    ),
  );

  void uploadImage(file)
    .then((uploadedUrl) => {
      if (!uploadedUrl) return;

      const { state } = view;
      let replaced = false;

      state.doc.descendants((node, pos) => {
        if (
          (node.type.name === 'resizableImage' || node.type.name === 'image') &&
          node.attrs.src === blobUrl
        ) {
          view.dispatch(
            state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              src: uploadedUrl,
              'data-uploading': null,
              'data-blob-url': null,
            }),
          );
          replaced = true;
          return false;
        }
      });

      if (replaced) URL.revokeObjectURL(blobUrl);
    })
    .catch(() => {
      // Keep blob preview if upload fails
    });
}

/** TipTap chain variant for file drops. */
export function insertImageFastInEditor(
  editor: Editor,
  file: File,
  uploadImage: UploadFn,
): void {
  insertImageFast(editor.view, file, uploadImage);
}
