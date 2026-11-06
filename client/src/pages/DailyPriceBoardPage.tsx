import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import {
  TrendingUp,
  Calendar,
  CheckCircle2,
  History,
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react';

export const DailyPriceBoardPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [prices, setPrices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  // Form rates for publishing
  const [soybeanGradeA, setSoybeanGradeA] = useState('4850.00');
  const [soybeanFaq, setSoybeanFaq] = useState('4650.00');
  const [turGradeA, setTurGradeA] = useState('7200.00');
  const [turFaq, setTurFaq] = useState('6950.00');
  const [changeReason, setChangeReason] = useState('Daily MSP & Quality Benchmark Rate Alignment');

  const [publishing, setPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPriceData = async () => {
    setLoading(true);
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.getActivePrices(),
        api.getPriceHistory()
      ]);
      if (activeRes.prices) {
        setPrices(activeRes.prices);
        if (activeRes.effectiveDate) setEffectiveDate(activeRes.effectiveDate);

        // Populate form inputs
        const soyA = activeRes.prices.find((p: any) => p.crop === 'Soybean' && p.grade === 'Grade A');
        if (soyA) setSoybeanGradeA(String(soyA.ratePerQuintal));

        const soyFaq = activeRes.prices.find((p: any) => p.crop === 'Soybean' && p.grade === 'FAQ');
        if (soyFaq) setSoybeanFaq(String(soyFaq.ratePerQuintal));

        const turA = activeRes.prices.find((p: any) => p.crop === 'Tur' && p.grade === 'Grade A');
        if (turA) setTurGradeA(String(turA.ratePerQuintal));

        const turFaq = activeRes.prices.find((p: any) => p.crop === 'Tur' && p.grade === 'FAQ');
        if (turFaq) setTurFaq(String(turFaq.ratePerQuintal));
      }
      if (historyRes.history) setHistory(historyRes.history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPriceData();
  }, []);

  const handlePublishRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    setSuccessMessage(null);

    const rates = [
      { crop: 'Soybean', grade: 'Grade A', ratePerQuintal: Number(soybeanGradeA) },
      { crop: 'Soybean', grade: 'FAQ', ratePerQuintal: Number(soybeanFaq) },
      { crop: 'Tur', grade: 'Grade A', ratePerQuintal: Number(turGradeA) },
      { crop: 'Tur', grade: 'FAQ', ratePerQuintal: Number(turFaq) }
    ];

    try {
      const res = await api.publishPrices({
        effectiveDate,
        rates,
        changeReason
      });
      setSuccessMessage(`Centrally published rates effective ${effectiveDate} dispatched to all 22 centres.`);
      fetchPriceData();
    } catch (err: any) {
      alert(err.message || 'Failed to publish rates');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Daily Price Board</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Centralized procurement rate publication across crops and quality grades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="sage" size="md">
            Effective Date: {effectiveDate}
          </Badge>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-success-bg border border-success-border rounded-xl text-xs text-success font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Active Daily Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Soybean Card */}
        <Card className="space-y-3" padding="md">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌱</span>
              <div>
                <h3 className="text-sm font-bold text-forest">Soybean (सोयाबीन)</h3>
                <p className="text-[10px] text-text-muted">Procurement Standard Grid</p>
              </div>
            </div>
            <Badge variant="forest" size="sm">Active</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase font-bold">Grade A (FAQ Clean)</span>
              <p className="text-xl font-extrabold text-forest mt-0.5">₹{Number(soybeanGradeA).toFixed(0)}</p>
              <span className="text-[10px] text-text-secondary">per quintal</span>
            </div>
            <div className="p-3 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase font-bold">FAQ Standard</span>
              <p className="text-xl font-extrabold text-forest mt-0.5">₹{Number(soybeanFaq).toFixed(0)}</p>
              <span className="text-[10px] text-text-secondary">per quintal</span>
            </div>
          </div>
        </Card>

        {/* Tur Card */}
        <Card className="space-y-3" padding="md">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌾</span>
              <div>
                <h3 className="text-sm font-bold text-forest">Tur / Arhar (तूर)</h3>
                <p className="text-[10px] text-text-muted">Procurement Standard Grid</p>
              </div>
            </div>
            <Badge variant="forest" size="sm">Active</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase font-bold">Grade A (FAQ Clean)</span>
              <p className="text-xl font-extrabold text-forest mt-0.5">₹{Number(turGradeA).toFixed(0)}</p>
              <span className="text-[10px] text-text-secondary">per quintal</span>
            </div>
            <div className="p-3 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase font-bold">FAQ Standard</span>
              <p className="text-xl font-extrabold text-forest mt-0.5">₹{Number(turFaq).toFixed(0)}</p>
              <span className="text-[10px] text-text-secondary">per quintal</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Central Rate Publishing Form (Office Manager Only) */}
      {isManager ? (
        <Card className="space-y-4" padding="md">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-forest flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-primary" /> Publish Daily Rates (Central Office)
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Published rates are automatically applied uniformly across all 22 village collection centres.
              </p>
            </div>
            <Badge variant="neutral" size="sm">Rule: Past Slips Retain Original Rate</Badge>
          </div>

          <form onSubmit={handlePublishRates} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Effective Procurement Date"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  label="Rate Publication Reason / Market Justification"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-background rounded-xl border border-border space-y-3">
              <p className="text-xs font-bold text-forest uppercase tracking-wider">Rate Configuration (₹ / Quintal)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label="Soybean Grade A"
                  type="number"
                  step="10"
                  value={soybeanGradeA}
                  onChange={(e) => setSoybeanGradeA(e.target.value)}
                  unit="₹"
                  required
                />
                <Input
                  label="Soybean FAQ"
                  type="number"
                  step="10"
                  value={soybeanFaq}
                  onChange={(e) => setSoybeanFaq(e.target.value)}
                  unit="₹"
                  required
                />
                <Input
                  label="Tur Grade A"
                  type="number"
                  step="10"
                  value={turGradeA}
                  onChange={(e) => setTurGradeA(e.target.value)}
                  unit="₹"
                  required
                />
                <Input
                  label="Tur FAQ"
                  type="number"
                  step="10"
                  value={turFaq}
                  onChange={(e) => setTurFaq(e.target.value)}
                  unit="₹"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="forest" size="md" isLoading={publishing} icon={<CheckCircle2 className="w-4 h-4" />}>
                Publish Daily Rates (All Centres)
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="p-4 bg-background border border-border rounded-xl text-xs text-text-secondary flex items-start gap-2">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <span>
            <strong>Operator Notice:</strong> Daily procurement rates are centrally configured and published by the FPC Central Office. All collection centres operate under synchronized rates.
          </span>
        </div>
      )}

      {/* Publication History Table */}
      <Card className="space-y-4" padding="md">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-forest flex items-center gap-1.5">
              <History className="w-4 h-4 text-text-muted" /> Rate Publication History & Audit Trail
            </h3>
            <p className="text-xs text-text-secondary">Historical rate changes with publisher metadata</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                <th className="py-2.5 px-3">Effective Date</th>
                <th className="py-2.5 px-3">Commodity</th>
                <th className="py-2.5 px-3">Grade</th>
                <th className="py-2.5 px-3 text-right">Published Rate</th>
                <th className="py-2.5 px-3">Publisher</th>
                <th className="py-2.5 px-3">Justification Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {history.slice(0, 10).map((h) => (
                <tr key={h.id} className="hover:bg-background/80 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-forest">{h.effectiveDate}</td>
                  <td className="py-2.5 px-3 font-semibold text-forest">{h.crop}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{h.grade}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-forest">₹{h.ratePerQuintal.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{h.changedBy}</td>
                  <td className="py-2.5 px-3 text-text-muted text-[11px] truncate max-w-xs">{h.changeReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

