/**
 * Minimal file-system interface a vault is read from / written to.
 * Paths are always relative to the vault root and use forward slashes.
 */
export interface VaultFS {
  readText(path: string): Promise<string | null>;
  writeText(path: string, contents: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  /** Every file under the vault (recursive), skipping hidden folders and attachments/. */
  listNoteFiles(): Promise<string[]>;
  /** Remove folders left empty after notes moved or were deleted. */
  pruneEmptyDirs(): Promise<void>;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** VaultFS backed by the desktop app's Rust commands (src-tauri/src/vault.rs). */
export class TauriVaultFS implements VaultFS {
  private invoke: InvokeFn;
  private constructor(invoke: InvokeFn) {
    this.invoke = invoke;
  }

  /**
   * Points the desktop app at `root`. With `create`, a missing folder is
   * created; without it, a missing folder is an error (e.g. an unplugged drive).
   */
  static async open(root: string, options: { create: boolean }): Promise<TauriVaultFS> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('vault_open', { root, create: options.create });
    return new TauriVaultFS(invoke as InvokeFn);
  }

  readText(path: string) {
    return this.invoke<string | null>('vault_read_text', { path });
  }
  writeText(path: string, contents: string) {
    return this.invoke<void>('vault_write_text', { path, contents });
  }
  writeBytes(path: string, bytes: Uint8Array) {
    return this.invoke<void>('vault_write_bytes', { path, base64: bytesToBase64(bytes) });
  }
  remove(path: string) {
    return this.invoke<void>('vault_remove', { path });
  }
  listNoteFiles() {
    return this.invoke<string[]>('vault_list_note_files');
  }
  pruneEmptyDirs() {
    return this.invoke<void>('vault_prune_empty_dirs');
  }
}

/** In-memory VaultFS — used to build export zips and in tests. */
export class MemoryVaultFS implements VaultFS {
  files = new Map<string, string | Uint8Array>();

  async readText(path: string) {
    const v = this.files.get(path);
    return typeof v === 'string' ? v : null;
  }
  async writeText(path: string, contents: string) {
    this.files.set(path, contents);
  }
  async writeBytes(path: string, bytes: Uint8Array) {
    this.files.set(path, bytes);
  }
  async remove(path: string) {
    this.files.delete(path);
  }
  async listNoteFiles() {
    return [...this.files.keys()].filter(
      (p) => !p.split('/').some((seg) => seg.startsWith('.')) && !p.startsWith('attachments/'),
    );
  }
  async pruneEmptyDirs() {
    /* nothing to do — directories are implicit */
  }
}
