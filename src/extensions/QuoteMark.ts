import { Mark } from '@tiptap/core';
import { markInputRule, markPasteRule } from '@tiptap/core';

export const QuoteMark = Mark.create({
  name: 'quoteMark',

  onCreate() {
    console.log('✅ QuoteMark extension created');
  },

  addOptions() {
    console.log('⚙️  QuoteMark: Adding options');
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    console.log('📝 QuoteMark: Adding attributes');
    return {
      quoteType: {
        default: 'double',
        parseHTML: element => {
          const type = element.getAttribute('data-quote-type');
          console.log('📖 Parsing quote type:', type);
          return type;
        },
        renderHTML: attributes => {
          console.log('🎨 Rendering quote type attribute:', attributes.quoteType);
          return {
            'data-quote-type': attributes.quoteType || 'double',
          };
        },
      },
    };
  },

  parseHTML() {
    console.log('📖 QuoteMark: parseHTML called');
    return [
      {
        tag: 'span.quote-mark',
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const quoteStyle = localStorage.getItem('quoteStyle') || 'default';
    const quoteType = mark.attrs.quoteType || 'double';
    
    console.log('🎨 Rendering quote mark:', {
      quoteType,
      quoteStyle,
      HTMLAttributes,
    });
    
    return [
      'span',
      {
        ...HTMLAttributes,
        class: `quote-mark quote-${quoteStyle}`,
        'data-quote-type': quoteType,
      },
      0,
    ];
  },

  addInputRules() {
    console.log('⌨️  QuoteMark: Adding input rules');
    return [
      // Double quotes - capture text between quotes, CSS will add them back
      markInputRule({
        find: /"([^"]*)"/g,
        type: this.type,
        getAttributes: (match) => {
          console.log('🎯 Double quote matched!', {
            fullMatch: match[0],
            captureGroup: match[1],
          });
          return { quoteType: 'double' };
        },
      }),
      // Single quotes - capture text between quotes, CSS will add them back
      markInputRule({
        find: /'([^']*)'/g,
        type: this.type,
        getAttributes: (match) => {
          console.log('🎯 Single quote matched!', {
            fullMatch: match[0],
            captureGroup: match[1],
          });
          return { quoteType: 'single' };
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: /"([^"]*)"/g,
        type: this.type,
        getAttributes: () => ({ quoteType: 'double' }),
      }),
      markPasteRule({
        find: /'([^']*)'/g,
        type: this.type,
        getAttributes: () => ({ quoteType: 'single' }),
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-q': () => {
        return this.editor.commands.toggleMark('quoteMark', {
          quoteType: 'double',
        });
      },
    };
  },
});
