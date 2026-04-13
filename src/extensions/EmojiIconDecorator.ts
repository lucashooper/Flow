import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const EMOJI_PLUGIN_KEY = new PluginKey('emoji-icon-decorator');

// Comprehensive emoji regex that matches:
// - Standard emojis (Extended_Pictographic)
// - Keycap sequences like 3️⃣ (digit + variation selector + combining enclosing keycap)
// - Flag sequences, skin tone modifiers, ZWJ sequences
// - Any character followed by variation selector U+FE0F (emoji presentation)
const emojiRegex = /(?:\p{Extended_Pictographic}(?:\u{FE0F}|\u{FE0E})?(?:\u{200D}\p{Extended_Pictographic}(?:\u{FE0F}|\u{FE0E})?)*|[0-9#*]\u{FE0F}?\u{20E3}|\p{Regional_Indicator}{2})/gu;

export const EmojiIconDecorator = Extension.create({
  name: 'emojiIconDecorator',

  addProseMirrorPlugins() {
    const createDecorations = (doc: any): DecorationSet => {
      const decorations: Decoration[] = [];

      doc.descendants((node: any, pos: number) => {
        // Apply emoji-icon class in ALL node types, not just headings
        // This ensures emojis in paragraphs, list items etc. also render natively
        if (!node.isTextblock) return;

        let accumulatedPos = pos + 1; // position inside block

        node.forEach((child: any) => {
          if (child.isText) {
            const text = child.text || '';
            let match;
            emojiRegex.lastIndex = 0;
            
            while ((match = emojiRegex.exec(text)) !== null) {
              const emoji = match[0];
              const from = accumulatedPos + match.index;
              const to = from + emoji.length;

              decorations.push(Decoration.inline(from, to, { class: 'emoji-icon' }));
            }
          }
          accumulatedPos += child.nodeSize;
        });
      });

      return DecorationSet.create(doc, decorations);
    };

    return [
      new Plugin({
        key: EMOJI_PLUGIN_KEY,
        state: {
          init: (_, { doc }) => createDecorations(doc),
          apply: (tr, old, _oldState, newState) => {
            if (!tr.docChanged) {
              return old.map(tr.mapping, tr.doc);
            }
            return createDecorations(newState.doc);
          },
        },
        props: {
          decorations(state) {
            return EMOJI_PLUGIN_KEY.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },
});
