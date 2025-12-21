import { useState, useEffect } from 'react';
import { Plus, FolderPlus, Search, Star, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Note, Folder, Dashboard } from '../types';
import { DraggableNoteItem } from './DraggableNoteItem';
import { DraggableFolderItem } from './DraggableFolderItem';
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
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [blurredNotes, setBlurredNotes] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem('flow_blurred_notes');
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as string[];
      return new Set(parsed);
    } catch {
      return new Set();
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const [activeId] = useState<string | null>(null);
  const [overId] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [autoRenameFolderId, setAutoRenameFolderId] = useState<string | null>(null);

  // Listen for folderCreated event to enter rename mode automatically
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as { id?: string } | undefined;
      if (detail?.id) setAutoRenameFolderId(detail.id);
    };
    window.addEventListener('folderCreated', handler as EventListener);
    return () => window.removeEventListener('folderCreated', handler as EventListener);
  }, []);


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

  const toggleNoteBlur = (noteId: string) => {
    setBlurredNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flow_blurred_notes', JSON.stringify(Array.from(next)));
      }
      return next;
    });
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

  // Filter and sort notes based on search and starred-only toggle, with starred notes at the top
  const filteredNotes = notes
    .filter(note =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(note => !showStarredOnly || (note.is_starred ?? false))
    .sort((a, b) => {
      // Starred notes come first (handle undefined as false)
      const aStarred = a.is_starred ?? false;
      const bStarred = b.is_starred ?? false;
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      // Then sort by updated_at
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

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
          autoRenameId={autoRenameFolderId || undefined}
          onRenameStarted={(id: string) => {
            if (autoRenameFolderId === id) setAutoRenameFolderId(null);
          }}
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
                isBlurred={blurredNotes.has(note.id)}
                onSelect={() => onNoteSelect(note.id)}
                onUpdate={onNoteUpdate}
                onDelete={onNoteDelete}
                onToggleBlur={() => toggleNoteBlur(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const allItems = [...folders.map(f => f.id), ...notes.map(n => n.id)];

  return (
    <>
      <div
        className="sidebar relative border-r border-theme flex flex-col"
        style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '500px' }}
      >
        {/* Header */}
        <div className="p-3 border-b border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src="/Flow-icon.webp" alt="Flow" className="w-7 h-7 rounded-md" style={{ filter: 'brightness(1.1)' }} />
            <button
              onClick={() => navigate('/tasks')}
              className="p-1.5 hover:bg-[#252525] rounded transition-colors group"
              title="Tasks"
            >
              <CheckCircle className="w-4 h-4 text-[#888888] group-hover:text-[#ff7a18] transition-colors" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowStarredOnly(prev => !prev)}
              className={`p-1.5 rounded transition-colors ${
                showStarredOnly ? 'bg-[#1f1f1f] text-yellow-400' : 'hover:bg-[#252525] text-[#888888]'
              }`}
              title={showStarredOnly ? 'Show all notes' : 'Show starred only'}
            >
              <Star className={`w-4 h-4 ${showStarredOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </button>
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
                  isBlurred={blurredNotes.has(note.id)}
                  onSelect={() => onNoteSelect(note.id)}
                  onUpdate={onNoteUpdate}
                  onDelete={onNoteDelete}
                  onToggleBlur={() => toggleNoteBlur(note.id)}
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

      {/* Dashboard Switcher footer */}
      <div className="mt-1 px-3 py-2.5 border-t border-[#181818]">
        <DashboardSwitcher
          dashboards={dashboards}
          activeDashboard={activeDashboard}
          onDashboardChange={onDashboardChange}
          onDashboardsUpdate={onDashboardsUpdate}
        />
      </div>

      <style>{`
        /* Slim, quiet scrollbar like ChatGPT */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent; /* reduce visual weight */
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08); /* neutral grey at low opacity */
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.18);
        }

        /* Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.18) transparent;
        }

        /* Faded notes in sidebar */
        .sidebar .note-faded {
          opacity: 0.65;
          filter: blur(3px) brightness(0.85);
          transition: opacity 0.25s ease, filter 0.25s ease, background-color 0.25s ease, border-color 0.25s ease;
        }

        .sidebar .note-faded:hover {
          opacity: 0.75;
          filter: blur(2px) brightness(0.9);
        }
      `}</style>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId ? (
          <div className="opacity-70 shadow-2xl">
            {notes.find(n => n.id === activeId) ? (
              <div className="px-2 py-1.5 bg-[#1a1a1a] rounded border border-[#333333] text-[#e5e5e5]">
                {notes.find(n => n.id === activeId)?.title || 'Dragging note...'}
              </div>
            ) : (
              <div className="px-2 py-1.5 bg-[#1a1a1a] rounded border border-[#333333] text-[#e5e5e5]">
                Dragging folder...
              </div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </>
  );
};
