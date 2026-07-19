/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Role } from '../types';
import { offlineSync } from './offlineSync';

const TOKEN_KEY = 'ruqayya_token';

export const api = {
  setToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },
  
  clearToken: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  // Base fetch handler with auth headers and offline sync interception
  request: async (endpoint: string, options: RequestInit = {}) => {
    const method = options.method || 'GET';
    const isWrite = method !== 'GET';

    // Localized descriptions for the background synchronization log
    const getSyncDescriptions = (path: string, bodyObj: any): { en: string; ha: string } => {
      if (path.includes('/api/payments')) {
        return { 
          en: `Recording Driver Remittance Payment: ₦${Number(bodyObj.amount || 0).toLocaleString()}`, 
          ha: `Rikodin Biyan Kudin Direba na ₦${Number(bodyObj.amount || 0).toLocaleString()}` 
        };
      }
      if (path.includes('/api/vouchers')) {
        return { 
          en: `Requesting Fuel Wallet Voucher: ₦${Number(bodyObj.estimatedCost || 0).toLocaleString()}`, 
          ha: `Neman Takardar Kudin Man Fetur na ₦${Number(bodyObj.estimatedCost || 0).toLocaleString()}` 
        };
      }
      if (path.includes('/api/trips') && path.includes('/complete')) {
        return { 
          en: 'Completing Active Trip Remittance & Ledger Closing', 
          ha: 'Kammala Hanyar Remittance Da Shigar da Bilan' 
        };
      }
      if (path.includes('/api/trips')) {
        return { 
          en: `Registering New Fleet Trip Manifest to ${bodyObj.destination || 'Destination'}`, 
          ha: `Rikodin Sabuwar Takardar Tafiya zuwa ${bodyObj.destination || 'Inda za a je'}` 
        };
      }
      if (path.includes('/api/drivers/self')) {
        return { 
          en: 'Updating Personal Driver Profile Credentials', 
          ha: 'Sabunta Bayanan Akun Kanka' 
        };
      }
      if (path.includes('/api/documents/upload-company')) {
        return { 
          en: `Uploading Secure Digital Document: ${bodyObj.title || 'Document'}`, 
          ha: `Tura Amintattar Takardar Aiki: ${bodyObj.title || 'Takarda'}` 
        };
      }
      if (path.includes('/api/notifications/read')) {
        return { 
          en: 'Marking All Received Notifications as Read', 
          ha: 'Karanta Dukkan Sanarwar Tsarin Ruqayya' 
        };
      }
      if (path.includes('/api/finance')) {
        return { 
          en: `Posting Ledger Entry: ₦${Number(bodyObj.amount || 0).toLocaleString()} (${bodyObj.category || 'General'})`, 
          ha: `Shigar da Bayanin Kudi na ₦${Number(bodyObj.amount || 0).toLocaleString()} (${bodyObj.category || 'Aiki'})` 
        };
      }
      return { 
        en: `Submitting request to ${path}`, 
        ha: `Aika buƙata zuwa ga tsarin ${path}` 
      };
    };

    // If client is explicitly offline and it's a write request, intercept and queue!
    if (typeof navigator !== 'undefined' && !navigator.onLine && isWrite) {
      const body = options.body ? JSON.parse(options.body as string) : {};
      const desc = getSyncDescriptions(endpoint, body);
      offlineSync.enqueue(endpoint, method, body, desc.en, desc.ha);
      return { success: true, queued: true, message: 'Queued for offline synchronization.' };
    }

    const token = api.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      if (res.status === 412 || res.status === 401) {
        // Missing or expired token
        api.clearToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('session-expired', {
            detail: { message: "Session expired. Please enter your username again." }
          }));
        }
      }

      if (!res.ok) {
        let errMsg = 'API Communication Error';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          try {
            errMsg = await res.text();
          } catch (textErr) {}
        }
        throw new Error(errMsg);
      }

      try {
        return await res.json();
      } catch (e) {
        return null;
      }
    } catch (networkError) {
      // In case a network failure happened while online (or transitioning) and it's a write request, queue as fallback!
      if (isWrite) {
        console.warn('API connection failed mid-flight, queuing request for background sync.', networkError);
        const body = options.body ? JSON.parse(options.body as string) : {};
        const desc = getSyncDescriptions(endpoint, body);
        offlineSync.enqueue(endpoint, method, body, desc.en, desc.ha);
        return { success: true, queued: true, message: 'Queued for offline synchronization after network failure.' };
      }
      throw networkError;
    }
  },

  // Authentication & Registrations
  login: async (payload: { username?: string; portal?: string; email?: string; password?: string; rememberMe?: boolean }) => {
    const data = await api.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data && data.token) {
      api.setToken(data.token);
    }
    return data;
  },

  loginAsDemoRole: async (role: Role) => {
    const data = await api.request('/api/auth/login-as-role', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    if (data && data.token) {
      api.setToken(data.token);
    }
    return data;
  },

  logout: async (logoutAllDevices = false) => {
    try {
      await api.request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ logoutAllDevices })
      });
    } catch (err) {
      console.warn('Backend session clearance failed, clearing local token:', err);
    }
    api.clearToken();
  },

  getMe: async () => {
    return api.request('/api/auth/me');
  },

  changePasswordFirstLogin: async (newPassword: string) => {
    return api.request('/api/auth/change-password-first-login', {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
  },

  registerDriver: async (payload: { personal: any; guarantor: any; vehicle: any }) => {
    return api.request('/api/auth/register-driver', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  importDriver: async (payload: { personal: any; guarantor: any; vehicle: any }) => {
    return api.request('/api/drivers/import', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  registerDirector: async (payload: any) => {
    return api.request('/api/auth/register-director', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  registerAdmin: async (payload: any) => {
    return api.request('/api/auth/register-admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Drivers Management
  getDrivers: async (search = '') => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.request(`/api/drivers${query}`);
  },

  getDriverById: async (id: string) => {
    return api.request(`/api/drivers/${id}`);
  },

  getContractLookup: async (id: string) => {
    return api.request(`/api/drivers/${id}/contract-lookup`);
  },

  updateDriverStatus: async (id: string, payload: { status: 'approved' | 'rejected' | 'correction_requested'; remarks?: string; companyDriverId?: string }) => {
    return api.request(`/api/drivers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  classifyDriver: async (id: string, classification: 'Smart' | 'Assisted') => {
    return api.request(`/api/drivers/${id}/classify`, {
      method: 'PUT',
      body: JSON.stringify({ classification })
    });
  },

  // Document Storage Management
  uploadCompanyDocument: async (payload: { title: string; docType: string; fileBase64: string; driverId?: string; vehicleId?: string }) => {
    return api.request('/api/documents/upload-company', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Shareholders Management
  getShareholders: async () => {
    return api.request('/api/shareholders');
  },

  addShareholder: async (payload: any) => {
    return api.request('/api/shareholders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateShareholder: async (id: string, payload: any) => {
    return api.request(`/api/shareholders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  deleteShareholder: async (id: string) => {
    return api.request(`/api/shareholders/${id}`, {
      method: 'DELETE'
    });
  },

  // Vouchers
  getVouchers: async () => {
    return api.request('/api/vouchers');
  },

  requestVoucher: async (payload: { vehicleId: string; litersRequested: number; estimatedCost: number }) => {
    return api.request('/api/vouchers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  approveVoucher: async (id: string) => {
    return api.request(`/api/vouchers/${id}/approve`, {
      method: 'PUT'
    });
  },

  // Finance Ledger
  getFinance: async () => {
    return api.request('/api/finance');
  },

  postFinanceRecord: async (payload: { type: 'revenue' | 'expense'; category: string; amount: number; date: string; description: string }) => {
    return api.request('/api/finance', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Notifications
  getNotifications: async () => {
    return api.request('/api/notifications');
  },

  markNotificationsRead: async () => {
    return api.request('/api/notifications/read', {
      method: 'POST'
    });
  },

  // Audit Logs
  getAuditLogs: async () => {
    return api.request('/api/audit-logs');
  },

  // Vehicles Fleet Asset endpoints
  getVehicles: async () => {
    return api.request('/api/vehicles');
  },

  addVehicle: async (payload: { plateNumber: string; model: string; capacity: string; fuelType: string }) => {
    return api.request('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Daily Remittance Manifests
  getTrips: async () => {
    return api.request('/api/trips');
  },

  addTrip: async (payload: { vehicleId: string; driverId: string; origin: string; destination: string; tricycleType: string; weight: number; remittanceAmount: number }) => {
    return api.request('/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        vehicleId: payload.vehicleId,
        driverId: payload.driverId,
        origin: payload.origin,
        destination: payload.destination,
        cargoType: payload.tricycleType,
        weight: payload.weight,
        freightCharges: payload.remittanceAmount
      })
    });
  },

  completeTrip: async (id: string) => {
    return api.request(`/api/trips/${id}/complete`, {
      method: 'PUT'
    });
  },

  // Executive Director Controls
  startCycle: async (payload: { cycleId?: string; startDate: string; endDate?: string; endGoalTons?: number }) => {
    return api.request('/api/director/cycles/start', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  pauseCycle: async (payload: { reason: string }) => {
    return api.request('/api/director/cycles/pause', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  resumeCycle: async (payload: { reason?: string }) => {
    return api.request('/api/director/cycles/resume', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  endCycle: async (payload: { endDate: string }) => {
    return api.request('/api/director/cycles/end', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateShareholderSettings: async (payload: { distributionPercentage: number }) => {
    return api.request('/api/director/shareholder-settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  updateCompanySettings: async (payload: any) => {
    return api.request('/api/director/company-settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  createAdmin: async (payload: any) => {
    return api.request('/api/director/admins', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateAdmin: async (id: string, payload: any) => {
    return api.request(`/api/director/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  deleteAdmin: async (id: string) => {
    return api.request(`/api/director/admins/${id}`, {
      method: 'DELETE'
    });
  },

  addDriverAccident: async (id: string, payload: any) => {
    return api.request(`/api/director/drivers/${id}/add-accident`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  addDriverRest: async (id: string, payload: any) => {
    return api.request(`/api/director/drivers/${id}/add-rest`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateShareholderStatus: async (id: string, payload: { status: string }) => {
    return api.request(`/api/director/shareholders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  updateShareholderInvestment: async (id: string, payload: { investment_amount: number }) => {
    return api.request(`/api/director/shareholders/${id}/investment`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Driver Payments
  getPayments: async (driverId = '') => {
    const query = driverId ? `?driverId=${encodeURIComponent(driverId)}` : '';
    return api.request(`/api/payments${query}`);
  },

  addPayment: async (payload: { driverId: string; amount: number; installmentNumber: number; outstandingAmount: number; date: string; receiptNumber: string; remarks?: string }) => {
    return api.request('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updatePaymentStatus: async (id: string, payload: { status: 'approved' | 'rejected'; remarks?: string }) => {
    return api.request(`/api/payments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  updatePayment: async (id: string, payload: { amount?: number; date?: string; receiptNumber?: string; remarks?: string }) => {
    return api.request(`/api/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  postShareholderWithdrawal: async (payload: { shareholderId: string; amount: number; remarks?: string }) => {
    return api.request('/api/finance/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  postShareholderReinvestment: async (payload: { shareholderId: string; amount: number }) => {
    return api.request('/api/finance/reinvest', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  postPayroll: async () => {
    return api.request('/api/finance/payroll', {
      method: 'POST'
    });
  },

  // Profile management & direct operations
  updateDriverProfileComplete: async (id: string, payload: { fullName?: string; phone?: string; address?: string; nin?: string; licenseNumber?: string; licenseExpiry?: string; agreedAmount?: number; remainingVehicleBalance?: number; status?: string }) => {
    return api.request(`/api/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  addExpenseDirect: async (payload: { amount: number; category: string; description: string; date: string; driverId?: string; receiptUrl?: string }) => {
    return api.request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateVehicle: async (id: string, payload: { brand?: string; model?: string; year?: number; colour?: string; plateNumber?: string; registrationNumber?: string; chassisNumber?: string; engineNumber?: string; capacity?: string; mileage?: number; status?: string; purchasePrice?: number; remainingBalance?: number }) => {
    return api.request(`/api/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Driver self & shareholder self operations
  updateSelfDriverProfile: async (payload: { phone?: string; email?: string; address?: string; password?: string }) => {
    return api.request('/api/drivers/self', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  getSelfDriverDocuments: async () => {
    return api.request('/api/drivers/self/documents');
  },

  getSelfShareholderData: async () => {
    return api.request('/api/shareholders/me');
  },

  getOperationsState: async () => {
    return api.request('/api/operations/state');
  },
  startOperations: async (payload?: { cycleId?: string }) => {
    return api.request('/api/operations/start', {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined
    });
  },
  pauseOperations: async (reason: string) => {
    return api.request('/api/operations/pause', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },
  resumeOperations: async (reason?: string) => {
    return api.request('/api/operations/resume', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },
  configSalaries: async (salaries: any[]) => {
    return api.request('/api/operations/config-salaries', {
      method: 'POST',
      body: JSON.stringify({ salaries })
    });
  },
  configWallet: async (balance: number) => {
    return api.request('/api/operations/config-wallet', {
      method: 'POST',
      body: JSON.stringify({ balance })
    });
  },
  configRules: async (payload: { rules_shareholder_configured?: boolean; rules_cycle_configured?: boolean; roles_configured?: boolean }) => {
    return api.request('/api/operations/config-rules', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
