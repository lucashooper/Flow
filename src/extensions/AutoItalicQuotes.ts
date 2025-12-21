import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { Transaction, EditorState } from 'prosemirror-state';

// Optional feature: automatically italicize text between quotes
// This extension keeps the quotes in the document and only applies the italic mark
// to the inner text. It checks localStorage at runtime so it can be toggled
// without reinitializing the editor.
export const AutoItalicQuotes = Extension.create({
  name: 'autoItalicQuotes',

  addProseMirrorPlugins() {
    const key = new PluginKey('autoItalicQuotes');

    const CLOSERS = new Set(['"', "'", '”', '’']);
    const OPENERS_FOR: Record<string, string[]> = {
      '"': ['"', '“'],
      '”': ['"', '“'],
      "'": ["'", '‘'],
      '’': ["'", '‘'],
    };

    const charAt = (doc: EditorState['doc'], from: number, to: number): string => {
      if (from < 0 || to <= from) return '';
      return doc.textBetween(from, to, '\0', '\0');
    };

    return [
      new Plugin({
        key,
        appendTransaction(transactions, _oldState, newState) {
          // Respect toggle; default ON
          const raw = localStorage.getItem('autoItalicQuotesEnabled');
          const enabled = raw === null ? true : raw === 'true';
          if (!enabled) return null;

          // Ignore if nothing changed or already processed
          if (!transactions.some(t => t.docChanged)) return null;
          if (transactions.some(t => t.getMeta(key))) return null;

          const { selection, schema, doc } = newState;
          const $from = selection.$from;

          // Skip in code blocks/inline code
          if ($from.parent.type.name === 'codeBlock') return null;
          const codeMark = schema.marks.code;
          if (codeMark && ($from.marks() || []).some(m => m.type === codeMark)) return null;

          const pos = selection.from; // caret position after insertion
          const last = charAt(doc, pos - 1, pos);
          if (!CLOSERS.has(last)) return null;

          // Constrain search to current textblock
          const blockStart = $from.start();
          const openers = new Set(OPENERS_FOR[last] || []);

          // Walk backwards to find nearest opener, balancing nested quotes
          let depth = 0;
          let openPos = -1;
          for (let p = pos - 2; p >= blockStart; p--) {
            const ch = charAt(doc, p, p + 1);
            if (CLOSERS.has(ch)) depth++;
            if (openers.has(ch)) {
              if (depth === 0) { openPos = p; break; }
              depth--;
            }
          }

          if (openPos < 0) return null;
          const innerFrom = openPos + 1;
          const innerTo = Math.max(pos - 1, innerFrom);
          if (innerTo <= innerFrom) return null;

          const italic = schema.marks.italic || schema.marks.em;
          if (!italic) return null;

          let tr: Transaction = newState.tr.addMark(innerFrom, innerTo, italic.create());
          tr = tr.setStoredMarks(null); // ensure subsequent typing is normal
          tr.setMeta(key, { applied: true, from: innerFrom, to: innerTo });
          return tr;
        },
      }),
    ];
  },
});
