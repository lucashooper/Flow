import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Note, Folder, Dashboard } from '../types';

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
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Dashboard fetch error:', error);
        return;
      }

      setDashboards(data || []);
      
      // Set active dashboard (first one or the one marked as active)
      const active = data?.find(d => d.is_active) || data?.[0] || null;
      setActiveDashboard(active);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
    }
  };

  const fetchData = async () => {
    if (!activeDashboard) return;

    setLoading(true);
    try {
      const [notesResponse, foldersResponse] = await Promise.all([
        supabase
          .from('notes')
          .select('*')
          .eq('dashboard_id', activeDashboard.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('folders')
          .select('*')
          .eq('dashboard_id', activeDashboard.id)
          .order('name', { ascending: true })
      ]);

      if (notesResponse.error) throw notesResponse.error;
      if (foldersResponse.error) throw foldersResponse.error;

      setNotes(notesResponse.data || []);
      setFolders(foldersResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
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
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          title: 'Untitled Note',
          content: '',
          user_id: user.id,
          folder_id: folderId || null,
          dashboard_id: activeDashboard?.id || null,
        }])
        .select()
        .single();

      if (error) throw error;

      // Optimistically add the new note to state without refetching
      if (data && notes) {
        setNotes(prev => prev ? [data, ...prev] : [data]);
      }
      
      // Select the new note
      if (data) {
        handleNoteSelect(data.id);
      }
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Failed to create note');
    }
  };

  const handleNoteUpdate = async (noteId: string, updates: Partial<Note>) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', noteId);

      if (error) throw error;

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
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      // Remove from local state
      setNotes(prev => prev ? prev.filter(n => n.id !== noteId) : prev);
      setOpenNotes(prev => prev.filter(n => n.id !== noteId));
      
      // Clear selection if deleted note was selected
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setSearchParams({});
      }
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
      const { data, error } = await supabase
        .from('folders')
        .insert([{
          name: 'New folder',
          user_id: user.id,
          parent_id: parentId || null,
          dashboard_id: activeDashboard?.id || null,
        }])
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        // Optimistically update local state to avoid janky loading
        setFolders(prev => [...prev, data]);
        // Notify UI to auto-enter rename mode for this folder
        window.dispatchEvent(new CustomEvent('folderCreated', { detail: { id: data.id } }));
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    }
  };

  const handleFolderUpdate = async (folderId: string, updates: Partial<Folder>) => {
    try {
      const { error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', folderId);

      if (error) throw error;

      // Update local state
      setFolders(prev => 
        prev.map(folder => 
          folder.id === folderId ? { ...folder, ...updates } : folder
        )
      );
    } catch (error) {
      console.error('Error updating folder:', error);
    }
  };

  const handleFolderDelete = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      // Refresh data
      await fetchData();
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
