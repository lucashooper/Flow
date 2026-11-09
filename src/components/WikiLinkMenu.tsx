import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { LearningStatus } from '../types';
import { statusEmoji } from '../lib/learning';

export interface WikiLinkItem {
  kind: 'note' | 'create';
  id: string;
  title: string;
  emoji: string | null;
  status: LearningStatus | null;
}

export interface WikiLinkMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface WikiLinkMenuProps {
  items: WikiLinkItem[];
  command: (item: WikiLinkItem) => void;
}

/** The popup shown after typing [[ in a Learning note. */
export const WikiLinkMenu = forwardRef<WikiLinkMenuHandle, WikiLinkMenuProps>(({ items, command }, ref) => {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items]);

  const pick = (i: number) => {
    const item = items[i];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (!items.length) return false;
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        pick(index);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      className="w-72 max-h-64 overflow-y-auto rounded-lg py-1 text-sm shadow-2xl"
      style={{ backgroundColor: 'var(--bg-panel, #161616)', border: '1px solid var(--divider, #2a2a2a)', color: 'var(--text)' }}
    >
      {items.length === 0 ? (
        <div className="px-3 py-2" style={{ color: 'var(--muted)' }}>
          Type a concept name…
        </div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.kind === 'create' ? 'create' : item.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              pick(i);
            }}
            onMouseEnter={() => setIndex(i)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
            style={{ backgroundColor: i === index ? 'var(--bg-elev, #222)' : 'transparent' }}
          >
            {item.kind === 'create' ? (
              <>
                <span style={{ color: 'var(--accent)' }}>＋</span>
                <span className="truncate">
                  Create <strong>“{item.title}”</strong>
                </span>
              </>
            ) : (
              <>
                <span className="w-4 text-center flex-shrink-0">{item.emoji || '📄'}</span>
                <span className="truncate flex-1">{item.title}</span>
                {statusEmoji(item.status) && <span className="text-xs flex-shrink-0">{statusEmoji(item.status)}</span>}
              </>
            )}
          </button>
        ))
      )}
    </div>
  );
});
WikiLinkMenu.displayName = 'WikiLinkMenu';
