import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { EditorPanel } from '../components/EditorPanel';
import { EditorHeader } from '../components/EditorHeader';
import { FocusModeContext } from '../contexts/FocusModeContext';
import { WelcomeModal } from '../components/WelcomeModal';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';

export const NewDashboard = () => {
  const { user } = useAuth();
  const [isFocusMode, setIsFocusMode] = useState(false);
  
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

  const selectedNote = notes?.find(note => note.id === selectedNoteId);

  const toggleFocusMode = () => {
    setIsFocusMode(prev => !prev);
  };

  return (
    <>
      {/* Welcome Modal - shows once after email verification */}
      <WelcomeModal userConfirmed={!!(user as any)?.email_confirmed_at} />
      
      <FocusModeContext.Provider value={{ isFocusMode, toggleFocusMode }}>
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
      <div className="flex-1 flex flex-col overflow-hidden editor-container">
        {/* Unified Header with Tabs */}
        <EditorHeader
          openNotes={openNotes}
          activeNoteId={selectedNoteId}
          tabsEnabled={tabsEnabled}
          onTabClick={handleNoteSelect}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
        />
        
        {/* Editor Panel */}
        <EditorPanel
          note={selectedNote}
          onNoteUpdate={handleNoteUpdate}
        />
      </div>
    </div>
    </FocusModeContext.Provider>
    </>
  );
};
