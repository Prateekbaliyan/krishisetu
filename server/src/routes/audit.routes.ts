import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { verifyAuditChainIntegrity } from '../services/auditService';

const router = Router();

/**
 * GET /api/audit/logs
 */
router.get('/logs', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const { entityType, action, limit } = req.query;
    const where: any = {};

    if (entityType && entityType !== 'ALL') where.entityType = String(entityType);
    if (action && action !== 'ALL') where.action = String(action);

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Number(limit) || 50
    });

    return res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/audit/verify-chain
 * Validates SHA-256 cryptographic chain
 */
router.get('/verify-chain', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const verification = await verifyAuditChainIntegrity();
    return res.json({
      success: true,
      verification,
      notice: 'Server cryptographically verifies the immutable SHA-256 chain. Client-generated device timestamps cannot be independently assumed tamper-proof on rooted devices.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

