/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'public' | 'driver' | 'admin' | 'director' | 'shareholder';
export type Language = 'en' | 'ha';
export type Theme = 'light' | 'dark';

// Fleet & Vehicle Data Types
export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  status: 'active' | 'maintenance' | 'idle' | 'assigned';
  fuelType: 'diesel' | 'petrol' | 'gas';
  capacity: string;
  driverId?: string;
  lastServiceDate: string;
  mileage: number;
}

// Driver Data Types
export interface Driver {
  id: string;
  fullName: string;
  licenseNumber: string;
  licenseExpiry: string;
  phone: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'correction_requested' | 'available' | 'on-trip' | 'off-duty' | 'suspended';
  assignedVehicleId?: string;
  rating: number;
  company_driver_id?: string;
  address?: string;
  nin?: string;
  guarantor?: {
    fullName: string;
    phone: string;
    address: string;
    relationship: string;
    nin: string;
    passportPhotoUrl?: string;
  };
  vehicle?: {
    id?: string;
    brand: string;
    model: string;
    year: number;
    colour: string;
    plateNumber: string;
    registrationNumber: string;
    chassisNumber: string;
    engineNumber: string;
    capacity: string;
  };
  documents?: Array<{
    id: string;
    document_type: string;
    file_url: string;
    created_at: string;
  }>;
}

// Daily Remittance & Collection Data Types
export interface DailyRemittance {
  id: string;
  remittanceNumber: string;
  vehicleId: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: string;
  expectedArrivalTime: string;
  status: 'scheduled' | 'loading' | 'in-transit' | 'delivered' | 'cancelled';
  tricycleType: string;
  remittanceCount: number;
  remittanceAmount: number;
}

// Financial Record
export interface FinancialRecord {
  id: string;
  type: 'revenue' | 'expense';
  category: 'remittance' | 'fuel' | 'maintenance' | 'salary' | 'tax' | 'dividend' | 'other';
  amount: number;
  date: string;
  referenceId?: string;
  description: string;
  approvedBy?: string;
}

// Fuel Voucher Request
export interface FuelVoucher {
  id: string;
  voucherNumber: string;
  vehicleId: string;
  driverId: string;
  litersRequested: number;
  estimatedCost: number;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  approvalDate?: string;
}

// Audit Log Entry
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userRole: Role;
  action: string;
  details: string;
  ipAddress: string;
}

// Notification
export interface AppNotification {
  id: string;
  titleEn: string;
  titleHa: string;
  messageEn: string;
  messageHa: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'danger';
}

// Shareholder
export interface Shareholder {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  passport_photo_url?: string;
  investment_amount: number;
  investment_date: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  status?: string;
  total_withdrawn?: number;
  total_reinvested?: number;
}

// I18n translations type structure
export interface Dictionary {
  landing: {
    heroTitle: string;
    heroSubtitle: string;
    servicesTitle: string;
    servicesSubtitle: string;
    aboutTitle: string;
    aboutText: string;
    statsDrivers: string;
    statsVehicles: string;
    statsCollections: string;
    statsCoverage: string;
    whyChooseUs: string;
    contactUs: string;
    footerText: string;
    driverLogin: string;
    driverRegister: string;
    portalNotice: string;
  };
  sidebar: {
    dashboard: string;
    fleet: string;
    drivers: string;
    remittances: string;
    finance: string;
    vouchers: string;
    auditLogs: string;
    settings: string;
  };
  roles: {
    driver: string;
    admin: string;
    director: string;
    shareholder: string;
    public: string;
  };
  common: {
    search: string;
    notifications: string;
    language: string;
    theme: string;
    logout: string;
    loading: string;
    save: string;
    cancel: string;
    submit: string;
    actions: string;
    status: string;
    date: string;
    back: string;
    close: string;
    confirm: string;
    details: string;
  };
  forms: {
    fullName: string;
    email: string;
    phone: string;
    licenseNo: string;
    vehicleNo: string;
    plateNumber: string;
    model: string;
    capacity: string;
    requiredField: string;
    invalidEmail: string;
    successSubmit: string;
  };
}
