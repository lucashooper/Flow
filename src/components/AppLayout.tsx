import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { EditorHeader } from './EditorHeader';
import type { Note, Folder, Dashboard } from '../types';

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
  onTabReorder?: (notes: Note[]) => void;
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
  onTabReorder,
}: AppLayoutProps) => {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#e5e5e5] overflow-hidden select-none">
      {/* Sidebar */}
      <Sidebar
        notes={notes}
        folders={folders}
        dashboards={dashboards}
        activeDashboard={activeDashboard}
        selectedNoteId={selectedNoteId || null}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        onNoteSelect={onNoteSelect || (() => {})}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Tabs (optional) */}
        {showHeader && (
          <EditorHeader
            openNotes={openNotes}
            activeNoteId={selectedNoteId || null}
            tabsEnabled={tabsEnabled}
            onTabClick={onTabClick || (() => {})}
            onTabClose={onTabClose || (() => {})}
            onTabReorder={onTabReorder || (() => {})}
          />
        )}
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
