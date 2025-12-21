import { useState, useEffect, useRef } from 'react';
import type { Note } from '../types';
import { TiptapEditor } from './TiptapEditor';

interface EditorPanelProps {
  note: Note | undefined;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
}

export const EditorPanel = ({ note, onNoteUpdate }: EditorPanelProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [drawingData, setDrawingData] = useState<string>('');
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const currentNoteIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Only update state if the note ID actually changed (switching notes)
    // This prevents unnecessary re-renders when tabbing away and back
    if (note && note.id !== currentNoteIdRef.current) {
      console.log('📝 Switching to note:', note.id);
      currentNoteIdRef.current = note.id;
      setTitle(note.title);
      setContent(note.content);
      setDrawingData(note.drawing_data || '');
    }
  }, [note?.id]);

  // Auto-save with debounce
  useEffect(() => {
    if (!note) return;

    if (title !== note.title || content !== note.content || drawingData !== (note.drawing_data || '')) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        console.log('💾 Auto-saving note with drawing data...');
        onNoteUpdate(note.id, { title, content, drawing_data: drawingData });
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, drawingData, note]);

  if (!note) {
    return (
      <div className="flex-1 editor-root flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#888888] text-lg mb-2">No note selected</div>
          <div className="text-[#666666] text-sm">Select a note from the sidebar or create a new one</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col editor-background editor-root overflow-hidden">
      {/* Editor Header */}
      <div className="pt-6 pb-4 editor-header flex-shrink-0">
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem', width: '100%' }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Focus the editor content
              const editorElement = document.querySelector('.ProseMirror');
              if (editorElement) {
                (editorElement as HTMLElement).focus();
              }
            }
          }}
          placeholder="Untitled"
          className="w-full bg-transparent text-3xl font-bold text-[#e5e5e5] focus:outline-none placeholder-[#666666] focus:ring-0 focus:border-transparent"
        />
        </div>
      </div>

      {/* Editor Content - scroll container starts here */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <TiptapEditor
          content={content}
          onChange={setContent}
          drawingData={drawingData}
          onDrawingChange={setDrawingData}
          placeholder="Start writing..."
        />
      </div>
    </div>
  );
};
