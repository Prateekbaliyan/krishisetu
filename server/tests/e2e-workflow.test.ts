import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

describe('KrishiSetu Full End-to-End Procurement & Payment Workflow', () => {
  let operatorToken: string;
  let managerToken: string;
  let operatorCentreId: string;
  let sampleFarmerId: string;
  let createdSlipNumber: string;
  let createdPurchaseId: string;
  let paymentRunId: string;

  beforeAll(async () => {
    // Ensure database has active test seed data
    const centre = await prisma.collectionCentre.findFirst({ where: { code: 'C07' } });
    expect(centre).toBeDefined();
    operatorCentreId = centre!.id;

    const farmer = await prisma.farmer.findFirst({ where: { farmerId: 'MH-LTR-1001' } });
    expect(farmer).toBeDefined();
    sampleFarmerId = farmer!.id;
  });

  // Step 1: Authentication & RBAC
  describe('1. Authentication & Role Enforcement', () => {
    it('successfully logs in as Centre Operator', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'operator.c07@krishisetu.in',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('OPERATOR');
      operatorToken = res.body.token;
    });

    it('successfully logs in as Office Manager', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'manager@krishisetu.in',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('MANAGER');
      managerToken = res.body.token;
    });

    it('blocks unauthorized access to manager-only endpoints by operator', async () => {
      const res = await request(app)
        .post('/api/prices/publish')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          effectiveDate: '2026-11-05',
          rates: [{ crop: 'Soybean', grade: 'Grade A', ratePerQuintal: 4900 }]
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('rejects unauthenticated requests without token', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(401);
    });
  });

  // Step 2: Farmer Selection & Verification
  describe('2. Farmer Registry Lookup', () => {
    it('allows operator to search farmer by name and retrieves masked bank accounts', async () => {
      const res = await request(app)
        .get('/api/farmers?search=Sunil')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.farmers.length).toBeGreaterThan(0);
      const farmer = res.body.farmers[0];
      expect(farmer.fullName).toBe('Sunil Jadhav');
      expect(farmer.bankAccountNumber).toContain('XXXX-XXXX-');
    });
  });

  // Step 3: Collection Entry & Slip Generation
  describe('3. Purchase Creation & Digital Slip', () => {
    it('rejects invalid procurement entry with tare weight >= gross weight', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          farmerId: sampleFarmerId,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 50.0,
          tareWeight: 60.0, // Invalid!
          moisture: 11.5,
          ratePerQuintal: 4850.00
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('strictly greater than tare weight');
    });

    it('creates valid purchase, calculates amounts, logs SMS, and returns unique slip', async () => {
      const idempotencyKey = uuidv4();
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          idempotencyKey,
          farmerId: sampleFarmerId,
          centreId: operatorCentreId,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 1500.0,
          tareWeight: 20.0,
          moisture: 13.0, // 1% deduction
          ratePerQuintal: 4850.00
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.purchase).toBeDefined();
      expect(res.body.purchase.slipNumber).toMatch(/^C07-\d+$/);

      createdSlipNumber = res.body.purchase.slipNumber;
      createdPurchaseId = res.body.purchase.id;

      // Verification of math:
      // Actual = 1500 - 20 = 1480.0
      // Moisture deduction = (13 - 12) * 1% = 1.0%
      // Net weight = 1480.0 * 0.99 = 1465.2 kg
      // Amount = 1465.2 * 4850 / 100 = 71062.20
      expect(res.body.purchase.actualWeight).toBe(1480.0);
      expect(res.body.purchase.netWeight).toBe(1465.2);
      expect(res.body.purchase.totalAmount).toBe(71062.20);

      // Verify simulated Marathi SMS payload
      expect(res.body.sms.isSimulated).toBe(true);
      expect(res.body.sms.formattedMessage).toContain('खरेदीची पावती');
      expect(res.body.sms.formattedMessage).toContain(createdSlipNumber);
    });

    it('prevents duplicate purchase when submitted with same idempotency key', async () => {
      const duplicateKey = 'DUP-KEY-TEST-001';
      // First submission
      await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          idempotencyKey: duplicateKey,
          farmerId: sampleFarmerId,
          centreId: operatorCentreId,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 500.0,
          tareWeight: 10.0,
          moisture: 11.0,
          ratePerQuintal: 4850.00
        });

      // Second identical submission
      const res2 = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          idempotencyKey: duplicateKey,
          farmerId: sampleFarmerId,
          centreId: operatorCentreId,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 500.0,
          tareWeight: 10.0,
          moisture: 11.0,
          ratePerQuintal: 4850.00
        });

      expect(res2.status).toBe(200);
      expect(res2.body.isDuplicateSubmission).toBe(true);
    });
  });

  // Step 4: Offline Batch Sync
  describe('4. Offline Batch Sync & Conflict Handling', () => {
    it('syncs offline purchase queue with idempotency validation and server recalculation', async () => {
      const offlineKey1 = uuidv4();
      const offlineKey2 = uuidv4();

      const batchPayload = {
        clientId: 'device-tablet-c07-01',
        items: [
          {
            idempotencyKey: offlineKey1,
            farmerId: sampleFarmerId,
            centreId: operatorCentreId,
            crop: 'Soybean',
            grade: 'Grade A',
            grossWeight: 800.0,
            tareWeight: 10.0,
            moisture: 11.5,
            ratePerQuintal: 4850.00,
            clientDeviceTimestamp: new Date().toISOString(),
            localCreationTimestamp: new Date().toISOString()
          },
          {
            idempotencyKey: offlineKey2,
            farmerId: sampleFarmerId,
            centreId: operatorCentreId,
            crop: 'Soybean',
            grade: 'Grade A',
            grossWeight: 950.0,
            tareWeight: 12.0,
            moisture: 12.0,
            ratePerQuintal: 4850.00,
            clientDeviceTimestamp: new Date().toISOString(),
            localCreationTimestamp: new Date().toISOString()
          }
        ]
      };

      const res = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(batchPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.batchSummary.syncedCount).toBe(2);
      expect(res.body.batchSummary.failedCount).toBe(0);

      // Re-submitting the exact same batch tests duplicate prevention
      const resDuplicate = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(batchPayload);

      expect(resDuplicate.status).toBe(200);
      expect(resDuplicate.body.batchSummary.duplicateCount).toBe(2);
      expect(resDuplicate.body.batchSummary.syncedCount).toBe(0);
    });
  });

  // Step 5: Office Manager Review & Approval
  describe('5. Manager Review, Anomaly Resolution & Approval', () => {
    it('allows Office Manager to approve purchase for payment eligibility', async () => {
      const res = await request(app)
        .post(`/api/purchases/${createdPurchaseId}/review`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          decision: 'APPROVE',
          notes: 'Supervisor inspected quality and moisture meter calibration. Verified.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.purchase.status).toBe('APPROVED');
      expect(res.body.purchase.paymentEligibility).toBe(true);
    });
  });

  // Step 6: Payment Run & Bank CSV Export
  describe('6. Payment Run Generation & Bank CSV Export', () => {
    it('lists approved purchases eligible for payment run', async () => {
      const res = await request(app)
        .get('/api/payments/eligible')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.eligiblePurchases.length).toBeGreaterThan(0);
      expect(res.body.groupedByFarmer.length).toBeGreaterThan(0);
    });

    it('creates payment run batch, generates payments, and outputs CSV', async () => {
      const res = await request(app)
        .post('/api/payments/create-run')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          purchaseIds: [createdPurchaseId]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.paymentRun).toBeDefined();
      expect(res.body.paymentRun.batchNumber).toMatch(/^BATCH-\d+-\d+$/);

      paymentRunId = res.body.paymentRun.id;
    });

    it('downloads the generated bank CSV file', async () => {
      const res = await request(app)
        .get(`/api/payments/runs/${paymentRunId}/download-csv`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('# FORMAT: GENERIC MOCK NEFT/NACH BULK PAYMENT FILE');
      expect(res.text).toContain('Sunil Baban Jadhav');
    });

    it('simulates bank clearing callback: updates batch status to PAID', async () => {
      const res = await request(app)
        .post(`/api/payments/runs/${paymentRunId}/simulate-bank`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ targetStatus: 'PAID' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // Step 7: Cryptographic Audit Trail Verification
  describe('7. SHA-256 Audit Log Chain Integrity', () => {
    it('verifies the cryptographic hash chaining of all audit events', async () => {
      const res = await request(app)
        .get('/api/audit/verify-chain')
        .set('Authorization', `Bearer ${managerToken}`);

      if (!res.body.verification.isValid) {
        console.log('Verification failure detail:', res.body.verification);
      }
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verification.isValid).toBe(true);
      expect(res.body.verification.totalVerified).toBeGreaterThan(0);
    });
  });
});
