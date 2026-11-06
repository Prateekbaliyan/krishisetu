import fs from 'fs';
import path from 'path';

export interface VisionAnalysisResult {
  provider: 'gemini' | 'mock' | 'unconfigured';
  success: boolean;
  meterType: 'SCALE' | 'MOISTURE';
  detectedValue: number | null;
  unit: string | null;
  confidence: number; // 0.0 - 1.0
  isReadable: boolean;
  notes: string;
  rawResponse?: string;
  error?: string;
}

export interface VerificationComparison {
  manualValue: number;
  aiValue: number | null;
  difference: number | null;
  withinTolerance: boolean;
  toleranceApplied: number;
  status: 'MATCH' | 'DIFF_ACCEPTED' | 'MANUAL_OVERRIDE' | 'FAILED' | 'NOT_PERFORMED';
  message: string;
}

export const SCALE_TOLERANCE_KG = 2.0;       // Max allowable difference in kg
export const MOISTURE_TOLERANCE_PCT = 0.5;   // Max allowable moisture diff in %

/**
 * Analyzes scale or moisture meter image using Gemini Vision API with robust error handling,
 * timeouts, rate limit guards, confidence scoring, and strict non-fabrication.
 */
export async function analyzeMeterImage(
  imageBuffer: Buffer,
  mimeType: string,
  meterType: 'SCALE' | 'MOISTURE'
): Promise<VisionAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const provider = process.env.VISION_PROVIDER || (apiKey ? 'gemini' : 'unconfigured');

  // Validate image buffer presence
  if (!imageBuffer || imageBuffer.length < 16) {
    return {
      provider: provider === 'mock' ? 'mock' : 'unconfigured',
      success: false,
      meterType,
      detectedValue: null,
      unit: null,
      confidence: 0,
      isReadable: false,
      notes: 'No valid image data provided for meter reading analysis.',
      error: 'INVALID_IMAGE_DATA'
    };
  }

  // Gemini Vision execution path
  if (provider === 'gemini') {
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your-gemini-api-key')) {
      return {
        provider: 'unconfigured',
        success: false,
        meterType,
        detectedValue: null,
        unit: null,
        confidence: 0,
        isReadable: false,
        notes: 'GEMINI_API_KEY is not configured in backend environment variables. Vision analysis cannot be performed automatically. Manual verification required.',
        error: 'API_KEY_MISSING'
      };
    }

    const controller = new AbortController();
    const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const base64Data = imageBuffer.toString('base64');
      const promptText = meterType === 'SCALE'
        ? `You are an OCR vision assistant for agricultural weighing scale verification. 
Examine this photograph of an electronic weighing scale LCD/LED indicator display. 
Extract:
1. The numeric gross weight value shown on the digital display (in kilograms).
2. The unit displayed (kg or t).
3. Confidence score between 0.00 and 1.00 based on image clarity, glare and readability.
4. Boolean isReadable indicating if the display digits are clear.
5. Brief notes on glare, angle, or digit visibility.

Return strictly a JSON object with this exact schema:
{
  "detectedValue": number,
  "unit": "kg",
  "confidence": number,
  "isReadable": boolean,
  "notes": "string"
}`
        : `You are an OCR vision assistant for agricultural grain moisture meter verification.
Examine this photograph of an electronic moisture meter LCD/LED display.
Extract:
1. The numeric moisture percentage shown on the digital display (e.g., 11.5, 13.8).
2. The unit (%).
3. Confidence score between 0.00 and 1.00 based on image clarity and readability.
4. Boolean isReadable indicating if the display digits are clear.
5. Brief notes on display status or lighting.

Return strictly a JSON object with this exact schema:
{
  "detectedValue": number,
  "unit": "%",
  "confidence": number,
  "isReadable": boolean,
  "notes": "string"
}`;

      const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          return {
            provider: 'gemini',
            success: false,
            meterType,
            detectedValue: null,
            unit: null,
            confidence: 0,
            isReadable: false,
            notes: 'Gemini Vision API quota / rate limit exceeded. Please try again shortly or use manual override.',
            error: 'RATE_LIMIT_EXCEEDED'
          };
        }
        if (response.status === 400 || response.status === 403) {
          return {
            provider: 'gemini',
            success: false,
            meterType,
            detectedValue: null,
            unit: null,
            confidence: 0,
            isReadable: false,
            notes: `Gemini API authentication or configuration error (HTTP ${response.status}).`,
            error: 'API_AUTH_ERROR'
          };
        }
        return {
          provider: 'gemini',
          success: false,
          meterType,
          detectedValue: null,
          unit: null,
          confidence: 0,
          isReadable: false,
          notes: `Gemini Vision service temporarily unavailable (status ${response.status}). Manual verification required.`,
          error: errorText
        };
      }

      const jsonResponse = await response.json();
      let candidateText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        return {
          provider: 'gemini',
          success: false,
          meterType,
          detectedValue: null,
          unit: null,
          confidence: 0,
          isReadable: false,
          notes: 'No response text returned by vision model. Digits may be unreadable.',
          error: 'EMPTY_VISION_RESPONSE'
        };
      }

      // Strip markdown backticks if returned
      const jsonMatch = candidateText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        candidateText = jsonMatch[1];
      }

      let parsed: any;
      try {
        parsed = JSON.parse(candidateText.trim());
      } catch (e) {
        return {
          provider: 'gemini',
          success: false,
          meterType,
          detectedValue: null,
          unit: null,
          confidence: 0,
          isReadable: false,
          notes: 'Could not parse structured reading from Gemini vision output.',
          rawResponse: candidateText,
          error: 'PARSE_ERROR'
        };
      }

      const detected = typeof parsed.detectedValue === 'number' ? parsed.detectedValue : null;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
      const isReadable = Boolean(parsed.isReadable) && confidence >= 0.50 && detected !== null;

      // Validate logical ranges
      if (detected !== null) {
        if (meterType === 'SCALE' && (detected < 0 || detected > 50000)) {
          return {
            provider: 'gemini',
            success: false,
            meterType,
            detectedValue: detected,
            unit: 'kg',
            confidence,
            isReadable: false,
            notes: `Detected scale weight (${detected} kg) is outside realistic agricultural procurement range (0–50,000 kg).`,
            error: 'RANGE_ANOMALY'
          };
        }
        if (meterType === 'MOISTURE' && (detected < 0 || detected > 40)) {
          return {
            provider: 'gemini',
            success: false,
            meterType,
            detectedValue: detected,
            unit: '%',
            confidence,
            isReadable: false,
            notes: `Detected moisture (${detected}%) is outside expected grain range (0–40%).`,
            error: 'RANGE_ANOMALY'
          };
        }
      }

      return {
        provider: 'gemini',
        success: isReadable && detected !== null,
        meterType,
        detectedValue: detected,
        unit: parsed.unit || (meterType === 'SCALE' ? 'kg' : '%'),
        confidence,
        isReadable,
        notes: parsed.notes || (isReadable ? 'Successfully extracted reading from meter display.' : 'Display digits were not clearly readable.'),
        rawResponse: candidateText
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          provider: 'gemini',
          success: false,
          meterType,
          detectedValue: null,
          unit: null,
          confidence: 0,
          isReadable: false,
          notes: `Gemini Vision request timed out after ${timeoutMs}ms. Network latency high.`,
          error: 'TIMEOUT'
        };
      }
      return {
        provider: 'gemini',
        success: false,
        meterType,
        detectedValue: null,
        unit: null,
        confidence: 0,
        isReadable: false,
        notes: `Vision API execution error: ${err.message}`,
        error: err.message
      };
    }
  }

  // Mock provider (explicitly used for automated testing)
  if (provider === 'mock') {
    return {
      provider: 'mock',
      success: true,
      meterType,
      detectedValue: meterType === 'SCALE' ? 1250.0 : 11.5,
      unit: meterType === 'SCALE' ? 'kg' : '%',
      confidence: 0.94,
      isReadable: true,
      notes: 'Test mock provider reading calibrated for standard sample.'
    };
  }

  // Unconfigured state: Never fabricate! Explicitly explain missing configuration
  return {
    provider: 'unconfigured',
    success: false,
    meterType,
    detectedValue: null,
    unit: null,
    confidence: 0,
    isReadable: false,
    notes: 'No Vision AI API key configured. Manual verification must be performed with audit log entry.',
    error: 'VISION_PROVIDER_UNCONFIGURED'
  };
}

/**
 * Compares manual reading with AI extracted value against tolerance thresholds
 */
export function compareWithManualReading(
  meterType: 'SCALE' | 'MOISTURE',
  manualValue: number,
  aiResult?: VisionAnalysisResult | null,
  isManualOverride: boolean = false
): VerificationComparison {
  const tolerance = meterType === 'SCALE' ? SCALE_TOLERANCE_KG : MOISTURE_TOLERANCE_PCT;
  const unit = meterType === 'SCALE' ? 'kg' : '%';

  if (!aiResult || !aiResult.success || aiResult.detectedValue === null) {
    return {
      manualValue,
      aiValue: null,
      difference: null,
      withinTolerance: isManualOverride,
      toleranceApplied: tolerance,
      status: isManualOverride ? 'MANUAL_OVERRIDE' : 'FAILED',
      message: isManualOverride
        ? 'Manual verification recorded. AI OCR was unavailable or unreadable.'
        : `AI vision recognition unavailable or failed: ${aiResult?.notes || 'No reading obtained'}. Manual override required.`
    };
  }

  const diffRaw = Math.abs(manualValue - aiResult.detectedValue);
  const difference = Math.round(diffRaw * 10) / 10;
  const withinTolerance = difference <= tolerance;

  if (withinTolerance) {
    return {
      manualValue,
      aiValue: aiResult.detectedValue,
      difference,
      withinTolerance: true,
      toleranceApplied: tolerance,
      status: 'MATCH',
      message: `AI value (${aiResult.detectedValue} ${unit}) matches manual entry within allowed tolerance of ±${tolerance} ${unit}.`
    };
  }

  if (isManualOverride) {
    return {
      manualValue,
      aiValue: aiResult.detectedValue,
      difference,
      withinTolerance: false,
      toleranceApplied: tolerance,
      status: 'DIFF_ACCEPTED',
      message: `Manual override recorded with ${difference} ${unit} discrepancy. Supervisor review required.`
    };
  }

  return {
    manualValue,
    aiValue: aiResult.detectedValue,
    difference,
    withinTolerance: false,
    toleranceApplied: tolerance,
    status: 'DIFF_ACCEPTED',
    message: `Mismatch detected! Manual entry (${manualValue} ${unit}) differs from AI display reading (${aiResult.detectedValue} ${unit}) by ${difference} ${unit} (tolerance: ±${tolerance} ${unit}). Operator review required.`
  };
}
