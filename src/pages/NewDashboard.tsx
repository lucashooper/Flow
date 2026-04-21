import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { EditorWorkspace } from '../components/EditorWorkspace';
import { WelcomeModal } from '../components/WelcomeModal';
import { SettingsModal } from '../components/SettingsModal';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useOfflineSync } from '../hooks/useOfflineSync';
import FloatingTimer from '../components/FloatingTimer';
import { FloatingTasks } from '../components/FloatingTasks';
import { AmbientSounds } from '../components/AmbientSounds';
import { FocusStats } from '../components/FocusStats';
import { BreakReminder } from '../components/BreakReminder';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragOverlay } from '@dnd-kit/core';
import type { Note } from '../types';

export const NewDashboard = () => {
  const { user } = useAuth();
  const [isTimerVisible, setIsTimerVisible] = useState(() => {
    const saved = localStorage.getItem('isTimerVisible');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isTasksVisible, setIsTasksVisible] = useState(() => {
    const saved = localStorage.getItem('isTasksVisible');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isAmbientVisible, setIsAmbientVisible] = useState(() => {
    const saved = localStorage.getItem('isAmbientVisible');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isStatsVisible, setIsStatsVisible] = useState(() => {
    const saved = localStorage.getItem('isStatsVisible');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [breakRemindersEnabled] = useState(() => {
    const saved = localStorage.getItem('breakRemindersEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<
    | { type: 'note'; note: Note }
    | { type: 'tab'; note: Note }
    | { type: 'folder'; folder: any }
    | null
  >(null);

  // Sync offline notes when connection is restored
  useOfflineSync();

  // Persist modal visibility states
  useEffect(() => {
    localStorage.setItem('isTimerVisible', JSON.stringify(isTimerVisible));
  }, [isTimerVisible]);

  useEffect(() => {
    localStorage.setItem('isTasksVisible', JSON.stringify(isTasksVisible));
  }, [isTasksVisible]);

  useEffect(() => {
    localStorage.setItem('isAmbientVisible', JSON.stringify(isAmbientVisible));
  }, [isAmbientVisible]);

  useEffect(() => {
    localStorage.setItem('isStatsVisible', JSON.stringify(isStatsVisible));
  }, [isStatsVisible]);

  // Listen for openSettings event from DashboardSwitcher
  useEffect(() => {
    const handleOpenSettings = () => {
      console.log('⚙️ Opening settings modal');
      setIsSettingsOpen(true);
    };
    window.addEventListener('openSettings', handleOpenSettings);
    return () => window.removeEventListener('openSettings', handleOpenSettings);
  }, []);
  
  // Use shared dashboard data hook
  const {
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
  } = useDashboardData();

  const handleNoteSelectWithFocus = (noteId: string) => {
    setFocusedNoteId(noteId);
    handleNoteSelect(noteId);
  };

  // const selectedNote = notes?.find(note => note.id === selectedNoteId);

  // Global dnd-kit context (shared by sidebar, tabs, and editor workspace)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Log on mount to verify handlers are attached
  useEffect(() => {
    console.log('[NewDashboard] DndContext handlers attached:', {
      hasHandleDragStart: !!handleDragStart,
      hasHandleDragEnd: !!handleDragEnd,
      hasHandleDragCancel: !!handleDragCancel,
    });
  }, []);

  const handleDragStart = (event: any) => {
    const activeId = event.active.id;
    const data = event.active.data.current;
    
    // Ignore dashboard drags — handled by DashboardSwitcher's own DndContext
    if (data?.type === 'dashboard') return;
    
    setActiveId(activeId);
    
    // Set draggedItem for sidebar notes, folders, and tabs
    if (data?.type === 'note') {
      const note = data.note;
      if (note) {
        setDraggedItem({ type: 'note', note });
        console.log('✅ [DRAG START] Sidebar note drag:', note.title);
      }
    } else if (data?.type === 'folder') {
      const folder = data.folder;
      if (folder) {
        setDraggedItem({ type: 'folder', folder });
        console.log('✅ [DRAG START] Sidebar folder drag:', folder.name);
      }
    } else if (data?.type === 'tab') {
      const note = data.note;
      if (note) {
        setDraggedItem({ type: 'tab', note });
        console.log('✅ [DRAG START] Tab drag:', note.title);
      }
    }
  };

  const handleDragEnd = async (event: any) => {
    console.log('[NewDashboard] DRAG END:', event.active.id, 'over:', event.over?.id);
    
    const { active, over } = event;
    
    if (!active || !over || active.id === over.id) {
      setActiveId(null);
      setDraggedItem(null);
      return;
    }
    
    // Handle tab reordering
    if (draggedItem?.type === 'tab') {
      // Extract note ID from tab-prefixed ID
      const activeNoteId = active.id.toString().replace('tab-', '');
      const overNoteId = over.id.toString().replace('tab-', '');
      
      const activeIndex = openNotes.findIndex(n => n.id === activeNoteId);
      const overIndex = openNotes.findIndex(n => n.id === overNoteId);
      
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        const reorderedNotes = [...openNotes];
        const [movedNote] = reorderedNotes.splice(activeIndex, 1);
        reorderedNotes.splice(overIndex, 0, movedNote);
        handleTabReorder(reorderedNotes);
        console.log('[NewDashboard] Tabs reordered:', { from: activeIndex, to: overIndex });
      }
    }
    
    // Handle note drag in sidebar
    if (draggedItem?.type === 'note' && notes) {
      const overData = over.data?.current;
      
      // Dropping a note onto a folder → move note into that folder
      if (overData?.type === 'folder') {
        const targetFolderId = over.id.toString();
        const draggedNote = notes.find(n => n.id === active.id);
        if (draggedNote && draggedNote.folder_id !== targetFolderId) {
          handleNoteUpdate(active.id.toString(), { folder_id: targetFolderId });
          console.log('[NewDashboard] Note moved into folder:', { note: draggedNote.title, folder: targetFolderId });
        }
      } else {
        // Note-to-note reordering
        const activeIndex = notes.findIndex(n => n.id === active.id);
        const overIndex = notes.findIndex(n => n.id === over.id);
        
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          // If dropping onto a note that's in a folder, move the dragged note to that folder too
          const overNote = notes[overIndex];
          const draggedNote = notes[activeIndex];
          if (overNote.folder_id !== draggedNote.folder_id) {
            handleNoteUpdate(active.id.toString(), { folder_id: overNote.folder_id || null });
            console.log('[NewDashboard] Note moved to folder of target note:', overNote.folder_id);
          }
          
          const reorderedNotes = [...notes];
          const [movedNote] = reorderedNotes.splice(activeIndex, 1);
          reorderedNotes.splice(overIndex, 0, movedNote);
          handleNoteReorder(reorderedNotes);
          console.log('[NewDashboard] Notes reordered:', { from: activeIndex, to: overIndex });
        }
      }
    }
    
    // Handle folder drag in sidebar
    if (draggedItem?.type === 'folder' && folders) {
      const overData = over.data?.current;
      const draggedFolderId = active.id.toString();
      const draggedFolder = folders.find(f => f.id === draggedFolderId);
      
      // Dropping a folder onto another folder → nest it as a subfolder
      if (overData?.type === 'folder') {
        const targetFolderId = over.id.toString();
        
        // Prevent nesting a folder into itself or into its own descendants
        if (draggedFolder && targetFolderId !== draggedFolderId) {
          // Check if target is a descendant of dragged folder
          const isDescendant = (folderId: string, ancestorId: string): boolean => {
            const folder = folders.find(f => f.id === folderId);
            if (!folder || !folder.parent_id) return false;
            if (folder.parent_id === ancestorId) return true;
            return isDescendant(folder.parent_id, ancestorId);
          };
          
          if (!isDescendant(targetFolderId, draggedFolderId)) {
            // Update the dragged folder's parent_id to nest it
            handleFolderUpdate(draggedFolderId, { parent_id: targetFolderId });
            console.log('[NewDashboard] Folder nested into another folder:', { 
              folder: draggedFolder.name, 
              parent: targetFolderId 
            });
          } else {
            console.warn('[NewDashboard] Cannot nest folder into its own descendant');
          }
        }
      } else if (overData?.type === 'note') {
        // Dropping a folder onto a root-level note → move folder to root
        const overNote = notes?.find(n => n.id === over.id);
        if (draggedFolder && overNote && !overNote.folder_id && draggedFolder.parent_id) {
          // Move folder to root level (unnest it)
          handleFolderUpdate(draggedFolderId, { parent_id: null });
          console.log('[NewDashboard] Folder moved to root level:', draggedFolder.name);
        }
      } else {
        // Folder-to-folder reordering (between folders, not onto)
        // OR dropping onto empty space / root area
        const activeIndex = folders.findIndex(f => f.id === active.id);
        const overIndex = folders.findIndex(f => f.id === over.id);
        
        // If dragging a nested folder and dropping it between root items, unnest it
        if (draggedFolder && draggedFolder.parent_id) {
          const overFolder = folders.find(f => f.id === over.id);
          // If dropping onto a root-level folder (for reordering) or a root note, move to root
          if (!overFolder || !overFolder.parent_id) {
            handleFolderUpdate(draggedFolderId, { parent_id: null });
            console.log('[NewDashboard] Folder moved to root level:', draggedFolder.name);
          }
        }
        
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          const reorderedFolders = [...folders];
          const [movedFolder] = reorderedFolders.splice(activeIndex, 1);
          reorderedFolders.splice(overIndex, 0, movedFolder);
          handleFolderReorder(reorderedFolders);
          console.log('[NewDashboard] Folders reordered:', { from: activeIndex, to: overIndex });
        }
      }
    }
    
    // Clear drag state immediately
    setActiveId(null);
    setDraggedItem(null);
  };

  const handleDragCancel = () => {
    console.log('[NewDashboard] DRAG CANCEL');
    setActiveId(null);
    setDraggedItem(null);
  };

  return (
    <>
      {/* Welcome Modal - shows once after email verification */}
      <WelcomeModal userConfirmed={!!(user as any)?.email_confirmed_at} />
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Drag Overlay - shows what's being dragged */}
        <DragOverlay dropAnimation={null}>
          {activeId && draggedItem ? (
            <div className="bg-[#1a1a1a] text-[#e5e5e5] px-3 py-2 rounded-md shadow-2xl border border-[#333] opacity-90 scale-95 cursor-grabbing">
              <div className="flex items-center gap-2">
                {draggedItem.type === 'folder' ? (
                  <>
                    {draggedItem.folder.emoji && (
                      <span className="text-sm">{draggedItem.folder.emoji}</span>
                    )}
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {draggedItem.folder.name || 'Untitled'}
                    </span>
                  </>
                ) : (
                  <>
                    {draggedItem.note.emoji && (
                      <span className="text-sm">{draggedItem.note.emoji}</span>
                    )}
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {draggedItem.note.title || 'Untitled'}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DragOverlay>

        <AppLayout
          notes={notes || []}
          folders={folders}
          dashboards={dashboards}
          activeDashboard={activeDashboard}
          selectedNoteId={focusedNoteId ?? selectedNoteId}
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          onNoteSelect={handleNoteSelectWithFocus}
          onNoteCreate={handleNoteCreate}
          onNoteUpdate={handleNoteUpdate}
          onNoteDelete={handleNoteDelete}
          onFolderCreate={handleFolderCreate}
          onFolderUpdate={handleFolderUpdate}
          onFolderDelete={handleFolderDelete}
          onDashboardChange={handleDashboardChange}
          onDashboardsUpdate={handleDashboardsUpdate}
          loading={loading}
          showHeader={true}
          openNotes={openNotes}
          tabsEnabled={tabsEnabled}
          onTabClick={handleNoteSelectWithFocus}
          onTabClose={handleTabClose}
          isTimerVisible={isTimerVisible}
          setIsTimerVisible={setIsTimerVisible}
          isTasksVisible={isTasksVisible}
          setIsTasksVisible={setIsTasksVisible}
          isAmbientVisible={isAmbientVisible}
          setIsAmbientVisible={setIsAmbientVisible}
          isStatsVisible={isStatsVisible}
          setIsStatsVisible={setIsStatsVisible}
        >
          {/* Workspace (split panes) */}
          <WorkspaceProvider 
            initialNoteId={selectedNoteId || null} 
            selectedNoteId={selectedNoteId}
            onActiveNoteChange={(noteId) => {
              // Pane focus should only update highlighting, not navigation (URL/search params).
              if (import.meta.env.DEV) console.log('🎯 [NewDashboard] Focused pane noteId:', noteId);
              setFocusedNoteId(noteId);
            }}
          >
            <EditorWorkspace
              notes={notes || []}
              onNoteUpdate={handleNoteUpdate}
              searchQuery={searchQuery}
            />
          </WorkspaceProvider>
        </AppLayout>
      </DndContext>

    {/* Simple floating timer for dashboard */}
    <FloatingTimer
      isVisible={isTimerVisible}
      onClose={() => setIsTimerVisible(false)}
    />

    {/* Floating tasks modal */}
    <FloatingTasks
      isVisible={isTasksVisible}
      onClose={() => setIsTasksVisible(false)}
    />

    {/* Ambient sounds */}
    <AmbientSounds
      isVisible={isAmbientVisible}
      onClose={() => setIsAmbientVisible(false)}
    />

    {/* Focus stats */}
    <FocusStats
      isVisible={isStatsVisible}
      onClose={() => setIsStatsVisible(false)}
    />

    {/* Break reminders */}
    <BreakReminder enabled={breakRemindersEnabled} />

    {/* Settings Modal Overlay */}
    <SettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />
    </>
  );
};
