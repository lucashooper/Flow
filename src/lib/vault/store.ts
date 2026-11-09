/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped JSON records from any table */
import { generateUUID } from '../db';
import type { VaultFS } from './fs';

/**
 * VaultStore — the data of a local vault, held in memory and persisted to files.
 *
 * Layout on disk (everything relative to the vault folder):
 *
 *   .flow/vault.json            marker + format version
 *   .flow/<table>.json          dashboards, folders, tasks, … (one JSON array each)
 *   <Dashboard>/<Folder>/…/<Note title>.json   one file per note
 *   attachments/…               images and files pasted into notes
 *
 * Notes are placed in folders that mirror the dashboard / folder tree, so the
 * vault is browsable in Finder / Explorer. Each note file carries its own id, so
 * the folder structure can always be rebuilt from the data.
 */

export type Row = Record<string, any>;

export const VAULT_FORMAT_VERSION = 1;
export const META_DIR = '.flow';
export const ATTACHMENTS_DIR = 'attachments';
const MARKER_FILE = `${META_DIR}/vault.json`;
const NOTE_FILE_KIND = 'flow-note';

/** Tables the app uses besides notes. Unknown tables are created on demand. */
const KNOWN_TABLES = [
  'dashboards', 'folders', 'tasks', 'cards', 'user_profiles', 'profiles', 'feedback',
  // Learning space
  'learning_gaps', 'learning_explanations', 'learning_cards',
];

/** Canonical (portable) URL prefix for vault attachments, stored in files. */
export const CANONICAL_ATTACHMENT_PREFIX = 'flowvault://localhost/';

export interface VaultStoreOptions {
  userId: string;
  userEmail: string;
  /** URL prefix this platform's webview uses for the flowvault:// protocol. */
  attachmentPrefix: string;
}

// ---------------------------------------------------------------- file names

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** Make a string safe to use as a file or folder name on Windows, macOS and Linux. */
export function safeFileName(name: unknown, fallback: string): string {
  let s = String(name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (s.length > 80) s = s.slice(0, 80).trim();
  if (!s) s = fallback;
  if (s.startsWith('.')) s = `_${s.slice(1)}`;
  if (WINDOWS_RESERVED.test(s) || s.toLowerCase() === ATTACHMENTS_DIR) s = `${s}_`;
  return s;
}

function byCreated(a: Row, b: Row): number {
  const ca = String(a.created_at ?? '');
  const cb = String(b.created_at ?? '');
  if (ca !== cb) return ca < cb ? -1 : 1;
  return String(a.id) < String(b.id) ? -1 : 1;
}

/**
 * Work out the file path of every note from the dashboard / folder tree.
 * Deterministic: older notes keep the plain name when two notes share a title.
 */
export function layoutNotes(notes: Row[], folders: Row[], dashboards: Row[]): Map<string, string> {
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const dashById = new Map(dashboards.map((d) => [d.id, d]));

  const chain = <T extends Row>(start: T | undefined, byId: Map<string, T>, label: (r: T) => string, fallback: string) => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let cur = start;
    while (cur && !seen.has(cur.id) && parts.length < 32) {
      seen.add(cur.id);
      parts.unshift(safeFileName(label(cur), fallback));
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return parts;
  };

  const paths = new Map<string, string>();
  const taken = new Set<string>();

  for (const note of [...notes].sort(byCreated)) {
    const folder = note.folder_id ? folderById.get(note.folder_id) : undefined;
    const dashboardId = note.dashboard_id ?? folder?.dashboard_id ?? null;
    const dash = dashboardId ? dashById.get(dashboardId) : undefined;

    const dir = [
      ...(dash ? chain(dash, dashById, (d) => d.name, 'Dashboard') : ['Unsorted']),
      ...chain(folder, folderById, (f) => f.name, 'Folder'),
    ].join('/');

    const base = safeFileName(note.title, 'Untitled');
    let path = `${dir}/${base}.json`;
    if (taken.has(path.toLowerCase())) {
      path = `${dir}/${base} (${String(note.id).slice(0, 6)}).json`;
    }
    taken.add(path.toLowerCase());
    paths.set(note.id, path);
  }

  return paths;
}

// ---------------------------------------------------------------- the store

export class VaultStore {
  private tables = new Map<string, Row[]>();
  /** Tables recorded in .flow/vault.json (read back on every launch). */
  private listed = new Set<string>();
  /** Where each note currently lives on disk. */
  private notePaths = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();

  private fs: VaultFS;
  private opts: VaultStoreOptions;

  private constructor(fs: VaultFS, opts: VaultStoreOptions) {
    this.fs = fs;
    this.opts = opts;
  }

  // ------------------------------------------------------------ (de)serialise

  private toDisk(value: unknown): string {
    let text = JSON.stringify(value, null, 2);
    if (this.opts.attachmentPrefix !== CANONICAL_ATTACHMENT_PREFIX) {
      text = text.split(this.opts.attachmentPrefix).join(CANONICAL_ATTACHMENT_PREFIX);
    }
    return text;
  }

  private fromDisk<T>(text: string): T {
    if (this.opts.attachmentPrefix !== CANONICAL_ATTACHMENT_PREFIX) {
      text = text.split(CANONICAL_ATTACHMENT_PREFIX).join(this.opts.attachmentPrefix);
    }
    return JSON.parse(text) as T;
  }

  private noteToFile(note: Row) {
    const { content, drawing_data, user_id: _u, synced: _s, ...meta } = note;
    void _u;
    void _s;
    return { kind: NOTE_FILE_KIND, version: VAULT_FORMAT_VERSION, ...meta, content: content ?? '', drawing_data: drawing_data ?? null };
  }

  private fileToNote(file: Row): Row | null {
    if (!file || file.kind !== NOTE_FILE_KIND || typeof file.id !== 'string') return null;
    const { kind: _k, version: _v, ...note } = file;
    void _k;
    void _v;
    return { ...note, user_id: this.opts.userId };
  }

  private adoptRow(table: string, row: Row): Row {
    const out = { ...row };
    if ('user_id' in out) out.user_id = this.opts.userId;
    if (table === 'user_profiles' || table === 'profiles') out.id = this.opts.userId;
    return out;
  }

  // ------------------------------------------------------------------- load

  static async load(fs: VaultFS, opts: VaultStoreOptions): Promise<VaultStore> {
    const store = new VaultStore(fs, opts);

    const markerText = await fs.readText(MARKER_FILE);
    const marker = markerText ? (JSON.parse(markerText) as Row) : null;
    if (marker && Number(marker.version) > VAULT_FORMAT_VERSION) {
      throw new Error('This vault was made by a newer version of Flow. Please update the app.');
    }

    const tableNames = new Set([...KNOWN_TABLES, ...((marker?.tables as string[]) ?? [])]);
    ((marker?.tables as string[]) ?? []).forEach((t) => store.listed.add(t));
    for (const name of tableNames) {
      const text = await fs.readText(`${META_DIR}/${name}.json`);
      const rows = text ? store.fromDisk<Row[]>(text) : [];
      store.tables.set(name, Array.isArray(rows) ? rows.map((r) => store.adoptRow(name, r)) : []);
    }

    // Notes: one file each
    const files = (await fs.listNoteFiles()).filter((p) => p.toLowerCase().endsWith('.json'));
    const notes = new Map<string, Row>();
    const loadOne = async (path: string) => {
      try {
        const text = await fs.readText(path);
        if (!text) return;
        const note = store.fileToNote(store.fromDisk<Row>(text));
        if (!note) return;
        const existing = notes.get(note.id);
        // Two copies of the same note (e.g. a sync conflict copy): keep the newest.
        if (!existing || String(note.updated_at) > String(existing.updated_at)) {
          notes.set(note.id, note);
          store.notePaths.set(note.id, path);
        }
      } catch (e) {
        console.warn('[Vault] Skipping unreadable note file', path, e);
      }
    };
    for (let i = 0; i < files.length; i += 16) {
      await Promise.all(files.slice(i, i + 16).map(loadOne));
    }
    store.tables.set('notes', [...notes.values()]);

    store.ensureProfile();
    if (!marker) await store.writeMarker();
    if (store.ensureDashboard()) {
      await store.writeTable('dashboards');
      await store.writeTable('folders');
      await store.relayoutNotes(new Set(store.rows('notes').map((n) => n.id)));
    }
    console.log(`📁 Vault loaded: ${notes.size} notes, ${store.rows('folders').length} folders`);
    return store;
  }

  /** Build a store from rows (e.g. exported from Flow Cloud) and write everything. */
  static async create(fs: VaultFS, opts: VaultStoreOptions, data: Record<string, Row[]>): Promise<VaultStore> {
    const store = new VaultStore(fs, opts);
    for (const [name, rows] of Object.entries(data)) {
      store.tables.set(name, rows.map((r) => store.adoptRow(name, r)));
    }
    for (const name of KNOWN_TABLES) if (!store.tables.has(name)) store.tables.set(name, []);
    if (!store.tables.has('notes')) store.tables.set('notes', []);
    store.ensureProfile();
    store.ensureDashboard();
    await store.writeMarker();
    for (const name of store.tables.keys()) {
      if (name !== 'notes') await store.writeTable(name);
    }
    await store.relayoutNotes(new Set(store.rows('notes').map((n) => n.id)));
    return store;
  }

  /**
   * A vault always has at least one dashboard (a new Flow Cloud account gets
   * one at sign-up). Notes and folders without a dashboard are put in it.
   */
  private ensureDashboard(): boolean {
    const dashboards = this.rows('dashboards');
    if (dashboards.length) return false;
    const now = new Date().toISOString();
    const id = generateUUID();
    dashboards.push({
      id,
      user_id: this.opts.userId,
      name: 'My Notes',
      emoji: '📝',
      cover_image: null,
      is_active: true,
      parent_id: null,
      created_at: now,
      updated_at: now,
    });
    for (const table of ['notes', 'folders']) {
      for (const row of this.rows(table)) if (!row.dashboard_id) row.dashboard_id = id;
    }
    return true;
  }

  private ensureProfile() {
    const profiles = this.rows('user_profiles');
    if (!profiles.length) {
      const now = new Date().toISOString();
      profiles.push({
        id: this.opts.userId,
        username: 'You',
        email: this.opts.userEmail,
        profile_picture_url: null,
        pin_hash: null,
        task_manager_enabled: true,
        created_at: now,
        updated_at: now,
      });
    } else if (profiles.length > 1) {
      profiles.splice(1);
    }
  }

  // ----------------------------------------------------------------- access

  rows(table: string): Row[] {
    let rows = this.tables.get(table);
    if (!rows) {
      rows = [];
      this.tables.set(table, rows);
    }
    return rows;
  }

  /**
   * Apply a change to a table and persist it. Resolves once the change is on
   * disk, so the app never treats an edit as saved before it really is.
   */
  commit(table: string, next: Row[], changedIds: Set<string>, deletedIds: Set<string>): Promise<void> {
    const run = async () => {
      const isNew = table !== 'notes' && !this.listed.has(table);
      this.tables.set(table, next);
      if (table === 'notes') {
        for (const id of deletedIds) {
          const path = this.notePaths.get(id);
          if (path) {
            await this.fs.remove(path);
            this.notePaths.delete(id);
          }
        }
        await this.relayoutNotes(changedIds);
        if (deletedIds.size) await this.fs.pruneEmptyDirs();
      } else {
        await this.writeTable(table);
        if (isNew) await this.writeMarker();
        // Renaming / moving a dashboard or folder moves the note files under it.
        if (table === 'folders' || table === 'dashboards') {
          await this.relayoutNotes(new Set());
        }
      }
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /** Write a binary attachment (images etc.). */
  writeAttachment(path: string, bytes: Uint8Array): Promise<void> {
    return this.fs.writeBytes(`${ATTACHMENTS_DIR}/${path}`, bytes);
  }

  removeAttachment(path: string): Promise<void> {
    return this.fs.remove(`${ATTACHMENTS_DIR}/${path}`);
  }

  // ------------------------------------------------------------ persistence

  private async writeMarker() {
    const tables = [...new Set([...this.listed, ...this.tables.keys()])].filter((t) => t !== 'notes');
    tables.forEach((t) => this.listed.add(t));
    await this.fs.writeText(
      MARKER_FILE,
      JSON.stringify({ app: 'Flow Notes', version: VAULT_FORMAT_VERSION, tables }, null, 2),
    );
  }

  private async writeTable(table: string) {
    await this.fs.writeText(`${META_DIR}/${table}.json`, this.toDisk(this.rows(table)));
  }

  /**
   * Re-place note files after a change. `dirty` notes are always rewritten;
   * any other note is rewritten only if its path changed (rename / move).
   */
  private async relayoutNotes(dirty: Set<string>) {
    const notes = this.rows('notes');
    const layout = layoutNotes(notes, this.rows('folders'), this.rows('dashboards'));
    const wanted = new Set([...layout.values()].map((p) => p.toLowerCase()));
    const stale: string[] = [];

    // Write first, delete after: two notes can swap names, so an old path may
    // already belong to another note by the time we'd remove it.
    for (const note of notes) {
      const want = layout.get(note.id)!;
      const have = this.notePaths.get(note.id);
      if (have === want && !dirty.has(note.id)) continue;

      await this.fs.writeText(want, this.toDisk(this.noteToFile(note)));
      if (have && have !== want) stale.push(have);
      this.notePaths.set(note.id, want);
    }

    for (const path of stale) {
      // Skip paths now used by another note (incl. case-only renames on macOS/Windows).
      if (!wanted.has(path.toLowerCase())) await this.fs.remove(path);
    }
    if (stale.length) await this.fs.pruneEmptyDirs();
  }
}
