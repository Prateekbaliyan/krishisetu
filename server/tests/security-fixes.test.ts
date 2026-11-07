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
  let anotherManagerUser: any;
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

    // Seed or find another manager for identity override test
    anotherManagerUser = await prisma.user.findFirst({
      where: { role: 'MANAGER', id: { not: managerUser.id } }
    });

    if (!anotherManagerUser) {
      anotherManagerUser = await prisma.user.create({
        data: {
          email: 'regional.manager@krishisetu.in',
          passwordHash: managerUser.passwordHash,
          fullName: 'Regional Review Manager',
          role: 'MANAGER',
          centreId: null
        }
      });
    }

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
    // Generate valid tokens for each test
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

  // 2. Manager Approval Security & AI Mismatch Gating
  describe('2. Manager Approval Security & AI Mismatch Gating', () => {
    it('rejects approval when Centre Operator submits a manager ID in payload', async () => {
      const grossWeight = 1500.0;
      const mismatchedAiScale = 1450.0; // 50kg diff >> 2.0kg tolerance

      // Centre Operator attempts to bypass AI mismatch by supplying managerUser.id
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
            reason: 'Forged operator note claiming manager approval'
          }
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.requiresManagerApproval).toBe(true);
      expect(res.body.error).toMatch(/Procurement creation blocked until reviewed and approved by an authenticated Office Manager/i);
    });

    it('rejects approval attempt from unauthenticated user', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .send({
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight: 1500.0,
          tareWeight: 15.0,
          moisture: 11.5,
          scaleAiWeight: 1450.0
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Authentication required/i);
    });

    it('accepts approval when authenticated MANAGER approves with a non-empty reason', async () => {
      const grossWeight = 1500.0;
      const mismatchedAiScale = 1450.0;

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight,
          tareWeight: 15.0,
          moisture: 11.5,
          scaleAiWeight: mismatchedAiScale,
          reviewReason: 'Supervisor checked weighing scale tare calibration and verified 1500kg gross.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.purchase.reviewedBy).toBe(managerUser.fullName);
      expect(res.body.purchase.reviewerId).toBe(managerUser.id);
      expect(res.body.purchase.reviewDecision).toBe('APPROVE');
      expect(res.body.purchase.reviewNotes).toContain('Supervisor checked weighing scale tare calibration');
    });

    it('rejects Manager approval when review reason is empty or whitespace-only', async () => {
      const grossWeight = 1500.0;
      const mismatchedAiScale = 1450.0;

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          farmerId: testFarmer.id,
          centreId: testCentre.id,
          crop: 'Soybean',
          grade: 'Grade A',
          grossWeight,
          tareWeight: 15.0,
          moisture: 11.5,
          scaleAiWeight: mismatchedAiScale,
          reviewReason: '   ' // Empty whitespace
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/A non-empty review reason is required/i);
    });

    it('ensures client-supplied manager ID cannot override authenticated manager identity', async () => {
      const grossWeight = 1200.0;
      const mismatchedAiScale = 1150.0;

      // Authenticated as managerUser, but payload passes anotherManagerUser.id
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${managerToken}`)
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
            managerId: anotherManagerUser.id, // Attempted spoof of another manager
            reason: 'Legitimate manager review from logged-in manager'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Reviewer ID MUST be derived strictly from server-side JWT session, NOT payload!
      expect(res.body.purchase.reviewerId).toBe(managerUser.id);
      expect(res.body.purchase.reviewerId).not.toBe(anotherManagerUser.id);
      expect(res.body.purchase.reviewedBy).toBe(managerUser.fullName);
    });

    it('ensures offline sync mismatch cannot bypass manager review', async () => {
      const syncKey = `offline-mismatch-test-${Date.now()}`;
      const res = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          clientId: 'tablet-device-01',
          items: [
            {
              idempotencyKey: syncKey,
              clientId: 'tablet-device-01',
              farmerId: testFarmer.id,
              centreId: testCentre.id,
              crop: 'Soybean',
              grade: 'Grade A',
              grossWeight: 1500.0,
              tareWeight: 15.0,
              moisture: 11.5,
              scaleAiWeight: 1400.0, // 100kg difference >> tolerance
              aiVerificationStatus: 'MATCH', // Attempted bypass
              clientDeviceTimestamp: new Date().toISOString(),
              localCreationTimestamp: new Date().toISOString()
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.batchSummary.syncedCount).toBe(1);

      // Verify the synced purchase is FLAGGED in database, ineligible for payment, with no manager reviewer
      const purchase = await prisma.purchase.findUnique({
        where: { idempotencyKey: syncKey }
      });
      expect(purchase).toBeDefined();
      expect(purchase!.isFlagged).toBe(true);
      expect(purchase!.status).toBe('FLAGGED');
      expect(purchase!.paymentEligibility).toBe(false);
      expect(purchase!.reviewerId).toBeNull();
      expect(purchase!.flagReason).toMatch(/AI Measurement Mismatch/i);
    });
  });

  // 3. Offline Sync Pricing Hardening
  describe('3. Offline Sync Pricing Hardening', () => {
    it('ignores fake client price and strictly applies central database price', async () => {
      const activePrice = await prisma.priceBoard.findFirst({
        where: { crop: 'Soybean', grade: 'Grade A', isActive: true }
      });
      expect(activePrice).toBeDefined();

      const syncKey = `offline-price-fake-${Date.now()}`;
      const fakePrice = 99999.00;

      const res = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          clientId: 'tablet-01',
          items: [
            {
              idempotencyKey: syncKey,
              clientId: 'tablet-01',
              farmerId: testFarmer.id,
              centreId: testCentre.id,
              crop: 'Soybean',
              grade: 'Grade A',
              grossWeight: 500.0,
              tareWeight: 10.0,
              moisture: 11.0,
              ratePerQuintal: fakePrice, // Fake rate from client
              clientDeviceTimestamp: new Date().toISOString(),
              localCreationTimestamp: new Date().toISOString()
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.batchSummary.syncedCount).toBe(1);

      const purchase = await prisma.purchase.findUnique({
        where: { idempotencyKey: syncKey }
      });
      expect(purchase).toBeDefined();
      expect(purchase!.ratePerQuintal).toBe(activePrice!.ratePerQuintal);
      expect(purchase!.ratePerQuintal).not.toBe(fakePrice);
    });

    it('rejects sync record when no active published price exists, or when price is expired or future-dated', async () => {
      const syncKey = `offline-no-price-${Date.now()}`;

      // 1. Unpublished / unsupported crop
      const res = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          clientId: 'tablet-01',
          items: [
            {
              idempotencyKey: syncKey,
              clientId: 'tablet-01',
              farmerId: testFarmer.id,
              centreId: testCentre.id,
              crop: 'Wheat', // Unpublished / unsupported crop
              grade: 'Grade A',
              grossWeight: 500.0,
              tareWeight: 10.0,
              moisture: 11.0,
              clientDeviceTimestamp: new Date().toISOString(),
              localCreationTimestamp: new Date().toISOString()
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.batchSummary.syncedCount).toBe(0);
      expect(res.body.batchSummary.failedCount).toBe(1);
      expect(res.body.results[0].status).toBe('FAILED');
      expect(res.body.results[0].error).toMatch(/Invalid or unsupported crop|No applicable published daily price/i);

      // Verify no record was created in database
      const purchase = await prisma.purchase.findUnique({
        where: { idempotencyKey: syncKey }
      });
      expect(purchase).toBeNull();

      // 2. Expired / Inactive Price: Verify an inactive price cannot be used
      const expiredKey = `offline-expired-price-${Date.now()}`;
      const expiredPrice = await prisma.priceBoard.create({
        data: {
          crop: 'Soybean',
          grade: 'Grade B',
          ratePerQuintal: 4200.00,
          effectiveDate: '2026-10-01',
          publishedBy: 'System Test',
          isActive: false // Expired / Deactivated
        }
      });

      const resExpired = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          clientId: 'tablet-01',
          items: [
            {
              idempotencyKey: expiredKey,
              farmerId: testFarmer.id,
              centreId: testCentre.id,
              crop: 'Soybean',
              grade: 'Grade B',
              grossWeight: 500.0,
              tareWeight: 10.0,
              moisture: 11.0,
              clientDeviceTimestamp: new Date().toISOString(),
              localCreationTimestamp: new Date().toISOString()
            }
          ]
        });

      expect(resExpired.status).toBe(200);
      expect(resExpired.body.batchSummary.failedCount).toBe(1);
      expect(resExpired.body.results[0].status).toBe('FAILED');
      expect(resExpired.body.results[0].error).toMatch(/No applicable published daily price/i);

      await prisma.priceBoard.delete({ where: { id: expiredPrice.id } });

      // 3. Future-Dated Price: Procurement occurred on 2026-11-01, but rate is only effective in future (2099-01-01)
      const futurePriceKey = `offline-future-price-${Date.now()}`;
      const futurePriceRecord = await prisma.priceBoard.create({
        data: {
          crop: 'Tur',
          grade: 'Grade B',
          ratePerQuintal: 7500.00,
          effectiveDate: '2099-01-01', // Far future date
          publishedBy: 'System Test',
          isActive: true
        }
      });

      const resFuture = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          clientId: 'tablet-01',
          items: [
            {
              idempotencyKey: futurePriceKey,
              farmerId: testFarmer.id,
              centreId: testCentre.id,
              crop: 'Tur',
              grade: 'Grade B',
              grossWeight: 500.0,
              tareWeight: 10.0,
              moisture: 11.0,
              localCreationTimestamp: '2026-11-01T10:00:00.000Z' // Earlier than effective date
            }
          ]
        });

      expect(resFuture.status).toBe(200);
      expect(resFuture.body.batchSummary.failedCount).toBe(1);
      expect(resFuture.body.results[0].status).toBe('FAILED');
      expect(resFuture.body.results[0].error).toMatch(/No applicable published daily price found.*on or before procurement date/i);

      await prisma.priceBoard.delete({ where: { id: futurePriceRecord.id } });
    });

    it('uses server database price when valid published price exists and applies latest applicable rate', async () => {
      const turPrice = await prisma.priceBoard.findFirst({
        where: { crop: 'Tur', grade: 'Grade A', isActive: true }
      });
      expect(turPrice).toBeDefined();

      const syncKey = `offline-tur-price-${Date.now()}`;

      const res = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          clientId: 'tablet-01',
          items: [
            {
              idempotencyKey: syncKey,
              clientId: 'tablet-01',
              farmerId: testFarmer.id,
              centreId: testCentre.id,
              crop: 'Tur',
              grade: 'Grade A',
              grossWeight: 400.0,
              tareWeight: 10.0,
              moisture: 10.0,
              clientDeviceTimestamp: new Date().toISOString(),
              localCreationTimestamp: new Date().toISOString()
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.batchSummary.syncedCount).toBe(1);

      const purchase = await prisma.purchase.findUnique({
        where: { idempotencyKey: syncKey }
      });
      expect(purchase).toBeDefined();
      expect(purchase!.ratePerQuintal).toBe(turPrice!.ratePerQuintal);
    });

    it('retried sync request does not create duplicate procurement entries', async () => {
      const testKey = `test-offline-retry-${Date.now()}`;
      const batchPayload = {
        clientId: 'tablet-device-retry',
        items: [
          {
            idempotencyKey: testKey,
            clientId: 'tablet-device-retry',
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

      // First sync
      const res1 = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(batchPayload);

      expect(res1.status).toBe(200);
      expect(res1.body.batchSummary.syncedCount).toBe(1);
      expect(res1.body.batchSummary.duplicateCount).toBe(0);

      // Retried sync with exact same idempotencyKey
      const res2 = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(batchPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.batchSummary.syncedCount).toBe(0);
      expect(res2.body.batchSummary.duplicateCount).toBe(1);

      // Verify count remains strictly 1
      const count = await prisma.purchase.count({
        where: { idempotencyKey: testKey }
      });
      expect(count).toBe(1);
    });
  });

  // 4. Online Procurement Price Validation
  describe('4. Online Procurement Price Validation', () => {
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

  // 5. Collection Centre Access Boundaries
  describe('5. Collection Centre Authorization Boundaries', () => {
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

    it('blocks operator from syncing purchases for a collection centre other than assigned centre', async () => {
      const res = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          clientId: 'tablet-01',
          items: [
            {
              idempotencyKey: `unauthorized-centre-sync-${Date.now()}`,
              clientId: 'tablet-01',
              farmerId: testFarmer.id,
              centreId: anotherCentre.id, // Unauthorized centre!
              crop: 'Soybean',
              grade: 'Grade A',
              grossWeight: 400.0,
              tareWeight: 10.0,
              moisture: 11.0,
              clientDeviceTimestamp: new Date().toISOString(),
              localCreationTimestamp: new Date().toISOString()
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.batchSummary.failedCount).toBe(1);
      expect(res.body.results[0].error).toMatch(/Operators cannot sync procurement records for another collection centre/i);
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
