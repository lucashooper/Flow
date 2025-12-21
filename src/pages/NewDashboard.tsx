import { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { EditorWorkspace } from '../components/EditorWorkspace';
import { EditorHeader } from '../components/EditorHeader';
import { FocusModeContext } from '../contexts/FocusModeContext';
import { WelcomeModal } from '../components/WelcomeModal';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import FloatingTimer from '../components/FloatingTimer';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';

export const NewDashboard = () => {
  const { user } = useAuth();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  
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

  const toggleFocusMode = () => {
    setIsFocusMode(prev => !prev);
  };

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
    console.log('[NewDashboard] DRAG START:', event.active.id);
  };

  const handleDragEnd = (event: any) => {
    console.log('🔍 [POST-DRAG COMPREHENSIVE DUMP] START');
    console.log('[NewDashboard] DRAG END:', event.active.id, 'over:', event.over?.id);
    
    // Check DragOverlay state
    const dragOverlays = document.querySelectorAll('[data-dnd-kit-drag-overlay]');
    console.log('🔍 DragOverlay count:', dragOverlays.length);
    dragOverlays.forEach((overlay, i) => {
      const overlayStyle = getComputedStyle(overlay as Element);
      console.log(`🔍 DragOverlay[${i}]:`, {
        display: overlayStyle.display,
        pointerEvents: overlayStyle.pointerEvents,
        zIndex: overlayStyle.zIndex,
      });
    });
    
    // Comprehensive DOM/style/overlay detection after drag ends
    requestAnimationFrame(() => {
      const itemEl = document.querySelector(`[data-noteid="${event.active.id}"]`) as HTMLElement | null;
      const titleEl = itemEl?.querySelector('[data-debug="title"]') as HTMLElement | null;
      const previewEl = itemEl?.querySelector('[data-debug="preview"]') as HTMLElement | null;
      
      if (!itemEl || !titleEl) {
        console.error('🔴 POST-DRAG: Item or title element not found!');
        console.log('🔍 [POST-DRAG COMPREHENSIVE DUMP] END (early - no element)');
        return;
      }

      // Get computed styles for all elements
      const itemStyle = getComputedStyle(itemEl);
      const titleStyle = getComputedStyle(titleEl);
      const previewStyle = previewEl ? getComputedStyle(previewEl) : null;

      // Get geometry
      const itemRect = itemEl.getBoundingClientRect();
      const titleRect = titleEl.getBoundingClientRect();
      
      // Check what element is actually on top at the center of the row
      const centerX = itemRect.left + itemRect.width / 2;
      const centerY = itemRect.top + itemRect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);

      console.log('🔍 [POST-DRAG COMPREHENSIVE DUMP] DATA:', {
        noteId: event.active.id,
        
        // Row container
        rowContainer: {
          classes: itemEl.className,
          dataAttrs: Array.from(itemEl.attributes)
            .filter(a => a.name.startsWith('data-'))
            .map(a => `${a.name}=${a.value}`),
          color: itemStyle.color,
          opacity: itemStyle.opacity,
          visibility: itemStyle.visibility,
          display: itemStyle.display,
          filter: itemStyle.filter,
          mixBlendMode: itemStyle.mixBlendMode,
          pointerEvents: itemStyle.pointerEvents,
          height: itemStyle.height,
          maxHeight: itemStyle.maxHeight,
          overflow: itemStyle.overflow,
          rect: { x: itemRect.x, y: itemRect.y, width: itemRect.width, height: itemRect.height },
          innerHTML: itemEl.innerHTML.substring(0, 200), // First 200 chars of HTML
        },
        
        // Title element
        title: {
          text: titleEl.textContent,
          color: titleStyle.color,
          opacity: titleStyle.opacity,
          visibility: titleStyle.visibility,
          display: titleStyle.display,
          filter: titleStyle.filter,
          mixBlendMode: titleStyle.mixBlendMode,
          webkitTextFillColor: titleStyle.webkitTextFillColor,
          pointerEvents: titleStyle.pointerEvents,
          rect: { x: titleRect.x, y: titleRect.y, width: titleRect.width, height: titleRect.height },
        },
        
        // Preview element
        preview: previewEl ? {
          text: previewEl.textContent,
          color: previewStyle?.color,
          opacity: previewStyle?.opacity,
          visibility: previewStyle?.visibility,
          display: previewStyle?.display,
          filter: previewStyle?.filter,
          mixBlendMode: previewStyle?.mixBlendMode,
          webkitTextFillColor: previewStyle?.webkitTextFillColor,
          pointerEvents: previewStyle?.pointerEvents,
        } : 'N/A',
        
        // Overlay detection
        overlayCheck: {
          centerPoint: { x: centerX, y: centerY },
          topElementTag: topElement?.tagName,
          topElementClass: topElement?.className,
          topElementId: topElement?.id,
          isRowOnTop: topElement === itemEl || itemEl.contains(topElement),
        },
      });
      
      console.log('🔍 [POST-DRAG COMPREHENSIVE DUMP] END');
    });
  };

  const handleDragCancel = () => {
    console.log('[NewDashboard] DRAG CANCEL');
  };

  return (
    <>
      {/* Welcome Modal - shows once after email verification */}
      <WelcomeModal userConfirmed={!!(user as any)?.email_confirmed_at} />
      
      <FocusModeContext.Provider value={{ isFocusMode, toggleFocusMode }}>
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
      <div className={`flex h-screen bg-[#0a0a0a] text-[#e5e5e5] overflow-hidden ${isFocusMode ? 'focus-mode' : ''}`}>
      {/* Sidebar */}
      <Sidebar
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
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden editor-container">
        {/* Workspace (split panes) */}
        <WorkspaceProvider initialNoteId={selectedNoteId || null} selectedNoteId={selectedNoteId}>
          {/* Unified Header with Tabs */}
          <EditorHeader
            openNotes={openNotes}
            activeNoteId={selectedNoteId}
            tabsEnabled={tabsEnabled}
            onTabClick={handleNoteSelect}
            onTabClose={handleTabClose}
            isTimerVisible={isTimerVisible}
            setIsTimerVisible={setIsTimerVisible}
          />
          <EditorWorkspace
            notes={notes || []}
            onNoteUpdate={handleNoteUpdate}
          />
        </WorkspaceProvider>
      </div>
    </div>
    </DndContext>
    </FocusModeContext.Provider>

    {/* Simple floating timer for dashboard */}
    <FloatingTimer
      isVisible={isTimerVisible}
      onClose={() => setIsTimerVisible(false)}
    />
    </>
  );
};
