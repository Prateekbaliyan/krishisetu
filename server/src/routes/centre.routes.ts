import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/centres
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const centres = await prisma.collectionCentre.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { farmers: true, purchases: true, dispatches: true }
        }
      },
      orderBy: { code: 'asc' }
    });

    return res.json({ success: true, count: centres.length, centres });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/centres/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const centre = await prisma.collectionCentre.findFirst({
      where: {
        OR: [{ id }, { code: id }]
      },
      include: {
        farmers: { select: { id: true, farmerId: true, fullName: true, village: true } },
        purchases: {
          take: 20,
          orderBy: { purchaseDate: 'desc' },
          include: { farmer: { select: { fullName: true } } }
        }
      }
    });

    if (!centre) {
      return res.status(404).json({ success: false, error: 'Collection centre not found.' });
    }

    return res.json({ success: true, centre });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

