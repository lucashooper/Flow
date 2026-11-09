import { useEffect, useState } from 'react';
import { CheckCircle2, Download, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { ApiKeyForm } from '../learning/ExplainBack';
import { checkForUpdates, getUpdateState, installAndRestart, subscribeUpdates, type UpdateState } from '../../lib/updates';

const card = { backgroundColor: 'var(--bg-elev)', border: '1px solid var(--divider)' };
const smallBtn = 'px-3 py-1.5 rounded-lg text-xs font-medium';

/** Settings → Learning & AI: the Anthropic API key used by Explain it back and Quiz me. */
export function LearningSettings() {
  const [status, setStatus] = useState<boolean | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState('');
  const refresh = () =>
    import('../../lib/ai/claude')
      .then(({ hasApiKey }) => hasApiKey())
      .then(setStatus)
      .catch((e) => {
        setStatus(false);
        setError(String(e));
      });
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl p-5" style={card}>
        <div className="flex items-start gap-3 mb-3">
          <KeyRound className="w-5 h-5 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Anthropic API key</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Used by 🧑‍🏫 Explain it back (Claude Opus 5.5) and 🃏 Quiz me (Claude Haiku 5.5). It's kept in your system's keychain,
              never in your vault, and only ever sent to Anthropic. Usage is billed to your Anthropic account.
            </p>
          </div>
        </div>
        {status === null ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--muted)' }} />
        ) : status && !replacing ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--bg-panel)' }}>
            <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: '#4ade80' }} /> Key saved
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setReplacing(true)} className={smallBtn} style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }}>
                Replace
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { removeApiKey } = await import('../../lib/ai/claude');
                  await removeApiKey();
                  void refresh();
                }}
                className={smallBtn}
                style={{ backgroundColor: 'var(--bg-elev)', color: '#f87171' }}
              >
                Remove
              </button>
            </span>
          </div>
        ) : (
          <ApiKeyForm
            onSaved={() => {
              setReplacing(false);
              setError('');
              void refresh();
            }}
          />
        )}
        {error && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>}
      </div>
    </div>
  );
}

/** Settings → Updates (desktop app). */
export function UpdatesSettings() {
  const [s, setS] = useState<UpdateState>(getUpdateState());
  useEffect(() => subscribeUpdates(setS), []);
  useEffect(() => {
    if (!getUpdateState().currentVersion) void import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then((v) => setS((p) => ({ ...p, currentVersion: v })));
  }, []);

  const busy = s.phase === 'checking' || s.phase === 'downloading' || s.phase === 'installing';
  const label: Record<UpdateState['phase'], string> = {
    idle: 'Flow checks for updates automatically when it starts.',
    checking: 'Checking for updates…',
    'up-to-date': "You're on the latest version.",
    downloading: `Downloading Flow ${s.newVersion}… ${s.progress != null ? Math.round(s.progress * 100) + '%' : ''}`,
    ready: `Flow ${s.newVersion} is downloaded and ready.`,
    installing: 'Installing… Flow will restart.',
    error: `Couldn't check for updates: ${s.error ?? 'unknown error'}`,
  };

  return (
    <div className="rounded-xl p-5" style={card}>
      <div className="flex items-start gap-3 mb-4">
        <Download className="w-5 h-5 mt-0.5" style={{ color: 'var(--accent)' }} />
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Flow Notes {s.currentVersion ? `v${s.currentVersion}` : ''}
          </h3>
          <p className="text-sm mt-1" style={{ color: s.phase === 'error' ? '#f87171' : 'var(--muted)' }}>{label[s.phase]}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {s.phase === 'ready' || s.phase === 'installing' ? (
          <button
            type="button"
            disabled={s.phase === 'installing'}
            onClick={() => void installAndRestart()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {s.phase === 'installing' && <Loader2 className="w-4 h-4 animate-spin" />} Restart to update
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void checkForUpdates()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check for updates
          </button>
        )}
      </div>
    </div>
  );
}
