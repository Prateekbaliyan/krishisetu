import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Scale,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  TrendingUp,
  RefreshCw,
  Building,
  Wheat,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface DashboardPageProps {
  onNavigateTab: (tab: string) => void;
  selectedCentreId?: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateTab, selectedCentreId }) => {
  const { user } = useAuth();
  const { queueCount, isOnline, triggerSync, isSyncing } = useSync();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    stats: any;
    cropBreakdown: any[];
    centreBreakdown: any[];
    recentTransactions: any[];
    syncStatus: any;
  } | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboardSummary(selectedCentreId);
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedCentreId]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary font-medium">Aggregating live procurement metrics...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const cropBreakdown = data?.cropBreakdown || [];
  const centreBreakdown = data?.centreBreakdown || [];
  const recentTransactions = data?.recentTransactions || [];

  const CROP_COLORS: Record<string, string> = {
    Soybean: '#527A50', // primary green
    Tur: '#D97706',     // muted amber
    Other: '#738071'
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">
            Procurement Operations Dashboard
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Latur Farmer Producer Company Central Mandi Operations • Season 2026–27
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchDashboardData}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="forest"
            icon={<Scale className="w-3.5 h-3.5" />}
            onClick={() => onNavigateTab('entry')}
          >
            New Collection Entry
          </Button>
        </div>
      </div>

      {/* Offline Sync Banner if queued items exist */}
      {queueCount > 0 && (
        <div className="bg-warning-bg border border-warning-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-warning">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                {queueCount} Purchases Pending In Local Offline Queue
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Saved safely in Dexie IndexedDB. Sync will push records to the central office automatically.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            isLoading={isSyncing}
            disabled={!isOnline}
            onClick={triggerSync}
          >
            Sync {queueCount} Records Now
          </Button>
        </div>
      )}

      {/* Key Metric KPI Cards (Real DB Aggregations) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Procurement */}
        <Card className="space-y-1" padding="sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Intake</span>
            <div className="w-7 h-7 rounded-lg bg-sage flex items-center justify-center text-forest">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <p className="text-xl sm:text-2xl font-extrabold text-forest">
              {stats.todayProcurementTonnes || 0} <span className="text-xs font-medium text-text-secondary">Tonnes</span>
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {(stats.todayProcurementKg || 0).toLocaleString()} kg • {stats.todayPurchases || 0} lots today
            </p>
          </div>
        </Card>

        {/* Total Purchase Value */}
        <Card className="space-y-1" padding="sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Purchase Value</span>
            <div className="w-7 h-7 rounded-lg bg-sage flex items-center justify-center text-forest">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <p className="text-xl sm:text-2xl font-extrabold text-forest">
              ₹{(stats.todayPurchaseValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Centrally published daily rate applied
            </p>
          </div>
        </Card>

        {/* Pending Payments */}
        <Card className="space-y-1" padding="sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Bank Clearing</span>
            <div className="w-7 h-7 rounded-lg bg-warning-bg flex items-center justify-center text-warning">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <p className="text-xl sm:text-2xl font-extrabold text-forest">
              ₹{(stats.pendingPaymentAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {stats.pendingPaymentCount || 0} approved lots awaiting batch run
            </p>
          </div>
        </Card>

        {/* Flagged / Review Queue */}
        <Card className="space-y-1" padding="sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Flagged For Review</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              stats.flaggedPurchases > 0 ? 'bg-error-bg text-error' : 'bg-sage text-forest'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <p className="text-xl sm:text-2xl font-extrabold text-forest">
              {stats.flaggedPurchases || 0} <span className="text-xs font-medium text-text-secondary">Lots</span>
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Anomaly detection & moisture streak review
            </p>
          </div>
        </Card>
      </div>

      {/* Visual Charts: Centre-wise & Crop-wise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Centre-wise Procurement Bar Chart (2 Cols) */}
        <Card className="lg:col-span-2 space-y-4" padding="md">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-forest">Centre-wise Procurement (Tonnes)</h3>
              <p className="text-xs text-text-secondary">Aggregated delivery volumes across village hubs</p>
            </div>
            <Badge variant="sage" size="sm">
              <Building className="w-3.5 h-3.5 mr-1" /> All Centres
            </Badge>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={centreBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#738071' }} />
                <YAxis tick={{ fontSize: 11, fill: '#738071' }} />
                <Tooltip
                  formatter={(value: any) => [`${value} Tonnes`, 'Total Intake']}
                  labelFormatter={(code) => {
                    const c = centreBreakdown.find(item => item.code === code);
                    return c ? `${c.code} – ${c.name}` : String(code);
                  }}
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5EAE1', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="totalTonnes" fill="#527A50" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Crop-wise Procurement Distribution (1 Col) */}
        <Card className="space-y-4" padding="md">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-forest">Crop Intake Share</h3>
              <p className="text-xs text-text-secondary">Soybean vs Tur Procurement</p>
            </div>
            <Wheat className="w-4 h-4 text-primary" />
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cropBreakdown}
                  dataKey="totalKg"
                  nameKey="crop"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {cropBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CROP_COLORS[entry.crop] || '#527A50'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${(Number(val) / 1000).toFixed(1)} Tonnes`, 'Volume']}
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5EAE1', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-border text-xs">
            {cropBreakdown.map((c) => (
              <div key={c.crop} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CROP_COLORS[c.crop] || '#527A50' }} />
                  <span className="font-semibold text-forest">{c.crop}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-forest">{c.totalTonnes} T</span>
                  <span className="text-text-muted ml-1">({c.purchaseCount} lots)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card className="space-y-4" padding="md">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-forest">Recent Procurement Transactions</h3>
            <p className="text-xs text-text-secondary">Latest intake lots recorded across centres</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            onClick={() => onNavigateTab('purchases')}
          >
            View All Slips
          </Button>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                <th className="py-2.5 px-3">Slip No</th>
                <th className="py-2.5 px-3">Farmer</th>
                <th className="py-2.5 px-3">Centre</th>
                <th className="py-2.5 px-3">Crop / Grade</th>
                <th className="py-2.5 px-3 text-right">Net Weight</th>
                <th className="py-2.5 px-3 text-right">Payable</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recentTransactions.slice(0, 7).map((p: any) => (
                <tr key={p.id} className="hover:bg-background/80 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-forest">{p.slipNumber}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-forest">{p.farmer?.fullName}</p>
                    <p className="text-[10px] text-text-muted font-mono">{p.farmer?.farmerId}</p>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary">{p.centre?.code}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-forest">{p.crop}</span>
                    <span className="text-[10px] text-text-muted ml-1">({p.grade})</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-forest">
                    {p.netWeight.toFixed(1)} kg
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-forest">
                    ₹{p.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-center">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

