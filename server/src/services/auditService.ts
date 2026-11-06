import { prisma } from '../lib/prisma';
import { generateAuditHash, verifyAuditHash } from '../lib/crypto';

export interface CreateAuditLogParams {
  entityType: 'PURCHASE' | 'PRICE' | 'PAYMENT' | 'FARMER' | 'ANOMALY' | 'SYNC' | 'DISPATCH';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'SYNC' | 'PAYMENT_RUN' | 'DELETE';
  userId?: string | null;
  userName?: string | null;
  details: Record<string, any>;
  clientTimestamp?: Date;
}

export function normalizeTimestamp(date: Date = new Date()): Date {
  // Truncate to second precision to guarantee 100% round-trip fidelity across SQLite and PostgreSQL
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

export async function createAuditLog(params: CreateAuditLogParams) {
  // Fetch the latest audit log to retrieve the previous hash for chaining (strictly monotonic autoincrement ID)
  const lastLog = await prisma.auditLog.findFirst({
    orderBy: { id: 'desc' }
  });

  const previousHash = lastLog ? lastLog.eventHash : 'GENESIS_HASH_KRISHISETU_2026';
  const timestamp = new Date();

  const hashPayload = {
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    userId: params.userId,
    userName: params.userName,
    timestamp: timestamp.toISOString(),
    details: params.details,
    previousHash
  };

  const eventHash = generateAuditHash(hashPayload);

  const log = await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId || null,
      userName: params.userName || null,
      previousHash,
      eventHash,
      details: JSON.stringify(params.details),
      timestamp
    }
  });

  return log;
}

/**
 * Validates integrity of the entire audit chain
 */
export async function verifyAuditChainIntegrity(): Promise<{
  isValid: boolean;
  totalVerified: number;
  brokenIndex?: number;
  brokenLogId?: number;
  reason?: string;
}> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { id: 'asc' }
  });

  if (logs.length === 0) {
    return { isValid: true, totalVerified: 0 };
  }

  let currentExpectedPreviousHash = 'GENESIS_HASH_KRISHISETU_2026';

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    if (log.previousHash !== currentExpectedPreviousHash) {
      console.log(`Mismatch at index ${i}: log.previousHash=${log.previousHash}, expected=${currentExpectedPreviousHash}`);
      return {
        isValid: false,
        totalVerified: i,
        brokenIndex: i,
        brokenLogId: log.id,
        reason: 'PREVIOUS_HASH_MISMATCH'
      };
    }

    // Verify hash of this entry
    const recalculatedHash = generateAuditHash({
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      userId: log.userId,
      userName: log.userName,
      timestamp: log.timestamp.toISOString(),
      details: log.details,
      previousHash: log.previousHash
    });

    if (recalculatedHash !== log.eventHash) {
      console.log(`Hash mismatch at index ${i}: recalculated=${recalculatedHash}, eventHash=${log.eventHash}`);
      return {
        isValid: false,
        totalVerified: i,
        brokenIndex: i,
        brokenLogId: log.id,
        reason: 'HASH_RECALCULATION_MISMATCH'
      };
    }

    currentExpectedPreviousHash = log.eventHash;
  }

  return { isValid: true, totalVerified: logs.length };
}
