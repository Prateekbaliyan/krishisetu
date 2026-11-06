import React, { useRef } from 'react';
import { Purchase } from '../../types';
import { Printer, Download, CheckCircle2, Building, Calendar, Phone } from 'lucide-react';
import { Button } from '../ui/Button';

interface SlipPrintViewProps {
  purchase: Purchase;
  onClose?: () => void;
}

export const SlipPrintView: React.FC<SlipPrintViewProps> = ({ purchase, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    // Standard browser print-to-PDF
    window.print();
  };

  const formattedDate = new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between no-print bg-background p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary">Procurement Slip:</span>
          <span className="text-sm font-bold text-forest">{purchase.slipNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
            Print Slip
          </Button>
          <Button variant="primary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleDownloadPdf}>
            Download PDF
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>

      {/* Slip Printable Sheet */}
      <div
        ref={printRef}
        className="print-slip bg-white p-6 sm:p-8 rounded-card border-2 border-forest/20 shadow-card max-w-lg mx-auto text-forest font-sans"
      >
        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-forest/30 pb-4 mb-4">
          <p className="text-[10px] tracking-widest uppercase font-bold text-text-secondary">Farmer Producer Company Ltd, Latur</p>
          <h2 className="text-xl font-extrabold text-forest mt-0.5 tracking-tight">KRISHISETU PROCUREMENT SLIP</h2>
          <p className="text-xs text-text-secondary mt-0.5">अधिकृत शेतकरी धान्य खरेदी पावती</p>
          
          <div className="mt-3 inline-block bg-sage px-3 py-1 rounded-full border border-forest/20">
            <span className="text-xs font-mono font-bold text-forest tracking-wider">
              {purchase.slipNumber}
            </span>
          </div>
        </div>

        {/* Centre & Date Info */}
        <div className="grid grid-cols-2 text-xs py-2 border-b border-border gap-2">
          <div>
            <span className="text-text-muted text-[10px] uppercase font-bold block">Centre</span>
            <span className="font-semibold text-forest">
              {purchase.centre?.name || purchase.centreId} ({purchase.centre?.code})
            </span>
          </div>
          <div className="text-right">
            <span className="text-text-muted text-[10px] uppercase font-bold block">Date & Time</span>
            <span className="font-medium text-forest">{formattedDate}</span>
          </div>
        </div>

        {/* Farmer Information */}
        <div className="py-3 border-b border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-text-secondary">Farmer Name:</span>
            <span className="font-bold text-forest">{purchase.farmer?.fullName || 'FARMER MEMBER'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Farmer Reg ID:</span>
            <span className="font-mono font-semibold text-forest">{purchase.farmer?.farmerId || 'MH-LTR-1001'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Village:</span>
            <span className="font-medium text-forest">{purchase.farmer?.village || 'Latur'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Mobile:</span>
            <span className="font-mono font-medium text-forest">{purchase.farmer?.mobileNumber || '9822XXXXXX'}</span>
          </div>
        </div>

        {/* Crop & Weights Breakdown Table */}
        <div className="py-3 border-b-2 border-dashed border-forest/30 text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-text-muted text-[10px] uppercase border-b border-border text-left">
                <th className="pb-1">Item Parameter</th>
                <th className="pb-1 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-1.5 text-text-secondary">Commodity / Crop</td>
                <td className="py-1.5 font-bold text-right text-forest">{purchase.crop} ({purchase.grade})</td>
              </tr>
              <tr>
                <td className="py-1.5 text-text-secondary">Gross Weight</td>
                <td className="py-1.5 font-semibold text-right text-forest">{purchase.grossWeight.toFixed(1)} kg</td>
              </tr>
              <tr>
                <td className="py-1.5 text-text-secondary">Tare (Bag / Tare) Weight</td>
                <td className="py-1.5 font-semibold text-right text-text-secondary">-{purchase.tareWeight.toFixed(1)} kg</td>
              </tr>
              <tr className="bg-background/50 font-semibold">
                <td className="py-1.5 pl-1 text-forest">Actual Weight</td>
                <td className="py-1.5 pr-1 font-bold text-right text-forest">{purchase.actualWeight.toFixed(1)} kg</td>
              </tr>
              <tr>
                <td className="py-1.5 text-text-secondary">Moisture Reading</td>
                <td className="py-1.5 font-medium text-right text-forest">{purchase.moisture.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="py-1.5 text-text-secondary">Moisture Deduction</td>
                <td className="py-1.5 font-medium text-right text-warning">
                  {purchase.moistureDeductionPercent > 0 ? `-${purchase.moistureDeductionPercent.toFixed(1)}%` : '0.0% (NIL)'}
                </td>
              </tr>
              <tr className="bg-sage/40 font-bold">
                <td className="py-2 pl-1 text-forest">Net Billable Weight</td>
                <td className="py-2 pr-1 text-right text-forest text-sm font-extrabold">{purchase.netWeight.toFixed(1)} kg</td>
              </tr>
              <tr>
                <td className="py-1.5 text-text-secondary">Procurement Rate</td>
                <td className="py-1.5 font-semibold text-right text-forest">₹{purchase.ratePerQuintal.toFixed(2)} / qtl</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Final Amount Banner */}
        <div className="py-4 text-center bg-background rounded-xl my-3 border border-border">
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Total Payable Amount</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-forest mt-0.5">
            ₹{purchase.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            (Payable via direct bank transfer to verified account)
          </p>
        </div>

        {/* Bank & Verification Footer */}
        <div className="text-[11px] text-text-secondary border-t border-border pt-3 space-y-1">
          <div className="flex justify-between">
            <span>Bank Account:</span>
            <span className="font-mono">{purchase.farmer?.bankAccountNumber || 'XXXX-XXXX-XXXX'}</span>
          </div>
          <div className="flex justify-between">
            <span>IFSC Code:</span>
            <span className="font-mono">{purchase.farmer?.ifscCode || 'MAHB0000214'}</span>
          </div>
          <div className="flex justify-between">
            <span>Verification Status:</span>
            <span className="text-success font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Electronic Weighed
            </span>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-4 mt-8 pt-4 border-t border-dashed border-border text-center text-[10px] text-text-secondary">
          <div>
            <div className="border-b border-border h-8 mb-1"></div>
            <span>Farmer Signature / Thumb</span>
          </div>
          <div>
            <div className="border-b border-border h-8 mb-1"></div>
            <span>Centre In-Charge Signature</span>
          </div>
        </div>
      </div>
    </div>
  );
};

