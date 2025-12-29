import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
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

  return (
    <>
      <FocusModeContext.Provider value={{ isFocusMode, toggleFocusMode }}>
      <div className="flex h-screen overflow-hidden select-none" style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text)' }}>
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
              : 'relative'
          }`}
          style={isMobile ? { width: '280px' } : undefined}
        >
          {/* Mobile Sidebar Header */}
          {isMobile && isSidebarOpen && (
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--divider)' }}>
              <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Flow</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          
          <Sidebar
            notes={notes}
            folders={folders}
            dashboards={dashboards}
            activeDashboard={activeDashboard}
            selectedNoteId={selectedNoteId || null}
            sidebarWidth={isMobile ? 280 : sidebarWidth}
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
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Hamburger Button */}
          {isMobile && (
            <div className="flex items-center p-4 border-b" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--divider)' }}>
              <button
                id="hamburger-button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text)', minWidth: '44px', minHeight: '44px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Menu className="w-6 h-6" />
              </button>
              <span className="ml-3 text-lg font-semibold" style={{ color: 'var(--text)' }}>Flow</span>
            </div>
          )}

          {/* Header with Tabs (optional) */}
          {showHeader && tabsEnabled && !isMobile && (
            <EditorHeader
              openNotes={openNotes}
              activeNoteId={selectedNoteId || null}
              tabsEnabled={tabsEnabled}
              onTabClick={onTabClick || (() => {})}
              onTabClose={onTabClose || (() => {})}
              isTimerVisible={false}
              setIsTimerVisible={() => {}}
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
