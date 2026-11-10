import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Cloud, FolderOpen, FolderPlus, HardDrive, Loader2 } from 'lucide-react';
import {
  getRecentVaults,
  isDesktopApp,
  isIOSApp,
  openVaultAndReload,
  switchToCloudAndReload,
  vaultDisplayName,
} from '../lib/platform';
import { hasCloudConfig } from '../lib/supabase';
import {
  chooseExistingVault,
  chooseNewVaultLocation,
  defaultNewVaultPath,
  inspectFolder,
} from '../lib/vault/picker';

const ACCENT = '#4fc3f7';

/** First screen of the desktop app: pick where notes live. */
export const DesktopWelcome = () => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [defaultPath, setDefaultPath] = useState('');
  const [recent, setRecent] = useState<{ path: string; ok: boolean }[]>([]);
  const [iosLocation, setIosLocation] = useState<{ path: string; icloud: boolean } | null>(null);

  // iPhone: one vault, in Flow's iCloud Drive folder (or on the phone if iCloud is off).
  useEffect(() => {
    if (!isIOSApp()) return;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<{ path: string; icloud: boolean } | null>('vault_default_location'))
      .then(setIosLocation)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!isDesktopApp() || isIOSApp()) return;
    void defaultNewVaultPath().then(setDefaultPath).catch(() => {});
    void Promise.all(
      getRecentVaults().map(async (path) => ({
        path,
        ok: await inspectFolder(path).then((i) => i.exists).catch(() => false),
      })),
    ).then(setRecent);
  }, []);

  if (!isDesktopApp()) return <Navigate to="/" replace />;

  const run = async (key: string, fn: () => Promise<string | null>) => {
    setError('');
    setBusy(key);
    try {
      const path = await fn();
      if (path) {
        // Make sure the folder exists (a new vault) before the app reloads into it.
        const { TauriVaultFS } = await import('../lib/vault/fs');
        await TauriVaultFS.open(path, { create: true });
        openVaultAndReload(path);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };

  const card = 'w-full text-left p-5 rounded-xl transition-all hover:scale-[1.005] disabled:opacity-60';
  const cardStyle = { backgroundColor: '#101010', border: '1px solid #1d1d1d' };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: '#0a0a0a', color: '#e5e5e5' }}>
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center mb-8">
          <img src="/FlowIcon-App.png" alt="" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 6px 20px rgba(0, 0, 0, 0.5))' }} />
          <h1 className="text-3xl font-light mb-2" style={{ letterSpacing: '-0.02em' }}>Welcome to Flow</h1>
          <p className="text-sm" style={{ color: '#8a8a8a' }}>Choose where your notes live. You can change this later in Settings.</p>
        </div>

        {isIOSApp() ? (
          <div className="flex flex-col gap-3">
            <button
              className={card}
              style={cardStyle}
              disabled={!!busy || !iosLocation}
              onClick={() => run('ios', async () => iosLocation?.path ?? null)}
            >
              <div className="flex items-start gap-4">
                {iosLocation?.icloud === false ? (
                  <HardDrive className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                ) : (
                  <Cloud className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                )}
                <div>
                  <h2 className="text-base font-medium mb-1">
                    {busy === 'ios' ? 'Opening…' : iosLocation?.icloud === false ? 'Keep notes on this iPhone' : 'Use my iCloud vault'}
                  </h2>
                  <p className="text-sm" style={{ color: '#8a8a8a', lineHeight: 1.55 }}>
                    {!iosLocation
                      ? 'Finding your iCloud Drive…'
                      : iosLocation.icloud
                        ? 'Your vault lives in iCloud Drive → Flow Notes → Flow Vault and syncs with Flow on your computer. Open that folder in the desktop app (Settings → Data & Sync → Switch vault) to use the same notes.'
                        : "iCloud Drive isn't available, so notes stay on this iPhone. Turn on iCloud Drive in Settings to sync with your computer."}
                  </p>
                </div>
              </div>
            </button>
          </div>
        ) : (
        <div className="flex flex-col gap-3">
          <div className={card} style={cardStyle}>
            <div className="flex items-start gap-4">
              <HardDrive className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-medium mb-1">Create a local vault</h2>
                <p className="text-sm mb-4" style={{ color: '#8a8a8a', lineHeight: 1.55 }}>
                  Notes are saved as files in a folder on this computer. No account, works offline, nothing stored in the cloud.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!!busy || !defaultPath}
                    onClick={() => run('default', async () => defaultPath)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)' }}
                  >
                    {busy === 'default' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                    Create in Documents
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() => run('choose', chooseNewVaultLocation)}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
                  >
                    {busy === 'choose' ? 'Choosing…' : 'Choose location…'}
                  </button>
                </div>
                {defaultPath && (
                  <p className="text-xs mt-3 truncate font-mono" style={{ color: '#5f5f5f' }} title={defaultPath}>
                    {defaultPath}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button className={card} style={cardStyle} disabled={!!busy} onClick={() => run('open', chooseExistingVault)}>
            <div className="flex items-start gap-4">
              <FolderOpen className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
              <div>
                <h2 className="text-base font-medium mb-1">{busy === 'open' ? 'Opening…' : 'Open a vault'}</h2>
                <p className="text-sm" style={{ color: '#8a8a8a', lineHeight: 1.55 }}>
                  A vault copied from another computer, a downloaded "Flow Vault" zip (unzipped), or one kept in iCloud Drive, Dropbox or OneDrive.
                </p>
              </div>
            </div>
          </button>

          {hasCloudConfig && (
            <button className={card} style={cardStyle} disabled={!!busy} onClick={switchToCloudAndReload}>
              <div className="flex items-start gap-4">
                <Cloud className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                <div>
                  <h2 className="text-base font-medium mb-1">Sign in to Flow Cloud</h2>
                  <p className="text-sm" style={{ color: '#8a8a8a', lineHeight: 1.55 }}>
                    Use your Flow account and sync with flow-notes.app. You can move your cloud notes into a vault from Settings.
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>
        )}

        {error && (
          <p className="mt-4 text-sm px-4 py-3 rounded-lg" style={{ color: '#fca5a5', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </p>
        )}

        {recent.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs uppercase tracking-wider mb-2 px-1" style={{ color: '#5f5f5f' }}>Recent vaults</h3>
            <div className="flex flex-col gap-1">
              {recent.map(({ path, ok }) => (
                <button
                  key={path}
                  disabled={!ok || !!busy}
                  onClick={() => run(path, async () => path)}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
                  title={ok ? path : `Not found: ${path}`}
                >
                  <span className="text-sm truncate">{vaultDisplayName(path)}</span>
                  <span className="text-xs truncate font-mono" style={{ color: '#5f5f5f', maxWidth: '60%' }}>
                    {ok ? path : 'not found'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
