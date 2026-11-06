import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/auditService';

const router = Router();

/**
 * GET /api/stock/summary
 * Computes live stock positions from purchases and dispatches
 */
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const centres = await prisma.collectionCentre.findMany({
      where: { isActive: true },
      include: {
        purchases: {
          select: { crop: true, netWeight: true }
        },
        dispatches: {
          select: { crop: true, dispatchWeight: true, weightLossKg: true }
        }
      }
    });

    const crops = ['Soybean', 'Tur'];

    // Overall Crop Totals
    const cropTotals: Record<string, { inwardKg: number; dispatchedKg: number; weightLossKg: number; currentStockKg: number }> = {
      Soybean: { inwardKg: 0, dispatchedKg: 0, weightLossKg: 0, currentStockKg: 0 },
      Tur: { inwardKg: 0, dispatchedKg: 0, weightLossKg: 0, currentStockKg: 0 }
    };

    // Centre-wise Breakdown
    const centreSummaries = centres.map(centre => {
      const centreCropMap: Record<string, { inward: number; dispatched: number; loss: number; current: number }> = {
        Soybean: { inward: 0, dispatched: 0, loss: 0, current: 0 },
        Tur: { inward: 0, dispatched: 0, loss: 0, current: 0 }
      };

      for (const p of centre.purchases) {
        if (!centreCropMap[p.crop]) {
          centreCropMap[p.crop] = { inward: 0, dispatched: 0, loss: 0, current: 0 };
        }
        centreCropMap[p.crop].inward += p.netWeight;

        if (!cropTotals[p.crop]) {
          cropTotals[p.crop] = { inwardKg: 0, dispatchedKg: 0, weightLossKg: 0, currentStockKg: 0 };
        }
        cropTotals[p.crop].inwardKg += p.netWeight;
      }

      for (const d of centre.dispatches) {
        if (!centreCropMap[d.crop]) {
          centreCropMap[d.crop] = { inward: 0, dispatched: 0, loss: 0, current: 0 };
        }
        centreCropMap[d.crop].dispatched += d.dispatchWeight;
        centreCropMap[d.crop].loss += d.weightLossKg;

        if (!cropTotals[d.crop]) {
          cropTotals[d.crop] = { inwardKg: 0, dispatchedKg: 0, weightLossKg: 0, currentStockKg: 0 };
        }
        cropTotals[d.crop].dispatchedKg += d.dispatchWeight;
        cropTotals[d.crop].weightLossKg += d.weightLossKg;
      }

      // Compute current stock for each crop
      Object.keys(centreCropMap).forEach(crop => {
        centreCropMap[crop].current = Math.max(
          0,
          centreCropMap[crop].inward - centreCropMap[crop].dispatched - centreCropMap[crop].loss
        );
      });

      const totalInwardKg = Object.values(centreCropMap).reduce((sum, c) => sum + c.inward, 0);
      const totalDispatchedKg = Object.values(centreCropMap).reduce((sum, c) => sum + c.dispatched, 0);
      const totalLossKg = Object.values(centreCropMap).reduce((sum, c) => sum + c.loss, 0);
      const totalCurrentStockKg = Math.max(0, totalInwardKg - totalDispatchedKg - totalLossKg);

      return {
        centreId: centre.id,
        centreCode: centre.code,
        centreName: centre.name,
        village: centre.village,
        crops: centreCropMap,
        totalInwardKg: Math.round(totalInwardKg * 10) / 10,
        totalInwardTonnes: Math.round((totalInwardKg / 1000) * 100) / 100,
        totalDispatchedKg: Math.round(totalDispatchedKg * 10) / 10,
        totalDispatchedTonnes: Math.round((totalDispatchedKg / 1000) * 100) / 100,
        totalLossKg: Math.round(totalLossKg * 10) / 10,
        totalCurrentStockKg: Math.round(totalCurrentStockKg * 10) / 10,
        totalCurrentStockTonnes: Math.round((totalCurrentStockKg / 1000) * 100) / 100
      };
    });

    // Compute global current stock per crop
    Object.keys(cropTotals).forEach(crop => {
      cropTotals[crop].currentStockKg = Math.max(
        0,
        cropTotals[crop].inwardKg - cropTotals[crop].dispatchedKg - cropTotals[crop].weightLossKg
      );
    });

    const globalSummary = {
      totalInwardKg: Object.values(cropTotals).reduce((sum, c) => sum + c.inwardKg, 0),
      totalDispatchedKg: Object.values(cropTotals).reduce((sum, c) => sum + c.dispatchedKg, 0),
      totalLossKg: Object.values(cropTotals).reduce((sum, c) => sum + c.weightLossKg, 0),
      totalStockKg: Object.values(cropTotals).reduce((sum, c) => sum + c.currentStockKg, 0)
    };

    return res.json({
      success: true,
      global: {
        ...globalSummary,
        totalInwardTonnes: Math.round((globalSummary.totalInwardKg / 1000) * 100) / 100,
        totalDispatchedTonnes: Math.round((globalSummary.totalDispatchedKg / 1000) * 100) / 100,
        totalStockTonnes: Math.round((globalSummary.totalStockKg / 1000) * 100) / 100
      },
      cropTotals,
      centreSummaries
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/stock/dispatches
 * Dispatch history
 */
router.get('/dispatches', authenticateToken, async (req, res) => {
  try {
    const { centreId, crop } = req.query;
    const where: any = {};

    if (centreId && centreId !== 'ALL') where.centreId = String(centreId);
    if (crop && crop !== 'ALL') where.crop = String(crop);

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: {
        centre: { select: { code: true, name: true, village: true } }
      },
      orderBy: { dispatchedAt: 'desc' }
    });

    return res.json({ success: true, count: dispatches.length, dispatches });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stock/dispatches
 * Create a new truck dispatch record
 */
router.post('/dispatches', authenticateToken, async (req, res) => {
  try {
    const {
      centreId,
      crop,
      truckNumber,
      driverName,
      driverMobile,
      dispatchWeight,
      destination,
      weightLossKg,
      notes
    } = req.body;

    if (!centreId || !crop || !truckNumber || !driverName || !dispatchWeight || !destination) {
      return res.status(400).json({ success: false, error: 'All primary dispatch fields are required.' });
    }

    const centre = await prisma.collectionCentre.findUnique({ where: { id: centreId } });
    if (!centre) {
      return res.status(404).json({ success: false, error: 'Collection centre not found.' });
    }

    const dispatch = await prisma.dispatch.create({
      data: {
        centreId,
        crop,
        truckNumber: truckNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverMobile: driverMobile ? driverMobile.trim() : null,
        dispatchWeight: Number(dispatchWeight),
        destination: destination.trim(),
        weightLossKg: Number(weightLossKg) || 0,
        notes: notes || null
      },
      include: { centre: true }
    });

    await createAuditLog({
      entityType: 'DISPATCH',
      entityId: dispatch.id,
      action: 'CREATE',
      userId: req.user?.id,
      userName: req.user?.fullName,
      details: {
        truckNumber: dispatch.truckNumber,
        centreCode: centre.code,
        crop: dispatch.crop,
        dispatchWeight: dispatch.dispatchWeight,
        destination: dispatch.destination
      }
    });

    return res.status(201).json({ success: true, dispatch });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

