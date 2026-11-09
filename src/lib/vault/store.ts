/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped JSON records from any table */
import { generateUUID } from '../db';
import type { VaultFS } from './fs';

/**
 * VaultStore — the data of a local vault, held in memory and persisted to files.
 *
 * Layout on disk (everything relative to the vault folder):
 *
 *   .flow/vault.json                    marker + format version
 *   .flow/data/<table>/<id>.json        dashboards, folders, tasks, cards… one file per row
 *   .flow/conflicts/…                   older copies set aside after a sync conflict
 *   <Dashboard>/<Folder>/…/<Note title>.json   one file per note
 *   attachments/…                       images and files pasted into notes
 *
 * Notes are placed in folders that mirror the dashboard / folder tree, so the
 * vault is browsable in Finder / Explorer. Each note file carries its own id, so
 * the folder structure can always be rebuilt from the data.
 *
 * Everything is one file per item so a vault can be synced between devices
 * (iCloud Drive, Syncthing, Dropbox…): two devices editing different items
 * never touch the same file. When a sync tool leaves two copies of one item
 * ("Card 2.json", "….sync-conflict-….json"), the newest wins and the other is
 * moved to .flow/conflicts/, never deleted.
 */

export type Row = Record<string, any>;

/** 2: one file per row under .flow/data/ (1 was one JSON array per table). */
export const VAULT_FORMAT_VERSION = 2;
export const META_DIR = '.flow';
export const ATTACHMENTS_DIR = 'attachments';
const MARKER_FILE = `${META_DIR}/vault.json`;
const DATA_DIR = `${META_DIR}/data`;
const CONFLICTS_DIR = `${META_DIR}/conflicts`;
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

/** File name for a row id (ids are UUIDs; anything odd is made filename-safe). */
function rowFileName(id: unknown): string {
  return `${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}.json`;
}

function newer(a: Row, b: Row | undefined): boolean {
  return !b || String(a.updated_at ?? '') > String(b.updated_at ?? '');
}

/** What changed on disk since the last look (for live refresh). */
export interface VaultChanges {
  notes: { upserted: Row[]; removedIds: string[] };
  /** Other tables that changed, e.g. 'learning_cards'. */
  tables: Set<string>;
}

export class VaultStore {
  private tables = new Map<string, Row[]>();
  /** Where each note currently lives on disk. */
  private notePaths = new Map<string, string>();
  /** Last-modified time of every file we know, to spot changes made by sync. */
  private mtimes = new Map<string, number>();
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

  // -------------------------------------------------------------- file i/o

  private async write(path: string, value: unknown) {
    this.mtimes.set(path, await this.fs.writeText(path, this.toDisk(value)));
  }

  private async removeFile(path: string) {
    await this.fs.remove(path);
    this.mtimes.delete(path);
  }

  /** Keep an older duplicate (sync conflict copy) out of the way, but don't lose it. */
  private async setAside(path: string) {
    const text = await this.fs.readText(path);
    if (text != null) {
      const name = path.split('/').join(' ∕ ');
      await this.fs.writeText(`${CONFLICTS_DIR}/${new Date().toISOString().slice(0, 19).replace(/:/g, '-')} ${name}`, text);
    }
    await this.removeFile(path);
  }

  private rowPath(table: string, id: unknown) {
    return `${DATA_DIR}/${table}/${rowFileName(id)}`;
  }

  // ------------------------------------------------------------------- load

  static async load(fs: VaultFS, opts: VaultStoreOptions): Promise<VaultStore> {
    const store = new VaultStore(fs, opts);

    const markerText = await fs.readText(MARKER_FILE);
    const marker = markerText ? (JSON.parse(markerText) as Row) : null;
    if (marker && Number(marker.version) > VAULT_FORMAT_VERSION) {
      throw new Error('This vault was made by a newer version of Flow. Please update the app.');
    }

    // Tables: every folder under .flow/data, plus the ones the app always uses.
    const dirs = (await fs.listDir(DATA_DIR)).filter((e) => e.isDir).map((e) => e.name);
    const names = new Set([...KNOWN_TABLES, ...((marker?.tables as string[]) ?? []), ...dirs]);
    for (const name of names) await store.loadTable(name);

    // Notes: one file each
    await store.loadNotes();

    store.ensureProfile();
    const needsDashboard = store.ensureDashboard();
    if (!marker || Number(marker.version) < VAULT_FORMAT_VERSION) await store.writeMarker();
    if (needsDashboard) {
      await store.writeTable('dashboards');
      await store.writeTable('folders');
      await store.relayoutNotes(new Set(store.rows('notes').map((n) => n.id)));
    }
    if (!store.rows('user_profiles').some((p) => store.mtimes.has(store.rowPath('user_profiles', p.id)))) {
      await store.writeTable('user_profiles');
    }
    console.log(`📁 Vault loaded: ${store.rows('notes').length} notes, ${store.rows('folders').length} folders`);
    return store;
  }

  /** Read one table's row files, merging sync conflict copies. Migrates old single-file tables. */
  private async loadTable(name: string) {
    const dir = `${DATA_DIR}/${name}`;
    const entries = (await this.fs.listDir(dir)).filter((e) => !e.isDir && e.name.toLowerCase().endsWith('.json'));
    const byId = new Map<string, { row: Row; path: string }>();
    const losers: string[] = [];

    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      try {
        const text = await this.fs.readText(path);
        if (!text) continue;
        const row = this.adoptRow(name, this.fromDisk<Row>(text));
        if (row?.id == null) continue;
        const id = String(row.id);
        this.mtimes.set(path, entry.mtime);
        const existing = byId.get(id);
        if (!existing) byId.set(id, { row, path });
        else if (newer(row, existing.row)) {
          losers.push(existing.path);
          byId.set(id, { row, path });
        } else losers.push(path);
      } catch (e) {
        console.warn('[Vault] Skipping unreadable file', path, e);
      }
    }

    // Older single-file format (.flow/<table>.json): move each row into its own file.
    const legacyPath = `${META_DIR}/${name}.json`;
    const legacy = await this.fs.readText(legacyPath);
    if (legacy) {
      const rows = this.fromDisk<Row[]>(legacy);
      for (const raw of Array.isArray(rows) ? rows : []) {
        const row = this.adoptRow(name, raw);
        if (row?.id == null) continue;
        const existing = byId.get(String(row.id));
        if (!existing || newer(row, existing.row)) {
          await this.write(this.rowPath(name, row.id), row);
          byId.set(String(row.id), { row, path: this.rowPath(name, row.id) });
        }
      }
      await this.fs.remove(legacyPath);
    }

    for (const { row, path } of byId.values()) {
      const canonical = this.rowPath(name, row.id);
      if (path !== canonical) {
        // The newest copy is a conflict file: keep the older normal-named copy
        // aside first, then give the newest one the normal name.
        const i = losers.indexOf(canonical);
        if (i >= 0) {
          losers.splice(i, 1);
          await this.setAside(canonical);
        }
        await this.write(canonical, row);
        await this.removeFile(path);
      }
    }
    for (const path of losers) await this.setAside(path);

    this.tables.set(name, [...byId.values()].map((x) => x.row));
  }

  private async loadNotes() {
    const files = (await this.fs.listNoteFiles()).filter((f) => f.path.toLowerCase().endsWith('.json'));
    const notes = new Map<string, Row>();
    const losers: string[] = [];
    const readOne = async ({ path, mtime }: { path: string; mtime: number }) => {
      try {
        const text = await this.fs.readText(path);
        if (!text) return;
        const note = this.fileToNote(this.fromDisk<Row>(text));
        if (!note) return;
        this.mtimes.set(path, mtime);
        const existing = notes.get(note.id);
        if (!existing) {
          notes.set(note.id, note);
          this.notePaths.set(note.id, path);
        } else if (newer(note, existing)) {
          losers.push(this.notePaths.get(note.id)!);
          notes.set(note.id, note);
          this.notePaths.set(note.id, path);
        } else losers.push(path);
      } catch (e) {
        console.warn('[Vault] Skipping unreadable note file', path, e);
      }
    };
    for (let i = 0; i < files.length; i += 16) {
      await Promise.all(files.slice(i, i + 16).map(readOne));
    }
    for (const path of losers) await this.setAside(path);
    this.tables.set('notes', [...notes.values()]);
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

  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /**
   * Apply a change to a table and persist it. Resolves once the change is on
   * disk, so the app never treats an edit as saved before it really is.
   */
  commit(table: string, next: Row[], changedIds: Set<string>, deletedIds: Set<string>): Promise<void> {
    return this.enqueue(async () => {
      this.tables.set(table, next);
      if (table === 'notes') {
        for (const id of deletedIds) {
          const path = this.notePaths.get(id);
          if (path) {
            await this.removeFile(path);
            this.notePaths.delete(id);
          }
        }
        await this.relayoutNotes(changedIds);
        if (deletedIds.size) await this.fs.pruneEmptyDirs();
        return;
      }
      // One file per row: only the rows that changed are written.
      for (const row of next) {
        if (changedIds.has(row.id)) await this.write(this.rowPath(table, row.id), row);
      }
      for (const id of deletedIds) await this.removeFile(this.rowPath(table, id));
      // Renaming / moving a dashboard or folder moves the note files under it.
      if (table === 'folders' || table === 'dashboards') {
        await this.relayoutNotes(new Set());
      }
    });
  }

  /** Write a binary attachment (images etc.). */
  async writeAttachment(path: string, bytes: Uint8Array): Promise<void> {
    await this.fs.writeBytes(`${ATTACHMENTS_DIR}/${path}`, bytes);
  }

  removeAttachment(path: string): Promise<void> {
    return this.fs.remove(`${ATTACHMENTS_DIR}/${path}`);
  }

  // --------------------------------------------------------- live refresh

  /**
   * Pick up changes another device made (via iCloud / Syncthing / Dropbox) while
   * the app is open: re-read only files whose modified time changed.
   */
  refresh(): Promise<VaultChanges> {
    return this.enqueue(async () => {
      const changes: VaultChanges = { notes: { upserted: [], removedIds: [] }, tables: new Set() };

      // Notes
      const files = (await this.fs.listNoteFiles()).filter((f) => f.path.toLowerCase().endsWith('.json'));
      const seen = new Set(files.map((f) => f.path));
      const notes = new Map(this.rows('notes').map((n) => [n.id as string, n]));
      for (const { path, mtime } of files) {
        if (this.mtimes.get(path) === mtime) continue;
        const text = await this.fs.readText(path).catch(() => null);
        if (!text) continue;
        let note: Row | null = null;
        try {
          note = this.fileToNote(this.fromDisk<Row>(text));
        } catch {
          /* half-synced file: try again next time */
        }
        if (!note) continue;
        this.mtimes.set(path, mtime);
        const current = notes.get(note.id);
        if (!current || newer(note, current)) {
          const oldPath = this.notePaths.get(note.id);
          notes.set(note.id, note);
          this.notePaths.set(note.id, path);
          changes.notes.upserted.push(note);
          if (oldPath && oldPath !== path && seen.has(oldPath)) await this.setAside(oldPath);
        } else if (this.notePaths.get(note.id) !== path) {
          const currentPath = this.notePaths.get(note.id);
          if (currentPath && seen.has(currentPath)) await this.setAside(path); // an older duplicate
          else this.notePaths.set(note.id, path); // moved on the other device
        }
      }
      for (const [id, path] of [...this.notePaths]) {
        if (!seen.has(path) && this.mtimes.has(path)) {
          // Deleted (or renamed away) on another device.
          this.mtimes.delete(path);
          this.notePaths.delete(id);
          notes.delete(id);
          changes.notes.removedIds.push(id);
        }
      }
      // A note renamed elsewhere shows up as an upsert at its new path above,
      // after its old path disappeared — so don't report it as removed.
      changes.notes.removedIds = changes.notes.removedIds.filter((id) => !notes.has(id));
      this.tables.set('notes', [...notes.values()]);

      // Other tables
      const dirs = (await this.fs.listDir(DATA_DIR)).filter((e) => e.isDir).map((e) => e.name);
      for (const name of new Set([...this.tables.keys(), ...dirs])) {
        if (name === 'notes') continue;
        const dir = `${DATA_DIR}/${name}`;
        const entries = (await this.fs.listDir(dir)).filter((e) => !e.isDir && e.name.toLowerCase().endsWith('.json'));
        const present = new Set(entries.map((e) => `${dir}/${e.name}`));
        const rows = new Map(this.rows(name).map((r) => [String(r.id), r]));
        let changed = false;
        for (const entry of entries) {
          const path = `${dir}/${entry.name}`;
          if (this.mtimes.get(path) === entry.mtime) continue;
          const text = await this.fs.readText(path).catch(() => null);
          if (!text) continue;
          let row: Row;
          try {
            row = this.adoptRow(name, this.fromDisk<Row>(text));
          } catch {
            continue;
          }
          if (row?.id == null) continue;
          this.mtimes.set(path, entry.mtime);
          const id = String(row.id);
          const canonical = this.rowPath(name, row.id);
          const current = rows.get(id);
          if (path === canonical) {
            // Edited on another device.
            rows.set(id, row);
            changed = true;
          } else if (newer(row, current)) {
            // A newer conflict copy: set the older one aside, then take the newer.
            if (current && this.mtimes.has(canonical)) await this.setAside(canonical);
            rows.set(id, row);
            await this.write(canonical, row);
            await this.removeFile(path);
            changed = true;
          } else {
            await this.setAside(path);
          }
        }
        for (const [id] of [...rows]) {
          const path = this.rowPath(name, id);
          if (!present.has(path) && this.mtimes.has(path)) {
            this.mtimes.delete(path);
            rows.delete(id);
            changed = true;
          }
        }
        if (changed) {
          this.tables.set(name, [...rows.values()]);
          changes.tables.add(name);
        }
      }
      return changes;
    });
  }

  // ------------------------------------------------------------ persistence

  private async writeMarker() {
    await this.fs.writeText(MARKER_FILE, JSON.stringify({ app: 'Flow Notes', version: VAULT_FORMAT_VERSION }, null, 2));
  }

  private async writeTable(table: string) {
    for (const row of this.rows(table)) await this.write(this.rowPath(table, row.id), row);
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

      await this.write(want, this.noteToFile(note));
      if (have && have !== want) stale.push(have);
      this.notePaths.set(note.id, want);
    }

    for (const path of stale) {
      // Skip paths now used by another note (incl. case-only renames on macOS/Windows).
      if (!wanted.has(path.toLowerCase())) await this.removeFile(path);
    }
    if (stale.length) await this.fs.pruneEmptyDirs();
  }
}
