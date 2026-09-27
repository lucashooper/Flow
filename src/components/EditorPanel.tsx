import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import type { Note } from '../types';
import { TiptapEditor } from './TiptapEditor';
import { useFocusMode } from '../contexts/FocusModeContext';
import { getNote } from '../lib/dataAccess';

interface EditorPanelProps {
  note: Note | undefined;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
  searchQuery?: string;
}

export const EditorPanel = ({ note, onNoteUpdate, searchQuery }: EditorPanelProps) => {
  const { isFullscreen } = useFocusMode();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [drawingData, setDrawingData] = useState<string>('');
  const [loadedNoteId, setLoadedNoteId] = useState<string | undefined>(undefined);
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isHydratedRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsByNote = useRef<Map<string, number>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Sync local editor state BEFORE child mounts (avoids empty editor flash)
  if (note && note.id !== loadedNoteId) {
    setLoadedNoteId(note.id);
    setTitle(note.title);
    setContent(note.content || '');
    setDrawingData(note.drawing_data || '');
    isHydratedRef.current = false;
  }

  useLayoutEffect(() => {
    if (!note) {
      setLoadedNoteId(undefined);
      isHydratedRef.current = false;
      return;
    }

    isHydratedRef.current = true;

    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const savedPosition = scrollPositionsByNote.current.get(note.id) || 0;
        scrollContainerRef.current.scrollTop = savedPosition;
      }
    });

    // Re-read from IndexedDB — source of truth
    void getNote(note.id).then((stored) => {
      if (!stored || stored.id !== note.id) return;
      const storedContent = stored.content || '';
      if (storedContent.length > (note.content?.length ?? 0)) {
        console.log('📝 Loaded content from IndexedDB:', storedContent.length, 'chars');
        setContent(storedContent);
      }
      if (stored.title !== title) setTitle(stored.title);
      if ((stored.drawing_data || '') !== drawingData) {
        setDrawingData(stored.drawing_data || '');
      }
    });
  }, [note?.id]);

  // Save scroll position when scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !loadedNoteId) return;

    const handleScroll = () => {
      if (loadedNoteId) {
        scrollPositionsByNote.current.set(loadedNoteId, container.scrollTop);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loadedNoteId]);

  // Handle container resize
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      if (loadedNoteId) {
        const savedPosition = scrollPositionsByNote.current.get(loadedNoteId) || 0;
        if (savedPosition > 0 && Math.abs(container.scrollTop - savedPosition) > 10) {
          container.scrollTop = savedPosition;
        }
      }
    });

    resizeObserverRef.current.observe(container);
    return () => resizeObserverRef.current?.disconnect();
  }, [loadedNoteId]);

  // Auto-save (only after hydrated)
  useEffect(() => {
    if (!note || !isHydratedRef.current || note.id !== loadedNoteId) return;

    if (title !== note.title || content !== note.content || drawingData !== (note.drawing_data || '')) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(() => {
        // Never save empty content over a note that had content
        if (!content.trim() && (note.content?.trim()?.length ?? 0) > 0) {
          console.warn('⏭️ Skipping save — would wipe existing note content');
          return;
        }
        console.log('💾 Auto-saving note...');
        onNoteUpdate(note.id, { title, content, drawing_data: drawingData });
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, drawingData, note, loadedNoteId, onNoteUpdate]);

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
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 flex flex-col editor-background editor-root overflow-y-auto custom-scrollbar"
    >
      <div className="pt-6 pb-4 editor-header flex-shrink-0 px-8">
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <input
            type="text"
            value={title || ''}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={isFullscreen}
            tabIndex={isFullscreen ? -1 : 0}
            onKeyDown={(e) => {
              if (isFullscreen) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                const editorElement = document.querySelector('.ProseMirror');
                if (editorElement) (editorElement as HTMLElement).focus();
              }
            }}
            placeholder="Untitled"
            className="w-full bg-transparent text-3xl font-bold focus:outline-none border-none"
            style={{ color: 'var(--text)', lineHeight: '1.2', padding: 0 }}
          />
        </div>
      </div>

      <div className="flex-shrink-0">
        {loadedNoteId === note.id && (
          <TiptapEditor
            key={note.id}
            content={content}
            onChange={setContent}
            drawingData={drawingData}
            noteTitle={title}
            onDrawingChange={setDrawingData}
            placeholder="Start writing..."
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
};
