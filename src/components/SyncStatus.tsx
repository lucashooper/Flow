import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';

export const SyncStatus = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const checkStatus = async () => {
      const [outbox, unsyncedNotes, unsyncedFolders] = await Promise.all([
        db.outbox.count(),
        user?.id
          ? db.notes.where('user_id').equals(user.id).filter(n => !n.synced).count()
          : Promise.resolve(0),
        user?.id
          ? db.folders.where('user_id').equals(user.id).filter(f => !f.synced).count()
          : Promise.resolve(0),
      ]);
      setPendingCount(outbox);
      setUnsyncedCount(unsyncedNotes + unsyncedFolders);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    checkStatus();
    const interval = setInterval(checkStatus, 2000);

    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => {
      setIsSyncing(false);
      checkStatus();
    };

    window.addEventListener('syncStart', handleSyncStart);
    window.addEventListener('syncEnd', handleSyncEnd);
    window.addEventListener('dataReconciled', handleSyncEnd);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('syncStart', handleSyncStart);
      window.removeEventListener('syncEnd', handleSyncEnd);
      window.removeEventListener('dataReconciled', handleSyncEnd);
      clearInterval(interval);
    };
  }, [user?.id]);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20" title={`Offline${pendingCount > 0 ? ` - ${pendingCount} pending upload` : ''}`}>
        <WifiOff className="w-4 h-4 text-orange-400" />
        {(pendingCount > 0 || unsyncedCount > 0) && (
          <span className="text-xs text-orange-400/70">{pendingCount + unsyncedCount}</span>
        )}
      </div>
    );
  }

  if (isSyncing || pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20" title={`Uploading${pendingCount > 0 ? ` - ${pendingCount} items` : '...'}`}>
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        {pendingCount > 0 && (
          <span className="text-xs text-blue-400/70">{pendingCount}</span>
        )}
      </div>
    );
  }

  if (unsyncedCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20" title={`${unsyncedCount} item(s) not yet confirmed on server`}>
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        <span className="text-xs text-yellow-400/70">{unsyncedCount}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center px-2 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20" title="All changes saved to cloud">
      <Wifi className="w-4 h-4 text-green-400" />
    </div>
  );
};
