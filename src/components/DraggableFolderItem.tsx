import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  isOver?: boolean;
}

export const DraggableFolderItem = ({ isOver, ...props }: DraggableFolderItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: props.folder.id, 
    data: { type: 'folder', folder: props.folder } 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isOver ? '#A0522D22' : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FolderItem {...props} />
    </div>
  );
};
