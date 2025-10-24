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
                  
                  // Insert placeholder immediately for instant feedback
                  const { schema, tr } = view.state;
                  const placeholderNode = schema.nodes.paragraph.create(null, [
                    schema.text('⏳ Uploading image...')
                  ]);
                  const placeholderTr = tr.replaceSelectionWith(placeholderNode);
                  const placeholderPos = placeholderTr.selection.from - 1;
                  view.dispatch(placeholderTr);
                  
                  // Upload in background
                  this.options.uploadImage(file).then((url) => {
                    console.log('✅ Upload complete, URL:', url);
                    if (url) {
                      // Replace placeholder with actual image
                      const { state, dispatch } = view;
                      const node = state.schema.nodes.image.create({ src: url });
                      const transaction = state.tr.replaceRangeWith(
                        placeholderPos,
                        placeholderPos + 1,
                        node
                      );
                      dispatch(transaction);
                      console.log('✅ Image inserted into editor');
                    }
                  }).catch((error) => {
                    console.error('❌ Upload failed:', error);
                    // Remove placeholder on error
                    const { state, dispatch } = view;
                    const transaction = state.tr.delete(placeholderPos, placeholderPos + 1);
                    dispatch(transaction);
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
