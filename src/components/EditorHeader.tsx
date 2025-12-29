import { Minimize2, Pencil, Timer, Menu, MoreVertical } from 'lucide-react';
import { DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import type { Note } from '../types';
import { DraggableTab } from './DraggableTab';
import { useFocusMode } from '../contexts/FocusModeContext';

interface EditorHeaderProps {
  openNotes: Note[];
  activeNoteId: string | null;
  tabsEnabled: boolean;
  onTabClick: (noteId: string) => void;
  onTabClose: (noteId: string) => void;
  isTimerVisible: boolean;
  setIsTimerVisible: (value: boolean) => void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export const EditorHeader = ({ 
  openNotes,
  activeNoteId,
  tabsEnabled,
  onTabClick,
  onTabClose,
  isTimerVisible,
  setIsTimerVisible,
  isMobile = false,
  onOpenSidebar,
}: EditorHeaderProps) => {
  const [activeId] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  
  // Check plugin states from localStorage
  const focusModeEnabled = (() => {
    const saved = localStorage.getItem('focusModeEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();
  
  const pomodoroEnabled = (() => {
    const saved = localStorage.getItem('pomodoroEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();

  const activeNote = openNotes.find(note => note.id === activeId);
  return (
    <>
      <div className="tabs top-nav border-b border-subtle px-3 flex items-center">
        {/* Mobile Hamburger */}
        {isMobile && onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="p-2 mr-2 rounded-lg transition-colors"
            style={{ color: 'var(--text)', minWidth: '44px', minHeight: '44px' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Tabs area - flush contiguous tabs like Chrome/Obsidian */}
        {tabsEnabled && openNotes.length > 0 && (
          <SortableContext items={openNotes.map(n => n.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-end flex-1 overflow-x-auto scrollbar-hide">
              {openNotes.map((note) => (
                <DraggableTab
                  key={note.id}
                  note={note}
                  isActive={activeNoteId === note.id}
                  onTabClick={onTabClick}
                  onTabClose={onTabClose}
                />
              ))}
            </div>
          </SortableContext>
        )}

        {/* Right-side actions */}
        <div className="ml-auto nav-actions flex items-center gap-1.5">
          {!isMobile ? (
            // Desktop: Show all icons
            <>
              {focusModeEnabled && (
                <button
                  onClick={toggleFocusMode}
                  className={`nav-item p-2 rounded transition-colors ${
                    isFocusMode ? 'bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'
                  }`}
                  style={{ color: isFocusMode ? 'var(--accent)' : 'var(--muted)' }}
                  title="Toggle Focus Mode"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => window.dispatchEvent(new Event('toggleDrawingMode'))}
                className="nav-item p-2 rounded hover:bg-[#1a1a1a] transition-colors"
                style={{ color: 'var(--muted)' }}
                title="Draw Mode (Coming Soon)"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {pomodoroEnabled && (
                <button
                  onClick={() => setIsTimerVisible(!isTimerVisible)}
                  className={`nav-item p-2 rounded transition-colors ${
                    isTimerVisible ? 'bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'
                  }`}
                  style={{ color: isTimerVisible ? 'var(--accent)' : 'var(--muted)' }}
                  title="Pomodoro Timer"
                >
                  <Timer className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            // Mobile: Show more menu
            <div className="relative">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="nav-item p-2 rounded hover:bg-[#1a1a1a] text-[#888888] transition-colors"
                title="More options"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMobileMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 rounded-lg shadow-2xl py-1 z-50 min-w-[160px]"
                  style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)' }}
                >
                  {focusModeEnabled && (
                    <button
                      onClick={() => {
                        toggleFocusMode();
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Minimize2 className="w-5 h-5" />
                      <span>Focus Mode</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowMobileMenu(false)}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Pencil className="w-5 h-5" />
                    <span>Draw Mode</span>
                  </button>
                  {pomodoroEnabled && (
                    <button
                      onClick={() => {
                        setIsTimerVisible(!isTimerVisible);
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Timer className="w-5 h-5" />
                      <span>Pomodoro Timer</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeNote ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1a1a1a] text-[#e5e5e5] min-w-[120px] max-w-[200px] shadow-2xl opacity-90">
            <span className="text-sm truncate flex-1">{activeNote?.title || 'Untitled'}</span>
          </div>
        ) : null}
      </DragOverlay>
    </>
  );
};
