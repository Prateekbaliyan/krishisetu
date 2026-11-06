import { describe, it, expect } from 'vitest';
import { generateBankBulkPaymentCsv, escapeCsvField } from '../src/lib/bankCsvAdapter';

describe('Bank Bulk Payment CSV Generator', () => {
  it('correctly escapes CSV fields containing commas or quotes', () => {
    expect(escapeCsvField('Patil, Sunil')).toBe('"Patil, Sunil"');
    expect(escapeCsvField('Soybean "Grade A"')).toBe('"Soybean ""Grade A"""');
    expect(escapeCsvField(45000.5)).toBe('45000.5');
    expect(escapeCsvField(null)).toBe('');
  });

  it('generates well-formed mock bank CSV with required header documentation', () => {
    const csv = generateBankBulkPaymentCsv({
      batchNumber: 'BATCH-20261105-001',
      companyName: 'Latur Farmer Producer Company Ltd',
      records: [
        {
          batchNumber: 'BATCH-20261105-001',
          paymentId: 'PMT-001',
          farmerId: 'MH-LTR-1001',
          farmerName: 'Sunil Jadhav',
          bankAccountName: 'Sunil Baban Jadhav',
          bankAccountNumber: '60124458901',
          ifscCode: 'MAHB0000214',
          bankName: 'Bank of Maharashtra',
          amount: 59752.00,
          remarks: 'Slips: C07-24518',
          date: '2026-11-05'
        }
      ]
    });

    // Verify documentation header
    expect(csv).toContain('# FORMAT: GENERIC MOCK NEFT/NACH BULK PAYMENT FILE (DEMO SPECIFICATION)');
    expect(csv).toContain('# BATCH: BATCH-20261105-001');
    expect(csv).toContain('RecordType,BatchNumber,PaymentId,FarmerId,BeneficiaryName');
    expect(csv).toContain('Sunil Baban Jadhav');
    expect(csv).toContain('MAHB0000214');
    expect(csv).toContain('59752.00');
  });
});

