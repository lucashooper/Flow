import { X, FileText } from 'lucide-react';
import type { Note } from '../types';

interface EditorHeaderProps {
  openNotes: Note[];
  activeNoteId: string | null;
  tabsEnabled: boolean;
  onTabClick: (noteId: string) => void;
  onTabClose: (noteId: string) => void;
}

export const EditorHeader = ({ 
  openNotes, 
  activeNoteId, 
  tabsEnabled,
  onTabClick, 
  onTabClose 
}: EditorHeaderProps) => {
  return (
    <div className="bg-[#151515] border-b border-[#2a2a2a] px-4 py-2 flex items-center gap-4">
      {/* Left side - File icon */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#888888]" />
      </div>

      {/* Tabs area */}
      {tabsEnabled && openNotes.length > 0 && (
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {openNotes.map((note) => (
            <div
              key={note.id}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors cursor-pointer min-w-[120px] max-w-[200px] ${
                activeNoteId === note.id
                  ? 'bg-[#1a1a1a] text-[#e5e5e5]'
                  : 'bg-[#151515] text-[#888888] hover:bg-[#1a1a1a] hover:text-[#e5e5e5]'
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
      )}
    </div>
  );
};
