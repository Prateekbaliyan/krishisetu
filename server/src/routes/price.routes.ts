import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/auditService';

const router = Router();

/**
 * GET /api/prices/active
 * Returns currently active published prices across crops and grades
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const prices = await prisma.priceBoard.findMany({
      where: { isActive: true },
      orderBy: [{ crop: 'asc' }, { grade: 'asc' }]
    });

    // Structure into a quick lookup dictionary: { Soybean: { "Grade A": 4850, "FAQ": 4650 }, Tur: { ... } }
    const lookup: Record<string, Record<string, number>> = {};
    for (const p of prices) {
      if (!lookup[p.crop]) lookup[p.crop] = {};
      lookup[p.crop][p.grade] = p.ratePerQuintal;
    }

    return res.json({
      success: true,
      prices,
      lookup,
      effectiveDate: prices[0]?.effectiveDate || new Date().toISOString().split('T')[0]
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/prices/history
 * Complete history of published rates
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const history = await prisma.priceHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return res.json({ success: true, count: history.length, history });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/prices/publish
 * Office Manager sets and publishes daily rates across crops and grades
 */
router.post('/publish', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const { effectiveDate, rates, changeReason } = req.body;
    // Expected rates array format:
    // [
    //   { crop: "Soybean", grade: "Grade A", ratePerQuintal: 4850.00 },
    //   { crop: "Soybean", grade: "FAQ", ratePerQuintal: 4650.00 },
    //   { crop: "Tur", grade: "Grade A", ratePerQuintal: 7200.00 },
    //   { crop: "Tur", grade: "FAQ", ratePerQuintal: 7000.00 }
    // ]

    if (!effectiveDate || !Array.isArray(rates) || rates.length === 0) {
      return res.status(400).json({ success: false, error: 'Effective date and valid rates array are required.' });
    }

    const publisherName = req.user!.fullName;
    const publisherId = req.user!.id;
    const reason = changeReason || 'Routine Daily Market Procurement Rate Revision';

    const publishedRecords: any[] = [];

    for (const item of rates) {
      const rate = Number(item.ratePerQuintal);
      if (isNaN(rate) || rate <= 0) {
        return res.status(400).json({ success: false, error: `Invalid rate for ${item.crop} - ${item.grade}` });
      }

      // Deactivate existing active rate for this crop and grade
      await prisma.priceBoard.updateMany({
        where: { crop: item.crop, grade: item.grade, isActive: true },
        data: { isActive: false }
      });

      // Create new active price board record
      const newPrice = await prisma.priceBoard.create({
        data: {
          crop: item.crop,
          grade: item.grade,
          ratePerQuintal: rate,
          effectiveDate,
          publishedBy: publisherName,
          isActive: true
        }
      });

      // Log into PriceHistory
      await prisma.priceHistory.create({
        data: {
          crop: item.crop,
          grade: item.grade,
          ratePerQuintal: rate,
          effectiveDate,
          changedBy: publisherName,
          changeReason: reason
        }
      });

      publishedRecords.push(newPrice);
    }

    // Create Audit Log
    await createAuditLog({
      entityType: 'PRICE',
      entityId: `PRICE-BOARD-${effectiveDate}`,
      action: 'UPDATE',
      userId: publisherId,
      userName: publisherName,
      details: {
        effectiveDate,
        ratesPublished: rates,
        reason
      }
    });

    return res.json({
      success: true,
      message: `Successfully published ${publishedRecords.length} daily procurement rates effective ${effectiveDate}.`,
      prices: publishedRecords
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

