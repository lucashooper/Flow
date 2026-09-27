import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import type { Note } from '../types';
import { TiptapEditor } from './TiptapEditor';
import { NoteSaveStatus } from './NoteSaveStatus';
import { useFocusMode } from '../contexts/FocusModeContext';
import { getNote } from '../lib/dataAccess';
import { getEditorContentMaxWidth } from '../utils/editorLayout';
import {
  saveNoteDraft,
  loadNoteDraft,
  clearNoteDraft,
  resolveNoteContent,
  emitNoteSaveStatus,
} from '../lib/noteDrafts';

const SYNC_DEBOUNCE_MS = 1500;

interface EditorPanelProps {
  note: Note | undefined;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void | Promise<void>;
  searchQuery?: string;
}

export const EditorPanel = ({ note, onNoteUpdate, searchQuery }: EditorPanelProps) => {
  const { isFullscreen } = useFocusMode();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [drawingData, setDrawingData] = useState<string>('');
  const [loadedNoteId, setLoadedNoteId] = useState<string | undefined>(undefined);
  const [contentReady, setContentReady] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [editorMaxWidth, setEditorMaxWidth] = useState(() => getEditorContentMaxWidth());

  const syncTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const draftWriteRef = useRef<Promise<void>>(Promise.resolve());
  const isHydratedRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const pendingSyncRef = useRef<{ title: string; content: string; drawing_data: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsByNote = useRef<Map<string, number>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const flushSync = useCallback(
    async (noteId: string, payload: { title: string; content: string; drawing_data: string }) => {
      if (!payload.content.trim()) {
        const stored = await getNote(noteId);
        if ((stored?.content?.trim()?.length ?? 0) > 0) {
          console.warn('⏭️ Skipping sync — would wipe existing note content');
          return;
        }
      }

      console.log('[LocalSync] pushing to IndexedDB', {
        noteId,
        contentLen: payload.content.length,
        titleLen: payload.title.length,
      });
      emitNoteSaveStatus(noteId, 'syncing', 'Syncing…');
      try {
        await onNoteUpdate(noteId, payload);
        await clearNoteDraft(noteId);
        console.log('[LocalSync] cloud sync complete', { noteId });
        emitNoteSaveStatus(noteId, 'cloud', 'Saved to cloud');
      } catch (error) {
        console.error('Note sync failed:', error);
        emitNoteSaveStatus(noteId, 'failed', 'Sync failed (retrying)');
        setTimeout(() => {
          void (async () => {
            emitNoteSaveStatus(noteId, 'syncing', 'Syncing…');
            try {
              await onNoteUpdate(noteId, payload);
              await clearNoteDraft(noteId);
              emitNoteSaveStatus(noteId, 'cloud', 'Saved to cloud');
            } catch (retryErr) {
              console.error('Note sync retry failed:', retryErr);
              emitNoteSaveStatus(noteId, 'failed', 'Sync failed (retrying)');
            }
          })();
        }, 3000);
      }
    },
    [onNoteUpdate],
  );

  const scheduleSync = useCallback(
    (noteId: string, payload: { title: string; content: string; drawing_data: string }) => {
      pendingSyncRef.current = payload;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        void flushSync(noteId, payload);
        pendingSyncRef.current = null;
      }, SYNC_DEBOUNCE_MS);
    },
    [flushSync],
  );

  const persistDraftImmediately = useCallback(
    (noteId: string, payload: { title: string; content: string; drawing_data: string }) => {
      draftWriteRef.current = draftWriteRef.current
        .then(async () => {
          await saveNoteDraft(noteId, payload);
        })
        .catch((err) => console.error('Draft save failed:', err));
    },
    [],
  );

  useEffect(() => {
    const syncWidth = () => setEditorMaxWidth(getEditorContentMaxWidth());
    window.addEventListener('pluginSettingsChanged', syncWidth);
    window.addEventListener('storage', syncWidth);
    return () => {
      window.removeEventListener('pluginSettingsChanged', syncWidth);
      window.removeEventListener('storage', syncWidth);
    };
  }, []);

  // Sync local editor state BEFORE child mounts (avoids empty editor flash)
  if (note && note.id !== loadedNoteId) {
    setLoadedNoteId(note.id);
    setTitle(note.title);
    setContent(note.content || '');
    setDrawingData(note.drawing_data || '');
    setContentReady(false);
    setRestoredFromDraft(false);
    isHydratedRef.current = false;
    hasUserEditedRef.current = false;
  }

  useLayoutEffect(() => {
    if (!note) {
      setLoadedNoteId(undefined);
      setContentReady(false);
      isHydratedRef.current = false;
      return;
    }

    let cancelled = false;

    void (async () => {
      const [draft, stored] = await Promise.all([
        loadNoteDraft(note.id),
        getNote(note.id),
      ]);

      if (cancelled) return;

      if (!hasUserEditedRef.current) {
        const resolved = resolveNoteContent(
          draft,
          stored ?? null,
          {
            title: note.title,
            content: note.content || '',
            drawing_data: note.drawing_data || '',
            updated_at: note.updated_at,
          },
        );

        setTitle(resolved.title);
        setContent(resolved.content);
        setDrawingData(resolved.drawing_data);
        setRestoredFromDraft(resolved.restoredFromDraft);

        if (resolved.restoredFromDraft && draft) {
          console.log('📝 Restored newer local draft:', draft.savedAt);
          scheduleSync(note.id, {
            title: resolved.title,
            content: resolved.content,
            drawing_data: resolved.drawing_data,
          });
        }
      }

      setContentReady(true);
      isHydratedRef.current = true;
    })();

    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const savedPosition = scrollPositionsByNote.current.get(note.id) || 0;
        scrollContainerRef.current.scrollTop = savedPosition;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [note?.id, scheduleSync]);

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

  // Local-first auto-save: immediate draft + debounced IndexedDB/sync
  useEffect(() => {
    if (!note || !isHydratedRef.current || note.id !== loadedNoteId || !contentReady) return;

    const changed =
      title !== note.title ||
      content !== note.content ||
      drawingData !== (note.drawing_data || '');

    if (!changed) return;

    hasUserEditedRef.current = true;
    const payload = { title, content, drawing_data: drawingData };

    persistDraftImmediately(note.id, payload);
    scheduleSync(note.id, payload);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [
    title,
    content,
    drawingData,
    note,
    loadedNoteId,
    contentReady,
    persistDraftImmediately,
    scheduleSync,
  ]);

  // Flush pending sync on unmount or note switch
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      const pending = pendingSyncRef.current;
      const noteId = loadedNoteId;
      if (pending && noteId) {
        void draftWriteRef.current.then(() => flushSync(noteId, pending));
      }
    };
  }, [loadedNoteId, flushSync]);

  const handleContentChange = useCallback((next: string) => {
    hasUserEditedRef.current = true;
    setContent(next);
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    hasUserEditedRef.current = true;
    setTitle(e.target.value);
  }, []);

  const handleDrawingChange = useCallback((data: string) => {
    hasUserEditedRef.current = true;
    setDrawingData(data);
  }, []);

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
        <div style={{ maxWidth: `${editorMaxWidth}px`, margin: '0 auto', width: '100%' }}>
          <input
            type="text"
            value={title || ''}
            onChange={handleTitleChange}
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
          <NoteSaveStatus noteId={note.id} restoredFromDraft={restoredFromDraft} />
        </div>
      </div>

      <div className="flex-shrink-0">
        {loadedNoteId === note.id && !contentReady && (
          <div
            className="flex items-center justify-center py-16"
            style={{ maxWidth: `${editorMaxWidth}px`, margin: '0 auto' }}
          >
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading note…
            </div>
          </div>
        )}
        {loadedNoteId === note.id && contentReady && (
          <TiptapEditor
            key={note.id}
            content={content}
            onChange={handleContentChange}
            drawingData={drawingData}
            noteTitle={title}
            onDrawingChange={handleDrawingChange}
            placeholder="Start writing..."
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
};
