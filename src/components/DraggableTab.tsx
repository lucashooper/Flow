import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import type { Note } from '../types';

interface DraggableTabProps {
  note: Note;
  isActive: boolean;
  onTabClick: (noteId: string) => void;
  onTabClose: (noteId: string) => void;
}

export const DraggableTab = ({ note, isActive, onTabClick, onTabClose }: DraggableTabProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `tab-${note.id}`,
    data: { type: 'tab', note, noteId: note.id }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderBottom: isActive ? 'none' : '1px solid #1a1a1a',
    marginBottom: isActive ? '-1px' : '0',
    zIndex: isActive ? 10 : 1,
    borderRadius: isActive ? '8px 8px 0 0' : '6px 6px 0 0',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`force-visible group tab flex items-center gap-2 px-3 py-2 transition-all cursor-pointer min-w-[120px] max-w-[200px] ${
        isActive
          ? 'active text-[#e5e5e5]'
          : 'text-[#888888] hover:bg-[#151515] hover:text-[#e5e5e5] border-r border-[#1a1a1a]'
      } ${isDragging ? 'z-50 shadow-lg' : ''}`}
      onClick={(e) => {
        // A click that lands in the close area closes, even if it just misses the icon.
        if ((e.target as HTMLElement).closest('[data-tab-close]')) return;
        onTabClick(note.id);
      }}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onTabClose(note.id);
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault(); // no autoscroll on middle-click
      }}
    >
      <span className="text-sm truncate flex-1 select-none">{note.title || 'Untitled'}</span>
      <button
        type="button"
        data-tab-close
        aria-label="Close tab"
        title="Close tab"
        onPointerDown={(e) => {
          // Close on press: no drag starts and the tab is never selected first.
          e.stopPropagation();
          e.preventDefault();
          if (e.button === 0) onTabClose(note.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className={`-my-1 -mr-2 flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-md hover:bg-[#2a2a2a] transition-opacity ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
