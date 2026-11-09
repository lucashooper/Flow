/** Desktop folder pickers for creating / opening vaults. */

interface FolderInfo {
  exists: boolean;
  is_vault: boolean;
  is_empty: boolean;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

export function inspectFolder(path: string): Promise<FolderInfo> {
  return invoke<FolderInfo>('vault_inspect', { path });
}

export async function pickFolder(title: string, defaultPath?: string): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({ directory: true, multiple: false, title, defaultPath });
  return typeof result === 'string' ? result : null;
}

export async function confirmDialog(message: string, title = 'Flow Notes'): Promise<boolean> {
  const { confirm } = await import('@tauri-apps/plugin-dialog');
  return confirm(message, { title, kind: 'info', okLabel: 'Continue', cancelLabel: 'Cancel' });
}

/** `<parent>/Flow Vault`, or `Flow Vault 2`, `3`… if that name is taken by other files. */
export async function freeVaultFolder(parent: string): Promise<string> {
  const { join } = await import('@tauri-apps/api/path');
  for (let i = 1; i < 100; i++) {
    const candidate = await join(parent, i === 1 ? 'Flow Vault' : `Flow Vault ${i}`);
    const info = await inspectFolder(candidate);
    if (!info.exists || info.is_empty) return candidate;
  }
  throw new Error('Could not find a free folder name for the vault');
}

/** Default spot for a new vault: Documents/Flow Vault. */
export async function defaultNewVaultPath(): Promise<string> {
  const { documentDir } = await import('@tauri-apps/api/path');
  return freeVaultFolder(await documentDir());
}

/**
 * Ask where a NEW vault should go. Picking an empty folder uses it directly;
 * picking a folder with other things in it creates "Flow Vault" inside it.
 * Returns null if cancelled. Never returns an existing vault.
 */
export async function chooseNewVaultLocation(): Promise<string | null> {
  const picked = await pickFolder('Choose where to create your vault');
  if (!picked) return null;
  const info = await inspectFolder(picked);
  if (info.is_empty) return picked;
  return freeVaultFolder(picked);
}

/**
 * Ask for an EXISTING vault folder. A folder that isn't a vault yet can be
 * turned into one after confirming. Returns null if cancelled.
 */
export async function chooseExistingVault(): Promise<string | null> {
  const picked = await pickFolder('Open a vault folder');
  if (!picked) return null;
  const info = await inspectFolder(picked);
  if (info.is_vault || info.is_empty) return picked;
  const ok = await confirmDialog(
    "This folder isn't a Flow vault yet.\n\nFlow will save your notes in it as files (plus a hidden .flow folder for settings). Anything already in the folder is left alone.",
    'Use this folder as a vault?',
  );
  return ok ? picked : null;
}

export async function revealVaultFolder(path: string): Promise<void> {
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}
