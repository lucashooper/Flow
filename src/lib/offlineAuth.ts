import type { User } from '../types';
import { db } from './db';

const OFFLINE_MODE_KEY = 'flow_offline_mode';

/** Read the last logged-in user from Supabase's localStorage cache (no network). */
export function getCachedAuthUser(): User | null {
  if (typeof window === 'undefined') return null;

  const authKeys = Object.keys(localStorage).filter(
    (key) => key.includes('supabase') && key.includes('auth'),
  );

  for (const key of authKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const authUser =
        data?.user ??
        data?.session?.user ??
        data?.currentSession?.user;

      if (authUser?.id) {
        return {
          id: authUser.id,
          email: authUser.email || '',
        };
      }
    } catch {
      // try next key
    }
  }

  return null;
}

/** Find the user id with the most notes saved in IndexedDB on this device. */
export async function getOfflineUserFromIndexedDB(preferredEmail?: string): Promise<User | null> {
  try {
    const notes = await db.notes.toArray();
    if (!notes.length) return null;

    const counts = new Map<string, number>();
    for (const note of notes) {
      if (!note.user_id) continue;
      counts.set(note.user_id, (counts.get(note.user_id) || 0) + 1);
    }

    if (counts.size === 0) return null;

    let bestUserId = '';
    let bestCount = 0;
    for (const [userId, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestUserId = userId;
      }
    }

    const cached = getCachedAuthUser();
    const email = preferredEmail || cached?.email || 'offline@local';

    return { id: bestUserId, email };
  } catch {
    return null;
  }
}

/** Count notes stored locally (for UI hints). */
export async function getLocalNoteCount(): Promise<number> {
  try {
    return await db.notes.count();
  } catch {
    return 0;
  }
}

export function isOfflineMode(): boolean {
  return sessionStorage.getItem(OFFLINE_MODE_KEY) === 'true';
}

export function setOfflineMode(enabled: boolean): void {
  if (enabled) {
    sessionStorage.setItem(OFFLINE_MODE_KEY, 'true');
  } else {
    sessionStorage.removeItem(OFFLINE_MODE_KEY);
  }
}

/** True when Supabase is unreachable or project is paused (402 egress, etc.). */
export function isSupabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: number; message?: string; code?: string };
  if (err.status === 402 || err.status === 503) return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('exceed_egress') ||
    msg.includes('restricted') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  );
}
