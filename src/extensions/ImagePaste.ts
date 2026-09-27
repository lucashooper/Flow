import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { insertImageFast } from '../utils/insertImageFast';
import { insertMediaAtDrop } from '../utils/insertMediaAtDrop';
import { pasteImagesFromHtml, logImageDrop } from '../utils/imageDropDebug';
import { ensureTrailingParagraph } from '../utils/ensureEditableSpaceAroundImages';

export interface ImagePasteOptions {
  uploadImage: (file: File) => Promise<string | null>;
}

let lastFileDropKey = '';

function shouldHandleFileDrop(event: DragEvent): boolean {
  const key = `${event.timeStamp}:${event.clientX}:${event.clientY}:${event.dataTransfer?.files.length ?? 0}`;
  if (key === lastFileDropKey) return false;
  lastFileDropKey = key;
  return true;
}

export const ImagePaste = Extension.create<ImagePasteOptions>({
  name: 'mediaPaste',
  
  priority: 1000, // High priority to run before other extensions

  addOptions() {
    return {
      uploadImage: async () => null,
    };
  },

  addProseMirrorPlugins() {
    const uploadImage = this.options.uploadImage;

    // Shared helper: insert image or video file into editor with upload
    const insertMediaFile = (view: any, file: File) => {
      const isVideo = file.type.startsWith('video/');

      if (!isVideo) {
        insertImageFast(view, file, uploadImage);
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      const nodeType = view.state.schema.nodes.resizableVideo;
      if (!nodeType) {
        URL.revokeObjectURL(blobUrl);
        return;
      }

      view.dispatch(
        view.state.tr.replaceSelectionWith(
          nodeType.create({ src: blobUrl, 'data-uploading': 'true' }),
        ),
      );

      uploadImage(file)
        .then((url: string | null) => {
          if (!url) return;
          const { state, dispatch } = view;
          state.doc.descendants((node: any, pos: number) => {
            if (
              node.type.name === 'resizableVideo' &&
              node.attrs.src === blobUrl
            ) {
              dispatch(
                state.tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  src: url,
                  'data-uploading': null,
                }),
              );
              URL.revokeObjectURL(blobUrl);
              return false;
            }
          });
        })
        .catch(() => {});
    };

    return [
      new Plugin({
        key: new PluginKey('imagePaste'),
        props: {
          handleDOMEvents: {
            drop: (view, event) => {
              const dataTransfer = event.dataTransfer;
              if (!dataTransfer) return false;
              if (!shouldHandleFileDrop(event)) return true;

              const mediaFiles = Array.from(dataTransfer.files).filter(
                (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
              );
              if (mediaFiles.length === 0) return false;

              logImageDrop('[onDrop:DOM]', mediaFiles.length, 'file(s)', {
                x: event.clientX,
                y: event.clientY,
              });

              event.preventDefault();
              event.stopPropagation();

              for (const file of mediaFiles) {
                insertMediaAtDrop(view, file, uploadImage, event.clientX, event.clientY);
              }

              ensureTrailingParagraph(view, true);
              window.dispatchEvent(new CustomEvent('flow:fileDropComplete'));
              return true;
            }
          },
          handlePaste: (view, event) => {
            const html = event.clipboardData?.getData('text/html') ?? '';
            if (html && html.includes('<img')) {
              if (pasteImagesFromHtml(html, view)) {
                event.preventDefault();
                return true;
              }
            }

            console.log('🎯 ImagePaste Extension: Paste detected');
            const items = event.clipboardData?.items;
            
            if (!items) {
              console.log('📋 No clipboard items');
              return false;
            }

            console.log('📋 Clipboard items count:', items.length);

            // First pass: look for direct image or video files
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              console.log(`📋 Item ${i} type:`, item.type, 'kind:', item.kind);

              if (item.type.indexOf('image') === 0 || item.type.indexOf('video') === 0) {
                console.log('📸 Direct media file detected in paste!', item.type);
                event.preventDefault();
                
                const file = item.getAsFile();
                console.log('📸 File object:', file);

                if (file) {
                  console.log('⬆️ Starting upload...');
                  insertMediaFile(view, file);
                  return true;
                }
              }
            }

            // Second pass: check for HTML with embedded images (WhatsApp, etc.)
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              
              if (item.type === 'text/html') {
                console.log('📋 HTML content detected, checking for embedded images...');
                
                // Prevent default immediately to avoid blue box
                event.preventDefault();
                
                // Get HTML content asynchronously
                item.getAsString((html) => {
                  console.log('📋 HTML content:', html.substring(0, 300));
                  
                  // Check for images in HTML - both data URIs and blob URLs
                  // Data URI: data:image/png;base64,...
                  // Blob URL: blob:https://web.whatsapp.com/...
                  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
                  const match = imgRegex.exec(html);
                  
                  if (match && match[1]) {
                    const src = match[1];
                    console.log('📸 Found image in HTML! src:', src.substring(0, 100));
                    
                    // Handle data URI
                    if (src.startsWith('data:image/')) {
                      console.log('📸 Processing data URI image...');
                      fetch(src)
                        .then(res => res.blob())
                        .then(blob => {
                          const mimeMatch = src.match(/data:(image\/[^;]+);/);
                          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                          const extension = mimeType.split('/')[1] || 'png';
                          
                          const file = new File([blob], `pasted-image.${extension}`, { type: mimeType });
                          console.log('📸 Converted data URI to file:', file);
                          insertMediaFile(view, file);
                        })
                        .catch(err => {
                          console.error('❌ Failed to convert data URI to file:', err);
                        });
                    }
                    // Handle blob URL (WhatsApp, etc.)
                    else if (src.startsWith('blob:')) {
                      console.log('📸 Processing blob URL image...');
                      fetch(src)
                        .then(res => {
                          console.log('📸 Blob fetch response:', res.status, res.type);
                          return res.blob();
                        })
                        .then(blob => {
                          console.log('📸 Blob fetched:', blob.type, blob.size, 'bytes');
                          const mimeType = blob.type || 'image/png';
                          const extension = mimeType.split('/')[1] || 'png';
                          
                          const file = new File([blob], `whatsapp-image.${extension}`, { type: mimeType });
                          console.log('📸 Converted blob URL to file:', file);
                          insertMediaFile(view, file);
                        })
                        .catch(err => {
                          console.error('❌ Failed to fetch blob URL:', err);
                          console.error('❌ This may be a CORS issue with external blob URLs');
                        });
                    } else {
                      console.log('⚠️ Image src is neither data URI nor blob URL:', src.substring(0, 50));
                    }
                  } else {
                    console.log('⚠️ HTML detected but no <img> tag found');
                    // If no image found, manually insert the HTML content as text
                    const { state } = view;
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const text = doc.body.textContent || '';
                    if (text.trim()) {
                      const tr = state.tr.insertText(text);
                      view.dispatch(tr);
                    }
                  }
                });
                
                return true; // Handled (or will be handled async)
              }
            }

            // Third pass: check for files (some apps provide images as files)
            const files = event.clipboardData?.files;
            if (files && files.length > 0) {
              for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log('📋 File in clipboard:', file.name, file.type);
                
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                  console.log('📸 Media file detected in clipboard files!');
                  event.preventDefault();
                  insertMediaFile(view, file);
                  return true;
                }
              }
            }

            console.log('📋 No image found in clipboard');
            return false;
          },

          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false;

            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) return false;
            if (!shouldHandleFileDrop(event)) return true;

            const mediaFiles = Array.from(dataTransfer.files).filter(
              (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
            );
            if (mediaFiles.length === 0) return false;

            logImageDrop('[onDrop:PM]', mediaFiles.length, 'file(s)', {
              x: event.clientX,
              y: event.clientY,
            });

            event.preventDefault();

            for (const file of mediaFiles) {
              insertMediaAtDrop(view, file, uploadImage, event.clientX, event.clientY);
            }

            ensureTrailingParagraph(view, true);
            window.dispatchEvent(new CustomEvent('flow:fileDropComplete'));
            return true;
          },
        },
      }),
    ];
  },
});
