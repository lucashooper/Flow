import { X } from 'lucide-react';
import type { Note } from '../types';

interface NoteTabsProps {
  openNotes: Note[];
  activeNoteId: string | null;
  onTabClick: (noteId: string) => void;
  onTabClose: (noteId: string) => void;
}

export const NoteTabs = ({ openNotes, activeNoteId, onTabClick, onTabClose }: NoteTabsProps) => {
  if (openNotes.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a] overflow-x-auto scrollbar-hide">
      {openNotes.map((note) => (
        <div
          key={note.id}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors cursor-pointer min-w-[120px] max-w-[200px] ${
            activeNoteId === note.id
              ? 'bg-[#1a1a1a] text-[#e5e5e5]'
              : 'bg-[#0a0a0a] text-[#888888] hover:bg-[#151515] hover:text-[#e5e5e5]'
          }`}
          onClick={() => onTabClick(note.id)}
        >
          <span className="text-sm truncate flex-1">{note.title || 'Untitled'}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(note.id);
            }}
            className="opacity-0 group-hover:opacity-100 hover:bg-[#2a2a2a] rounded p-0.5 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
