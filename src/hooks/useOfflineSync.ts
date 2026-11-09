import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { db, getLastSyncTime, setLastSyncTime } from '../lib/db';
import { isOfflineMode } from '../lib/offlineAuth';
import { isVaultMode } from '../lib/platform';
import { reconcileFromServer } from '../lib/syncHealth';
import { repairOutboxPayloads, sanitizeSyncPayload } from '../lib/syncPayloads';
import { clearNoteDraft, emitNoteSaveStatus } from '../lib/noteDrafts';
import { isActiveNote } from '../lib/activeNoteEdit';
import { useAuth } from '../contexts/AuthContext';

/**
 * Offline-first sync hook
 * Syncs local IndexedDB changes to Supabase when online
 */
export const useOfflineSync = () => {
  const { user } = useAuth();
  const isSyncing = useRef(false);
  const syncInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  /** A sync was requested while one was running: run again right after. */
  const resyncRequested = useRef(false);

  const syncToServer = async () => {
    if (!user?.id || !navigator.onLine || isOfflineMode()) return;
    if (isSyncing.current) {
      resyncRequested.current = true;
      return;
    }
    resyncRequested.current = false;

    isSyncing.current = true;
    window.dispatchEvent(new Event('syncStart'));
    console.log('🔄 Starting sync to server...');

    try {
      // Fix any outbox payloads with fields Supabase doesn't accept (e.g. position)
      await repairOutboxPayloads();

      // 1. Push outbox items to server (folders first, then notes)
      const outboxItems = await db.outbox.toArray();
      
      // Separate folders and notes, sync folders first to satisfy foreign keys
      const folderItems = outboxItems.filter(item => item.entityType === 'folder');
      const noteItems = outboxItems.filter(item => item.entityType === 'note');
      const orderedItems = [...folderItems, ...noteItems];
      
      for (const item of orderedItems) {
        try {
          if (item.operation === 'upsert') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            const payload = sanitizeSyncPayload(item.entityType, item.payload);
            const { error } = await supabase
              .from(table)
              .upsert(payload);
            
            if (error) {
              // If foreign key error, skip for now (folder will sync on next attempt)
              if (error.code === '23503') {
                console.warn(`⏭️ Skipping ${item.entityType} ${item.entityId} - parent folder not synced yet`);
                await db.outbox.update(item.id, { attempts: item.attempts + 1 });
                continue;
              }
              throw error;
            }
            
            // Mark as synced in local DB
            if (item.entityType === 'note') {
              await db.notes.update(item.entityId, { synced: true });
              await clearNoteDraft(item.entityId);
              if (isActiveNote(item.entityId)) {
                emitNoteSaveStatus(item.entityId, 'cloud', isVaultMode() ? 'Saved to vault' : 'Saved to cloud');
              }
            } else {
              await db.folders.update(item.entityId, { synced: true });
            }
            
            // Remove from outbox — unless the note was edited while this upload was
            // in flight. The entry then holds a newer payload; deleting it used to
            // drop that edit. Check and delete atomically, then upload again.
            const superseded = await db.transaction('rw', db.outbox, async () => {
              const latest = await db.outbox.get(item.id);
              if (latest && (latest.createdAt !== item.createdAt || JSON.stringify(latest.payload) !== JSON.stringify(item.payload))) {
                return true;
              }
              await db.outbox.delete(item.id);
              return false;
            });
            if (superseded) {
              resyncRequested.current = true;
              continue;
            }
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
          
          // Don't spam console with repeated errors for same item
          if (item.attempts < 3) {
            console.error(`❌ Failed to upload ${item.entityType} ${item.entityId} to Supabase:`, message, error);
          }
          
          // Stop retrying after 10 attempts to prevent infinite loops
          if (item.attempts >= 10) {
            console.error(`🛑 Giving up on ${item.entityType} ${item.entityId} after 10 attempts`);
            await db.outbox.delete(item.id);
          } else {
            await db.outbox.update(item.id, { attempts: item.attempts + 1 });
          }
        }
      }

      // 2. Pull changes from server
      const lastSync = await getLastSyncTime();
      const syncTime = new Date().toISOString();

      const outboxRemaining = await db.outbox.count();

      // Full reconcile only on first sync — not on every keystroke upload cycle
      if (!lastSync && outboxRemaining === 0) {
        const result = await reconcileFromServer(user.id);
        if (result.notesAdded > 0 || result.notesUpdated > 0 || result.foldersAdded > 0 || result.foldersUpdated > 0) {
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
            if (isActiveNote(note.id)) continue;

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
      // Edits queued during this sync would otherwise wait for the 60s timer.
      if (resyncRequested.current) setTimeout(() => void syncToServer(), 0);
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
