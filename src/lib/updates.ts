import type { Update } from '@tauri-apps/plugin-updater';
import { isDesktopApp } from './platform';

/**
 * Desktop auto-update: check GitHub Releases for a newer signed build,
 * download it in the background, then "Restart to update" installs it.
 */

export type UpdatePhase = 'idle' | 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'installing' | 'error';

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string | null;
  newVersion: string | null;
  progress: number | null; // 0..1 while downloading
  error: string | null;
}

let state: UpdateState = { phase: 'idle', currentVersion: null, newVersion: null, progress: null, error: null };
let pending: Update | null = null;
const listeners = new Set<(s: UpdateState) => void>();

function set(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getUpdateState(): UpdateState {
  return state;
}

export function subscribeUpdates(listener: (s: UpdateState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Check, and if there's a new version download it so it's ready to install. */
export async function checkForUpdates(options: { quiet?: boolean } = {}): Promise<void> {
  if (!isDesktopApp() || state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'installing') return;
  if (state.phase === 'ready') return;
  try {
    if (!state.currentVersion) {
      const { getVersion } = await import('@tauri-apps/api/app');
      set({ currentVersion: await getVersion() });
    }
    set({ phase: 'checking', error: null });
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) {
      set({ phase: 'up-to-date' });
      return;
    }
    set({ phase: 'downloading', newVersion: update.version, progress: 0 });
    let total = 0;
    let received = 0;
    await update.download((event) => {
      if (event.event === 'Started') total = event.data.contentLength ?? 0;
      if (event.event === 'Progress') {
        received += event.data.chunkLength;
        if (total) set({ progress: Math.min(1, received / total) });
      }
    });
    pending = update;
    set({ phase: 'ready', progress: 1 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('Update check failed:', message);
    // No signed update feed published yet (latest.json missing): nothing to install.
    if (/valid release JSON|404|not found/i.test(message)) {
      set({ phase: 'up-to-date', error: null });
      return;
    }
    // A failed background check shouldn't nag; a manual one shows the reason.
    set({ phase: options.quiet ? 'idle' : 'error', error: message });
  }
}

/** Install the downloaded update and restart into it. */
export async function installAndRestart(): Promise<void> {
  if (!pending) return;
  set({ phase: 'installing' });
  try {
    await pending.install();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (e) {
    set({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

/** Background check shortly after launch, then every 6 hours. */
export function startAutoUpdateChecks(): void {
  if (!isDesktopApp()) return;
  setTimeout(() => void checkForUpdates({ quiet: true }), 8000);
  setInterval(() => void checkForUpdates({ quiet: true }), 6 * 60 * 60 * 1000);
}
