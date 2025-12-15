import { Editor } from '@tiptap/react';

export type StarredFormattingType =
  | 'textColor'
  | 'highlight'
  | 'boldColor'
  | 'bulletStyle'
  | 'fontSize';

export interface StarredFormattingAction {
  type: StarredFormattingType;
  value: string;
}

export const STARRED_FORMATTING_KEY = 'flow.starredFormattingActions';

export const applyFormattingAction = (editor: Editor, action: StarredFormattingAction) => {
  const chain = editor.chain().focus();

  switch (action.type) {
    case 'textColor':
      if (action.value) {
        const current = (editor.getAttributes('textStyle')?.color as string) || null;
        if (current && current.toLowerCase() === action.value.toLowerCase()) {
          chain.unsetColor().run();
        } else {
          chain.setColor(action.value).run();
        }
      } else {
        chain.unsetColor().run();
      }
      break;

    case 'highlight':
      {
        const isActive = editor.isActive('highlight', { color: action.value });
        if (isActive) {
          chain.unsetHighlight().run();
        } else {
          chain.setHighlight({ color: action.value }).run();
        }
      }
      break;

    case 'boldColor':
      // Bold color works by toggling bold and setting color
      if (action.value) {
        localStorage.setItem('defaultBoldColor', action.value);
        chain.toggleBold().setColor(action.value).run();
      } else {
        localStorage.removeItem('defaultBoldColor');
        chain.toggleBold().unsetColor().run();
      }
      break;

    case 'bulletStyle':
      // Bullet style is stored in localStorage and triggers a custom event
      localStorage.setItem('bulletStyle', action.value);
      window.dispatchEvent(new CustomEvent('bulletStyleChanged', { detail: action.value }));
      break;

    case 'fontSize':
      {
        // Toggle behavior: if current selection already has this font size, unset it
        const current = (editor.getAttributes('textStyle')?.fontSize as string) || null;
        if (current === action.value) {
          chain.unsetFontSize().run();
        } else {
          chain.setFontSize(action.value).run();
        }
      }
      break;
  }
};
