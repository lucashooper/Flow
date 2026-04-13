import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

export interface ImagePasteOptions {
  uploadImage: (file: File) => Promise<string | null>;
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
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const { schema, tr } = view.state;
        
        // Determine node type based on file type
        let nodeType;
        if (isVideo) {
          nodeType = schema.nodes.resizableVideo;
          if (!nodeType) {
            console.error('❌ No video node type found in schema');
            return;
          }
        } else {
          // Use resizableImage node (custom extension) or fallback to image
          nodeType = schema.nodes.resizableImage || schema.nodes.image;
          if (!nodeType) {
            console.error('❌ No image node type found in schema');
            return;
          }
        }
        
        const tempNode = nodeType.create({ 
          src: base64,
          'data-uploading': 'true'
        });
        view.dispatch(tr.replaceSelectionWith(tempNode));
        
        // Upload actual file in background
        uploadImage(file).then((url: string | null) => {
          console.log('✅ Upload complete, URL:', url);
          if (url) {
            const { state, dispatch } = view;
            let tempImagePos: number | null = null;
            
            state.doc.descendants((node: any, pos: number) => {
              if ((node.type.name === 'resizableImage' || node.type.name === 'image' || node.type.name === 'resizableVideo') && 
                  node.attrs['data-uploading'] === 'true') {
                tempImagePos = pos;
                return false;
              }
            });
            
            if (tempImagePos !== null) {
              // Determine correct node type for replacement
              const nodeType = state.schema.nodes.resizableVideo || 
                              state.schema.nodes.resizableImage || 
                              state.schema.nodes.image;
              if (!nodeType) {
                console.error('❌ No media node type found in schema for replacement');
                return;
              }
              
              const finalNode = nodeType.create({ src: url });
              const replaceTr = state.tr.replaceRangeWith(
                tempImagePos,
                tempImagePos + 1,
                finalNode
              );
              dispatch(replaceTr);
              console.log('✅ Media replaced with uploaded URL');
            }
          }
        }).catch((error: any) => {
          console.error('❌ Upload failed:', error);
          const { state, dispatch } = view;
          state.doc.descendants((node: any, pos: number) => {
            if ((node.type.name === 'resizableImage' || node.type.name === 'image' || node.type.name === 'resizableVideo') && 
                node.attrs['data-uploading'] === 'true') {
              dispatch(state.tr.delete(pos, pos + node.nodeSize));
              return false;
            }
          });
        });
      };
      
      reader.readAsDataURL(file);
    };

    return [
      new Plugin({
        key: new PluginKey('imagePaste'),
        props: {
          handleDOMEvents: {
            drop: (view, event) => {
              console.log('🎯 [MediaPaste] DOM drop event intercepted!', {
                target: event.target,
                files: event.dataTransfer?.files.length
              });
              
              const dataTransfer = event.dataTransfer;
              if (!dataTransfer) {
                console.log('❌ [MediaPaste] No dataTransfer in DOM event');
                return false;
              }

              const files = Array.from(dataTransfer.files);
              console.log('📋 [MediaPaste] Files in DOM drop:', files.length, files.map(f => f.type));
              
              const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
              console.log('📋 [MediaPaste] Media files filtered:', mediaFiles.length);
              
              if (mediaFiles.length === 0) {
                console.log('⚠️ [MediaPaste] No media files found in DOM drop');
                return false;
              }

              console.log('🖼️ [MediaPaste] DOM Drop detected,', mediaFiles.length, 'media file(s)');
              event.preventDefault();
              event.stopPropagation();

              // Insert at end of document
              const insertPos = view.state.doc.content.size;
              console.log('📍 [MediaPaste] Inserting at end of document:', insertPos);

              // Set selection to insert position
              try {
                const resolved = view.state.doc.resolve(insertPos);
                const tr = view.state.tr.setSelection(TextSelection.near(resolved));
                view.dispatch(tr);
                console.log('✅ [MediaPaste] Selection set to position:', insertPos);
              } catch (error) {
                console.error('❌ [MediaPaste] Failed to set selection:', error);
              }

              for (const file of mediaFiles) {
                console.log('📸 [MediaPaste] Processing dropped media:', file.name, file.type);
                insertMediaFile(view, file);
              }

              console.log('✅ [MediaPaste] DOM drop completed successfully');
              return true;
            }
          },
          handlePaste: (view, event) => {
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

          handleDrop: (view, event) => {
            console.log('🎯 [MediaPaste] handleDrop called!', {
              target: event.target,
              clientX: event.clientX,
              clientY: event.clientY,
              dataTransfer: event.dataTransfer
            });

            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) {
              console.log('❌ [MediaPaste] No dataTransfer');
              return false;
            }

            const files = Array.from(dataTransfer.files);
            console.log('📋 [MediaPaste] Files in drop:', files.length, files.map(f => f.type));
            
            const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
            console.log('📋 [MediaPaste] Media files filtered:', mediaFiles.length);
            
            if (mediaFiles.length === 0) {
              console.log('⚠️ [MediaPaste] No media files found in drop');
              return false;
            }

            console.log('🖼️ [MediaPaste] Drop detected,', mediaFiles.length, 'media file(s)');
            event.preventDefault();

            // Try to get drop position, but if it fails (dropped outside content), insert at end
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            console.log('📍 [MediaPaste] posAtCoords result:', pos);
            
            let insertPos: number;
            
            if (pos && pos.pos >= 0 && pos.pos <= view.state.doc.content.size) {
              // Valid drop position - use it
              insertPos = pos.pos;
              console.log('✅ [MediaPaste] Using drop position:', insertPos);
            } else {
              // Invalid position (dropped outside content area) - insert at end
              insertPos = view.state.doc.content.size;
              console.log('✅ [MediaPaste] Using end of document:', insertPos);
            }

            // Set selection to insert position
            try {
              const resolved = view.state.doc.resolve(insertPos);
              const tr = view.state.tr.setSelection(TextSelection.near(resolved));
              view.dispatch(tr);
              console.log('✅ [MediaPaste] Selection set to position:', insertPos);
            } catch (error) {
              console.error('❌ [MediaPaste] Failed to set selection:', error);
            }

            for (const file of mediaFiles) {
              console.log('📸 [MediaPaste] Processing dropped media:', file.name, file.type);
              insertMediaFile(view, file);
            }

            console.log('✅ [MediaPaste] handleDrop completed successfully');
            return true;
          },
        },
      }),
    ];
  },
});
