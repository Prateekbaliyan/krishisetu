import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Dispatch, CollectionCentre } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Warehouse,
  Truck,
  Plus,
  Scale,
  Calendar,
  Building,
  RefreshCw,
  TrendingDown,
  MapPin,
  CheckCircle2
} from 'lucide-react';

export const StockManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [stockData, setStockData] = useState<any | null>(null);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [centres, setCentres] = useState<CollectionCentre[]>([]);
  const [loading, setLoading] = useState(true);

  // Dispatch Modal State
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    centreId: '',
    crop: 'Soybean',
    truckNumber: '',
    driverName: '',
    driverMobile: '',
    dispatchWeight: '15000.0',
    destination: 'Latur Central Warehouse / Processing Mill',
    weightLossKg: '35.0',
    notes: 'Standard bulk bag dispatch'
  });
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, dispatchesRes, centresRes] = await Promise.all([
        api.getStockSummary(),
        api.getDispatches(),
        api.getCentres()
      ]);
      if (summaryRes) setStockData(summaryRes);
      if (dispatchesRes.dispatches) setDispatches(dispatchesRes.dispatches);
      if (centresRes.centres) {
        setCentres(centresRes.centres);
        if (centresRes.centres.length > 0 && !dispatchForm.centreId) {
          setDispatchForm(prev => ({ ...prev, centreId: centresRes.centres[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchError(null);

    if (!dispatchForm.truckNumber || !dispatchForm.driverName || !dispatchForm.dispatchWeight) {
      setDispatchError('Truck number, driver name, and dispatch weight are required.');
      return;
    }

    setDispatchSubmitting(true);
    try {
      await api.createDispatch(dispatchForm);
      setIsDispatchModalOpen(false);
      setDispatchForm({
        centreId: centres[0]?.id || '',
        crop: 'Soybean',
        truckNumber: '',
        driverName: '',
        driverMobile: '',
        dispatchWeight: '15000.0',
        destination: 'Latur Central Warehouse / Processing Mill',
        weightLossKg: '35.0',
        notes: 'Standard bulk bag dispatch'
      });
      fetchData();
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to record truck dispatch.');
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const global = stockData?.global || {};
  const cropTotals = stockData?.cropTotals || {};
  const centreSummaries = stockData?.centreSummaries || [];

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Stock & Warehouse Management</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Real procurement inward vs truck dispatches & transit moisture dry-down loss tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchData}
          >
            Refresh Stock
          </Button>
          <Button
            size="sm"
            variant="forest"
            icon={<Truck className="w-4 h-4" />}
            onClick={() => setIsDispatchModalOpen(true)}
          >
            Record Truck Dispatch
          </Button>
        </div>
      </div>

      {/* Global Stock KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Inward */}
        <Card padding="sm" className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Inward Intake</span>
          <p className="text-xl sm:text-2xl font-extrabold text-forest">
            {global.totalInwardTonnes || 0} <span className="text-xs font-medium text-text-secondary">Tonnes</span>
          </p>
          <p className="text-[11px] text-text-secondary">
            {(global.totalInwardKg || 0).toLocaleString()} kg received from farmers
          </p>
        </Card>

        {/* Total Dispatched */}
        <Card padding="sm" className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Outward Dispatched</span>
          <p className="text-xl sm:text-2xl font-extrabold text-forest">
            {global.totalDispatchedTonnes || 0} <span className="text-xs font-medium text-text-secondary">Tonnes</span>
          </p>
          <p className="text-[11px] text-text-secondary">
            {(global.totalDispatchedKg || 0).toLocaleString()} kg moved to processing plants
          </p>
        </Card>

        {/* Transit & Storage Loss */}
        <Card padding="sm" className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Transit & Dry Loss</span>
          <p className="text-xl sm:text-2xl font-extrabold text-warning">
            {(global.totalLossKg || 0).toLocaleString()} <span className="text-xs font-medium">kg</span>
          </p>
          <p className="text-[11px] text-text-secondary">
            Moisture loss & tare bag adjustment
          </p>
        </Card>

        {/* Current Available Stock */}
        <Card padding="sm" className="space-y-1 bg-sage/40 border-forest/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest">Current Village Stock</span>
          <p className="text-xl sm:text-2xl font-extrabold text-forest">
            {global.totalStockTonnes || 0} <span className="text-xs font-medium text-text-secondary">Tonnes</span>
          </p>
          <p className="text-[11px] text-forest/70 font-semibold">
            Inward - Dispatched - Loss
          </p>
        </Card>
      </div>

      {/* Crop Position (Soybean vs Tur) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Soybean Position */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-sm font-bold text-forest">🌱 Soybean Warehouse Position</span>
            <Badge variant="sage" size="sm">Available</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase">Inward</span>
              <p className="font-bold text-forest mt-0.5">{(cropTotals.Soybean?.inwardKg || 0).toLocaleString()} kg</p>
            </div>
            <div className="p-2 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase">Dispatched</span>
              <p className="font-bold text-forest mt-0.5">{(cropTotals.Soybean?.dispatchedKg || 0).toLocaleString()} kg</p>
            </div>
            <div className="p-2 bg-sage/60 rounded-button">
              <span className="text-[10px] text-forest uppercase font-bold">On Hand</span>
              <p className="font-extrabold text-forest mt-0.5">{(cropTotals.Soybean?.currentStockKg || 0).toLocaleString()} kg</p>
            </div>
          </div>
        </Card>

        {/* Tur Position */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-sm font-bold text-forest">🌾 Tur / Arhar Warehouse Position</span>
            <Badge variant="sage" size="sm">Available</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase">Inward</span>
              <p className="font-bold text-forest mt-0.5">{(cropTotals.Tur?.inwardKg || 0).toLocaleString()} kg</p>
            </div>
            <div className="p-2 bg-background rounded-button">
              <span className="text-[10px] text-text-muted uppercase">Dispatched</span>
              <p className="font-bold text-forest mt-0.5">{(cropTotals.Tur?.dispatchedKg || 0).toLocaleString()} kg</p>
            </div>
            <div className="p-2 bg-sage/60 rounded-button">
              <span className="text-[10px] text-forest uppercase font-bold">On Hand</span>
              <p className="font-extrabold text-forest mt-0.5">{(cropTotals.Tur?.currentStockKg || 0).toLocaleString()} kg</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Centre-wise Inventory Breakdown Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-bold text-forest">Centre-wise Physical Stock Ledger</h3>
          <p className="text-xs text-text-secondary">Inventory held across village procurement points</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                <th className="py-2.5 px-4">Centre Code</th>
                <th className="py-2.5 px-4">Centre Name & Village</th>
                <th className="py-2.5 px-4 text-right">Soybean Stock</th>
                <th className="py-2.5 px-4 text-right">Tur Stock</th>
                <th className="py-2.5 px-4 text-right">Total Inward</th>
                <th className="py-2.5 px-4 text-right">Total Dispatched</th>
                <th className="py-2.5 px-4 text-right">Current Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {centreSummaries.map((c: any) => (
                <tr key={c.centreId} className="hover:bg-background/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-forest">{c.centreCode}</td>
                  <td className="py-3 px-4 font-semibold text-forest">
                    {c.centreName} <span className="text-text-muted font-normal">({c.village})</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-forest">
                    {Math.round(c.crops?.Soybean?.current || 0).toLocaleString()} kg
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-forest">
                    {Math.round(c.crops?.Tur?.current || 0).toLocaleString()} kg
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-text-secondary">
                    {c.totalInwardKg.toLocaleString()} kg
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-text-secondary">
                    {c.totalDispatchedKg.toLocaleString()} kg
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-extrabold text-forest bg-sage/20">
                    {c.totalCurrentStockTonnes} T ({c.totalCurrentStockKg.toLocaleString()} kg)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Outward Truck Dispatches Ledger */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-forest flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-primary" /> Outward Truck Dispatch History
            </h3>
            <p className="text-xs text-text-secondary">Dispatches from collection centres to central warehouse/mill</p>
          </div>
          <Badge variant="neutral" size="sm">{dispatches.length} Total Dispatches</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                <th className="py-2.5 px-4">Dispatch Date</th>
                <th className="py-2.5 px-4">Truck Number</th>
                <th className="py-2.5 px-4">Centre</th>
                <th className="py-2.5 px-4">Commodity</th>
                <th className="py-2.5 px-4 text-right">Dispatch Weight</th>
                <th className="py-2.5 px-4 text-right">Transit Loss</th>
                <th className="py-2.5 px-4">Driver Name</th>
                <th className="py-2.5 px-4">Destination Warehouse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-text-muted">No truck dispatches recorded yet.</td>
                </tr>
              ) : (
                dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-background/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-text-muted">
                      {new Date(d.dispatchedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-forest">{d.truckNumber}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{d.centre?.code}</td>
                    <td className="py-2.5 px-4 font-semibold text-forest">{d.crop}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-forest">
                      {d.dispatchWeight.toFixed(1)} kg
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-warning">
                      -{d.weightLossKg.toFixed(1)} kg
                    </td>
                    <td className="py-2.5 px-4 text-text-main">{d.driverName}</td>
                    <td className="py-2.5 px-4 text-text-secondary text-[11px] truncate max-w-xs">{d.destination}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Record Dispatch Modal */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Record New Truck Dispatch"
        subtitle="Dispatches decrease village centre stock and generate delivery challan"
        maxWidth="md"
      >
        <form onSubmit={handleSaveDispatch} className="space-y-4">
          {dispatchError && (
            <div className="p-3 bg-error-bg border border-error-border rounded-button text-xs text-error font-medium">
              {dispatchError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Origin Collection Centre
              </label>
              <select
                value={dispatchForm.centreId}
                onChange={(e) => setDispatchForm({ ...dispatchForm, centreId: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
                required
              >
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Commodity Dispatched
              </label>
              <select
                value={dispatchForm.crop}
                onChange={(e) => setDispatchForm({ ...dispatchForm, crop: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Soybean">Soybean</option>
                <option value="Tur">Tur (Arhar)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Truck Registration Number"
              value={dispatchForm.truckNumber}
              placeholder="e.g. MH-24-AT-8912"
              onChange={(e) => setDispatchForm({ ...dispatchForm, truckNumber: e.target.value })}
              required
            />
            <Input
              label="Net Dispatch Weight (kg)"
              type="number"
              step="0.1"
              value={dispatchForm.dispatchWeight}
              onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchWeight: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Driver Full Name"
              value={dispatchForm.driverName}
              placeholder="e.g. Santosh Vitthal Patil"
              onChange={(e) => setDispatchForm({ ...dispatchForm, driverName: e.target.value })}
              required
            />
            <Input
              label="Driver Mobile Number"
              value={dispatchForm.driverMobile}
              placeholder="9822XXXXXX"
              onChange={(e) => setDispatchForm({ ...dispatchForm, driverMobile: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Destination Warehouse / Mill"
              value={dispatchForm.destination}
              onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
              required
            />
            <Input
              label="Transit / Moisture Loss (kg)"
              type="number"
              step="0.1"
              value={dispatchForm.weightLossKg}
              onChange={(e) => setDispatchForm({ ...dispatchForm, weightLossKg: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDispatchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="forest" size="sm" isLoading={dispatchSubmitting}>
              Confirm Truck Dispatch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

