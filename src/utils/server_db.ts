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
  push_subscriptions?: any[];
  vapid_keys?: { publicKey: string; privateKey: string } | null;
  company_settings: any;
  shareholder_settings: any;
  company_operations_state?: any;
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
  push_subscriptions: [],
  vapid_keys: null,
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
  },
  company_operations_state: {
    status: 'Setup Mode',
    currentCycle: '',
    currentDay: 1,
    startedBy: null,
    startedAt: null,
    pauseHistory: [],
    auditLog: []
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
      if (!parsed.company_operations_state) { parsed.company_operations_state = { ...INITIAL_DB_STATE.company_operations_state }; changed = true; }
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
      if (!parsed.push_subscriptions) { parsed.push_subscriptions = []; changed = true; }
      if (parsed.vapid_keys === undefined) { parsed.vapid_keys = null; changed = true; }

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

  // Check if there is existing demo data that needs to be wiped for a clean slate
  const hasDemoData = db.users.some(u => 
    u.email === 'musa.garba@ruqayyatransport.com' || 
    u.email === 'kabir.m@ruqayyatransport.com' ||
    u.email === 'amina.g@ruqayyatransport.com' ||
    u.full_name?.includes('Kabir') ||
    u.full_name?.includes('Musa') ||
    u.full_name?.includes('Ibrahim Bello')
  );

  if (hasDemoData) {
    console.log('Detected demo data. Wiping database for fresh ready-to-start business...');
    db.users = [];
    db.directors = [];
    db.admins = [];
    db.drivers = [];
    db.shareholders = [];
    db.guarantors = [];
    db.vehicles = [];
    db.vehicle_documents = [];
    db.driver_documents = [];
    db.company_documents = [];
    db.sessions = [];
    db.audit_logs = [];
    db.notifications = [];
    db.fuel_vouchers = [];
    db.financial_records = [];
    db.trip_manifests = [];
    db.cycles = [];
    db.driver_payments = [];
    db.messages = [];
    db.announcements = [];
    db.push_subscriptions = [];
    modified = true;
  }

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

  // 3. Seed Users & Profiles (Director, Admin - with clean generic titles/names)
  if (db.users.length === 0) {
    const directorId = generateUUID();
    const adminId = generateUUID();

    // Users (Clean startup accounts, removing demo names)
    db.users = [
      {
        id: directorId,
        username: 'MMR',
        email: 'director@ruqayyatransport.com',
        phone: '+234 803 111 0001',
        password_hash: hashPassword('director123'),
        full_name: 'Executive Director MMR',
        role_id: 'role-director',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: adminId,
        username: 'ADAM',
        email: 'admin@ruqayyatransport.com',
        phone: '+234 803 222 0002',
        password_hash: hashPassword('admin123'),
        full_name: 'Operations Admin ADAM',
        role_id: 'role-admin',
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

    // Clean initial audit log
    db.audit_logs = [
      {
        id: `AUD-${Date.now()}-SETUP`,
        user_id: null,
        user_email: 'system',
        user_role: 'public',
        action: 'SYSTEM_BOOTSTRAP',
        previous_value: null,
        new_value: 'Clean ERP system initialized. Database is fresh and ready for operations.',
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      }
    ];

    modified = true;
  }

  if (modified) {
    saveDB(db);
    console.log('Database seeded with standard fresh operational parameters.');
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
