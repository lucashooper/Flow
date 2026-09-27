import { db } from './db';

export interface NoteDraft {
  noteId: string;
  title: string;
  content: string;
  drawing_data: string;
  savedAt: string;
}

export type NoteSavePhase = 'idle' | 'local' | 'syncing' | 'cloud' | 'failed';

const draftKey = (noteId: string) => `flow_note_draft_${noteId}`;

export function emitNoteSaveStatus(
  noteId: string,
  phase: NoteSavePhase,
  message?: string,
): void {
  window.dispatchEvent(
    new CustomEvent('noteSaveStatus', { detail: { noteId, phase, message } }),
  );
}

/** Immediately persist editor state to IndexedDB (no debounce). */
export async function saveNoteDraft(
  noteId: string,
  data: Pick<NoteDraft, 'title' | 'content' | 'drawing_data'>,
): Promise<string> {
  const savedAt = new Date().toISOString();
  const payload: NoteDraft = { noteId, ...data, savedAt };

  await db.meta.put({
    key: draftKey(noteId),
    value: JSON.stringify(payload),
  });

  console.log('[LocalSync] draft saved', {
    noteId,
    savedAt,
    titleLen: data.title.length,
    contentLen: data.content.length,
    drawingLen: data.drawing_data.length,
  });

  // Debounced in NoteSaveStatus — avoid emitting on every keystroke
  emitNoteSaveStatus(noteId, 'local', 'Saved to local');
  return savedAt;
}

export async function loadNoteDraft(noteId: string): Promise<NoteDraft | null> {
  const row = await db.meta.get(draftKey(noteId));
  if (!row?.value) return null;

  try {
    const parsed = JSON.parse(row.value) as NoteDraft;
    if (!parsed?.noteId || parsed.noteId !== noteId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearNoteDraft(noteId: string): Promise<void> {
  await db.meta.delete(draftKey(noteId));
}

/** True when draft is strictly newer than the best known remote/IDB timestamp. */
export function isDraftNewerThan(
  draft: NoteDraft,
  remoteUpdatedAt: string | null | undefined,
): boolean {
  const draftMs = new Date(draft.savedAt).getTime();
  if (!remoteUpdatedAt) return draftMs > 0;
  return draftMs > new Date(remoteUpdatedAt).getTime();
}

/** Pick the best content source: draft vs IndexedDB note vs React prop. */
export function resolveNoteContent(
  draft: NoteDraft | null,
  stored: { title: string; content: string; drawing_data?: string | null; updated_at: string } | null,
  prop: { title: string; content: string; drawing_data?: string | null; updated_at: string },
): {
  title: string;
  content: string;
  drawing_data: string;
  restoredFromDraft: boolean;
} {
  const propUpdated = prop.updated_at ?? '';
  const storedUpdated = stored?.updated_at ?? '';
  const bestRemoteMs = Math.max(
    propUpdated ? new Date(propUpdated).getTime() : 0,
    storedUpdated ? new Date(storedUpdated).getTime() : 0,
  );

  if (draft && isDraftNewerThan(draft, new Date(bestRemoteMs).toISOString())) {
    return {
      title: draft.title,
      content: draft.content,
      drawing_data: draft.drawing_data || '',
      restoredFromDraft: true,
    };
  }

  if (stored) {
    return {
      title: stored.title,
      content: stored.content || '',
      drawing_data: stored.drawing_data || '',
      restoredFromDraft: false,
    };
  }

  return {
    title: prop.title,
    content: prop.content || '',
    drawing_data: prop.drawing_data || '',
    restoredFromDraft: false,
  };
}
