import { useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { getUpdateState, installAndRestart, subscribeUpdates, type UpdateState } from '../lib/updates';

/** Small corner card once an update has downloaded: one click restarts into it. */
export function UpdateToast() {
  const [s, setS] = useState<UpdateState>(getUpdateState());
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => subscribeUpdates(setS), []);

  if (dismissed || (s.phase !== 'ready' && s.phase !== 'installing')) return null;

  return (
    <div
      data-floating-panel
      className="fixed bottom-4 right-4 z-[9997] flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl text-sm"
      style={{ backgroundColor: 'var(--bg-panel, #161616)', border: '1px solid var(--divider, #2a2a2a)', color: 'var(--text, #e5e5e5)' }}
    >
      <Download className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
      <span>Flow {s.newVersion} is ready</span>
      <button
        type="button"
        disabled={s.phase === 'installing'}
        onClick={() => void installAndRestart()}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-60"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
      >
        {s.phase === 'installing' && <Loader2 className="w-3 h-3 animate-spin" />}
        Restart to update
      </button>
      {s.phase === 'ready' && (
        <button type="button" onClick={() => setDismissed(true)} className="p-0.5 rounded hover:opacity-70" title="Later (it installs next time you click Restart in Settings)">
          <X className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
        </button>
      )}
    </div>
  );
}
