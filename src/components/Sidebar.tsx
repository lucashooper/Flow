import { useState, useEffect } from 'react';
import { Plus, FolderPlus, Search } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Note, Folder, Dashboard } from '../types';
import { DraggableNoteItem } from './DraggableNoteItem';
import { DraggableFolderItem } from './DraggableFolderItem';
import { NoteItem } from './NoteItem';
import { FolderItem } from './FolderItem';
import { DashboardSwitcher } from './DashboardSwitcher';

interface SidebarProps {
  notes: Note[];
  folders: Folder[];
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  selectedNoteId: string | null;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  onNoteSelect: (noteId: string) => void;
  onNoteCreate: (folderId?: string) => void;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
  onNoteDelete: (noteId: string) => void;
  onFolderCreate: (parentId?: string) => void;
  onFolderUpdate: (folderId: string, updates: Partial<Folder>) => void;
  onFolderDelete: (folderId: string) => void;
  onDashboardChange: (dashboard: Dashboard) => void;
  onDashboardsUpdate: () => void;
  loading: boolean;
}

export const Sidebar = ({
  notes,
  folders,
  dashboards,
  activeDashboard,
  selectedNoteId,
  sidebarWidth,
  setSidebarWidth,
  onNoteSelect,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  onFolderCreate,
  onFolderUpdate,
  onFolderDelete,
  onDashboardChange,
  onDashboardsUpdate,
  loading,
}: SidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isResizing, setIsResizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Moving note into a folder
    if (activeData?.type === 'note' && overData?.type === 'folder') {
      const note = activeData.note as Note;
      const folderId = over.id as string;
      onNoteUpdate(note.id, { folder_id: folderId });
    }

    // Moving note to root (no folder)
    if (activeData?.type === 'note' && !overData) {
      const note = activeData.note as Note;
      onNoteUpdate(note.id, { folder_id: null });
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = Math.max(200, Math.min(500, e.clientX));
    setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add/remove event listeners for resizing - FIX: Use useEffect to prevent stuck resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Add a safety timeout to force release after 10 seconds
      const safetyTimeout = setTimeout(() => {
        setIsResizing(false);
      }, 10000);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        clearTimeout(safetyTimeout);
      };
    }
  }, [isResizing]);

  // Filter notes based on search
  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get root folders (no parent)
  const rootFolders = folders.filter(f => !f.parent_id);
  
  // Get notes without folder
  const rootNotes = filteredNotes.filter(n => !n.folder_id);

  // Get notes for a specific folder
  const getNotesInFolder = (folderId: string) => {
    return filteredNotes.filter(n => n.folder_id === folderId);
  };

  // Get subfolders
  const getSubfolders = (parentId: string) => {
    return folders.filter(f => f.parent_id === parentId);
  };

  // Render folder tree recursively
  const renderFolder = (folder: Folder, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const subfolders = getSubfolders(folder.id);
    const folderNotes = getNotesInFolder(folder.id);
    const isOver = overId === folder.id;

    return (
      <div key={folder.id}>
        <DraggableFolderItem
          folder={folder}
          depth={depth}
          isExpanded={isExpanded}
          isOver={isOver}
          onToggle={() => toggleFolder(folder.id)}
          onUpdate={onFolderUpdate}
          onDelete={onFolderDelete}
          onCreateNote={() => onNoteCreate(folder.id)}
          onCreateSubfolder={() => onFolderCreate(folder.id)}
        />

        {isExpanded && (
          <div>
            {/* Subfolders */}
            {subfolders.map(subfolder => renderFolder(subfolder, depth + 1))}
            
            {/* Notes in this folder */}
            {folderNotes.map(note => (
              <DraggableNoteItem
                key={note.id}
                note={note}
                depth={depth + 1}
                isSelected={note.id === selectedNoteId}
                onSelect={() => onNoteSelect(note.id)}
                onUpdate={onNoteUpdate}
                onDelete={onNoteDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const allItems = [...folders.map(f => f.id), ...notes.map(n => n.id)];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className="relative bg-[#111111] border-r border-[#2a2a2a] flex flex-col"
        style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '500px' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src="/Flow-icon.webp" alt="Flow" className="w-6 h-6" />
            <h1 className="text-xl font-bold text-[#e5e5e5]">Flow</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onNoteCreate()}
              className="p-1.5 hover:bg-[#252525] rounded transition-colors"
              title="New Note"
            >
              <Plus className="w-4 h-4 text-[#D97706]" />
            </button>
            <button
              onClick={() => onFolderCreate()}
              className="p-1.5 hover:bg-[#252525] rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4 text-[#D97706]" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888]" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-sm text-[#e5e5e5] placeholder-[#888888] focus:outline-none focus:border-[#A0522D]"
          />
        </div>
      </div>

      {/* Notes and Folders List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-4 text-center text-[#888888]">Loading...</div>
        ) : (
          <SortableContext items={allItems} strategy={verticalListSortingStrategy}>
            <div className="p-2">
              {/* Root folders */}
              {rootFolders.map(folder => renderFolder(folder, 0))}

              {/* Root notes (no folder) */}
              {rootNotes.map(note => (
                <DraggableNoteItem
                  key={note.id}
                  note={note}
                  depth={0}
                  isSelected={note.id === selectedNoteId}
                  onSelect={() => onNoteSelect(note.id)}
                  onUpdate={onNoteUpdate}
                  onDelete={onNoteDelete}
                />
              ))}

              {notes.length === 0 && folders.length === 0 && (
                <div className="p-4 text-center text-[#888888] text-sm">
                  No notes yet. Create your first note!
                </div>
              )}
            </div>
          </SortableContext>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#A0522D] transition-colors group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-[#A0522D] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Dashboard Switcher */}
      <div className="border-t border-[#2a2a2a] p-2">
        <DashboardSwitcher
          dashboards={dashboards}
          activeDashboard={activeDashboard}
          onDashboardChange={onDashboardChange}
          onDashboardsUpdate={onDashboardsUpdate}
        />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #111111;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2a2a;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3a3a3a;
        }
      `}</style>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId ? (
          <div className="opacity-50">
            {notes.find(n => n.id === activeId) ? (
              <div className="px-2 py-1.5 bg-[#1a1a1a] rounded">Dragging note...</div>
            ) : (
              <div className="px-2 py-1.5 bg-[#1a1a1a] rounded">Dragging folder...</div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
