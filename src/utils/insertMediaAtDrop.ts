import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import { insertImageFast } from './insertImageFast';
import { autoFitImagesInParagraph, getFileDropPreview } from './imageDropPreview';
import { logImageDrop } from './imageDropDebug';

type UploadFn = (file: File) => Promise<string | null>;

function insertImageIntoParagraph(
  view: EditorView,
  file: File,
  uploadImage: UploadFn,
  targetImagePos: number,
  insertAfter: boolean,
): void {
  const { state } = view;
  const imageType = state.schema.nodes.resizableImage;
  if (!imageType) {
    logImageDrop('file drop — resizableImage missing from schema');
    return;
  }

  const $target = state.doc.resolve(targetImagePos);
  if ($target.parent.type.name !== 'paragraph') {
    logImageDrop('file drop — target not in paragraph, falling back');
    insertImageFast(view, file, uploadImage);
    return;
  }

  const paraStart = $target.start();
  const paraEnd = $target.end();
  const children: PMNode[] = [];
  let targetIndex = -1;
  let offset = 0;

  $target.parent.forEach((child) => {
    const childPos = paraStart + offset;
    if (childPos === targetImagePos) targetIndex = children.length;
    children.push(child);
    offset += child.nodeSize;
  });

  if (targetIndex < 0) {
    insertImageFast(view, file, uploadImage);
    return;
  }

  const blobUrl = URL.createObjectURL(file);
  const newImage = imageType.create({
    src: blobUrl,
    'data-uploading': 'true',
    'data-blob-url': blobUrl,
  });

  const insertIndex = insertAfter ? targetIndex + 1 : targetIndex;
  children.splice(insertIndex, 0, newImage);

  logImageDrop('file drop same-row', {
    targetImagePos,
    insertAfter,
    imageCount: children.filter((c) => c.type.name === 'resizableImage').length,
  });

  let tr = state.tr.replaceWith(paraStart, paraEnd, children);
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(paraStart + 1)));
  view.dispatch(tr.scrollIntoView());

  void uploadImage(file).then((uploadedUrl) => {
    if (!uploadedUrl) return;
    const { state: s } = view;
    s.doc.descendants((node, pos) => {
      if (node.type.name === 'resizableImage' && node.attrs.src === blobUrl) {
        view.dispatch(
          s.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            src: uploadedUrl,
            'data-uploading': null,
            'data-blob-url': null,
          }),
        );
        URL.revokeObjectURL(blobUrl);
        return false;
      }
    });
  });

  requestAnimationFrame(() => {
    autoFitImagesInParagraph(view, paraStart, true);
  });
}

function insertVideoAtPosition(
  view: EditorView,
  file: File,
  uploadImage: UploadFn,
  insertPos: number,
): void {
  const { state } = view;
  const videoType = state.schema.nodes.resizableVideo;
  if (!videoType) return;

  const blobUrl = URL.createObjectURL(file);
  const node = videoType.create({ src: blobUrl, 'data-uploading': 'true' });

  let tr = state.tr;
  try {
    const resolved = state.doc.resolve(Math.min(insertPos, state.doc.content.size));
    tr = tr.setSelection(TextSelection.near(resolved));
  } catch {
    // keep current selection
  }
  tr = tr.replaceSelectionWith(node);
  view.dispatch(tr.scrollIntoView());

  void uploadImage(file).then((url) => {
    if (!url) return;
    const { state: s } = view;
    s.doc.descendants((node, pos) => {
      if (node.type.name === 'resizableVideo' && node.attrs.src === blobUrl) {
        view.dispatch(
          s.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            src: url,
            'data-uploading': null,
          }),
        );
        URL.revokeObjectURL(blobUrl);
        return false;
      }
    });
  });
}

/** Insert media at a document position (e.g. gutter + menu). */
export function insertMediaAtPos(
  view: EditorView,
  file: File,
  uploadImage: UploadFn,
  pos: number,
): void {
  const node = view.state.doc.nodeAt(pos);
  if (node?.type.name === 'resizableImage' && file.type.startsWith('image/')) {
    insertImageIntoParagraph(view, file, uploadImage, pos, true);
    return;
  }

  try {
    const resolved = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
    view.dispatch(view.state.tr.setSelection(TextSelection.near(resolved)));
  } catch {
    // keep selection
  }

  if (file.type.startsWith('image/')) {
    insertImageFast(view, file, uploadImage);
  } else if (file.type.startsWith('video/')) {
    insertVideoAtPosition(view, file, uploadImage, pos);
  }
}

/** Insert dropped media at cursor or beside an existing image for side-by-side layout. */
export function insertMediaAtDrop(
  view: EditorView,
  file: File,
  uploadImage: UploadFn,
  clientX: number,
  clientY: number,
): void {
  const preview = getFileDropPreview(view, clientX, clientY);
  logImageDrop('file drop target', preview?.kind ?? 'fallback', preview?.insertPos);

  if (
    preview &&
    (preview.kind === 'same-row-before' || preview.kind === 'same-row-after') &&
    preview.targetImagePos != null &&
    file.type.startsWith('image/')
  ) {
    insertImageIntoParagraph(
      view,
      file,
      uploadImage,
      preview.targetImagePos,
      preview.kind === 'same-row-after',
    );
    return;
  }

  if (preview?.insertPos != null) {
    try {
      const resolved = view.state.doc.resolve(
        Math.min(preview.insertPos, view.state.doc.content.size),
      );
      view.dispatch(
        view.state.tr.setSelection(TextSelection.near(resolved)),
      );
    } catch (error) {
      logImageDrop('file drop — selection failed', error);
    }
  }

  if (file.type.startsWith('image/')) {
    insertImageFast(view, file, uploadImage);
  } else if (file.type.startsWith('video/')) {
    insertVideoAtPosition(
      view,
      file,
      uploadImage,
      preview?.insertPos ?? view.state.doc.content.size,
    );
  }
}
