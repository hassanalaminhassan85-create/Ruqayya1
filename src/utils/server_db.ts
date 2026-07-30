/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase Admin for persistent storage
export let firestore: any = null;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId || (firebaseConfig as any).databaseId;
  
  if (getApps().length === 0) {
    if (firebaseConfig && (firebaseConfig as any).projectId) {
      initializeApp({
        projectId: (firebaseConfig as any).projectId
      });
      console.log(`Initialized Firebase Admin with projectId: ${(firebaseConfig as any).projectId}`);
    } else {
      initializeApp();
    }
  }

  // Use the configured database ID
  if (dbId) {
    firestore = getFirestore(undefined, dbId);
    console.log(`Initialized with database: ${dbId}`);
  } else {
    firestore = getFirestore();
    console.log(`Initialized with default database`);
  }
} catch (e) {
  console.error("Firebase Admin initialization failed:", e);
}

const CLOUD_DB_COLLECTION = 'system_state';
const CLOUD_DB_DOC = 'main_database';

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
    companyAddress: "No. 38, Off Bolori Market Junction, Near Traffic Light, Baga Road, Maiduguri, Borno State, Nigeria",
    phone: "0701 020 4110 / 0706 963 0662",
    email: "muhdadam573@gmail.com",
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
let cachedDB: DBState | null = null;

export async function initCloudPersistence() {
  if (!firestore) return;
  try {
    const docRef = firestore.collection(CLOUD_DB_COLLECTION).doc(CLOUD_DB_DOC);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const cloudData = docSnap.data() as DBState;
      console.log('Successfully loaded database state from Firestore.');
      // Update local file and cache
      fs.writeFileSync(DB_FILE, JSON.stringify(cloudData, null, 2), 'utf8');
      cachedDB = cloudData;
    } else {
      console.log('No existing database state found in Firestore. Starting fresh.');
      // Save initial state to cloud
      const initialState = loadDB();
      await docRef.set(initialState);
    }
  } catch (err) {
    console.warn('Failed to initialize cloud persistence (relying on local storage):', err);
  }
}

export function loadDB(): DBState {
  if (cachedDB) return cachedDB;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data) as DBState;
      let changed = false;

      // Defensive initialization of collection nodes
      if (!parsed.cycles || parsed.cycles.length === 0) { parsed.cycles = [...INITIAL_DB_STATE.cycles]; changed = true; }
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

let dbChangeListeners: (() => void)[] = [];

export function setDBChangeListener(listener: () => void) {
  dbChangeListeners.push(listener);
}

export function saveDB(state: DBState): void {
  try {
    // Automatically recalculate Company Wallet balance
    if (state) {
      if (!state.company_settings) state.company_settings = {};
      if (state.company_settings.wallet_initial_amount === undefined) {
        state.company_settings.wallet_initial_amount = state.company_settings.wallet_balance !== undefined ? state.company_settings.wallet_balance : 0;
      }
      const totalRev = (state.financial_records || []).filter((f: any) => f.type === 'revenue').reduce((sum: number, f: any) => sum + f.amount, 0);
      const totalExp = (state.financial_records || []).filter((f: any) => f.type === 'expense').reduce((sum: number, f: any) => sum + f.amount, 0);
      state.company_settings.wallet_balance = (state.company_settings.wallet_initial_amount || 0) + totalRev - totalExp;
    }
    
    cachedDB = state;
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    
    // Fire-and-forget sync to cloud
    if (firestore) {
      firestore.collection(CLOUD_DB_COLLECTION).doc(CLOUD_DB_DOC).set(state).then(() => {
        console.log('Successfully synced database to Firestore.');
      }).catch((err: any) => {
        console.warn('Failed to sync database to Firestore (relying on local storage):', err.message, 'Code:', err.code);
        
        // Only fallback to the default database if the named database itself was NOT_FOUND (Code 5)
        if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
          const dbId = (firebaseConfig as any).firestoreDatabaseId || (firebaseConfig as any).databaseId;
          if (dbId && dbId !== '(default)') {
            console.warn('Named database not found. Falling back to default database for future syncs.');
            try {
              firestore = getFirestore();
            } catch (fallbackErr) {
              console.warn('Failed to fallback to default database:', fallbackErr);
            }
          }
        } else if (err.code === 7 || err.message?.includes('PERMISSION_DENIED')) {
          console.warn('PERMISSION_DENIED on Firestore named database. Switching to default database.');
          firestore = getFirestore(); // Switch to default
        }
      });
    }

    dbChangeListeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('Error in DB change listener:', err);
      }
    });
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Seed Initial Corporate Data if empty
export function seedDBIfEmpty() {
  const db = loadDB();
  let modified = false;

  // Check if there is old demo driver/vehicle data that needs to be wiped for a clean slate
  const hasDemoData = db.users.some(u => 
    u.email === 'musa.garba@ruqayyatransport.com' || 
    u.full_name === 'Alhaji Musa Garba' ||
    u.full_name?.includes('Ibrahim Bello')
  );

  if (hasDemoData) {
    console.log('Detected demo driver/vehicle data. Wiping database for fresh ready-to-start business...');
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
      { id: 'p5', name: 'view_audit_logs', description: 'Inspect corporate security records' },
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

  // 4. Seed Corporate Shareholders if empty
  if (!db.shareholders || db.shareholders.length === 0) {
    const kabirUserId = generateUUID();
    const aminaUserId = generateUUID();

    let kabirUser = db.users.find(u => u.username === 'KABIR' || u.email?.includes('kabir'));
    if (!kabirUser) {
      kabirUser = {
        id: kabirUserId,
        username: 'KABIR',
        email: 'kabir.m@ruqayyatransport.com',
        phone: '+234 803 555 0001',
        password_hash: hashPassword('shareholder123'),
        full_name: 'Alhaji Kabir Mohammed',
        role_id: 'role-shareholder',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      };
      db.users.push(kabirUser);
    }

    let aminaUser = db.users.find(u => u.username === 'AMINA' || u.email?.includes('amina'));
    if (!aminaUser) {
      aminaUser = {
        id: aminaUserId,
        username: 'AMINA',
        email: 'amina.g@ruqayyatransport.com',
        phone: '+234 803 555 0002',
        password_hash: hashPassword('shareholder123'),
        full_name: 'Hajiya Amina Garba',
        role_id: 'role-shareholder',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      };
      db.users.push(aminaUser);
    }

    db.shareholders = [
      {
        id: 'SH-2026-001',
        user_id: kabirUser.id,
        full_name: 'Alhaji Kabir Mohammed',
        fullName: 'Alhaji Kabir Mohammed',
        phone: '+234 803 555 0001',
        email: 'kabir.m@ruqayyatransport.com',
        address: 'Plot 12 Commercial Layout, Kano, Nigeria',
        investment_amount: 12000000,
        investmentAmount: 12000000,
        investment_date: '2026-01-15',
        investmentDate: '2026-01-15',
        passport_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
        passportPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
        ownership_percentage: 60,
        total_withdrawn: 0,
        total_reinvested: 0,
        created_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: 'SH-2026-002',
        user_id: aminaUser.id,
        full_name: 'Hajiya Amina Garba',
        fullName: 'Hajiya Amina Garba',
        phone: '+234 803 555 0002',
        email: 'amina.g@ruqayyatransport.com',
        address: 'No 45 GRA Maiduguri, Borno State, Nigeria',
        investment_amount: 8000000,
        investmentAmount: 8000000,
        investment_date: '2026-02-01',
        investmentDate: '2026-02-01',
        passport_photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
        passportPhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
        ownership_percentage: 40,
        total_withdrawn: 0,
        total_reinvested: 0,
        created_at: new Date().toISOString(),
        status: 'active'
      }
    ];

    modified = true;
  }

  if (!db.push_subscriptions || db.push_subscriptions.length === 0) {
    const defaultAdmin = db.users.find(u => u.username === 'ADAM');
    const adminUserId = defaultAdmin ? defaultAdmin.id : 'fb30b905-d662-4420-9e2e-96de9a017596';
    db.push_subscriptions = [
      {
        id: 'fallback-sub-admin',
        user_id: adminUserId,
        subscription: {
          endpoint: 'http://localhost:3000/api/notifications/fallback-push-endpoint',
          keys: {
            p256dh: 'placeholder-p256dh',
            auth: 'placeholder-auth'
          }
        },
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
