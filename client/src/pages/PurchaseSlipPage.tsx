import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Purchase } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SlipPrintView } from '../components/shared/SlipPrintView';
import { SmsSimulatorCard } from '../components/shared/SmsSimulatorCard';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Printer,
  ShieldCheck,
  Building,
  RefreshCw
} from 'lucide-react';

interface PurchaseSlipPageProps {
  onNavigateTab?: (tab: string) => void;
  selectedCentreId?: string;
}

export const PurchaseSlipPage: React.FC<PurchaseSlipPageProps> = ({ selectedCentreId }) => {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Active slip view modal
  const [activeSlip, setActiveSlip] = useState<Purchase | null>(null);

  // Manager Review Modal
  const [reviewingPurchase, setReviewingPurchase] = useState<Purchase | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedCentreId && selectedCentreId !== 'ALL') params.centreId = selectedCentreId;
      if (cropFilter !== 'ALL') params.crop = cropFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.getPurchases(params);
      if (res.purchases) setPurchases(res.purchases);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [selectedCentreId, cropFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPurchases();
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingPurchase) return;

    setReviewSubmitting(true);
    try {
      await api.reviewPurchase(reviewingPurchase.id, {
        decision: reviewDecision,
        notes: reviewNotes
      });
      setReviewingPurchase(null);
      setReviewNotes('');
      fetchPurchases();
    } catch (err) {
      console.error(err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Purchases & Procurement Slips</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Digital receipts, weighment slips & simulated Marathi SMS notifications
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchPurchases}
        >
          Refresh Slips
        </Button>
      </div>

      {/* Filter Bar */}
      <Card padding="sm" className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Slip No (e.g. C07-24518) or Farmer name..."
              className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="text-xs font-medium bg-background border border-border rounded-button px-2.5 py-2 text-forest focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Crops</option>
              <option value="Soybean">Soybean</option>
              <option value="Tur">Tur</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-background border border-border rounded-button px-2.5 py-2 text-forest focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="FLAGGED">Flagged for Review</option>
              <option value="PAID">Paid</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
            </select>

            <Button type="submit" size="sm" variant="outline">
              Apply
            </Button>
          </div>
        </form>
      </Card>

      {/* Slips Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                <th className="py-3 px-4">Slip No</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Farmer</th>
                <th className="py-3 px-4">Centre</th>
                <th className="py-3 px-4">Crop</th>
                <th className="py-3 px-4 text-right">Gross (kg)</th>
                <th className="py-3 px-4 text-right">Net (kg)</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Payable Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-text-muted">
                    Loading procurement slips...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-text-muted">
                    No procurement slips found matching filters.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-background/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-forest">{p.slipNumber}</td>
                    <td className="py-3 px-4 text-text-muted text-[11px]">
                      {new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-forest">{p.farmer?.fullName}</p>
                      <p className="text-[10px] text-text-muted font-mono">{p.farmer?.farmerId}</p>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{p.centre?.code}</td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-forest">{p.crop}</span>
                      <span className="text-[10px] text-text-muted ml-1">({p.grade})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-text-secondary">{p.grossWeight.toFixed(1)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-forest">{p.netWeight.toFixed(1)}</td>
                    <td className="py-3 px-4 text-right font-mono text-text-secondary">₹{p.ratePerQuintal.toFixed(0)}</td>
                    <td className="py-3 px-4 text-right font-bold text-forest">
                      ₹{p.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.status === 'PAID' ? (
                        <Badge variant="success" size="sm">Paid</Badge>
                      ) : p.status === 'APPROVED' ? (
                        <Badge variant="forest" size="sm">Approved</Badge>
                      ) : p.isFlagged || p.status === 'FLAGGED' ? (
                        <Badge variant="warning" size="sm">Flagged</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Pending</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => setActiveSlip(p)}
                      >
                        Slip
                      </Button>
                      {isManager && (p.isFlagged || p.status === 'FLAGGED') && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<ShieldCheck className="w-3.5 h-3.5 text-warning" />}
                          onClick={() => {
                            setReviewingPurchase(p);
                            setReviewDecision('APPROVE');
                            setReviewNotes('Quality and calibration inspected. Discrepancy resolved.');
                          }}
                        >
                          Review
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slip Modal View */}
      {activeSlip && (
        <Modal
          isOpen={!!activeSlip}
          onClose={() => setActiveSlip(null)}
          title={`Procurement Slip: ${activeSlip.slipNumber}`}
          subtitle="Official Farmer Receipt & Simulated SMS Delivery"
          maxWidth="lg"
        >
          <div className="space-y-6">
            <SlipPrintView purchase={activeSlip} onClose={() => setActiveSlip(null)} />
            <SmsSimulatorCard purchase={activeSlip} />
          </div>
        </Modal>
      )}

      {/* Office Manager Flagged Purchase Review Modal */}
      {reviewingPurchase && (
        <Modal
          isOpen={!!reviewingPurchase}
          onClose={() => setReviewingPurchase(null)}
          title={`Manager Review: ${reviewingPurchase.slipNumber}`}
          subtitle="Review anomaly flag and decide payment eligibility"
          maxWidth="md"
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="p-3 bg-warning-bg border border-warning-border rounded-xl text-xs space-y-1">
              <span className="font-bold text-warning uppercase block">Flag Reason</span>
              <p className="text-text-main font-medium">{reviewingPurchase.flagReason || 'Automated anomaly detected'}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Manager Decision
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewDecision('APPROVE')}
                  className={`py-2 px-3 rounded-button text-xs font-bold border transition-colors ${
                    reviewDecision === 'APPROVE'
                      ? 'bg-success text-white border-success shadow-sm'
                      : 'bg-white text-text-main border-border'
                  }`}
                >
                  ✓ Approve Purchase
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision('REJECT')}
                  className={`py-2 px-3 rounded-button text-xs font-bold border transition-colors ${
                    reviewDecision === 'REJECT'
                      ? 'bg-error text-white border-error shadow-sm'
                      : 'bg-white text-text-main border-border'
                  }`}
                >
                  ✕ Reject / Cancel
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Audit Review Notes
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Supervisor explanation for audit trail (e.g. Verified farmer land yield via village records)"
                rows={3}
                className="w-full text-xs p-2.5 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setReviewingPurchase(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="forest" size="sm" isLoading={reviewSubmitting}>
                Save Decision & Update Audit Chain
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

