import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { calculateProcurement, CalculationError } from '../lib/calculations';
import { detectAnomalies } from '../lib/anomalyDetector';
import { createAuditLog } from '../services/auditService';
import { sendSimulatedSms } from '../lib/smsSimulator';

const router = Router();

export interface OfflinePurchaseItem {
  idempotencyKey: string;
  clientId: string;
  farmerId: string;
  centreId: string;
  crop: string;
  grade: string;
  grossWeight: number;
  tareWeight: number;
  moisture: number;
  ratePerQuintal: number;
  clientDeviceTimestamp: string;
  localCreationTimestamp: string;
  scalePhotoUrl?: string;
  moisturePhotoUrl?: string;
  scaleAiWeight?: number;
  moistureAiValue?: number;
  aiConfidence?: number;
  aiVerificationStatus?: string;
  aiDiffNotes?: string;
}

/**
 * POST /api/sync/batch
 * Processes an offline queue batch of purchases with idempotency & tamper validation
 */
router.post('/batch', authenticateToken, async (req, res) => {
  try {
    const { items, clientId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Empty sync batch received.' });
    }

    const results: Array<{
      idempotencyKey: string;
      status: 'SYNCED' | 'DUPLICATE_SKIPPED' | 'FAILED';
      slipNumber?: string;
      error?: string;
    }> = [];

    let syncedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const item of items as OfflinePurchaseItem[]) {
      const key = item.idempotencyKey;

      if (!key) {
        results.push({
          idempotencyKey: 'UNKNOWN',
          status: 'FAILED',
          error: 'Missing required client idempotencyKey.'
        });
        failedCount++;
        continue;
      }

      // Check for existing record by idempotencyKey
      const existing = await prisma.purchase.findUnique({
        where: { idempotencyKey: key },
        include: { farmer: true, centre: true }
      });

      if (existing) {
        // Idempotency: acknowledge without duplicating
        await prisma.syncRecord.upsert({
          where: { idempotencyKey: key },
          update: { status: 'SUCCESS' },
          create: {
            idempotencyKey: key,
            clientId: item.clientId || clientId || 'offline-client',
            centreId: existing.centreId,
            purchaseSlip: existing.slipNumber,
            status: 'SUCCESS'
          }
        });

        results.push({
          idempotencyKey: key,
          status: 'DUPLICATE_SKIPPED',
          slipNumber: existing.slipNumber
        });
        duplicateCount++;
        continue;
      }

      try {
        // Validate Farmer
        const farmer = await prisma.farmer.findUnique({ where: { id: item.farmerId } });
        if (!farmer) {
          throw new Error(`Farmer ID ${item.farmerId} not found in central registry.`);
        }

        // Validate Centre
        const centre = await prisma.collectionCentre.findUnique({ where: { id: item.centreId } });
        if (!centre) {
          throw new Error(`Collection centre ${item.centreId} not found.`);
        }

        // Server-Side Independent Calculation (prevents client tamper)
        const calcResult = calculateProcurement({
          grossWeight: Number(item.grossWeight),
          tareWeight: Number(item.tareWeight),
          moisture: Number(item.moisture),
          ratePerQuintal: Number(item.ratePerQuintal)
        });

        // Generate Slip Number
        const count = await prisma.purchase.count({ where: { centreId: centre.id } });
        const slipNumber = `${centre.code}-${24500 + count + 1}`;

        // Anomaly Detection
        const anomalyCheck = await detectAnomalies(prisma, {
          farmerId: farmer.id,
          centreId: centre.id,
          crop: item.crop || 'Soybean',
          grossWeight: Number(item.grossWeight),
          netWeight: calcResult.netWeight,
          moisture: Number(item.moisture),
          purchaseDate: item.localCreationTimestamp ? new Date(item.localCreationTimestamp) : new Date()
        });

        const isFlagged = anomalyCheck.isFlagged;
        const flagReason = isFlagged ? anomalyCheck.flags.map(f => f.description).join('; ') : null;
        const status = isFlagged ? 'FLAGGED' : 'PENDING_APPROVAL';

        const purchase = await prisma.purchase.create({
          data: {
            slipNumber,
            idempotencyKey: key,
            farmerId: farmer.id,
            centreId: centre.id,
            crop: item.crop || 'Soybean',
            grade: item.grade || 'Grade A',
            grossWeight: Math.round(Number(item.grossWeight) * 10) / 10,
            tareWeight: Math.round(Number(item.tareWeight) * 10) / 10,
            actualWeight: calcResult.actualWeight,
            moisture: Math.round(Number(item.moisture) * 10) / 10,
            moistureDeductionPercent: calcResult.moistureDeductionPercent,
            netWeight: calcResult.netWeight,
            ratePerQuintal: Number(item.ratePerQuintal),
            totalAmount: calcResult.totalAmount,
            status,
            scalePhotoUrl: item.scalePhotoUrl || null,
            moisturePhotoUrl: item.moisturePhotoUrl || null,
            scaleAiWeight: item.scaleAiWeight || null,
            moistureAiValue: item.moistureAiValue || null,
            aiConfidence: item.aiConfidence || null,
            aiVerificationStatus: item.aiVerificationStatus || 'NOT_PERFORMED',
            aiDiffNotes: item.aiDiffNotes || null,
            clientDeviceTimestamp: item.clientDeviceTimestamp ? new Date(item.clientDeviceTimestamp) : null,
            localCreationTimestamp: item.localCreationTimestamp ? new Date(item.localCreationTimestamp) : null,
            serverReceivedTimestamp: new Date(),
            syncStatus: 'SYNCED',
            paymentEligibility: !isFlagged && farmer.bankVerificationStatus === 'VERIFIED',
            isFlagged,
            flagReason
          }
        });

        if (isFlagged) {
          for (const flag of anomalyCheck.flags) {
            await prisma.anomalyFlag.create({
              data: {
                purchaseId: purchase.id,
                flagType: flag.flagType,
                severity: flag.severity,
                description: flag.description,
                details: JSON.stringify(flag.details),
                status: 'OPEN'
              }
            });
          }
        }

        // SMS Log
        const smsResult = await sendSimulatedSms({
          farmerName: farmer.fullName,
          farmerMobile: farmer.mobileNumber,
          crop: purchase.crop,
          slipNumber: purchase.slipNumber,
          grossWeight: purchase.grossWeight,
          netWeight: purchase.netWeight,
          rate: purchase.ratePerQuintal,
          amount: purchase.totalAmount
        });

        await prisma.smsLog.create({
          data: {
            purchaseId: purchase.id,
            farmerMobile: farmer.mobileNumber,
            farmerName: farmer.fullName,
            message: smsResult.formattedMessage,
            status: smsResult.status,
            providerResponse: smsResult.gatewayResponse
          }
        });

        // Record Sync Record
        await prisma.syncRecord.create({
          data: {
            idempotencyKey: key,
            clientId: item.clientId || clientId || 'offline-client',
            centreId: centre.id,
            purchaseSlip: purchase.slipNumber,
            status: 'SUCCESS'
          }
        });

        // Audit Log
        await createAuditLog({
          entityType: 'PURCHASE',
          entityId: purchase.id,
          action: 'SYNC',
          userId: req.user?.id,
          userName: req.user?.fullName,
          details: {
            slipNumber: purchase.slipNumber,
            idempotencyKey: key,
            offlineCreated: item.localCreationTimestamp,
            serverReceived: new Date().toISOString()
          }
        });

        results.push({
          idempotencyKey: key,
          status: 'SYNCED',
          slipNumber: purchase.slipNumber
        });
        syncedCount++;
      } catch (err: any) {
        // Record failed sync record for operator review and retry
        await prisma.syncRecord.create({
          data: {
            idempotencyKey: key,
            clientId: item.clientId || clientId || 'offline-client',
            centreId: item.centreId || 'UNKNOWN',
            status: 'FAILED',
            errorMessage: err.message
          }
        });

        results.push({
          idempotencyKey: key,
          status: 'FAILED',
          error: err.message
        });
        failedCount++;
      }
    }

    return res.json({
      success: true,
      batchSummary: {
        totalReceived: items.length,
        syncedCount,
        duplicateCount,
        failedCount
      },
      results
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sync/records
 * View sync audit records and failed queue attempts
 */
router.get('/records', authenticateToken, async (req, res) => {
  try {
    const records = await prisma.syncRecord.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 100
    });
    return res.json({ success: true, count: records.length, records });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
