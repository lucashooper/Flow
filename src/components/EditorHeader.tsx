import { FileText } from 'lucide-react';
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

interface EditorHeaderProps {
  openNotes: Note[];
  activeNoteId: string | null;
  tabsEnabled: boolean;
  onTabClick: (noteId: string) => void;
  onTabClose: (noteId: string) => void;
  onTabReorder: (reorderedNotes: Note[]) => void;
}

export const EditorHeader = ({ 
  openNotes, 
  activeNoteId, 
  tabsEnabled,
  onTabClick, 
  onTabClose,
  onTabReorder
}: EditorHeaderProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

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
      <div className="bg-[#151515] border-b border-[#2a2a2a] px-4 py-2 flex items-center gap-4">
        {/* Left side - File icon */}
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#888888]" />
        </div>

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
