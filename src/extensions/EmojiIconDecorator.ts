import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const EMOJI_PLUGIN_KEY = new PluginKey('emoji-icon-decorator');

// Rough emoji detection using Unicode Extended Pictographic block
const leadingEmojiRegex = /^[\p{Extended_Pictographic}]/u;

export const EmojiIconDecorator = Extension.create({
  name: 'emojiIconDecorator',

  addProseMirrorPlugins() {
    console.log('[EmojiIconDecorator] Plugin initialised');

    const createDecorations = (doc: any): DecorationSet => {
      console.log('[EmojiIconDecorator] createDecorations called');
      const decorations: Decoration[] = [];

      doc.descendants((node: any, pos: number) => {
        if (node.type.name !== 'heading') return;

        console.log('[EmojiIconDecorator] Heading node:', node.textContent);

        // Look only at the very first text child of the heading
        let accumulatedPos = pos + 1; // position inside heading
        let found = false;

        node.forEach((child: any) => {
          if (found || !child.isText) {
            accumulatedPos += child.nodeSize;
            return;
          }

          const text = child.text || '';
          const match = leadingEmojiRegex.exec(text);
          if (match) {
            const emoji = match[0];
            const from = accumulatedPos;
            const to = from + emoji.length;

            console.log('[EmojiIconDecorator] Found leading emoji:', {
              emoji,
              from,
              to,
              text,
            });

            decorations.push(Decoration.inline(from, to, { class: 'emoji-icon' }));
            found = true;
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
