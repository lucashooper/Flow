import { Node, mergeAttributes } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { learningBridge } from '../lib/learning';
import { WikiLinkMenu, type WikiLinkItem, type WikiLinkMenuHandle } from '../components/WikiLinkMenu';

/**
 * [[Wikilinks]] between concept notes in the 🧠 Learning space.
 *
 * Stored as `<span data-wikilink data-note-id="…">Title</span>`. The link points
 * at the note's id, so renaming a note never breaks it; the chip always shows
 * the note's current title.
 */
export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-note-id'),
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-note-id': attrs.id }),
      },
      title: {
        default: '',
        parseHTML: (el: HTMLElement) => el.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-wikilink': '', class: 'wikilink' }), node.attrs.title || 'Untitled'];
  },

  renderText({ node }) {
    return `[[${node.attrs.title}]]`;
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'wikilink';
      dom.setAttribute('data-wikilink', '');
      dom.setAttribute('data-note-id', node.attrs.id ?? '');
      dom.contentEditable = 'false';

      const paint = () => {
        const live = node.attrs.id ? learningBridge().title(node.attrs.id) : undefined;
        dom.textContent = live || node.attrs.title || 'Untitled';
        dom.title = live ? `Open “${live}”` : 'Linked note';
      };
      paint();
      window.addEventListener('learningTitlesChanged', paint);

      dom.addEventListener('mousedown', (e) => {
        // Open the linked note instead of moving the cursor.
        e.preventDefault();
        e.stopPropagation();
        if (node.attrs.id) learningBridge().open(node.attrs.id);
      });

      return {
        dom,
        destroy: () => window.removeEventListener('learningTitlesChanged', paint),
      };
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      Suggestion<WikiLinkItem>({
        editor,
        pluginKey: new PluginKey('wikiLinkSuggestion'),
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null,
        allow: () => learningBridge().isActive(),
        items: async ({ query }) => {
          const q = query.replace(/\]+$/, '').trim();
          const matches = await learningBridge().search(q);
          const items: WikiLinkItem[] = matches.map((m) => ({ kind: 'note', ...m }));
          const exact = matches.some((m) => m.title.toLowerCase() === q.toLowerCase());
          if (q && !exact) items.push({ kind: 'create', id: '', title: q, emoji: null, status: null });
          return items;
        },
        command: ({ editor: ed, range, props }) => {
          const insert = (id: string, title: string) => {
            ed.chain()
              .focus()
              .insertContentAt(range, [
                { type: 'wikiLink', attrs: { id, title } },
                { type: 'text', text: ' ' },
              ])
              .run();
          };
          if (props.kind === 'create') {
            void learningBridge()
              .create(props.title)
              .then((created) => {
                if (created) insert(created.id, created.title);
              });
          } else {
            insert(props.id, props.title);
          }
        },
        render: () => {
          let renderer: ReactRenderer<WikiLinkMenuHandle> | null = null;

          const place = (props: SuggestionProps<WikiLinkItem>) => {
            const rect = props.clientRect?.();
            const el = renderer?.element as HTMLElement | undefined;
            if (!rect || !el) return;
            el.style.position = 'fixed';
            el.style.zIndex = '10000';
            el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
            const below = rect.bottom + 6;
            el.style.top = below + 260 > window.innerHeight ? `${Math.max(8, rect.top - 266)}px` : `${below}px`;
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(WikiLinkMenu, { props, editor: props.editor });
              document.body.appendChild(renderer.element);
              place(props);
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              place(props);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                renderer?.destroy();
                renderer?.element.remove();
                renderer = null;
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              renderer?.destroy();
              renderer?.element.remove();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
