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
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note?.id]);

  // Auto-save with debounce
  useEffect(() => {
    if (!note) return;

    if (title !== note.title || content !== note.content) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        onNoteUpdate(note.id, { title, content });
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, note]);

  if (!note) {
    return (
      <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#888888] text-lg mb-2">No note selected</div>
          <div className="text-[#666666] text-sm">Select a note from the sidebar or create a new one</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Editor Header */}
      <div className="border-b border-[#2a2a2a] py-4">
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

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        <TiptapEditor
          content={content}
          onChange={setContent}
          placeholder="Start writing..."
        />
      </div>
    </div>
  );
};
