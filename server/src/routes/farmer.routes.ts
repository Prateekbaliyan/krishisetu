import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/auditService';

const router = Router();

export function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return 'XXXX-XXXX';
  const last4 = acc.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

/**
 * GET /api/farmers
 * Search by name or farmer ID, filter by village and collection centre
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, village, centreId } = req.query;

    const where: any = {};

    if (village && typeof village === 'string' && village !== 'ALL') {
      where.village = village;
    }

    if (centreId && typeof centreId === 'string' && centreId !== 'ALL') {
      where.centreId = centreId;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q } },
        { farmerId: { contains: q } },
        { mobileNumber: { contains: q } }
      ];
    }

    const farmers = await prisma.farmer.findMany({
      where,
      include: {
        centre: {
          select: { id: true, code: true, name: true, village: true }
        },
        _count: {
          select: { purchases: true, payments: true }
        }
      },
      orderBy: { fullName: 'asc' }
    });

    // Mask bank account numbers in API response
    const maskedFarmers = farmers.map((f: any) => ({
      ...f,
      rawAccountNumber: undefined, // Never expose raw
      bankAccountNumber: maskAccountNumber(f.bankAccountNumber)
    }));

    // Also get distinct villages for filtering
    const allFarmers = await prisma.farmer.findMany({ select: { village: true } });
    const distinctVillages = Array.from(new Set(allFarmers.map((f: any) => f.village))).sort();

    return res.json({
      success: true,
      count: maskedFarmers.length,
      farmers: maskedFarmers,
      villages: distinctVillages
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/farmers/:id
 * Detailed farmer profile with purchase and payment history
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [
          { id },
          { farmerId: id }
        ]
      },
      include: {
        centre: true,
        purchases: {
          orderBy: { purchaseDate: 'desc' },
          include: {
            centre: { select: { code: true, name: true } },
            anomalyFlags: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            paymentRun: { select: { batchNumber: true, status: true, processedAt: true } }
          }
        }
      }
    });

    if (!farmer) {
      return res.status(404).json({ success: false, error: 'Farmer not found.' });
    }

    const totalWeightDelivered = farmer.purchases.reduce((acc: number, p: any) => acc + Number(p.netWeight || 0), 0);
    const totalProcurementValue = farmer.purchases.reduce((acc: number, p: any) => acc + Number(p.totalAmount || 0), 0);
    const totalPaidAmount = farmer.payments
      .filter((p: any) => p.status === 'PAID')
      .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);

    return res.json({
      success: true,
      farmer: {
        ...farmer,
        bankAccountNumber: maskAccountNumber(farmer.bankAccountNumber),
        metrics: {
          totalPurchases: farmer.purchases.length,
          totalWeightDeliveredKg: Math.round(totalWeightDelivered * 10) / 10,
          totalProcurementValue: Math.round(totalProcurementValue * 100) / 100,
          totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
          pendingPaymentAmount: Math.round((totalProcurementValue - totalPaidAmount) * 100) / 100
        }
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/farmers
 * Add farmer (Manager only). Never collect Aadhaar.
 */
router.post('/', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const {
      farmerId,
      fullName,
      village,
      centreId,
      landAreaAcres,
      primaryCrop,
      bankAccountName,
      bankAccountNumber,
      ifscCode,
      bankName,
      bankVerificationStatus,
      mobileNumber
    } = req.body;

    if (!farmerId || !fullName || !village || !centreId || !bankAccountNumber || !ifscCode || !mobileNumber) {
      return res.status(400).json({ success: false, error: 'Missing required farmer registration fields.' });
    }

    // Verify centre exists
    const centre = await prisma.collectionCentre.findUnique({ where: { id: centreId } });
    if (!centre) {
      return res.status(400).json({ success: false, error: 'Invalid collection centre selected.' });
    }

    // Check unique farmerId
    const existing = await prisma.farmer.findUnique({ where: { farmerId } });
    if (existing) {
      return res.status(400).json({ success: false, error: `Farmer with ID ${farmerId} already exists.` });
    }

    const newFarmer = await prisma.farmer.create({
      data: {
        farmerId: farmerId.trim().toUpperCase(),
        fullName: fullName.trim(),
        village: village.trim(),
        centreId,
        landAreaAcres: Number(landAreaAcres) || 1.0,
        primaryCrop: primaryCrop || 'Soybean',
        bankAccountName: bankAccountName || fullName,
        bankAccountNumber: bankAccountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        bankName: bankName || 'Bank of Maharashtra',
        bankVerificationStatus: bankVerificationStatus || 'VERIFIED',
        mobileNumber: mobileNumber.trim()
      }
    });

    await createAuditLog({
      entityType: 'FARMER',
      entityId: newFarmer.id,
      action: 'CREATE',
      userId: req.user!.id,
      userName: req.user!.fullName,
      details: {
        farmerId: newFarmer.farmerId,
        fullName: newFarmer.fullName,
        village: newFarmer.village,
        centreCode: centre.code
      }
    });

    return res.status(201).json({
      success: true,
      farmer: {
        ...newFarmer,
        bankAccountNumber: maskAccountNumber(newFarmer.bankAccountNumber)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/farmers/:id
 * Edit farmer
 */
router.put('/:id', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      village,
      centreId,
      landAreaAcres,
      primaryCrop,
      bankAccountName,
      bankAccountNumber,
      ifscCode,
      bankName,
      bankVerificationStatus,
      mobileNumber
    } = req.body;

    const existing = await prisma.farmer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Farmer not found.' });
    }

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (village) updateData.village = village.trim();
    if (centreId) updateData.centreId = centreId;
    if (landAreaAcres !== undefined) updateData.landAreaAcres = Number(landAreaAcres);
    if (primaryCrop) updateData.primaryCrop = primaryCrop;
    if (bankAccountName) updateData.bankAccountName = bankAccountName.trim();
    if (bankAccountNumber && !bankAccountNumber.includes('X')) {
      updateData.bankAccountNumber = bankAccountNumber.trim();
    }
    if (ifscCode) updateData.ifscCode = ifscCode.trim().toUpperCase();
    if (bankName) updateData.bankName = bankName.trim();
    if (bankVerificationStatus) updateData.bankVerificationStatus = bankVerificationStatus;
    if (mobileNumber) updateData.mobileNumber = mobileNumber.trim();

    const updated = await prisma.farmer.update({
      where: { id },
      data: updateData
    });

    await createAuditLog({
      entityType: 'FARMER',
      entityId: id,
      action: 'UPDATE',
      userId: req.user!.id,
      userName: req.user!.fullName,
      details: { updatedFields: Object.keys(updateData) }
    });

    return res.json({
      success: true,
      farmer: {
        ...updated,
        bankAccountNumber: maskAccountNumber(updated.bankAccountNumber)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

