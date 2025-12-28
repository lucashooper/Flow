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
  autoRenameId?: string;
  onRenameStarted?: (folderId: string) => void;
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

  const baseStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isOver ? '#A0522D22' : undefined,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={baseStyle} 
      className="force-visible"
      data-folder-id={props.folder.id}
      data-is-dragging={isDragging ? 'true' : 'false'}
      {...attributes} 
      {...listeners}
    >
      <FolderItem {...props} />
    </div>
  );
};
