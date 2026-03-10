import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Note, Folder, Dashboard } from '../types';
import { 
  createNote, 
  updateNote, 
  deleteNote, 
  getNotesByDashboard,
  getNote,
  createFolder,
  updateFolder,
  deleteFolder,
  getFoldersByDashboard,
  initialSync
} from '../lib/dataAccess';

export const useDashboardData = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    searchParams.get('note')
  );
  const [loading, setLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [openNotes, setOpenNotes] = useState<Note[]>(() => {
    // Restore open notes from localStorage with user-specific key
    if (!user?.id) return [];
    try {
      const saved = localStorage.getItem(`openNotes_${user.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const hasLoadedDashboards = useRef(false);
  const tabsEnabled = (() => {
    const saved = localStorage.getItem('tabsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();

  // Persist open notes to localStorage with user-specific key whenever they change
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`openNotes_${user.id}`, JSON.stringify(openNotes));
    }
  }, [openNotes, user?.id]);

  // Clear open notes when user changes
  useEffect(() => {
    if (user?.id) {
      try {
        const saved = localStorage.getItem(`openNotes_${user.id}`);
        setOpenNotes(saved ? JSON.parse(saved) : []);
      } catch {
        setOpenNotes([]);
      }
    } else {
      setOpenNotes([]);
    }
  }, [user?.id]);

  useEffect(() => {
    // Only fetch dashboards once when user is available
    if (user && !hasLoadedDashboards.current) {
      hasLoadedDashboards.current = true;
      fetchDashboards();
    }
  }, [user]);

  useEffect(() => {
    if (activeDashboard) {
      fetchData();
    } else if (hasLoadedDashboards.current) {
      // If we've loaded dashboards but there's no active one, set loading to false
      setLoading(false);
      setNotes([]);
      setFolders([]);
    }
  }, [activeDashboard?.id]); // Only refetch when dashboard ID changes

  const fetchDashboards = async () => {
    // Try to load from cache first
    const cached = localStorage.getItem('cachedDashboards');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setDashboards(data || []);
        const active = data?.find((d: Dashboard) => d.is_active) || data?.[0] || null;
        setActiveDashboard(active);
        console.log('📦 Loaded', data?.length || 0, 'dashboards from cache');
      } catch (e) {
        console.error('Failed to parse cached dashboards:', e);
      }
    }
    
    // Skip network request if offline
    if (!navigator.onLine) {
      console.log('📴 Offline mode - using cached data only');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDashboards(data || []);
      
      // Cache for offline use
      localStorage.setItem('cachedDashboards', JSON.stringify(data || []));
      
      // Set active dashboard (first one or the one marked as active)
      const active = data?.find(d => d.is_active) || data?.[0] || null;
      setActiveDashboard(active);
      
      console.log('🌐 Fetched', data?.length || 0, 'dashboards from server');
    } catch (error: any) {
      console.log('⚠️ Failed to fetch dashboards, using cache');
    }
  };

  const fetchData = async () => {
    if (!activeDashboard?.id || !user?.id) return;

    setLoading(true);
    
    try {
      // Load from IndexedDB
      const [notesData, foldersData] = await Promise.all([
        getNotesByDashboard(activeDashboard.id),
        getFoldersByDashboard(activeDashboard.id)
      ]);
      
      setNotes(notesData);
      setFolders(foldersData);
      
      console.log('📦 Loaded from IndexedDB:', notesData.length, 'notes,', foldersData.length, 'folders');
      
      // If IndexedDB is empty and we're online, do initial sync
      if (notesData.length === 0 && foldersData.length === 0 && navigator.onLine) {
        console.log('🔄 IndexedDB empty, performing initial sync...');
        await initialSync(user.id);
        
        // Reload from IndexedDB after sync
        const [syncedNotes, syncedFolders] = await Promise.all([
          getNotesByDashboard(activeDashboard.id),
          getFoldersByDashboard(activeDashboard.id)
        ]);
        
        setNotes(syncedNotes);
        setFolders(syncedFolders);
      } else if (navigator.onLine) {
        // Background refresh: pull latest from Supabase to catch stale cached data
        // This runs after we've already shown IndexedDB data, so the UI is fast
        (async () => {
          try {
            const { data: remoteFolders } = await supabase
              .from('folders')
              .select('*')
              .eq('dashboard_id', activeDashboard.id);
            
            if (remoteFolders) {
              // Check for new folders OR updated folders
              const localMap = new Map(foldersData.map(f => [f.id, f]));
              let hasChanges = false;
              
              for (const remote of remoteFolders) {
                const local = localMap.get(remote.id);
                // NEW: Detect new folders (!local) OR updated folders
                if (!local || local.name !== remote.name || local.emoji !== remote.emoji || local.parent_id !== remote.parent_id) {
                  hasChanges = true;
                  // Update IndexedDB with server data (only if no pending outbox change)
                  const { db } = await import('../lib/db');
                  const pending = await db.outbox
                    .where('entityId')
                    .equals(remote.id)
                    .filter(item => item.entityType === 'folder' && item.operation === 'upsert')
                    .first();
                  
                  if (!pending) {
                    await db.folders.put({ ...remote, synced: true });
                    if (!local) {
                      console.log('📥 New folder synced from server:', remote.name);
                    }
                  }
                }
              }
              
              if (hasChanges) {
                const refreshedFolders = await getFoldersByDashboard(activeDashboard.id);
                setFolders(refreshedFolders);
                console.log('🔄 Background refresh: updated folder data from server');
              }
            }
          } catch (e) {
            console.log('⚠️ Background folder refresh failed:', e);
          }
        })();
      }
    } catch (error) {
      console.error('Failed to load data from IndexedDB:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNoteSelect = async (noteId: string, searchQuery?: string) => {
    setSelectedNoteId(noteId);
    const params: Record<string, string> = { note: noteId };
    if (searchQuery) {
      params.search = searchQuery;
    }
    setSearchParams(params);
    
    // Check if note is in current dashboard
    let note = notes?.find(n => n.id === noteId);
    
    // If note not in current dashboard, fetch it and switch dashboards
    if (!note) {
      const fetchedNote = await getNote(noteId);
      if (fetchedNote && fetchedNote.dashboard_id && fetchedNote.dashboard_id !== activeDashboard?.id) {
        // Find the dashboard this note belongs to
        const noteDashboard = dashboards.find(d => d.id === fetchedNote.dashboard_id);
        if (noteDashboard) {
          console.log('📍 Note belongs to different dashboard, switching...', noteDashboard.name);
          setActiveDashboard(noteDashboard);
          
          // Update active status in database
          try {
            await supabase
              .from('dashboards')
              .update({ is_active: false })
              .neq('id', noteDashboard.id);
            
            await supabase
              .from('dashboards')
              .update({ is_active: true })
              .eq('id', noteDashboard.id);
          } catch (error) {
            console.error('Error updating active dashboard:', error);
          }
        }
        note = fetchedNote;
      }
    }
    
    // Add to open tabs if tabs are enabled
    if (tabsEnabled && note && !openNotes.some(n => n.id === noteId)) {
      setOpenNotes(prev => [...prev, note]);
    }
  };
  
  const handleTabClose = (noteId: string) => {
    setOpenNotes(prev => prev.filter(n => n.id !== noteId));
    // If closing active tab, switch to another tab or clear selection
    if (selectedNoteId === noteId) {
      const remainingNotes = openNotes.filter(n => n.id !== noteId);
      if (remainingNotes.length > 0) {
        handleNoteSelect(remainingNotes[remainingNotes.length - 1].id);
      } else {
        setSelectedNoteId(null);
        setSearchParams({});
      }
    }
  };

  const handleTabReorder = (reorderedNotes: Note[]) => {
    setOpenNotes(reorderedNotes);
  };

  const handleNoteReorder = (reorderedNotes: Note[]) => {
    console.log('🔄 [handleNoteReorder] Starting reorder:', reorderedNotes.map(n => n.title));
    
    // Create completely new array with positions to ensure React detects the change
    const notesWithPositions = reorderedNotes.map((note, index) => ({
      ...note,
      position: index
    }));
    
    console.log('📝 [handleNoteReorder] Setting state with NEW array:', notesWithPositions.map(n => `${n.title}:${n.position}`));
    console.log('📝 [handleNoteReorder] Array reference changed:', notesWithPositions !== notes);
    
    // Force new reference by spreading into new array
    setNotes([...notesWithPositions]);
    
    // Update positions in database in background (directly, not through handleNoteUpdate)
    setTimeout(async () => {
      try {
        console.log('💾 [handleNoteReorder] Saving positions to database...');
        for (let i = 0; i < reorderedNotes.length; i++) {
          // Update directly in IndexedDB without triggering state updates
          await updateNote(reorderedNotes[i].id, { position: i });
        }
        console.log('✅ [handleNoteReorder] Note positions saved to database');
      } catch (error) {
        console.error('❌ [handleNoteReorder] Error updating note positions:', error);
      }
    }, 0);
  };

  const handleFolderReorder = (reorderedFolders: Folder[]) => {
    // Update state immediately with positions already set
    const foldersWithPositions = reorderedFolders.map((folder, index) => ({
      ...folder,
      position: index
    }));
    setFolders(foldersWithPositions);
    
    // Update positions in database in background (directly, not through handleFolderUpdate)
    setTimeout(async () => {
      try {
        for (let i = 0; i < reorderedFolders.length; i++) {
          // Update directly in IndexedDB without triggering state updates
          await updateFolder(reorderedFolders[i].id, { position: i });
        }
        console.log('✅ Folder positions saved to database');
      } catch (error) {
        console.error('Error updating folder positions:', error);
      }
    }, 0);
  };

  const handleNoteCreate = async (folderId?: string) => {
    if (!user?.id) {
      alert('You must be logged in to create notes');
      return;
    }

    try {
      // Create note in IndexedDB (works offline)
      const newNote = await createNote(user.id, activeDashboard?.id || null, folderId);
      
      // Add to UI state
      setNotes(prev => prev ? [newNote, ...prev] : [newNote]);
      
      // Select the new note
      handleNoteSelect(newNote.id);
      
      console.log('✅ Created note:', newNote.id, navigator.onLine ? '(will sync)' : '(offline)');
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Failed to create note');
    }
  };

  const handleNoteUpdate = async (noteId: string, updates: Partial<Note>) => {
    try {
      // Update in IndexedDB (works offline)
      await updateNote(noteId, updates);

      // Update local state
      setNotes(prev => 
        prev ? prev.map(note => 
          note.id === noteId ? { ...note, ...updates } : note
        ) : prev
      );
      
      // Update open notes if tabs are enabled
      setOpenNotes(prev => 
        prev.map(note => 
          note.id === noteId ? { ...note, ...updates } : note
        )
      );
      
      console.log('✅ Updated note:', noteId, navigator.onLine ? '(will sync)' : '(offline)');
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    try {
      // Delete from IndexedDB (works offline)
      await deleteNote(noteId);

      // Remove from local state
      setNotes(prev => prev ? prev.filter(n => n.id !== noteId) : prev);
      setOpenNotes(prev => prev.filter(n => n.id !== noteId));
      
      // Clear selection if deleted note was selected
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setSearchParams({});
      }
      
      console.log('✅ Deleted note:', noteId, navigator.onLine ? '(will sync)' : '(offline)');
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  const handleFolderCreate = async (parentId?: string) => {
    if (!user?.id) {
      alert('You must be logged in to create folders');
      return;
    }

    try {
      // Create folder in IndexedDB (works offline)
      const newFolder = await createFolder(user.id, activeDashboard?.id || null, 'New folder', parentId);
      
      // Update local state
      setFolders(prev => [...prev, newFolder]);
      
      // Notify UI to auto-enter rename mode for this folder
      window.dispatchEvent(new CustomEvent('folderCreated', { detail: { id: newFolder.id } }));
      
      console.log('✅ Created folder:', newFolder.id, navigator.onLine ? '(will sync)' : '(offline)');
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    }
  };

  const handleFolderUpdate = async (folderId: string, updates: Partial<Folder>) => {
    try {
      // Update in IndexedDB (works offline)
      await updateFolder(folderId, updates);

      // Update local state
      setFolders(prev => 
        prev.map(folder => 
          folder.id === folderId ? { ...folder, ...updates } : folder
        )
      );
      
      console.log('✅ Updated folder:', folderId, navigator.onLine ? '(will sync)' : '(offline)');
    } catch (error) {
      console.error('Error updating folder:', error);
    }
  };

  const handleFolderDelete = async (folderId: string) => {
    try {
      // Delete from IndexedDB (works offline)
      await deleteFolder(folderId);

      // Remove from local state
      setFolders(prev => prev.filter(f => f.id !== folderId));
      
      console.log('✅ Deleted folder:', folderId, navigator.onLine ? '(will sync)' : '(offline)');
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
  };

  const handleDashboardChange = async (dashboard: Dashboard) => {
    setActiveDashboard(dashboard);
    
    // Update active status in database
    try {
      await supabase
        .from('dashboards')
        .update({ is_active: false })
        .neq('id', dashboard.id);
      
      await supabase
        .from('dashboards')
        .update({ is_active: true })
        .eq('id', dashboard.id);
    } catch (error) {
      console.error('Error updating active dashboard:', error);
    }
  };

  const handleDashboardsUpdate = () => {
    fetchDashboards();
  };

  return {
    // State
    notes,
    folders,
    dashboards,
    activeDashboard,
    selectedNoteId,
    loading,
    sidebarWidth,
    setSidebarWidth,
    openNotes,
    tabsEnabled,
    
    // Handlers
    handleNoteSelect,
    handleTabClose,
    handleTabReorder,
    handleNoteReorder,
    handleFolderReorder,
    handleNoteCreate,
    handleNoteUpdate,
    handleNoteDelete,
    handleFolderCreate,
    handleFolderUpdate,
    handleFolderDelete,
    handleDashboardChange,
    handleDashboardsUpdate,
  };
};
