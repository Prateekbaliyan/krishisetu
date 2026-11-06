import { db } from './db';
import { api } from './api';
import { OfflineQueueItem } from '../types';

export class SyncManager {
  private static isSyncing = false;
  private static listeners: Array<(status: { isSyncing: boolean; queueCount: number }) => void> = [];

  public static subscribe(listener: (status: { isSyncing: boolean; queueCount: number }) => void) {
    this.listeners.push(listener);
    this.notify();
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static async notify() {
    const queueCount = await db.offlineQueue.count();
    for (const listener of this.listeners) {
      listener({ isSyncing: this.isSyncing, queueCount });
    }
  }

  /**
   * Enqueues an offline purchase into Dexie IndexedDB
   */
  public static async enqueuePurchase(item: Omit<OfflineQueueItem, 'id' | 'status' | 'retryCount'>): Promise<OfflineQueueItem> {
    const queueItem: OfflineQueueItem = {
      ...item,
      status: 'QUEUED',
      retryCount: 0
    };

    const id = await db.offlineQueue.add(queueItem);
    await this.notify();
    return { ...queueItem, id };
  }

  /**
   * Syncs all queued purchases with the central backend server
   */
  public static async processSyncQueue(): Promise<{
    success: boolean;
    syncedCount: number;
    failedCount: number;
    duplicateCount: number;
    errors: string[];
  }> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, failedCount: 0, duplicateCount: 0, errors: ['Sync already in progress'] };
    }

    const queuedItems = await db.offlineQueue.toArray();
    if (queuedItems.length === 0) {
      await this.notify();
      return { success: true, syncedCount: 0, failedCount: 0, duplicateCount: 0, errors: [] };
    }

    this.isSyncing = true;
    await this.notify();

    const clientId = localStorage.getItem('krishisetu_device_id') || `client-dev-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('krishisetu_device_id', clientId);

    const errors: string[] = [];
    let syncedCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;

    try {
      // Mark all items as SYNCING in IndexedDB
      await db.offlineQueue.where('id').anyOf(queuedItems.map(i => i.id!)).modify({ status: 'SYNCING' });

      // Send batch to server
      const response = await api.syncBatch({
        clientId,
        items: queuedItems.map(q => ({
          idempotencyKey: q.idempotencyKey,
          clientId,
          farmerId: q.farmerId,
          centreId: q.centreId,
          crop: q.crop,
          grade: q.grade,
          grossWeight: q.grossWeight,
          tareWeight: q.tareWeight,
          moisture: q.moisture,
          ratePerQuintal: q.ratePerQuintal,
          scalePhotoUrl: q.scalePhotoUrl,
          moisturePhotoUrl: q.moisturePhotoUrl,
          scaleAiWeight: q.scaleAiWeight,
          moistureAiValue: q.moistureAiValue,
          aiConfidence: q.aiConfidence,
          aiVerificationStatus: q.aiVerificationStatus,
          aiDiffNotes: q.aiDiffNotes,
          clientDeviceTimestamp: q.clientDeviceTimestamp,
          localCreationTimestamp: q.localCreationTimestamp
        }))
      });

      if (response && response.results) {
        for (const res of response.results) {
          const original = queuedItems.find(q => q.idempotencyKey === res.idempotencyKey);
          if (!original || !original.id) continue;

          if (res.status === 'SYNCED' || res.status === 'DUPLICATE_SKIPPED') {
            // Successfully processed or acknowledged duplicate: safe to remove from local queue
            await db.offlineQueue.delete(original.id);
            if (res.status === 'SYNCED') syncedCount++;
            if (res.status === 'DUPLICATE_SKIPPED') duplicateCount++;
          } else {
            // Failed: mark in local queue with error message for operator retry
            await db.offlineQueue.update(original.id, {
              status: 'FAILED',
              syncError: res.error || 'Server validation failed during sync',
              retryCount: (original.retryCount || 0) + 1
            });
            failedCount++;
            errors.push(res.error || 'Validation error');
          }
        }
      }
    } catch (err: any) {
      console.error('Offline batch sync error:', err);
      // Revert items to QUEUED with retry count incremented
      for (const item of queuedItems) {
        if (item.id) {
          await db.offlineQueue.update(item.id, {
            status: 'QUEUED',
            syncError: err.message || 'Network disconnected. Auto-retry pending.'
          });
        }
      }
      errors.push(err.message || 'Network unreachable');
    } finally {
      this.isSyncing = false;
      await this.notify();
    }

    return {
      success: errors.length === 0,
      syncedCount,
      failedCount,
      duplicateCount,
      errors
    };
  }

  /**
   * Refreshes offline master data caches (Farmers, Daily Prices)
   */
  public static async refreshOfflineCaches(): Promise<void> {
    try {
      const [farmersRes, pricesRes] = await Promise.all([
        api.getFarmers(),
        api.getActivePrices()
      ]);

      if (farmersRes.farmers) {
        await db.cachedFarmers.clear();
        await db.cachedFarmers.bulkPut(farmersRes.farmers);
      }

      if (pricesRes.prices) {
        await db.cachedPrices.clear();
        await db.cachedPrices.bulkPut(pricesRes.prices);
      }
    } catch (err) {
      // Ignore cache refresh failures if offline
    }
  }
}

