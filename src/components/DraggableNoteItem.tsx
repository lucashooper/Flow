import { useRef, useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NoteItem } from './NoteItem';
import type { Note } from '../types';

interface DraggableNoteItemProps {
  note: Note;
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (noteId: string, updates: Partial<Note>) => void;
  onDelete: (noteId: string) => void;
  isBlurred?: boolean;
  onToggleBlur?: () => void;
}

export const DraggableNoteItem = (props: DraggableNoteItemProps) => {
  const sortable = useSortable({ 
    id: props.note.id, 
    data: { type: 'note', noteId: props.note.id, note: props.note } 
  });
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  // Detailed debug logging - only log once per drag
  const dragRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  useEffect(() => {
    if (isDragging && !dragRef.current) {
      dragRef.current = true;
      setActiveId(props.note.id);
      console.log('[DraggableNoteItem] DRAG START, noteId:', props.note.id, 'isDragging:', isDragging);
    } else if (!isDragging && dragRef.current) {
      dragRef.current = false;
      console.log('[DraggableNoteItem] DRAG END, noteId:', props.note.id, 'isDragging:', isDragging);
      // Clear activeId after a brief delay to ensure render completes
      setTimeout(() => setActiveId(null), 100);
    }
  }, [isDragging, props.note.id]);

  const baseStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={baseStyle}
      className="force-visible"
      data-noteid={props.note.id}
      data-is-dragging={isDragging ? 'true' : 'false'}
      data-active-id={activeId || 'none'}
      {...attributes}
      {...listeners}
    >
      <NoteItem {...props} />
      {/* Debug marker to confirm content is rendered */}
      <span className="opacity-0 pointer-events-none absolute" data-debug-marker="rendered">
        {props.note.title}
      </span>
    </div>
  );
};
