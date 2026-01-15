import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { EditorHeader } from './EditorHeader';
import type { Note, Folder, Dashboard } from '../types';
import FocusFloat from '../../landing/components/FocusFloat';
import { FocusModeContext } from '../contexts/FocusModeContext';

interface AppLayoutProps {
  children: ReactNode;
  notes: Note[];
  folders: Folder[];
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  selectedNoteId?: string | null;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  onNoteSelect?: (noteId: string) => void;
  onNoteCreate: (folderId?: string) => void;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
  onNoteDelete: (noteId: string) => void;
  onFolderCreate: (parentId?: string) => void;
  onFolderUpdate: (folderId: string, updates: Partial<Folder>) => void;
  onFolderDelete: (folderId: string) => void;
  onDashboardChange: (dashboard: Dashboard) => void;
  onDashboardsUpdate: () => void;
  loading: boolean;
  showHeader?: boolean;
  openNotes?: Note[];
  tabsEnabled?: boolean;
  onTabClick?: (noteId: string) => void;
  onTabClose?: (noteId: string) => void;
  isTimerVisible?: boolean;
  setIsTimerVisible?: (value: boolean) => void;
  isTasksVisible?: boolean;
  setIsTasksVisible?: (value: boolean) => void;
  isAmbientVisible?: boolean;
  setIsAmbientVisible?: (value: boolean) => void;
  isStatsVisible?: boolean;
  setIsStatsVisible?: (value: boolean) => void;
}

export const AppLayout = ({
  children,
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
  showHeader = true,
  openNotes = [],
  tabsEnabled = false,
  onTabClick,
  onTabClose,
  isTimerVisible = false,
  setIsTimerVisible = () => {},
  isTasksVisible = false,
  setIsTasksVisible = () => {},
  isAmbientVisible = false,
  setIsAmbientVisible = () => {},
  isStatsVisible = false,
  setIsStatsVisible = () => {},
}: AppLayoutProps) => {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const toggleFocusMode = () => setIsFocusMode(prev => !prev);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.getElementById('mobile-sidebar');
      const hamburger = document.getElementById('hamburger-button');
      if (sidebar && !sidebar.contains(e.target as Node) && !hamburger?.contains(e.target as Node)) {
        setIsSidebarOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isSidebarOpen]);

  // Close sidebar on ESC key
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobile, isSidebarOpen]);

  // Swipe gesture to close sidebar
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      // Swipe left to close (at least 50px swipe)
      if (touchStartX - touchEndX > 50) {
        setIsSidebarOpen(false);
      }
    };

    const sidebar = document.getElementById('mobile-sidebar');
    if (sidebar) {
      sidebar.addEventListener('touchstart', handleTouchStart);
      sidebar.addEventListener('touchend', handleTouchEnd);
      return () => {
        sidebar.removeEventListener('touchstart', handleTouchStart);
        sidebar.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isMobile, isSidebarOpen]);

  return (
    <>
      <FocusModeContext.Provider value={{ isFocusMode, toggleFocusMode }}>
      <div className={`flex h-screen overflow-hidden select-none ${isFocusMode ? 'focus-mode' : ''}`} style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text)' }}>
        {/* Mobile Backdrop Overlay */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Desktop or Mobile Drawer */}
        <div
          id="mobile-sidebar"
          className={`${
            isMobile
              ? `fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${
                  isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : 'relative h-full'
          }`}
          style={isMobile ? { width: '85vw', maxWidth: '400px' } : undefined}
        >
          
          <Sidebar
            notes={notes}
            folders={folders}
            dashboards={dashboards}
            activeDashboard={activeDashboard}
            selectedNoteId={selectedNoteId || null}
            sidebarWidth={isMobile ? Math.min(window.innerWidth * 0.85, 400) : sidebarWidth}
            setSidebarWidth={isMobile ? () => {} : setSidebarWidth}
            onNoteSelect={(noteId) => {
              onNoteSelect?.(noteId);
              if (isMobile) setIsSidebarOpen(false);
            }}
            onNoteCreate={onNoteCreate}
            onNoteUpdate={onNoteUpdate}
            onNoteDelete={onNoteDelete}
            onFolderCreate={onFolderCreate}
            onFolderUpdate={onFolderUpdate}
            onFolderDelete={onFolderDelete}
            onDashboardChange={onDashboardChange}
            onDashboardsUpdate={onDashboardsUpdate}
            loading={loading}
            onCloseMobile={isMobile ? () => setIsSidebarOpen(false) : undefined}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with Tabs (optional) */}
          {showHeader && tabsEnabled && (
            <EditorHeader
              openNotes={openNotes}
              activeNoteId={selectedNoteId || null}
              tabsEnabled={tabsEnabled}
              onTabClick={onTabClick || (() => {})}
              onTabClose={onTabClose || (() => {})}
              isTimerVisible={isTimerVisible}
              setIsTimerVisible={setIsTimerVisible}
              isTasksVisible={isTasksVisible}
              setIsTasksVisible={setIsTasksVisible}
              isAmbientVisible={isAmbientVisible}
              setIsAmbientVisible={setIsAmbientVisible}
              isStatsVisible={isStatsVisible}
              setIsStatsVisible={setIsStatsVisible}
              isMobile={isMobile}
              onOpenSidebar={() => setIsSidebarOpen(true)}
            />
          )}
        
          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Floating focus timer toggle */}
      <FocusFloat />
      </FocusModeContext.Provider>
    </>
  );
};
