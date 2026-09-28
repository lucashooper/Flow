import { db, generateUUID, type Note, type Folder, type OutboxItem } from './db';
import { supabase } from './supabase';
import { fetchAllRemoteFolders, fetchAllRemoteNotes, meaningfulContentLength } from './syncHealth';
import { sanitizeFolderPayload, sanitizeNotePayload, sanitizeSyncPayload } from './syncPayloads';

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
  await queueSync('note', note.id, 'upsert', sanitizeNotePayload({
    id: note.id,
    title: note.title,
    content: note.content,
    user_id: note.user_id,
    folder_id: note.folder_id,
    dashboard_id: note.dashboard_id,
    emoji: note.emoji,
    drawing_data: note.drawing_data,
    is_starred: note.is_starred,
    created_at: note.created_at,
    updated_at: note.updated_at,
  }));

  return note;
}

export async function updateNote(noteId: string, updates: Partial<Note>): Promise<void> {
  const existing = await db.notes.get(noteId);
  if (existing) {
    const nextContent = updates.content ?? existing.content;
    const oldLen = meaningfulContentLength(existing.content);
    const newLen = meaningfulContentLength(nextContent);

    if (oldLen > 100 && newLen < 20) {
      console.warn('[NoteGuard] Blocked accidental content wipe', {
        noteId,
        title: existing.title,
        oldLen,
        newLen,
      });
      const safeUpdates = { ...updates };
      delete safeUpdates.content;
      if (Object.keys(safeUpdates).length === 0) return;
      updates = safeUpdates;
    }

    if (
      updates.title !== undefined &&
      updates.title !== existing.title &&
      oldLen > 100 &&
      newLen < 20
    ) {
      console.warn('[NoteGuard] Blocked suspicious title overwrite during content wipe', {
        noteId,
        from: existing.title,
        to: updates.title,
      });
      return;
    }
  }

  const now = new Date().toISOString();
  const updatedFields = { ...updates, updated_at: now, synced: false };

  // Update in IndexedDB
  await db.notes.update(noteId, updatedFields);
  console.log('💾 Updated note in IndexedDB:', noteId);

  // Get full note for sync
  const note = await db.notes.get(noteId);
  if (!note) return;

  // Queue for sync (only sync fields that Supabase expects)
  await queueSync('note', noteId, 'upsert', sanitizeNotePayload({
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
  }));
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
  const notes = await db.notes
    .where('dashboard_id')
    .equals(dashboardId)
    .toArray();
  
  // Sort by position if available, otherwise by updated_at
  return notes.sort((a, b) => {
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
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
    icon_url: null,
    is_starred: false,
    user_id: userId,
    parent_id: parentId,
    dashboard_id: dashboardId,
    created_at: now,
    updated_at: now,
    position: 0,
    synced: false,
  };

  // Write to IndexedDB
  await db.folders.add(folder);
  console.log('📁 Created folder in IndexedDB:', folder.id);

  // Queue for sync (include all fields so Supabase gets a complete row)
  await queueSync('folder', folder.id, 'upsert', sanitizeFolderPayload({
    id: folder.id,
    name: folder.name,
    emoji: folder.emoji,
    icon_url: folder.icon_url,
    is_starred: folder.is_starred,
    user_id: folder.user_id,
    parent_id: folder.parent_id,
    dashboard_id: folder.dashboard_id,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
  }));

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

  // Queue for sync (include all mutable fields so no data is lost)
  await queueSync('folder', folderId, 'upsert', sanitizeFolderPayload({
    id: folder.id,
    name: folder.name,
    emoji: folder.emoji,
    icon_url: folder.icon_url,
    is_starred: folder.is_starred,
    user_id: folder.user_id,
    parent_id: folder.parent_id,
    dashboard_id: folder.dashboard_id,
    updated_at: folder.updated_at,
  }));
}

export async function deleteFolder(folderId: string): Promise<void> {
  // Delete from IndexedDB
  await db.folders.delete(folderId);
  console.log('🗑️ Deleted folder from IndexedDB:', folderId);

  // Queue for sync
  await queueSync('folder', folderId, 'delete', { id: folderId });
}

export async function getFoldersByDashboard(dashboardId: string): Promise<Folder[]> {
  const folders = await db.folders
    .where('dashboard_id')
    .equals(dashboardId)
    .toArray();
  
  // Sort by position if available, otherwise by name
  return folders.sort((a, b) => {
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return a.name.localeCompare(b.name);
  });
}

// ==================== SYNC QUEUE ====================

async function queueSync(
  entityType: 'note' | 'folder',
  entityId: string,
  operation: 'upsert' | 'delete',
  payload: any
): Promise<void> {
  // Deduplicate: if there's already a pending upsert for this entity,
  // replace its payload with the latest data instead of adding a duplicate.
  // This prevents stale data (e.g. old folder name) from overwriting newer changes.
  if (operation === 'upsert') {
    const existing = await db.outbox
      .where('entityId')
      .equals(entityId)
      .filter(item => item.entityType === entityType && item.operation === 'upsert')
      .first();

    if (existing) {
      await db.outbox.update(existing.id, {
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
      });
      console.log('📤 Updated existing outbox entry for:', entityType, entityId);
      return;
    }
  }

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

  // Push to server immediately when online (don't wait for 60s interval)
  if (navigator.onLine) {
    window.dispatchEvent(new Event('requestSync'));
  }
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
    // STEP 1: Push any pending outbox items to server FIRST
    // This ensures local renames etc. aren't lost when we pull fresh data
    const outboxItems = await db.outbox.toArray();
    if (outboxItems.length > 0) {
      console.log('📤 Pushing', outboxItems.length, 'pending outbox items before initial sync...');
      for (const item of outboxItems) {
        try {
          if (item.operation === 'upsert') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            const payload = sanitizeSyncPayload(item.entityType, item.payload);
            const { error } = await supabase.from(table).upsert(payload);
            if (!error) {
              await db.outbox.delete(item.id);
              console.log('✅ Pushed outbox item:', item.entityType, item.entityId);
            }
          } else if (item.operation === 'delete') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            const { error } = await supabase.from(table).delete().eq('id', item.entityId);
            if (!error) {
              await db.outbox.delete(item.id);
            }
          }
        } catch (e) {
          console.error('❌ Failed to push outbox item:', item.id, e);
        }
      }
    }

    // STEP 2: Pull fresh data from Supabase (paginated — API default limit is 1000 rows)
    const notes = await fetchAllRemoteNotes(userId);
    const folders = await fetchAllRemoteFolders(userId);

    if (notes.length > 0) {
      await db.notes.clear();
      for (const note of notes) {
        await db.notes.add({ ...(note as Note), synced: true });
      }
      console.log('✅ Synced', notes.length, 'notes from Supabase');
    }

    if (folders.length > 0) {
      await db.folders.clear();
      for (const folder of folders) {
        await db.folders.add({ ...(folder as Folder), synced: true });
      }
      console.log('✅ Synced', folders.length, 'folders from Supabase');
    }

    console.log('✅ Initial sync complete');
  } catch (error) {
    console.error('❌ Initial sync failed:', error);
  }
}

/**
 * Force a full re-sync: clear local IndexedDB cache and pull everything fresh from Supabase.
 * Default mode downloads from cloud WITHOUT uploading local changes first (safe for recovery).
 */
export async function forceResync(
  userId: string,
  options?: { uploadLocalFirst?: boolean },
): Promise<void> {
  if (!navigator.onLine) {
    console.log('📴 Offline - cannot force resync');
    return;
  }

  const uploadLocalFirst = options?.uploadLocalFirst ?? false;
  console.log(`🔄 Force resync (${uploadLocalFirst ? 'upload then download' : 'download only'})...`);

  try {
    if (uploadLocalFirst) {
      const outboxItems = await db.outbox.toArray();
      for (const item of outboxItems) {
        try {
          if (item.operation === 'upsert') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            const payload = sanitizeSyncPayload(item.entityType, item.payload);
            await supabase.from(table).upsert(payload);
          } else if (item.operation === 'delete') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            await supabase.from(table).delete().eq('id', item.entityId);
          }
          await db.outbox.delete(item.id);
        } catch (e) {
          console.error('Failed to push:', e);
        }
      }
    } else {
      await db.outbox.clear();
    }

    await db.notes.clear();
    await db.folders.clear();

    const notes = await fetchAllRemoteNotes(userId);
    const folders = await fetchAllRemoteFolders(userId);

    for (const note of notes) {
      await db.notes.add({ ...(note as Note), synced: true });
    }

    for (const folder of folders) {
      await db.folders.add({ ...(folder as Folder), synced: true });
    }

    console.log('✅ Force resync complete', { notes: notes.length, folders: folders.length });
  } catch (error) {
    console.error('❌ Force resync failed:', error);
    throw error;
  }
}
