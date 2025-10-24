import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

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

            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              console.log(`📋 Item ${i} type:`, item.type);

              if (item.type.indexOf('image') === 0) {
                console.log('📸 Image detected in paste!');
                event.preventDefault();
                
                const file = item.getAsFile();
                console.log('📸 File object:', file);

                if (file) {
                  console.log('⬆️ Starting upload...');
                  
                  // Create a temporary base64 preview for instant feedback
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const base64 = e.target?.result as string;
                    const { schema, tr } = view.state;
                    
                    // Insert temporary image with base64
                    const tempImageNode = schema.nodes.image.create({ 
                      src: base64,
                      'data-uploading': 'true'
                    });
                    view.dispatch(tr.replaceSelectionWith(tempImageNode));
                    
                    // Upload actual file in background
                    this.options.uploadImage(file).then((url) => {
                      console.log('✅ Upload complete, URL:', url);
                      if (url) {
                        // Replace base64 image with uploaded URL
                        const { state, dispatch } = view;
                        let tempImagePos = null;
                        
                        // Find the temporary image
                        state.doc.descendants((node, pos) => {
                          if (node.type.name === 'image' && 
                              node.attrs['data-uploading'] === 'true') {
                            tempImagePos = pos;
                            return false;
                          }
                        });
                        
                        if (tempImagePos !== null) {
                          const finalImageNode = state.schema.nodes.image.create({ src: url });
                          const tr = state.tr.replaceRangeWith(
                            tempImagePos,
                            tempImagePos + 1,
                            finalImageNode
                          );
                          dispatch(tr);
                          console.log('✅ Image replaced with uploaded URL');
                        }
                      }
                    }).catch((error) => {
                      console.error('❌ Upload failed:', error);
                      // Remove the temporary image on error
                      const { state, dispatch } = view;
                      state.doc.descendants((node, pos) => {
                        if (node.type.name === 'image' && 
                            node.attrs['data-uploading'] === 'true') {
                          dispatch(state.tr.delete(pos, pos + node.nodeSize));
                          return false;
                        }
                      });
                    });
                  };
                  
                  reader.readAsDataURL(file);
                }
                return true;
              }
            }

            console.log('📋 No image found in clipboard');
            return false;
          },
        },
      }),
    ];
  },
});
