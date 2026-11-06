import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { generateBankBulkPaymentCsv } from '../lib/bankCsvAdapter';
import { createAuditLog } from '../services/auditService';

const router = Router();

/**
 * GET /api/payments/eligible
 * Lists approved purchases that are strictly eligible for a new payment run.
 * Rules:
 * - Must be approved (status = 'APPROVED')
 * - Must NOT already be linked to a PaymentRun (paymentRunId is null)
 * - Must NOT be flagged (isFlagged = false)
 * - Farmer must have bankVerificationStatus = 'VERIFIED'
 */
router.get('/eligible', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const eligiblePurchases = await prisma.purchase.findMany({
      where: {
        status: 'APPROVED',
        paymentRunId: null,
        isFlagged: false,
        paymentEligibility: true,
        farmer: {
          bankVerificationStatus: 'VERIFIED'
        }
      },
      include: {
        farmer: {
          select: {
            id: true,
            farmerId: true,
            fullName: true,
            village: true,
            bankAccountName: true,
            bankAccountNumber: true,
            ifscCode: true,
            bankName: true,
            bankVerificationStatus: true
          }
        },
        centre: {
          select: { code: true, name: true }
        }
      },
      orderBy: { purchaseDate: 'asc' }
    });

    // Group by farmer for consolidated payment previews
    const farmerGroups: Record<string, {
      farmer: any;
      purchaseIds: string[];
      slipNumbers: string[];
      totalAmount: number;
      totalNetWeightKg: number;
    }> = {};

    eligiblePurchases.forEach(p => {
      const fId = p.farmer.id;
      if (!farmerGroups[fId]) {
        farmerGroups[fId] = {
          farmer: {
            ...p.farmer,
            maskedAccountNumber: `XXXX-XXXX-${p.farmer.bankAccountNumber.slice(-4)}`
          },
          purchaseIds: [],
          slipNumbers: [],
          totalAmount: 0,
          totalNetWeightKg: 0
        };
      }
      farmerGroups[fId].purchaseIds.push(p.id);
      farmerGroups[fId].slipNumbers.push(p.slipNumber);
      farmerGroups[fId].totalAmount += p.totalAmount;
      farmerGroups[fId].totalNetWeightKg += p.netWeight;
    });

    const groupedList = Object.values(farmerGroups).map(g => ({
      ...g,
      totalAmount: Math.round(g.totalAmount * 100) / 100,
      totalNetWeightKg: Math.round(g.totalNetWeightKg * 10) / 10
    }));

    const totalEligibleAmount = eligiblePurchases.reduce((acc, p) => acc + p.totalAmount, 0);

    return res.json({
      success: true,
      eligibleCount: eligiblePurchases.length,
      distinctFarmersCount: groupedList.length,
      totalEligibleAmount: Math.round(totalEligibleAmount * 100) / 100,
      eligiblePurchases,
      groupedByFarmer: groupedList
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/create-run
 * Generates a payment batch inside an atomic database transaction.
 * Guarantees:
 * - Strict eligibility re-check inside transaction (blocks flagged, unapproved or unverified farmers)
 * - Atomic assignment prevents double allocation or concurrent race condition
 * - Validates bank account numbers and IFSC format
 * - Generates mock bank CSV and clearly separates generation from payment completion ('PENDING' vs 'PAID')
 */
router.post('/create-run', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const { purchaseIds } = req.body;

    if (!Array.isArray(purchaseIds) || purchaseIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Must select at least one eligible purchase.' });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Execute batch generation within an isolated database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Recheck eligibility inside transaction with strict criteria
      const purchases = await tx.purchase.findMany({
        where: {
          id: { in: purchaseIds },
          paymentRunId: null, // Strictly unlinked
          status: 'APPROVED', // Strictly approved
          isFlagged: false, // Must not be flagged
          paymentEligibility: true,
          farmer: {
            bankVerificationStatus: 'VERIFIED'
          }
        },
        include: {
          farmer: true
        }
      });

      if (purchases.length === 0) {
        throw new Error('None of the selected purchases are eligible for payment run (may be already included, unapproved, or flagged).');
      }

      // 2. Validate all farmer bank details
      for (const p of purchases) {
        if (!p.farmer.bankAccountNumber || p.farmer.bankAccountNumber.trim().length < 8) {
          throw new Error(`Farmer ${p.farmer.fullName} (${p.farmer.farmerId}) has invalid or missing bank account number.`);
        }
        if (!p.farmer.ifscCode || p.farmer.ifscCode.trim().length < 11) {
          throw new Error(`Farmer ${p.farmer.fullName} (${p.farmer.farmerId}) has invalid or missing IFSC code.`);
        }
      }

      // 3. Batch identifier
      const runCount = await tx.paymentRun.count();
      const batchNumber = `BATCH-${dateStr}-${String(runCount + 1).padStart(3, '0')}`;

      // 4. Group purchases by farmer
      const farmerTotals: Record<string, { farmer: any; amount: number; slips: string[] }> = {};
      for (const p of purchases) {
        const fId = p.farmer.id;
        if (!farmerTotals[fId]) {
          farmerTotals[fId] = { farmer: p.farmer, amount: 0, slips: [] };
        }
        farmerTotals[fId].amount += p.totalAmount;
        farmerTotals[fId].slips.push(p.slipNumber);
      }

      const totalAmount = purchases.reduce((acc, p) => acc + p.totalAmount, 0);
      const totalFarmers = Object.keys(farmerTotals).length;

      // 5. Create PaymentRun in database (Status: PENDING - generated, not yet processed)
      const paymentRun = await tx.paymentRun.create({
        data: {
          batchNumber,
          totalFarmers,
          totalPurchases: purchases.length,
          totalAmount: Math.round(totalAmount * 100) / 100,
          status: 'PENDING',
          createdBy: req.user!.fullName
        }
      });

      // 6. Create individual Payment records for each farmer
      const paymentRecordsForCsv = [];
      for (const [farmerId, data] of Object.entries(farmerTotals)) {
        const pRecord = await tx.payment.create({
          data: {
            paymentRunId: paymentRun.id,
            farmerId,
            amount: Math.round(data.amount * 100) / 100,
            bankAccountName: data.farmer.bankAccountName,
            bankAccountNumber: data.farmer.bankAccountNumber,
            ifscCode: data.farmer.ifscCode,
            status: 'PENDING'
          }
        });

        paymentRecordsForCsv.push({
          batchNumber,
          paymentId: pRecord.id,
          farmerId: data.farmer.farmerId,
          farmerName: data.farmer.fullName,
          bankAccountName: data.farmer.bankAccountName,
          bankAccountNumber: data.farmer.bankAccountNumber,
          ifscCode: data.farmer.ifscCode,
          bankName: data.farmer.bankName,
          amount: Math.round(data.amount * 100) / 100,
          remarks: `Slips: ${data.slips.join(',')}`,
          date: new Date().toISOString().split('T')[0]
        });
      }

      // 7. Atomically link purchases to this paymentRun (guards against concurrent race conditions)
      const updateResult = await tx.purchase.updateMany({
        where: {
          id: { in: purchases.map(p => p.id) },
          paymentRunId: null
        },
        data: { paymentRunId: paymentRun.id }
      });

      if (updateResult.count !== purchases.length) {
        throw new Error('Concurrent payment conflict detected: Some purchases were assigned to another batch simultaneously.');
      }

      // 8. Generate CSV content using adapter
      const csvContent = generateBankBulkPaymentCsv({
        batchNumber,
        companyName: 'Latur Farmer Producer Company Ltd',
        records: paymentRecordsForCsv
      });

      const csvFileName = `${batchNumber}-BulkPayment.csv`;

      // Save CSV content and file name in PaymentRun
      const updatedRun = await tx.paymentRun.update({
        where: { id: paymentRun.id },
        data: {
          csvFileName,
          csvContent
        },
        include: {
          payments: {
            include: {
              farmer: {
                select: { farmerId: true, fullName: true, mobileNumber: true }
              }
            }
          }
        }
      });

      return { updatedRun, batchNumber, totalPurchases: purchases.length, totalFarmers, totalAmount };
    });

    // 9. Immutable Audit Log after transaction commit
    await createAuditLog({
      entityType: 'PAYMENT',
      entityId: result.updatedRun.id,
      action: 'PAYMENT_RUN',
      userId: req.user!.id,
      userName: req.user!.fullName,
      details: {
        batchNumber: result.batchNumber,
        totalPurchases: result.totalPurchases,
        totalFarmers: result.totalFarmers,
        totalAmount: result.totalAmount
      }
    });

    return res.status(201).json({
      success: true,
      message: `Payment Run ${result.batchNumber} generated successfully.`,
      paymentRun: result.updatedRun
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payments/runs
 * List payment runs
 */
router.get('/runs', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const runs = await prisma.paymentRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { purchases: true, payments: true } },
        payments: {
          include: {
            farmer: { select: { farmerId: true, fullName: true, village: true } }
          }
        }
      }
    });

    return res.json({ success: true, count: runs.length, runs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payments/runs/:id/download-csv
 * Download payment CSV
 */
router.get('/runs/:id/download-csv', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const run = await prisma.paymentRun.findUnique({ where: { id } });

    if (!run || !run.csvContent) {
      return res.status(404).json({ success: false, error: 'Payment run CSV not found.' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${run.csvFileName || 'bulk-payment.csv'}"`);
    return res.send(run.csvContent);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/runs/:id/simulate-bank
 * Simulates bank processing response (PAID or PROCESSING or FAILED)
 * Only when transition to PAID occurs are the underlying purchases marked as PAID.
 */
router.post('/runs/:id/simulate-bank', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { targetStatus } = req.body; // "PAID" | "PROCESSING" | "FAILED"

    const run = await prisma.paymentRun.findUnique({
      where: { id },
      include: { payments: true, purchases: true }
    });

    if (!run) {
      return res.status(404).json({ success: false, error: 'Payment run not found.' });
    }

    const newStatus = targetStatus || 'PAID';
    const now = new Date();

    // Update PaymentRun
    await prisma.paymentRun.update({
      where: { id },
      data: {
        status: newStatus,
        processedAt: newStatus === 'PAID' ? now : undefined,
        approvedBy: req.user!.fullName
      }
    });

    // Update individual payments
    for (const pmt of run.payments) {
      const refNum = `UTR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      await prisma.payment.update({
        where: { id: pmt.id },
        data: {
          status: newStatus,
          bankReferenceNumber: newStatus === 'PAID' ? refNum : null,
          paidAt: newStatus === 'PAID' ? now : null
        }
      });
    }

    // When bank confirms payment (PAID), mark all underlying purchases as PAID
    if (newStatus === 'PAID') {
      await prisma.purchase.updateMany({
        where: { paymentRunId: id },
        data: { status: 'PAID' }
      });
    }

    // Audit Log
    await createAuditLog({
      entityType: 'PAYMENT',
      entityId: id,
      action: 'UPDATE',
      userId: req.user!.id,
      userName: req.user!.fullName,
      details: {
        batchNumber: run.batchNumber,
        simulatedStatus: newStatus,
        totalAmount: run.totalAmount
      }
    });

    return res.json({
      success: true,
      message: `Simulated bank response applied: Payment Run ${run.batchNumber} is now ${newStatus}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
