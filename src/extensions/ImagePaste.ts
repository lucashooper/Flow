import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

export interface ImagePasteOptions {
  uploadImage: (file: File) => Promise<string | null>;
}

export const ImagePaste = Extension.create<ImagePasteOptions>({
  name: 'imagePaste',

  addOptions() {
    return {
      uploadImage: async () => null,
    };
  },

  addProseMirrorPlugins() {
    const uploadImage = this.options.uploadImage;

    // Shared helper: insert image file into editor with upload
    const insertImageFile = (view: any, file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const { schema, tr } = view.state;
        
        // Insert temporary image with base64
        // Use resizableImage node (custom extension) or fallback to image
        const imageNodeType = schema.nodes.resizableImage || schema.nodes.image;
        if (!imageNodeType) {
          console.error('❌ No image node type found in schema');
          return;
        }
        
        const tempImageNode = imageNodeType.create({ 
          src: base64,
          'data-uploading': 'true'
        });
        view.dispatch(tr.replaceSelectionWith(tempImageNode));
        
        // Upload actual file in background
        uploadImage(file).then((url: string | null) => {
          console.log('✅ Upload complete, URL:', url);
          if (url) {
            const { state, dispatch } = view;
            let tempImagePos: number | null = null;
            
            state.doc.descendants((node: any, pos: number) => {
              if ((node.type.name === 'resizableImage' || node.type.name === 'image') && 
                  node.attrs['data-uploading'] === 'true') {
                tempImagePos = pos;
                return false;
              }
            });
            
            if (tempImagePos !== null) {
              const imageNodeType = state.schema.nodes.resizableImage || state.schema.nodes.image;
              if (!imageNodeType) {
                console.error('❌ No image node type found in schema for replacement');
                return;
              }
              
              const finalImageNode = imageNodeType.create({ src: url });
              const replaceTr = state.tr.replaceRangeWith(
                tempImagePos,
                tempImagePos + 1,
                finalImageNode
              );
              dispatch(replaceTr);
              console.log('✅ Image replaced with uploaded URL');
            }
          }
        }).catch((error: any) => {
          console.error('❌ Upload failed:', error);
          const { state, dispatch } = view;
          state.doc.descendants((node: any, pos: number) => {
            if ((node.type.name === 'resizableImage' || node.type.name === 'image') && 
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
          handlePaste: (view, event) => {
            console.log('🎯 ImagePaste Extension: Paste detected');
            const items = event.clipboardData?.items;
            
            if (!items) {
              console.log('📋 No clipboard items');
              return false;
            }

            console.log('📋 Clipboard items count:', items.length);

            // First pass: look for direct image files
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              console.log(`📋 Item ${i} type:`, item.type, 'kind:', item.kind);

              if (item.type.indexOf('image') === 0) {
                console.log('📸 Direct image detected in paste!');
                event.preventDefault();
                
                const file = item.getAsFile();
                console.log('📸 File object:', file);

                if (file) {
                  console.log('⬆️ Starting upload...');
                  insertImageFile(view, file);
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
                          insertImageFile(view, file);
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
                          insertImageFile(view, file);
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
                
                if (file.type.startsWith('image/')) {
                  console.log('📸 Image file detected in clipboard files!');
                  event.preventDefault();
                  insertImageFile(view, file);
                  return true;
                }
              }
            }

            console.log('📋 No image found in clipboard');
            return false;
          },

          handleDrop: (view, event) => {
            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) return false;

            const files = Array.from(dataTransfer.files);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            
            if (imageFiles.length === 0) return false;

            console.log('🖼️ ImagePaste Extension: Drop detected,', imageFiles.length, 'image(s)');
            event.preventDefault();

            // Set cursor position to drop location
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos) {
              const resolved = view.state.doc.resolve(pos.pos);
              const tr = view.state.tr.setSelection(
                TextSelection.near(resolved)
              );
              view.dispatch(tr);
            }

            for (const file of imageFiles) {
              console.log('� Processing dropped image:', file.name, file.type);
              insertImageFile(view, file);
            }

            return true;
          },
        },
      }),
    ];
  },
});
