import { db, generateUUID, type Note, type Folder, type OutboxItem } from './db';
import { supabase } from './supabase';

/**
 * Data access layer - all CRUD operations go through IndexedDB
 * Changes are queued in outbox for sync to Supabase
 */

// ==================== NOTES ====================

export async function createNote(
  userId: string,
  dashboardId: string | null,
  folderId: string | null = null
): Promise<Note> {
  const now = new Date().toISOString();
  const note: Note = {
    id: generateUUID(),
    title: 'Untitled Note',
    content: '',
    user_id: userId,
    folder_id: folderId,
    dashboard_id: dashboardId,
    created_at: now,
    updated_at: now,
    emoji: null,
    drawing_data: null,
    is_starred: false,
    synced: false,
  };

  // Write to IndexedDB
  await db.notes.add(note);
  console.log('📝 Created note in IndexedDB:', note.id);

  // Queue for sync
  await queueSync('note', note.id, 'upsert', {
    id: note.id,
    title: note.title,
    content: note.content,
    user_id: note.user_id,
    folder_id: note.folder_id,
    dashboard_id: note.dashboard_id,
    emoji: note.emoji,
    drawing_data: note.drawing_data,
    is_starred: note.is_starred,
  });

  return note;
}

export async function updateNote(noteId: string, updates: Partial<Note>): Promise<void> {
  const now = new Date().toISOString();
  const updatedFields = { ...updates, updated_at: now, synced: false };

  // Update in IndexedDB
  await db.notes.update(noteId, updatedFields);
  console.log('💾 Updated note in IndexedDB:', noteId);

  // Get full note for sync
  const note = await db.notes.get(noteId);
  if (!note) return;

  // Queue for sync (only sync fields that Supabase expects)
  await queueSync('note', noteId, 'upsert', {
    id: note.id,
    title: note.title,
    content: note.content,
    user_id: note.user_id,
    folder_id: note.folder_id,
    dashboard_id: note.dashboard_id,
    emoji: note.emoji,
    drawing_data: note.drawing_data,
    is_starred: note.is_starred,
    updated_at: note.updated_at,
  });
}

export async function deleteNote(noteId: string): Promise<void> {
  // Delete from IndexedDB
  await db.notes.delete(noteId);
  console.log('🗑️ Deleted note from IndexedDB:', noteId);

  // Queue for sync
  await queueSync('note', noteId, 'delete', { id: noteId });
}

export async function getNote(noteId: string): Promise<Note | undefined> {
  return await db.notes.get(noteId);
}

export async function getNotesByDashboard(dashboardId: string): Promise<Note[]> {
  return await db.notes
    .where('dashboard_id')
    .equals(dashboardId)
    .reverse()
    .sortBy('updated_at');
}

export async function getAllNotes(userId: string): Promise<Note[]> {
  return await db.notes
    .where('user_id')
    .equals(userId)
    .reverse()
    .sortBy('updated_at');
}

// ==================== FOLDERS ====================

export async function createFolder(
  userId: string,
  dashboardId: string | null,
  name: string = 'New folder',
  parentId: string | null = null
): Promise<Folder> {
  const now = new Date().toISOString();
  const folder: Folder = {
    id: generateUUID(),
    name,
    emoji: null,
    user_id: userId,
    parent_id: parentId,
    dashboard_id: dashboardId,
    created_at: now,
    updated_at: now,
    synced: false,
};

  // Write to IndexedDB
  await db.folders.add(folder);
  console.log('📁 Created folder in IndexedDB:', folder.id);

  // Queue for sync
  await queueSync('folder', folder.id, 'upsert', {
    id: folder.id,
    name: folder.name,
    user_id: folder.user_id,
    parent_id: folder.parent_id,
    dashboard_id: folder.dashboard_id,
  });

  return folder;
}

export async function updateFolder(folderId: string, updates: Partial<Folder>): Promise<void> {
  const now = new Date().toISOString();
  const updatedFields = { ...updates, updated_at: now, synced: false };

  // Update in IndexedDB
  await db.folders.update(folderId, updatedFields);
  console.log('💾 Updated folder in IndexedDB:', folderId);

  // Get full folder for sync
  const folder = await db.folders.get(folderId);
  if (!folder) return;

  // Queue for sync
  await queueSync('folder', folderId, 'upsert', {
    id: folder.id,
    name: folder.name,
    user_id: folder.user_id,
    parent_id: folder.parent_id,
    dashboard_id: folder.dashboard_id,
    updated_at: folder.updated_at,
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  // Delete from IndexedDB
  await db.folders.delete(folderId);
  console.log('🗑️ Deleted folder from IndexedDB:', folderId);

  // Queue for sync
  await queueSync('folder', folderId, 'delete', { id: folderId });
}

export async function getFoldersByDashboard(dashboardId: string): Promise<Folder[]> {
  return await db.folders
    .where('dashboard_id')
    .equals(dashboardId)
    .sortBy('name');
}

// ==================== SYNC QUEUE ====================

async function queueSync(
  entityType: 'note' | 'folder',
  entityId: string,
  operation: 'upsert' | 'delete',
  payload: any
): Promise<void> {
  const outboxItem: OutboxItem = {
    id: generateUUID(),
    entityType,
    entityId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await db.outbox.add(outboxItem);
  console.log('📤 Queued for sync:', entityType, entityId, operation);
}

// ==================== INITIAL SYNC ====================

/**
 * Pull all data from Supabase and populate IndexedDB
 * Called on first load or when cache is empty
 */
export async function initialSync(userId: string): Promise<void> {
  if (!navigator.onLine) {
    console.log('📴 Offline - skipping initial sync');
    return;
  }

  console.log('🔄 Starting initial sync from Supabase...');

  try {
    // Fetch all notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId);

    if (notesError) throw notesError;

    if (notes && notes.length > 0) {
      // Clear existing notes and add fresh data
      await db.notes.clear();
      for (const note of notes) {
        await db.notes.add({ ...note, synced: true });
      }
      console.log('✅ Synced', notes.length, 'notes from Supabase');
    }

    // Fetch all folders
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId);

    if (foldersError) throw foldersError;

    if (folders && folders.length > 0) {
      await db.folders.clear();
      for (const folder of folders) {
        await db.folders.add({ ...folder, synced: true });
      }
      console.log('✅ Synced', folders.length, 'folders from Supabase');
    }

    console.log('✅ Initial sync complete');
  } catch (error) {
    console.error('❌ Initial sync failed:', error);
  }
}
