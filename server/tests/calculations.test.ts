import { describe, it, expect } from 'vitest';
import { calculateProcurement, validateProcurementInput, CalculationError } from '../src/lib/calculations';

describe('Agricultural Procurement Mathematical Engine', () => {
  describe('Prompt Required Sample 1: Sunil Jadhav (C07-24518)', () => {
    it('calculates exactly: Gross 1250.0 kg, Tare 18.0 kg, Moisture 11.5%, Net 1232.0 kg, Rate ₹4850, Amount ₹59752.00', () => {
      const result = calculateProcurement({
        grossWeight: 1250.0,
        tareWeight: 18.0,
        moisture: 11.5,
        ratePerQuintal: 4850.00
      });

      expect(result.actualWeight).toBe(1232.0);
      expect(result.moistureDeductionPercent).toBe(0.0);
      expect(result.netWeight).toBe(1232.0);
      expect(result.totalAmount).toBe(59752.00);
    });
  });

  describe('Prompt Required Sample 2: Kamal Shinde (C07-24519)', () => {
    it('calculates exactly: Gross 860.0 kg, Tare 12.0 kg, Moisture 14.0%, Net 831.0 kg, Rate ₹4850, Amount ₹40303.50', () => {
      const result = calculateProcurement({
        grossWeight: 860.0,
        tareWeight: 12.0,
        moisture: 14.0,
        ratePerQuintal: 4850.00
      });

      // Actual = 860 - 12 = 848.0
      expect(result.actualWeight).toBe(848.0);
      // Moisture deduction = max(0, 14 - 12) * 1% = 2.0%
      expect(result.moistureDeductionPercent).toBe(2.0);
      // Net weight = 848 * (1 - 0.02) = 831.04 -> 831.0
      expect(result.netWeight).toBe(831.0);
      // Amount = 831.0 * 4850 / 100 = 40303.50
      expect(result.totalAmount).toBe(40303.50);
    });
  });

  describe('Prompt Required Sample 3: Mohan Biradar (C12-08876)', () => {
    it('calculates exactly: Gross 640.0 kg, Tare 10.0 kg, Moisture 10.0%, Net 630.0 kg, Rate ₹7200, Amount ₹45360.00', () => {
      const result = calculateProcurement({
        grossWeight: 640.0,
        tareWeight: 10.0,
        moisture: 10.0,
        ratePerQuintal: 7200.00
      });

      expect(result.actualWeight).toBe(630.0);
      expect(result.moistureDeductionPercent).toBe(0.0);
      expect(result.netWeight).toBe(630.0);
      expect(result.totalAmount).toBe(45360.00);
    });
  });

  describe('Moisture Deduction Calculation Rules', () => {
    it('applies 0% deduction when moisture is <= 12%', () => {
      const r1 = calculateProcurement({ grossWeight: 1000, tareWeight: 0, moisture: 12.0, ratePerQuintal: 5000 });
      expect(r1.moistureDeductionPercent).toBe(0);
      expect(r1.netWeight).toBe(1000);

      const r2 = calculateProcurement({ grossWeight: 1000, tareWeight: 0, moisture: 9.5, ratePerQuintal: 5000 });
      expect(r2.moistureDeductionPercent).toBe(0);
      expect(r2.netWeight).toBe(1000);
    });

    it('applies accurate 1% per moisture point above 12%', () => {
      const r1 = calculateProcurement({ grossWeight: 1000, tareWeight: 0, moisture: 13.5, ratePerQuintal: 5000 });
      expect(r1.moistureDeductionPercent).toBe(1.5);
      expect(r1.netWeight).toBe(985.0);

      const r2 = calculateProcurement({ grossWeight: 1000, tareWeight: 0, moisture: 16.0, ratePerQuintal: 5000 });
      expect(r2.moistureDeductionPercent).toBe(4.0);
      expect(r2.netWeight).toBe(960.0);
    });
  });

  describe('Invalid Weight and Boundary Validations', () => {
    it('rejects gross weight less than or equal to tare weight', () => {
      expect(() => calculateProcurement({ grossWeight: 50, tareWeight: 50, moisture: 11, ratePerQuintal: 4000 }))
        .toThrow(CalculationError);

      expect(() => calculateProcurement({ grossWeight: 40, tareWeight: 50, moisture: 11, ratePerQuintal: 4000 }))
        .toThrow('Gross weight must be strictly greater than tare weight');
    });

    it('rejects negative tare weight', () => {
      expect(() => calculateProcurement({ grossWeight: 100, tareWeight: -5, moisture: 11, ratePerQuintal: 4000 }))
        .toThrow('Tare weight cannot be negative');
    });

    it('rejects negative or excessive moisture', () => {
      expect(() => calculateProcurement({ grossWeight: 100, tareWeight: 10, moisture: -1, ratePerQuintal: 4000 }))
        .toThrow('Moisture percentage must be between 0% and 40%');

      expect(() => calculateProcurement({ grossWeight: 100, tareWeight: 10, moisture: 55, ratePerQuintal: 4000 }))
        .toThrow('Moisture percentage must be between 0% and 40%');
    });

    it('rejects zero or negative rate per quintal', () => {
      expect(() => calculateProcurement({ grossWeight: 100, tareWeight: 10, moisture: 12, ratePerQuintal: 0 }))
        .toThrow('Published daily rate must be greater than zero');
    });
  });
});

