import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PaymentRun } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  CreditCard,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  CheckCheck,
  Info
} from 'lucide-react';

export const PaymentRunPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'eligible' | 'batches'>('eligible');

  // Eligible purchases state
  const [eligiblePurchases, setEligiblePurchases] = useState<any[]>([]);
  const [groupedFarmers, setGroupedFarmers] = useState<any[]>([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(true);

  // Batches state
  const [runs, setRuns] = useState<PaymentRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBatch, setGeneratedBatch] = useState<PaymentRun | null>(null);

  const fetchEligible = async () => {
    setLoadingEligible(true);
    try {
      const res = await api.getEligiblePurchases();
      if (res.eligiblePurchases) {
        setEligiblePurchases(res.eligiblePurchases);
        // Default select all eligible
        setSelectedPurchaseIds(res.eligiblePurchases.map((p: any) => p.id));
      }
      if (res.groupedByFarmer) {
        setGroupedFarmers(res.groupedByFarmer);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEligible(false);
    }
  };

  const fetchRuns = async () => {
    setLoadingRuns(true);
    try {
      const res = await api.getPaymentRuns();
      if (res.runs) setRuns(res.runs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    fetchEligible();
    fetchRuns();
  }, []);

  const handleToggleSelectAll = () => {
    if (selectedPurchaseIds.length === eligiblePurchases.length) {
      setSelectedPurchaseIds([]);
    } else {
      setSelectedPurchaseIds(eligiblePurchases.map(p => p.id));
    }
  };

  const handleTogglePurchase = (id: string) => {
    setSelectedPurchaseIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleCreatePaymentRun = async () => {
    if (selectedPurchaseIds.length === 0) return;
    setIsGenerating(true);
    try {
      const res = await api.createPaymentRun(selectedPurchaseIds);
      if (res.paymentRun) {
        setGeneratedBatch(res.paymentRun);
        fetchEligible();
        fetchRuns();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate payment batch');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCsv = (runId: string, fileName?: string) => {
    api.downloadPaymentCsv(runId, fileName);
  };

  const handleSimulateBank = async (runId: string, targetStatus: 'PAID' | 'FAILED') => {
    try {
      await api.simulateBankStatus(runId, targetStatus);
      fetchRuns();
    } catch (err) {
      console.error(err);
    }
  };

  // Selected totals
  const selectedPurchasesList = eligiblePurchases.filter(p => selectedPurchaseIds.includes(p.id));
  const selectedTotalAmount = selectedPurchasesList.reduce((acc, p) => acc + p.totalAmount, 0);
  const selectedDistinctFarmersCount = new Set(selectedPurchasesList.map(p => p.farmerId)).size;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Direct Bank Payment Run</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Consolidated farmer DBT clearing batch generator & bulk CSV export
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              fetchEligible();
              fetchRuns();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border text-xs font-semibold gap-2">
        <button
          onClick={() => setActiveTab('eligible')}
          className={`py-2 px-4 border-b-2 transition-colors ${
            activeTab === 'eligible'
              ? 'border-forest text-forest font-bold'
              : 'border-transparent text-text-muted hover:text-forest'
          }`}
        >
          Approved Purchases Ready For Settlement ({eligiblePurchases.length})
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`py-2 px-4 border-b-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-forest text-forest font-bold'
              : 'border-transparent text-text-muted hover:text-forest'
          }`}
        >
          Payment Batches & Bank History ({runs.length})
        </button>
      </div>

      {/* Format Notice */}
      <div className="p-3 bg-background border border-border rounded-xl text-xs text-text-secondary flex items-start gap-2">
        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <span>
          <strong>Banking Format Specification:</strong> Generates a generic mock NEFT/NACH corporate bulk clearing CSV format. Clearly labeled as a generic mock adapter per design specifications.
        </span>
      </div>

      {/* Tab 1: Eligible Purchases Selection & Batch Creation */}
      {activeTab === 'eligible' && (
        <div className="space-y-6">
          {/* Summary Action Bar */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-text-muted uppercase font-bold tracking-wider">Eligible Selection Summary</p>
                <p className="text-2xl font-extrabold text-forest mt-0.5">
                  ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {selectedPurchaseIds.length} purchase lots • {selectedDistinctFarmersCount} unique farmer accounts
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleSelectAll}
                >
                  {selectedPurchaseIds.length === eligiblePurchases.length ? 'Deselect All' : 'Select All Eligible'}
                </Button>
                <Button
                  size="md"
                  variant="forest"
                  disabled={selectedPurchaseIds.length === 0}
                  isLoading={isGenerating}
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                  onClick={handleCreatePaymentRun}
                >
                  Generate Bank Payment Run ({selectedPurchaseIds.length})
                </Button>
              </div>
            </div>
          </Card>

          {/* Eligible Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={eligiblePurchases.length > 0 && selectedPurchaseIds.length === eligiblePurchases.length}
                        onChange={handleToggleSelectAll}
                        className="rounded text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="py-3 px-4">Purchase Slip</th>
                    <th className="py-3 px-4">Farmer Beneficiary</th>
                    <th className="py-3 px-4">Bank Coordinates</th>
                    <th className="py-3 px-4 text-center">Bank Status</th>
                    <th className="py-3 px-4 text-right">Net Weight</th>
                    <th className="py-3 px-4 text-right">Payable Amount</th>
                    <th className="py-3 px-4 text-center">Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingEligible ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-text-muted">
                        Checking eligible approved lots...
                      </td>
                    </tr>
                  ) : eligiblePurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-text-muted">
                        No pending approved purchases waiting for payment run. All lots up to date.
                      </td>
                    </tr>
                  ) : (
                    eligiblePurchases.map((p) => {
                      const isSelected = selectedPurchaseIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleTogglePurchase(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-sage/40 hover:bg-sage/60' : 'hover:bg-background'
                          }`}
                        >
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTogglePurchase(p.id)}
                              className="rounded text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-forest">
                            {p.slipNumber}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-forest">{p.farmer?.fullName}</p>
                            <p className="text-[10px] text-text-muted font-mono">{p.farmer?.farmerId}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-mono text-forest">{p.farmer?.bankAccountNumber}</p>
                            <p className="text-[10px] text-text-muted">{p.farmer?.ifscCode}</p>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="success" size="sm">
                              {p.farmer?.bankVerificationStatus}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-forest">
                            {p.netWeight.toFixed(1)} kg
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-forest">
                            ₹{p.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="forest" size="sm">Eligible</Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Generated Batches & Payment Runs History */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {runs.length === 0 ? (
            <Card padding="lg" className="text-center text-xs text-text-muted">
              No payment batches generated yet. Select approved purchases from the first tab to generate your first batch.
            </Card>
          ) : (
            runs.map((r) => (
              <Card key={r.id} padding="md" className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-base text-forest">{r.batchNumber}</span>
                      <Badge variant={r.status === 'PAID' ? 'success' : r.status === 'FAILED' ? 'error' : 'warning'}>
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      Created by {r.createdBy} • {new Date(r.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={() => handleDownloadCsv(r.id, r.csvFileName)}
                    >
                      Download CSV ({r.csvFileName || 'BulkPayment.csv'})
                    </Button>

                    {/* Bank Status Simulation Button (Office Manager) */}
                    {r.status !== 'PAID' && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                        onClick={() => handleSimulateBank(r.id, 'PAID')}
                      >
                        Simulate Bank Clearing (PAID)
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs bg-background p-3 rounded-xl border border-border">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold">Total Payout</span>
                    <p className="text-lg font-extrabold text-forest mt-0.5">
                      ₹{r.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold">Beneficiary Farmers</span>
                    <p className="text-lg font-extrabold text-forest mt-0.5">{r.totalFarmers}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold">Procurement Lots</span>
                    <p className="text-lg font-extrabold text-forest mt-0.5">{r.totalPurchases}</p>
                  </div>
                </div>

                {/* Individual Payout Lines Preview */}
                {r.payments && r.payments.length > 0 && (
                  <div className="pt-2 text-xs divide-y divide-border/60">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                      Beneficiary Accounts in Batch
                    </p>
                    {r.payments.map((p) => (
                      <div key={p.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-forest">{p.farmer?.fullName || p.bankAccountName}</span>
                          <span className="font-mono text-text-muted text-[11px] ml-2">{p.bankAccountNumber}</span>
                          <span className="text-text-muted text-[10px] ml-1">({p.ifscCode})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-forest">₹{p.amount.toLocaleString()}</span>
                          {p.bankReferenceNumber && (
                            <span className="block text-[10px] text-text-muted font-mono">{p.bankReferenceNumber}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

