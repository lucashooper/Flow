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
    id: note.id,
    data: { type: 'tab', note }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    scale: isDragging ? 0.98 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group tab flex items-center gap-2 px-3 py-1.5 rounded-md transition-all cursor-pointer min-w-[120px] max-w-[200px] ${
        isActive
          ? 'active bg-[#1a1a1a] text-[#e5e5e5]'
          : 'bg-[#151515] text-[#888888] hover:bg-[#1a1a1a] hover:text-[#e5e5e5]'
      } ${isDragging ? 'z-50 shadow-lg' : ''}`}
      onClick={() => onTabClick(note.id)}
    >
      <span className="text-sm truncate flex-1">{note.title || 'Untitled'}</span>
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
