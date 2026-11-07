import { PrismaClient } from '@prisma/client';

export interface AnomalyResult {
  isFlagged: boolean;
  flags: Array<{
    flagType: 'WEIGHT_EXCEEDS_LAND_BENCHMARK' | 'DUPLICATE_HOUR_PURCHASE' | 'UNIFORM_MOISTURE_STREAK';
    severity: 'HIGH' | 'MEDIUM';
    description: string;
    details: Record<string, any>;
  }>;
}

export interface AnomalyConfig {
  maxWeightMultiplierBenchmark: number; // e.g. 1.5
  minPurchaseIntervalMinutes: number;   // e.g. 60
  uniformMoistureStreakThreshold: number; // e.g. 5
  yieldBenchmarksKgPerAcre: Record<string, number>;
}

export const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
  maxWeightMultiplierBenchmark: Number(process.env.MAX_WEIGHT_MULTIPLIER_BENCHMARK) || 1.5,
  minPurchaseIntervalMinutes: Number(process.env.MIN_PURCHASE_INTERVAL_MINUTES) || 60,
  uniformMoistureStreakThreshold: Number(process.env.UNIFORM_MOISTURE_STREAK_THRESHOLD) || 5,
  yieldBenchmarksKgPerAcre: {
    Soybean: 1200, // 12 quintals/acre standard maximum seasonal single-harvest delivery
    Tur: 750,      // 7.5 quintals/acre
    Default: 1000
  }
};

/**
 * Evaluates rule-based anomaly detection algorithms on incoming purchase.
 * Note: Clearly distinct from AI vision recognition.
 */
export async function detectAnomalies(
  prisma: PrismaClient,
  purchaseData: {
    farmerId: string;
    centreId: string;
    crop: string;
    grossWeight: number;
    netWeight: number;
    moisture: number;
    purchaseDate?: Date;
  },
  config: AnomalyConfig = DEFAULT_ANOMALY_CONFIG
): Promise<AnomalyResult> {
  const flags: AnomalyResult['flags'] = [];
  const currentDate = purchaseData.purchaseDate || new Date();

  // 1. Check Farmer Land Benchmark
  const farmer = await prisma.farmer.findUnique({
    where: { id: purchaseData.farmerId }
  });

  if (farmer && farmer.landAreaAcres > 0) {
    const benchmarkYield = config.yieldBenchmarksKgPerAcre[purchaseData.crop] || config.yieldBenchmarksKgPerAcre.Default;
    const maxAllowedSingleLot = farmer.landAreaAcres * benchmarkYield * config.maxWeightMultiplierBenchmark;

    if (purchaseData.netWeight > maxAllowedSingleLot) {
      flags.push({
        flagType: 'WEIGHT_EXCEEDS_LAND_BENCHMARK',
        severity: 'HIGH',
        description: `Net weight of ${purchaseData.netWeight} kg exceeds the expected single delivery threshold (${maxAllowedSingleLot.toFixed(1)} kg) for ${farmer.landAreaAcres} acres of ${purchaseData.crop}.`,
        details: {
          farmerId: farmer.farmerId,
          farmerName: farmer.fullName,
          landAreaAcres: farmer.landAreaAcres,
          crop: purchaseData.crop,
          netWeight: purchaseData.netWeight,
          benchmarkYieldKgPerAcre: benchmarkYield,
          multiplier: config.maxWeightMultiplierBenchmark,
          calculatedMaxThreshold: maxAllowedSingleLot
        }
      });
    }
  }

  // 2. Check Same Farmer multiple purchases within 60 minutes
  const intervalWindow = new Date(currentDate.getTime() - config.minPurchaseIntervalMinutes * 60 * 1000);
  const recentPurchases = await prisma.purchase.findMany({
    where: {
      farmerId: purchaseData.farmerId,
      purchaseDate: {
        gte: intervalWindow,
        lte: new Date(currentDate.getTime() + 60 * 1000) // slight buffer
      }
    },
    take: 3,
    orderBy: { purchaseDate: 'desc' }
  });

  if (recentPurchases.length > 0) {
    flags.push({
      flagType: 'DUPLICATE_HOUR_PURCHASE',
      severity: 'HIGH',
      description: `Farmer already completed purchase ${recentPurchases[0].slipNumber} within the last ${config.minPurchaseIntervalMinutes} minutes. Potential duplicate entry or unbatched delivery.`,
      details: {
        recentSlip: recentPurchases[0].slipNumber,
        recentPurchaseDate: recentPurchases[0].purchaseDate,
        windowMinutes: config.minPurchaseIntervalMinutes
      }
    });
  }

  // 3. Check Suspiciously Uniform Moisture Streak at Centre
  const centreRecentPurchases = await prisma.purchase.findMany({
    where: {
      centreId: purchaseData.centreId
    },
    orderBy: { purchaseDate: 'desc' },
    take: config.uniformMoistureStreakThreshold - 1,
    select: { moisture: true, slipNumber: true }
  });

  if (centreRecentPurchases.length >= config.uniformMoistureStreakThreshold - 1) {
    const allMatch = centreRecentPurchases.every((p: any) => Math.abs(Number(p.moisture || 0) - purchaseData.moisture) < 0.05);
    if (allMatch) {
      flags.push({
        flagType: 'UNIFORM_MOISTURE_STREAK',
        severity: 'MEDIUM',
        description: `Last ${config.uniformMoistureStreakThreshold} consecutive purchases at this centre share identical moisture reading of ${purchaseData.moisture.toFixed(1)}%. Inspect moisture meter calibration.`,
        details: {
          moistureValue: purchaseData.moisture,
          consecutiveCount: config.uniformMoistureStreakThreshold,
          precedingSlips: centreRecentPurchases.map((p: any) => p.slipNumber)
        }
      });
    }
  }

  return {
    isFlagged: flags.length > 0,
    flags
  };
}

