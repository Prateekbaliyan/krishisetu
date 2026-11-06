export type UserRole = 'OPERATOR' | 'MANAGER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  centreId?: string | null;
  centre?: CollectionCentre | null;
}

export interface CollectionCentre {
  id: string;
  code: string;
  name: string;
  village: string;
  taluka: string;
  district: string;
  operatorName: string;
  contactNumber: string;
  isActive: boolean;
  _count?: {
    farmers?: number;
    purchases?: number;
    dispatches?: number;
  };
}

export interface Farmer {
  id: string;
  farmerId: string;
  fullName: string;
  village: string;
  centreId: string;
  centre?: CollectionCentre;
  landAreaAcres: number;
  primaryCrop: 'Soybean' | 'Tur' | string;
  bankAccountName: string;
  bankAccountNumber: string; // masked
  ifscCode: string;
  bankName: string;
  bankVerificationStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  mobileNumber: string;
  metrics?: {
    totalPurchases: number;
    totalWeightDeliveredKg: number;
    totalProcurementValue: number;
    totalPaidAmount: number;
    pendingPaymentAmount: number;
  };
}

export interface Purchase {
  id: string;
  slipNumber: string;
  idempotencyKey: string;
  farmerId: string;
  farmer?: Farmer;
  centreId: string;
  centre?: CollectionCentre;
  crop: 'Soybean' | 'Tur' | string;
  grade: string;
  grossWeight: number;
  tareWeight: number;
  actualWeight: number;
  moisture: number;
  moistureDeductionPercent: number;
  netWeight: number;
  ratePerQuintal: number;
  totalAmount: number;
  purchaseDate: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'FLAGGED' | 'REJECTED' | 'PAID';
  scalePhotoUrl?: string | null;
  moisturePhotoUrl?: string | null;
  scaleAiWeight?: number | null;
  moistureAiValue?: number | null;
  aiConfidence?: number | null;
  aiVerificationStatus: 'MATCH' | 'DIFF_ACCEPTED' | 'MANUAL_OVERRIDE' | 'FAILED' | 'NOT_PERFORMED';
  aiDiffNotes?: string | null;
  paymentEligibility: boolean;
  paymentRunId?: string | null;
  isFlagged: boolean;
  flagReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  syncStatus: 'SYNCED' | 'OFFLINE_QUEUED' | 'SYNC_FAILED';
  anomalyFlags?: AnomalyFlag[];
  smsLogs?: any[];
}

export interface AnomalyFlag {
  id: string;
  purchaseId: string;
  flagType: 'WEIGHT_EXCEEDS_LAND_BENCHMARK' | 'DUPLICATE_HOUR_PURCHASE' | 'UNIFORM_MOISTURE_STREAK';
  severity: 'HIGH' | 'MEDIUM';
  description: string;
  details?: string;
  status: 'OPEN' | 'REVIEWED_APPROVED' | 'REVIEWED_REJECTED';
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
}

export interface PriceBoardItem {
  id: string;
  crop: string;
  grade: string;
  ratePerQuintal: number;
  effectiveDate: string;
  publishedBy: string;
  publishedAt: string;
  isActive: boolean;
}

export interface PaymentRun {
  id: string;
  batchNumber: string;
  totalFarmers: number;
  totalPurchases: number;
  totalAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  csvFileName?: string;
  createdBy: string;
  approvedBy?: string;
  processedAt?: string;
  createdAt: string;
  payments?: Payment[];
  purchases?: Purchase[];
}

export interface Payment {
  id: string;
  paymentRunId: string;
  farmerId: string;
  farmer?: Farmer;
  amount: number;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankReferenceNumber?: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paidAt?: string;
}

export interface Dispatch {
  id: string;
  centreId: string;
  centre?: CollectionCentre;
  crop: string;
  truckNumber: string;
  driverName: string;
  driverMobile?: string;
  dispatchWeight: number;
  destination: string;
  weightLossKg: number;
  notes?: string;
  dispatchedAt: string;
}

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  userId?: string;
  userName?: string;
  previousHash?: string;
  eventHash: string;
  details: string;
  timestamp: string;
}

// Offline Dexie Model
export interface OfflineQueueItem {
  id?: number;
  idempotencyKey: string;
  farmerId: string;
  farmerName: string;
  farmerCode: string;
  centreId: string;
  centreCode: string;
  crop: string;
  grade: string;
  grossWeight: number;
  tareWeight: number;
  actualWeight: number;
  moisture: number;
  moistureDeductionPercent: number;
  netWeight: number;
  ratePerQuintal: number;
  totalAmount: number;
  scalePhotoUrl?: string | null;
  moisturePhotoUrl?: string | null;
  scaleAiWeight?: number | null;
  moistureAiValue?: number | null;
  aiConfidence?: number | null;
  aiVerificationStatus?: string | null;
  aiDiffNotes?: string | null;
  clientDeviceTimestamp: string;
  localCreationTimestamp: string;
  status: 'QUEUED' | 'SYNCING' | 'FAILED';
  syncError?: string;
  retryCount: number;
}
