import { AlertTriangle, FolderOpen, RefreshCw } from 'lucide-react';
import { closeVaultAndReload, getVaultPath } from '../lib/platform';

/** Shown when the desktop app can't open the selected vault (moved, deleted, unplugged drive…). */
export function VaultOpenError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  const path = getVaultPath();

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#0a0a0a', color: '#e5e5e5' }}>
      <div className="w-full max-w-md rounded-2xl p-8" style={{ backgroundColor: '#111', border: '1px solid #1f1f1f' }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(251, 146, 60, 0.12)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: '#fb923c' }} />
        </div>
        <h1 className="text-xl font-semibold mb-2">Couldn't open your vault</h1>
        <p className="text-sm mb-4" style={{ color: '#9a9a9a', lineHeight: 1.6 }}>{message}</p>
        {path && (
          <p className="text-xs mb-6 break-all font-mono px-3 py-2 rounded-lg" style={{ color: '#8a8a8a', backgroundColor: '#0c0c0c', border: '1px solid #1f1f1f' }}>
            {path}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
          <button
            onClick={closeVaultAndReload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)' }}
          >
            <FolderOpen className="w-4 h-4" /> Choose another vault
          </button>
        </div>
      </div>
    </div>
  );
}
