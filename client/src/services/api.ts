const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('krishisetu_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // If token expired, clear token
    if (!endpoint.includes('/auth/login')) {
      localStorage.removeItem('krishisetu_token');
      localStorage.removeItem('krishisetu_user');
      window.dispatchEvent(new Event('auth-expired'));
    }
  }

  const contentType = response.headers.get('content-type') || '';
  let data: any;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    data = await response.text();
  } else {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request<any>('/auth/me'),
  getDemoCredentials: () => request<any>('/auth/demo-credentials'),

  // Dashboard
  getDashboardSummary: (centreId?: string) =>
    request<any>(centreId ? `/dashboard/summary?centreId=${centreId}` : '/dashboard/summary'),

  // Farmers
  getFarmers: (params?: { search?: string; village?: string; centreId?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.village) q.append('village', params.village);
    if (params?.centreId) q.append('centreId', params.centreId);
    return request<any>(`/farmers?${q.toString()}`);
  },
  getFarmerById: (id: string) => request<any>(`/farmers/${id}`),
  createFarmer: (data: any) => request<any>('/farmers', { method: 'POST', body: JSON.stringify(data) }),
  updateFarmer: (id: string, data: any) => request<any>(`/farmers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Collection Centres
  getCentres: () => request<any>('/centres'),
  getCentreById: (id: string) => request<any>(`/centres/${id}`),

  // Daily Prices
  getActivePrices: () => request<any>('/prices/active'),
  getPriceHistory: () => request<any>('/prices/history'),
  publishPrices: (payload: { effectiveDate: string; rates: any[]; changeReason?: string }) =>
    request<any>('/prices/publish', { method: 'POST', body: JSON.stringify(payload) }),

  // Purchases
  createPurchase: (data: any) => request<any>('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  getPurchases: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params || {});
    return request<any>(`/purchases?${q.toString()}`);
  },
  getPurchaseBySlip: (slipNumber: string) => request<any>(`/purchases/${slipNumber}`),
  reviewPurchase: (id: string, payload: { decision: 'APPROVE' | 'REJECT'; notes?: string }) =>
    request<any>(`/purchases/${id}/review`, { method: 'POST', body: JSON.stringify(payload) }),
  verifyAiPhotos: (formData: FormData) =>
    request<any>('/purchases/ai-verify', { method: 'POST', body: formData }),

  // Offline Sync
  syncBatch: (payload: { items: any[]; clientId: string }) =>
    request<any>('/sync/batch', { method: 'POST', body: JSON.stringify(payload) }),
  getSyncRecords: () => request<any>('/sync/records'),

  // Payments
  getEligiblePurchases: () => request<any>('/payments/eligible'),
  createPaymentRun: (purchaseIds: string[]) =>
    request<any>('/payments/create-run', { method: 'POST', body: JSON.stringify({ purchaseIds }) }),
  getPaymentRuns: () => request<any>('/payments/runs'),
  downloadPaymentCsv: async (id: string, fileName?: string) => {
    const token = localStorage.getItem('krishisetu_token');
    const res = await fetch(`${API_BASE}/payments/runs/${id}/download-csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `Batch-${id}-Payment.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  simulateBankStatus: (id: string, targetStatus: 'PAID' | 'FAILED' | 'PROCESSING') =>
    request<any>(`/payments/runs/${id}/simulate-bank`, { method: 'POST', body: JSON.stringify({ targetStatus }) }),

  // Stock Management
  getStockSummary: () => request<any>('/stock/summary'),
  getDispatches: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params || {});
    return request<any>(`/stock/dispatches?${q.toString()}`);
  },
  createDispatch: (data: any) => request<any>('/stock/dispatches', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: (params?: { entityType?: string; action?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.entityType) q.append('entityType', params.entityType);
    if (params?.action) q.append('action', params.action);
    if (params?.limit) q.append('limit', String(params.limit));
    return request<any>(`/audit/logs?${q.toString()}`);
  },
  verifyAuditChain: () => request<any>('/audit/verify-chain')
};

