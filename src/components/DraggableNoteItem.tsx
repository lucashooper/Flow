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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.note.id, data: { type: 'note', note: props.note } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <NoteItem {...props} />
    </div>
  );
};
