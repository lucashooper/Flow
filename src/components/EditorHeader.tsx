import { FileText, Minimize2, Pencil, Timer } from 'lucide-react';
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
}

export const EditorHeader = ({ 
  openNotes,
  activeNoteId,
  tabsEnabled,
  onTabClick,
  onTabClose,
  isTimerVisible,
  setIsTimerVisible,
}: EditorHeaderProps) => {
  const [activeId] = useState<string | null>(null);
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
          {/* Word count toggle */}
          <button
            onClick={() => window.dispatchEvent(new Event('toggleWordCount'))}
            className="nav-item p-1.5 rounded hover:bg-[#222222] text-[#888888] hover:text-[#e5e5e5] transition-colors"
            title="Toggle word count"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* Drawing toggle */}
          <button
            onClick={() => window.dispatchEvent(new Event('toggleDrawingMode'))}
            className="nav-item p-1.5 rounded hover:bg-[#222222] text-[#888888] hover:text-[#e5e5e5] transition-colors"
            title="Toggle drawing mode"
          >
            <Pencil className="w-4 h-4" />
          </button>

          {/* Focus Mode toggle - only show if enabled */}
          {focusModeEnabled && (
            <button
              onClick={toggleFocusMode}
              className="nav-item focus-toggle p-1.5 rounded hover:bg-[#222222] text-[#888888] hover:text-[#e5e5e5] transition-colors"
              title="Toggle Focus Mode"
            >
              <Minimize2 className={`w-4 h-4 ${isFocusMode ? 'text-[#e5e5e5]' : ''}`} />
            </button>
          )}

          {/* Floating Focus Timer toggle - only show if enabled */}
          {pomodoroEnabled && (
            <button
              type="button"
              onClick={() => setIsTimerVisible(!isTimerVisible)}
              title={isTimerVisible ? 'Hide timer' : 'Show timer'}
              className={
                'nav-item p-1.5 rounded hover:bg-[#222222] transition-colors ' +
                (isTimerVisible ? 'text-[#e5e5e5]' : 'text-[#888888] hover:text-[#e5e5e5]')
              }
            >
              <Timer
                className="w-4 h-4"
                style={{
                  filter: isTimerVisible ? 'drop-shadow(0 0 6px rgba(168,85,247,0.65))' : 'none',
                }}
              />
            </button>
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
