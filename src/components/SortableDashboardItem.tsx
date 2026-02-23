import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { Dashboard } from '../types';

export type DropPosition = 'top' | 'bottom' | 'center' | null;

interface DashboardItemProps {
  dashboard: Dashboard;
  isActive: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  depth: number;
  draggedId: string | null;
  dropTarget: { id: string; position: DropPosition } | null;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onEmojiClick: (e: React.MouseEvent, dashboard: Dashboard) => void;
}

export const DashboardItem = ({
  dashboard,
  isActive,
  isExpanded,
  hasChildren,
  depth,
  draggedId,
  dropTarget,
  onSelect,
  onToggle,
  onDelete,
  onContextMenu,
  onEmojiClick,
}: DashboardItemProps) => {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: dashboard.id,
    data: { type: 'dashboard', dashboard },
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop-${dashboard.id}`,
    data: { type: 'dashboard', dashboard },
  });

  // Combine drag + drop refs
  const setRefs = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const isDropTarget = dropTarget?.id === dashboard.id;
  const dropPos = isDropTarget ? dropTarget.position : null;
  const isBeingDragged = draggedId === dashboard.id;

  return (
    <div
      ref={setRefs}
      {...attributes}
      {...listeners}
      className="relative"
      style={{ opacity: isBeingDragged ? 0.4 : 1 }}
      onContextMenu={onContextMenu}
    >
      {/* Drop indicator - Top line */}
      {isDropTarget && dropPos === 'top' && (
        <div className="absolute top-0 left-2 right-2 h-0.5 bg-[#A0522D] z-10 rounded-full" />
      )}
      
      {/* Drop indicator - Bottom line */}
      {isDropTarget && dropPos === 'bottom' && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#A0522D] z-10 rounded-full" />
      )}
      
      <div
        onClick={onSelect}
        className={`group w-full flex items-center justify-between py-2.5 pr-3 hover:bg-[#252525] transition-colors cursor-pointer rounded-sm ${
          isDropTarget && dropPos === 'center' 
            ? 'bg-[#A0522D]/15 outline outline-1 outline-[#A0522D]/60' 
            : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-0.5 hover:bg-[#3a3a3a] rounded transition-colors flex-shrink-0"
            >
              <ChevronRight
                className={`w-3 h-3 text-[#888888] transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            </button>
          ) : (
            <div className="w-4 flex-shrink-0" />
          )}
          
          {dashboard.cover_image ? (
            <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0">
              <img
                src={dashboard.cover_image}
                alt={dashboard.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <span 
              className="text-lg flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#A0522D]/50 rounded px-0.5 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onEmojiClick(e, dashboard);
              }}
              title="Click to change emoji"
            >
              {dashboard.emoji}
            </span>
          )}
          <span className="text-sm text-[#e5e5e5] truncate">
            {dashboard.name}
          </span>
          {isActive && (
            <div className="w-2 h-2 bg-[#A0522D] rounded-full flex-shrink-0" />
          )}
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#3a3a3a] rounded transition-all cursor-pointer flex-shrink-0"
        >
          <Trash2 className="w-4 h-4 text-[#ef4444]" />
        </div>
      </div>
    </div>
  );
};
