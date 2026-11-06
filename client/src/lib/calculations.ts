/**
 * KrishiSetu Procurement Mathematical Engine (Frontend Client)
 * Matches server calculation formula exactly.
 */

export interface ProcurementCalculationInput {
  grossWeight: number; // kg
  tareWeight: number;  // kg
  moisture: number;    // %
  ratePerQuintal: number; // ₹ per quintal (100 kg)
}

export interface ProcurementCalculationResult {
  actualWeight: number;          // kg (gross - tare), rounded to 1 decimal
  moistureDeductionPercent: number; // % (max(0, moisture - 12) * 1%), rounded to 2 decimals
  netWeight: number;             // kg (actualWeight * (1 - deduction/100)), rounded to 1 decimal
  totalAmount: number;           // ₹ (netWeight * rate / 100), rounded to 2 decimals
}

export function validateProcurementInput(input: ProcurementCalculationInput): void {
  if (typeof input.grossWeight !== 'number' || isNaN(input.grossWeight)) {
    throw new Error('Gross weight must be a valid number');
  }
  if (typeof input.tareWeight !== 'number' || isNaN(input.tareWeight)) {
    throw new Error('Tare weight must be a valid number');
  }
  if (typeof input.moisture !== 'number' || isNaN(input.moisture)) {
    throw new Error('Moisture percentage must be a valid number');
  }
  if (typeof input.ratePerQuintal !== 'number' || isNaN(input.ratePerQuintal)) {
    throw new Error('Rate per quintal must be a valid number');
  }

  if (input.grossWeight <= 0) {
    throw new Error('Gross weight must be greater than zero');
  }
  if (input.tareWeight < 0) {
    throw new Error('Tare weight cannot be negative');
  }
  if (input.grossWeight <= input.tareWeight) {
    throw new Error('Gross weight must be strictly greater than tare weight');
  }
  if (input.moisture < 0 || input.moisture > 40) {
    throw new Error('Moisture percentage must be between 0% and 40%');
  }
  if (input.ratePerQuintal <= 0) {
    throw new Error('Published daily rate must be greater than zero');
  }
}

export function calculateProcurement(input: ProcurementCalculationInput): ProcurementCalculationResult {
  validateProcurementInput(input);

  // 1. Actual weight = Gross weight - Tare weight
  const actualWeightRaw = input.grossWeight - input.tareWeight;
  const actualWeight = Math.round(actualWeightRaw * 10) / 10;

  // 2. Moisture deduction percentage = max(0, Moisture - 12) * 1%
  const moistureExcess = Math.max(0, input.moisture - 12);
  const moistureDeductionPercent = Math.round(moistureExcess * 1.0 * 100) / 100;

  // 3. Net weight = Actual weight * (1 - deduction percentage / 100)
  const netWeightRaw = actualWeight * (1 - moistureDeductionPercent / 100);
  const netWeight = Math.round(netWeightRaw * 10) / 10;

  // 4. Amount = Net weight * Rate per quintal / 100
  const amountRaw = (netWeight * input.ratePerQuintal) / 100;
  const totalAmount = Math.round(amountRaw * 100) / 100;

  return {
    actualWeight,
    moistureDeductionPercent,
    netWeight,
    totalAmount
  };
}

