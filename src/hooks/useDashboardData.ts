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
      }
    } catch (error) {
      console.error('Failed to load data from IndexedDB:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNoteSelect = (noteId: string, searchQuery?: string) => {
    setSelectedNoteId(noteId);
    const params: Record<string, string> = { note: noteId };
    if (searchQuery) {
      params.search = searchQuery;
    }
    setSearchParams(params);
    
    // Add to open tabs if tabs are enabled
    if (tabsEnabled && notes) {
      const note = notes.find(n => n.id === noteId);
      if (note && !openNotes.some(n => n.id === noteId)) {
        setOpenNotes(prev => [...prev, note]);
      }
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
