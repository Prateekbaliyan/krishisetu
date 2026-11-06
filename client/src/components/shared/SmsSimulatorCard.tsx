import React from 'react';
import { Purchase } from '../../types';
import { MessageSquare, CheckCheck, Smartphone, Info } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface SmsSimulatorCardProps {
  purchase: Purchase;
  customMessage?: string;
}

export const SmsSimulatorCard: React.FC<SmsSimulatorCardProps> = ({ purchase, customMessage }) => {
  const marathiCrop = purchase.crop === 'Soybean' ? 'सोयाबीन' : purchase.crop === 'Tur' ? 'तूर' : purchase.crop;
  const farmerName = purchase.farmer?.fullName || 'शेतकरी बंधू';

  // Exact mandated Marathi message format
  const marathiMessage = customMessage || `नमस्कार ${farmerName}, आपल्या ${marathiCrop} खरेदीची पावती ${purchase.slipNumber}. एकूण वजन: ${purchase.grossWeight.toFixed(1)} किलो, निव्वळ वजन: ${purchase.netWeight.toFixed(1)} किलो, दर: ₹${purchase.ratePerQuintal.toFixed(2)}/क्विंटल, देय रक्कम: ₹${purchase.totalAmount.toFixed(2)}. काही तफावत असल्यास केंद्राशी संपर्क साधा.`;

  return (
    <div className="bg-card rounded-card border border-border p-4 shadow-subtle space-y-3">
      {/* Header with explicit simulated label */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-sage flex items-center justify-center text-forest">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-forest uppercase tracking-wider">SMS Dispatch Simulation</h4>
            <p className="text-[10px] text-text-muted">DLT Approved Marathi Template (FPC)</p>
          </div>
        </div>
        <Badge variant="sage" size="sm">
          Simulated Dispatch
        </Badge>
      </div>

      {/* Simulated Phone Notification Screen */}
      <div className="bg-[#EBF2E8] border border-forest/15 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-forest/70 pb-1 border-b border-forest/10">
          <span className="font-semibold">SENDER: VM-KSETU</span>
          <span className="flex items-center gap-1 text-[10px]">
            <CheckCheck className="w-3.5 h-3.5 text-primary" /> Delivered
          </span>
        </div>
        <p className="text-xs sm:text-sm text-forest font-marathi leading-relaxed">
          {marathiMessage}
        </p>
        <div className="text-[10px] text-forest/60 text-right pt-0.5">
          Recipient: {purchase.farmer?.mobileNumber || '9822XXXXXX'}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-1.5 text-[10px] text-text-muted bg-background p-2 rounded-button">
        <Info className="w-3.5 h-3.5 flex-shrink-0 text-text-secondary mt-0.5" />
        <span>
          <strong>Notice:</strong> This SMS transmission is strictly simulated for demonstration. An actual SMS gateway carrier dispatch was not triggered.
        </span>
      </div>
    </div>
  );
};

