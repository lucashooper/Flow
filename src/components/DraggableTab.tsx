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
      onClick={() => onTabClick(note.id)}
    >
      <span className="text-sm truncate flex-1 select-none">{note.title || 'Untitled'}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTabClose(note.id);
        }}
        onPointerDown={(e) => {
          // Prevent drag from starting when clicking close button
          e.stopPropagation();
        }}
        className="opacity-0 group-hover:opacity-100 hover:bg-[#2a2a2a] rounded p-0.5 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
