import { useState, useEffect } from 'react';
import { RefreshCw, Search, AlertTriangle, CheckCircle, CloudDownload, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { forceResync } from '../lib/dataAccess';
import { repairOutboxPayloads } from '../lib/syncPayloads';
import {
  getSyncHealth,
  downloadAllFromCloud,
  replaceLocalCacheFromCloud,
  recoverWipedNotesFromServer,
  searchServerNotes,
  isSyncAdmin,
  type SyncHealthReport,
  type CloudRestoreResult,
} from '../lib/syncHealth';

function formatRestoreResult(result: CloudRestoreResult): string {
  const parts: string[] = [];
  if (result.notesAdded > 0) parts.push(`${result.notesAdded} note(s) added`);
  if (result.notesUpdated > 0) parts.push(`${result.notesUpdated} note(s) updated from cloud`);
  if (result.foldersAdded > 0) parts.push(`${result.foldersAdded} folder(s) added`);
  if (result.foldersUpdated > 0) parts.push(`${result.foldersUpdated} folder(s) updated`);
  parts.push(`Fetched ${result.notesFetched} notes from cloud`);
  return parts.join(' · ');
}

function hadRestoreChanges(result: CloudRestoreResult): boolean {
  return (
    result.notesAdded > 0 ||
    result.notesUpdated > 0 ||
    result.foldersAdded > 0 ||
    result.foldersUpdated > 0
  );
}

export const SyncDiagnostics = () => {
  const { user } = useAuth();
  const isAdmin = isSyncAdmin(user?.email);
  const [health, setHealth] = useState<SyncHealthReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const loading = refreshing || actionLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; dashboard_id: string | null; folder_id: string | null; snippet: string }>>([]);

  const refreshHealth = async () => {
    if (!user?.id || !navigator.onLine) return;
    setRefreshing(true);
    try {
      const report = await getSyncHealth(user.id);
      setHealth(report);
    } catch (e) {
      console.error('Failed to load sync health:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const showActionMessage = (message: string) => {
    setActionMessage(message);
    requestAnimationFrame(() => {
      document.getElementById('sync-action-message')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 10000);
    const onSyncEnd = () => refreshHealth();
    window.addEventListener('syncEnd', onSyncEnd);
    return () => {
      clearInterval(interval);
      window.removeEventListener('syncEnd', onSyncEnd);
    };
  }, [user?.id]);

  const finishRestoreAction = async (result: CloudRestoreResult, emptyMessage: string) => {
    if (hadRestoreChanges(result)) {
      showActionMessage(`${formatRestoreResult(result)}. Reloading…`);
      window.dispatchEvent(new CustomEvent('dataReconciled', { detail: result }));
      await refreshHealth();
      setTimeout(() => window.location.reload(), 1200);
    } else {
      showActionMessage(emptyMessage);
      await refreshHealth();
    }
  };

  const handleRetryUploads = async () => {
    if (!user?.id || actionLoading) return;
    setActionLoading(true);
    showActionMessage('Starting upload…');
    try {
      const repaired = await repairOutboxPayloads();
      window.dispatchEvent(new Event('requestSync'));
      showActionMessage(
        repaired > 0
          ? `Fixed ${repaired} queued item(s) and started upload. Watch the sync indicator in the sidebar.`
          : 'Upload started. Watch the sync indicator in the sidebar.',
      );
      setTimeout(refreshHealth, 3000);
    } catch {
      showActionMessage('Retry failed. Check your connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!user?.id || actionLoading) return;
    setActionLoading(true);
    showActionMessage('Downloading all notes from cloud (paginated — may take 30–60 seconds for 1000+ notes)…');
    try {
      const result = await downloadAllFromCloud(user.id);
      await finishRestoreAction(
        result,
        `Fetched ${result.notesFetched} cloud notes but merged 0 changes. If counts still differ, use "Replace local cache from cloud" (you likely need the latest app version — hard refresh with Cmd+Shift+R).`,
      );
    } catch (e) {
      console.error('[SyncDiagnostics] restore failed:', e);
      showActionMessage('Restore failed. Check your connection and try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecoverWipedNotes = async () => {
    if (!user?.id || actionLoading) return;
    setActionLoading(true);
    showActionMessage('Scanning cloud for wiped or corrupted notes…');
    try {
      const result = await recoverWipedNotesFromServer(user.id);
      if (result.restored > 0) {
        showActionMessage(`Recovered ${result.restored} of ${result.examined} cloud notes. Reloading…`);
        window.dispatchEvent(new CustomEvent('dataReconciled', { detail: result }));
        await refreshHealth();
        setTimeout(() => window.location.reload(), 1200);
      } else {
        showActionMessage(
          `Scanned ${result.examined} cloud notes — none matched wipe recovery. Use "Download all from cloud" or "Replace local cache".`,
        );
        await refreshHealth();
      }
    } catch (e) {
      console.error('[SyncDiagnostics] wipe recovery failed:', e);
      showActionMessage('Recovery failed. Check your connection and try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplaceFromCloud = async () => {
    if (!user?.id || actionLoading) return;
    if (
      !confirm(
        'Replace ALL local notes and folders with cloud copies? Unsynced local-only changes will be discarded. Your cloud data is kept safe.',
      )
    ) {
      return;
    }
    setActionLoading(true);
    showActionMessage('Replacing local cache from cloud (downloading all pages)…');
    try {
      const result = await replaceLocalCacheFromCloud(user.id);
      showActionMessage(`${formatRestoreResult(result)}. Reloading…`);
      window.dispatchEvent(new CustomEvent('dataReconciled', { detail: result }));
      await refreshHealth();
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      console.error('[SyncDiagnostics] replace failed:', e);
      showActionMessage('Replace failed. Check your connection and try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceResync = async () => {
    if (!user?.id || actionLoading) return;
    if (
      !confirm(
        'Download everything from Supabase and replace local cache? Local changes waiting to upload will NOT be pushed first.',
      )
    ) {
      return;
    }
    setActionLoading(true);
    showActionMessage('Full download from cloud…');
    try {
      await forceResync(user.id, { uploadLocalFirst: false });
      showActionMessage('Full resync complete. Reloading…');
      window.dispatchEvent(new Event('dataReconciled'));
      await refreshHealth();
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error('[SyncDiagnostics] force resync failed:', e);
      showActionMessage('Force resync failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!user?.id || !searchQuery.trim() || actionLoading) return;
    setActionLoading(true);
    showActionMessage('Searching cloud notes…');
    try {
      const results = await searchServerNotes(user.id, searchQuery);
      setSearchResults(results);
      showActionMessage(results.length > 0 ? `Found ${results.length} match(es) on Supabase.` : 'No matches on Supabase.');
    } catch {
      setSearchResults([]);
      showActionMessage('Search failed. Check your connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const hasUploadIssues = health && (health.outboxPending > 0 || health.localNotes > health.serverNotes || health.localFolders > health.serverFolders);
  const hasDownloadIssues = health && (health.missingLocally.notes > 0 || health.missingLocally.folders > 0);

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Notes save locally first, then upload to Supabase. If counts differ, use the restore buttons below — they fetch{' '}
        <strong>all</strong> cloud rows (Supabase limits queries to 1000 at a time, so we paginate automatically).
      </p>

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
              Queued for upload: {health.outboxPending}
            </div>
            <div style={{ color: 'var(--muted)' }}>
              Unconfirmed on server: {health.unsyncedNotes + health.unsyncedFolders}
            </div>
          </div>

          {health.issues.length > 0 && (
            <ul className="text-sm space-y-1 mb-3">
              {health.issues.map((issue) => (
                <li key={issue} className="text-orange-400">• {issue}</li>
              ))}
            </ul>
          )}

          {health.pendingUploads.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Waiting to upload:</p>
              <ul className="text-sm space-y-0.5">
                {health.pendingUploads.map((item) => (
                  <li key={item.entityId} style={{ color: 'var(--text)' }}>
                    {item.entityType === 'folder' ? '📁' : '📝'} {item.name}
                    {item.attempts > 0 && (
                      <span className="text-orange-400 text-xs ml-2">({item.attempts} failed attempt{item.attempts > 1 ? 's' : ''})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={refreshHealth}
            disabled={loading}
            className="text-sm flex items-center gap-1.5"
            style={{ color: 'var(--accent)' }}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh status
          </button>
        </div>
      )}

      <div className="space-y-3">
        {(hasDownloadIssues || health?.missingLocally.notes) && (
          <div
            className="p-3 rounded-lg border"
            style={{ borderColor: 'rgba(251, 146, 60, 0.4)', backgroundColor: 'rgba(251, 146, 60, 0.08)' }}
          >
            <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>
              Cloud has {health?.missingLocally.notes ?? 0} note(s) not on this device. Click below to download them.
            </p>
            <button
              onClick={handleRestoreFromCloud}
              disabled={loading || !navigator.onLine}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              <CloudDownload className="w-4 h-4" />
              Download all from cloud (merge)
            </button>
          </div>
        )}

        <button
          onClick={handleReplaceFromCloud}
          disabled={loading || !navigator.onLine}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          <CloudDownload className="w-4 h-4" />
          Replace local cache from cloud (recommended if notes were wiped)
        </button>

        <button
          onClick={handleRecoverWipedNotes}
          disabled={loading || !navigator.onLine}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center"
          style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--divider)' }}
        >
          <CloudDownload className="w-4 h-4" />
          Recover wiped notes only
        </button>

        {hasUploadIssues && (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
              Upload issues — local changes not yet saved to Supabase
            </p>
            <button
              onClick={handleRetryUploads}
              disabled={loading || !navigator.onLine}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center"
              style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--divider)' }}
            >
              <Upload className="w-4 h-4" />
              Retry uploads to cloud
            </button>
          </div>
        )}

        {!hasUploadIssues && !hasDownloadIssues && (
          <button
            onClick={handleRetryUploads}
            disabled={loading || !navigator.onLine}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center"
            style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--divider)' }}
          >
            <Upload className="w-4 h-4" />
            Sync now
          </button>
        )}

        <button
          onClick={handleForceResync}
          disabled={loading || !navigator.onLine}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center"
          style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--divider)' }}
        >
          <RefreshCw className="w-4 h-4" />
          Full resync from cloud (same as replace)
        </button>
      </div>

      {(actionMessage || actionLoading) && (
        <p
          id="sync-action-message"
          className="text-sm p-3 rounded-lg"
          style={{ color: 'var(--text)', backgroundColor: 'var(--bg-elev)' }}
        >
          {actionLoading && !actionMessage ? 'Working…' : actionMessage}
        </p>
      )}

      <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--divider)' }}>
        <h4 className="font-medium" style={{ color: 'var(--text)' }}>Search cloud backups</h4>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Verify your content still exists on Supabase before replacing local data.
        </p>
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
          <p className="text-sm text-orange-400">
            No matches on Supabase — content may not have been uploaded before the wipe.
          </p>
        )}
        {searchResults.length > 0 && (
          <ul className="space-y-2">
            {searchResults.map((r) => (
              <li key={r.id} className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-elev)' }}>
                <div className="font-medium" style={{ color: 'var(--text)' }}>{r.title}</div>
                <div className="text-xs mt-1 truncate" style={{ color: 'var(--muted)' }}>{r.snippet}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
                {health.dashboardBreakdown.map((row) => (
                  <tr key={row.dashboardId ?? 'null'} style={{ color: 'var(--text)' }}>
                    <td className="py-1.5 pr-4">{row.dashboardName}</td>
                    <td className="py-1.5 pr-4">{row.localNotes} / {row.serverNotes}</td>
                    <td className="py-1.5">{row.localFolders} / {row.serverFolders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};
