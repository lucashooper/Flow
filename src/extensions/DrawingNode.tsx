import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DrawingNodeView } from './DrawingNodeView';

export const DrawingNode = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true, // Cannot be split or edited as text
  draggable: true,

  addAttributes() {
    return {
      drawingId: {
        default: null,
        parseHTML: element => element.getAttribute('data-drawing-id'),
        renderHTML: attributes => ({
          'data-drawing-id': attributes.drawingId,
        }),
      },
      drawingData: {
        default: null,
      },
      height: {
        default: '400px',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="drawing"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'drawing' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingNodeView);
  },

  addCommands() {
    return {
      insertDrawing:
        (attributes: any) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    } as any;
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-d': () => {
        const drawingId = crypto.randomUUID();
        return this.editor.commands.insertContent({
          type: this.name,
          attrs: { drawingId },
        });
      },
    };
  },
});
