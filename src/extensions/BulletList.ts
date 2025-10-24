import { Extension } from '@tiptap/core';

export interface BulletColorOptions {
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bulletColor: {
      setBulletColor: (color: string) => ReturnType;
      unsetBulletColor: () => ReturnType;
    };
  }
}

export const BulletColor = Extension.create<BulletColorOptions>({
  name: 'bulletColor',

  addOptions() {
    return {
      types: ['bulletList'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          bulletColor: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-bullet-color'),
            renderHTML: (attributes) => {
              if (!attributes.bulletColor) {
                return {};
              }
              return {
                'data-bullet-color': attributes.bulletColor,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBulletColor:
        (color: string) =>
        ({ chain }) => {
          return chain().updateAttributes('bulletList', { bulletColor: color }).run();
        },
      unsetBulletColor:
        () =>
        ({ chain }) => {
          return chain().updateAttributes('bulletList', { bulletColor: null }).run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
    };
  },
});
