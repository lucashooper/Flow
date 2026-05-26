import { useState, useEffect } from 'react';
import { RefreshCw, Search, AlertTriangle, CheckCircle, CloudDownload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { forceResync } from '../lib/dataAccess';
import {
  getSyncHealth,
  reconcileFromServer,
  searchServerNotes,
  isSyncAdmin,
  type SyncHealthReport,
} from '../lib/syncHealth';

export const SyncDiagnostics = () => {
  const { user } = useAuth();
  const isAdmin = isSyncAdmin(user?.email);
  const [health, setHealth] = useState<SyncHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; dashboard_id: string | null; folder_id: string | null; snippet: string }>>([]);

  const refreshHealth = async () => {
    if (!user?.id || !navigator.onLine) return;
    setLoading(true);
    try {
      const report = await getSyncHealth(user.id);
      setHealth(report);
    } catch (e) {
      console.error('Failed to load sync health:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleRestoreFromCloud = async () => {
    if (!user?.id) return;
    setLoading(true);
    setActionMessage('');
    try {
      const result = await reconcileFromServer(user.id);
      setActionMessage(`Restored ${result.notesAdded} note(s) and ${result.foldersAdded} folder(s) from cloud.`);
      window.dispatchEvent(new CustomEvent('dataReconciled', { detail: result }));
      await refreshHealth();
    } catch (e) {
      setActionMessage('Restore failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceResync = async () => {
    if (!user?.id) return;
    if (!confirm('This clears local cache and re-downloads everything from Supabase. Continue?')) return;
    setLoading(true);
    setActionMessage('');
    try {
      await forceResync(user.id);
      setActionMessage('Full resync complete. Reloading...');
      window.dispatchEvent(new Event('dataReconciled'));
      await refreshHealth();
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setActionMessage('Force resync failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!user?.id || !searchQuery.trim()) return;
    setLoading(true);
    try {
      const results = await searchServerNotes(user.id, searchQuery);
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>Data & Sync</h3>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Notes are saved locally first, then uploaded to Supabase. Use these tools if something looks missing.
        </p>
      </div>

      {health && (
        <div
          className="p-4 rounded-lg border"
          style={{ borderColor: 'var(--divider)', backgroundColor: 'var(--bg-elev)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            {health.healthy ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            )}
            <span className="font-medium" style={{ color: 'var(--text)' }}>
              {health.healthy ? 'Local and cloud are in sync' : 'Sync issues detected'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div style={{ color: 'var(--muted)' }}>
              Notes: {health.localNotes} local / {health.serverNotes} cloud
            </div>
            <div style={{ color: 'var(--muted)' }}>
              Folders: {health.localFolders} local / {health.serverFolders} cloud
            </div>
            <div style={{ color: 'var(--muted)' }}>
              Pending upload: {health.outboxPending}
            </div>
            <div style={{ color: 'var(--muted)' }}>
              Unconfirmed: {health.unsyncedNotes + health.unsyncedFolders}
            </div>
          </div>

          {health.issues.length > 0 && (
            <ul className="text-sm space-y-1 mb-3">
              {health.issues.map(issue => (
                <li key={issue} className="text-orange-400">• {issue}</li>
              ))}
            </ul>
          )}

          <button
            onClick={refreshHealth}
            disabled={loading}
            className="text-sm flex items-center gap-1.5"
            style={{ color: 'var(--accent)' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh status
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleRestoreFromCloud}
          disabled={loading || !navigator.onLine}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          <CloudDownload className="w-4 h-4" />
          Restore missing from cloud
        </button>
        <button
          onClick={handleForceResync}
          disabled={loading || !navigator.onLine}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--divider)' }}
        >
          <RefreshCw className="w-4 h-4" />
          Full resync from cloud
        </button>
      </div>

      {actionMessage && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{actionMessage}</p>
      )}

      {isAdmin && health && (
        <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--divider)' }}>
          <h4 className="font-medium" style={{ color: 'var(--text)' }}>Admin diagnostics</h4>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="text-left py-2 pr-4">Dashboard</th>
                  <th className="text-left py-2 pr-4">Notes (local/cloud)</th>
                  <th className="text-left py-2">Folders (local/cloud)</th>
                </tr>
              </thead>
              <tbody>
                {health.dashboardBreakdown.map(row => (
                  <tr key={row.dashboardId ?? 'null'} style={{ color: 'var(--text)' }}>
                    <td className="py-1.5 pr-4">{row.dashboardName}</td>
                    <td className="py-1.5 pr-4">{row.localNotes} / {row.serverNotes}</td>
                    <td className="py-1.5">{row.localFolders} / {row.serverFolders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
              Search cloud notes (e.g. Rentierism)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search title or content on Supabase..."
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--divider)' }}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {searchResults.length === 0 && searchQuery && !loading && (
              <p className="text-sm mt-2 text-orange-400">
                No matches on Supabase — this content was likely never uploaded and may be unrecoverable unless you have another device or a Supabase backup.
              </p>
            )}
            {searchResults.length > 0 && (
              <ul className="mt-3 space-y-2">
                {searchResults.map(r => (
                  <li key={r.id} className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-elev)' }}>
                    <div className="font-medium" style={{ color: 'var(--text)' }}>{r.title}</div>
                    <div className="text-xs mt-1 truncate" style={{ color: 'var(--muted)' }}>{r.snippet}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
