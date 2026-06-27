import { useSortable } from '@dnd-kit/sortable';
import { FolderItem } from './FolderItem';
import type { Folder } from '../types';

interface DraggableFolderItemProps {
  folder: Folder;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (folderId: string, updates: Partial<Folder>) => void;
  onDelete: (folderId: string) => void;
  onCreateNote: () => void;
  onCreateSubfolder: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveToTop?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToTop?: () => void;
  isOver?: boolean;
  autoRenameId?: string;
  onRenameStarted?: (folderId: string) => void;
  notes?: any[];
}

export const DraggableFolderItem = ({ isOver, ...props }: DraggableFolderItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
    isOver: isSortableOver,
  } = useSortable({ 
    id: props.folder.id, 
    data: { type: 'folder', folder: props.folder } 
  });

  // When dragging: dim the original item (like Evernote) so you see both the dimmed folder
  // and the drag overlay pill. This avoids the ugly black gap from visibility:hidden.
  const style: React.CSSProperties = isDragging
    ? {
        opacity: 0.4,
      }
    : {
        // Highlight when a note is being dragged over this folder
        backgroundColor: (isOver || isSortableOver) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : undefined,
        borderRadius: (isOver || isSortableOver) ? '6px' : undefined,
      };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
    >
      <FolderItem {...props} />
    </div>
  );
};
