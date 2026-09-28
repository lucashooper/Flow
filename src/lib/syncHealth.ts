import { db, type Folder, type Note } from './db';
import { supabase } from './supabase';
import { clearNoteDraft } from './noteDrafts';
import { isActiveNote } from './activeNoteEdit';

/** Strip HTML and measure meaningful text length. */
export function meaningfulContentLength(content: string | null | undefined): number {
  if (!content) return 0;
  const text = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length > 0 ? text.length : content.trim().length;
}

/** Heuristic: many notes share one title and are empty — likely a save race wiped them. */
export function detectNotesCorruption(notes: Array<{ title: string; content?: string | null }>): boolean {
  if (notes.length < 2) return false;

  const groups = new Map<string, number>();
  for (const note of notes) {
    const title = note.title?.trim();
    if (!title || title === 'Untitled Note') continue;
    groups.set(title, (groups.get(title) || 0) + 1);
  }

  for (const [title, count] of groups) {
    if (count < 2) continue;
    const affected = notes.filter((n) => n.title?.trim() === title);
    const mostlyEmpty = affected.filter((n) => meaningfulContentLength(n.content) < 40).length;
    if (mostlyEmpty >= 2 && mostlyEmpty === affected.length) {
      return true;
    }
  }

  return false;
}

/**
 * Restore notes from Supabase when local copies were wiped but cloud still has content.
 * Clears pending note outbox uploads first so bad local data is not re-pushed.
 */
export async function recoverWipedNotesFromServer(
  userId: string,
): Promise<{ restored: number; examined: number }> {
  const pendingNoteUpserts = await db.outbox
    .filter((item) => item.entityType === 'note' && item.operation === 'upsert')
    .toArray();

  for (const item of pendingNoteUpserts) {
    await db.outbox.delete(item.id);
  }

  if (pendingNoteUpserts.length > 0) {
    console.warn(
      `[Recovery] Cleared ${pendingNoteUpserts.length} pending note upload(s) before cloud restore`,
    );
  }

  const remoteNotes = await fetchAllRemoteNotes(userId);
  let restored = 0;

  for (const remote of remoteNotes) {
    if (isActiveNote(remote.id)) continue;

    const local = await db.notes.get(remote.id);
    const remoteLen = meaningfulContentLength(remote.content);
    const localLen = meaningfulContentLength(local?.content);

    const localMissing = !local;
    const localWiped = localLen < 40 && remoteLen > localLen + 80;
    const serverNewerAndRicher =
      !!local &&
      new Date(remote.updated_at).getTime() > new Date(local.updated_at).getTime() &&
      remoteLen > localLen + 40;

    if (localMissing || localWiped || serverNewerAndRicher) {
      await db.notes.put({ ...remote, synced: true });
      await clearNoteDraft(remote.id);
      restored++;
      console.log('[Recovery] Restored note from cloud:', remote.title, {
        noteId: remote.id,
        remoteLen,
        localLen,
      });
    }
  }

  return { restored, examined: remoteNotes.length };
}

export interface SyncHealthReport {
  localNotes: number;
  localFolders: number;
  serverNotes: number;
  serverFolders: number;
  outboxPending: number;
  unsyncedNotes: number;
  unsyncedFolders: number;
  missingLocally: { notes: number; folders: number };
  healthy: boolean;
  issues: string[];
  pendingUploads: Array<{ entityType: 'note' | 'folder'; entityId: string; name: string; attempts: number }>;
  dashboardBreakdown: Array<{
    dashboardId: string | null;
    dashboardName: string;
    localNotes: number;
    localFolders: number;
    serverNotes: number;
    serverFolders: number;
  }>;
}

export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';

const SUPABASE_PAGE_SIZE = 1000;

export interface CloudRestoreResult {
  notesAdded: number;
  notesUpdated: number;
  notesFetched: number;
  foldersAdded: number;
  foldersUpdated: number;
  foldersFetched: number;
}

export function isSyncAdmin(email: string | undefined): boolean {
  return email === ADMIN_EMAIL;
}

/** Paginate through Supabase — default API limit is 1000 rows. */
export async function fetchAllRemoteNotes(userId: string): Promise<Note[]> {
  const all: Note[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return all;
}

export async function fetchAllRemoteFolders(userId: string): Promise<Folder[]> {
  const all: Folder[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return all;
}

function shouldPreferRemoteNote(
  local: { content?: string | null; updated_at: string },
  remote: { content?: string | null; updated_at: string },
): boolean {
  const remoteLen = meaningfulContentLength(remote.content);
  const localLen = meaningfulContentLength(local.content);
  const serverNewer = new Date(remote.updated_at).getTime() > new Date(local.updated_at).getTime();
  const localWiped = localLen < 40 && remoteLen > localLen + 80;
  return localWiped || (serverNewer && remoteLen >= localLen);
}

/**
 * Download every cloud note/folder (paginated) and merge into IndexedDB.
 * Safe recovery path — does not upload local changes first.
 */
export async function downloadAllFromCloud(userId: string): Promise<CloudRestoreResult> {
  const remoteNotes = await fetchAllRemoteNotes(userId);
  const remoteFolders = await fetchAllRemoteFolders(userId);

  let notesAdded = 0;
  let notesUpdated = 0;
  let foldersAdded = 0;
  let foldersUpdated = 0;

  for (const note of remoteNotes) {
    if (isActiveNote(note.id)) {
      continue;
    }

    const local = await db.notes.get(note.id);

    if (!local) {
      await db.notes.put({ ...note, synced: true });
      notesAdded++;
      continue;
    }

    if (shouldPreferRemoteNote(local, note)) {
      await db.notes.put({ ...note, synced: true });
      await clearNoteDraft(note.id);
      notesUpdated++;
    }
  }

  for (const folder of remoteFolders) {
    const local = await db.folders.get(folder.id);

    if (!local) {
      await db.folders.put({ ...folder, synced: true });
      foldersAdded++;
      continue;
    }

    if (new Date(folder.updated_at).getTime() > new Date(local.updated_at).getTime()) {
      await db.folders.put({ ...folder, synced: true });
      foldersUpdated++;
    }
  }

  console.log('[CloudRestore]', {
    notesFetched: remoteNotes.length,
    notesAdded,
    notesUpdated,
    foldersFetched: remoteFolders.length,
    foldersAdded,
    foldersUpdated,
  });

  return {
    notesAdded,
    notesUpdated,
    notesFetched: remoteNotes.length,
    foldersAdded,
    foldersUpdated,
    foldersFetched: remoteFolders.length,
  };
}

/**
 * Replace local IndexedDB with a full paginated download from Supabase.
 * Clears outbox first so corrupted local uploads are not pushed to cloud.
 */
export async function replaceLocalCacheFromCloud(userId: string): Promise<CloudRestoreResult> {
  await db.outbox.clear();

  const remoteNotes = await fetchAllRemoteNotes(userId);
  const remoteFolders = await fetchAllRemoteFolders(userId);

  await db.notes.clear();
  await db.folders.clear();

  for (const note of remoteNotes) {
    await db.notes.add({ ...note, synced: true });
  }

  for (const folder of remoteFolders) {
    await db.folders.add({ ...folder, synced: true });
  }

  console.log('[CloudRestore] Full replace from cloud', {
    notes: remoteNotes.length,
    folders: remoteFolders.length,
  });

  return {
    notesAdded: remoteNotes.length,
    notesUpdated: 0,
    notesFetched: remoteNotes.length,
    foldersAdded: remoteFolders.length,
    foldersUpdated: 0,
    foldersFetched: remoteFolders.length,
  };
}

/**
 * Merge all server notes/folders into IndexedDB without wiping local data.
 * Adds anything missing locally; updates stale rows when server is newer.
 */
export async function reconcileFromServer(userId: string): Promise<CloudRestoreResult> {
  return downloadAllFromCloud(userId);
}

export async function getSyncHealth(userId: string): Promise<SyncHealthReport> {
  const issues: string[] = [];

  const [localNotes, localFolders, outboxPending, unsyncedNotes, unsyncedFolders] = await Promise.all([
    db.notes.where('user_id').equals(userId).count(),
    db.folders.where('user_id').equals(userId).count(),
    db.outbox.count(),
    db.notes.where('user_id').equals(userId).filter(n => !n.synced).count(),
    db.folders.where('user_id').equals(userId).filter(f => !f.synced).count(),
  ]);

  const [{ count: serverNotes }, { count: serverFolders }] = await Promise.all([
    supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('folders').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const remoteNoteCount = serverNotes ?? 0;
  const remoteFolderCount = serverFolders ?? 0;
  const missingNotes = Math.max(0, remoteNoteCount - localNotes);
  const missingFolders = Math.max(0, remoteFolderCount - localFolders);

  if (outboxPending > 0) issues.push(`${outboxPending} change(s) waiting to upload to Supabase`);
  if (unsyncedNotes > 0) issues.push(`${unsyncedNotes} note(s) not yet confirmed on server`);
  if (unsyncedFolders > 0) issues.push(`${unsyncedFolders} folder(s) not yet confirmed on server`);
  if (missingNotes > 0) issues.push(`${missingNotes} note(s) on cloud missing locally — use "Download all from cloud" or "Replace local cache"`);
  if (missingFolders > 0) issues.push(`${missingFolders} folder(s) on cloud missing locally — use "Download all from cloud" or "Replace local cache"`);
  if (localNotes > remoteNoteCount) issues.push(`${localNotes - remoteNoteCount} note(s) exist locally but not on cloud — use "Retry uploads"`);
  if (localFolders > remoteFolderCount) issues.push(`${localFolders - remoteFolderCount} folder(s) exist locally but not on cloud — use "Retry uploads"`);

  const { data: dashboards } = await supabase
    .from('dashboards')
    .select('id, name')
    .eq('user_id', userId);

  const dashboardMap = new Map((dashboards ?? []).map(d => [d.id, d.name]));
  const dashboardIds = [...new Set([
    ...(dashboards ?? []).map(d => d.id),
    ...(await db.notes.where('user_id').equals(userId).toArray()).map(n => n.dashboard_id).filter(Boolean) as string[],
    ...(await db.folders.where('user_id').equals(userId).toArray()).map(f => f.dashboard_id).filter(Boolean) as string[],
  ])];

  const dashboardBreakdown = await Promise.all(
    dashboardIds.map(async (dashboardId) => {
      const [localN, localF] = await Promise.all([
        db.notes.where('dashboard_id').equals(dashboardId).count(),
        db.folders.where('dashboard_id').equals(dashboardId).count(),
      ]);
      const [{ count: serverN }, { count: serverF }] = await Promise.all([
        supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('dashboard_id', dashboardId),
        supabase.from('folders').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('dashboard_id', dashboardId),
      ]);
      return {
        dashboardId,
        dashboardName: dashboardMap.get(dashboardId) ?? 'Unknown',
        localNotes: localN,
        localFolders: localF,
        serverNotes: serverN ?? 0,
        serverFolders: serverF ?? 0,
      };
    })
  );

  const outboxItems = await db.outbox.toArray();
  const pendingUploads = await Promise.all(
    outboxItems.map(async (item) => {
      let name = item.entityId.slice(0, 8);
      if (item.entityType === 'note') {
        const note = await db.notes.get(item.entityId);
        if (note) name = note.title || name;
        else if (item.payload?.title) name = item.payload.title;
      } else {
        const folder = await db.folders.get(item.entityId);
        if (folder) name = folder.name || name;
        else if (item.payload?.name) name = item.payload.name;
      }
      return {
        entityType: item.entityType,
        entityId: item.entityId,
        name,
        attempts: item.attempts,
      };
    })
  );

  const healthy = issues.length === 0;

  return {
    localNotes,
    localFolders,
    serverNotes: remoteNoteCount,
    serverFolders: remoteFolderCount,
    outboxPending,
    unsyncedNotes,
    unsyncedFolders,
    missingLocally: { notes: missingNotes, folders: missingFolders },
    healthy,
    issues,
    pendingUploads,
    dashboardBreakdown,
  };
}

export async function searchServerNotes(userId: string, query: string): Promise<Array<{ id: string; title: string; dashboard_id: string | null; folder_id: string | null; snippet: string }>> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, content, dashboard_id, folder_id')
    .eq('user_id', userId)
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .limit(20);

  if (error) throw error;

  return (data ?? []).map(note => {
    const content = note.content ?? '';
    const idx = content.toLowerCase().indexOf(q.toLowerCase());
    const snippet = idx >= 0
      ? content.slice(Math.max(0, idx - 40), idx + q.length + 40)
      : note.title;
    return {
      id: note.id,
      title: note.title,
      dashboard_id: note.dashboard_id,
      folder_id: note.folder_id,
      snippet,
    };
  });
}
