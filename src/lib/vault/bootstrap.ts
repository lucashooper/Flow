import { db, setLastSyncTime, type Folder, type Note } from '../db';
import { getVaultPath, isWindowsPlatform, LOCAL_VAULT_USER } from '../platform';
import { installSupabaseClient } from '../supabase';
import { sanitizeSyncPayload } from '../syncPayloads';
import { TauriVaultFS } from './fs';
import { createVaultClient } from './localClient';
import { CANONICAL_ATTACHMENT_PREFIX, VaultStore } from './store';

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
}
