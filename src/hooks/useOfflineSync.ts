import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { db, getLastSyncTime, setLastSyncTime } from '../lib/db';
import { reconcileFromServer } from '../lib/syncHealth';
import { repairOutboxPayloads, sanitizeSyncPayload } from '../lib/syncPayloads';
import { useAuth } from '../contexts/AuthContext';

/**
 * Offline-first sync hook
 * Syncs local IndexedDB changes to Supabase when online
 */
export const useOfflineSync = () => {
  const { user } = useAuth();
  const isSyncing = useRef(false);
  const syncInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const syncToServer = async () => {
    if (!user?.id || !navigator.onLine || isSyncing.current) return;

    isSyncing.current = true;
    window.dispatchEvent(new Event('syncStart'));
    console.log('🔄 Starting sync to server...');

    try {
      // Fix any outbox payloads with fields Supabase doesn't accept (e.g. position)
      await repairOutboxPayloads();

      // 1. Push outbox items to server
      const outboxItems = await db.outbox.toArray();
      
      for (const item of outboxItems) {
        try {
          if (item.operation === 'upsert') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            const payload = sanitizeSyncPayload(item.entityType, item.payload);
            const { error } = await supabase
              .from(table)
              .upsert(payload);
            
            if (error) throw error;
            
            // Mark as synced in local DB
            if (item.entityType === 'note') {
              await db.notes.update(item.entityId, { synced: true });
            } else {
              await db.folders.update(item.entityId, { synced: true });
            }
            
            // Remove from outbox
            await db.outbox.delete(item.id);
            console.log('✅ Synced', item.entityType, item.entityId);
          } else if (item.operation === 'delete') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            const { error } = await supabase
              .from(table)
              .delete()
              .eq('id', item.entityId);
            
            if (error) throw error;
            await db.outbox.delete(item.id);
            console.log('✅ Deleted', item.entityType, item.entityId);
          }
        } catch (error: any) {
          const message = error?.message || error?.code || String(error);
          console.error(`❌ Failed to upload ${item.entityType} ${item.entityId} to Supabase:`, message, error);
          await db.outbox.update(item.id, { attempts: item.attempts + 1 });
        }
      }

      // 2. Pull changes from server
      const lastSync = await getLastSyncTime();
      const syncTime = new Date().toISOString();

      // Always reconcile if server has more data than local (fixes missing folders after cache clear)
      const [localNoteCount, localFolderCount] = await Promise.all([
        db.notes.where('user_id').equals(user.id).count(),
        db.folders.where('user_id').equals(user.id).count(),
      ]);
      const [{ count: serverNoteCount }, { count: serverFolderCount }] = await Promise.all([
        supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('folders').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      const serverHasMore =
        (serverNoteCount ?? 0) > localNoteCount ||
        (serverFolderCount ?? 0) > localFolderCount;

      if (!lastSync || serverHasMore) {
        const result = await reconcileFromServer(user.id);
        if (result.notesAdded > 0 || result.foldersAdded > 0) {
          window.dispatchEvent(new CustomEvent('dataReconciled', { detail: result }));
        }
      } else if (lastSync) {
        // Incremental pull for recently changed items
        const { data: remoteNotes } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', lastSync);

        if (remoteNotes) {
          for (const note of remoteNotes) {
            const pendingChange = await db.outbox
              .where('entityId')
              .equals(note.id)
              .filter(item => item.entityType === 'note' && item.operation === 'upsert')
              .first();
            
            if (pendingChange) continue;

            const localNote = await db.notes.get(note.id);
            if (!localNote || new Date(note.updated_at) > new Date(localNote.updated_at)) {
              await db.notes.put({ ...note, synced: true });
              console.log('⬇️ Pulled note:', note.id);
            }
          }
        }

        const { data: remoteFolders } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', lastSync);

        if (remoteFolders) {
          for (const folder of remoteFolders) {
            const pendingChange = await db.outbox
              .where('entityId')
              .equals(folder.id)
              .filter(item => item.entityType === 'folder' && item.operation === 'upsert')
              .first();
            
            if (pendingChange) continue;

            const localFolder = await db.folders.get(folder.id);
            if (!localFolder || new Date(folder.updated_at) > new Date(localFolder.updated_at)) {
              await db.folders.put({ ...folder, synced: true });
              console.log('⬇️ Pulled folder:', folder.id);
            }
          }
        }
      }

      await setLastSyncTime(syncTime);
      console.log('✅ Sync complete');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      isSyncing.current = false;
      window.dispatchEvent(new Event('syncEnd'));
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const handleRequestSync = () => {
      syncToServer();
    };

    window.addEventListener('requestSync', handleRequestSync);

    if (navigator.onLine) {
      syncToServer();
    }

    const handleOnline = () => {
      console.log('🌐 Connection restored - syncing...');
      syncToServer();
    };

    window.addEventListener('online', handleOnline);

    syncInterval.current = setInterval(() => {
      if (navigator.onLine) {
        syncToServer();
      }
    }, 60000);

    return () => {
      window.removeEventListener('requestSync', handleRequestSync);
      window.removeEventListener('online', handleOnline);
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
    };
  }, [user?.id]);

  return { syncToServer };
};
