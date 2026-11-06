import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Farmer, CollectionCentre } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { FarmerProfileModal } from './FarmerProfileModal';
import {
  Users,
  Search,
  Plus,
  Edit,
  Eye,
  Filter,
  CreditCard,
  Building,
  CheckCircle2,
  RefreshCw,
  Phone,
  LandPlot
} from 'lucide-react';

export const FarmerRegistryPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [centres, setCentres] = useState<CollectionCentre[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('ALL');
  const [selectedCentre, setSelectedCentre] = useState('ALL');

  // Modals
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    farmerId: '',
    fullName: '',
    village: '',
    centreId: '',
    landAreaAcres: '4.0',
    primaryCrop: 'Soybean',
    bankAccountName: '',
    bankAccountNumber: '',
    ifscCode: '',
    bankName: 'Bank of Maharashtra',
    mobileNumber: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const [farmersRes, centresRes] = await Promise.all([
        api.getFarmers({
          search: search || undefined,
          village: selectedVillage !== 'ALL' ? selectedVillage : undefined,
          centreId: selectedCentre !== 'ALL' ? selectedCentre : undefined
        }),
        api.getCentres()
      ]);
      if (farmersRes.farmers) setFarmers(farmersRes.farmers);
      if (farmersRes.villages) setVillages(farmersRes.villages);
      if (centresRes.centres) setCentres(centresRes.centres);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, [selectedVillage, selectedCentre]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFarmers();
  };

  const handleOpenAddModal = () => {
    setEditingFarmer(null);
    setFormData({
      farmerId: `MH-LTR-${Math.floor(1050 + Math.random() * 900)}`,
      fullName: '',
      village: villages[0] || 'Ausa',
      centreId: centres[0]?.id || '',
      landAreaAcres: '4.0',
      primaryCrop: 'Soybean',
      bankAccountName: '',
      bankAccountNumber: '',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      mobileNumber: '9822' + Math.floor(100000 + Math.random() * 900000)
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (farmer: Farmer) => {
    setEditingFarmer(farmer);
    setFormData({
      farmerId: farmer.farmerId,
      fullName: farmer.fullName,
      village: farmer.village,
      centreId: farmer.centreId,
      landAreaAcres: String(farmer.landAreaAcres),
      primaryCrop: farmer.primaryCrop,
      bankAccountName: farmer.bankAccountName,
      bankAccountNumber: farmer.bankAccountNumber,
      ifscCode: farmer.ifscCode,
      bankName: farmer.bankName,
      mobileNumber: farmer.mobileNumber
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.fullName || !formData.village || !formData.centreId || !formData.mobileNumber) {
      setFormError('Please fill in all mandatory farmer contact and agronomic details.');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingFarmer) {
        await api.updateFarmer(editingFarmer.id, formData);
      } else {
        await api.createFarmer(formData);
      }
      setIsAddModalOpen(false);
      fetchFarmers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save farmer record.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Farmer Member Registry</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Verified members, land holdings & banking coordinates (Aadhaar-free compliant)
          </p>
        </div>
        {isManager && (
          <Button size="sm" variant="forest" icon={<Plus className="w-4 h-4" />} onClick={handleOpenAddModal}>
            Register New Farmer
          </Button>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <Card padding="sm" className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by farmer name, ID (e.g. MH-LTR-1001), or mobile..."
              className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Village Filter */}
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              className="text-xs font-medium bg-background border border-border rounded-button px-2.5 py-2 text-forest focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Villages</option>
              {villages.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            {/* Centre Filter */}
            <select
              value={selectedCentre}
              onChange={(e) => setSelectedCentre(e.target.value)}
              className="text-xs font-medium bg-background border border-border rounded-button px-2.5 py-2 text-forest focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Centres</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
              ))}
            </select>

            <Button type="submit" size="sm" variant="outline">
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Farmers Data Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                <th className="py-3 px-4">Farmer ID</th>
                <th className="py-3 px-4">Full Member Name</th>
                <th className="py-3 px-4">Village</th>
                <th className="py-3 px-4">Centre</th>
                <th className="py-3 px-4 text-center">Land (Acres)</th>
                <th className="py-3 px-4">Crop</th>
                <th className="py-3 px-4">Masked Account</th>
                <th className="py-3 px-4 text-center">Bank Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-text-muted">
                    Loading registry records...
                  </td>
                </tr>
              ) : farmers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-text-muted">
                    No farmer members match current filters.
                  </td>
                </tr>
              ) : (
                farmers.map((f) => (
                  <tr key={f.id} className="hover:bg-background/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-forest">{f.farmerId}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-forest">{f.fullName}</p>
                      <p className="text-[10px] text-text-muted">{f.mobileNumber}</p>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{f.village}</td>
                    <td className="py-3 px-4 text-text-secondary">{f.centre?.code}</td>
                    <td className="py-3 px-4 text-center font-semibold text-forest">
                      {f.landAreaAcres} ac
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="sage" size="sm">{f.primaryCrop}</Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-text-secondary">
                      {f.bankAccountNumber}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={f.bankVerificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="sm">
                        {f.bankVerificationStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setSelectedFarmerId(f.id);
                          setIsProfileOpen(true);
                        }}
                      >
                        Profile
                      </Button>
                      {isManager && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Edit className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenEditModal(f)}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Farmer Profile Modal */}
      <FarmerProfileModal
        farmerId={selectedFarmerId}
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setSelectedFarmerId(null);
        }}
      />

      {/* Add / Edit Farmer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingFarmer ? 'Edit Farmer Registration' : 'Register New Farmer Member'}
        subtitle="Ensure compliance: Never collect Aadhaar numbers. Fictional sample data only."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveFarmer} className="space-y-4">
          {formError && (
            <div className="p-3 bg-error-bg border border-error-border rounded-button text-xs text-error font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Farmer Member ID"
              value={formData.farmerId}
              disabled={!!editingFarmer}
              onChange={(e) => setFormData({ ...formData, farmerId: e.target.value })}
              required
            />
            <Input
              label="Full Legal Name"
              value={formData.fullName}
              placeholder="e.g. Rameshwar Baburao Shinde"
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Village"
              value={formData.village}
              placeholder="e.g. Belkund"
              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Collection Centre
              </label>
              <select
                value={formData.centreId}
                onChange={(e) => setFormData({ ...formData, centreId: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
                required
              >
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Land Area (Acres)"
              type="number"
              step="0.1"
              value={formData.landAreaAcres}
              onChange={(e) => setFormData({ ...formData, landAreaAcres: e.target.value })}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Primary Commodity
              </label>
              <select
                value={formData.primaryCrop}
                onChange={(e) => setFormData({ ...formData, primaryCrop: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Soybean">Soybean</option>
                <option value="Tur">Tur (Arhar)</option>
              </select>
            </div>
            <Input
              label="Mobile Number"
              value={formData.mobileNumber}
              placeholder="9822XXXXXX"
              onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
              required
            />
          </div>

          <div className="p-3 bg-sage/30 rounded-xl border border-border space-y-3">
            <p className="text-xs font-bold text-forest uppercase tracking-wider">
              Banking Coordinates (for Direct DBT Settlement)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Account Holder Name"
                value={formData.bankAccountName || formData.fullName}
                onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
              />
              <Input
                label="Bank Account Number"
                value={formData.bankAccountNumber}
                placeholder="6012XXXXXXXX"
                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Bank Name"
                value={formData.bankName}
                placeholder="Bank of Maharashtra"
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
              <Input
                label="IFSC Code"
                value={formData.ifscCode}
                placeholder="MAHB0000214"
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="forest" size="sm" isLoading={formSubmitting}>
              {editingFarmer ? 'Save Changes' : 'Register Farmer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

