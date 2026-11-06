import crypto from 'crypto';

/**
 * Audit Hash Chaining System
 * Computes deterministic SHA-256 hash for audit events linked to the previous event hash.
 * 
 * LIMITATION DOCUMENTATION:
 * Client-generated timestamps and local device storage cannot be considered
 * independently tamper-proof on a compromised or rooted device. The server independently
 * validates idempotency keys, recalculates event hashes upon ingest, records serverReceivedTimestamp,
 * and maintains the immutable server-side hash chain.
 */

export interface AuditEventPayload {
  entityType: string;
  entityId: string;
  action: string;
  userId?: string | null;
  userName?: string | null;
  timestamp: string;
  details: Record<string, any> | string;
  previousHash: string | null;
}

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function generateAuditHash(payload: AuditEventPayload): string {
  const normalizedDetails = typeof payload.details === 'string'
    ? payload.details
    : JSON.stringify(payload.details);

  const serialized = [
    payload.entityType,
    payload.entityId,
    payload.action,
    payload.userId || 'system',
    payload.userName || 'system',
    payload.timestamp,
    normalizedDetails,
    payload.previousHash || 'GENESIS_HASH_KRISHISETU_2026'
  ].join('|');

  return computeSha256(serialized);
}

export function verifyAuditHash(payload: AuditEventPayload, expectedHash: string): boolean {
  const actualHash = generateAuditHash(payload);
  return actualHash === expectedHash;
}

