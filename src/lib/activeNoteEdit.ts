/** Tracks the note currently being edited so sync/reconcile must not clobber it. */
let activeNoteId: string | null = null;
let activeEditRevision = 0;

export function setActiveNoteEdit(noteId: string | null): void {
  activeNoteId = noteId;
  if (!noteId) activeEditRevision = 0;
}

export function bumpActiveNoteEditRevision(): void {
  if (activeNoteId) activeEditRevision += 1;
}

export function getActiveNoteEdit(): { noteId: string | null; revision: number } {
  return { noteId: activeNoteId, revision: activeEditRevision };
}

export function isActiveNote(noteId: string): boolean {
  return activeNoteId === noteId;
}
