import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { calculateProcurement, CalculationError } from '../lib/calculations';
import { detectAnomalies } from '../lib/anomalyDetector';
import { createAuditLog } from '../services/auditService';
import { sendSimulatedSms } from '../lib/smsSimulator';
import { SCALE_TOLERANCE_KG, MOISTURE_TOLERANCE_PCT } from '../lib/visionService';

async function generateUniqueSlipNumber(centreCode: string): Promise<string> {
  const count = await prisma.purchase.count({
    where: { centre: { code: centreCode } }
  });
  let slip = `${centreCode}-${24500 + count + 1}`;
  let attempt = 0;

  while (await prisma.purchase.findUnique({ where: { slipNumber: slip } })) {
    attempt++;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    slip = `${centreCode}-${24500 + count + attempt}${randomSuffix}`;
  }
  return slip;
}

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
  ratePerQuintal?: number;
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
 * Processes an offline queue batch of purchases with idempotency,
 * price verification, AI mismatch gating & tamper validation.
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

      // 1. Idempotency check: strictly skip duplicate submissions
      const existing = await prisma.purchase.findUnique({
        where: { idempotencyKey: key },
        include: { farmer: true, centre: true }
      });

      if (existing) {
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
        // 2. Validate Farmer
        const farmer = await prisma.farmer.findUnique({ where: { id: item.farmerId } });
        if (!farmer) {
          throw new Error(`Farmer ID ${item.farmerId} not found in central registry.`);
        }

        // 3. Validate Centre & Enforce Operator Access Boundary
        if (req.user?.role === 'OPERATOR' && req.user.centreId && item.centreId !== req.user.centreId) {
          throw new Error('Access denied: Operators cannot sync procurement records for another collection centre.');
        }

        const centre = await prisma.collectionCentre.findUnique({ where: { id: item.centreId } });
        if (!centre) {
          throw new Error(`Collection centre ${item.centreId} not found.`);
        }

        // 4. Central Published Daily Price Validation (Zero Trust for Client Price)
        const crop = item.crop;
        const grade = item.grade || 'Grade A';

        if (!crop || (crop !== 'Soybean' && crop !== 'Tur')) {
          throw new Error(`Invalid or unsupported crop: ${crop || 'unspecified'}. Supported crops: Soybean, Tur.`);
        }

        const activePrice = await prisma.priceBoard.findFirst({
          where: {
            crop,
            grade,
            isActive: true
          }
        });

        if (!activePrice) {
          throw new Error(`No active published daily price found for ${crop} (${grade}). Offline purchase cannot be synced until Office Manager publishes daily rates.`);
        }

        // Server-enforced rate: Never trust client-supplied rate or fall back to hardcoded numbers!
        const appliedRate = activePrice.ratePerQuintal;

        // 5. Server-Side Independent Math Calculation (prevents client tamper)
        const numGross = Number(item.grossWeight);
        const numTare = Number(item.tareWeight);
        const numMoisture = Number(item.moisture);

        const calcResult = calculateProcurement({
          grossWeight: numGross,
          tareWeight: numTare,
          moisture: numMoisture,
          ratePerQuintal: appliedRate
        });

        // 6. Check AI Reading Discrepancy
        let hasAiMismatch = false;
        let aiMismatchDescription = '';

        if (item.scaleAiWeight !== undefined && item.scaleAiWeight !== null) {
          const diff = Math.round(Math.abs(numGross - Number(item.scaleAiWeight)) * 10) / 10;
          if (diff > SCALE_TOLERANCE_KG) {
            hasAiMismatch = true;
            aiMismatchDescription += `Scale weight discrepancy: manual ${numGross}kg vs AI ${item.scaleAiWeight}kg. `;
          }
        }

        if (item.moistureAiValue !== undefined && item.moistureAiValue !== null) {
          const diff = Math.round(Math.abs(numMoisture - Number(item.moistureAiValue)) * 10) / 10;
          if (diff > MOISTURE_TOLERANCE_PCT) {
            hasAiMismatch = true;
            aiMismatchDescription += `Moisture discrepancy: manual ${numMoisture}% vs AI ${item.moistureAiValue}%. `;
          }
        }

        // 7. Generate Unique Slip Number
        let slipNumber = await generateUniqueSlipNumber(centre.code);

        // 8. Anomaly Detection
        const anomalyCheck = await detectAnomalies(prisma, {
          farmerId: farmer.id,
          centreId: centre.id,
          crop,
          grossWeight: numGross,
          netWeight: calcResult.netWeight,
          moisture: numMoisture,
          purchaseDate: item.localCreationTimestamp ? new Date(item.localCreationTimestamp) : new Date()
        });

        const isFlagged = anomalyCheck.isFlagged || hasAiMismatch;
        const flagReasons: string[] = [];
        if (anomalyCheck.isFlagged) {
          flagReasons.push(...anomalyCheck.flags.map(f => f.description));
        }
        if (hasAiMismatch) {
          flagReasons.push(`AI Measurement Mismatch: ${aiMismatchDescription.trim()}`);
        }

        const flagReason = isFlagged ? flagReasons.join('; ') : null;
        const status = isFlagged ? 'FLAGGED' : 'PENDING_APPROVAL';

        let purchase: any = null;
        let attempts = 0;
        while (!purchase && attempts < 5) {
          try {
            purchase = await prisma.purchase.create({
              data: {
                slipNumber,
                idempotencyKey: key,
                farmerId: farmer.id,
                centreId: centre.id,
                crop,
                grade,
                grossWeight: Math.round(numGross * 10) / 10,
                tareWeight: Math.round(numTare * 10) / 10,
                actualWeight: calcResult.actualWeight,
                moisture: Math.round(numMoisture * 10) / 10,
                moistureDeductionPercent: calcResult.moistureDeductionPercent,
                netWeight: calcResult.netWeight,
                ratePerQuintal: appliedRate,
                totalAmount: calcResult.totalAmount,
                status,
                scalePhotoUrl: item.scalePhotoUrl || null,
                moisturePhotoUrl: item.moisturePhotoUrl || null,
                scaleAiWeight: item.scaleAiWeight || null,
                moistureAiValue: item.moistureAiValue || null,
                aiConfidence: item.aiConfidence || null,
                aiVerificationStatus: hasAiMismatch ? 'DIFF_ACCEPTED' : (item.aiVerificationStatus || 'NOT_PERFORMED'),
                aiDiffNotes: item.aiDiffNotes || (hasAiMismatch ? aiMismatchDescription : null),
                clientDeviceTimestamp: item.clientDeviceTimestamp ? new Date(item.clientDeviceTimestamp) : null,
                localCreationTimestamp: item.localCreationTimestamp ? new Date(item.localCreationTimestamp) : null,
                serverReceivedTimestamp: new Date(),
                syncStatus: 'SYNCED',
                paymentEligibility: !isFlagged && farmer.bankVerificationStatus === 'VERIFIED',
                isFlagged,
                flagReason
              }
            });
          } catch (createErr: any) {
            if (createErr.code === 'P2002' && attempts < 4) {
              attempts++;
              slipNumber = `${centre.code}-${24500 + Math.floor(Math.random() * 100000)}`;
              continue;
            }
            throw createErr;
          }
        }

        // Create Anomaly Flag entries
        if (anomalyCheck.isFlagged) {
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

        if (hasAiMismatch) {
          await prisma.anomalyFlag.create({
            data: {
              purchaseId: purchase.id,
              flagType: 'WEIGHT_EXCEEDS_LAND_BENCHMARK', // Flagged for review
              severity: 'HIGH',
              description: `AI OCR Reading Variance: ${aiMismatchDescription.trim()}`,
              details: JSON.stringify({ aiMismatch: true, description: aiMismatchDescription }),
              status: 'OPEN'
            }
          });
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
            providerResponse: smsResult.gatewayResponse,
            sentAt: new Date()
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
            isFlagged,
            hasAiMismatch,
            flagReason,
            totalAmount: purchase.totalAmount
          }
        });

        await prisma.syncRecord.create({
          data: {
            idempotencyKey: key,
            clientId: item.clientId || clientId || 'offline-client',
            centreId: centre.id,
            purchaseSlip: slipNumber,
            status: 'SUCCESS'
          }
        });

        results.push({
          idempotencyKey: key,
          status: 'SYNCED',
          slipNumber: purchase.slipNumber
        });
        syncedCount++;
      } catch (err: any) {
        results.push({
          idempotencyKey: key,
          status: 'FAILED',
          error: err.message || 'Validation error during offline record processing.'
        });
        failedCount++;
      }
    }

    const batchSummary = {
      totalReceived: items.length,
      syncedCount,
      duplicateCount,
      failedCount
    };

    return res.json({
      success: true,
      ...batchSummary,
      batchSummary,
      results
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sync/status
 * Check device synchronization status & pending counts
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const records = await prisma.syncRecord.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 20
    });

    return res.json({
      success: true,
      lastSync: records[0]?.receivedAt || null,
      recentRecords: records
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
