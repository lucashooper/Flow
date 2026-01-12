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
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragOverlay } from '@dnd-kit/core';
import type { Note } from '../types';

export const NewDashboard = () => {
  const { user } = useAuth();
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: 'note' | 'tab'; note: Note } | null>(null);
  
  console.log('🔍 [NewDashboard] searchQuery from URL:', searchQuery);

  // Sync offline notes when connection is restored
  useOfflineSync();

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
    handleNoteCreate,
    handleNoteUpdate,
    handleNoteDelete,
    handleFolderCreate,
    handleFolderUpdate,
    handleFolderDelete,
    handleDashboardChange,
    handleDashboardsUpdate,
  } = useDashboardData();

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
    
    console.log('🎬 [DRAG START]', {
      activeId,
      dataType: data?.type,
      hasNote: !!data?.note,
      noteTitle: data?.note?.title
    });
    
    setActiveId(activeId);
    
    // Extract note data - handle both 'note' and 'tab' types
    if (data?.type === 'note' || data?.type === 'tab') {
      const note = data.note;
      if (note) {
        setDraggedItem({ type: data.type, note });
        console.log('✅ [DRAG START] DraggedItem set:', note.title);
      } else {
        console.warn('⚠️ [DRAG START] No note data found in drag event');
      }
    } else {
      console.warn('⚠️ [DRAG START] Unknown drag type:', data?.type);
    }
  };

  const handleDragEnd = (event: any) => {
    console.log('[NewDashboard] DRAG END:', event.active.id, 'over:', event.over?.id);
    
    const { active, over } = event;
    
    // Handle tab reordering
    if (active && over && draggedItem?.type === 'tab') {
      const activeIndex = openNotes.findIndex(n => n.id === active.id);
      const overIndex = openNotes.findIndex(n => n.id === over.id);
      
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        const reorderedNotes = [...openNotes];
        const [movedNote] = reorderedNotes.splice(activeIndex, 1);
        reorderedNotes.splice(overIndex, 0, movedNote);
        handleTabReorder(reorderedNotes);
        console.log('[NewDashboard] Tabs reordered:', { from: activeIndex, to: overIndex });
      }
    }
    
    // Clear drag state immediately
    setActiveId(null);
    setDraggedItem(null);
    
    // Force re-render of dragged items after a short delay
    setTimeout(() => {
      const draggedElement = document.querySelector(`[data-folder-id="${event.active.id}"]`);
      if (draggedElement) {
        (draggedElement as HTMLElement).style.visibility = 'visible';
        (draggedElement as HTMLElement).style.opacity = '1';
      }
    }, 0);
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
        <DragOverlay>
          {activeId && draggedItem ? (
            <div className="bg-[#1a1a1a] text-[#e5e5e5] px-3 py-2 rounded-md shadow-2xl border border-[#333] opacity-90 scale-95 cursor-grabbing">
              <div className="flex items-center gap-2">
                {draggedItem.note.emoji && (
                  <span className="text-sm">{draggedItem.note.emoji}</span>
                )}
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {draggedItem.note.title || 'Untitled'}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>

        <AppLayout
          notes={notes || []}
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
          showHeader={true}
          openNotes={openNotes}
          tabsEnabled={tabsEnabled}
          onTabClick={handleNoteSelect}
          onTabClose={handleTabClose}
          isTimerVisible={isTimerVisible}
          setIsTimerVisible={setIsTimerVisible}
        >
          {/* Workspace (split panes) */}
          <WorkspaceProvider initialNoteId={selectedNoteId || null} selectedNoteId={selectedNoteId}>
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

    {/* Settings Modal Overlay */}
    <SettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />
    </>
  );
};
