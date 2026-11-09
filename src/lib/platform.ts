/**
 * Platform + storage-mode helpers.
 *
 * Flow runs in two places:
 *  - the browser (flow-notes.app) — always uses Flow Cloud (Supabase)
 *  - the desktop app (Tauri) — the user picks either Flow Cloud or a local
 *    "vault": a folder on their computer where every note is a file.
 *
 * The storage mode is read once at startup (the Supabase client is chosen from
 * it), so switching modes reloads the app.
 */

const STORAGE_MODE_KEY = 'flow_storage_mode';
const VAULT_PATH_KEY = 'flow_vault_path';
const RECENT_VAULTS_KEY = 'flow_recent_vaults';

export type StorageMode = 'cloud' | 'vault';

/** The single user that owns everything in a local vault. */
export const LOCAL_VAULT_USER = {
  id: '00000000-0000-4000-8000-00000000f10e',
  email: 'vault@flow.local',
} as const;

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** The iPhone / iPad app (same Tauri app, built for iOS). */
export function isIOSApp(): boolean {
  return isDesktopApp() && typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isWindowsPlatform(): boolean {
  return typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
}

/** Mode chosen in the desktop app, or null when the user hasn't picked yet. */
export function getChosenStorageMode(): StorageMode | null {
  if (!isDesktopApp()) return 'cloud';
  try {
    const mode = localStorage.getItem(STORAGE_MODE_KEY);
    if (mode === 'vault' && getVaultPath()) return 'vault';
    if (mode === 'cloud') return 'cloud';
  } catch {
    /* ignore */
  }
  return null;
}

export function isVaultMode(): boolean {
  return getChosenStorageMode() === 'vault';
}

export function getVaultPath(): string | null {
  try {
    return localStorage.getItem(VAULT_PATH_KEY);
  } catch {
    return null;
  }
}

export function getRecentVaults(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_VAULTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/** Switch to a vault folder and reload into it. */
export function openVaultAndReload(path: string): void {
  localStorage.setItem(STORAGE_MODE_KEY, 'vault');
  localStorage.setItem(VAULT_PATH_KEY, path);
  const recent = [path, ...getRecentVaults().filter((p) => p !== path)].slice(0, 5);
  localStorage.setItem(RECENT_VAULTS_KEY, JSON.stringify(recent));
  sessionStorage.removeItem('pin_unlocked');
  window.location.replace('/dashboard');
}

/** Switch the desktop app to Flow Cloud and reload. */
export function switchToCloudAndReload(): void {
  localStorage.setItem(STORAGE_MODE_KEY, 'cloud');
  window.location.replace('/login');
}

/** Close the current vault and go back to the desktop welcome screen. */
export function closeVaultAndReload(): void {
  localStorage.removeItem(STORAGE_MODE_KEY);
  sessionStorage.removeItem('pin_unlocked');
  window.location.replace('/welcome');
}

/** Short, stable id for a vault path (used to give each vault its own cache). */
export function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function vaultDisplayName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}
