import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { api } from '../services/api';
import { db } from '../services/db';
import { SyncManager } from '../services/syncManager';
import { Farmer, PriceBoardItem, Purchase } from '../types';
import { calculateProcurement, validateProcurementInput } from '../lib/calculations';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { AiVerificationModal } from './AiVerificationModal';
import { SlipPrintView } from '../components/shared/SlipPrintView';
import { SmsSimulatorCard } from '../components/shared/SmsSimulatorCard';
import { generateUuid as uuidv4 } from '../lib/uuid';
import {
  Scale,
  Search,
  CheckCircle2,
  AlertTriangle,
  Camera,
  RefreshCw,
  Sparkles,
  ArrowRight,
  User,
  Wheat,
  Plus
} from 'lucide-react';

export const CollectionEntryPage: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, triggerSync } = useSync();

  // Master Data State
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [prices, setPrices] = useState<PriceBoardItem[]>([]);
  const [priceLookup, setPriceLookup] = useState<Record<string, Record<string, number>>>({});

  // Form State
  const [farmerSearch, setFarmerSearch] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [showFarmerDropdown, setShowFarmerDropdown] = useState(false);

  const [crop, setCrop] = useState<'Soybean' | 'Tur'>('Soybean');
  const [grade, setGrade] = useState<'Grade A' | 'FAQ'>('Grade A');

  // Input strings (for responsive numeric keyboard on low-end Android)
  const [grossWeightStr, setGrossWeightStr] = useState('');
  const [tareWeightStr, setTareWeightStr] = useState('15.0');
  const [moistureStr, setMoistureStr] = useState('11.5');
  const [customRateStr, setCustomRateStr] = useState('');

  // AI Verification Modal & Results State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiData, setAiData] = useState<{
    scaleAiWeight: number | null;
    moistureAiValue: number | null;
    aiConfidence: number | null;
    aiVerificationStatus: 'MATCH' | 'DIFF_ACCEPTED' | 'MANUAL_OVERRIDE' | 'FAILED' | 'NOT_PERFORMED';
    aiDiffNotes: string;
    scalePhotoUrl?: string;
    moisturePhotoUrl?: string;
  }>({
    scaleAiWeight: null,
    moistureAiValue: null,
    aiConfidence: null,
    aiVerificationStatus: 'NOT_PERFORMED',
    aiDiffNotes: ''
  });

  // UI Execution State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedPurchase, setSavedPurchase] = useState<Purchase | null>(null);

  // Load Farmers & Daily Prices on mount (from network or offline Dexie cache)
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        // Try live API first
        const [farmersRes, pricesRes] = await Promise.all([
          api.getFarmers(),
          api.getActivePrices()
        ]);
        if (farmersRes.farmers) {
          setFarmers(farmersRes.farmers);
          await db.cachedFarmers.bulkPut(farmersRes.farmers).catch(() => {});
        }
        if (pricesRes.prices) {
          setPrices(pricesRes.prices);
          setPriceLookup(pricesRes.lookup || {});
          await db.cachedPrices.bulkPut(pricesRes.prices).catch(() => {});
        }
      } catch (err) {
        // Fallback to local Dexie IndexedDB cache when offline
        const cachedFarmersList = await db.cachedFarmers.toArray();
        const cachedPricesList = await db.cachedPrices.toArray();
        if (cachedFarmersList.length > 0) setFarmers(cachedFarmersList);
        if (cachedPricesList.length > 0) {
          setPrices(cachedPricesList);
          const lookup: Record<string, Record<string, number>> = {};
          cachedPricesList.forEach(p => {
            if (!lookup[p.crop]) lookup[p.crop] = {};
            lookup[p.crop][p.grade] = p.ratePerQuintal;
          });
          setPriceLookup(lookup);
        }
      }
    };
    loadMasterData();
  }, []);

  // Update active rate when crop or grade changes
  const activePublishedRate = priceLookup[crop]?.[grade] || (crop === 'Soybean' ? 4850 : 7200);
  const currentRate = Number(customRateStr) > 0 ? Number(customRateStr) : activePublishedRate;

  // Real-time decimal-safe calculation summary
  const numericGross = Number(grossWeightStr) || 0;
  const numericTare = Number(tareWeightStr) || 0;
  const numericMoisture = Number(moistureStr) || 0;

  let calcSummary = {
    actualWeight: 0,
    moistureDeductionPercent: 0,
    netWeight: 0,
    totalAmount: 0,
    isValid: false,
    validationError: ''
  };

  if (numericGross > 0) {
    try {
      const res = calculateProcurement({
        grossWeight: numericGross,
        tareWeight: numericTare,
        moisture: numericMoisture,
        ratePerQuintal: currentRate
      });
      calcSummary = {
        ...res,
        isValid: true,
        validationError: ''
      };
    } catch (e: any) {
      calcSummary.validationError = e.message;
    }
  }

  // Filter farmers for dropdown
  const filteredFarmers = farmers.filter(f =>
    f.fullName.toLowerCase().includes(farmerSearch.toLowerCase()) ||
    f.farmerId.toLowerCase().includes(farmerSearch.toLowerCase()) ||
    f.village.toLowerCase().includes(farmerSearch.toLowerCase())
  );

  const handleSelectFarmer = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setFarmerSearch(`${farmer.fullName} (${farmer.farmerId})`);
    setShowFarmerDropdown(false);
    // If farmer has designated crop, auto-select
    if (farmer.primaryCrop === 'Soybean' || farmer.primaryCrop === 'Tur') {
      setCrop(farmer.primaryCrop as 'Soybean' | 'Tur');
    }
  };

  const handleSavePurchase = async () => {
    setFormError(null);

    if (!selectedFarmer) {
      setFormError('Farmer selection is required. Search and select a registered farmer.');
      return;
    }
    if (numericGross <= 0) {
      setFormError('Gross weight must be entered.');
      return;
    }
    if (numericGross <= numericTare) {
      setFormError('Gross weight must be strictly greater than tare weight.');
      return;
    }
    if (currentRate <= 0) {
      setFormError('Published daily rate must be available.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = uuidv4();
    const localTimestamp = new Date().toISOString();
    const targetCentreId = user?.centreId || selectedFarmer.centreId || 'c07-id';
    const centreCode = user?.centre?.code || 'C07';

    const purchasePayload = {
      idempotencyKey,
      farmerId: selectedFarmer.id,
      centreId: targetCentreId,
      crop,
      grade,
      grossWeight: Math.round(numericGross * 10) / 10,
      tareWeight: Math.round(numericTare * 10) / 10,
      moisture: Math.round(numericMoisture * 10) / 10,
      ratePerQuintal: currentRate,
      scalePhotoUrl: aiData.scalePhotoUrl,
      moisturePhotoUrl: aiData.moisturePhotoUrl,
      scaleAiWeight: aiData.scaleAiWeight,
      moistureAiValue: aiData.moistureAiValue,
      aiConfidence: aiData.aiConfidence,
      aiVerificationStatus: aiData.aiVerificationStatus,
      aiDiffNotes: aiData.aiDiffNotes,
      clientDeviceTimestamp: localTimestamp,
      localCreationTimestamp: localTimestamp
    };

    try {
      if (isOnline) {
        // Online: Direct server API submission
        const res = await api.createPurchase(purchasePayload);
        if (res.purchase) {
          setSavedPurchase(res.purchase);
        }
      } else {
        // Offline: Enqueue to Dexie IndexedDB
        const offlineQueueItem = await SyncManager.enqueuePurchase({
          ...purchasePayload,
          actualWeight: calcSummary.actualWeight,
          moistureDeductionPercent: calcSummary.moistureDeductionPercent,
          netWeight: calcSummary.netWeight,
          totalAmount: calcSummary.totalAmount,
          farmerName: selectedFarmer.fullName,
          farmerCode: selectedFarmer.farmerId,
          centreCode
        });

        // Generate immediate local slip for farmer
        const localSlipNumber = `${centreCode}-OFFLINE-${Date.now().toString().slice(-4)}`;
        const simulatedOfflinePurchase: Purchase = {
          id: idempotencyKey,
          slipNumber: localSlipNumber,
          idempotencyKey,
          farmerId: selectedFarmer.id,
          farmer: selectedFarmer,
          centreId: targetCentreId,
          centre: user?.centre || undefined,
          crop,
          grade,
          grossWeight: Math.round(numericGross * 10) / 10,
          tareWeight: Math.round(numericTare * 10) / 10,
          actualWeight: calcSummary.actualWeight,
          moisture: Math.round(numericMoisture * 10) / 10,
          moistureDeductionPercent: calcSummary.moistureDeductionPercent,
          netWeight: calcSummary.netWeight,
          ratePerQuintal: currentRate,
          totalAmount: calcSummary.totalAmount,
          purchaseDate: localTimestamp,
          status: 'PENDING_APPROVAL',
          aiVerificationStatus: aiData.aiVerificationStatus,
          paymentEligibility: true,
          isFlagged: false,
          syncStatus: 'OFFLINE_QUEUED'
        };
        setSavedPurchase(simulatedOfflinePurchase);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to record purchase entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNext = () => {
    setSelectedFarmer(null);
    setFarmerSearch('');
    setGrossWeightStr('');
    setTareWeightStr('15.0');
    setMoistureStr('11.5');
    setSavedPurchase(null);
    setFormError(null);
    setAiData({
      scaleAiWeight: null,
      moistureAiValue: null,
      aiConfidence: null,
      aiVerificationStatus: 'NOT_PERFORMED',
      aiDiffNotes: ''
    });
  };

  // If purchase saved, display Slip & Marathi SMS View
  if (savedPurchase) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-16 animate-fade-in">
        {/* Offline notice if queued offline */}
        {savedPurchase.syncStatus === 'OFFLINE_QUEUED' && (
          <div className="bg-warning-bg border border-warning-border p-4 rounded-xl flex items-center justify-between text-warning">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Saved to Local Offline Queue</p>
                <p className="text-xs">
                  This transaction is safely stored in IndexedDB and will auto-sync when internet returns.
                </p>
              </div>
            </div>
            <Badge variant="warning">Offline Queued</Badge>
          </div>
        )}

        <SlipPrintView purchase={savedPurchase} onClose={handleResetForNext} />
        <SmsSimulatorCard purchase={savedPurchase} />

        <div className="flex gap-3">
          <Button
            size="touch"
            variant="forest"
            icon={<Plus className="w-5 h-5" />}
            onClick={handleResetForNext}
          >
            Create Next Purchase Entry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Page Heading with Centre Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Collection Entry</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Rapid mobile-first weighment & procurement intake (Latur FPC)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <Badge variant="warning" size="md">
              Offline Mode Active (Dexie IndexedDB)
            </Badge>
          )}
          <span className="text-xs font-semibold text-text-secondary bg-sage px-3 py-1 rounded-full text-forest">
            Centre: {user?.centre?.code || 'C07'} – {user?.centre?.name || 'Ausa'}
          </span>
        </div>
      </div>

      {formError && (
        <div className="bg-error-bg border border-error-border text-error p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Step 1: Farmer Selection */}
      <Card className="space-y-3" padding="md">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-primary" />
            1. Farmer Member Selection
          </label>
          {selectedFarmer && (
            <span className="text-[11px] text-success font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Farmer Verified ({selectedFarmer.bankVerificationStatus})
            </span>
          )}
        </div>

        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-3" />
            <input
              type="text"
              value={farmerSearch}
              onChange={(e) => {
                setFarmerSearch(e.target.value);
                setShowFarmerDropdown(true);
              }}
              onFocus={() => setShowFarmerDropdown(true)}
              placeholder="Search by farmer name, ID (e.g. MH-LTR-1001), or village..."
              className="w-full text-sm pl-9 pr-4 py-2.5 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Search Dropdown */}
          {showFarmerDropdown && filteredFarmers.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-elevated z-40 divide-y divide-border/60">
              {filteredFarmers.slice(0, 10).map((f) => (
                <div
                  key={f.id}
                  onClick={() => handleSelectFarmer(f)}
                  className="p-3 hover:bg-sage/40 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-forest">{f.fullName}</p>
                    <p className="text-[11px] text-text-secondary">
                      ID: <span className="font-mono font-medium">{f.farmerId}</span> • Village: {f.village} • Land: {f.landAreaAcres} ac
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-background border border-border px-2 py-0.5 rounded font-semibold text-forest">
                      {f.primaryCrop}
                    </span>
                    <p className="text-[10px] text-text-muted mt-0.5 font-mono">{f.bankAccountNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Farmer Mini Card */}
        {selectedFarmer && (
          <div className="bg-background rounded-button p-3 border border-border text-xs flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-forest">{selectedFarmer.fullName}</p>
              <p className="text-text-secondary text-[11px]">
                Village: {selectedFarmer.village} • Bank: {selectedFarmer.bankName} ({selectedFarmer.bankAccountNumber})
              </p>
            </div>
            <div className="text-right">
              <Badge variant="sage" size="sm">
                Registered Land: {selectedFarmer.landAreaAcres} Acres
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Step 2: Commodity & Quality Grid */}
      <Card className="space-y-4" padding="md">
        <label className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
          <Wheat className="w-4 h-4 text-primary" />
          2. Commodity & Grade Selection
        </label>

        <div className="grid grid-cols-2 gap-3">
          {/* Crop Switcher */}
          <div>
            <span className="text-xs text-text-secondary font-semibold block mb-1.5">Crop Selection</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCrop('Soybean')}
                className={`py-3 px-3 rounded-button text-xs font-bold border transition-colors ${
                  crop === 'Soybean'
                    ? 'bg-forest text-white border-forest shadow-sm'
                    : 'bg-white text-text-main border-border hover:bg-background'
                }`}
              >
                🌱 Soybean
              </button>
              <button
                type="button"
                onClick={() => setCrop('Tur')}
                className={`py-3 px-3 rounded-button text-xs font-bold border transition-colors ${
                  crop === 'Tur'
                    ? 'bg-forest text-white border-forest shadow-sm'
                    : 'bg-white text-text-main border-border hover:bg-background'
                }`}
              >
                🌾 Tur (Arhar)
              </button>
            </div>
          </div>

          {/* Grade Switcher */}
          <div>
            <span className="text-xs text-text-secondary font-semibold block mb-1.5">Quality Grade</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGrade('Grade A')}
                className={`py-3 px-3 rounded-button text-xs font-bold border transition-colors ${
                  grade === 'Grade A'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-text-main border-border hover:bg-background'
                }`}
              >
                Grade A (Clean)
              </button>
              <button
                type="button"
                onClick={() => setGrade('FAQ')}
                className={`py-3 px-3 rounded-button text-xs font-bold border transition-colors ${
                  grade === 'FAQ'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-text-main border-border hover:bg-background'
                }`}
              >
                FAQ Standard
              </button>
            </div>
          </div>
        </div>

        {/* Daily Published Price Indicator */}
        <div className="flex items-center justify-between p-3 bg-sage/50 border border-border rounded-button">
          <div>
            <span className="text-xs text-text-secondary font-medium">Centrally Published Daily Rate:</span>
            <p className="text-sm font-extrabold text-forest mt-0.5">
              ₹{activePublishedRate.toFixed(2)} / Quintal (100 kg)
            </p>
          </div>
          <Badge variant="forest" size="sm">
            Active MSP Grid
          </Badge>
        </div>
      </Card>

      {/* Step 3: Weighment & Moisture (Large Numeric Inputs for Outdoor Sunlight) */}
      <Card className="space-y-4" padding="md">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-primary" />
            3. Weighment & Moisture (Outdoor Field Inputs)
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Camera className="w-4 h-4 text-primary" />}
            onClick={() => setIsAiModalOpen(true)}
          >
            {aiData.aiVerificationStatus !== 'NOT_PERFORMED' ? 'AI Verified ✓' : 'AI Photo Verification'}
          </Button>
        </div>

        {/* AI verification status badge if completed */}
        {aiData.aiVerificationStatus !== 'NOT_PERFORMED' && (
          <div className="p-2.5 bg-sage border border-border rounded-button flex items-center justify-between text-xs text-forest">
            <span className="font-semibold flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-primary" />
              Vision Verification Status: {aiData.aiVerificationStatus}
            </span>
            <span className="text-[11px] text-text-secondary">{aiData.aiDiffNotes}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Gross Weight */}
          <div>
            <Input
              label="Gross Weight"
              isLargeNumeric
              unit="kg"
              type="number"
              step="0.1"
              min="0"
              placeholder="0.0"
              value={grossWeightStr}
              onChange={(e) => setGrossWeightStr(e.target.value)}
              hint="Total scale reading"
            />
          </div>

          {/* Tare Weight */}
          <div>
            <Input
              label="Tare Weight"
              isLargeNumeric
              unit="kg"
              type="number"
              step="0.1"
              min="0"
              placeholder="15.0"
              value={tareWeightStr}
              onChange={(e) => setTareWeightStr(e.target.value)}
              hint="Empty bags / vehicle"
            />
          </div>

          {/* Moisture % */}
          <div>
            <Input
              label="Moisture Content"
              isLargeNumeric
              unit="%"
              type="number"
              step="0.1"
              min="0"
              max="40"
              placeholder="11.5"
              value={moistureStr}
              onChange={(e) => setMoistureStr(e.target.value)}
              hint="Base benchmark: 12.0%"
            />
          </div>
        </div>
      </Card>

      {/* Step 4: Live Purchase Calculation Summary */}
      {calcSummary.isValid && (
        <Card className="bg-forest text-white border-transparent space-y-4 shadow-elevated" padding="md">
          <div className="flex items-center justify-between border-b border-white/15 pb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-sage">Live Procurement Summary</span>
            <span className="text-xs text-white/80 font-mono">1 quintal = 100 kg</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white/10 p-2.5 rounded-button">
              <span className="text-[10px] text-sage font-medium uppercase">Actual Weight</span>
              <p className="text-lg font-extrabold mt-0.5">{calcSummary.actualWeight.toFixed(1)} kg</p>
              <span className="text-[9px] text-white/60">Gross - Tare</span>
            </div>

            <div className="bg-white/10 p-2.5 rounded-button">
              <span className="text-[10px] text-sage font-medium uppercase">Moisture Deduction</span>
              <p className="text-lg font-extrabold mt-0.5">
                {calcSummary.moistureDeductionPercent > 0 ? `-${calcSummary.moistureDeductionPercent.toFixed(1)}%` : '0.0%'}
              </p>
              <span className="text-[9px] text-white/60">max(0, Moist - 12) * 1%</span>
            </div>

            <div className="bg-white/10 p-2.5 rounded-button">
              <span className="text-[10px] text-sage font-medium uppercase">Net Billable Weight</span>
              <p className="text-lg font-extrabold text-sage mt-0.5">{calcSummary.netWeight.toFixed(1)} kg</p>
              <span className="text-[9px] text-white/60">Actual * (1 - ded/100)</span>
            </div>

            <div className="bg-white/10 p-2.5 rounded-button">
              <span className="text-[10px] text-sage font-medium uppercase">Total Payable Amount</span>
              <p className="text-xl font-extrabold text-white mt-0.5">
                ₹{calcSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[9px] text-white/60">Net * Rate / 100</span>
            </div>
          </div>
        </Card>
      )}

      {/* Save Action Button */}
      <div className="pt-2">
        <Button
          size="touch"
          variant="forest"
          isLoading={isSubmitting}
          disabled={!calcSummary.isValid || !selectedFarmer}
          onClick={handleSavePurchase}
          icon={<CheckCircle2 className="w-5 h-5" />}
        >
          {isOnline ? 'Confirm & Generate Purchase Slip' : 'Save to Offline Queue (No Internet)'}
        </Button>
      </div>

      {/* AI Photo Verification Modal */}
      <AiVerificationModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        manualGrossWeight={numericGross}
        manualMoisture={numericMoisture}
        onVerificationComplete={(result) => setAiData(result)}
      />
    </div>
  );
};
