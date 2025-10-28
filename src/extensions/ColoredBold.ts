import Bold from '@tiptap/extension-bold';

export const ColoredBold = Bold.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-b': () => {
        const boldColor = localStorage.getItem('defaultBoldColor');
        const wasBold = this.editor.isActive('bold');
        
        // Toggle bold
        this.editor.chain().focus().toggleBold().run();
        
        // If we just made it bold (wasn't bold before), apply color
        if (!wasBold && boldColor) {
          this.editor.chain().focus().setColor(boldColor).run();
        }
        
        return true;
      },
    };
  },
});
