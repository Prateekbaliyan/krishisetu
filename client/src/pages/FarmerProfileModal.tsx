import React, { useState, useEffect } from 'react';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import { Farmer } from '../types';
import {
  User,
  Building,
  CreditCard,
  Phone,
  MapPin,
  Scale,
  Calendar,
  CheckCircle2,
  Receipt
} from 'lucide-react';

interface FarmerProfileModalProps {
  farmerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FarmerProfileModal: React.FC<FarmerProfileModalProps> = ({
  farmerId,
  isOpen,
  onClose
}) => {
  const [farmer, setFarmer] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'purchases' | 'payments'>('profile');

  useEffect(() => {
    if (farmerId && isOpen) {
      setLoading(true);
      api.getFarmerById(farmerId)
        .then(res => {
          if (res.farmer) setFarmer(res.farmer);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [farmerId, isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={farmer?.fullName || 'Farmer Profile'}
      subtitle={`Member ID: ${farmer?.farmerId || ''} • Assigned Village: ${farmer?.village || ''}`}
      maxWidth="xl"
    >
      {loading || !farmer ? (
        <div className="py-12 text-center text-xs text-text-muted">Loading farmer profile...</div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-border text-xs font-semibold">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-3 border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-forest text-forest font-bold'
                  : 'border-transparent text-text-muted hover:text-forest'
              }`}
            >
              Member Details
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`py-2 px-3 border-b-2 transition-colors ${
                activeTab === 'purchases'
                  ? 'border-forest text-forest font-bold'
                  : 'border-transparent text-text-muted hover:text-forest'
              }`}
            >
              Purchase History ({farmer.purchases?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-2 px-3 border-b-2 transition-colors ${
                activeTab === 'payments'
                  ? 'border-forest text-forest font-bold'
                  : 'border-transparent text-text-muted hover:text-forest'
              }`}
            >
              Bank Payments ({farmer.payments?.length || 0})
            </button>
          </div>

          {/* Tab 1: Profile & Summary Metrics */}
          {activeTab === 'profile' && (
            <div className="space-y-4 text-xs">
              {/* Procurement Lifetime Summary Banner */}
              <div className="grid grid-cols-3 gap-2 bg-background p-3 rounded-xl border border-border text-center">
                <div>
                  <p className="text-[10px] text-text-muted uppercase font-bold">Total Intake</p>
                  <p className="text-base font-extrabold text-forest mt-0.5">
                    {farmer.metrics?.totalWeightDeliveredKg || 0} kg
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase font-bold">Total Procurement</p>
                  <p className="text-base font-extrabold text-forest mt-0.5">
                    ₹{(farmer.metrics?.totalProcurementValue || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase font-bold">Paid to Account</p>
                  <p className="text-base font-extrabold text-success mt-0.5">
                    ₹{(farmer.metrics?.totalPaidAmount || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Farmer Personal & Agronomic Info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-card rounded-xl border border-border">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Full Legal Name</span>
                  <p className="font-semibold text-forest mt-0.5">{farmer.fullName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Farmer Member ID</span>
                  <p className="font-mono font-semibold text-forest mt-0.5">{farmer.farmerId}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Assigned Centre</span>
                  <p className="font-medium text-forest mt-0.5">
                    {farmer.centre?.code} – {farmer.centre?.name}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Village & District</span>
                  <p className="font-medium text-forest mt-0.5">{farmer.village}, Latur</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Registered Land</span>
                  <p className="font-medium text-forest mt-0.5">{farmer.landAreaAcres} Acres</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Primary Commodity</span>
                  <p className="font-medium text-forest mt-0.5">{farmer.primaryCrop}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Mobile Number</span>
                  <p className="font-mono font-medium text-forest mt-0.5">{farmer.mobileNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Aadhaar Stored?</span>
                  <p className="text-text-muted italic mt-0.5">Never collected (Compliant)</p>
                </div>
              </div>

              {/* Bank Details (Masked) */}
              <div className="p-3 bg-sage/30 rounded-xl border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-forest flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-primary" /> Verified Banking Coordinates
                  </span>
                  <Badge variant={farmer.bankVerificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="sm">
                    {farmer.bankVerificationStatus}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Account Holder</span>
                    <p className="font-semibold text-forest">{farmer.bankAccountName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Masked Account No</span>
                    <p className="font-mono font-bold text-forest">{farmer.bankAccountNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Bank Name</span>
                    <p className="text-forest">{farmer.bankName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">IFSC Code</span>
                    <p className="font-mono font-semibold text-forest">{farmer.ifscCode}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Purchase History */}
          {activeTab === 'purchases' && (
            <div className="max-h-72 overflow-y-auto divide-y divide-border text-xs">
              {farmer.purchases?.length === 0 ? (
                <p className="py-6 text-center text-text-muted">No purchases recorded yet for this member.</p>
              ) : (
                farmer.purchases?.map((p: any) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between hover:bg-background px-1 rounded">
                    <div>
                      <span className="font-mono font-bold text-forest">{p.slipNumber}</span>
                      <span className="text-text-muted ml-2 text-[11px]">
                        {new Date(p.purchaseDate).toLocaleDateString('en-IN')}
                      </span>
                      <p className="text-text-secondary text-[11px]">
                        {p.crop} ({p.grade}) • Net: {p.netWeight} kg @ ₹{p.ratePerQuintal}/qtl
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-forest">₹{p.totalAmount.toLocaleString()}</p>
                      <Badge variant={p.status === 'PAID' ? 'success' : p.isFlagged ? 'warning' : 'neutral'} size="sm">
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Payment History */}
          {activeTab === 'payments' && (
            <div className="max-h-72 overflow-y-auto divide-y divide-border text-xs">
              {farmer.payments?.length === 0 ? (
                <p className="py-6 text-center text-text-muted">No payments disbursed yet for this member.</p>
              ) : (
                farmer.payments?.map((pmt: any) => (
                  <div key={pmt.id} className="py-2.5 flex items-center justify-between hover:bg-background px-1 rounded">
                    <div>
                      <span className="font-mono font-bold text-forest">
                        {pmt.paymentRun?.batchNumber || 'DIRECT'}
                      </span>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Ref: <span className="font-mono">{pmt.bankReferenceNumber || 'Pending Clearing'}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">₹{pmt.amount.toLocaleString()}</p>
                      <Badge variant={pmt.status === 'PAID' ? 'success' : 'warning'} size="sm">
                        {pmt.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

