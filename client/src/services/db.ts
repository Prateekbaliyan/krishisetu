import Dexie, { Table } from 'dexie';
import { OfflineQueueItem, Farmer, PriceBoardItem } from '../types';

export interface LocalPurchaseDraft {
  id?: number;
  farmerId: string;
  crop: string;
  grade: string;
  grossWeight: string;
  tareWeight: string;
  moisture: string;
  ratePerQuintal: string;
  updatedAt: string;
}

export class KrishiSetuDatabase extends Dexie {
  offlineQueue!: Table<OfflineQueueItem, number>;
  cachedFarmers!: Table<Farmer, string>;
  cachedPrices!: Table<PriceBoardItem, string>;
  localDrafts!: Table<LocalPurchaseDraft, number>;

  constructor() {
    super('KrishiSetuLocalDB');
    this.version(1).stores({
      offlineQueue: '++id, &idempotencyKey, farmerId, centreId, status, clientDeviceTimestamp',
      cachedFarmers: '&id, farmerId, fullName, village, centreId',
      cachedPrices: '&id, crop, grade, isActive',
      localDrafts: '++id, farmerId, updatedAt'
    });
  }
}

export const db = new KrishiSetuDatabase();

