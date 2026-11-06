import React, { createContext, useContext, useState, useEffect } from 'react';
import { SyncManager } from '../services/syncManager';
import { db } from '../services/db';
import { OfflineQueueItem } from '../types';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  queueCount: number;
  failedItems: OfflineQueueItem[];
  triggerSync: () => Promise<void>;
  retryFailedItem: (id: number) => Promise<void>;
  lastSyncMessage: string | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [failedItems, setFailedItems] = useState<OfflineQueueItem[]>([]);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  const refreshQueueState = async () => {
    const count = await db.offlineQueue.count();
    const failed = await db.offlineQueue.where('status').equals('FAILED').toArray();
    setQueueCount(count);
    setFailedItems(failed);
  };

  useEffect(() => {
    refreshQueueState();

    const unsubscribe = SyncManager.subscribe(({ isSyncing: syncing, queueCount: count }) => {
      setIsSyncing(syncing);
      setQueueCount(count);
      refreshQueueState();
    });

    const handleOnline = async () => {
      setIsOnline(true);
      setLastSyncMessage('Internet connection restored. Starting background sync...');
      // Automatic retry when connectivity returns (as mandated in Section 6)
      const res = await SyncManager.processSyncQueue();
      if (res.syncedCount > 0) {
        setLastSyncMessage(`Auto-synced ${res.syncedCount} queued purchase(s).`);
      }
      refreshQueueState();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastSyncMessage('Device is offline. Purchases will be saved to local queue.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = async () => {
    if (!isOnline) {
      setLastSyncMessage('Cannot sync: Device is offline. Reconnect to internet.');
      return;
    }
    const res = await SyncManager.processSyncQueue();
    if (res.syncedCount > 0 || res.duplicateCount > 0) {
      setLastSyncMessage(`Synced ${res.syncedCount} item(s) successfully.`);
    } else if (res.failedCount > 0) {
      setLastSyncMessage(`Sync completed with ${res.failedCount} error(s). Review failed items.`);
    } else {
      setLastSyncMessage('All transactions are up to date.');
    }
    await refreshQueueState();
  };

  const retryFailedItem = async (id: number) => {
    await db.offlineQueue.update(id, { status: 'QUEUED', syncError: undefined });
    await triggerSync();
  };

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        queueCount,
        failedItems,
        triggerSync,
        retryFailedItem,
        lastSyncMessage
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

