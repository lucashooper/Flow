import { db, setLastSyncTime, type Folder, type Note } from '../db';
import { getVaultPath, isIOSApp, isWindowsPlatform, LOCAL_VAULT_USER } from '../platform';
import { installSupabaseClient } from '../supabase';
import { sanitizeSyncPayload } from '../syncPayloads';
import { TauriVaultFS } from './fs';
import { createVaultClient } from './localClient';
import { CANONICAL_ATTACHMENT_PREFIX, VaultStore } from './store';

/** Ask iOS to download vault files that are still only in iCloud. */
async function requestICloudDownloads(root: string) {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const n = await invoke<number>('vault_icloud_download', { root });
    if (n > 0) console.log(`☁️ Downloading ${n} file(s) from iCloud`);
  } catch (e) {
    console.warn('iCloud download request failed', e);
  }
}

/** URL prefix the desktop webview uses for the flowvault:// attachment protocol. */
export function platformAttachmentPrefix(): string {
  // WebView2 (Windows) exposes custom protocols as http://<scheme>.localhost/
  return isWindowsPlatform() ? 'http://flowvault.localhost/' : CANONICAL_ATTACHMENT_PREFIX;
}

/**
 * Open the chosen vault, install the vault-backed data client and refresh the
 * local cache from the files on disk. Runs before any app module is imported.
 */
export async function bootstrapVault(): Promise<void> {
  const path = getVaultPath();
  if (!path) throw new Error('No vault selected');

  // The vault is always reachable, with or without internet. Much of the app
  // skips "server" work while offline, so report online in vault mode.
  try {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  } catch {
    /* ignore */
  }

  // iPhone: make sure files iCloud hasn't downloaded yet are fetched first.
  if (isIOSApp()) await requestICloudDownloads(path);

  const fs = await TauriVaultFS.open(path, { create: false });
  const store = await VaultStore.load(fs, {
    userId: LOCAL_VAULT_USER.id,
    userEmail: LOCAL_VAULT_USER.email,
    attachmentPrefix: platformAttachmentPrefix(),
  });
  const client = createVaultClient(store, LOCAL_VAULT_USER, platformAttachmentPrefix());
  installSupabaseClient(client);

  // 1. Edits still queued from last session (e.g. the app was closed mid-save)
  //    go into the vault first, so nothing typed is lost.
  const pending = await db.outbox.toArray();
  for (const item of [...pending.filter((i) => i.entityType === 'folder'), ...pending.filter((i) => i.entityType === 'note')]) {
    const table = item.entityType === 'note' ? 'notes' : 'folders';
    const result =
      item.operation === 'upsert'
        ? await client.from(table).upsert(sanitizeSyncPayload(item.entityType, item.payload))
        : await client.from(table).delete().eq('id', item.entityId);
    if (!result.error) await db.outbox.delete(item.id);
  }

  // 2. The files on disk are the source of truth — they may have been changed
  //    on another computer (Dropbox / iCloud / a copied folder).
  await db.transaction('rw', db.notes, db.folders, async () => {
    await db.notes.clear();
    await db.folders.clear();
    await db.notes.bulkPut(store.rows('notes').map((n) => ({ ...(n as Note), synced: true })));
    await db.folders.bulkPut(store.rows('folders').map((f) => ({ ...(f as Folder), synced: true })));
  });
  await setLastSyncTime(new Date().toISOString());

  startLiveRefresh(store);
}

/**
 * Pick up changes synced in from other devices (iCloud Drive, Syncthing…)
 * while the app is open: when the window regains focus, and every 20s while
 * it's visible.
 */
function startLiveRefresh(store: VaultStore) {
  let running = false;
  const run = async () => {
    if (running || document.visibilityState !== 'visible') return;
    running = true;
    try {
      if (isIOSApp()) await requestICloudDownloads(getVaultPath() || '');
      const changes = await store.refresh();
      const { upserted, removedIds } = changes.notes;
      const foldersChanged = changes.tables.has('folders');
      if (!upserted.length && !removedIds.length && !changes.tables.size) return;

      // Don't overwrite edits made here that are still waiting to be saved.
      const pending = new Set((await db.outbox.toArray()).map((i) => i.entityId));
      await db.transaction('rw', db.notes, db.folders, async () => {
        const fresh = upserted.filter((n) => !pending.has(n.id));
        if (fresh.length) await db.notes.bulkPut(fresh.map((n) => ({ ...(n as Note), synced: true })));
        if (removedIds.length) await db.notes.bulkDelete(removedIds.filter((id) => !pending.has(id)));
        if (foldersChanged) {
          await db.folders.clear();
          await db.folders.bulkPut(store.rows('folders').map((f) => ({ ...(f as Folder), synced: true })));
        }
      });
      console.log('🔄 Vault changed on another device', { notes: upserted.length, removed: removedIds.length, tables: [...changes.tables] });
      window.dispatchEvent(new CustomEvent('vaultChanged', { detail: { tables: [...changes.tables] } }));
      window.dispatchEvent(new Event('dataReconciled'));
    } catch (e) {
      console.warn('Vault refresh failed', e);
    } finally {
      running = false;
    }
  };
  window.addEventListener('focus', () => void run());
  document.addEventListener('visibilitychange', () => void run());
  setInterval(() => void run(), 20_000);
}
