import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { db, getLastSyncTime, setLastSyncTime } from '../lib/db';
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
      // 1. Push outbox items to server
      const outboxItems = await db.outbox.toArray();
      
      for (const item of outboxItems) {
        try {
          if (item.operation === 'upsert') {
            const table = item.entityType === 'note' ? 'notes' : 'folders';
            const { error } = await supabase
              .from(table)
              .upsert(item.payload);
            
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
        } catch (error) {
          console.error('❌ Failed to sync item:', item.id, error);
          // Increment attempts
          await db.outbox.update(item.id, { attempts: item.attempts + 1 });
        }
      }

      // 2. Pull changes from server (since last sync)
      const lastSync = await getLastSyncTime();
      const syncTime = new Date().toISOString();

      if (lastSync) {
        // Fetch notes updated since last sync
        const { data: remoteNotes } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', lastSync);

        if (remoteNotes) {
          for (const note of remoteNotes) {
            const localNote = await db.notes.get(note.id);
            
            // Last-write-wins conflict resolution
            if (!localNote || new Date(note.updated_at) > new Date(localNote.updated_at)) {
              await db.notes.put({ ...note, synced: true });
              console.log('⬇️ Pulled note:', note.id);
            }
          }
        }

        // Fetch folders updated since last sync
        const { data: remoteFolders } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', lastSync);

        if (remoteFolders) {
          for (const folder of remoteFolders) {
            const localFolder = await db.folders.get(folder.id);
            
            if (!localFolder || new Date(folder.updated_at) > new Date(localFolder.updated_at)) {
              await db.folders.put({ ...folder, synced: true });
              console.log('⬇️ Pulled folder:', folder.id);
            }
          }
        }
      }

      // Update last sync time
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

    // Initial sync on mount if online
    if (navigator.onLine) {
      syncToServer();
    }

    // Sync on online event
    const handleOnline = () => {
      console.log('🌐 Connection restored - syncing...');
      syncToServer();
    };

    window.addEventListener('online', handleOnline);

    // Periodic sync every 60 seconds while online
    syncInterval.current = setInterval(() => {
      if (navigator.onLine) {
        syncToServer();
      }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
    };
  }, [user?.id]);

  return { syncToServer };
};
