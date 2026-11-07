import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/dashboard/summary
 * Aggregates live database statistics for the executive and centre dashboards
 */
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const isOperator = req.user?.role === 'OPERATOR';
    const centreFilter = isOperator && req.user?.centreId
      ? { centreId: req.user.centreId }
      : req.query.centreId
        ? { centreId: String(req.query.centreId) }
        : {};

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // 1. Today's Purchases Count & Weights
    const todayPurchases = await prisma.purchase.findMany({
      where: {
        ...centreFilter,
        purchaseDate: { gte: startOfToday }
      },
      select: {
        netWeight: true,
        grossWeight: true,
        totalAmount: true,
        crop: true,
        status: true
      }
    });

    const todayCount = todayPurchases.length;
    const todayProcurementKg = todayPurchases.reduce((acc: number, curr: any) => acc + curr.netWeight, 0);
    const todayProcurementTonnes = Math.round((todayProcurementKg / 1000) * 100) / 100;
    const todayPurchaseValue = todayPurchases.reduce((acc: number, curr: any) => acc + curr.totalAmount, 0);

    // 2. All-Time / Current Pipeline Totals
    const allPurchases = await prisma.purchase.findMany({
      where: centreFilter,
      select: {
        status: true,
        isFlagged: true,
        totalAmount: true,
        netWeight: true,
        crop: true,
        centreId: true,
        paymentRunId: true
      }
    });

    const approvedCount = allPurchases.filter((p: any) => p.status === 'APPROVED').length;
    const flaggedCount = allPurchases.filter((p: any) => p.isFlagged || p.status === 'FLAGGED').length;
    const pendingPurchases = allPurchases.filter((p: any) => p.status === 'PENDING_APPROVAL');

    // Pending payment: approved purchases not yet linked to a paid payment run
    const pendingPaymentPurchases = allPurchases.filter((p: any) => (p.status === 'APPROVED' || p.status === 'PENDING_APPROVAL') && !p.paymentRunId);
    const pendingPaymentAmount = pendingPaymentPurchases.reduce((acc: number, curr: any) => acc + curr.totalAmount, 0);
    const pendingPaymentCount = pendingPaymentPurchases.length;

    // 3. Crop-wise Procurement (Soybean vs Tur)
    const cropMap: Record<string, { weightKg: number; amount: number; count: number }> = {
      Soybean: { weightKg: 0, amount: 0, count: 0 },
      Tur: { weightKg: 0, amount: 0, count: 0 }
    };

    allPurchases.forEach((p: any) => {
      const crop = p.crop || 'Other';
      if (!cropMap[crop]) {
        cropMap[crop] = { weightKg: 0, amount: 0, count: 0 };
      }
      cropMap[crop].weightKg += p.netWeight;
      cropMap[crop].amount += p.totalAmount;
      cropMap[crop].count += 1;
    });

    const cropBreakdown = Object.entries(cropMap).map(([crop, data]) => ({
      crop,
      totalKg: Math.round(data.weightKg * 10) / 10,
      totalTonnes: Math.round((data.weightKg / 1000) * 100) / 100,
      totalAmount: Math.round(data.amount * 100) / 100,
      purchaseCount: data.count
    }));

    // 4. Centre-wise Procurement Breakdown
    const centres = await prisma.collectionCentre.findMany({
      where: isOperator && req.user?.centreId ? { id: req.user.centreId } : {},
      select: { id: true, code: true, name: true, village: true }
    });

    const centreBreakdown = centres.map((centre: any) => {
      const centrePurchases = allPurchases.filter((p: any) => p.centreId === centre.id);
      const totalWeightKg = centrePurchases.reduce((acc: number, p: any) => acc + p.netWeight, 0);
      const totalAmount = centrePurchases.reduce((acc: number, p: any) => acc + p.totalAmount, 0);
      return {
        centreId: centre.id,
        code: centre.code,
        name: centre.name,
        village: centre.village,
        totalPurchases: centrePurchases.length,
        totalWeightKg: Math.round(totalWeightKg * 10) / 10,
        totalTonnes: Math.round((totalWeightKg / 1000) * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100
      };
    });

    // 5. Recent 10 Transactions
    const recentTransactions = await prisma.purchase.findMany({
      where: centreFilter,
      orderBy: { purchaseDate: 'desc' },
      take: 10,
      include: {
        farmer: {
          select: { farmerId: true, fullName: true, village: true, mobileNumber: true }
        },
        centre: {
          select: { code: true, name: true }
        }
      }
    });

    // 6. Offline Sync Statistics
    const syncRecordsCount = await prisma.syncRecord.count();
    const successfulSyncs = await prisma.syncRecord.count({ where: { status: 'SUCCESS' } });
    const failedSyncs = await prisma.syncRecord.count({ where: { status: 'FAILED' } });

    return res.json({
      success: true,
      stats: {
        todayPurchases: todayCount,
        todayProcurementKg: Math.round(todayProcurementKg * 10) / 10,
        todayProcurementTonnes,
        todayPurchaseValue: Math.round(todayPurchaseValue * 100) / 100,
        pendingPaymentAmount: Math.round(pendingPaymentAmount * 100) / 100,
        pendingPaymentCount,
        approvedPurchases: approvedCount,
        flaggedPurchases: flaggedCount,
        pendingApprovalCount: pendingPurchases.length
      },
      cropBreakdown,
      centreBreakdown,
      recentTransactions,
      syncStatus: {
        totalReceivedViaSync: syncRecordsCount,
        successfulSyncs,
        failedSyncs
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

