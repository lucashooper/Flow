import { useState } from 'react';
import { Download, ExternalLink, FolderOpen, HardDrive, Loader2, MonitorDown, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ALL_RELEASES_URL, detectDesktopOS, DESKTOP_DOWNLOADS } from '../lib/downloads';
import {
  closeVaultAndReload,
  getVaultPath,
  isDesktopApp,
  isVaultMode,
  isWindowsPlatform,
  openVaultAndReload,
} from '../lib/platform';
import type { ExportProgress } from '../lib/vault/exportCloud';

const box = { backgroundColor: 'var(--bg-elev)', border: '1px solid var(--divider)' };
const primaryBtn = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60';
const secondaryBtn = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60';

function progressText(p: ExportProgress | null) {
  if (!p) return '';
  return p.total ? `${p.step} ${p.done ?? 0}/${p.total}` : p.step;
}

/** "Data & Sync" → where notes are stored: local vault vs Flow Cloud. */
export function StorageSettings() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const desktop = isDesktopApp();
  const fileManager = isWindowsPlatform() ? 'File Explorer' : /Mac/i.test(navigator.userAgent) ? 'Finder' : 'Files';

  // ------------------------------------------------------------ vault mode
  if (isVaultMode()) {
    const path = getVaultPath() || '';
    return (
      <div className="rounded-xl p-5 mb-6" style={box}>
        <div className="flex items-start gap-3 mb-4">
          <HardDrive className="w-5 h-5 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div className="min-w-0">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Local vault</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Your notes are saved as files on this computer. Nothing is stored in Flow Cloud.
            </p>
            <p className="text-xs mt-2 font-mono break-all" style={{ color: 'var(--muted)' }}>{path}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className={secondaryBtn}
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
            onClick={async () => {
              const { revealVaultFolder } = await import('../lib/vault/picker');
              revealVaultFolder(path).catch((e) => setError(String(e)));
            }}
          >
            <FolderOpen className="w-4 h-4" /> Show in {fileManager}
          </button>
          <button
            className={secondaryBtn}
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
            onClick={closeVaultAndReload}
          >
            <RefreshCw className="w-4 h-4" /> Switch vault or use Flow Cloud
          </button>
        </div>
        <div className="text-sm rounded-lg p-4" style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--muted)', lineHeight: 1.6 }}>
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Using this vault on another computer</p>
          Copy this folder to the other computer (USB stick, AirDrop, email…) and choose <em>Open a vault</em> in Flow there.
          To keep computers in sync automatically, put the vault inside iCloud Drive, Dropbox, OneDrive or Google Drive.
          Each note is its own file, and the folder is your backup.
        </div>
        {error && <p className="text-sm mt-3" style={{ color: '#f87171' }}>{error}</p>}
      </div>
    );
  }

  // ------------------------------------------------------------ cloud mode
  const exportToVault = async () => {
    if (!user) return;
    setError('');
    setMessage('');
    const { chooseNewVaultLocation } = await import('../lib/vault/picker');
    const target = await chooseNewVaultLocation().catch((e) => {
      setError(String(e));
      return null;
    });
    if (!target) return;
    setBusy(true);
    try {
      const { TauriVaultFS } = await import('../lib/vault/fs');
      const { writeCloudDataToVault } = await import('../lib/vault/exportCloud');
      const fs = await TauriVaultFS.open(target, { create: true });
      const result = await writeCloudDataToVault(fs, user.id, setProgress);
      setMessage(`Copied ${result.notes} notes and ${result.images} images. Opening your vault…`);
      setTimeout(() => openVaultAndReload(target), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
    setProgress(null);
  };

  const downloadZip = async () => {
    if (!user) return;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const { downloadVaultZip } = await import('../lib/vault/exportCloud');
      const result = await downloadVaultZip(user.id, setProgress);
      setMessage(
        `Downloaded ${result.notes} notes and ${result.images} images${result.failedImages ? ` (${result.failedImages} images couldn't be copied and keep their online link)` : ''}.` +
          (result.usedOfflineCopy ? ' Flow Cloud was unreachable, so the copy saved in this browser was used.' : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const os = detectDesktopOS();

  return (
    <div className="rounded-xl p-5 mb-6" style={box}>
      <div className="flex items-start gap-3 mb-4">
        <HardDrive className="w-5 h-5 mt-0.5" style={{ color: 'var(--accent)' }} />
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Keep your notes on your computer</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            {desktop
              ? 'Copy everything from Flow Cloud into a local vault: a folder where each note is a file. You can switch back any time.'
              : 'The Flow desktop app can keep your notes as files in a folder on your computer (a "vault") instead of in Flow Cloud. Download your notes as a vault, unzip it, and open it in the app.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {desktop ? (
          <>
            <button
              disabled={busy}
              onClick={exportToVault}
              className={primaryBtn}
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              Move my notes to a local vault
            </button>
            <button
              disabled={busy}
              onClick={closeVaultAndReload}
              className={secondaryBtn}
              style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
            >
              <FolderOpen className="w-4 h-4" /> Open an existing vault
            </button>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={downloadZip}
              className={primaryBtn}
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download my notes as a vault (.zip)
            </button>
            <a
              href={os ? DESKTOP_DOWNLOADS[os].url : ALL_RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className={secondaryBtn}
              style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
            >
              <MonitorDown className="w-4 h-4" /> Get the desktop app{os ? ` for ${DESKTOP_DOWNLOADS[os].label}` : ''}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </>
        )}
      </div>

      {busy && progress && <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>{progressText(progress)}</p>}
      {message && <p className="text-sm mt-3" style={{ color: '#4ade80' }}>{message}</p>}
      {error && <p className="text-sm mt-3" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}
