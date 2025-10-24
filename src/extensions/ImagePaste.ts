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
                  
                  // Insert placeholder with unique ID for tracking
                  const placeholderId = `placeholder-${Date.now()}`;
                  const { schema, tr } = view.state;
                  const placeholderNode = schema.nodes.paragraph.create(
                    { 'data-placeholder-id': placeholderId },
                    [schema.text('⏳ Uploading image...')]
                  );
                  view.dispatch(tr.replaceSelectionWith(placeholderNode));
                  
                  // Upload in background
                  this.options.uploadImage(file).then((url) => {
                    console.log('✅ Upload complete, URL:', url);
                    if (url) {
                      // Find and replace placeholder with actual image
                      const { state, dispatch } = view;
                      let placeholderPos = null;
                      
                      // Search for placeholder in document
                      state.doc.descendants((node, pos) => {
                        if (node.type.name === 'paragraph' && 
                            node.textContent === '⏳ Uploading image...') {
                          placeholderPos = pos;
                          return false; // Stop searching
                        }
                      });
                      
                      if (placeholderPos !== null) {
                        const imageNode = state.schema.nodes.image.create({ src: url });
                        const tr = state.tr.replaceRangeWith(
                          placeholderPos,
                          placeholderPos + 1,
                          imageNode
                        );
                        dispatch(tr);
                        console.log('✅ Image inserted into editor');
                      }
                    }
                  }).catch((error) => {
                    console.error('❌ Upload failed:', error);
                    // Find and remove placeholder on error
                    const { state, dispatch } = view;
                    state.doc.descendants((node, pos) => {
                      if (node.type.name === 'paragraph' && 
                          node.textContent === '⏳ Uploading image...') {
                        dispatch(state.tr.delete(pos, pos + node.nodeSize));
                        return false;
                      }
                    });
                  });
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
