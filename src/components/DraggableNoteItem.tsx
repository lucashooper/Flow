import { useSortable } from '@dnd-kit/sortable';
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
    isDragging,
  } = useSortable({ 
    id: props.note.id, 
    data: { type: 'note', noteId: props.note.id, note: props.note } 
  });

  // When dragging: dim the original item (like Evernote) so you see both the dimmed note
  // and the drag overlay pill. This avoids the ugly black gap from visibility:hidden.
  const style: React.CSSProperties = isDragging
    ? {
        opacity: 0.4,
      }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <NoteItem {...props} />
    </div>
  );
};
