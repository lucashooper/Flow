import { FileText, Minimize2, Pencil, Timer } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
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
  onTabReorder: (reorderedNotes: Note[]) => void;
  isTimerVisible: boolean;
  setIsTimerVisible: (value: boolean) => void;
}

export const EditorHeader = ({ 
  openNotes, 
  activeNoteId, 
  tabsEnabled,
  onTabClick, 
  onTabClose,
  onTabReorder,
  isTimerVisible,
  setIsTimerVisible,
}: EditorHeaderProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { isFocusMode, toggleFocusMode } = useFocusMode();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = openNotes.findIndex(note => note.id === active.id);
    const newIndex = openNotes.findIndex(note => note.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = [...openNotes];
      const [movedNote] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, movedNote);
      onTabReorder(reordered);
    }
  };

  const activeNote = openNotes.find(note => note.id === activeId);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="tabs top-nav bg-[#151515] border-b border-[#2a2a2a] px-4 py-2 flex items-center gap-4">

        {/* Tabs area */}
        {tabsEnabled && openNotes.length > 0 && (
          <SortableContext items={openNotes.map(n => n.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
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

          {/* Focus Mode toggle */}
          <button
            onClick={toggleFocusMode}
            className="nav-item focus-toggle p-1.5 rounded hover:bg-[#222222] text-[#888888] hover:text-[#e5e5e5] transition-colors"
            title="Toggle Focus Mode"
          >
            <Minimize2 className={`w-4 h-4 ${isFocusMode ? 'text-[#e5e5e5]' : ''}`} />
          </button>

          {/* Floating Focus Timer toggle */}
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
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeNote ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1a1a1a] text-[#e5e5e5] min-w-[120px] max-w-[200px] shadow-2xl opacity-90">
            <span className="text-sm truncate flex-1">{activeNote.title || 'Untitled'}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
