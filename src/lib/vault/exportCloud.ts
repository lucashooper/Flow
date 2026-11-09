import { db } from '../db';
import { LOCAL_VAULT_USER } from '../platform';
import { supabase } from '../supabase';
import { fetchAllRemoteFolders, fetchAllRemoteNotes } from '../syncHealth';
import { MemoryVaultFS, type VaultFS } from './fs';
import { ATTACHMENTS_DIR, CANONICAL_ATTACHMENT_PREFIX, VaultStore, type Row } from './store';

/**
 * Copy everything from Flow Cloud (or, when it's unreachable, this device's
 * offline copy) into a vault: notes, folders, dashboards, tasks and focus
 * sessions, plus the images used in notes.
 */

export interface ExportProgress {
  step: string;
  done?: number;
  total?: number;
}

export interface ExportResult {
  notes: number;
  images: number;
  failedImages: number;
  usedOfflineCopy: boolean;
}

const STORAGE_URL = /https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/([^"'\s)\\<>]+)/gi;

async function fetchTable(table: string, userId: string, column = 'user_id'): Promise<Row[] | null> {
  try {
    const { data, error } = await supabase.from(table).select('*').eq(column, userId);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn(`[Export] Could not fetch ${table}`, e);
    return null;
  }
}

/** Newest version wins, so edits not yet synced from this device are kept. */
function mergeNewest(remote: Row[], local: Row[]): Row[] {
  const byId = new Map(remote.map((r) => [r.id, r]));
  for (const row of local) {
    const existing = byId.get(row.id);
    if (!existing || String(row.updated_at) > String(existing.updated_at)) {
      const { synced: _s, ...clean } = row;
      void _s;
      byId.set(row.id, clean);
    }
  }
  return [...byId.values()];
}

async function collect(userId: string, onProgress: (p: ExportProgress) => void) {
  onProgress({ step: 'Reading your notes…' });
  let usedOfflineCopy = false;

  const localNotes = (await db.notes.where('user_id').equals(userId).toArray()) as unknown as Row[];
  const localFolders = (await db.folders.where('user_id').equals(userId).toArray()) as unknown as Row[];

  let notes: Row[];
  let folders: Row[];
  try {
    notes = mergeNewest((await fetchAllRemoteNotes(userId)) as unknown as Row[], localNotes);
    folders = mergeNewest((await fetchAllRemoteFolders(userId)) as unknown as Row[], localFolders);
  } catch (e) {
    console.warn('[Export] Flow Cloud unreachable — using the copy saved on this device', e);
    notes = mergeNewest([], localNotes);
    folders = mergeNewest([], localFolders);
    usedOfflineCopy = true;
  }

  onProgress({ step: 'Reading dashboards and tasks…' });
  const [dashboards, tasks, cards, profiles] = await Promise.all([
    fetchTable('dashboards', userId),
    fetchTable('tasks', userId),
    fetchTable('cards', userId),
    fetchTable('user_profiles', userId, 'id'),
  ]);
  if (!dashboards) usedOfflineCopy = true;

  // Without the dashboards table, rebuild placeholder dashboards so notes still group sensibly.
  let dashRows = dashboards ?? [];
  if (!dashboards) {
    const ids = new Set([...notes, ...folders].map((r) => r.dashboard_id).filter(Boolean));
    dashRows = [...ids].map((id, i) => ({
      id,
      user_id: userId,
      name: i === 0 ? 'My Notes' : `Dashboard ${i + 1}`,
      emoji: '📝',
      is_active: i === 0,
      cover_image: null,
      parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  return {
    data: {
      notes,
      folders,
      dashboards: dashRows,
      tasks: tasks ?? [],
      cards: cards ?? [],
      user_profiles: profiles ?? [],
    } as Record<string, Row[]>,
    usedOfflineCopy,
  };
}

/** Download images stored in Flow Cloud into attachments/ and point notes at the copies. */
async function localiseImages(
  fs: VaultFS,
  data: Record<string, Row[]>,
  onProgress: (p: ExportProgress) => void,
): Promise<{ data: Record<string, Row[]>; images: number; failed: number }> {
  let text = JSON.stringify(data);
  const urls = [...new Set([...text.matchAll(STORAGE_URL)].map((m) => m[0]))];
  let images = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress({ step: 'Copying images…', done: i, total: urls.length });
    try {
      const objectPath = url.replace(STORAGE_URL, '$1').split('?')[0];
      const segments = objectPath.split('/').filter(Boolean).map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      });
      if (!segments.length || segments.some((s) => s === '..' || s === '.')) throw new Error('bad path');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      await fs.writeBytes(`${ATTACHMENTS_DIR}/${segments.join('/')}`, bytes);
      const localUrl = `${CANONICAL_ATTACHMENT_PREFIX}${ATTACHMENTS_DIR}/${segments.map(encodeURIComponent).join('/')}`;
      text = text.split(url).join(localUrl);
      images++;
    } catch (e) {
      console.warn('[Export] Could not copy image, keeping the online link', url, e);
      failed++;
    }
  }

  return { data: JSON.parse(text), images, failed };
}

/** Write the user's cloud data into a (new, empty) vault on `fs`. */
export async function writeCloudDataToVault(
  fs: VaultFS,
  userId: string,
  onProgress: (p: ExportProgress) => void = () => {},
): Promise<ExportResult> {
  const { data, usedOfflineCopy } = await collect(userId, onProgress);
  const { data: localData, images, failed } = await localiseImages(fs, data, onProgress);

  onProgress({ step: 'Saving notes as files…' });
  await VaultStore.create(
    fs,
    { userId: LOCAL_VAULT_USER.id, userEmail: LOCAL_VAULT_USER.email, attachmentPrefix: CANONICAL_ATTACHMENT_PREFIX },
    localData,
  );

  return { notes: localData.notes.length, images, failedImages: failed, usedOfflineCopy };
}

/** Browser: build the vault in memory and download it as "Flow Vault.zip". */
export async function downloadVaultZip(
  userId: string,
  onProgress: (p: ExportProgress) => void = () => {},
): Promise<ExportResult> {
  const fs = new MemoryVaultFS();
  const result = await writeCloudDataToVault(fs, userId, onProgress);

  onProgress({ step: 'Zipping…' });
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const folder = zip.folder('Flow Vault')!;
  for (const [path, contents] of fs.files) folder.file(path, contents);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Flow Vault ${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return result;
}
