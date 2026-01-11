import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { db } from '../lib/db';

export const SyncStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const checkPendingItems = async () => {
      const count = await db.outbox.count();
      setPendingCount(count);
    };

    // Update online status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check pending items periodically
    checkPendingItems();
    const interval = setInterval(checkPendingItems, 2000);

    // Listen for sync events
    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => {
      setIsSyncing(false);
      checkPendingItems();
    };

    window.addEventListener('syncStart', handleSyncStart);
    window.addEventListener('syncEnd', handleSyncEnd);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('syncStart', handleSyncStart);
      window.removeEventListener('syncEnd', handleSyncEnd);
      clearInterval(interval);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20" title={`Offline${pendingCount > 0 ? ` - ${pendingCount} pending` : ''}`}>
        <WifiOff className="w-4 h-4 text-orange-400" />
        {pendingCount > 0 && (
          <span className="text-xs text-orange-400/70">{pendingCount}</span>
        )}
      </div>
    );
  }

  if (isSyncing || pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20" title={`Syncing${pendingCount > 0 ? ` - ${pendingCount} items` : '...'}`}>
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        {pendingCount > 0 && (
          <span className="text-xs text-blue-400/70">{pendingCount}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center px-2 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20" title="All changes synced">
      <Wifi className="w-4 h-4 text-green-400" />
    </div>
  );
};
