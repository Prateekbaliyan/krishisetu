import React, { useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import {
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Sparkles,
  Info
} from 'lucide-react';

interface AiVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  manualGrossWeight: number;
  manualMoisture: number;
  onVerificationComplete: (result: {
    scaleAiWeight: number | null;
    moistureAiValue: number | null;
    aiConfidence: number | null;
    aiVerificationStatus: 'MATCH' | 'DIFF_ACCEPTED' | 'MANUAL_OVERRIDE' | 'FAILED' | 'NOT_PERFORMED';
    aiDiffNotes: string;
    scalePhotoUrl?: string;
    moisturePhotoUrl?: string;
  }) => void;
}

export const AiVerificationModal: React.FC<AiVerificationModalProps> = ({
  isOpen,
  onClose,
  manualGrossWeight,
  manualMoisture,
  onVerificationComplete
}) => {
  const [activeMeter, setActiveMeter] = useState<'SCALE' | 'MOISTURE'>('SCALE');

  // Scale photo state
  const [scaleFile, setScaleFile] = useState<File | null>(null);
  const [scalePreview, setScalePreview] = useState<string | null>(null);
  const [scaleAnalyzing, setScaleAnalyzing] = useState(false);
  const [scaleResult, setScaleResult] = useState<any>(null);

  // Moisture photo state
  const [moistureFile, setMoistureFile] = useState<File | null>(null);
  const [moisturePreview, setMoisturePreview] = useState<string | null>(null);
  const [moistureAnalyzing, setMoistureAnalyzing] = useState(false);
  const [moistureResult, setMoistureResult] = useState<any>(null);

  // Manual override state
  const [manualOverrideNotes, setManualOverrideNotes] = useState('');
  const [allowOverride, setAllowOverride] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, meterType: 'SCALE' | 'MOISTURE') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (meterType === 'SCALE') {
      setScaleFile(file);
      setScalePreview(previewUrl);
      setScaleResult(null);
    } else {
      setMoistureFile(file);
      setMoisturePreview(previewUrl);
      setMoistureResult(null);
    }
  };

  const runAnalysis = async (meterType: 'SCALE' | 'MOISTURE') => {
    const file = meterType === 'SCALE' ? scaleFile : moistureFile;
    const manualVal = meterType === 'SCALE' ? manualGrossWeight : manualMoisture;

    if (meterType === 'SCALE') setScaleAnalyzing(true);
    else setMoistureAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('meterType', meterType);
      formData.append('manualValue', String(manualVal));
      if (file) {
        if (meterType === 'SCALE') formData.append('scalePhoto', file);
        else formData.append('moisturePhoto', file);
      }

      const res = await api.verifyAiPhotos(formData);
      if (meterType === 'SCALE') {
        setScaleResult(res);
      } else {
        setMoistureResult(res);
      }
    } catch (err: any) {
      const errorResult = {
        visionResult: {
          success: false,
          notes: err.message || 'Vision analysis failed or service unreachable.',
          confidence: 0
        },
        comparison: {
          difference: null,
          withinTolerance: false,
          status: 'FAILED',
          message: err.message || 'Vision OCR connection failed.'
        }
      };
      if (meterType === 'SCALE') setScaleResult(errorResult);
      else setMoistureResult(errorResult);
    } finally {
      if (meterType === 'SCALE') setScaleAnalyzing(false);
      else setMoistureAnalyzing(false);
    }
  };

  const handleConfirmVerification = () => {
    const scaleComparison = scaleResult?.comparison;
    const moistureComparison = moistureResult?.comparison;

    let finalStatus: 'MATCH' | 'DIFF_ACCEPTED' | 'MANUAL_OVERRIDE' | 'FAILED' | 'NOT_PERFORMED' = 'NOT_PERFORMED';

    if (allowOverride) {
      finalStatus = 'MANUAL_OVERRIDE';
    } else if (scaleComparison?.withinTolerance && (!moistureComparison || moistureComparison.withinTolerance)) {
      finalStatus = 'MATCH';
    } else if (scaleResult || moistureResult) {
      finalStatus = 'DIFF_ACCEPTED';
    }

    const notes = [
      scaleResult?.visionResult?.notes ? `Scale: ${scaleResult.visionResult.notes}` : '',
      moistureResult?.visionResult?.notes ? `Moisture: ${moistureResult.visionResult.notes}` : '',
      manualOverrideNotes ? `Override Note: ${manualOverrideNotes}` : ''
    ].filter(Boolean).join(' | ');

    onVerificationComplete({
      scaleAiWeight: scaleResult?.visionResult?.detectedValue || null,
      moistureAiValue: moistureResult?.visionResult?.detectedValue || null,
      aiConfidence: scaleResult?.visionResult?.confidence || moistureResult?.visionResult?.confidence || null,
      aiVerificationStatus: finalStatus,
      aiDiffNotes: notes || 'Verified via operator vision check',
      scalePhotoUrl: scaleResult?.photoUrl,
      moisturePhotoUrl: moistureResult?.photoUrl
    });

    onClose();
  };

  const currentResult = activeMeter === 'SCALE' ? scaleResult : moistureResult;
  const currentAnalyzing = activeMeter === 'SCALE' ? scaleAnalyzing : moistureAnalyzing;
  const currentPreview = activeMeter === 'SCALE' ? scalePreview : moisturePreview;
  const manualValue = activeMeter === 'SCALE' ? manualGrossWeight : manualMoisture;
  const unit = activeMeter === 'SCALE' ? 'kg' : '%';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Photo Verification"
      subtitle="Verify electronic weighing scale and moisture meter readings with actual Vision AI"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Meter Type Switcher */}
        <div className="flex rounded-button p-1 bg-background border border-border">
          <button
            onClick={() => setActiveMeter('SCALE')}
            className={`flex-1 py-2 text-xs font-bold rounded-button transition-colors ${
              activeMeter === 'SCALE'
                ? 'bg-forest text-white shadow-sm'
                : 'text-text-secondary hover:text-forest'
            }`}
          >
            Weighing Scale Display ({manualGrossWeight} kg)
          </button>
          <button
            onClick={() => setActiveMeter('MOISTURE')}
            className={`flex-1 py-2 text-xs font-bold rounded-button transition-colors ${
              activeMeter === 'MOISTURE'
                ? 'bg-forest text-white shadow-sm'
                : 'text-text-secondary hover:text-forest'
            }`}
          >
            Moisture Meter Display ({manualMoisture}%)
          </button>
        </div>

        {/* Upload / Preview Box */}
        <div className="border-2 border-dashed border-border rounded-xl p-4 text-center bg-background/50 hover:bg-background transition-colors">
          {currentPreview ? (
            <div className="space-y-3">
              <div className="relative mx-auto max-h-48 overflow-hidden rounded-lg border border-border">
                <img
                  src={currentPreview}
                  alt={`${activeMeter} display`}
                  className="w-full h-44 object-contain bg-black/5"
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <label className="text-xs text-primary font-semibold hover:underline cursor-pointer">
                  Change Photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, activeMeter)}
                  />
                </label>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={currentAnalyzing}
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={() => runAnalysis(activeMeter)}
                >
                  Analyze with Vision AI
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center py-6 cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-sage flex items-center justify-center text-forest mb-2">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-forest">
                Upload {activeMeter === 'SCALE' ? 'Weighing Scale' : 'Moisture Meter'} Display Photo
              </p>
              <p className="text-xs text-text-muted mt-1">Take photo or browse JPG, PNG (Max 5MB)</p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileChange(e, activeMeter)}
              />
            </label>
          )}
        </div>

        {/* Vision Analysis Results & Comparison */}
        {currentResult && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-subtle animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-forest uppercase tracking-wider">Vision OCR Result</span>
                <span className="text-[10px] text-text-muted font-mono">
                  (Provider: {currentResult.visionResult?.provider || 'Gemini Vision'})
                </span>
              </div>
              {currentResult.comparison?.withinTolerance ? (
                <Badge variant="success" size="sm">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Matched
                </Badge>
              ) : currentResult.visionResult?.success ? (
                <Badge variant="warning" size="sm">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Discrepancy
                </Badge>
              ) : (
                <Badge variant="error" size="sm">
                  <XCircle className="w-3 h-3 mr-1" /> Analysis Failed
                </Badge>
              )}
            </div>

            {/* Value Comparison Grid */}
            <div className="grid grid-cols-3 gap-2 text-center py-1">
              <div className="p-2.5 bg-background rounded-button">
                <p className="text-[10px] text-text-muted uppercase font-bold">Manual Value</p>
                <p className="text-base font-extrabold text-forest mt-0.5">{manualValue} {unit}</p>
              </div>
              <div className="p-2.5 bg-background rounded-button">
                <p className="text-[10px] text-text-muted uppercase font-bold">AI Extracted</p>
                <p className="text-base font-extrabold text-forest mt-0.5">
                  {currentResult.visionResult?.detectedValue !== null
                    ? `${currentResult.visionResult.detectedValue} ${unit}`
                    : 'Unreadable'}
                </p>
              </div>
              <div className="p-2.5 bg-background rounded-button">
                <p className="text-[10px] text-text-muted uppercase font-bold">Difference</p>
                <p className={`text-base font-extrabold mt-0.5 ${
                  currentResult.comparison?.difference === 0
                    ? 'text-success'
                    : currentResult.comparison?.withinTolerance
                      ? 'text-forest'
                      : 'text-error'
                }`}>
                  {currentResult.comparison?.difference !== null
                    ? `±${currentResult.comparison.difference} ${unit}`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Confidence Bar */}
            {currentResult.visionResult?.confidence > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-secondary font-medium">Confidence Score:</span>
                  <span className="font-bold text-forest">
                    {Math.round(currentResult.visionResult.confidence * 100)}%
                  </span>
                </div>
                <div className="w-full bg-border h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 rounded-full"
                    style={{ width: `${Math.round(currentResult.visionResult.confidence * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-text-secondary italic">
              {currentResult.comparison?.message || currentResult.visionResult?.notes}
            </p>

            {/* Discrepancy / Low Confidence Resolution Warning */}
            {(!currentResult.comparison?.withinTolerance || !currentResult.visionResult?.success) && (
              <div className="p-3 bg-warning-bg/60 border border-warning-border rounded-button text-xs space-y-2">
                <div className="flex items-start gap-1.5 text-warning font-semibold">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Mismatch requires operator review. AI will never overwrite manual input.</span>
                </div>
                <label className="flex items-center gap-2 text-text-main font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOverride}
                    onChange={(e) => setAllowOverride(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Acknowledge reading and proceed with manual supervisor override</span>
                </label>
                {allowOverride && (
                  <input
                    type="text"
                    value={manualOverrideNotes}
                    onChange={(e) => setManualOverrideNotes(e.target.value)}
                    placeholder="Enter audit note for discrepancy (e.g. Display glare on tare decimal)"
                    className="w-full text-xs p-2 bg-white border border-border rounded-button text-forest focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmVerification}
            disabled={
              (currentResult && !currentResult.comparison?.withinTolerance && !allowOverride)
            }
          >
            Confirm & Apply Verification
          </Button>
        </div>
      </div>
    </Modal>
  );
};

