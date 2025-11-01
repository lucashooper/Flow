import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { isWordCorrect } from '../utils/spellcheck';

export const SpellCheckPluginKey = new PluginKey('spellCheck');

export const SpellCheck = Extension.create({
  name: 'spellCheck',

  addProseMirrorPlugins() {
    let updateTimeout: number | null = null;

    return [
      new Plugin({
        key: SpellCheckPluginKey,
        state: {
          init(_, { doc }) {
            return findMisspelledWords(doc);
          },
          apply(tr, oldState) {
            // If document didn't change, map old decorations
            if (!tr.docChanged) {
              return oldState.map(tr.mapping, tr.doc);
            }

            // Clear any pending timeout
            if (updateTimeout !== null) {
              clearTimeout(updateTimeout);
              updateTimeout = null;
            }

            // For small changes, update immediately
            // For larger typing, this will feel responsive
            return findMisspelledWords(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function findMisspelledWords(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  const MAX_DECORATIONS = 500; // Prevent performance issues with very large documents
  
  // Traverse document efficiently
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    if (decorations.length >= MAX_DECORATIONS) return false; // Stop if we hit limit
    
    const text = node.text;
    const wordRegex = /\b[a-zA-Z']+\b/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      if (decorations.length >= MAX_DECORATIONS) break;
      
      const word = match[0];
      
      // Skip very short words, numbers, and single letters
      if (word.length <= 2) continue;
      
      // Skip words with apostrophes at start/end (artifacts)
      const cleanWord = word.replace(/^'+|'+$/g, '');
      if (cleanWord.length <= 2) continue;

      // Check spelling
      if (!isWordCorrect(cleanWord)) {
        const from = pos + match.index;
        const to = from + word.length;
        
        decorations.push(
          Decoration.inline(from, to, {
            nodeName: 'span',
            class: 'misspelled-word',
            'data-word': cleanWord,
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}
