import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { calculateProcurement, CalculationError } from '../lib/calculations';
import { detectAnomalies } from '../lib/anomalyDetector';
import { analyzeMeterImage, compareWithManualReading, SCALE_TOLERANCE_KG, MOISTURE_TOLERANCE_PCT } from '../lib/visionService';
import { sendSimulatedSms } from '../lib/smsSimulator';
import { createAuditLog } from '../services/auditService';
import { uploadPhotos } from '../middleware/upload';

const router = Router();

/**
 * Generates an agricultural procurement slip number: e.g. "C07-24520"
 */
async function generateUniqueSlipNumber(centreCode: string): Promise<string> {
  const count = await prisma.purchase.count({
    where: { centre: { code: centreCode } }
  });
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const baseNum = 24500 + count + 1;
  const slip = `${centreCode}-${baseNum}`;

  // Check collision just in case
  const exists = await prisma.purchase.findUnique({ where: { slipNumber: slip } });
  if (exists) {
    return `${centreCode}-${baseNum}${randomSuffix}`;
  }
  return slip;
}

/**
 * POST /api/purchases/ai-verify
 * Endpoint for testing/verifying scale or moisture meter image upload against manual reading
 */
router.post('/ai-verify', authenticateToken, uploadPhotos, async (req: any, res) => {
  try {
    const { meterType, manualValue, isManualOverride } = req.body;
    const type = meterType as 'SCALE' | 'MOISTURE';

    if (!type || (type !== 'SCALE' && type !== 'MOISTURE')) {
      return res.status(400).json({ success: false, error: "meterType must be 'SCALE' or 'MOISTURE'." });
    }

    const numericManualValue = Number(manualValue);
    if (isNaN(numericManualValue)) {
      return res.status(400).json({ success: false, error: 'manualValue must be a valid number.' });
    }

    let file: Express.Multer.File | undefined;
    if (type === 'SCALE' && req.files?.scalePhoto) {
      file = req.files.scalePhoto[0];
    } else if (type === 'MOISTURE' && req.files?.moisturePhoto) {
      file = req.files.moisturePhoto[0];
    }

    let visionResult;
    let photoUrl = '';

    if (file) {
      photoUrl = `/uploads/${file.filename}`;
      const buffer = file.buffer || require('fs').readFileSync(file.path);
      visionResult = await analyzeMeterImage(buffer, file.mimetype, type);
    } else {
      visionResult = await analyzeMeterImage(Buffer.from(''), 'image/jpeg', type);
    }

    const comparison = compareWithManualReading(
      type,
      numericManualValue,
      visionResult,
      isManualOverride === 'true' || isManualOverride === true
    );

    return res.json({
      success: true,
      meterType: type,
      photoUrl,
      visionResult,
      comparison
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/purchases
 * Create a new procurement entry with:
 * - Independent backend AI mismatch verification (blocks operator bypass)
 * - Strict server-side published daily price enforcement (ignores client-supplied rates)
 * - Centre-level access boundaries
 * - Decimal-safe math, automated anomaly detection, simulated Marathi SMS & SHA-256 chained audit
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      farmerId,
      centreId,
      crop,
      grade,
      grossWeight,
      tareWeight,
      moisture,
      idempotencyKey,
      clientDeviceTimestamp,
      localCreationTimestamp,
      scalePhotoUrl,
      moisturePhotoUrl,
      scaleAiWeight,
      moistureAiValue,
      aiConfidence,
      aiDiffNotes,
      managerApproval
    } = req.body;

    // Idempotency check: prevent duplicate submissions
    const key = idempotencyKey || uuidv4();
    const existingPurchase = await prisma.purchase.findUnique({
      where: { idempotencyKey: key },
      include: {
        farmer: true,
        centre: true
      }
    });

    if (existingPurchase) {
      return res.status(200).json({
        success: true,
        isDuplicateSubmission: true,
        message: 'Purchase already processed with this idempotency key.',
        purchase: existingPurchase
      });
    }

    // 1. Verify Farmer
    if (!farmerId) {
      return res.status(400).json({ success: false, error: 'Farmer selection is required.' });
    }
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) {
      return res.status(404).json({ success: false, error: 'Selected farmer does not exist in registry.' });
    }

    // 2. Verify Collection Centre & Enforce Operator Access Boundary
    const targetCentreId = req.user?.role === 'OPERATOR' && req.user.centreId
      ? req.user.centreId
      : centreId || farmer.centreId;

    if (req.user?.role === 'OPERATOR') {
      if (!req.user.centreId) {
        return res.status(403).json({ success: false, error: 'Operator is not assigned to a collection centre.' });
      }
      if (centreId && centreId !== req.user.centreId) {
        return res.status(403).json({ success: false, error: 'Access denied: Operators cannot submit purchases for other collection centres.' });
      }
    }

    const centre = await prisma.collectionCentre.findUnique({ where: { id: targetCentreId } });
    if (!centre) {
      return res.status(400).json({ success: false, error: 'Invalid collection centre.' });
    }

    // 3. Strictly Verify Central Published Daily Price (Ignore any client-supplied rate)
    const selectedCrop = crop || 'Soybean';
    const selectedGrade = grade || 'Grade A';

    const activePrice = await prisma.priceBoard.findFirst({
      where: {
        crop: selectedCrop,
        grade: selectedGrade,
        isActive: true
      }
    });

    if (!activePrice) {
      return res.status(400).json({
        success: false,
        error: `No published daily rate found for ${selectedCrop} (${selectedGrade}). Office Manager must publish prices first.`
      });
    }

    // Server-enforced rate: Never trust client-supplied rate!
    const appliedRate = activePrice.ratePerQuintal;

    // 4. Independent Backend AI Reading Verification & Discrepancy Gate
    const numGross = Number(grossWeight);
    const numMoisture = Number(moisture);
    const aiScale = (scaleAiWeight !== undefined && scaleAiWeight !== null && scaleAiWeight !== '') ? Number(scaleAiWeight) : null;
    const aiMoist = (moistureAiValue !== undefined && moistureAiValue !== null && moistureAiValue !== '') ? Number(moistureAiValue) : null;

    let scaleDiff: number | null = null;
    let moistureDiff: number | null = null;
    let hasAiMismatch = false;
    const mismatchReasons: string[] = [];

    if (aiScale !== null && !isNaN(aiScale)) {
      scaleDiff = Math.round(Math.abs(numGross - aiScale) * 10) / 10;
      if (scaleDiff > SCALE_TOLERANCE_KG) {
        hasAiMismatch = true;
        mismatchReasons.push(`Scale weight difference (${scaleDiff} kg) exceeds allowable tolerance of ±${SCALE_TOLERANCE_KG} kg (Manual: ${numGross} kg, AI: ${aiScale} kg).`);
      }
    }

    if (aiMoist !== null && !isNaN(aiMoist)) {
      moistureDiff = Math.round(Math.abs(numMoisture - aiMoist) * 10) / 10;
      if (moistureDiff > MOISTURE_TOLERANCE_PCT) {
        hasAiMismatch = true;
        mismatchReasons.push(`Moisture difference (${moistureDiff}%) exceeds allowable tolerance of ±${MOISTURE_TOLERANCE_PCT}% (Manual: ${numMoisture}%, AI: ${aiMoist}%).`);
      }
    }

    let computedAiStatus = 'NOT_PERFORMED';
    if (aiScale !== null || aiMoist !== null) {
      computedAiStatus = hasAiMismatch ? 'DIFF_ACCEPTED' : 'MATCH';
    }

    let reviewerId: string | null = null;
    let reviewDecision: string | null = null;
    let reviewedBy: string | null = null;
    let reviewedAt: Date | null = null;
    let reviewNotes: string | null = null;

    if (hasAiMismatch) {
      const isManagerActor = req.user?.role === 'MANAGER';

      if (isManagerActor) {
        reviewerId = req.user!.id;
        reviewedBy = req.user!.fullName;
        reviewDecision = 'APPROVE';
        reviewedAt = new Date();
        reviewNotes = req.body.reviewNotes || 'Manager directly reviewed and approved AI reading variance.';
      } else if (managerApproval && managerApproval.managerId && managerApproval.decision === 'APPROVE') {
        const managerUser = await prisma.user.findFirst({
          where: { id: managerApproval.managerId, role: 'MANAGER' }
        });
        if (!managerUser) {
          return res.status(403).json({
            success: false,
            error: 'Invalid or inactive Office Manager authorization for AI mismatch approval.'
          });
        }
        if (!managerApproval.reason || managerApproval.reason.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'Manager review reason is required to approve an AI measurement discrepancy.'
          });
        }
        reviewerId = managerUser.id;
        reviewedBy = managerUser.fullName;
        reviewDecision = 'APPROVE';
        reviewedAt = new Date();
        reviewNotes = managerApproval.reason;
      } else {
        // Block operator from bypassing mismatch without verified manager approval!
        return res.status(403).json({
          success: false,
          error: `AI measurement mismatch detected beyond allowed tolerance. Procurement creation blocked until reviewed and approved by an authorized Office Manager. ${mismatchReasons.join(' ')}`,
          requiresManagerApproval: true,
          mismatchDetails: {
            scaleDiff,
            moistureDiff,
            tolerances: { scaleKg: SCALE_TOLERANCE_KG, moisturePct: MOISTURE_TOLERANCE_PCT },
            reasons: mismatchReasons
          }
        });
      }
    }

    // 5. Mathematical Calculations
    const calcResult = calculateProcurement({
      grossWeight: numGross,
      tareWeight: Number(tareWeight),
      moisture: numMoisture,
      ratePerQuintal: appliedRate
    });

    // 6. Generate Unique Slip Number
    const slipNumber = await generateUniqueSlipNumber(centre.code);

    // 7. Run Automated Anomaly Detection
    const anomalyCheck = await detectAnomalies(prisma, {
      farmerId: farmer.id,
      centreId: centre.id,
      crop: selectedCrop,
      grossWeight: numGross,
      netWeight: calcResult.netWeight,
      moisture: numMoisture,
      purchaseDate: new Date()
    });

    // Determine initial status
    let status = 'PENDING_APPROVAL';
    let isFlagged = false;
    let flagReason = null;

    if (anomalyCheck.isFlagged) {
      status = 'FLAGGED';
      isFlagged = true;
      flagReason = anomalyCheck.flags.map(f => f.description).join('; ');
    } else {
      status = 'PENDING_APPROVAL';
    }

    const purchase = await prisma.purchase.create({
      data: {
        slipNumber,
        idempotencyKey: key,
        farmerId: farmer.id,
        centreId: centre.id,
        crop: selectedCrop,
        grade: selectedGrade,
        grossWeight: Math.round(numGross * 10) / 10,
        tareWeight: Math.round(Number(tareWeight) * 10) / 10,
        actualWeight: calcResult.actualWeight,
        moisture: Math.round(numMoisture * 10) / 10,
        moistureDeductionPercent: calcResult.moistureDeductionPercent,
        netWeight: calcResult.netWeight,
        ratePerQuintal: appliedRate,
        totalAmount: calcResult.totalAmount,
        status,
        scalePhotoUrl: scalePhotoUrl || null,
        moisturePhotoUrl: moisturePhotoUrl || null,
        scaleAiWeight: aiScale,
        moistureAiValue: aiMoist,
        aiConfidence: aiConfidence ? Number(aiConfidence) : null,
        aiVerificationStatus: computedAiStatus,
        aiDiffNotes: aiDiffNotes || (hasAiMismatch ? mismatchReasons.join('; ') : null),
        reviewerId,
        reviewDecision,
        reviewedBy,
        reviewedAt,
        reviewNotes,
        clientDeviceTimestamp: clientDeviceTimestamp ? new Date(clientDeviceTimestamp) : null,
        localCreationTimestamp: localCreationTimestamp ? new Date(localCreationTimestamp) : null,
        serverReceivedTimestamp: new Date(),
        syncStatus: 'SYNCED',
        paymentEligibility: !isFlagged && farmer.bankVerificationStatus === 'VERIFIED',
        isFlagged,
        flagReason
      },
      include: {
        farmer: true,
        centre: true
      }
    });

    // Create Anomaly Flags if detected
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

    // 8. Dispatch Simulated Marathi SMS
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

    // 9. Create Immutable Audit Log with SHA-256 Hash Chaining
    await createAuditLog({
      entityType: 'PURCHASE',
      entityId: purchase.id,
      action: 'CREATE',
      userId: req.user?.id,
      userName: req.user?.fullName,
      details: {
        slipNumber: purchase.slipNumber,
        farmerId: farmer.farmerId,
        crop: purchase.crop,
        grossWeight: purchase.grossWeight,
        netWeight: purchase.netWeight,
        ratePerQuintal: purchase.ratePerQuintal,
        totalAmount: purchase.totalAmount,
        aiVerificationStatus: computedAiStatus,
        hasAiMismatch,
        isFlagged,
        flagReason
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Procurement slip generated successfully.',
      purchase,
      sms: smsResult,
      anomalyStatus: {
        isFlagged,
        flags: anomalyCheck.flags
      }
    });
  } catch (err: any) {
    if (err instanceof CalculationError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/purchases
 * List and filter purchases with strict collection-centre restriction for operators
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { centreId, crop, status, isFlagged, farmerId, search, date } = req.query;

    const where: any = {};

    // Operators are strictly restricted to their assigned centre
    if (req.user?.role === 'OPERATOR') {
      if (!req.user.centreId) {
        return res.status(403).json({ success: false, error: 'Operator account is not assigned to any collection centre.' });
      }
      where.centreId = req.user.centreId;
    } else if (centreId && centreId !== 'ALL') {
      where.centreId = String(centreId);
    }

    if (crop && crop !== 'ALL') {
      where.crop = String(crop);
    }

    if (status && status !== 'ALL') {
      where.status = String(status);
    }

    if (isFlagged === 'true') {
      where.isFlagged = true;
    }

    if (farmerId) {
      where.farmerId = String(farmerId);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { slipNumber: { contains: q } },
        { farmer: { fullName: { contains: q } } },
        { farmer: { farmerId: { contains: q } } }
      ];
    }

    if (date) {
      const d = new Date(String(date));
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      where.purchaseDate = { gte: startOfDay, lte: endOfDay };
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        farmer: {
          select: {
            farmerId: true,
            fullName: true,
            village: true,
            mobileNumber: true,
            bankVerificationStatus: true,
            bankAccountNumber: true,
            ifscCode: true,
            bankName: true
          }
        },
        centre: {
          select: { code: true, name: true, village: true }
        },
        anomalyFlags: true,
        smsLogs: { take: 1, orderBy: { sentAt: 'desc' } }
      },
      orderBy: { purchaseDate: 'desc' }
    });

    return res.json({
      success: true,
      count: purchases.length,
      purchases
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/purchases/:slipNumber
 * Fetch full slip details for printing or mobile viewing (with centre permission enforcement)
 */
router.get('/:slipNumber', authenticateToken, async (req, res) => {
  try {
    const { slipNumber } = req.params;

    const purchase = await prisma.purchase.findFirst({
      where: {
        OR: [{ slipNumber }, { id: slipNumber }]
      },
      include: {
        farmer: true,
        centre: true,
        anomalyFlags: true,
        smsLogs: true
      }
    });

    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Procurement slip not found.' });
    }

    // Operators cannot access slips from other centres
    if (req.user?.role === 'OPERATOR' && req.user.centreId) {
      if (purchase.centreId !== req.user.centreId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have permission to access purchases from other collection centres.'
        });
      }
    }

    return res.json({ success: true, purchase });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/purchases/:id/review
 * Office Manager reviews flagged purchase (Approve or Reject with full audit trail)
 */
router.post('/:id/review', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, notes } = req.body; // decision: "APPROVE" | "REJECT"

    if (!decision || (decision !== 'APPROVE' && decision !== 'REJECT')) {
      return res.status(400).json({ success: false, error: "Decision must be 'APPROVE' or 'REJECT'." });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { farmer: true }
    });

    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase record not found.' });
    }

    const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const isEligible = decision === 'APPROVE' && purchase.farmer.bankVerificationStatus === 'VERIFIED';
    const isFlagged = decision === 'APPROVE' ? false : true;

    const updated = await prisma.purchase.update({
      where: { id },
      data: {
        status: newStatus,
        isFlagged,
        paymentEligibility: isEligible,
        reviewerId: req.user!.id,
        reviewDecision: decision,
        reviewedBy: req.user!.fullName,
        reviewedAt: new Date(),
        reviewNotes: notes || `Manager ${req.user!.fullName} ${decision.toLowerCase()}d purchase.`
      }
    });

    // Update anomaly flag records
    await prisma.anomalyFlag.updateMany({
      where: { purchaseId: id },
      data: {
        status: decision === 'APPROVE' ? 'REVIEWED_APPROVED' : 'REVIEWED_REJECTED',
        reviewedBy: req.user!.fullName,
        reviewNotes: notes || undefined
      }
    });

    // Create Audit Log
    await createAuditLog({
      entityType: 'PURCHASE',
      entityId: purchase.id,
      action: decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
      userId: req.user!.id,
      userName: req.user!.fullName,
      details: {
        slipNumber: purchase.slipNumber,
        previousStatus: purchase.status,
        newStatus,
        decision,
        notes
      }
    });

    return res.json({
      success: true,
      message: `Purchase ${purchase.slipNumber} has been ${decision.toLowerCase()}d.`,
      purchase: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
