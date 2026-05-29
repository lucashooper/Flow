import { db } from './db';
import { supabase } from './supabase';

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

export function isSyncAdmin(email: string | undefined): boolean {
  return email === ADMIN_EMAIL;
}

/**
 * Merge all server notes/folders into IndexedDB without wiping local data.
 * Adds anything missing locally; updates stale rows when server is newer.
 */
export async function reconcileFromServer(userId: string): Promise<{ notesAdded: number; foldersAdded: number }> {
  let notesAdded = 0;
  let foldersAdded = 0;

  const { data: remoteNotes, error: notesError } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId);

  if (notesError) throw notesError;

  for (const note of remoteNotes ?? []) {
    const pending = await db.outbox
      .where('entityId')
      .equals(note.id)
      .filter(item => item.entityType === 'note' && item.operation === 'upsert')
      .first();

    if (pending) continue;

    const local = await db.notes.get(note.id);
    if (!local) {
      await db.notes.put({ ...note, synced: true });
      notesAdded++;
    } else if (new Date(note.updated_at) > new Date(local.updated_at)) {
      await db.notes.put({ ...note, synced: true });
    }
  }

  const { data: remoteFolders, error: foldersError } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId);

  if (foldersError) throw foldersError;

  for (const folder of remoteFolders ?? []) {
    const pending = await db.outbox
      .where('entityId')
      .equals(folder.id)
      .filter(item => item.entityType === 'folder' && item.operation === 'upsert')
      .first();

    if (pending) continue;

    const local = await db.folders.get(folder.id);
    if (!local) {
      await db.folders.put({ ...folder, synced: true });
      foldersAdded++;
    } else if (new Date(folder.updated_at) > new Date(local.updated_at)) {
      await db.folders.put({ ...folder, synced: true });
    }
  }

  if (notesAdded > 0 || foldersAdded > 0) {
    console.log(`🔄 Reconciled from server: +${notesAdded} notes, +${foldersAdded} folders`);
  }

  return { notesAdded, foldersAdded };
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
  if (missingNotes > 0) issues.push(`${missingNotes} note(s) on cloud missing locally — use "Restore missing from cloud"`);
  if (missingFolders > 0) issues.push(`${missingFolders} folder(s) on cloud missing locally — use "Restore missing from cloud"`);
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
