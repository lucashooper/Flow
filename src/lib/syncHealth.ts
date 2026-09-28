import { db } from './db';
import { supabase } from './supabase';
import { clearNoteDraft } from './noteDrafts';

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

  const { data: remoteNotes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  let restored = 0;

  for (const remote of remoteNotes ?? []) {
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

  return { restored, examined: remoteNotes?.length ?? 0 };
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
    } else {
      const remoteLen = meaningfulContentLength(note.content);
      const localLen = meaningfulContentLength(local.content);
      const serverNewer = new Date(note.updated_at) > new Date(local.updated_at);
      const localWiped = localLen < 40 && remoteLen > localLen + 80;

      if (serverNewer || localWiped) {
        if (localWiped || remoteLen >= localLen) {
          await db.notes.put({ ...note, synced: true });
          if (localWiped) await clearNoteDraft(note.id);
        }
      }
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
