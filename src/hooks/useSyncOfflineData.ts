import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Note } from '../types';

/**
 * Hook to sync offline notes to Supabase when connection is restored
 */
export const useSyncOfflineData = () => {
  const { user } = useAuth();
  const isSyncing = useRef(false);

  useEffect(() => {
    const syncOfflineNotes = async () => {
      if (!user?.id || !navigator.onLine || isSyncing.current) return;

      const offlineNotes = localStorage.getItem('offlineNotes');
      if (!offlineNotes) return;

      const notes: Note[] = JSON.parse(offlineNotes);
      if (notes.length === 0) return;

      isSyncing.current = true;
      console.log('🔄 Syncing offline notes to Supabase...', notes.length);

      const syncedIds: string[] = [];
      const failedNotes: Note[] = [];

      for (const note of notes) {
        try {
          // Remove offline prefix and metadata fields before inserting
          const { id, created_at, updated_at, ...noteData } = note;
          
          const { data, error } = await supabase
            .from('notes')
            .insert([noteData])
            .select()
            .single();

          if (error) throw error;

          console.log('✅ Synced note:', note.id, '→', data.id);
          syncedIds.push(note.id);

          // Update localStorage cache with synced note
          const dashboardId = note.dashboard_id;
          if (dashboardId) {
            const cachedKey = `cachedNotes_${dashboardId}`;
            const cached = localStorage.getItem(cachedKey);
            if (cached) {
              const cachedNotes = JSON.parse(cached);
              cachedNotes.unshift(data);
              localStorage.setItem(cachedKey, JSON.stringify(cachedNotes));
            }
          }
        } catch (error) {
          console.error('❌ Failed to sync note:', note.id, error);
          failedNotes.push(note);
        }
      }

      // Remove successfully synced notes from offline storage
      if (syncedIds.length > 0) {
        const remainingNotes = notes.filter(n => !syncedIds.includes(n.id));
        localStorage.setItem('offlineNotes', JSON.stringify(remainingNotes));
        console.log(`✅ Synced ${syncedIds.length} notes. ${remainingNotes.length} remaining.`);
      }

      if (failedNotes.length > 0) {
        console.warn(`⚠️ Failed to sync ${failedNotes.length} notes. Will retry later.`);
      }

      isSyncing.current = false;
    };

    // Sync on mount if online
    if (navigator.onLine) {
      syncOfflineNotes();
    }

    // Listen for online event
    const handleOnline = () => {
      console.log('🌐 Connection restored - syncing offline data...');
      syncOfflineNotes();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user?.id]);
};
