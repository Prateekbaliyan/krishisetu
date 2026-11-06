/**
 * Configurable Bank Bulk Payment Export Adapter
 * 
 * SPECIFICATION & ASSUMPTION NOTICE:
 * Since a specific banking partner format (e.g. SBI CMP, HDFC Enet, ICICI Corporate)
 * was not mandated, this adapter implements a clearly labeled Generic NACH/NEFT Mock Bulk Payment
 * CSV format suitable for Indian Commercial Bank corporate clearing upload.
 * It is clearly labeled as a generic mock format and not a certified bank-specific format.
 */

export interface BankPaymentRecord {
  batchNumber: string;
  paymentId: string;
  farmerId: string;
  farmerName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankName: string;
  amount: number;
  remarks: string;
  date: string;
}

export interface BankCsvGenerationOptions {
  batchNumber: string;
  companyName?: string;
  records: BankPaymentRecord[];
}

export function escapeCsvField(field: string | number | undefined | null): string {
  if (field === null || field === undefined) return '';
  const stringValue = String(field);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Generates bulk upload CSV in generic mock bank format
 */
export function generateBankBulkPaymentCsv(options: BankCsvGenerationOptions): string {
  const company = options.companyName || 'Latur Farmer Producer Company Ltd';
  const timestamp = new Date().toISOString();

  const lines: string[] = [];

  // Header banner documenting format
  lines.push(`# FORMAT: GENERIC MOCK NEFT/NACH BULK PAYMENT FILE (DEMO SPECIFICATION)`);
  lines.push(`# ISSUER: ${company}`);
  lines.push(`# BATCH: ${options.batchNumber}`);
  lines.push(`# GENERATED_AT: ${timestamp}`);
  lines.push(`# TOTAL_RECORDS: ${options.records.length}`);
  lines.push(
    [
      'RecordType',
      'BatchNumber',
      'PaymentId',
      'FarmerId',
      'BeneficiaryName',
      'AccountHolderName',
      'BankAccountNumber',
      'IFSCCode',
      'BankName',
      'AmountINR',
      'PaymentMethod',
      'Narration',
      'PaymentDate'
    ].map(escapeCsvField).join(',')
  );

  for (const record of options.records) {
    const row = [
      'PAYMENT',
      options.batchNumber,
      record.paymentId,
      record.farmerId,
      record.farmerName,
      record.bankAccountName,
      record.bankAccountNumber,
      record.ifscCode,
      record.bankName,
      record.amount.toFixed(2),
      'NEFT',
      record.remarks || `KrishiSetu Proc Pmt ${options.batchNumber}`,
      record.date
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  return lines.join('\r\n');
}

