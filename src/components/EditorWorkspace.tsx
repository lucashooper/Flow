import React, { useMemo, useRef, useState } from 'react';
import { useDroppable, useDndMonitor } from '@dnd-kit/core';
import type { Note } from '../types';
import { EditorPanel } from './EditorPanel';
import {
  useWorkspace,
  type PaneNode,
  type PaneSplit,
  type PaneLeaf,
  type DropRegion,
} from '../contexts/WorkspaceContext';
import { X } from 'lucide-react';

interface EditorWorkspaceProps {
  notes: Note[];
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
}

function useNoteById(notes: Note[], id: string | null): Note | undefined {
  return useMemo(() => notes.find(n => n.id === id), [notes, id]);
}

function Resizer({ split, index }: { split: PaneSplit; index: number }) {
  const { resizeSplit } = useWorkspace();
  const isVertical = split.direction === 'vertical';
  const startRef = useRef<{ x: number; y: number; sizes: number[] } | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the split container (parent of resizer)
    containerRef.current = e.currentTarget.parentElement as HTMLElement;
    
    console.log('[Resizer] onPointerDown', { index, direction: split.direction });
    
    startRef.current = { x: e.clientX, y: e.clientY, sizes: split.sizes.slice() };
    
    const move = (ev: PointerEvent) => {
      if (!startRef.current || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const total = isVertical ? rect.width : rect.height;
      const delta = (isVertical ? ev.clientX - startRef.current.x : ev.clientY - startRef.current.y);
      const frac = delta / Math.max(1, total);
      const sizes = startRef.current.sizes.slice();
      const a = Math.max(0.1, Math.min(0.9, sizes[index] + frac));
      const b = Math.max(0.1, Math.min(0.9, sizes[index + 1] - frac));
      const rest = sizes.reduce((acc, s, i) => (i === index || i === index + 1 ? acc : acc + s), 0);
      const scale = (1 - rest) / (a + b);
      sizes[index] = a * scale;
      sizes[index + 1] = b * scale;
      
      console.log('[Resizer] move', { delta, frac, newSizes: sizes });
      resizeSplit(split.id, sizes);
    };
    
    const up = () => {
      console.log('[Resizer] pointerup');
      startRef.current = null;
      containerRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      className={
        split.direction === 'vertical'
          ? 'w-[8px] cursor-col-resize hover:bg-[rgba(255,255,255,0.03)] transition-colors relative flex items-center justify-center'
          : 'h-[8px] cursor-row-resize hover:bg-[rgba(255,255,255,0.03)] transition-colors relative flex items-center justify-center'
      }
      style={{ flexShrink: 0, zIndex: 100, pointerEvents: 'auto', backgroundColor: 'transparent' }}
    >
      <div className={split.direction === 'vertical' ? 'w-[1px] h-full bg-[var(--divider)]' : 'h-[1px] w-full bg-[var(--divider)]'} />
    </div>
  );
}

function regionFromXY(xy: {x:number;y:number}, el: HTMLElement): DropRegion {
  const r = el.getBoundingClientRect();
  const x = (xy.x - r.left) / Math.max(1, r.width);
  const y = (xy.y - r.top) / Math.max(1, r.height);
  const th = 0.25;
  if (x < th) return 'left';
  if (x > 1 - th) return 'right';
  if (y < th) return 'top';
  if (y > 1 - th) return 'bottom';
  return 'center';
}

function PaneView({ node, notes, onNoteUpdate }: { node: PaneNode; notes: Note[]; onNoteUpdate: EditorWorkspaceProps['onNoteUpdate'] }) {
  const { splitInto, replaceIn, closePane, setActiveLeafId } = useWorkspace();

  if (node.type === 'split') {
    return (
      <div
        className={`flex ${node.direction === 'vertical' ? 'flex-row' : 'flex-col'} h-full w-full min-h-0`}
        style={{ gap: '0px' }}
      >
        {node.children.map((child, i) => (
          <React.Fragment key={child.id}>
            <div
              style={{ flex: `0 0 ${node.sizes[i] * 100}%` }}
              className="relative min-w-[120px] min-h-0 flex flex-col"
            >
              <PaneView node={child} notes={notes} onNoteUpdate={onNoteUpdate} />
            </div>
            {i < node.children.length - 1 && <Resizer split={node} index={i} />}
          </React.Fragment>
        ))}
      </div>
    );
  }

  const leaf = node as PaneLeaf;
  const note = useNoteById(notes, leaf.noteId);
  const ref = useRef<HTMLDivElement | null>(null);
  const [over, setOver] = useState<DropRegion | null>(null);
  const [isOver, setIsOver] = useState(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const { setNodeRef } = useDroppable({ id: leaf.id, data: { type: 'pane', leafId: leaf.id } });

  // Track drag over/move to compute region and show indicator
  useDndMonitor({
    onDragMove(event) {
      const { active } = event;
      const isNote = active?.data?.current?.type === 'note' || active?.data?.current?.type === 'tab';
      if (!isNote) return;
      if (!ref.current || !active?.rect?.current) return;
      const initial = (active as any).rect.current.initial;
      const translated = (active as any).rect.current.translated;
      const width = ((translated?.width ?? initial?.width) || 0);
      const height = ((translated?.height ?? initial?.height) || 0);
      const leftBase = translated?.left ?? (initial?.left ?? 0) + ((event as any).delta?.x ?? 0);
      const topBase = translated?.top ?? (initial?.top ?? 0) + ((event as any).delta?.y ?? 0);
      const clientX = leftBase + width / 2;
      const clientY = topBase + height / 2;
      lastPointer.current = { x: clientX, y: clientY };
      const rect = ref.current.getBoundingClientRect();
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (inside) {
        const region = regionFromXY({ x: clientX, y: clientY }, ref.current);
        if (import.meta.env.DEV) console.debug('[Workspace] dragMove over leaf', leaf.id, 'region', region);
        setIsOver(true);
        setOver(region);
      } else {
        if (isOver) { setIsOver(false); setOver(null); }
      }
    },
    onDragOver(event) {
      // Fallback for some sensors not calling onDragMove frequently
      const { active } = event;
      const isNote = active?.data?.current?.type === 'note' || active?.data?.current?.type === 'tab';
      if (!isNote) return;
      if (!ref.current || !active?.rect?.current) return;
      const initial = (active as any).rect.current.initial;
      const translated = (active as any).rect.current.translated;
      const width = ((translated?.width ?? initial?.width) || 0);
      const height = ((translated?.height ?? initial?.height) || 0);
      const leftBase = translated?.left ?? (initial?.left ?? 0) + ((event as any).delta?.x ?? 0);
      const topBase = translated?.top ?? (initial?.top ?? 0) + ((event as any).delta?.y ?? 0);
      const clientX = leftBase + width / 2;
      const clientY = topBase + height / 2;
      lastPointer.current = { x: clientX, y: clientY };
      const rect = ref.current.getBoundingClientRect();
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (inside) {
        const region = regionFromXY({ x: clientX, y: clientY }, ref.current);
        if (import.meta.env.DEV) console.debug('[Workspace] dragOver over leaf', leaf.id, 'region', region);
        setIsOver(true);
        setOver(region);
      } else {
        if (isOver) { setIsOver(false); setOver(null); }
      }
    },
    onDragEnd(event) {
      const { active } = event;
      const isNote = active?.data?.current?.type === 'note' || active?.data?.current?.type === 'tab';
      if (!isNote) return;
      const noteId: string | undefined = active?.data?.current?.note?.id || active?.data?.current?.noteId || active?.id as string;
      if (!noteId) { setIsOver(false); setOver(null); return; }
      const pointer = lastPointer.current;
      if (!pointer || !ref.current) { setIsOver(false); setOver(null); return; }
      const rect = ref.current.getBoundingClientRect();
      const inside = pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
      if (!inside) { setIsOver(false); setOver(null); return; }
      const region = over || regionFromXY(pointer, ref.current) || 'center';
      if (import.meta.env.DEV) console.debug('[Workspace] drop on leaf', leaf.id, 'region', region, 'noteId', noteId);
      if (region === 'center') replaceIn(leaf.id, noteId);
      else splitInto(leaf.id, region, noteId);
      setIsOver(false);
      setOver(null);
    },
    onDragCancel() {
      setIsOver(false);
      setOver(null);
    }
  });

  const onFocusPane = () => setActiveLeafId(leaf.id);

  return (
    <div
      ref={(el) => { ref.current = el; setNodeRef(el as HTMLElement | null); }}
      onClick={onFocusPane}
      onFocusCapture={onFocusPane}
      className={`h-full w-full min-h-0 editor-root relative flex flex-col overflow-hidden ring-1 ring-[var(--divider)]`}
    >
      {/* Close button */}
      <button
        onClick={() => closePane(leaf.id)}
        className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity text-xs p-1.5 rounded hover:bg-[color:var(--bg-panel)]/40"
        title="Close pane"
      >
        <X className="w-3.5 h-3.5 text-[#666666] hover:text-[#e5e5e5]" />
      </button>

      {/* Drop indicators */}
      {isOver && over && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {over === 'left' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[color:var(--divider)]" />}
          {over === 'right' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-[color:var(--divider)]" />}
          {over === 'top' && <div className="absolute left-0 right-0 top-0 h-1 bg-[color:var(--divider)]" />}
          {over === 'bottom' && <div className="absolute left-0 right-0 bottom-0 h-1 bg-[color:var(--divider)]" />}
          {over === 'center' && <div className="absolute inset-2 rounded border border-[color:var(--divider)]" />}
        </div>
      )}

      {/* Editor */}
      {note ? (
        <EditorPanel note={note} onNoteUpdate={onNoteUpdate} />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-[color:var(--muted)]">Drop a note here</div>
      )}
    </div>
  );
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ notes, onNoteUpdate }) => {
  const { root } = useWorkspace();
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <PaneView node={root} notes={notes} onNoteUpdate={onNoteUpdate} />
    </div>
  );
};
