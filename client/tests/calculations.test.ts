import { describe, it, expect } from 'vitest';
import { calculateProcurement, validateProcurementInput } from '../src/lib/calculations';

describe('Client-Side Procurement Arithmetic Engine', () => {
  it('accurately reproduces Sunil Jadhav purchase math (C07-24518)', () => {
    const res = calculateProcurement({
      grossWeight: 1250.0,
      tareWeight: 18.0,
      moisture: 11.5,
      ratePerQuintal: 4850.00
    });

    expect(res.actualWeight).toBe(1232.0);
    expect(res.moistureDeductionPercent).toBe(0.0);
    expect(res.netWeight).toBe(1232.0);
    expect(res.totalAmount).toBe(59752.00);
  });

  it('accurately reproduces Kamal Shinde purchase math (C07-24519)', () => {
    const res = calculateProcurement({
      grossWeight: 860.0,
      tareWeight: 12.0,
      moisture: 14.0,
      ratePerQuintal: 4850.00
    });

    expect(res.actualWeight).toBe(848.0);
    expect(res.moistureDeductionPercent).toBe(2.0);
    expect(res.netWeight).toBe(831.0);
    expect(res.totalAmount).toBe(40303.50);
  });

  it('accurately reproduces Mohan Biradar purchase math (C12-08876)', () => {
    const res = calculateProcurement({
      grossWeight: 640.0,
      tareWeight: 10.0,
      moisture: 10.0,
      ratePerQuintal: 7200.00
    });

    expect(res.actualWeight).toBe(630.0);
    expect(res.moistureDeductionPercent).toBe(0.0);
    expect(res.netWeight).toBe(630.0);
    expect(res.totalAmount).toBe(45360.00);
  });

  it('rejects invalid inputs on client side before network dispatch', () => {
    expect(() => validateProcurementInput({ grossWeight: -10, tareWeight: 5, moisture: 10, ratePerQuintal: 4000 }))
      .toThrow('Gross weight must be greater than zero');

    expect(() => validateProcurementInput({ grossWeight: 50, tareWeight: 60, moisture: 10, ratePerQuintal: 4000 }))
      .toThrow('Gross weight must be strictly greater than tare weight');
  });
});

