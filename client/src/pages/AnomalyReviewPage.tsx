import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Purchase } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Scale,
  Clock,
  Droplet,
  Info
} from 'lucide-react';

export const AnomalyReviewPage: React.FC = () => {
  const { user } = useAuth();
  const [flaggedPurchases, setFlaggedPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [activePurchase, setActivePurchase] = useState<Purchase | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchFlagged = async () => {
    setLoading(true);
    try {
      const res = await api.getPurchases({ isFlagged: 'true' });
      if (res.purchases) setFlaggedPurchases(res.purchases);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlagged();
  }, []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePurchase) return;

    setSubmitting(true);
    try {
      await api.reviewPurchase(activePurchase.id, {
        decision,
        notes: reviewNotes
      });
      setActivePurchase(null);
      setReviewNotes('');
      fetchFlagged();
    } catch (err: any) {
      alert(err.message || 'Failed to review purchase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Anomaly & Fraud Review Queue</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Rule-based algorithmic surveillance (Yield Benchmarks, 1-Hour Duplicates & Moisture Streaks)
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchFlagged}
        >
          Refresh Review Queue
        </Button>
      </div>

      {/* Distinction Banner */}
      <Card padding="md" className="bg-sage/40 border-forest/20 space-y-1.5">
        <div className="flex items-center gap-2 text-forest font-bold text-xs uppercase tracking-wider">
          <Info className="w-4 h-4 text-primary" /> Architectural Principle: Rule-Based Anomaly vs Vision AI
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          <strong>Non-Cancellation Policy:</strong> Anomaly detection algorithms never automatically cancel farmer purchases. Flagged entries remain saved, display reasons transparently, and enter this supervisor review queue. Flagged lots cannot enter payment runs until explicitly approved by an authorized manager.
        </p>
      </Card>

      {/* Flagged Lots List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading review queue...</div>
        ) : flaggedPurchases.length === 0 ? (
          <Card padding="lg" className="text-center text-xs text-text-muted space-y-2">
            <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
            <p className="font-bold text-forest">Review Queue Is Clean</p>
            <p>No procurement purchases are currently flagged for anomalous weight or duplicate patterns.</p>
          </Card>
        ) : (
          flaggedPurchases.map((p) => {
            const flags = p.anomalyFlags || [];
            return (
              <Card key={p.id} padding="md" className="border-warning-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-forest">{p.slipNumber}</span>
                    <Badge variant="warning" size="sm">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Flagged Lot
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {new Date(p.purchaseDate).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-secondary">
                      Amount: <strong className="text-forest font-bold">₹{p.totalAmount.toLocaleString()}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="forest"
                      icon={<ShieldAlert className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setActivePurchase(p);
                        setDecision('APPROVE');
                        setReviewNotes('Field supervisor confirmed legitimate bulk harvest delivery.');
                      }}
                    >
                      Audit & Resolve
                    </Button>
                  </div>
                </div>

                {/* Farmer & Lot Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block">Farmer</span>
                    <span className="font-semibold text-forest">{p.farmer?.fullName}</span>
                    <span className="text-[10px] text-text-muted block font-mono">{p.farmer?.farmerId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block">Centre</span>
                    <span className="font-medium text-forest">{p.centre?.code} – {p.centre?.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block">Commodity & Weight</span>
                    <span className="font-bold text-forest">{p.crop} ({p.grade})</span>
                    <span className="text-[10px] text-text-secondary block font-mono">{p.netWeight.toFixed(1)} kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block">Moisture Content</span>
                    <span className="font-semibold text-forest">{p.moisture.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Anomaly Details Breakdown */}
                <div className="p-3 bg-warning-bg/40 border border-warning-border rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-warning uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Triggered Anomaly Surveillance Rules:
                  </p>
                  {flags.length > 0 ? (
                    flags.map((f) => (
                      <div key={f.id} className="text-xs text-text-main flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 flex-shrink-0" />
                        <div>
                          <strong className="text-forest font-semibold">
                            {f.flagType === 'WEIGHT_EXCEEDS_LAND_BENCHMARK'
                              ? 'Yield Benchmark Exceeded'
                              : f.flagType === 'DUPLICATE_HOUR_PURCHASE'
                                ? 'Same-Farmer Rapid Duplicate Intake'
                                : 'Suspicious Moisture Streak'}
                          </strong>: {f.description}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-secondary">{p.flagReason || 'Flagged during quality surveillance review'}</p>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Review & Resolution Modal */}
      {activePurchase && (
        <Modal
          isOpen={!!activePurchase}
          onClose={() => setActivePurchase(null)}
          title={`Supervisor Resolution: ${activePurchase.slipNumber}`}
          subtitle={`Farmer: ${activePurchase.farmer?.fullName} (${activePurchase.farmer?.farmerId})`}
          maxWidth="md"
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="p-3 bg-background border border-border rounded-xl text-xs space-y-1">
              <span className="text-text-muted text-[10px] uppercase font-bold block">Surveillance Reason</span>
              <p className="text-forest font-semibold">{activePurchase.flagReason}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Resolution Action
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDecision('APPROVE')}
                  className={`py-2 px-3 rounded-button text-xs font-bold border transition-colors ${
                    decision === 'APPROVE'
                      ? 'bg-success text-white border-success shadow-sm'
                      : 'bg-white text-text-main border-border'
                  }`}
                >
                  ✓ Approve for Payment
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('REJECT')}
                  className={`py-2 px-3 rounded-button text-xs font-bold border transition-colors ${
                    decision === 'REJECT'
                      ? 'bg-error text-white border-error shadow-sm'
                      : 'bg-white text-text-main border-border'
                  }`}
                >
                  ✕ Reject / Cancel Entry
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Supervisor Audit Justification
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document your verification (e.g. Inspected weighing slip, verified multi-family pooled delivery)"
                rows={3}
                className="w-full text-xs p-2.5 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setActivePurchase(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="forest" size="sm" isLoading={submitting}>
                Save Audit Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

