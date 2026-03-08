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
        const tempImageNode = schema.nodes.image.create({ 
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
              if (node.type.name === 'image' && 
                  node.attrs['data-uploading'] === 'true') {
                tempImagePos = pos;
                return false;
              }
            });
            
            if (tempImagePos !== null) {
              const finalImageNode = state.schema.nodes.image.create({ src: url });
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
            if (node.type.name === 'image' && 
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
                  insertImageFile(view, file);
                }
                return true;
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
