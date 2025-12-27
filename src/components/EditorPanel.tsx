import { useState, useEffect, useRef } from 'react';
import type { Note } from '../types';
import { TiptapEditor } from './TiptapEditor';

interface EditorPanelProps {
  note: Note | undefined;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
  searchQuery?: string;
}

export const EditorPanel = ({ note, onNoteUpdate, searchQuery }: EditorPanelProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [drawingData, setDrawingData] = useState<string>('');
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const currentNoteIdRef = useRef<string | undefined>(undefined);
  
  console.log('📝 [EditorPanel] Received searchQuery:', searchQuery, 'for note:', note?.title);

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
    <div className="flex-1 min-h-0 flex flex-col editor-background editor-root overflow-y-auto custom-scrollbar">
      {/* Editor Header - fixed at top, scrolls with content */}
      <div className="pt-6 pb-4 editor-header flex-shrink-0 px-8">
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => {
            const text = e.currentTarget.textContent || '';
            setTitle(text);
          }}
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
          className="w-full bg-transparent text-3xl font-bold focus:outline-none"
          style={{
            color: 'var(--text)',
            lineHeight: '1.2',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            minHeight: '1.2em',
          }}
          dangerouslySetInnerHTML={{ __html: title || '<span style="color: #666666;">Untitled</span>' }}
        />
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-shrink-0">
        <TiptapEditor
          content={content}
          onChange={setContent}
          drawingData={drawingData}
          onDrawingChange={setDrawingData}
          placeholder="Start writing..."
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
};
