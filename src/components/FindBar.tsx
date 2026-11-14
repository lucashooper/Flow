import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { isDesktopApp } from '../lib/platform';

/**
 * Ctrl/⌘ + F in the desktop app: find text anywhere on screen, like a browser's
 * find bar (the desktop app's web view has none). Matches are painted with the
 * CSS Custom Highlight API, so notes are never modified.
 */

const ALL = 'flow-find';
const CURRENT = 'flow-find-current';
const MAX_MATCHES = 2000;

type HighlightRegistry = { set(name: string, h: unknown): void; delete(name: string): void };
const highlights = (): HighlightRegistry | null =>
  (globalThis as unknown as { CSS?: { highlights?: HighlightRegistry } }).CSS?.highlights ?? null;
const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;

function findRanges(query: string, root: HTMLElement, exclude: HTMLElement | null): Range[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el || (exclude && exclude.contains(el))) return NodeFilter.FILTER_REJECT;
      if (el.closest('script, style, noscript, [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.toLowerCase().includes(q)) return NodeFilter.FILTER_SKIP;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode()) && ranges.length < MAX_MATCHES) {
    const text = node.nodeValue!.toLowerCase();
    let i = text.indexOf(q);
    while (i !== -1 && ranges.length < MAX_MATCHES) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + q.length);
      if (r.getClientRects().length) ranges.push(r); // skip invisible text
      i = text.indexOf(q, i + q.length);
    }
  }
  return ranges;
}

export function FindBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [ranges, setRanges] = useState<Range[]>([]);
  const [index, setIndex] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    highlights()?.delete(ALL);
    highlights()?.delete(CURRENT);
  };

  const search = useCallback(
    (q: string, keepIndex = false) => {
      const found = findRanges(q, document.body, barRef.current);
      setRanges(found);
      setIndex((i) => (keepIndex && i < found.length ? i : 0));
    },
    [],
  );

  // Ctrl/⌘ + F opens (or refocuses); Esc closes.
  useEffect(() => {
    if (!isDesktopApp()) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const selected = window.getSelection()?.toString().trim();
        if (selected && selected.length < 100 && !selected.includes('\n')) setQuery(selected);
        setOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Search as you type, and again when the page changes (typing, switching notes).
  useEffect(() => {
    if (!open) return;
    search(query);
    let t: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver((records) => {
      if (records.every((r) => barRef.current?.contains(r.target))) return;
      clearTimeout(t);
      t = setTimeout(() => search(query, true), 250);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      clearTimeout(t);
    };
  }, [open, query, search]);

  // Paint matches and bring the current one into view.
  useEffect(() => {
    clear();
    if (!open || !ranges.length) return;
    const reg = highlights();
    if (reg && HighlightCtor) {
      reg.set(ALL, new HighlightCtor(...ranges));
      reg.set(CURRENT, new HighlightCtor(ranges[index]));
    }
    const el = ranges[index]?.startContainer.parentElement;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [open, ranges, index]);

  useEffect(() => clear, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    clear();
  };
  const step = (d: number) => ranges.length && setIndex((i) => (i + d + ranges.length) % ranges.length);

  return (
    <div
      ref={barRef}
      data-floating-panel
      className="fixed top-3 right-4 z-[10002] flex items-center gap-1.5 rounded-xl pl-3 pr-1.5 py-1.5 shadow-2xl"
      style={{ backgroundColor: 'var(--bg-panel, #161616)', border: '1px solid var(--divider, #2a2a2a)', color: 'var(--text, #e5e5e5)' }}
    >
      <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        placeholder="Find in Flow"
        className="w-48 bg-transparent text-sm focus:outline-none"
        spellCheck={false}
      />
      <span className="text-xs tabular-nums min-w-[52px] text-right" style={{ color: 'var(--muted)' }}>
        {query ? (ranges.length ? `${index + 1}/${ranges.length}` : 'No results') : ''}
      </span>
      <button type="button" onClick={() => step(-1)} className="p-1 rounded hover:bg-white/10" title="Previous (Shift + Enter)">
        <ChevronUp className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => step(1)} className="p-1 rounded hover:bg-white/10" title="Next (Enter)">
        <ChevronDown className="w-4 h-4" />
      </button>
      <button type="button" onClick={close} className="p-1 rounded hover:bg-white/10" title="Close (Esc)">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
