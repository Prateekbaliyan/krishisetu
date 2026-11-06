/**
 * Simulated Marathi SMS Service for KrishiSetu
 * Note: Clearly labeled as simulated. Does NOT claim actual carrier SMS transmission.
 */

export interface SmsPayload {
  farmerName: string;
  farmerMobile: string;
  crop: string;
  slipNumber: string;
  grossWeight: number;
  netWeight: number;
  rate: number;
  amount: number;
}

export interface SmsResult {
  isSimulated: true;
  messageId: string;
  recipientMobile: string;
  formattedMessage: string;
  status: 'DELIVERED' | 'QUEUED' | 'FAILED';
  deliveryTimestamp: string;
  gatewayResponse: string;
}

/**
 * Builds standard Marathi notification message required by specification:
 * "नमस्कार {farmerName}, आपल्या {crop} खरेदीची पावती {slipNumber}. एकूण वजन: {grossWeight} किलो, निव्वळ वजन: {netWeight} किलो, दर: ₹{rate}/क्विंटल, देय रक्कम: ₹{amount}. काही तफावत असल्यास केंद्राशी संपर्क साधा."
 */
export function formatMarathiSms(payload: SmsPayload): string {
  const marathiCrop = payload.crop === 'Soybean' ? 'सोयाबीन' : payload.crop === 'Tur' ? 'तूर' : payload.crop;
  return `नमस्कार ${payload.farmerName}, आपल्या ${marathiCrop} खरेदीची पावती ${payload.slipNumber}. एकूण वजन: ${payload.grossWeight.toFixed(1)} किलो, निव्वळ वजन: ${payload.netWeight.toFixed(1)} किलो, दर: ₹${payload.rate.toFixed(2)}/क्विंटल, देय रक्कम: ₹${payload.amount.toFixed(2)}. काही तफावत असल्यास केंद्राशी संपर्क साधा.`;
}

/**
 * Dispatches simulated SMS and records gateway tracking ID
 */
export async function sendSimulatedSms(payload: SmsPayload): Promise<SmsResult> {
  const message = formatMarathiSms(payload);
  const messageId = `SIM_SMS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // Mask mobile number for logs: e.g. 98220XXXXX
  const maskedMobile = payload.farmerMobile.length >= 10
    ? `${payload.farmerMobile.slice(0, 5)}XXXXX`
    : payload.farmerMobile;

  return {
    isSimulated: true,
    messageId,
    recipientMobile: maskedMobile,
    formattedMessage: message,
    status: 'DELIVERED',
    deliveryTimestamp: new Date().toISOString(),
    gatewayResponse: `SIMULATED_SUCCESS_PROVIDER_MOCK: ACK-${messageId}`
  };
}

