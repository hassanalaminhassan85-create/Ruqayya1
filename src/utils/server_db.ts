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
  financial_records: any[]; // legacy and current primary ledger source used across the app
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

  // New structured financial primitives (added for clearer accounting)
  financial_ledger?: any[]; // canonical ledger (future authoritative source)
  installments?: any[]; // structured installments for active cycles (per-driver, per-cycle, 6 items)
  expenses?: any[]; // categorized expenses
  payroll_runs?: any[]; // payroll run records
  payroll_items?: any[]; // items under payroll runs
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
  },

  // initialize new collections
  financial_ledger: [],
  installments: [],
  expenses: [],
  payroll_runs: [],
  payroll_items: []
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

      // New structured financial primitives initialization
      if (!parsed.financial_ledger) { parsed.financial_ledger = []; changed = true; }
      if (!parsed.installments) { parsed.installments = []; changed = true; }
      if (!parsed.expenses) { parsed.expenses = []; changed = true; }
      if (!parsed.payroll_runs) { parsed.payroll_runs = []; changed = true; }
      if (!parsed.payroll_items) { parsed.payroll_items = []; changed = true; }

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
      if (!state.company_settings) state.company_settings = {} as any;
      if (state.company_settings.wallet_initial_amount === undefined) {
        state.company_settings.wallet_initial_amount = state.company_settings.wallet_balance !== undefined ? state.company_settings.wallet_balance : 0;
      }

      // Primary canonical computation remains the financial_records array (backwards compatible).
      // New ledger entries should also push mirror entries into financial_records via helper createLedgerEntry to maintain consistency.
      const totalRev = (state.financial_records || []).filter((f: any) => f.type === 'revenue').reduce((sum: number, f: any) => sum + (parseFloat(f.amount) || 0), 0);
      const totalExp = (state.financial_records || []).filter((f: any) => f.type === 'expense').reduce((sum: number, f: any) => sum + (parseFloat(f.amount) || 0), 0);
      state.company_settings.wallet_balance = (state.company_settings.wallet_initial_amount || 0) + totalRev - totalExp;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
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

// --- New helper functions for financial operations ---

/**
 * Create a ledger transaction in the structured financial_ledger and mirror
 * the essential fields into financial_records for backward compatibility.
 */
export function createLedgerEntry(state: DBState, entry: {
  type: 'revenue' | 'expense' | 'transfer' | 'payroll' | 'dividend' | 'other';
  subtype?: string;
  amount: number;
  currency?: string;
  description?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  driver_id?: string;
  vehicle_id?: string;
  reference_id?: string; // payment/expense id
  created_by?: string;
  metadata?: any;
}) {
  const ledgerEntry = {
    id: `LEDGER-${Date.now()}-${generateUUID().substring(0, 6).toUpperCase()}`,
    type: entry.type,
    subtype: entry.subtype || 'generic',
    amount: parseFloat((entry.amount || 0).toString()),
    currency: entry.currency || (state.company_settings && state.company_settings.currency) || 'NGN',
    description: entry.description || '',
    related_entity_type: entry.related_entity_type || null,
    related_entity_id: entry.related_entity_id || null,
    driver_id: entry.driver_id || null,
    vehicle_id: entry.vehicle_id || null,
    reference_id: entry.reference_id || null,
    created_by: entry.created_by || 'system',
    metadata: entry.metadata || null,
    created_at: new Date().toISOString()
  };

  if (!state.financial_ledger) state.financial_ledger = [];
  state.financial_ledger.unshift(ledgerEntry);

  // Mirror into financial_records for legacy compatibility. Keep shape similar to existing records.
  const record = {
    id: ledgerEntry.id,
    type: entry.type,
    category: entry.subtype || 'other',
    amount: ledgerEntry.amount,
    date: new Date().toISOString().split('T')[0],
    description: ledgerEntry.description,
    approvedBy: ledgerEntry.created_by,
    related_entity_type: ledgerEntry.related_entity_type,
    related_entity_id: ledgerEntry.related_entity_id
  };

  state.financial_records.unshift(record);
  saveDB(state);

  return ledgerEntry;
}

/**
 * Generate 6 installments for a given driver and cycle according to the 30-day rule.
 * installments are 6 buckets covering days 1-5,6-10,...26-30 of the cycle.
 */
export function createInstallmentsForCycle(state: DBState, params: {
  cycle_id: string;
  driver_id: string;
  agreed_amount_30: number;
  cycle_start_date?: string; // ISO date string representing cycle start
}) {
  if (!state.installments) state.installments = [];

  const { cycle_id, driver_id, agreed_amount_30, cycle_start_date } = params;
  const baseAmount = parseFloat((agreed_amount_30 || 0).toString());
  const perInstallment = baseAmount / 6.0;

  // If installments for this driver and cycle already exist, return them
  const existing = state.installments.filter((i: any) => i.cycle_id === cycle_id && i.driver_id === driver_id);
  if (existing && existing.length === 6) return existing;

  // Generate installments
  const start = cycle_start_date ? new Date(cycle_start_date) : new Date();
  const installments: any[] = [];
  for (let k = 1; k <= 6; k++) {
    const startDay = (k - 1) * 5 + 1;
    const endDay = k * 5;
    const installmentStart = new Date(start.getTime() + (startDay - 1) * 24 * 3600 * 1000);
    const installmentEnd = new Date(start.getTime() + (endDay - 1) * 24 * 3600 * 1000);

    const inst = {
      id: `INST-${cycle_id}-${driver_id}-${k}`,
      cycle_id,
      driver_id,
      installment_number: k,
      start_date: installmentStart.toISOString().split('T')[0],
      end_date: installmentEnd.toISOString().split('T')[0],
      due_date: installmentEnd.toISOString().split('T')[0],
      amount_due: parseFloat(perInstallment.toFixed(2)),
      amount_paid: 0,
      remaining: parseFloat(perInstallment.toFixed(2)),
      status: 'DUE', // DUE | PARTIALLY_PAID | PAID | OVERDUE
      payment_history: [] as string[]
    };
    installments.push(inst);
    state.installments.unshift(inst);
  }

  saveDB(state);
  return installments;
}

/**
 * Apply a payment (driver payment record) to installments in chronological order.
 * This function mutates installments and records linkage to payment id.
 */
export function applyPaymentToInstallments(state: DBState, payment: {
  id: string;
  driver_id: string;
  amount: number;
  date?: string;
}) {
  if (!state.installments) state.installments = [];
  const amount = parseFloat((payment.amount || 0).toString());
  let remaining = amount;

  // Find installments for the active cycle(s) for this driver ordered by installment_number
  const driverInsts = (state.installments || [])
    .filter((i: any) => i.driver_id === payment.driver_id)
    .sort((a: any, b: any) => a.installment_number - b.installment_number);

  for (const inst of driverInsts) {
    if (remaining <= 0) break;
    const toPay = Math.min(inst.remaining || inst.amount_due - (inst.amount_paid || 0), remaining);
    if (toPay <= 0) continue;

    inst.amount_paid = (inst.amount_paid || 0) + toPay;
    inst.remaining = parseFloat(((inst.amount_due || 0) - inst.amount_paid).toFixed(2));
    inst.payment_history = inst.payment_history || [];
    inst.payment_history.push(payment.id);

    // Set status
    if (inst.remaining <= 0) inst.status = 'PAID';
    else if (inst.amount_paid > 0) inst.status = 'PARTIALLY_PAID';

    remaining = parseFloat((remaining - toPay).toString());
  }

  // If there's any leftover (overpayment), create a ledger entry as general revenue and leave it as credit
  if (remaining > 0) {
    createLedgerEntry(state, {
      type: 'revenue',
      subtype: 'overpayment_credit',
      amount: remaining,
      description: `Overpayment credit for driver ${payment.driver_id} (payment ${payment.id})`,
      driver_id: payment.driver_id,
      reference_id: payment.id,
      created_by: 'system'
    });
  }

  // Mirror payment into ledger as revenue
  createLedgerEntry(state, {
    type: 'revenue',
    subtype: 'driver_payment',
    amount: amount,
    description: `Driver payment recorded: ${payment.id}`,
    driver_id: payment.driver_id,
    reference_id: payment.id,
    created_by: 'system'
  });

  saveDB(state);
}

/**
 * Record a categorized expense and create ledger entry.
 */
export function recordExpense(state: DBState, expense: {
  id?: string;
  category: string;
  amount: number;
  date?: string;
  description?: string;
  driver_id?: string;
  vehicle_id?: string;
  created_by?: string;
  approved?: boolean;
}) {
  if (!state.expenses) state.expenses = [];
  const rec = {
    id: expense.id || `EXP-${Date.now()}-${generateUUID().substring(0,6).toUpperCase()}`,
    category: expense.category,
    amount: parseFloat((expense.amount || 0).toString()),
    date: expense.date || new Date().toISOString().split('T')[0],
    description: expense.description || '',
    driver_id: expense.driver_id || null,
    vehicle_id: expense.vehicle_id || null,
    created_by: expense.created_by || 'system',
    approved: expense.approved || false,
    created_at: new Date().toISOString()
  };

  state.expenses.unshift(rec);

  // When recording an expense that is to be paid by the company, create an OUT ledger entry
  createLedgerEntry(state, {
    type: 'expense',
    subtype: expense.category || 'other',
    amount: rec.amount,
    description: rec.description || `Expense ${rec.id}`,
    related_entity_type: expense.vehicle_id ? 'vehicle' : expense.driver_id ? 'driver' : null,
    related_entity_id: expense.vehicle_id || expense.driver_id || null,
    driver_id: expense.driver_id || null,
    vehicle_id: expense.vehicle_id || null,
    reference_id: rec.id,
    created_by: rec.created_by
  });

  saveDB(state);
  return rec;
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
    u.full_name === 'Alhaji Musa Garba' ||
    u.full_name === 'Alhaji Kabir Mohammed' ||
    u.full_name === 'Hajiya Amina Garba' ||
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
    db.financial_ledger = [];
    db.installments = [];
    db.expenses = [];
    db.payroll_runs = [];
    db.payroll_items = [];
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
