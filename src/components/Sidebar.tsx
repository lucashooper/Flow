import { useState, useEffect } from 'react';
import { Plus, FolderPlus, Search, Star, CheckCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {} from '@dnd-kit/core';
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
  onNoteSelect: (noteId: string, searchQuery?: string) => void;
  onNoteCreate: (folderId?: string) => void;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
  onNoteDelete: (noteId: string) => void;
  onFolderCreate: (parentId?: string) => void;
  onFolderUpdate: (folderId: string, updates: Partial<Folder>) => void;
  onFolderDelete: (folderId: string) => void;
  onDashboardChange: (dashboard: Dashboard) => void;
  onDashboardsUpdate: () => void;
  loading: boolean;
  isMobile?: boolean;
  onCloseMobile?: () => void;
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
  onCloseMobile,
  isMobile = false,
}: SidebarProps) => {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (!user?.id) return new Set();
    try {
      const saved = localStorage.getItem(`expandedFolders_${user.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
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


  // Persist expanded folders to localStorage
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`expandedFolders_${user.id}`, JSON.stringify(Array.from(expandedFolders)));
    }
  }, [expandedFolders, user?.id]);

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
    if (isMobile) return; // Disable resize on mobile
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

  // Check if a note matches the search query
  const noteMatchesSearch = (note: Note) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return note.title.toLowerCase().includes(query) || 
           note.content.toLowerCase().includes(query);
  };

  // Filter and sort notes based on search and starred-only toggle, with starred notes at the top
  const filteredNotes = notes
    .filter(noteMatchesSearch)
    .filter(note => !showStarredOnly || (note.is_starred ?? false))
    .sort((a, b) => {
      // Starred notes come first (handle undefined as false)
      const aStarred = a.is_starred ?? false;
      const bStarred = b.is_starred ?? false;
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      // Then sort by position (for drag-and-drop reordering)
      // If both have positions, use those; otherwise fall back to updated_at
      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  
  if (import.meta.env.DEV) {
    console.log('🔍 [Sidebar] filteredNotes order:', filteredNotes.map(n => `${n.title}:${n.position}`));
  }

  // Check if a folder or its descendants contain matching notes
  const folderHasMatches = (folderId: string): boolean => {
    // Check direct notes in this folder
    const directNotes = notes.filter(n => n.folder_id === folderId);
    if (directNotes.some(noteMatchesSearch)) return true;
    
    // Check subfolders recursively
    const subfolders = folders.filter(f => f.parent_id === folderId);
    return subfolders.some(sf => folderHasMatches(sf.id));
  };

  // Auto-expand folders containing search matches
  useEffect(() => {
    if (!searchQuery) return;
    
    const foldersToExpand = new Set<string>();
    
    // Find all folders that contain matching notes (directly or in descendants)
    folders.forEach(folder => {
      if (folderHasMatches(folder.id)) {
        foldersToExpand.add(folder.id);
        
        // Also expand all parent folders
        let currentFolder = folder;
        while (currentFolder.parent_id) {
          foldersToExpand.add(currentFolder.parent_id);
          currentFolder = folders.find(f => f.id === currentFolder.parent_id)!;
        }
      }
    });
    
    setExpandedFolders(foldersToExpand);
  }, [searchQuery, notes, folders]);

  // Get root folders (no parent)
  const rootFolders = folders
    .filter(f => !f.parent_id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  
  // Get notes without folder
  const rootNotes = filteredNotes.filter(n => !n.folder_id);
  
  if (import.meta.env.DEV) {
    console.log('📋 [Sidebar] SIDEBAR ORDER (rootNotes):', rootNotes.map(n => n.id));
  }

  // Get notes for a specific folder
  const getNotesInFolder = (folderId: string) => {
    return filteredNotes.filter(n => n.folder_id === folderId);
  };

  // Get subfolders
  const getSubfolders = (parentId: string) => {
    return folders
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  };

  // Render folder tree recursively
  const renderFolder = (folder: Folder, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const subfolders = getSubfolders(folder.id);
    const folderNotes = getNotesInFolder(folder.id);
    const isOver = false;

    const siblingFolders = (folder.parent_id
      ? getSubfolders(folder.parent_id)
      : rootFolders);
    const siblingIndex = siblingFolders.findIndex(f => f.id === folder.id);
    const canMoveUp = siblingIndex > 0;
    const canMoveDown = siblingIndex !== -1 && siblingIndex < siblingFolders.length - 1;

    const persistSiblingOrder = (ordered: Folder[]) => {
      for (let i = 0; i < ordered.length; i++) {
        const f = ordered[i];
        if ((f.position ?? 0) !== i) {
          onFolderUpdate(f.id, { position: i });
        }
      }
    };

    return (
      <div key={folder.id}>
        <DraggableFolderItem
          folder={folder}
          depth={depth}
          isExpanded={isExpanded}
          onToggle={() => toggleFolder(folder.id)}
          onUpdate={onFolderUpdate}
          onDelete={onFolderDelete}
          onCreateNote={() => onNoteCreate(folder.id)}
          onCreateSubfolder={() => onFolderCreate(folder.id)}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => {
            if (!canMoveUp) return;
            const next = siblingFolders.slice();
            const tmp = next[siblingIndex - 1];
            next[siblingIndex - 1] = next[siblingIndex];
            next[siblingIndex] = tmp;
            persistSiblingOrder(next);
          }}
          onMoveDown={() => {
            if (!canMoveDown) return;
            const next = siblingFolders.slice();
            const tmp = next[siblingIndex + 1];
            next[siblingIndex + 1] = next[siblingIndex];
            next[siblingIndex] = tmp;
            persistSiblingOrder(next);
          }}
          isOver={isOver}
          autoRenameId={autoRenameFolderId ?? undefined}
          onRenameStarted={(id: string) => {
            if (autoRenameFolderId === id) setAutoRenameFolderId(null);
          }}
          notes={notes ?? []}
        />

        {isExpanded && (
          <div>
            {/* Subfolders */}
            {subfolders.map(subfolder => renderFolder(subfolder, depth + 1))}
            
            {/* Notes in this folder */}
            {folderNotes.map(note => {
              const isMatch = searchQuery && noteMatchesSearch(note);
              return (
                <div 
                  key={note.id}
                  className={`${searchQuery && !isMatch ? 'opacity-40' : ''}`}
                  style={isMatch ? { backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderLeft: '2px solid var(--accent)' } : {}}
                >
                  <DraggableNoteItem
                    note={note}
                    depth={depth + 1}
                    isSelected={note.id === selectedNoteId}
                    isBlurred={blurredNotes.has(note.id)}
                    onSelect={() => onNoteSelect(note.id, searchQuery)}
                    onUpdate={onNoteUpdate}
                    onDelete={onNoteDelete}
                    onToggleBlur={() => toggleNoteBlur(note.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const allItems = [...folders.map(f => f.id), ...notes.map(n => n.id)];

  return (
    <>
      <div
        className="sidebar relative border-r border-theme flex flex-col h-full"
        style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '500px' }}
      >
        {/* Header */}
        <div className="p-3 border-b border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {userProfile?.profile_picture_url ? (
              <img 
                src={userProfile.profile_picture_url} 
                alt="Profile" 
                className="w-6 h-6 rounded-full object-cover" 
                style={{ 
                  border: '1.5px solid rgba(248, 250, 252, 0.15)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
                }}
              />
            ) : (
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ 
                  backgroundColor: 'var(--accent)', 
                  color: '#fff',
                  border: '1.5px solid rgba(248, 250, 252, 0.15)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
                }}
              >
                {userProfile?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <button
              onClick={() => navigate('/tasks')}
              className="p-1.5 hover:bg-[#252525] rounded transition-colors group"
              title="Tasks"
            >
              <CheckCircle className="w-4 h-4 text-[#888888] transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'} onMouseLeave={(e) => e.currentTarget.style.color = '#888888'} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {isMobile && onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 hover:bg-[#252525] rounded transition-colors"
                title="Close sidebar"
              >
                <X className="w-4 h-4 text-[#888888]" />
              </button>
            )}
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
              <Plus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </button>
            <button
              onClick={() => onFolderCreate()}
              className="p-1.5 hover:bg-[#252525] rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
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
              {rootNotes.map(note => {
                const isMatch = searchQuery && noteMatchesSearch(note);
                return (
                  <div 
                    key={note.id}
                    className={`${isMatch ? 'bg-[#ff7a18]/10 border-l-2 border-[#ff7a18]' : ''} ${searchQuery && !isMatch ? 'opacity-40' : ''}`}
                  >
                    <DraggableNoteItem
                      note={note}
                      depth={0}
                      isSelected={note.id === selectedNoteId}
                      isBlurred={blurredNotes.has(note.id)}
                      onSelect={() => onNoteSelect(note.id, searchQuery)}
                      onUpdate={onNoteUpdate}
                      onDelete={onNoteDelete}
                      onToggleBlur={() => toggleNoteBlur(note.id)}
                    />
                  </div>
                );
              })}

              {notes.length === 0 && folders.length === 0 && (
                <div className="p-4 text-center text-[#888888] text-sm">
                  No notes yet. Create your first note!
                </div>
              )}
            </div>
          </SortableContext>
        )}
      </div>

      {/* Resize Handle - Desktop Only */}
      {!isMobile && (
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#A0522D] transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-[#A0522D] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

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

    </>
  );
};
