import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { getJwtSecret, signJwtToken } from '../src/middleware/auth';
import { verifyAuditChainIntegrity } from '../src/services/auditService';
import { isValidImageMagicBytes } from '../src/middleware/upload';
import fs from 'fs';
import path from 'path';

describe('KrishiSetu Security, Hardening & Compliance Verification Suite', () => {
  let operatorToken: string;
  let managerToken: string;
  let operatorUser: any;
  let managerUser: any;
  let testCentre: any;
  let anotherCentre: any;
  let testFarmer: any;

  beforeAll(async () => {
    // Specifically target C07 and C12 centres
    testCentre = await prisma.collectionCentre.findFirst({ where: { code: 'C07' } });
    anotherCentre = await prisma.collectionCentre.findFirst({ where: { code: 'C12' } });

    expect(testCentre).toBeDefined();
    expect(anotherCentre).toBeDefined();

    // Specifically target seeded users
    operatorUser = await prisma.user.findFirst({ where: { email: 'operator.c07@krishisetu.in' } });
    managerUser = await prisma.user.findFirst({ where: { role: 'MANAGER' } });

    expect(operatorUser).toBeDefined();
    expect(managerUser).toBeDefined();

    // Ensure operator is assigned to C07
    await prisma.user.update({
      where: { id: operatorUser.id },
      data: { centreId: testCentre.id }
    });
    operatorUser.centreId = testCentre.id;

    // Retrieve or seed a test farmer for C07
    testFarmer = await prisma.farmer.findFirst({
      where: { centreId: testCentre.id, bankVerificationStatus: 'VERIFIED' }
    });

    if (!testFarmer) {
      testFarmer = await prisma.farmer.create({
        data: {
          farmerId: 'MH-LTR-SEC-001',
          fullName: 'Security Test Farmer',
          village: testCentre.village,
          centreId: testCentre.id,
          landAreaAcres: 5.0,
          primaryCrop: 'Soybean',
          bankAccountName: 'Security Test Farmer',
          bankAccountNumber: '987654321012',
          ifscCode: 'MAHB0001234',
          bankName: 'Bank of Maharashtra',
          bankVerificationStatus: 'VERIFIED',
          mobileNumber: '9822001122'
        }
      });
    }
  });

  beforeEach(() => {
    // Always generate valid tokens for current tests
    operatorToken = signJwtToken({
      id: operatorUser.id,
      email: operatorUser.email,
      fullName: operatorUser.fullName,
      role: 'OPERATOR',
      centreId: testCentre.id
    });

    managerToken = signJwtToken({
      id: managerUser.id,
      email: managerUser.email,
      fullName: managerUser.fullName,
      role: 'MANAGER',
      centreId: null
    });
  });

  // 1. Production JWT Secret Validation
  describe('1. Production JWT Secret Validation', () => {
    it('throws fatal error in production mode if JWT_SECRET is missing or insecure', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'short';
        expect(() => getJwtSecret()).toThrow(/FATAL: Insecure or missing JWT_SECRET/);

        process.env.JWT_SECRET = 'krishisetu-dev-secret-key-32-chars-long';
        expect(() => getJwtSecret()).toThrow(/FATAL: Insecure or missing JWT_SECRET/);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalSecret === undefined) {
          delete process.env.JWT_SECRET;
        } else {
          process.env.JWT_SECRET = originalSecret;
        }
      }
    });

    it('accepts strong >=32 character JWT secret in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'a-very-strong-production-jwt-secret-with-more-than-32-chars';
        const secret = getJwtSecret();
        expect(secret).toBe('a-very-strong-production-jwt-secret-with-more-than-32-chars');
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalSecret === undefined) {
          delete process.env.JWT_SECRET;
        } else {
          process.env.JWT_SECRET = originalSecret;
        }
      }
    });
  });

  // 2. AI Mismatch Backend Enforcement
  describe('2. AI Mismatch Backend Enforcement', () => {
    it('blocks operator procurement creation when AI scale weight mismatch exceeds tolerance', async () => {
      const grossWeight = 1500.0;
      const mismatchedAiScale = 1450.0; // 50kg diff >> 2.0kg tolerance

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight,
          tareWeight: 15.0,
          moisture: 11.5,
          scaleAiWeight: mismatchedAiScale,
          aiVerificationStatus: 'MATCH' // Attempted client bypass!
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.requiresManagerApproval).toBe(true);
      expect(res.body.error).toMatch(/AI measurement mismatch detected/i);
    });

    it('allows procurement creation when authorized Manager approval is provided for AI variance', async () => {
      const grossWeight = 1500.0;
      const mismatchedAiScale = 1450.0;

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight,
          tareWeight: 15.0,
          moisture: 11.5,
          scaleAiWeight: mismatchedAiScale,
          managerApproval: {
            managerId: managerUser.id,
            decision: 'APPROVE',
            reason: 'Supervisor inspected digital display glare and confirmed 1500kg tare calibrated.'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.purchase.reviewedBy).toBe(managerUser.fullName);
      expect(res.body.purchase.reviewerId).toBe(managerUser.id);
      expect(res.body.purchase.reviewDecision).toBe('APPROVE');
    });
  });

  // 3. Central Published Daily Price Validation
  describe('3. Procurement Daily Price Validation', () => {
    it('completely ignores client-supplied rate and strictly applies central published daily price', async () => {
      const activePrice = await prisma.priceBoard.findFirst({
        where: { crop: 'Soybean', grade: 'Grade A', isActive: true }
      });
      expect(activePrice).toBeDefined();

      const maliciousTamperedRate = 99999.00;

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 500.0,
          tareWeight: 10.0,
          moisture: 11.0,
          ratePerQuintal: maliciousTamperedRate
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.purchase.ratePerQuintal).toBe(activePrice!.ratePerQuintal);
      expect(res.body.purchase.ratePerQuintal).not.toBe(maliciousTamperedRate);
    });

    it('rejects purchase creation when crop or grade has no active published rate', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'NonExistentCrop',
          grade: 'Grade Z',
          grossWeight: 500.0,
          tareWeight: 10.0,
          moisture: 11.0
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/No published daily rate found/i);
    });
  });

  // 4. Collection Centre Access Boundaries
  describe('4. Collection Centre Authorization Boundaries', () => {
    it('blocks operator from creating a purchase for a collection centre other than assigned centre', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: anotherCentre.id, // Unauthorized centre!
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 400.0,
          tareWeight: 10.0,
          moisture: 11.0
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Operators cannot submit purchases for other collection centres/i);
    });

    it('blocks operator from accessing a purchase slip from another collection centre', async () => {
      const otherSlipRes = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: anotherCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 300.0,
          tareWeight: 10.0,
          moisture: 11.0
        });

      expect(otherSlipRes.status).toBe(201);
      const otherSlipNumber = otherSlipRes.body.purchase.slipNumber;

      const res = await request(app)
        .get(`/api/purchases/${otherSlipNumber}`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied: You do not have permission/i);
    });
  });

  // 5. Offline Sync Idempotency & Duplicate Prevention
  describe('5. Offline Sync Idempotency & Duplicate Prevention', () => {
    it('does not create duplicate purchase on repeated offline sync submissions', async () => {
      const testKey = `test-offline-idempotency-${Date.now()}`;
      const batchPayload = {
        clientId: 'test-device-tablet-01',
        items: [
          {
            idempotencyKey: testKey,
            clientId: 'test-device-tablet-01',
            farmerId: testFarmer.id,
            centreId: testCentre.id,
            crop: 'Soybean',
            grade: 'Grade A',
            grossWeight: 600.0,
            tareWeight: 10.0,
            moisture: 11.5,
            clientDeviceTimestamp: new Date().toISOString(),
            localCreationTimestamp: new Date().toISOString()
          }
        ]
      };

      const res1 = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(batchPayload);

      expect(res1.status).toBe(200);
      expect(res1.body.batchSummary.syncedCount).toBe(1);
      expect(res1.body.batchSummary.duplicateCount).toBe(0);

      const res2 = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(batchPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.batchSummary.syncedCount).toBe(0);
      expect(res2.body.batchSummary.duplicateCount).toBe(1);

      const count = await prisma.purchase.count({
        where: { idempotencyKey: testKey }
      });
      expect(count).toBe(1);
    });
  });

  // 6. Payment Run Safety & Atomic Transaction Protection
  describe('6. Payment Run Safety & Transaction Atomicity', () => {
    it('prevents flagged or unapproved purchases from entering a payment run', async () => {
      const flaggedPurchase = await prisma.purchase.create({
        data: {
          slipNumber: `FLAG-${Date.now()}`,
          idempotencyKey: `flag-key-${Date.now()}`,
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 1000.0,
          tareWeight: 10.0,
          actualWeight: 990.0,
          moisture: 12.0,
          moistureDeductionPercent: 0,
          netWeight: 990.0,
          ratePerQuintal: 4850,
          totalAmount: 48015.00,
          status: 'FLAGGED',
          isFlagged: true,
          flagReason: 'Anomaly test flag',
          paymentEligibility: false
        }
      });

      const res = await request(app)
        .post('/api/payments/create-run')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ purchaseIds: [flaggedPurchase.id] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/None of the selected purchases are eligible/i);
    });

    it('prevents concurrent or duplicate assignment of the same purchase to multiple payment runs', async () => {
      const purchase = await prisma.purchase.create({
        data: {
          slipNumber: `PAY-SAFETY-${Date.now()}`,
          idempotencyKey: `pay-key-${Date.now()}`,
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 500.0,
          tareWeight: 10.0,
          actualWeight: 490.0,
          moisture: 11.0,
          moistureDeductionPercent: 0,
          netWeight: 490.0,
          ratePerQuintal: 4850,
          totalAmount: 23765.00,
          status: 'APPROVED',
          isFlagged: false,
          paymentEligibility: true
        }
      });

      const res1 = await request(app)
        .post('/api/payments/create-run')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ purchaseIds: [purchase.id] });

      expect(res1.status).toBe(201);
      expect(res1.body.success).toBe(true);

      const res2 = await request(app)
        .post('/api/payments/create-run')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ purchaseIds: [purchase.id] });

      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error).toMatch(/None of the selected purchases are eligible/i);
    });
  });

  // 7. Image Upload Binary Inspection Security
  describe('7. Image Upload Binary Magic-Bytes Security', () => {
    it('detects and rejects fake images with invalid magic bytes', () => {
      const tempFakeFile = path.join(process.cwd(), 'uploads', `fake-${Date.now()}.jpg`);
      fs.writeFileSync(tempFakeFile, '<?php echo "malicious script"; ?>');

      try {
        const isValid = isValidImageMagicBytes(tempFakeFile);
        expect(isValid).toBe(false);
      } finally {
        if (fs.existsSync(tempFakeFile)) fs.unlinkSync(tempFakeFile);
      }
    });

    it('validates genuine JPEG image magic bytes', () => {
      const tempValidFile = path.join(process.cwd(), 'uploads', `valid-${Date.now()}.jpg`);
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      fs.writeFileSync(tempValidFile, jpegHeader);

      try {
        const isValid = isValidImageMagicBytes(tempValidFile);
        expect(isValid).toBe(true);
      } finally {
        if (fs.existsSync(tempValidFile)) fs.unlinkSync(tempValidFile);
      }
    });
  });

  // 8. Cryptographic SHA-256 Audit Hash Chain
  describe('8. Cryptographic SHA-256 Audit Chain Integrity', () => {
    it('verifies that the audit hash chain is intact and valid', async () => {
      const integrity = await verifyAuditChainIntegrity();
      expect(integrity.isValid).toBe(true);
      expect(integrity.totalVerified).toBeGreaterThan(0);
    });
  });
});
