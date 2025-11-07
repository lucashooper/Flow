import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Note, Folder, Dashboard } from '../types';
import { Sidebar } from '../components/Sidebar';
import { EditorPanel } from '../components/EditorPanel';
import { EditorHeader } from '../components/EditorHeader';

export const NewDashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    searchParams.get('note')
  );
  const [loading, setLoading] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [openNotes, setOpenNotes] = useState<Note[]>([]);
  const tabsEnabled = (() => {
    const saved = localStorage.getItem('tabsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();
  const hasLoadedDashboards = useRef(false);

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
    }
  }, [activeDashboard?.id]); // Only refetch when dashboard ID changes, not the object reference

  const fetchDashboards = async () => {
    try {
      console.log('Fetching dashboards...');
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Dashboards fetch result:', { data, error });

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

  const handleNoteSelect = (noteId: string) => {
    setSelectedNoteId(noteId);
    setSearchParams({ note: noteId });
    
    // Add to open tabs if tabs are enabled
    if (tabsEnabled) {
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

  const handleNoteCreate = async (folderId?: string) => {
    if (!user?.id) {
      alert('You must be logged in to create notes');
      return;
    }

    try {
      console.log('Creating note...');
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          title: 'Untitled Note',
          content: '',
          user_id: user.id,
          folder_id: folderId || null,
          dashboard_id: activeDashboard?.id || null,
          emoji: null
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Failed to create note: ${error.message}\n\nMake sure you've run the updated SQL script in Supabase!`);
        throw error;
      }
      
      if (data) {
        console.log('Note created:', data);
        setNotes(prev => [data, ...prev]);
        handleNoteSelect(data.id);
      }
    } catch (error: any) {
      console.error('Error creating note:', error);
      if (!error.message?.includes('Failed to create note')) {
        alert(`Error: ${error.message || 'Failed to create note'}`);
      }
    }
  };

  const handleNoteUpdate = async (noteId: string, updates: Partial<Note>) => {
    try {
      console.log('📝 Updating note:', noteId, 'with keys:', Object.keys(updates));
      const { error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', noteId);

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Note updated successfully');
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? { ...note, ...updates, updated_at: new Date().toISOString() } : note
        )
      );
    } catch (error) {
      console.error('❌ Error updating note:', error);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (error) throw error;

      setNotes(prev => prev.filter(note => note.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setSearchParams({});
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleFolderCreate = async (parentId?: string) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert([{
          name: 'New Folder',
          user_id: user.id,
          parent_id: parentId || null,
          dashboard_id: activeDashboard?.id || null
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setFolders(prev => [...prev, data]);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleFolderUpdate = async (folderId: string, updates: Partial<Folder>) => {
    try {
      const { error } = await supabase
        .from('folders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', folderId);

      if (error) throw error;

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
    try {
      const { error } = await supabase.from('folders').delete().eq('id', folderId);
      if (error) throw error;

      setFolders(prev => prev.filter(folder => folder.id !== folderId));
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const handleDashboardChange = async (dashboard: Dashboard) => {
    console.log('Switching to dashboard:', dashboard);
    setActiveDashboard(dashboard);
    
    // Mark this dashboard as active
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
    console.log('Refreshing dashboards...');
    fetchDashboards();
  };

  const selectedNote = notes.find(note => note.id === selectedNoteId);

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#e5e5e5] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        notes={notes}
        folders={folders}
        dashboards={dashboards}
        activeDashboard={activeDashboard}
        selectedNoteId={selectedNoteId}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        onNoteSelect={handleNoteSelect}
        onNoteCreate={handleNoteCreate}
        onNoteUpdate={handleNoteUpdate}
        onNoteDelete={handleNoteDelete}
        onFolderCreate={handleFolderCreate}
        onFolderUpdate={handleFolderUpdate}
        onFolderDelete={handleFolderDelete}
        onDashboardChange={handleDashboardChange}
        onDashboardsUpdate={handleDashboardsUpdate}
        loading={loading}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Unified Header with Tabs */}
        <EditorHeader
          openNotes={openNotes}
          activeNoteId={selectedNoteId}
          tabsEnabled={tabsEnabled}
          onTabClick={handleNoteSelect}
          onTabClose={handleTabClose}
        />
        
        {/* Editor Panel */}
        <EditorPanel
          note={selectedNote}
          onNoteUpdate={handleNoteUpdate}
        />
      </div>
    </div>
  );
};
