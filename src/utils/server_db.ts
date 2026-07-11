/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Password hashing helpers
export function hashPassword(password: string): string {
  const salt = 'ruqayya_erp_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const DB_FILE = path.join(STORAGE_DIR, 'db.json');
const R2_DIR = path.join(STORAGE_DIR, 'r2');

// Ensure storage directories exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(R2_DIR)) {
  fs.mkdirSync(R2_DIR, { recursive: true });
}

export interface DBState {
  users: any[];
  directors: any[];
  admins: any[];
  drivers: any[];
  shareholders: any[];
  guarantors: any[];
  vehicles: any[];
  vehicle_documents: any[];
  driver_documents: any[];
  company_documents: any[];
  sessions: any[];
  audit_logs: any[];
  notifications: any[];
  user_preferences: any[];
  roles: any[];
  permissions: any[];
  fuel_vouchers: any[];
  financial_records: any[];
  trip_manifests: any[];
  cycles: any[];
  driver_payments: any[];
  messages?: any[];
  announcements?: any[];
  company_settings: any;
  shareholder_settings: any;
}

const INITIAL_DB_STATE: DBState = {
  users: [],
  directors: [],
  admins: [],
  drivers: [],
  shareholders: [],
  guarantors: [],
  vehicles: [],
  vehicle_documents: [],
  driver_documents: [],
  company_documents: [],
  sessions: [],
  audit_logs: [],
  notifications: [],
  user_preferences: [],
  roles: [],
  permissions: [],
  fuel_vouchers: [],
  financial_records: [],
  trip_manifests: [],
  cycles: [],
  driver_payments: [],
  messages: [],
  announcements: [],
  company_settings: {
    companyName: "Ruqayya Transport Limited",
    companyLogo: "",
    companyAddress: "No 14 Zaria Road, Kano, Nigeria",
    phone: "+234 803 123 4567",
    email: "info@ruqayyatransport.com",
    currency: "₦",
    timeZone: "Africa/Lagos",
    languageDefault: "en",
    themeDefault: "light"
  },
  shareholder_settings: {
    distributionPercentage: 2
  }
};

// Global DB Load and Save
export function loadDB(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data) as DBState;
      let changed = false;

      // Defensive initialization of collection nodes
      if (!parsed.cycles) { parsed.cycles = []; changed = true; }
      if (!parsed.company_settings) { parsed.company_settings = { ...INITIAL_DB_STATE.company_settings }; changed = true; }
      if (!parsed.shareholder_settings) { parsed.shareholder_settings = { ...INITIAL_DB_STATE.shareholder_settings }; changed = true; }
      if (!parsed.trip_manifests) { parsed.trip_manifests = []; changed = true; }
      if (!parsed.users) { parsed.users = []; changed = true; }
      if (!parsed.directors) { parsed.directors = []; changed = true; }
      if (!parsed.admins) { parsed.admins = []; changed = true; }
      if (!parsed.drivers) { parsed.drivers = []; changed = true; }
      if (!parsed.shareholders) { parsed.shareholders = []; changed = true; }
      if (!parsed.vehicles) { parsed.vehicles = []; changed = true; }
      if (!parsed.audit_logs) { parsed.audit_logs = []; changed = true; }
      if (!parsed.notifications) { parsed.notifications = []; changed = true; }
      if (!parsed.fuel_vouchers) { parsed.fuel_vouchers = []; changed = true; }
      if (!parsed.financial_records) { parsed.financial_records = []; changed = true; }
      if (!parsed.driver_payments) { parsed.driver_payments = []; changed = true; }
      if (!parsed.messages) { parsed.messages = []; changed = true; }
      if (!parsed.announcements) { parsed.announcements = []; changed = true; }
      if (!parsed.vehicle_documents) { parsed.vehicle_documents = []; changed = true; }
      if (!parsed.driver_documents) { parsed.driver_documents = []; changed = true; }
      if (!parsed.company_documents) { parsed.company_documents = []; changed = true; }

      if (changed) {
        saveDB(parsed);
      }
      return parsed;
    }
  } catch (error) {
    console.error('Error loading database file, reinitializing:', error);
  }
  
  const state = { ...INITIAL_DB_STATE };
  saveDB(state);
  return state;
}

let dbChangeListener: (() => void) | null = null;

export function setDBChangeListener(listener: () => void) {
  dbChangeListener = listener;
}

export function saveDB(state: DBState): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    if (dbChangeListener) {
      dbChangeListener();
    }
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Seed Initial Corporate Data if empty
export function seedDBIfEmpty() {
  const db = loadDB();
  let modified = false;

  // 1. Seed Roles
  if (db.roles.length === 0) {
    db.roles = [
      { id: 'role-director', name: 'director', description: 'Executive Boardroom Director', created_at: new Date().toISOString(), status: 'active' },
      { id: 'role-admin', name: 'admin', description: 'Operations Control Center Admin', created_at: new Date().toISOString(), status: 'active' },
      { id: 'role-driver', name: 'driver', description: 'Logistics Fleet Driver', created_at: new Date().toISOString(), status: 'active' },
      { id: 'role-shareholder', name: 'shareholder', description: 'Corporate Capital Investor', created_at: new Date().toISOString(), status: 'active' }
    ];
    modified = true;
  }

  // 2. Seed Permissions
  if (db.permissions.length === 0) {
    db.permissions = [
      { id: 'p1', name: 'view_director_dashboard', description: 'View executive metrics' },
      { id: 'p2', name: 'approve_drivers', description: 'Approve or reject new driver registrations' },
      { id: 'p3', name: 'manage_financials', description: 'Access and modify general ledger records' },
      { id: 'p4', name: 'approve_vouchers', description: 'Approve driver fuel allocation vouchers' },
      { id: 'p5', name: 'view_audit_logs', description: 'Inspect corporate security records' },
      { id: 'p6', name: 'request_vouchers', description: 'Submit fuel purchase requests' }
    ];
    modified = true;
  }

  // 3. Seed Users & Profiles (Director, Admin, Driver, Shareholder)
  if (db.users.length === 0) {
    const directorId = generateUUID();
    const adminId = generateUUID();
    const driverUserId = generateUUID();

    // Users
    db.users = [
      {
        id: directorId,
        email: 'director@ruqayyatransport.com',
        phone: '+234 803 111 0001',
        password_hash: hashPassword('director123'),
        full_name: 'Director Kabir Mohammed',
        role_id: 'role-director',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: adminId,
        email: 'admin@ruqayyatransport.com',
        phone: '+234 803 222 0002',
        password_hash: hashPassword('admin123'),
        full_name: 'Operator Ibrahim Bello',
        role_id: 'role-admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: driverUserId,
        email: 'musa.garba@ruqayyatransport.com',
        phone: '+234 803 123 4567',
        password_hash: hashPassword('driver123'),
        full_name: 'Alhaji Musa Garba',
        role_id: 'role-driver',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: generateUUID(),
        email: 'kabir.m@ruqayyatransport.com',
        phone: '+234 803 777 0001',
        password_hash: hashPassword('shareholder123'),
        full_name: 'Alhaji Kabir Mohammed',
        role_id: 'role-shareholder',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: generateUUID(),
        email: 'amina.g@ruqayyatransport.com',
        phone: '+234 806 444 1111',
        password_hash: hashPassword('shareholder123'),
        full_name: 'Hajiya Amina Garba',
        role_id: 'role-shareholder',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      }
    ];

    // Director profile
    db.directors = [
      {
        id: generateUUID(),
        user_id: directorId,
        company_id: 'DIR-2026-001',
        passport_photo_url: '',
        created_at: new Date().toISOString(),
        status: 'active'
      }
    ];

    // Admin profile
    db.admins = [
      {
        id: generateUUID(),
        user_id: adminId,
        company_id: 'ADM-2026-001',
        passport_photo_url: '',
        created_at: new Date().toISOString(),
        status: 'active'
      }
    ];

    // Driver profile
    const driverId = generateUUID();
    db.drivers = [
      {
        id: driverId,
        user_id: driverUserId,
        company_driver_id: 'DRV-2026-001',
        address: '14 Zaria Road, Kano, Nigeria',
        nin: '12345678901',
        license_number: 'NGA-DL-882103',
        license_expiry: '2028-11-12',
        classification: 'Smart',
        rating: 4.8,
        created_at: new Date().toISOString(),
        status: 'approved',
        agreed_amount: 180000,
        remaining_vehicle_balance: 14700000,
        restHistory: []
      }
    ];

    // Seed Operational Cycles
    db.cycles = [
      {
        id: 'CYC-2026-8941',
        startDate: '2026-05-01',
        endDate: '2026-05-30',
        status: 'completed',
        locked: true,
        metrics: {
          totalRevenue: 28450000,
          totalExpenses: 11450000,
          netGeneratedAmount: 17000000,
          distributionPercentage: 2,
          distributionPool: 340000,
          driverCollections: 18000000,
          driverPerformance: 98.4,
          activeDrivers: 3,
          totalFleetCount: 4
        }
      },
      {
        id: 'CYC-2026-7740',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        status: 'completed',
        locked: true,
        metrics: {
          totalRevenue: 31500000,
          totalExpenses: 12100000,
          netGeneratedAmount: 19400000,
          distributionPercentage: 2,
          distributionPool: 388000,
          driverCollections: 21000000,
          driverPerformance: 99.1,
          activeDrivers: 3,
          totalFleetCount: 4
        }
      },
      {
        id: 'CYC-2026-ACTIVE',
        startDate: '2026-07-01',
        endDate: '',
        status: 'active',
        locked: false,
        endGoalTons: 200
      },
      {
        id: 'CYC-2026-SCHED',
        startDate: '2026-08-01',
        endDate: '',
        status: 'upcoming',
        locked: false,
        endGoalTons: 250
      }
    ];

    // Seed Driver Payments towards installments
    db.driver_payments = [
      {
        id: generateUUID(),
        driver_id: driverId,
        amount: 30000,
        installment_number: 1,
        receipt_number: 'RCP-2026-0001',
        date: '2026-07-03',
        remarks: 'Installment 1 Payment',
        status: 'approved',
        approved_by: 'Super Admin',
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        driver_id: driverId,
        amount: 30000,
        installment_number: 2,
        receipt_number: 'RCP-2026-0002',
        date: '2026-07-06',
        remarks: 'Installment 2 Payment',
        status: 'approved',
        approved_by: 'Super Admin',
        created_at: new Date().toISOString()
      }
    ];

    // Guarantor profile
    db.guarantors = [
      {
        id: generateUUID(),
        driver_id: driverId,
        full_name: 'Alhaji Garba Haruna',
        phone: '+234 803 999 1111',
        address: '22 Airport Road, Kano',
        relationship: 'Uncle',
        nin: '98765432101',
        passport_photo_url: '',
        created_at: new Date().toISOString(),
        status: 'active'
      }
    ];

    // Vehicles
    db.vehicles = [
      {
        id: generateUUID(),
        driver_id: driverId,
        brand: 'Mercedes-Benz',
        model: 'Actros 3340 Heavy Rig',
        year: 2021,
        colour: 'Polar White',
        plate_number: 'KANO-432-KN',
        registration_number: 'REG-MB-9921',
        chassis_number: 'WDB9340321K00912',
        engine_number: 'OM501LA-234291',
        capacity: '30 Tons',
        mileage: 124500,
        last_service_date: '2026-06-15',
        created_at: new Date().toISOString(),
        status: 'assigned'
      },
      {
        id: generateUUID(),
        driver_id: null,
        brand: 'Volvo',
        model: 'FH16 Globetrotter',
        year: 2022,
        colour: 'Metallic Blue',
        plate_number: 'LAG-981-LA',
        registration_number: 'REG-VV-1182',
        chassis_number: 'YV2RT40D3EA01198',
        engine_number: 'D16G750-103942',
        capacity: '45 Tons',
        mileage: 98120,
        last_service_date: '2026-05-20',
        created_at: new Date().toISOString(),
        status: 'idle'
      },
      {
        id: generateUUID(),
        driver_id: null,
        brand: 'DAF',
        model: 'XF 105 Heavy Hauler',
        year: 2020,
        colour: 'Bright Yellow',
        plate_number: 'ABJ-231-AB',
        registration_number: 'REG-DF-5521',
        chassis_number: 'XLRTE105M0E99312',
        engine_number: 'MX340U1-443912',
        capacity: '40 Tons',
        mileage: 145900,
        last_service_date: '2026-06-01',
        created_at: new Date().toISOString(),
        status: 'idle'
      }
    ];

    // Shareholders seed data
    db.shareholders = [
      {
        id: generateUUID(),
        full_name: 'Alhaji Kabir Mohammed',
        phone: '+234 803 777 0001',
        email: 'kabir.m@ruqayyatransport.com',
        address: '5 Hotoro GRA, Kano',
        passport_photo_url: '',
        investment_amount: 150000000.0, // 150 Million Naira
        investment_date: '2026-01-10',
        created_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: generateUUID(),
        full_name: 'Hajiya Amina Garba',
        phone: '+234 806 444 1111',
        email: 'amina.g@ruqayyatransport.com',
        address: '18 Gwarimpa, Abuja',
        passport_photo_url: '',
        investment_amount: 75000000.0, // 75 Million Naira
        investment_date: '2026-03-15',
        created_at: new Date().toISOString(),
        status: 'active'
      }
    ];

    // Seed Fuel Vouchers
    db.fuel_vouchers = [
      {
        id: generateUUID(),
        voucher_number: 'FL-2026-7781',
        vehicle_id: 'V-001',
        driver_id: driverId,
        liters_requested: 450,
        estimated_cost: 652500,
        status: 'approved',
        request_date: '2026-07-05 14:00',
        approval_date: '2026-07-05 15:30',
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        voucher_number: 'FL-2026-7782',
        vehicle_id: 'V-002',
        driver_id: driverId,
        liters_requested: 600,
        estimated_cost: 870000,
        status: 'pending',
        request_date: '2026-07-07 09:00',
        created_at: new Date().toISOString()
      }
    ];

    // Seed Ledger Records
    db.financial_records = [
      { id: generateUUID(), type: 'revenue', category: 'freight', amount: 1950000, date: '2026-06-30', description: 'Remittance contract completion - Kaduna to Maiduguri Corridor' },
      { id: generateUUID(), type: 'expense', category: 'fuel', amount: 652500, date: '2026-07-05', description: 'Fuel Voucher FL-2026-7781 authorized disbursement', approvedBy: 'Operator Ibrahim' },
      { id: generateUUID(), type: 'expense', category: 'maintenance', amount: 320000, date: '2026-07-01', description: 'Engine hydraulic seals restoration - V-001' },
      { id: generateUUID(), type: 'revenue', category: 'freight', amount: 3500000, date: '2026-07-02', description: 'Corporate remittance contract downpayment - BUA Cement Group' }
    ];

    // Seed Notifications
    db.notifications = [
      {
        id: generateUUID(),
        title_en: 'New Driver Self-Registration',
        title_ha: 'Rijistar Sabon Direba',
        message_en: 'Candidate Alhaji Musa Garba completed driver self-registration. Action required: Approve credentials.',
        message_ha: 'Alhaji Musa Garba ya kammala rajistar kansa. Ana bukatar amincewa daga Admin.',
        type: 'warning',
        read_status: 0,
        created_at: new Date().toISOString()
      }
    ];

    // Seed System Setup Log
    db.audit_logs = [
      {
        id: `AUD-${Date.now()}-SETUP`,
        user_id: null,
        user_email: 'system',
        user_role: 'public',
        action: 'SYSTEM_BOOTSTRAP',
        previous_value: null,
        new_value: 'D1 Relational DB initialized with default Director and Admin accounts',
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      }
    ];

    modified = true;
  }

  if (modified) {
    saveDB(db);
    console.log('Database seeded with standard operational parameters.');
  }
}

// R2 Storage Upload helper
export function saveR2File(fileName: string, base64Content: string): string {
  try {
    const fileId = `${Date.now()}-${generateUUID().substring(0, 8)}`;
    const extension = path.extname(fileName) || '.png';
    const savedName = `${fileId}${extension}`;
    const filePath = path.join(R2_DIR, savedName);
    
    // Parse base64
    const cleanBase64 = base64Content.replace(/^data:.*?;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
    
    // Return relative preview path
    return `/api/documents/preview/${savedName}`;
  } catch (err) {
    console.error('Failed saving to R2 emulation directory:', err);
    throw err;
  }
}

export function getR2FilePath(savedName: string): string {
  return path.join(R2_DIR, savedName);
}
