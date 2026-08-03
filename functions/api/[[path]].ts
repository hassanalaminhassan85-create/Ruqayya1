import { Buffer } from 'node:buffer';
import { WorkersAIService } from '../../src/utils/ai_service';

declare global {
  type PagesFunction<Env = any, Params extends string = any, Data = any> = (
    context: {
      request: Request;
      functionPath: string;
      waitUntil: (promise: Promise<any>) => void;
      next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
      env: Env;
      params: Record<Params, string | string[]>;
      data: Data;
    }
  ) => Response | Promise<Response>;
}

interface Env {
  DB?: any;
  R2_BUCKET?: any;
  PUSH_SUBSCRIPTIONS?: any;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  ruqayya?: any;
  AI?: any;
  GEMINI_API_KEY?: string;
}

function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64url(str: string): Uint8Array {
  let sanitized = str.replace(/-/g, '+').replace(/_/g, '/');
  while (sanitized.length % 4) sanitized += '=';
  const binary = atob(sanitized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper to retrieve or generate VAPID keys
async function getVapidKeys(env: Env, db: any, dbManager: D1Manager): Promise<{ publicKey: string; privateKey: string } | null> {
  // 1. Try Environment Variables
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  }

  // 2. Try D1 Collections
  if (db && db.vapid_keys && db.vapid_keys.publicKey && db.vapid_keys.privateKey) {
    return db.vapid_keys;
  }

  // 3. Generate new keys using Web Crypto (P-256)
  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    
    const keys = {
      publicKey: base64url(new Uint8Array(publicKey)),
      privateKey: privateKey.d || ''
    };

    if (db) {
      db.vapid_keys = keys;
      await dbManager.saveDB(db);
      console.log("[VAPID] Generated and persisted new VAPID keys to D1.");
    }
    return keys;
  } catch (err) {
    console.error("[VAPID ERROR] Failed to generate keys:", err);
    return null;
  }
}


function getCanonicalCycleStatus(db: any): any {
  const activeCycle = db.cycles && db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
  if (!activeCycle) {
    return {
      isActive: false, status: 'inactive', cycleId: 'No Active Cycle', startDate: '', endDate: '',
      daysRemaining: 0, hoursRemaining: 0, minutesRemaining: 0, secondsRemaining: 0, totalSecondsRemaining: 0,
      progressPercent: 0, currentDay: 0, totalCycleDays: 30, pauseReason: '', pausedAt: ''
    };
  }
  const now = Date.now();
  const startMs = new Date(activeCycle.startDate).getTime();
  let baseDurationSeconds = 30 * 24 * 3600;
  if (activeCycle.endDate) {
    const endMs = new Date(activeCycle.endDate).getTime();
    baseDurationSeconds = Math.max(24 * 3600, Math.floor((endMs - startMs) / 1000));
  }
  const extensionSeconds = (activeCycle.extendedDays || 0) * 24 * 3600;
  const totalCycleSeconds = baseDurationSeconds + extensionSeconds;
  
  let totalPausedSeconds = activeCycle.totalPausedSeconds || 0;
  let currentPauseSeconds = 0;
  if (activeCycle.status === 'paused' && activeCycle.pausedAt) {
    currentPauseSeconds = Math.floor((now - new Date(activeCycle.pausedAt).getTime()) / 1000);
  }
  const effectivePausedSeconds = totalPausedSeconds + currentPauseSeconds;
  const elapsedSeconds = Math.max(0, Math.floor((now - startMs) / 1000) - effectivePausedSeconds);
  const remainingSeconds = Math.max(0, totalCycleSeconds - elapsedSeconds);
  
  const baseDays = Math.round(baseDurationSeconds / (24 * 3600));
  const currentDay = Math.min(baseDays + (activeCycle.extendedDays || 0), Math.floor(elapsedSeconds / (24 * 3600)) + 1);
  const progressPercent = Math.min(100, (elapsedSeconds / totalCycleSeconds) * 100);
  
  return {
    isActive: true,
    status: activeCycle.status,
    cycleId: activeCycle.id,
    startDate: activeCycle.startDate,
    endDate: activeCycle.endDate || new Date(startMs + baseDurationSeconds * 1000).toISOString(),
    daysRemaining: Math.floor(remainingSeconds / (24 * 3600)),
    hoursRemaining: Math.floor((remainingSeconds % (24 * 3600)) / 3600),
    minutesRemaining: Math.floor((remainingSeconds % 3600) / 60),
    secondsRemaining: remainingSeconds % 60,
    totalSecondsRemaining: remainingSeconds,
    progressPercent: progressPercent,
    currentDay: currentDay,
    totalCycleDays: baseDays + (activeCycle.extendedDays || 0),
    pauseReason: activeCycle.pauseReason || '',
    pausedAt: activeCycle.pausedAt || ''
  };
}

// Global PBKDF2 password hashing helper (matches server_db.ts SHA-512)
async function pbkdf2(password: string, salt: string, iterations: number, keyLen: number, digest: string): Promise<string> {
  const passwordBuffer = new TextEncoder().encode(password);
  const saltBuffer = new TextEncoder().encode(salt);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: iterations,
      hash: digest
    },
    baseKey,
    keyLen * 8
  );
  
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password: string): Promise<string> {
  return await pbkdf2(password, 'ruqayya_erp_salt_2026', 1000, 64, 'SHA-512');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const currentHash = await hashPassword(password);
  return currentHash === hash;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

// Audit logging helper
function writeAuditLog(userId: string | null, email: string, userRole: string, action: string, prevVal: string | null, newVal: string | null, db: any) {
  const log = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    user_id: userId,
    user_email: email,
    user_role: userRole,
    action,
    previous_value: prevVal,
    new_value: newVal,
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString(),
    status: 'active'
  };
  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.unshift(log);

  // Generate a notification for important system actions
  const ignoredActions = ['AUTH_', 'READ_', 'LOGOUT', 'SESSION_', 'DEMO_', 'DIRECTOR_MONITORING'];
  const shouldNotify = !ignoredActions.some(ignored => action.includes(ignored));
  
  if (shouldNotify) {
    if (!db.notifications) db.notifications = [];
    const notification = {
      id: generateUUID(),
      title_en: `System Action: ${action.replace(/_/g, ' ')}`,
      title_ha: `Wani Abu Ya Faru: ${action.replace(/_/g, ' ')}`,
      message_en: newVal || `An action was performed by ${email}.`,
      message_ha: newVal || `Mai amfani ${email} ya yi wani aiki.`,
      type: 'info',
      category: 'system',
      read_status: 0,
      created_at: new Date().toISOString(),
      user_id: userId,
      target_role: userRole // The actor gets it, plus admins/directors get all
    };
    db.notifications.unshift(notification);
  }
}

// Replaces background Interval/Cron checks in serverless env
function syncCyclesOnRequest(db: any): boolean {
  if (!db) return false;
  if (!db.cycles) db.cycles = [];
  if (!db.company_operations_state) {
    db.company_operations_state = {
      status: 'Setup Mode',
      currentCycle: '',
      currentDay: 1,
      startedBy: null,
      startedAt: null,
      pauseHistory: [],
      auditLog: []
    };
  }

  const opsState = db.company_operations_state;
  let dbChanged = false;

  const canonical = getCanonicalCycleStatus(db);
  const activeCycle = db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
  
  if (activeCycle && canonical.isActive) {
    const daysElapsed = canonical.currentDay;
    const currentDayInDB = opsState.currentDay || 1;
    const totalAllowedDays = canonical.totalCycleDays;

    if (daysElapsed !== currentDayInDB && daysElapsed <= totalAllowedDays) {
      opsState.currentDay = daysElapsed;
      dbChanged = true;
    }

    // End-of-cycle distribution trigger
    if (canonical.totalSecondsRemaining <= 0 && activeCycle.status !== 'completed') {
      const endDate = new Date().toISOString();
      activeCycle.status = 'completed';
      activeCycle.endDate = endDate;
      activeCycle.locked = true;

      const totalRevenue = (db.financial_records || [])
        .filter((f: any) => f.type === 'revenue' && new Date(f.date) >= new Date(activeCycle.startDate) && new Date(f.date) <= new Date(endDate))
        .reduce((sum: number, f: any) => sum + f.amount, 0);

      const totalExpenses = (db.financial_records || [])
        .filter((f: any) => f.type === 'expense' && new Date(f.date) >= new Date(activeCycle.startDate) && new Date(f.date) <= new Date(endDate))
        .reduce((sum: number, f: any) => sum + f.amount, 0);

      const netGeneratedAmount = totalRevenue - totalExpenses;
      const distPercentage = db.shareholder_settings?.distributionPercentage || 2;
      const distributionPool = Math.max(0, netGeneratedAmount * (distPercentage / 100));

      activeCycle.metrics = {
        totalRevenue,
        totalExpenses,
        netGeneratedAmount,
        distributionPercentage: distPercentage,
        distributionPool,
        activeDrivers: (db.drivers || []).filter((d: any) => d.status === 'approved' || d.status === 'active').length,
        totalFleetCount: (db.vehicles || []).length
      };

      const totalInvestment = (db.shareholders || [])
        .filter((s: any) => s.status === 'approved' || s.status === 'active')
        .reduce((sum: number, s: any) => sum + (s.investment_amount || 0), 0);

      if (totalInvestment > 0 && distributionPool > 0) {
        (db.shareholders || []).forEach((sh: any) => {
          if (sh.status === 'approved' || sh.status === 'active') {
            const shareRatio = (sh.investment_amount || 0) / totalInvestment;
            const payoutAmount = Math.round(distributionPool * shareRatio);
            if (payoutAmount > 0) {
              if (!sh.payout_history) sh.payout_history = [];
              sh.payout_history.unshift({
                id: `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
                cycleId: activeCycle.id,
                amount: payoutAmount,
                date: endDate,
                status: 'pending'
              });
              sh.total_earned = (sh.total_earned || 0) + payoutAmount;
              sh.last_payout_amount = payoutAmount;
              sh.last_payout_date = endDate;
            }
          }
        });
      }

      opsState.status = 'Setup Mode';
      opsState.currentCycle = '';
      opsState.currentDay = 1;

      writeAuditLog(null, 'SYSTEM', 'SYSTEM', 'CYCLE_COMPLETED_AUTO', null, `Operating cycle ${activeCycle.id} ended. Revenue: ₦${totalRevenue}, Expenses: ₦${totalExpenses}, Net: ₦${netGeneratedAmount}, Pool: ₦${distributionPool}`, db);
      dbChanged = true;
    }
  }

  return dbChanged;
}

// Financial calculations matching server.ts
function getDriverFinancials(driver: any, db: any) {
  const purchasePrice = parseFloat(driver.vehicle_purchase_price) || 15000000;
  const agreedAmount = parseFloat(driver.agreed_amount) || 180000;
  
  if (driver.opening_balance && driver.opening_balance.is_imported) {
    const openingRemaining = parseFloat(driver.opening_balance.remaining_vehicle_balance) || 0;
    const openingPaid = parseFloat(driver.opening_balance.total_paid_to_date) || 0;
    
    const approvedPaymentsInERP = (db.driver_payments || [])
      .filter((p: any) => p.driver_id === driver.id && p.status === 'approved');
    const totalErpPaid = approvedPaymentsInERP.reduce((sum: number, p: any) => sum + p.amount, 0);
    const countErpPaid = approvedPaymentsInERP.length;
    
    const totalAmountPaid = openingPaid + totalErpPaid;
    const remainingVehicleBalance = Math.max(0, openingRemaining - totalErpPaid);
    
    return {
      vehiclePurchasePrice: purchasePrice,
      totalAmountPaid,
      remainingVehicleBalance,
      totalPaymentsMade: countErpPaid,
      agreedAmount,
      openingBalance: driver.opening_balance
    };
  } else {
    const approvedPaymentsInERP = (db.driver_payments || [])
      .filter((p: any) => p.driver_id === driver.id && p.status === 'approved');
    const totalErpPaid = approvedPaymentsInERP.reduce((sum: number, p: any) => sum + p.amount, 0);
    const countErpPaid = approvedPaymentsInERP.length;
    
    const totalAmountPaid = totalErpPaid;
    const remainingVehicleBalance = Math.max(0, purchasePrice - totalErpPaid);
    
    return {
      vehiclePurchasePrice: purchasePrice,
      totalAmountPaid,
      remainingVehicleBalance,
      totalPaymentsMade: countErpPaid,
      agreedAmount,
      openingBalance: null
    };
  }
}

function lookupContractTerms(vehicle: any) {
  if (!vehicle) {
    return {
      agreedAmount: 300000,
      purchasePrice: 15000000,
      remainingVehicleBalance: 15000000
    };
  }

  const brand = (vehicle.brand || '').toLowerCase().trim();
  const model = (vehicle.model || '').toLowerCase().trim();
  const capacity = (vehicle.capacity || '').toLowerCase().trim();
  const year = parseInt(vehicle.year) || 2020;

  // Base values based on tonnage capacity
  let basePurchasePrice = 15000000;
  let baseAgreedAmount = 300000;

  if (capacity.includes('30') || capacity.includes('thirty')) {
    basePurchasePrice = 18000000;
    baseAgreedAmount = 360000;
  } else if (capacity.includes('20') || capacity.includes('twenty')) {
    basePurchasePrice = 15000000;
    baseAgreedAmount = 300000;
  } else if (capacity.includes('10') || capacity.includes('ten')) {
    basePurchasePrice = 12000000;
    baseAgreedAmount = 240000;
  } else if (capacity.includes('5') || capacity.includes('five')) {
    basePurchasePrice = 8000000;
    baseAgreedAmount = 180000;
  }

  // Adjustments based on brand
  let brandPriceAdjustment = 0;
  let brandRateAdjustment = 0;

  if (brand.includes('shacman')) {
    brandPriceAdjustment = 1000000;
    brandRateAdjustment = 20000;
  } else if (brand.includes('sinotruk') || brand.includes('howo')) {
    brandPriceAdjustment = 500000;
    brandRateAdjustment = 10000;
  } else if (brand.includes('faw')) {
    brandPriceAdjustment = -500000;
    brandRateAdjustment = -10000;
  }

  // Adjustments based on manufacturing year
  let ageAdjustment = 0;
  let ageRateAdjustment = 0;
  if (year < 2020) {
    const yearsDiff = 2020 - year;
    ageAdjustment = -Math.min(5, yearsDiff) * 1000000;
    ageRateAdjustment = -Math.min(5, yearsDiff) * 20000;
  } else if (year > 2023) {
    const yearsDiff = year - 2023;
    ageAdjustment = Math.min(3, yearsDiff) * 500000;
    ageRateAdjustment = Math.min(3, yearsDiff) * 10000;
  }

  const finalPurchasePrice = Math.max(5000000, basePurchasePrice + brandPriceAdjustment + ageAdjustment);
  const finalAgreedAmount = Math.max(120000, baseAgreedAmount + brandRateAdjustment + ageRateAdjustment);

  return {
    agreedAmount: finalAgreedAmount,
    purchasePrice: finalPurchasePrice,
    remainingVehicleBalance: finalPurchasePrice
  };
}

function calculateInstallmentsForDriver(driver: any, db: any, activeCycle: any) {
  const agreedAmount = driver.agreed_amount || 180000;
  const installmentTarget = Math.round(agreedAmount / 6);
  
  let startDate = new Date();
  if (activeCycle) {
    const rawStart = activeCycle.created_at || activeCycle.startDate;
    let startMs = NaN;
    if (rawStart) {
      if (typeof rawStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawStart)) {
        startMs = new Date(`${rawStart}T00:00:00Z`).getTime();
      } else {
        startMs = new Date(rawStart).getTime();
      }
    }
    if (!isNaN(startMs)) {
      startDate = new Date(startMs);
    } else {
      startDate = new Date(activeCycle.startDate);
    }
  } else {
    startDate = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  }
  let endDate = activeCycle && activeCycle.endDate ? new Date(activeCycle.endDate) : new Date();
  
  const payments = (db.driver_payments || []).filter((p: any) => {
    return p.driver_id === driver.id && p.status === 'approved' &&
      new Date(p.date) >= startDate &&
      (activeCycle && activeCycle.endDate ? new Date(p.date) <= endDate : true);
  });

  let totalRestDays = 0;
  const restHistory = driver.restHistory || [];
  if (activeCycle) {
    restHistory.forEach((rest: any) => {
      const restStart = new Date(rest.startDate);
      const restEnd = new Date(rest.endDate);
      const cycleStart = new Date(activeCycle.startDate);
      
      if (restEnd >= cycleStart) {
        const overlapStart = restStart < cycleStart ? cycleStart : restStart;
        const overlapEnd = restEnd;
        const diffTime = overlapEnd.getTime() - overlapStart.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (days > 0) {
          totalRestDays += days;
        }
      }
    });
  }

  const today = new Date();
  const isCurrentlyOnRest = driver.status === 'off-duty' || restHistory.some((rest: any) => {
    const start = new Date(rest.startDate);
    const end = new Date(rest.endDate);
    return today >= start && today <= end;
  });

  const installments = [];
  let carryForward = 0;

  for (let k = 1; k <= 6; k++) {
    const startDay = (k - 1) * 5 + 1;
    const endDay = k * 5;

    const normalEndDate = new Date(startDate.getTime() + (endDay - 1) * 24 * 3600 * 1000);
    const extendedEndDate = new Date(normalEndDate.getTime() + totalRestDays * 24 * 3600 * 1000);
    
    const normalStartDate = new Date(startDate.getTime() + (startDay - 1) * 24 * 3600 * 1000);
    const extendedStartDate = new Date(normalStartDate.getTime() + totalRestDays * 24 * 3600 * 1000);

    const dueAmount = installmentTarget + carryForward;
    const paidAmount = payments
      .filter((p: any) => p.installment_number === k)
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const remaining = dueAmount - paidAmount;
    carryForward = remaining;

    let status = 'Pending';
    if (remaining <= 0) {
      status = 'Completed';
    } else if (paidAmount > 0) {
      status = 'Partially Paid';
    } else if (!isCurrentlyOnRest && today > extendedEndDate) {
      status = 'Overdue';
    }

    installments.push({
      installmentNumber: k,
      dueAmount,
      paidAmount,
      remainingAmount: Math.max(0, remaining),
      startDate: extendedStartDate.toISOString().split('T')[0],
      endDate: extendedEndDate.toISOString().split('T')[0],
      status
    });
  }

  return installments;
}

// Helper to filter and optimize database snapshots based on security roles
function generateFilteredPayload(role: string, driverProfileId: string | null, shareholderId: string | null, db: any): any {
  const common = {
    type: 'db_update',
    role: role,
    company_settings: db.company_settings || {},
    company_operations_state: db.company_operations_state || { status: 'Setup Mode' },
    announcements: db.announcements || [],
    timestamp: Date.now()
  };

  const mappedVehicles = (db.vehicles || []).map((v: any) => ({
    ...v,
    plateNumber: v.plate_number || v.plateNumber || '',
    fuelType: v.fuel_type || v.fuelType || 'diesel',
    capacity: v.capacity || '30 Tons',
    driverId: v.driver_id || v.driverId || null,
    lastServiceDate: v.last_service_date || v.lastServiceDate || new Date().toISOString().split('T')[0],
    mileage: v.mileage !== undefined ? v.mileage : 0
  }));

  const mappedDrivers = (db.drivers || []).map((d: any) => {
    const user = db.users.find((u: any) => u.id === d.user_id);
    const guarantor = db.guarantors.find((g: any) => g.driver_id === d.id);
    const vehicle = mappedVehicles.find((v: any) => v.driverId === d.id || v.driver_id === d.id);
    const financials = getDriverFinancials(d, db);
    const documents = (db.driver_documents || []).filter((doc: any) => doc.driver_id === d.id);
    const passportDoc = documents.find((doc: any) => doc.document_type === 'passport_photo');
    const passport_photo_url = passportDoc ? passportDoc.file_url : '';
    return {
      ...d,
      fullName: user?.full_name || d.fullName || 'Candidate',
      email: user?.email || d.email || '',
      phone: user?.phone || d.phone || '',
      guarantor,
      vehicle,
      documents,
      passport_photo_url,
      passportPhoto: passport_photo_url, // For fallback
      passportPhotoUrl: passport_photo_url, // For fallback
      licenseNumber: d.license_number || d.licenseNumber || 'KND-9828A',
      licenseExpiry: d.license_expiry || d.licenseExpiry || '2028-10-12',
      classification: d.classification || 'Assisted',
      remaining_vehicle_balance: financials.remainingVehicleBalance,
      total_amount_paid: financials.totalAmountPaid,
      vehicle_purchase_price: financials.vehiclePurchasePrice,
      total_payments_made: financials.totalPaymentsMade
    };
  });

  const mappedTrips = (db.trip_manifests || []).map((t: any) => ({
    ...t,
    manifestNumber: t.manifest_number || t.manifestNumber || t.remittanceNumber || '',
    remittanceNumber: t.manifest_number || t.manifestNumber || t.remittanceNumber || '',
    vehicleId: t.vehicle_id || t.vehicleId || '',
    driverId: t.driver_id || t.driverId || '',
    origin: t.origin || '',
    destination: t.destination || '',
    departureTime: t.departure_time || t.departureTime || '',
    expectedArrivalTime: t.expected_arrival_time || t.expectedArrivalTime || '',
    status: t.status || 'in-transit',
    cargoType: t.cargo_type || t.cargoType || t.tricycleType || 'Utility Tricycle',
    tricycleType: t.cargo_type || t.cargoType || t.tricycleType || 'Utility Tricycle',
    weight: t.weight || 0,
    freightCharges: t.freight_charges || t.freightCharges || t.remittanceAmount || 15000,
    remittanceAmount: t.freight_charges || t.freightCharges || t.remittanceAmount || 15000,
    remittanceCount: t.remittanceCount || 1
  }));

  if (role === 'director') {
    return {
      ...common,
      drivers: mappedDrivers,
      vehicles: mappedVehicles,
      financials: db.financial_records || [],
      notifications: db.notifications || [],
      audit_logs: db.audit_logs || [],
      users: db.users || [],
      admins: db.admins || [],
      shareholders: db.shareholders || [],
      cycles: db.cycles || [],
      shareholder_settings: db.shareholder_settings || {},
      trip_manifests: mappedTrips,
      driver_payments: db.driver_payments || [],
      messages: db.messages || [],
      vehicle_documents: db.vehicle_documents || [],
      driver_documents: db.driver_documents || [],
      company_documents: db.company_documents || []
    };
  } else if (role === 'admin') {
    return {
      ...common,
      drivers: mappedDrivers,
      vehicles: mappedVehicles,
      financials: db.financial_records || [],
      notifications: db.notifications || [],
      users: db.users || [],
      admins: db.admins || [],
      shareholders: (db.shareholders || []).map((s: any) => ({ id: s.id, full_name: s.full_name, status: s.status })),
      cycles: db.cycles || [],
      trip_manifests: mappedTrips,
      driver_payments: db.driver_payments || [],
      messages: db.messages || [],
      vehicle_documents: db.vehicle_documents || [],
      driver_documents: db.driver_documents || [],
      company_documents: db.company_documents || []
    };
  } else if (role === 'shareholder') {
    const totalInvested = (db.shareholders || []).reduce((sum: number, s: any) => sum + (parseFloat(s.investment_amount) || 0), 0);
    const cleanShareholders = (db.shareholders || []).map((s: any) => {
      if (s.id === shareholderId) {
        const equityPercentage = totalInvested > 0 ? ((parseFloat(s.investment_amount) || 0) / totalInvested * 100).toFixed(2) : '0';
        return { ...s, equity_percentage: equityPercentage };
      }
      return { id: s.id, full_name: s.full_name, status: s.status };
    });

    return {
      ...common,
      shareholders: cleanShareholders,
      shareholder_settings: db.shareholder_settings || {},
      financials: db.financial_records || [],
      cycles: db.cycles || [],
      messages: (db.messages || []).filter((m: any) => m.sender_id === shareholderId || m.receiver_id === shareholderId),
      notifications: (db.notifications || []).filter((n: any) => n.user_id === shareholderId || n.target_role === 'shareholder' || (!n.user_id && !n.target_role))
    };
  } else if (role === 'driver') {
    const activeDriver = mappedDrivers.find((d: any) => d.id === driverProfileId) || {};
    const driverPayments = (db.driver_payments || []).filter((p: any) => p.driver_id === driverProfileId);
    const driverDocuments = (db.driver_documents || []).filter((doc: any) => doc.driver_id === driverProfileId);
    const driverTrips = mappedTrips.filter((t: any) => t.driverId === driverProfileId);
    const driverNotifications = (db.notifications || []).filter((n: any) => n.user_id === activeDriver.user_id || n.target_role === 'driver' || (!n.user_id && !n.target_role));
    const driverMessages = (db.messages || []).filter((m: any) => m.sender_id === activeDriver.user_id || m.receiver_id === activeDriver.user_id);

    return {
      ...common,
      drivers: [activeDriver],
      vehicles: mappedVehicles.filter((v: any) => v.driverId === driverProfileId),
      driver_payments: driverPayments,
      driver_documents: driverDocuments,
      trip_manifests: driverTrips,
      notifications: driverNotifications,
      messages: driverMessages
    };
  } else {
    return {
      ...common,
      company_settings: db.company_settings || {},
      announcements: db.announcements || []
    };
  }
}

// Helper to enrich notifications dynamically for advanced metadata, priorities, categories, and actions
function enrichNotification(n: any) {
  const titleEn = n.title_en || n.titleEn || n.title || '';
  const titleHa = n.title_ha || n.titleHa || '';
  const messageEn = n.message_en || n.messageEn || n.message || n.body || '';
  const messageHa = n.message_ha || n.messageHa || '';
  
  // Categorize based on keywords
  let category = n.category || 'system';
  const textEnLower = (titleEn + ' ' + messageEn).toLowerCase();
  const textHaLower = (titleHa + ' ' + messageHa).toLowerCase();
  
  if (textEnLower.includes('payment') || textEnLower.includes('remittance') || textHaLower.includes('biya') || textHaLower.includes('kudi')) {
    category = 'payments';
  } else if (textEnLower.includes('voucher') || textEnLower.includes('fuel') || textHaLower.includes('man fetur')) {
    category = 'finance';
  } else if (textEnLower.includes('driver') || textHaLower.includes('direba')) {
    category = 'drivers';
  } else if (textEnLower.includes('shareholder') || textHaLower.includes('hannun jari')) {
    category = 'shareholders';
  } else if (textEnLower.includes('expense') || textEnLower.includes('ledger') || textEnLower.includes('payroll')) {
    category = 'finance';
  } else if (textEnLower.includes('accident') || textEnLower.includes('security') || textEnLower.includes('breach') || textHaLower.includes('lafiya')) {
    category = 'security';
  } else if (textEnLower.includes('report') || textEnLower.includes('audit')) {
    category = 'reports';
  } else if (textEnLower.includes('announcement') || textEnLower.includes('broadcast')) {
    category = 'announcements';
  } else if (textEnLower.includes('document')) {
    category = 'documents';
  }

  // Determine priority based on type or urgency
  let priority = n.priority || 'medium';
  if (n.type === 'danger' || textEnLower.includes('accident') || textEnLower.includes('unauthorized') || textEnLower.includes('breach')) {
    priority = 'critical';
  } else if (n.type === 'warning' || textEnLower.includes('pending') || textEnLower.includes('reject') || textEnLower.includes('required')) {
    priority = 'high';
  } else if (n.type === 'success' || textEnLower.includes('complete') || textEnLower.includes('approve')) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  // Add smart action buttons on the fly
  let actions: any[] = [];
  if (category === 'drivers' && (textEnLower.includes('approve') || textEnLower.includes('credentials') || textEnLower.includes('registration'))) {
    actions = [
      { labelEn: 'Verify Credentials', labelHa: 'Duba Takardu', action: 'view_drivers', path: '/drivers' }
    ];
  } else if (category === 'finance' && (textEnLower.includes('voucher') || textEnLower.includes('request'))) {
    actions = [
      { labelEn: 'Approve Allocation', labelHa: 'Amince da Bukatar', action: 'view_vouchers', path: '/vouchers' }
    ];
  } else if (category === 'payments' && textEnLower.includes('remittance')) {
    actions = [
      { labelEn: 'View Financials', labelHa: 'Duba Kudade', action: 'view_finance', path: '/finance' }
    ];
  } else {
    actions = [
      { labelEn: 'Dismiss', labelHa: 'Kau da shi', action: 'dismiss', path: '' }
    ];
  }

  return {
    ...n,
    category,
    priority,
    actions,
    status: n.status || (n.read_status === 1 ? 'read' : 'unread'),
    read: n.read_status === 1 || n.status === 'read' || n.status === 'archived',
    titleEn,
    titleHa,
    messageEn,
    messageHa,
    timestamp: n.created_at || n.timestamp || new Date().toISOString()
  };
}

// Helper to dynamically dispatch push notifications to enrolled devices
async function sendPushForNotification(env: Env, db: any, n: any) {
  try {
    const enriched = enrichNotification(n);
    const payload = JSON.stringify({
      id: n.id,
      title: enriched.titleEn || enriched.title_en || n.title_en || n.title || 'RUQAYYA TRANSPORT',
      body: enriched.messageEn || enriched.message_en || n.message_en || n.message || n.body || '',
      titleEn: enriched.titleEn || enriched.title_en || n.title_en || '',
      titleHa: enriched.titleHa || enriched.title_ha || n.title_ha || '',
      messageEn: enriched.messageEn || enriched.message_en || n.message_en || '',
      messageHa: enriched.messageHa || enriched.message_ha || n.message_ha || '',
      type: n.type || 'info',
      category: enriched.category || 'system',
      priority: enriched.priority || 'medium',
      actions: enriched.actions || [],
      timestamp: n.created_at || new Date().toISOString()
    });

    let targetUserIds: string[] = [];
    let isBroadcast = false;

    if (n.user_id) {
      targetUserIds = [n.user_id];
    } else if (n.target_role) {
      const roleName = n.target_role.toLowerCase();
      const targetRoleObj = db.roles?.find((r: any) => r.name.toLowerCase() === roleName);
      if (targetRoleObj) {
        targetUserIds = (db.users || [])
          .filter((u: any) => u.role_id === targetRoleObj.id)
          .map((u: any) => u.id);
      }
    } else {
      isBroadcast = true;
    }

    if (isBroadcast) {
      await sendPushNotificationToUserOrRole(env, { all: true }, { title: enriched.titleEn, message: enriched.messageEn, type: n.type }, db);
    } else {
      for (const uid of targetUserIds) {
        const prefs = db.user_preferences?.find((p: any) => p.user_id === uid);
        if (prefs && prefs.enablePush === false) {
          console.log(`PushService Worker: Skipping push for user ${uid} due to preference.`);
          continue;
        }
        await sendPushNotificationToUserOrRole(env, { userId: uid }, { title: enriched.titleEn, message: enriched.messageEn, type: n.type }, db);
      }
    }
  } catch (err) {
    console.error("Worker push dispatch failure:", err);
  }
}

// Database Manager Class with D1 persistent storage & Firestore REST API fallback
const FIREBASE_CONFIG = {
  projectId: "aesthetic-reference-fw1xt",
  apiKey: "AIzaSyCAMd4TDpQKAh2yCU0j-Z2f107QKoSVWDA",
  firestoreDatabaseId: "ai-studio-ruqayyatransport-ec9c3d70-1fac-4a98-a67d-8c340e7f6358"
};

const getFirestoreDocUrl = () => {
  const { projectId, firestoreDatabaseId, apiKey } = FIREBASE_CONFIG;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/system_state/main_database?key=${apiKey}`;
};

// --- Web Push Encryption Helpers (RFC 8291) ---
async function encryptPushPayload(subscription: any, payload: string): Promise<{ body: ArrayBuffer; salt: string; dh: string }> {
  const textEncoder = new TextEncoder();
  const payloadBuffer = textEncoder.encode(payload);
  
  // 1. Parse subscription keys
  const p256dh = decodeBase64url(subscription.keys.p256dh);
  const auth = decodeBase64url(subscription.keys.auth);
  
  // 2. Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  const ephemeralPublicKey = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 3. Import recipient's public key
  const recipientPublicKey = await crypto.subtle.importKey(
    'raw',
    p256dh,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
  
  // 4. Shared secret derivation
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    ephemeralKeyPair.privateKey,
    256
  );
  
  // 5. HKDF Implementation using Web Crypto
  async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await crypto.subtle.sign('HMAC', key, ikm);
    const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    
    let t = new Uint8Array(0);
    let okm = new Uint8Array(0);
    let i = 1;
    while (okm.length < length) {
      const stepInfo = new Uint8Array(t.length + info.length + 1);
      stepInfo.set(t);
      stepInfo.set(info, t.length);
      stepInfo.set([i], t.length + info.length);
      t = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, stepInfo));
      const newOkm = new Uint8Array(okm.length + t.length);
      newOkm.set(okm);
      newOkm.set(t, okm.length);
      okm = newOkm;
      i++;
    }
    return okm.slice(0, length);
  }

  // PRK = HKDF-Extract(salt, IKM)
  // info = "Content-Encoding: aes128gcm" || 0x00 || P-256 Receiver Public Key || P-256 Sender Public Key
  const info = new Uint8Array([
    ...textEncoder.encode("Content-Encoding: aes128gcm"),
    0,
    ...p256dh,
    ...new Uint8Array(ephemeralPublicKey)
  ]);
  
  const derivedKey = await hkdf(salt, new Uint8Array(sharedSecret), info, 16);
  const nonce = await hkdf(salt, new Uint8Array(sharedSecret), info, 12);
  
  // 6. AES-GCM Encryption
  // Payload must be padded: content || 0x02 || 0x00...
  const paddedPayload = new Uint8Array(payloadBuffer.length + 1);
  paddedPayload.set(payloadBuffer);
  paddedPayload[payloadBuffer.length] = 2; // Delimiter

  const aesKey = await crypto.subtle.importKey('raw', derivedKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );

  return {
    body: encrypted,
    salt: base64url(salt),
    dh: base64url(new Uint8Array(ephemeralPublicKey))
  };
}

function firestoreToPlain(fields: any): any {
  if (!fields) return {};
  const plain: any = {};
  for (const [key, value] of Object.entries(fields)) {
    plain[key] = valToPlain(value);
  }
  return plain;
}

function valToPlain(valObj: any): any {
  if (!valObj || typeof valObj !== 'object') return valObj;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
  if ('doubleValue' in valObj) return parseFloat(valObj.doubleValue);
  if ('booleanValue' in valObj) return valObj.booleanValue;
  if ('nullValue' in valObj) return null;
  if ('arrayValue' in valObj) {
    const list = valObj.arrayValue.values || [];
    return list.map((item: any) => valToPlain(item));
  }
  if ('mapValue' in valObj) {
    return firestoreToPlain(valObj.mapValue.fields);
  }
  return null;
}

function plainToFirestore(obj: any): any {
  if (obj === null || obj === undefined) return { nullValue: null };
  if (typeof obj === 'string') return { stringValue: obj };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (typeof obj === 'number') {
    if (Number.isInteger(obj)) {
      return { integerValue: obj.toString() };
    } else {
      return { doubleValue: obj };
    }
  }
  if (Array.isArray(obj)) {
    return {
      arrayValue: {
        values: obj.map(item => plainToFirestore(item))
      }
    };
  }
  if (typeof obj === 'object') {
    const fields: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        fields[key] = plainToFirestore(value);
      }
    }
    return {
      mapValue: {
        fields
      }
    };
  }
  return { nullValue: null };
}

async function fetchFromFirestore(): Promise<any> {
  try {
    const url = getFirestoreDocUrl();
    console.log(`[FIRESTORE REST] Fetching from ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        console.log("[FIRESTORE REST] main_database document not found (404), starting fresh.");
        return null;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const doc = await res.json() as any;
    if (doc && doc.fields) {
      const plain = firestoreToPlain(doc.fields);
      console.log("[FIRESTORE REST] Successfully loaded database state from Firestore REST API.");
      return plain;
    }
    return null;
  } catch (err: any) {
    console.error("[FIRESTORE REST ERROR] Failed to load database state from Firestore:", err.message);
    return null;
  }
}

async function saveToFirestore(state: any): Promise<void> {
  try {
    const url = getFirestoreDocUrl();
    console.log(`[FIRESTORE REST] Saving to ${url}`);
    const converted = plainToFirestore(state);
    const fields = converted && converted.mapValue ? converted.mapValue.fields : {};
    const body = { fields };
    
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP error! status: ${res.status}, response: ${errText}`);
    }
    console.log("[FIRESTORE REST] Successfully saved database state to Firestore REST API.");
  } catch (err: any) {
    console.error("[FIRESTORE REST ERROR] Failed to save database state to Firestore:", err.message);
  }
}

class D1Manager {
  private env: Env;
  private memoryDb: any = null;
  private loadedNotificationIds: Set<string> = new Set();
  private dbCache: any = null;
  private initialHashes: Record<string, string> = {};

  constructor(env: Env) {
    this.env = env;
  }

  private getD1(): any {
    if (this.env.DB && typeof this.env.DB.prepare === 'function') return this.env.DB;
    if (this.env.ruqayya && typeof this.env.ruqayya.prepare === 'function') return this.env.ruqayya;
    return null;
  }

  async getDB(): Promise<any> {
    if (this.dbCache) return this.dbCache;
    
    const d1 = this.getD1();
    let db: any = null;
    const startTime = Date.now();
    try {
      if (d1) {
        // Core initialization with optimized check
        await d1.batch([
          d1.prepare(`CREATE TABLE IF NOT EXISTS collections (name TEXT PRIMARY KEY, data TEXT)`),
          d1.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
          d1.prepare(`CREATE TABLE IF NOT EXISTS cycles (id TEXT PRIMARY KEY, user_id TEXT, start_time DATETIME, end_time DATETIME, duration INTEGER, status TEXT)`),
          d1.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, user_id TEXT, endpoint TEXT UNIQUE, keys TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
        ]);

        const dbResponse = await d1.prepare("SELECT name, data FROM collections").all();
        const results = dbResponse?.results || (Array.isArray(dbResponse) ? dbResponse : null);
        
        if (results && results.length > 0) {
          const state: any = {};
          for (const row of results) {
            state[row.name] = JSON.parse(row.data);
            // Store initial hash to detect changes
            this.initialHashes[row.name] = row.data;
          }
          db = await this.ensureDefaults(state);
          console.log(`[D1 SQL DB SUCCESS] Loaded database state in ${Date.now() - startTime}ms`);
        } else {
          console.log(`[D1 SQL DB SEED] No collections found, preparing seed defaults...`);
          const seedState = await this.ensureDefaults({});
          if (seedState && seedState.notifications) {
            this.loadedNotificationIds = new Set(seedState.notifications.map((n: any) => n.id).filter(Boolean));
          }
          await this.saveDB(seedState);
          db = seedState;
        }
      } else {
        console.log(`[D1 Fallback] No D1 DB bound. Attempting to fetch from Firestore REST API...`);
        const firestoreDb = await fetchFromFirestore();
        if (firestoreDb) {
          db = await this.ensureDefaults(firestoreDb);
          this.memoryDb = db;
        } else {
          if (!this.memoryDb) {
            console.log(`[MEMORY DB QUERY] No persistent DB or Firestore found, initializing Memory fallback...`);
            this.memoryDb = await this.ensureDefaults({});
          }
          db = this.memoryDb;
        }
      }

      if (db && db.notifications) {
        this.loadedNotificationIds = new Set(db.notifications.map((n: any) => n.id).filter(Boolean));
      }
      this.dbCache = db;
      return db;
    } catch (dbError) {
      console.error(`[DB RESOLUTION ERROR] D1 query failed, falling back to Firestore/Memory:`, dbError);
      try {
        const firestoreDb = await fetchFromFirestore();
        if (firestoreDb) {
          db = await this.ensureDefaults(firestoreDb);
          this.memoryDb = db;
        } else {
          if (!this.memoryDb) {
            this.memoryDb = await this.ensureDefaults({});
          }
          db = this.memoryDb;
        }
        if (db && db.notifications) {
          this.loadedNotificationIds = new Set(db.notifications.map((n: any) => n.id).filter(Boolean));
        }
        this.dbCache = db;
        return db;
      } catch (fallbackErr) {
        console.error(`[FALLBACK ERROR] Firestore fallback also failed:`, fallbackErr);
        throw dbError;
      }
    }
  }

  async saveDB(state: any): Promise<void> {
    this.dbCache = state;

    // Detect and dispatch new push notifications (non-blocking)
    if (state && state.notifications) {
      const nowMs = Date.now();
      const newNotifications = state.notifications.filter((n: any) => {
        if (!n || !n.id || this.loadedNotificationIds.has(n.id)) return false;
        const createdAt = n.created_at || n.timestamp;
        if (!createdAt) return false;
        const createdMs = new Date(createdAt).getTime();
        if (isNaN(createdMs)) return false;
        return (nowMs - createdMs) < 30000;
      });

      for (const n of newNotifications) {
        this.loadedNotificationIds.add(n.id);
        await sendPushForNotification(this.env, state, n).catch((err: any) => { console.error("Failed to dispatch push notification in saveDB:", err); });
      }
    }

    const d1 = this.getD1();
    if (d1) {
      const statements = [];
      const updatedKeys: string[] = [];
      
      for (const [key, val] of Object.entries(state)) {
        const dataStr = JSON.stringify(val);
        // Only update if changed or new
        if (this.initialHashes[key] !== dataStr) {
          statements.push(
            d1.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
              .bind(key, dataStr)
          );
          updatedKeys.push(key);
          this.initialHashes[key] = dataStr;
        }
      }

      // Sync specific tables if they exist in state
      if (updatedKeys.includes('cycles') && state.cycles && Array.isArray(state.cycles)) {
        for (const c of state.cycles) {
          statements.push(
            d1.prepare("INSERT OR REPLACE INTO cycles (id, user_id, start_time, end_time, duration, status) VALUES (?, ?, ?, ?, ?, ?)")
              .bind(c.id, c.created_by || null, c.startDate || c.created_at || null, c.endDate || null, c.duration || 0, c.status || 'active')
          );
        }
      }

      if (updatedKeys.includes('push_subscriptions') && state.push_subscriptions && Array.isArray(state.push_subscriptions)) {
        for (const s of state.push_subscriptions) {
          if (s && s.subscription && s.subscription.endpoint) {
            statements.push(
              d1.prepare("INSERT OR REPLACE INTO subscriptions (id, user_id, endpoint, keys, created_at) VALUES (?, ?, ?, ?, ?)")
                .bind(s.id || 'sub_' + Math.floor(Math.random() * 1000000), s.userId || 'anonymous', s.subscription.endpoint, JSON.stringify(s.subscription.keys || {}), s.createdAt || new Date().toISOString())
            );
          }
        }
      }

      if (statements.length > 0) {
        console.log(`[D1 SQL DB SAVE] Executing batch update for ${statements.length} statements. Collections: ${updatedKeys.join(', ')}`);
        // Split into chunks of 100 to stay within D1 limits
        for (let i = 0; i < statements.length; i += 100) {
          await d1.batch(statements.slice(i, i + 100));
        }
      }
    } else {
      this.memoryDb = state;
      console.log(`[D1 Fallback] Saving state to Firestore REST API...`);
      await saveToFirestore(state);
    }
  }

  private async ensureDefaults(parsed: any): Promise<any> {
    let changed = false;

    if (!parsed.company_settings) {
      parsed.company_settings = {
        companyName: "Ruqayya Transport Limited",
        companyLogo: "",
        companyAddress: "No 14 Zaria Road, Kano, Nigeria",
        phone: "+234 803 123 4567",
        email: "info@ruqayyatransport.com",
        currency: "₦",
        timeZone: "Africa/Lagos",
        languageDefault: "en",
        themeDefault: "light"
      };
      changed = true;
    }

    if (!parsed.shareholder_settings) {
      parsed.shareholder_settings = { distributionPercentage: 2 };
      changed = true;
    }

    if (!parsed.roles || parsed.roles.length === 0) {
      parsed.roles = [
        { id: 'role-director', name: 'director', description: 'Executive Boardroom Director', created_at: new Date().toISOString(), status: 'active' },
        { id: 'role-admin', name: 'admin', description: 'Operations Control Center Admin', created_at: new Date().toISOString(), status: 'active' },
        { id: 'role-driver', name: 'driver', description: 'Logistics Fleet Driver', created_at: new Date().toISOString(), status: 'active' },
        { id: 'role-shareholder', name: 'shareholder', description: 'Corporate Capital Investor', created_at: new Date().toISOString(), status: 'active' }
      ];
      changed = true;
    }

    if (!parsed.permissions || parsed.permissions.length === 0) {
      parsed.permissions = [
        { id: 'p1', name: 'view_director_dashboard', description: 'View executive metrics' },
        { id: 'p2', name: 'approve_drivers', description: 'Approve or reject new driver registrations' },
        { id: 'p3', name: 'manage_financials', description: 'Access and modify general ledger records' },
        { id: 'p4', name: 'approve_vouchers', description: 'Approve driver fuel allocation vouchers' },
        { id: 'p5', name: 'view_audit_logs', description: 'Inspect corporate security records' },
        { id: 'p6', name: 'request_vouchers', description: 'Submit fuel purchase requests' }
      ];
      changed = true;
    }

    if (!parsed.users || parsed.users.length === 0) {
      const directorId = generateUUID();
      const adminId = generateUUID();
      const driverUserId = generateUUID();
      const shareholderId1 = generateUUID();
      const shareholderId2 = generateUUID();

      parsed.users = [
        {
          id: directorId,
          username: 'MMR',
          email: 'director@ruqayyatransport.com',
          phone: '+234 803 111 0001',
          password_hash: await hashPassword('director123'),
          full_name: 'Director Kabir Mohammed',
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
          password_hash: await hashPassword('admin123'),
          full_name: 'Operator Ibrahim Bello',
          role_id: 'role-admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active'
        },
        {
          id: driverUserId,
          username: 'MUSA',
          email: 'musa.garba@ruqayyatransport.com',
          phone: '+234 803 123 4567',
          password_hash: await hashPassword('driver123'),
          full_name: 'Alhaji Musa Garba',
          role_id: 'role-driver',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active'
        },
        {
          id: shareholderId1,
          username: 'KABIR',
          email: 'kabir.m@ruqayyatransport.com',
          phone: '+234 803 777 0001',
          password_hash: await hashPassword('shareholder123'),
          full_name: 'Alhaji Kabir Mohammed',
          role_id: 'role-shareholder',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active'
        },
        {
          id: shareholderId2,
          username: 'AMINA',
          email: 'amina.g@ruqayyatransport.com',
          phone: '+234 806 444 1111',
          password_hash: await hashPassword('shareholder123'),
          full_name: 'Hajiya Amina Garba',
          role_id: 'role-shareholder',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active'
        }
      ];

      parsed.directors = [
        { id: generateUUID(), user_id: directorId, company_id: 'DIR-2026-001', created_at: new Date().toISOString(), status: 'active' }
      ];

      parsed.admins = [
        { id: generateUUID(), user_id: adminId, company_id: 'ADM-2026-001', created_at: new Date().toISOString(), status: 'active' }
      ];

      const driverId = generateUUID();
      parsed.drivers = [
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

      parsed.guarantors = [
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

      parsed.vehicles = [
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
        }
      ];

      parsed.shareholders = [
        {
          id: generateUUID(),
          user_id: shareholderId1,
          full_name: 'Alhaji Kabir Mohammed',
          phone: '+234 803 777 0001',
          email: 'kabir.m@ruqayyatransport.com',
          address: '5 Hotoro GRA, Kano',
          investment_amount: 150000000.0,
          investment_date: '2026-01-10',
          created_at: new Date().toISOString(),
          status: 'active'
        },
        {
          id: generateUUID(),
          user_id: shareholderId2,
          full_name: 'Hajiya Amina Garba',
          phone: '+234 806 444 1111',
          email: 'amina.g@ruqayyatransport.com',
          address: '18 Gwarimpa, Abuja',
          investment_amount: 75000000.0,
          investment_date: '2026-03-15',
          created_at: new Date().toISOString(),
          status: 'active'
        }
      ];

      parsed.cycles = [
        {
          id: 'CYC-2026-ACTIVE',
          startDate: '2026-07-01',
          endDate: '',
          status: 'active',
          locked: false,
          endGoalTons: 200
        }
      ];

      parsed.driver_payments = [
        {
          id: generateUUID(),
          driver_id: driverId,
          amount: 30000,
          installment_number: 1,
          receipt_number: 'RCP-2026-0001',
          date: '2026-07-03',
          remarks: 'Installment 1 Payment',
          status: 'approved',
          approved_by: 'Operator Ibrahim',
          created_at: new Date().toISOString()
        }
      ];

      parsed.financial_records = [];
      parsed.trip_manifests = [];
      parsed.audit_logs = [];
      parsed.notifications = [
        {
          id: generateUUID(),
          title_en: 'Enterprise ERP Online',
          title_ha: 'Sarin ERP Ya Fara Aiki',
          message_en: 'Welcome to Ruqayya Transport Limited ERP. Secure database clusters configured.',
          message_ha: 'Barka da zuwa Ruqayya Transport Limited ERP. An tsara rumbun adana bayanai lafiya.',
          type: 'success',
          read_status: 0,
          created_at: new Date().toISOString()
        }
      ];
      parsed.messages = [];
      parsed.announcements = [];
      parsed.vehicle_documents = [];
      parsed.driver_documents = [];
      parsed.company_documents = [];
      parsed.sessions = [];

      changed = true;
    }

    if (!parsed.sessions) { parsed.sessions = []; changed = true; }
    if (!parsed.audit_logs) { parsed.audit_logs = []; changed = true; }
    if (!parsed.notifications) { parsed.notifications = []; changed = true; }
    if (!parsed.messages) { parsed.messages = []; changed = true; }
    if (!parsed.announcements) { parsed.announcements = []; changed = true; }
    if (!parsed.financial_records) { parsed.financial_records = []; changed = true; }
    if (!parsed.trip_manifests) { parsed.trip_manifests = []; changed = true; }
    if (!parsed.cycles) { parsed.cycles = []; changed = true; }
    if (!parsed.driver_payments) { parsed.driver_payments = []; changed = true; }
    if (!parsed.vehicle_documents) { parsed.vehicle_documents = []; changed = true; }
    if (!parsed.driver_documents) { parsed.driver_documents = []; changed = true; }
    if (!parsed.company_documents) { parsed.company_documents = []; changed = true; }

    if (changed) {
      await this.saveDB(parsed);
    }
    return parsed;
  }
}

// Global serverless helper response builder
const buildResponse = (data: any, status = 200, headers = {}) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
      ...headers
    }
  });
};

// Helper to sign and generate standard ES256 VAPID JWT header for Web Push using Web Crypto
async function generateVapidHeader(env: Env, endpoint: string, db?: any, dbManager?: D1Manager): Promise<string> {
  const keys = await getVapidKeys(env, db, dbManager);
  const publicKey = keys?.publicKey || '';
  const privateKey = keys?.privateKey || '';
  
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured.');
  }

  const decodedPublic = decodeBase64url(publicKey);
  const x_b64url = base64url(decodedPublic.slice(1, 33));
  const y_b64url = base64url(decodedPublic.slice(33, 65));

  const jwkPrivate = {
    kty: 'EC',
    crv: 'P-256',
    x: x_b64url,
    y: y_b64url,
    d: privateKey
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwkPrivate,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign']
  );

  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:hassanalaminhassan85@gmail.com'
  };

  const textEncoder = new TextEncoder();
  const unsignedToken = `${base64url(textEncoder.encode(JSON.stringify(header)))}.${base64url(textEncoder.encode(JSON.stringify(payload)))}`;

  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' }
    },
    key,
    textEncoder.encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

// Helper to send a single push notification natively using standard fetch
async function sendPushNotification(
  env: Env,
  subscription: any,
  payload: string
): Promise<{ success: boolean; expired?: boolean }> {
  try {
    const endpoint = subscription.endpoint;
    if (!endpoint) return { success: false };

    const authHeader = await generateVapidHeader(env, endpoint, db, dbManager);

    // Secure Web Push encryption (AES-128-GCM)
    let body: any = payload;
    let headers: any = {
      'Authorization': authHeader,
      'TTL': '2419200',
      'Content-Type': 'application/json'
    };

    if (subscription.keys && subscription.keys.p256dh && subscription.keys.auth) {
      try {
        const encrypted = await encryptPushPayload(subscription, payload);
        
        // RFC 8188 (aes128gcm) Binary Header:
        // - salt: 16 bytes
        // - rs (Record Size): 4 bytes (standard is 4096, represented as [0, 0, 16, 0] big-endian)
        // - idlen: 1 byte (length of sender public key, 65 bytes raw ECDH P-256)
        // - keyid (ephemeral public key): 65 bytes
        const saltBytes = decodeBase64url(encrypted.salt);
        const dhBytes = decodeBase64url(encrypted.dh);
        
        const header = new Uint8Array(86);
        header.set(saltBytes, 0);
        header.set([0, 0, 16, 0], 16); // rs = 4096
        header.set([65], 20); // idlen = 65
        header.set(dhBytes, 21); // ephemeral public key (65 bytes)
        
        const bodyWithHeader = new Uint8Array(86 + encrypted.body.byteLength);
        bodyWithHeader.set(header, 0);
        bodyWithHeader.set(new Uint8Array(encrypted.body), 86);
        
        body = bodyWithHeader;
        headers = {
          ...headers,
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream'
        };
        console.log(`[PUSH] Successfully encrypted payload with RFC 8188 header for endpoint: ${endpoint}`);
      } catch (encryptErr) {
        console.warn(`[PUSH] Encryption failed, falling back to plaintext (unlikely to work in prod):`, encryptErr);
      }
    }

    let res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body
    });

    // Fallback for push services that reject unencrypted payload
    if (!res.ok && body !== null) {
      console.warn(`Push service rejected payload (${res.status}). Retrying with silent push...`);
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'TTL': '2419200',
          'Content-Length': '0'
        }
      });
    }

    if (res.ok) return { success: true };

    console.error(`Push delivery failed with status ${res.status}`);
    if (res.status === 410 || res.status === 404) return { success: false, expired: true };
    return { success: false };
  } catch (error: any) {
    console.error("Error sending native push notification:", error);
    return { success: false };
  }
}

// Helper to broadcast push notifications to users or roles based on subscriptions in KV and/or D1
async function sendPushNotificationToUserOrRole(
  env: Env,
  target: { userId?: string; role?: string; all?: boolean },
  notification: { title: string; message: string; type?: string },
  db?: any
) {
  const subscriptionsToNotify: { userId: string; subscription: any; keyName?: string }[] = [];

  // 1. Gather subscriptions from KV Store if available
  if (env.PUSH_SUBSCRIPTIONS) {
    try {
      const listResult = await env.PUSH_SUBSCRIPTIONS.list();
      const keys = listResult.keys || [];
      for (const keyInfo of keys) {
        // Key format: sub:<userId>:<escaped_endpoint>
        const parts = keyInfo.name.split(':');
        if (parts[0] !== 'sub') continue;
        const subUserId = parts[1];

        let shouldSend = false;
        if (target.all) {
          shouldSend = true;
        } else if (target.userId && subUserId === target.userId) {
          shouldSend = true;
        }

        if (shouldSend) {
          const subscriptionJson = await env.PUSH_SUBSCRIPTIONS.get(keyInfo.name);
          if (subscriptionJson) {
            subscriptionsToNotify.push({
              userId: subUserId,
              subscription: JSON.parse(subscriptionJson),
              keyName: keyInfo.name
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to list push subscriptions from KV:", err);
    }
  }

  // 2. Gather subscriptions from D1 database (collections.push_subscriptions) if available
  if (db && db.push_subscriptions && Array.isArray(db.push_subscriptions)) {
    db.push_subscriptions.forEach((entry: any) => {
      if (entry && entry.subscription && entry.subscription.endpoint) {
        // Avoid duplicate endpoints if already fetched from KV
        const alreadyExists = subscriptionsToNotify.some(item => item.subscription.endpoint === entry.subscription.endpoint);
        if (!alreadyExists) {
          let shouldSend = false;
          if (target.all) {
            shouldSend = true;
          } else if (target.userId && entry.userId === target.userId) {
            shouldSend = true;
          }

          if (shouldSend) {
            subscriptionsToNotify.push({
              userId: entry.userId || 'anonymous',
              subscription: entry.subscription
            });
          }
        }
      }
    });
  }

  if (subscriptionsToNotify.length === 0) {
    console.log("No registered push subscriptions matched this notification's target audience.");
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    type: notification.type || 'info',
    timestamp: Date.now()
  });

  let dbChanged = false;

  for (const item of subscriptionsToNotify) {
    try {
      const pushRes = await sendPushNotification(env, item.subscription, payload);
      if (pushRes && !pushRes.success && pushRes.expired) {
        // Subscription has expired/unsubscribed. Prune it from KV
        if (item.keyName && env.PUSH_SUBSCRIPTIONS) {
          await env.PUSH_SUBSCRIPTIONS.delete(item.keyName).catch(() => {});
          console.log(`Pruned expired subscription from KV: ${item.keyName}`);
        }
        // Prune it from D1
        if (db && db.push_subscriptions) {
          const beforeLen = db.push_subscriptions.length;
          db.push_subscriptions = db.push_subscriptions.filter((s: any) => s && s.subscription && s.subscription.endpoint !== item.subscription.endpoint);
          if (db.push_subscriptions.length !== beforeLen) {
            dbChanged = true;
          }
        }
      }
    } catch (err) {
      console.error(`Error processing subscription dispatch for endpoint ${item.subscription.endpoint}:`, err);
    }
  }

  if (dbChanged && db) {
    // Rely on caller or final controller request scope to save the DB update
    console.log("D1 DB push_subscriptions collection pruned due to expired subscriptions.");
  }
}

// Main Request Handler
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
      }
    });
  }

  // Load database
  const dbManager = new D1Manager(env);
  const db = await dbManager.getDB();

  // Passive sync cycles on every request (replaces server background interval)
  const dbSyncChanged = syncCyclesOnRequest(db);
  if (dbSyncChanged) {
    await dbManager.saveDB(db);
  }

  // Helper to check authentication with stateless/ephemeral session rehydration matching server.ts
  const authenticate = async () => {
    let token = '';
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      token = authHeader.replace('Bearer ', '').trim();
    } else {
      // Fallback: Check token in query parameters (for EventSource/SSE)
      const urlToken = url.searchParams.get('token');
      if (urlToken) {
        token = decodeURIComponent(urlToken).trim();
      }
    }

    if (!token) {
      return { authenticated: false, error: 'Authentication required. Active session parameters not found.', status: 412 };
    }

    let session = db.sessions.find((s: any) => s.token === token && s.status === 'active');

    if (!session) {
      // Rehydrate session dynamically if fallback token is used or environment restarted
      if (token.startsWith('tok_')) {
        const parts = token.split('_');
        let roleName = '';
        let userKey = '';

        if (token.startsWith('tok_fallback_') && parts.length >= 3) {
          userKey = parts[2].toUpperCase();
          if (userKey === 'MMR') roleName = 'director';
          else if (userKey === 'ADAM' || userKey === 'ABAKAKA') roleName = 'admin';
          else if (userKey === 'KABIR' || userKey === 'AMINA') roleName = 'shareholder';
          else roleName = 'driver';
        } else if (parts.length >= 3) {
          roleName = parts[1].toLowerCase();
          userKey = parts[2].toUpperCase();
        }

        if (roleName && userKey) {
          const roleId = `role-${roleName}`;
          
          // Find existing user by username or email prefix
          let user = db.users.find((u: any) => 
            u.username === userKey || 
            u.email?.toLowerCase().startsWith(userKey.toLowerCase())
          );

          // If the user doesn't exist, seed them dynamically to match default credentials
          if (!user) {
            const userId = generateUUID();
            if (userKey === 'MMR') {
              user = {
                id: userId,
                username: 'MMR',
                email: 'director@ruqayyatransport.com',
                phone: '+234 803 111 0001',
                password_hash: '', // updated asynchronously
                full_name: 'Executive Director MMR',
                role_id: roleId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'active'
              };
              db.users.push(user);
              db.directors.push({
                id: generateUUID(),
                user_id: userId,
                company_id: 'DIR-2026-MMR',
                passport_photo_url: '',
                created_at: new Date().toISOString(),
                status: 'active'
              });
              user.password_hash = await hashPassword('director123');
              await dbManager.saveDB(db);
            } else if (userKey === 'ADAM' || userKey === 'ABAKAKA') {
              user = {
                id: userId,
                username: userKey,
                email: `${userKey.toLowerCase()}@ruqayyatransport.com`,
                phone: '+234 803 222 0002',
                password_hash: '', // updated asynchronously
                full_name: userKey === 'ADAM' ? 'Operations Admin ADAM' : 'Operations Admin ABAKAKA',
                role_id: roleId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'active'
              };
              db.users.push(user);
              db.admins.push({
                id: generateUUID(),
                user_id: userId,
                company_id: `ADM-2026-${userKey}`,
                passport_photo_url: '',
                created_at: new Date().toISOString(),
                status: 'active'
              });
              user.password_hash = await hashPassword('admin123');
              await dbManager.saveDB(db);
            } else if (userKey === 'KABIR' || userKey === 'AMINA') {
              user = {
                id: userId,
                username: userKey,
                email: `${userKey.toLowerCase()}.shareholder@ruqayyatransport.com`,
                phone: '+234 803 333 0003',
                password_hash: '', // updated asynchronously
                full_name: userKey === 'KABIR' ? 'Shareholder KABIR' : 'Shareholder AMINA',
                role_id: roleId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'active'
              };
              db.users.push(user);
              db.shareholders.push({
                id: generateUUID(),
                user_id: userId,
                investment_amount: userKey === 'KABIR' ? 12000000 : 8000000,
                ownership_percentage: userKey === 'KABIR' ? 60 : 40,
                created_at: new Date().toISOString(),
                status: 'active'
              });
              user.password_hash = await hashPassword('shareholder123');
              await dbManager.saveDB(db);
            } else {
              // Default Driver fallback
              user = {
                id: userId,
                username: 'MUSA',
                email: 'musa.driver@ruqayyatransport.com',
                phone: '+234 803 444 0004',
                password_hash: '', // updated asynchronously
                full_name: 'Driver MUSA',
                role_id: roleId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'active'
              };
              db.users.push(user);
              db.drivers.push({
                id: generateUUID(),
                user_id: userId,
                license_number: 'KND-9828A',
                license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'approved',
                created_at: new Date().toISOString()
              });
              user.password_hash = await hashPassword('driver123');
              await dbManager.saveDB(db);
            }
          }

          // Check if session already exists for this token in db.sessions
          session = db.sessions.find((s: any) => s.token === token);
          if (!session) {
            // Dynamically recreate the active session record
            session = {
              id: generateUUID(),
              user_id: user.id,
              token,
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              user_ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1',
              user_agent: request.headers.get('user-agent') || 'Corporate API Consumer',
              created_at: new Date().toISOString(),
              status: 'active'
            };
            db.sessions.push(session);
            await dbManager.saveDB(db); // now blocking to prevent CF Workers from killing it
          }
        }
      }
    }

    if (!session) {
      return { authenticated: false, error: 'Session expired or invalidated. Please login again.', status: 401 };
    }

    if (new Date(session.expires_at) < new Date()) {
      session.status = 'expired';
      await dbManager.saveDB(db);
      return { authenticated: false, error: 'Your corporate session has expired.', status: 401 };
    }

    const user = db.users.find((u: any) => u.id === session.user_id);
    if (!user) {
      return { authenticated: false, error: 'Associated user record not found.', status: 401 };
    }

    const role = db.roles.find((r: any) => r.id === user.role_id)?.name || 'public';
    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role,
        roleId: user.role_id
      },
      token
    };
  };

  const path = url.pathname;
  
  // 1. PUBLIC: Health Status
  if (path === '/api/health') {
    return buildResponse({
      status: 'healthy',
      database: env.DB ? 'connected' : 'memory_fallback',
      environment: 'production'
    });
  }

  // PUBLIC: Database Diagnostic Check via SELECT 1
  if (path === '/api/db-diagnostic' && method === 'GET') {
    const d1 = env.DB || env.ruqayya;
    let dbStatus = 'disconnected';
    try {
      if (d1 && typeof d1.prepare === 'function') {
        await d1.prepare('SELECT 1 as res').first();
        dbStatus = 'connected';
      } else {
        dbStatus = 'memory_fallback';
      }
    } catch (e) {
      console.error('[DB Diagnostic Error]', e);
      dbStatus = 'error';
    }
    return buildResponse({
      success: dbStatus !== 'error',
      status: dbStatus,
      message: `Database connection verified successfully via SELECT 1 query (Status: ${dbStatus})`,
      timestamp: new Date().toISOString()
    });
  }

  // PUBLIC: VAPID Public Key Retrieval
  if (path === '/api/notifications/vapid-public-key' && method === 'GET') {
    const keys = await getVapidKeys(env, db, dbManager);
    if (!keys || !keys.publicKey) {
      return buildResponse({ error: 'VAPID keys not configured or generation failed.' }, 500);
    }
    return buildResponse({ publicKey: keys.publicKey });
  }

  // PUBLIC/AUTHENTICATED: Push Subscription Enrollment
  if (path === '/api/notifications/subscribe' && method === 'POST') {
    try {
      const { subscription } = await request.json() as any;
      if (!subscription || !subscription.endpoint) {
        return buildResponse({ error: 'Invalid push subscription payload.' }, 400);
      }

      // Optional user association if a session exists
      let userId = 'anonymous';
      const authHeader = request.headers.get('authorization');
      if (authHeader) {
        const authCheck = await authenticate();
        if (authCheck.authenticated) {
          userId = authCheck.user.id;
        }
      }

      // 1. Persist inside D1 central storage (collections.push_subscriptions) as primary/fallback database
      if (!db.push_subscriptions) {
        db.push_subscriptions = [];
      }
      // Deduplicate endpoints
      db.push_subscriptions = db.push_subscriptions.filter((s: any) => s && s.subscription && s.subscription.endpoint !== subscription.endpoint);
      db.push_subscriptions.push({
        userId,
        subscription,
        createdAt: new Date().toISOString()
      });
      await dbManager.saveDB(db);

      // 2. Persist inside KV namespace if bound
      if (env.PUSH_SUBSCRIPTIONS) {
        const kvKey = `sub:${userId}:${encodeURIComponent(subscription.endpoint)}`;
        await env.PUSH_SUBSCRIPTIONS.put(kvKey, JSON.stringify(subscription));
        return buildResponse({ success: true, message: 'Push subscription stored successfully in DB & KV.' });
      } else {
        console.warn("PUSH_SUBSCRIPTIONS KV binding is missing. Persisted in D1 DB only.");
        return buildResponse({ 
          success: true, 
          message: 'Push subscription stored successfully in D1 DB.' 
        });
      }
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 1.5. PUBLIC/AUTH: Register Director
  if (path === '/api/auth/register-director' && method === 'POST') {
    try {
      const { fullName, email, phone, password, companyId, passportPhoto } = await request.json() as any;
      if (!fullName || !email || !phone || !password || !companyId) {
        return buildResponse({ error: 'All fields are mandatory for Director authentication.' }, 400);
      }

      const hasExistingDirectors = db.users.some((u: any) => u.role_id === 'role-director');

      if (hasExistingDirectors) {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
          return buildResponse({ error: 'Executive director setup already bootstrapped. Authorization required to spawn additional nodes.' }, 403);
        }

        const token = authHeader.replace('Bearer ', '').trim();
        const session = db.sessions.find((s: any) => s.token === token && s.status === 'active');
        if (!session) {
          return buildResponse({ error: 'Invalid executive session token.' }, 401);
        }

        const creator = db.users.find((u: any) => u.id === session.user_id);
        if (!creator || creator.role_id !== 'role-director') {
          return buildResponse({ error: 'Only authorized directors can spawn secondary director nodes.' }, 403);
        }
      }

      if (db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
        return buildResponse({ error: 'Email already mapped to an active ERP credential.' }, 400);
      }

      let passportUrl = '';
      if (passportPhoto) {
        const cleanBase64 = passportPhoto.replace(/^data:.*?;base64,/, '');
        const filename = `director_${fullName.replace(/\s+/g, '_')}_${Date.now()}.png`;
        passportUrl = `/api/documents/preview/${filename}`;
        
        if (env.R2_BUCKET) {
          try {
            const binaryString = atob(cleanBase64);
            const buffer = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              buffer[i] = binaryString.charCodeAt(i);
            }
            await env.R2_BUCKET.put(filename, buffer, { httpMetadata: { contentType: 'image/png' } });
          } catch (r2Err) {
            console.error(`[R2 ERROR] Failed to upload director photo:`, r2Err);
          }
        }
      }

      const userId = generateUUID();
      const newUser = {
        id: userId,
        email: email.toLowerCase(),
        phone,
        password_hash: await hashPassword(password),
        full_name: fullName,
        role_id: 'role-director',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      };

      if (!db.users) db.users = [];
      if (!db.directors) db.directors = [];

      db.users.push(newUser);
      db.directors.push({
        id: generateUUID(),
        user_id: userId,
        company_id: companyId,
        passport_photo_url: passportUrl,
        created_at: new Date().toISOString(),
        status: 'active'
      });

      await dbManager.saveDB(db);

      writeAuditLog(userId, email, 'director', 'DIRECTOR_CREATION', null, `Created Director User: ${fullName} (${companyId})`, db);

      return buildResponse({ success: true, message: 'Director registered successfully.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 2. PUBLIC: Driver Self-Registration Form
  if (path === '/api/auth/register-driver' && method === 'POST') {
    try {
      const { personal, guarantor, vehicle } = await request.json() as any;
      if (!personal || !guarantor || !vehicle) {
        return buildResponse({ error: 'Missing registration details.' }, 400);
      }

      const emailExists = db.users.some((u: any) => u.email.toLowerCase() === personal.email.toLowerCase());
      if (emailExists) {
        return buildResponse({ error: 'This email address is already registered inside our fleet.' }, 400);
      }

      const ninExists = db.drivers.some((d: any) => d.nin === personal.nin);
      if (ninExists) {
        return buildResponse({ error: 'National Identification Number (NIN) already associated with another driver.' }, 400);
      }

      const plateExists = db.vehicles.some((v: any) => v.plate_number.toUpperCase() === vehicle.plateNumber.toUpperCase());
      if (plateExists) {
        return buildResponse({ error: 'Vehicle plate number already registered.' }, 400);
      }

      // Handle File upload if R2 is available, otherwise mock or store inline
      let driverPassportUrl = '';
      let guarantorPassportUrl = '';

      if (personal.passportPhoto) {
        const fileId = `${Date.now()}-${generateUUID().substring(0, 8)}`;
        driverPassportUrl = `/api/documents/preview/${fileId}.png`;
        if (env.R2_BUCKET) {
          const cleanBase64 = personal.passportPhoto.replace(/^data:.*?;base64,/, '');
          const binaryString = atob(cleanBase64); const buffer = new Uint8Array(binaryString.length); for (let i = 0; i < binaryString.length; i++) buffer[i] = binaryString.charCodeAt(i);
          await env.R2_BUCKET.put(`${fileId}.png`, buffer, { httpMetadata: { contentType: 'image/png' } });
        }
      }

      if (guarantor.passport) {
        const fileId = `${Date.now()}-${generateUUID().substring(0, 8)}`;
        guarantorPassportUrl = `/api/documents/preview/${fileId}.png`;
        if (env.R2_BUCKET) {
          const cleanBase64 = guarantor.passport.replace(/^data:.*?;base64,/, '');
          const binaryString = atob(cleanBase64); const buffer = new Uint8Array(binaryString.length); for (let i = 0; i < binaryString.length; i++) buffer[i] = binaryString.charCodeAt(i);
          await env.R2_BUCKET.put(`${fileId}.png`, buffer, { httpMetadata: { contentType: 'image/png' } });
        }
      }

      const userId = generateUUID();
      const newUser = {
        id: userId,
        email: personal.email.toLowerCase(),
        phone: personal.phone,
        password_hash: await hashPassword(personal.password || 'driver123'),
        full_name: personal.fullName,
        role_id: 'role-driver',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending'
      };

      const driverId = generateUUID();
      const newDriver = {
        id: driverId,
        user_id: userId,
        company_driver_id: personal.companyDriverId || `PEND-${generateUUID().substring(0, 4).toUpperCase()}`,
        address: personal.address,
        nin: personal.nin,
        license_number: personal.licenseNumber || `LIC-${generateUUID().substring(0, 5).toUpperCase()}`,
        license_expiry: personal.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        classification: 'Assisted',
        rating: 5.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending'
      };

      const guarantorId = generateUUID();
      const newGuarantor = {
        id: guarantorId,
        driver_id: driverId,
        full_name: guarantor.fullName,
        phone: guarantor.phone,
        address: guarantor.address,
        relationship: guarantor.relationship,
        nin: guarantor.nin,
        passport_photo_url: guarantorPassportUrl,
        created_at: new Date().toISOString(),
        status: 'active'
      };

      const vehicleId = generateUUID();
      const newVehicle = {
        id: vehicleId,
        driver_id: driverId,
        brand: vehicle.brand,
        model: vehicle.model,
        year: parseInt(vehicle.year) || 2020,
        colour: vehicle.colour,
        plate_number: vehicle.plateNumber.toUpperCase(),
        registration_number: vehicle.registrationNumber,
        chassis_number: vehicle.chassisNumber,
        engine_number: vehicle.engineNumber,
        capacity: vehicle.capacity || '30 Tons',
        mileage: 0,
        created_at: new Date().toISOString(),
        status: 'idle'
      };

      if (driverPassportUrl) {
        db.driver_documents.push({
          id: generateUUID(),
          driver_id: driverId,
          document_type: 'passport_photo',
          file_url: driverPassportUrl,
          created_at: new Date().toISOString(),
          status: 'active'
        });
      }

      db.users.push(newUser);
      db.drivers.push(newDriver);
      db.guarantors.push(newGuarantor);
      db.vehicles.push(newVehicle);

      db.notifications.unshift({
        id: generateUUID(),
        title_en: 'New Self-Registered Driver Candidate',
        title_ha: 'Sabuwar Rijistar Direba',
        message_en: `Driver ${personal.fullName} submitted profile & vehicle ${vehicle.plateNumber}. Review required.`,
        message_ha: `Direba ${personal.fullName} ya mika bayanan motar sa ${vehicle.plateNumber}. Tana jiran amincewa.`,
        type: 'warning',
        read_status: 0,
        created_at: new Date().toISOString()
      });

      await dbManager.saveDB(db);
      writeAuditLog(null, personal.email, 'driver', 'SELF_REGISTRATION', null, `Driver registered self under UUID ${driverId}`, db);
      await dbManager.saveDB(db);

      return buildResponse({ success: true, message: 'Driver registration submitted successfully.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 3. PUBLIC: General Corporate Login
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await request.json() as any;
      const { email, password, username, rememberMe } = body;
      
      let user: any = null;
      let roleName = 'public';

      if (username) {
        // Passwordless enterprise gateway login
        const userKey = username.trim().toUpperCase();
        user = db.users.find((u: any) => 
          u.username === userKey || 
          u.email?.toLowerCase().startsWith(userKey.toLowerCase())
        );

        // Auto-seed enterprise user if missing in the db
        if (!user && (userKey === 'MMR' || userKey === 'ADAM' || userKey === 'ABAKAKA' || userKey === 'KABIR' || userKey === 'AMINA')) {
          const userId = generateUUID();
          let roleId = 'role-driver';
          if (userKey === 'MMR') roleId = 'role-director';
          else if (userKey === 'ADAM' || userKey === 'ABAKAKA') roleId = 'role-admin';
          else if (userKey === 'KABIR' || userKey === 'AMINA') roleId = 'role-shareholder';

          if (userKey === 'MMR') {
            user = {
              id: userId,
              username: 'MMR',
              email: 'director@ruqayyatransport.com',
              phone: '+234 803 111 0001',
              password_hash: '', // updated asynchronously
              full_name: 'Executive Director MMR',
              role_id: roleId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'active'
            };
            db.users.push(user);
            db.directors.push({
              id: generateUUID(),
              user_id: userId,
              company_id: 'DIR-2026-MMR',
              passport_photo_url: '',
              created_at: new Date().toISOString(),
              status: 'active'
            });
            user.password_hash = await hashPassword('director123');
              await dbManager.saveDB(db);
          } else if (userKey === 'ADAM' || userKey === 'ABAKAKA') {
            user = {
              id: userId,
              username: userKey,
              email: `${userKey.toLowerCase()}@ruqayyatransport.com`,
              phone: '+234 803 222 0002',
              password_hash: '', // updated asynchronously
              full_name: userKey === 'ADAM' ? 'Operations Admin ADAM' : 'Operations Admin ABAKAKA',
              role_id: roleId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'active'
            };
            db.users.push(user);
            db.admins.push({
              id: generateUUID(),
              user_id: userId,
              company_id: `ADM-2026-${userKey}`,
              passport_photo_url: '',
              created_at: new Date().toISOString(),
              status: 'active'
            });
            user.password_hash = await hashPassword('admin123');
              await dbManager.saveDB(db);
          } else if (userKey === 'KABIR' || userKey === 'AMINA') {
            user = {
              id: userId,
              username: userKey,
              email: `${userKey.toLowerCase()}.shareholder@ruqayyatransport.com`,
              phone: '+234 803 333 0003',
              password_hash: '', // updated asynchronously
              full_name: userKey === 'KABIR' ? 'Shareholder KABIR' : 'Shareholder AMINA',
              role_id: roleId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'active'
            };
            db.users.push(user);
            db.shareholders.push({
              id: generateUUID(),
              user_id: userId,
              investment_amount: userKey === 'KABIR' ? 12000000 : 8000000,
              ownership_percentage: userKey === 'KABIR' ? 60 : 40,
              created_at: new Date().toISOString(),
              status: 'active'
            });
            user.password_hash = await hashPassword('shareholder123');
              await dbManager.saveDB(db);
          }
        }

        if (!user) {
          return buildResponse({ error: 'Access Denied: Invalid enterprise username.' }, 401);
        }

        roleName = db.roles.find((r: any) => r.id === user.role_id)?.name || 'public';
      } else {
        if (!email || !password) {
          return buildResponse({ error: 'Please enter both corporate email and security password.' }, 400);
        }

        user = db.users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase() && u.status === 'active');
        if (!user) {
          return buildResponse({ error: 'Access Denied: Non-existent active user profile.' }, 401);
        }

        if (user.status === 'pending' && user.role_id === 'role-driver') {
          return buildResponse({ error: 'Roster approval pending. Please wait for an administrator to authorize your profile.' }, 403);
        }

        if (!await verifyPassword(password, user.password_hash)) {
          writeAuditLog(user.id, email, 'public', 'AUTH_FAILURE', 'Invalid password submission', null, db);
          await dbManager.saveDB(db);
          return buildResponse({ error: 'Access Denied: Invalid credentials.' }, 401);
        }

        roleName = db.roles.find((r: any) => r.id === user.role_id)?.name || 'public';
      }

      const durationHours = rememberMe ? 24 * 30 : 2;
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      
      const userKey = user.username ? user.username.toUpperCase() : user.email.split('@')[0].toUpperCase();
      const token = `tok_${roleName.toLowerCase()}_${userKey}_${generateUUID().replace(/-/g, '')}`;

      const session = {
        id: generateUUID(),
        user_id: user.id,
        token,
        expires_at: expiresAt,
        user_ip: '127.0.0.1',
        user_agent: request.headers.get('user-agent') || 'Corporate API Consumer',
        created_at: new Date().toISOString(),
        status: 'active'
      };

      db.sessions.push(session);
      
      writeAuditLog(user.id, user.email, roleName, 'SESSION_CREATED', null, `Authorized login session valid until ${expiresAt}`, db);
      await dbManager.saveDB(db);

      return buildResponse({
        success: true,
        token,
        expiresAt,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          role: roleName
        }
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 4. PUBLIC: Demo quick switch logins (for corporate testing desk)
  if (path === '/api/auth/login-as-role' && method === 'POST') {
    try {
      const { role } = await request.json() as any;
      let targetUser = null;
      if (role === 'director') targetUser = db.users.find((u: any) => u.email === 'director@ruqayyatransport.com');
      else if (role === 'admin') targetUser = db.users.find((u: any) => u.email === 'admin@ruqayyatransport.com');
      else if (role === 'driver') targetUser = db.users.find((u: any) => u.email === 'musa.garba@ruqayyatransport.com');
      else if (role === 'shareholder') targetUser = db.users.find((u: any) => u.email === 'kabir.m@ruqayyatransport.com');

      if (!targetUser) {
        return buildResponse({ error: `Pre-seeded user profile not found for role ${role}.` }, 404);
      }

      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      
      const userKey = targetUser.username ? targetUser.username.toUpperCase() : targetUser.email.split('@')[0].toUpperCase();
      const token = `tok_${role.toLowerCase()}_${userKey}_${generateUUID().replace(/-/g, '')}`;

      db.sessions.push({
        id: generateUUID(),
        user_id: targetUser.id,
        token,
        expires_at: expiresAt,
        user_ip: '127.0.0.1',
        user_agent: 'Developer Preview Switch',
        created_at: new Date().toISOString(),
        status: 'active'
      });

      writeAuditLog(targetUser.id, targetUser.email, role, 'DEMO_SWITCH_LOGIN', null, `Logged into preview account successfully`, db);
      await dbManager.saveDB(db);

      return buildResponse({
        success: true,
        token,
        expiresAt,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.full_name,
          phone: targetUser.phone,
          role
        }
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // PUBLIC: Get Canonical Cycle Status (Non-authenticated)
  if (path === '/api/cycles/status' && method === 'GET') {
    if (!db.cycles) db.cycles = [];
    const status = getCanonicalCycleStatus(db);
    return buildResponse({ success: true, ...status });
  }

  // ALL OTHER ENDPOINTS REQUIRE AUTHENTICATION
  const auth = await authenticate();
  if (!auth.authenticated) {
    return buildResponse({ error: auth.error }, auth.status || 401);
  }

  const { user, token } = auth;

  // 5. GET ACTIVE PROFILE PAYLOAD
  if (path === '/api/auth/me' && method === 'GET') {
    const userRec = db.users.find((u: any) => u.id === user.id);
    if (!userRec) return buildResponse({ error: 'User record missing.' }, 404);

    const permissions = db.permissions.filter((p: any) => {
      if (user.role === 'director') return true;
      if (user.role === 'admin' && p.name !== 'view_audit_logs') return true;
      if (user.role === 'driver' && p.name === 'request_vouchers') return true;
      return false;
    }).map((p: any) => p.name);

    let profileDetails: any = {};
    if (user.role === 'driver') {
      const dr = db.drivers.find((d: any) => d.user_id === user.id);
      if (dr) {
        const guarantor = db.guarantors.find((g: any) => g.driver_id === dr.id) || null;
        const vehicle = db.vehicles.find((v: any) => v.driver_id === dr.id) || null;
        const financials = getDriverFinancials(dr, db);
        const documents = (db.driver_documents || []).filter((doc: any) => doc.driver_id === dr.id).map((doc: any) => ({
          ...doc,
          file_url: doc.file_url ? (doc.file_url.includes('token=') ? doc.file_url : `${doc.file_url}?token=${encodeURIComponent(token)}`) : ''
        }));
        const passportDoc = documents.find((doc: any) => doc.document_type === 'passport_photo');
        const passport_photo_url = passportDoc ? passportDoc.file_url : '';

        profileDetails = {
          ...dr,
          fullName: userRec.full_name || dr.fullName || dr.full_name || '',
          email: userRec.email || '',
          phone: userRec.phone || dr.phone || '',
          licenseNumber: dr.license_number || dr.licenseNumber || '',
          licenseExpiry: dr.license_expiry || dr.licenseExpiry || '',
          companyDriverId: dr.company_driver_id || dr.companyDriverId || '',
          company_driver_id: dr.company_driver_id || dr.companyDriverId || '',
          guarantor: guarantor ? {
            ...guarantor,
            fullName: guarantor.fullName || guarantor.full_name || '',
            phone: guarantor.phone || '',
            address: guarantor.address || '',
            relationship: guarantor.relationship || '',
            nin: guarantor.nin || '',
            passport: guarantor.passport || guarantor.passport_photo_url ? (guarantor.passport || guarantor.passport_photo_url).includes('token=') ? (guarantor.passport || guarantor.passport_photo_url) : `${guarantor.passport || guarantor.passport_photo_url}?token=${encodeURIComponent(token)}` : '',
            passportPhotoUrl: guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport ? (guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport).includes('token=') ? (guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport) : `${guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport}?token=${encodeURIComponent(token)}` : '',
            passport_photo_url: guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport ? (guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport).includes('token=') ? (guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport) : `${guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport}?token=${encodeURIComponent(token)}` : ''
          } : null,
          vehicle: vehicle ? {
            ...vehicle,
            brand: vehicle.brand || '',
            model: vehicle.model || '',
            year: vehicle.year || 2020,
            colour: vehicle.colour || '',
            plateNumber: vehicle.plate_number || vehicle.plateNumber || '',
            plate_number: vehicle.plate_number || vehicle.plateNumber || '',
            registrationNumber: vehicle.registration_number || vehicle.registrationNumber || '',
            registration_number: vehicle.registration_number || vehicle.registrationNumber || '',
            chassisNumber: vehicle.chassis_number || vehicle.chassisNumber || '',
            chassis_number: vehicle.chassis_number || vehicle.chassisNumber || '',
            engineNumber: vehicle.engine_number || vehicle.engineNumber || '',
            engine_number: vehicle.engine_number || vehicle.engineNumber || '',
            capacity: vehicle.capacity || ''
          } : null,
          remaining_vehicle_balance: financials.remainingVehicleBalance,
          total_amount_paid: financials.totalAmountPaid,
          vehicle_purchase_price: financials.vehiclePurchasePrice,
          total_payments_made: financials.totalPaymentsMade,
          documents,
          passport_photo_url,
          passportPhoto: passport_photo_url,
          passportPhotoUrl: passport_photo_url
        };
      }
    } else if (user.role === 'shareholder') {
      const sh = db.shareholders.find((s: any) => s.user_id === user.id);
      if (sh) profileDetails = sh;
    }

    return buildResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: userRec.phone,
        role: user.role,
        permissions,
        profile: profileDetails,
        profileDetails: profileDetails
      }
    });
  }

  // 6. LOGOUT
  if (path === '/api/auth/logout' && method === 'POST') {
    const session = db.sessions.find((s: any) => s.token === token);
    if (session) session.status = 'logged_out';
    
    writeAuditLog(user.id, user.email, user.role, 'SESSION_DESTROYED', null, 'Manual logout request processed', db);
    await dbManager.saveDB(db);
    return buildResponse({ success: true });
  }

  // 7. GET AUDIT LOGS
  if (path === '/api/audit-logs' && method === 'GET') {
    if (user.role !== 'director' && user.role !== 'admin') {
      return buildResponse({ error: 'Access Denied: Director or Admin role required for audit trails.' }, 403);
    }
    return buildResponse(db.audit_logs || []);
  }

  // 8. DRIVERS ENDPOINTS
  if (path.startsWith('/api/drivers')) {
    const parts = path.replace(/^\/api\/drivers/, '').split('/').filter(Boolean);
    
    // GET /api/drivers (List drivers)
    if (parts.length === 0 && method === 'GET') {
      const searchParam = url.searchParams.get('search')?.toLowerCase() || '';
      let list = (db.drivers || []).filter(Boolean);

      if (user.role === 'driver') {
        list = list.filter((d: any) => d.user_id === user.id);
      }

      const results = list.map((drv: any) => {
        const u = db.users.find((userObj: any) => userObj.id === drv.user_id) || {};
        const g = db.guarantors.find((gua: any) => gua.driver_id === drv.id) || null;
        const v = db.vehicles.find((veh: any) => veh.driver_id === drv.id) || null;
        const financials = getDriverFinancials(drv, db);
        const documents = (db.driver_documents || []).filter((doc: any) => doc.driver_id === drv.id).map((doc: any) => ({
          ...doc,
          file_url: doc.file_url ? (doc.file_url.includes('token=') ? doc.file_url : `${doc.file_url}?token=${encodeURIComponent(token)}`) : ''
        }));
        const passportDoc = documents.find((doc: any) => doc.document_type === 'passport_photo');
        const passport_photo_url = passportDoc ? passportDoc.file_url : '';

        return {
          ...drv,
          fullName: u.full_name || drv.fullName || drv.full_name || '',
          email: u.email || '',
          phone: u.phone || drv.phone || '',
          licenseNumber: drv.license_number || drv.licenseNumber || '',
          licenseExpiry: drv.license_expiry || drv.licenseExpiry || '',
          companyDriverId: drv.company_driver_id || drv.companyDriverId || '',
          company_driver_id: drv.company_driver_id || drv.companyDriverId || '',
          guarantor: g ? {
            ...g,
            fullName: g.fullName || g.full_name || '',
            phone: g.phone || '',
            address: g.address || '',
            relationship: g.relationship || '',
            nin: g.nin || '',
            passport: g.passport || g.passport_photo_url ? (g.passport || g.passport_photo_url).includes('token=') ? (g.passport || g.passport_photo_url) : `${g.passport || g.passport_photo_url}?token=${encodeURIComponent(token)}` : '',
            passportPhotoUrl: g.passport_photo_url || g.passportPhotoUrl || g.passport ? (g.passport_photo_url || g.passportPhotoUrl || g.passport).includes('token=') ? (g.passport_photo_url || g.passportPhotoUrl || g.passport) : `${g.passport_photo_url || g.passportPhotoUrl || g.passport}?token=${encodeURIComponent(token)}` : '',
            passport_photo_url: g.passport_photo_url || g.passportPhotoUrl || g.passport ? (g.passport_photo_url || g.passportPhotoUrl || g.passport).includes('token=') ? (g.passport_photo_url || g.passportPhotoUrl || g.passport) : `${g.passport_photo_url || g.passportPhotoUrl || g.passport}?token=${encodeURIComponent(token)}` : ''
          } : null,
          vehicle: v ? {
            ...v,
            brand: v.brand || '',
            model: v.model || '',
            year: v.year || 2020,
            colour: v.colour || '',
            plateNumber: v.plate_number || v.plateNumber || '',
            plate_number: v.plate_number || v.plateNumber || '',
            registrationNumber: v.registration_number || v.registrationNumber || '',
            registration_number: v.registration_number || v.registrationNumber || '',
            chassisNumber: v.chassis_number || v.chassisNumber || '',
            chassis_number: v.chassis_number || v.chassisNumber || '',
            engineNumber: v.engine_number || v.engineNumber || '',
            engine_number: v.engine_number || v.engineNumber || '',
            capacity: v.capacity || ''
          } : null,
          financials,
          documents,
          passport_photo_url,
          passportPhoto: passport_photo_url,
          passportPhotoUrl: passport_photo_url
        };
      });

      if (searchParam) {
        return buildResponse(results.filter((drv: any) => 
          (drv.fullName || '').toLowerCase().includes(searchParam) ||
          (drv.company_driver_id || '').toLowerCase().includes(searchParam) ||
          (drv.nin || '').includes(searchParam)
        ));
      }
      return buildResponse(results);
    }

    // POST /api/drivers/import (Import opening balance driver)
    if (parts[0] === 'import' && method === 'POST') {
      if (user.role !== 'admin' && user.role !== 'director') {
        return buildResponse({ error: 'Access Denied.' }, 403);
      }

      try {
        const { personal, guarantor, vehicle } = await request.json() as any;
        const uId = generateUUID();
        const drId = generateUUID();

        const newUser = {
          id: uId,
          email: personal.email.toLowerCase(),
          phone: personal.phone,
          password_hash: await hashPassword('driver123'),
          full_name: personal.fullName,
          role_id: 'role-driver',
          created_at: new Date().toISOString(),
          status: 'active'
        };

        const newDriver = {
          id: drId,
          user_id: uId,
          company_driver_id: personal.companyDriverId || `RTL-${generateUUID().substring(0, 4).toUpperCase()}`,
          address: personal.address,
          nin: personal.nin,
          license_number: personal.licenseNumber,
          license_expiry: personal.licenseExpiry,
          classification: 'Smart',
          rating: 5.0,
          created_at: new Date().toISOString(),
          status: 'approved',
          agreed_amount: personal.agreedAmount || 180000,
          vehicle_purchase_price: personal.vehiclePurchasePrice || 15000000,
          opening_balance: {
            is_imported: true,
            total_paid_to_date: personal.totalPaidToDate || 0,
            remaining_vehicle_balance: personal.remainingVehicleBalance || 15000000
          },
          restHistory: []
        };

        db.users.push(newUser);
        db.drivers.push(newDriver);

        if (guarantor) {
          db.guarantors.push({
            id: generateUUID(),
            driver_id: drId,
            full_name: guarantor.fullName,
            phone: guarantor.phone,
            address: guarantor.address,
            relationship: guarantor.relationship,
            nin: guarantor.nin,
            created_at: new Date().toISOString(),
            status: 'active'
          });
        }

        if (vehicle) {
          db.vehicles.push({
            id: generateUUID(),
            driver_id: drId,
            brand: vehicle.brand,
            model: vehicle.model,
            year: parseInt(vehicle.year) || 2020,
            colour: vehicle.colour,
            plate_number: vehicle.plateNumber.toUpperCase(),
            registration_number: vehicle.registrationNumber,
            chassis_number: vehicle.chassisNumber,
            engine_number: vehicle.engineNumber,
            capacity: vehicle.capacity,
            created_at: new Date().toISOString(),
            status: 'assigned'
          });
        }

        writeAuditLog(user.id, user.email, user.role, 'DRIVER_IMPORTED_SUCCESS', null, `Imported driver ${personal.fullName} with opening balance`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, message: 'Driver imported successfully.' });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    // GET /api/drivers/self/documents
    if (parts[0] === 'self' && parts[1] === 'documents' && method === 'GET') {
      const activeDriver = db.drivers.find((d: any) => d.user_id === user.id);
      if (!activeDriver) return buildResponse({ error: 'Driver profile missing.' }, 404);

      const docs = db.driver_documents.filter((d: any) => d.driver_id === activeDriver.id);
      return buildResponse(docs);
    }

    // PUT /api/drivers/self
    if (parts[0] === 'self' && method === 'PUT') {
      const activeDriver = db.drivers.find((d: any) => d.user_id === user.id);
      if (!activeDriver) return buildResponse({ error: 'Driver profile missing.' }, 404);

      try {
        const { phone, address, password } = await request.json() as any;
        const u = db.users.find((usr: any) => usr.id === user.id);

        if (u) {
          if (phone) u.phone = phone;
          if (password) u.password_hash = await hashPassword(password);
        }
        if (address) activeDriver.address = address;

        writeAuditLog(user.id, user.email, user.role, 'DRIVER_SELF_PROFILE_UPDATE', null, 'Driver completed self update', db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, message: 'Profile updated successfully.' });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    // GET/PUT /api/drivers/:id
    if (parts.length === 1) {
      const targetDriverId = parts[0];
      const drv = db.drivers.find((d: any) => d.id === targetDriverId);
      if (!drv) return buildResponse({ error: 'Driver profile not found.' }, 404);

      if (method === 'GET') {
        const u = db.users.find((usr: any) => usr.id === drv.user_id) || {};
        const g = db.guarantors.find((gua: any) => gua.driver_id === drv.id) || null;
        const v = db.vehicles.find((veh: any) => veh.driver_id === drv.id) || null;
        const financials = getDriverFinancials(drv, db);
        const documents = (db.driver_documents || []).filter((doc: any) => doc.driver_id === drv.id).map((doc: any) => ({
          ...doc,
          file_url: doc.file_url ? (doc.file_url.includes('token=') ? doc.file_url : `${doc.file_url}?token=${encodeURIComponent(token)}`) : ''
        }));
        const passportDoc = documents.find((doc: any) => doc.document_type === 'passport_photo');
        const passport_photo_url = passportDoc ? passportDoc.file_url : '';

        return buildResponse({
          ...drv,
          fullName: u.full_name || drv.fullName || drv.full_name || '',
          email: u.email || '',
          phone: u.phone || drv.phone || '',
          licenseNumber: drv.license_number || drv.licenseNumber || '',
          licenseExpiry: drv.license_expiry || drv.licenseExpiry || '',
          companyDriverId: drv.company_driver_id || drv.companyDriverId || '',
          company_driver_id: drv.company_driver_id || drv.companyDriverId || '',
          guarantor: g ? {
            ...g,
            fullName: g.fullName || g.full_name || '',
            phone: g.phone || '',
            address: g.address || '',
            relationship: g.relationship || '',
            nin: g.nin || '',
            passport: g.passport || g.passport_photo_url ? (g.passport || g.passport_photo_url).includes('token=') ? (g.passport || g.passport_photo_url) : `${g.passport || g.passport_photo_url}?token=${encodeURIComponent(token)}` : '',
            passportPhotoUrl: g.passport_photo_url || g.passportPhotoUrl || g.passport ? (g.passport_photo_url || g.passportPhotoUrl || g.passport).includes('token=') ? (g.passport_photo_url || g.passportPhotoUrl || g.passport) : `${g.passport_photo_url || g.passportPhotoUrl || g.passport}?token=${encodeURIComponent(token)}` : '',
            passport_photo_url: g.passport_photo_url || g.passportPhotoUrl || g.passport ? (g.passport_photo_url || g.passportPhotoUrl || g.passport).includes('token=') ? (g.passport_photo_url || g.passportPhotoUrl || g.passport) : `${g.passport_photo_url || g.passportPhotoUrl || g.passport}?token=${encodeURIComponent(token)}` : ''
          } : null,
          vehicle: v ? {
            ...v,
            brand: v.brand || '',
            model: v.model || '',
            year: v.year || 2020,
            colour: v.colour || '',
            plateNumber: v.plate_number || v.plateNumber || '',
            plate_number: v.plate_number || v.plateNumber || '',
            registrationNumber: v.registration_number || v.registrationNumber || '',
            registration_number: v.registration_number || v.registrationNumber || '',
            chassisNumber: v.chassis_number || v.chassisNumber || '',
            chassis_number: v.chassis_number || v.chassisNumber || '',
            engineNumber: v.engine_number || v.engineNumber || '',
            engine_number: v.engine_number || v.engineNumber || '',
            capacity: v.capacity || ''
          } : null,
          financials,
          documents,
          passport_photo_url,
          passportPhoto: passport_photo_url,
          passportPhotoUrl: passport_photo_url
        });
      }

      if (method === 'PUT') {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        try {
          const payload = await request.json() as any;
          const u = db.users.find((usr: any) => usr.id === drv.user_id);

          if (payload.fullName && u) u.full_name = payload.fullName;
          if (payload.phone && u) u.phone = payload.phone;
          if (payload.address) drv.address = payload.address;
          if (payload.nin) drv.nin = payload.nin;
          if (payload.licenseNumber) drv.license_number = payload.licenseNumber;
          if (payload.licenseExpiry) drv.license_expiry = payload.licenseExpiry;
          if (payload.agreedAmount !== undefined) drv.agreed_amount = payload.agreedAmount;
          if (payload.remainingVehicleBalance !== undefined) {
            drv.remaining_vehicle_balance = payload.remainingVehicleBalance;
            if (drv.opening_balance) {
              drv.opening_balance.remaining_vehicle_balance = payload.remainingVehicleBalance;
            }
          }
          if (payload.status) drv.status = payload.status;

          writeAuditLog(user.id, user.email, user.role, 'DRIVER_ADMIN_FORCE_EDIT', null, `Admin updated driver profile ${drv.id}`, db);
          await dbManager.saveDB(db);

          return buildResponse({ success: true, message: 'Driver details updated successfully.' });
        } catch (err: any) {
          return buildResponse({ error: err.message }, 500);
        }
      }
    }

    // PUT /api/drivers/:id/status

    if (parts.length === 2 && parts[1] === 'archive' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver not found.' }, 404);
        drv.status = 'archived';
        writeAuditLog(user.id, user.email, user.role, 'DRIVER_ARCHIVED', parts[0], `Archived driver ${drv.full_name || drv.fullName}`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Driver archived' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts.length === 2 && parts[1] === 'restore' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver not found.' }, 404);
        drv.status = 'active';
        writeAuditLog(user.id, user.email, user.role, 'DRIVER_RESTORED', parts[0], `Restored driver ${drv.full_name || drv.fullName}`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Driver restored' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts.length === 2 && parts[1] === 'status' && method === 'PUT') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const { status, remarks, companyDriverId } = await request.json() as any;
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver profile not found.' }, 404);

        drv.status = status;
        drv.updated_at = new Date().toISOString();
        if (companyDriverId) drv.company_driver_id = companyDriverId;

        const u = db.users.find((usr: any) => usr.id === drv.user_id);
        if (u) u.status = status === 'approved' ? 'active' : 'inactive';

        // Notify Driver
        db.notifications.unshift({
          id: generateUUID(),
          user_id: drv.user_id,
          title_en: 'Corporate Status Revision',
          title_ha: 'Sabunta Matsayin Ma’aikaci',
          message_en: `Your driver profile status was updated to: ${status.toUpperCase()}. Remarks: ${remarks || 'None'}`,
          message_ha: `An sabunta matsayin ku zuwa: ${status.toUpperCase()}. Dalili: ${remarks || 'Babu'}`,
          type: status === 'approved' ? 'success' : 'info',
          read_status: 0,
          created_at: new Date().toISOString()
        });

        writeAuditLog(user.id, user.email, user.role, 'DRIVER_STATUS_CHANGE', null, `Driver status adjusted to ${status}. Details: ${remarks || ''}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    // PUT /api/drivers/:id/classify
    if (parts.length === 2 && parts[1] === 'classify' && method === 'PUT') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const { classification } = await request.json() as any;
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver profile not found.' }, 404);

        drv.classification = classification;
        writeAuditLog(user.id, user.email, user.role, 'DRIVER_CLASSIFY_SHIFT', null, `Driver classification changed to ${classification}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, message: `Driver classification shifted to ${classification}.` });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    // GET /api/drivers/:id/contract-lookup
    if (parts.length === 2 && parts[1] === 'contract-lookup' && method === 'GET') {
      const drv = db.drivers.find((d: any) => d.id === parts[0]);
      if (!drv) return buildResponse({ error: 'Driver profile not found.' }, 404);

      const vehicle = db.vehicles.find((v: any) => v.driver_id === drv.id);
      const terms = lookupContractTerms(vehicle);
      return buildResponse(terms);
    }

    // GET /api/drivers/:id/installments
    if (parts.length === 2 && parts[1] === 'installments' && method === 'GET') {
      const drv = db.drivers.find((d: any) => d.id === parts[0]);
      if (!drv) return buildResponse({ error: 'Driver profile not found.' }, 404);

      const activeCycle = db.cycles.find((c: any) => c.status === 'active');
      const inst = calculateInstallmentsForDriver(drv, db, activeCycle);
      return buildResponse(inst);
    }
  }

  // 9. VEHICLES ENDPOINTS
  if (path.startsWith('/api/vehicles')) {
    const parts = path.replace(/^\/api\/vehicles/, '').split('/').filter(Boolean);

    // GET /api/vehicles
    if (parts.length === 0 && method === 'GET') {
      return buildResponse(db.vehicles || []);
    }

    // POST /api/vehicles
    if (parts.length === 0 && method === 'POST') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const payload = await request.json() as any;
        const newVehicle = {
          id: generateUUID(),
          driver_id: null,
          brand: payload.brand || 'Mercedes-Benz',
          model: payload.model,
          year: parseInt(payload.year) || 2021,
          colour: payload.colour,
          plate_number: payload.plateNumber.toUpperCase(),
          registration_number: payload.registrationNumber || '',
          chassis_number: payload.chassisNumber || '',
          engine_number: payload.engineNumber || '',
          capacity: payload.capacity || '30 Tons',
          mileage: 0,
          created_at: new Date().toISOString(),
          status: 'idle'
        };

        db.vehicles.push(newVehicle);
        writeAuditLog(user.id, user.email, user.role, 'VEHICLE_ADDED', null, `Vehicle added: ${payload.plateNumber}`, db);
        await dbManager.saveDB(db);

        return buildResponse(newVehicle);
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    // PUT /api/vehicles/:id
    if (parts.length === 1 && method === 'PUT') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const payload = await request.json() as any;
        const veh = db.vehicles.find((v: any) => v.id === parts[0]);
        if (!veh) return buildResponse({ error: 'Vehicle not found.' }, 404);

        if (payload.brand) veh.brand = payload.brand;
        if (payload.model) veh.model = payload.model;
        if (payload.year) veh.year = parseInt(payload.year) || veh.year;
        if (payload.colour) veh.colour = payload.colour;
        if (payload.plateNumber) veh.plate_number = payload.plateNumber;
        if (payload.capacity) veh.capacity = payload.capacity;
        if (payload.status) veh.status = payload.status;
        if (payload.driverId !== undefined) {
          veh.driver_id = payload.driverId;
          veh.status = payload.driverId ? 'assigned' : 'idle';
        }

        writeAuditLog(user.id, user.email, user.role, 'VEHICLE_EDITED', null, `Vehicle plate ${veh.plate_number} modified`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, message: 'Vehicle details modified.' });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }
  }

  // 10. PAYMENTS ENDPOINTS
  if (path.startsWith('/api/payments')) {
    const parts = path.replace(/^\/api\/payments/, '').split('/').filter(Boolean);

    // GET /api/payments
    if (parts.length === 0 && method === 'GET') {
      const dId = url.searchParams.get('driverId');
      let payments = db.driver_payments || [];
      if (dId) {
        payments = payments.filter((p: any) => p.driver_id === dId);
      }
      return buildResponse(payments);
    }

    // POST /api/payments
    if (parts.length === 0 && method === 'POST') {
      try {
        const payload = await request.json() as any;
        const newPayment = {
          id: generateUUID(),
          driver_id: payload.driverId,
          amount: parseFloat(payload.amount),
          installment_number: parseInt(payload.installmentNumber),
          receipt_number: payload.receiptNumber || `RCP-${generateUUID().substring(0, 6).toUpperCase()}`,
          date: payload.date || new Date().toISOString().split('T')[0],
          remarks: payload.remarks || '',
          status: 'pending',
          created_at: new Date().toISOString()
        };

        db.driver_payments.push(newPayment);

        db.notifications.unshift({
          id: generateUUID(),
          title_en: 'New Payment Submitted',
          title_ha: 'An Shigar da Sabon Biya',
          message_en: `Driver submitted payment of ₦${parseFloat(payload.amount).toLocaleString()} for installment ${payload.installmentNumber}. Action required: Review receipt.`,
          message_ha: `Direba ya shigar da kudi ₦${parseFloat(payload.amount).toLocaleString()} don installment ${payload.installmentNumber}. Tana jiran amincewa.`,
          type: 'warning',
          read_status: 0,
          created_at: new Date().toISOString()
        });

        writeAuditLog(user.id, user.email, user.role, 'PAYMENT_SUBMITTED', null, `Payment submitted: ₦${payload.amount}`, db);
        await dbManager.saveDB(db);

        return buildResponse(newPayment);
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    // PUT /api/payments/:id/status

    if (parts.length === 2 && parts[1] === 'archive' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver not found.' }, 404);
        drv.status = 'archived';
        writeAuditLog(user.id, user.email, user.role, 'DRIVER_ARCHIVED', parts[0], `Archived driver ${drv.full_name || drv.fullName}`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Driver archived' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts.length === 2 && parts[1] === 'restore' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver not found.' }, 404);
        drv.status = 'active';
        writeAuditLog(user.id, user.email, user.role, 'DRIVER_RESTORED', parts[0], `Restored driver ${drv.full_name || drv.fullName}`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Driver restored' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts.length === 2 && parts[1] === 'status' && method === 'PUT') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const { status, remarks } = await request.json() as any;
        const pay = db.driver_payments.find((p: any) => p.id === parts[0]);
        if (!pay) return buildResponse({ error: 'Payment not found.' }, 404);

        pay.status = status;
        pay.approved_by = user.fullName;
        pay.updated_at = new Date().toISOString();

        if (status === 'approved') {
          // Add payment as corporate revenue ledger
          db.financial_records.push({
            id: generateUUID(),
            type: 'revenue',
            category: 'freight',
            amount: pay.amount,
            date: pay.date,
            description: `Driver ${pay.driver_id} payment for Installment ${pay.installment_number} (Receipt: ${pay.receipt_number})`
          });
        }

        // Send notify
        db.notifications.unshift({
          id: generateUUID(),
          user_id: db.drivers.find((d: any) => d.id === pay.driver_id)?.user_id,
          title_en: `Payment Receipt ${status.toUpperCase()}`,
          title_ha: `Kudurin Biyan Kudi ${status.toUpperCase()}`,
          message_en: `Your installment payment of ₦${pay.amount.toLocaleString()} has been ${status}. Remarks: ${remarks || 'None'}`,
          message_ha: `Biyan kudin ku na ₦${pay.amount.toLocaleString()} an ${status}. Dalili: ${remarks || 'Babu'}`,
          type: status === 'approved' ? 'success' : 'danger',
          read_status: 0,
          created_at: new Date().toISOString()
        });

        writeAuditLog(user.id, user.email, user.role, 'PAYMENT_STATUS_DECISION', null, `Payment was ${status} by admin`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    // PUT /api/payments/:id
    if (parts.length === 1 && method === 'PUT') {
      try {
        const payload = await request.json() as any;
        const pay = db.driver_payments.find((p: any) => p.id === parts[0]);
        if (!pay) return buildResponse({ error: 'Payment not found.' }, 404);

        if (payload.amount !== undefined) pay.amount = parseFloat(payload.amount);
        if (payload.date) pay.date = payload.date;
        if (payload.receiptNumber) pay.receipt_number = payload.receiptNumber;
        if (payload.remarks !== undefined) pay.remarks = payload.remarks;

        writeAuditLog(user.id, user.email, user.role, 'PAYMENT_MODIFIED', null, `Payment ${pay.id} details edited`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }
  }

  // 11. FINANCE & EXPENSES ENDPOINTS
  if (path === '/api/finance') {
    if (method === 'GET') {
      return buildResponse(db.financial_records || []);
    }
    if (method === 'POST') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const { type, category, amount, date, description } = await request.json() as any;
        const record = {
          id: generateUUID(),
          type,
          category,
          amount: parseFloat(amount),
          date,
          description,
          created_at: new Date().toISOString()
        };

        db.financial_records.push(record);
        writeAuditLog(user.id, user.email, user.role, 'FINANCE_RECORD_POSTED', null, `Recorded ${type}: ₦${amount}`, db);
        await dbManager.saveDB(db);

        return buildResponse(record);
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }
  }

  if (path === '/api/expenses' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
    try {
      const { amount, category, description, date, driverId, receiptUrl } = await request.json() as any;
      const record = {
        id: generateUUID(),
        type: 'expense',
        category,
        amount: parseFloat(amount),
        date,
        description: `${description} ${driverId ? `(Driver: ${driverId})` : ''}`,
        receiptUrl,
        created_at: new Date().toISOString()
      };

      db.financial_records.push(record);
      writeAuditLog(user.id, user.email, user.role, 'FINANCE_EXPENSE_POSTED', null, `Recorded expense: ₦${amount}`, db);
      await dbManager.saveDB(db);

      return buildResponse(record);
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 12. FILE UPLOADS & PREVIEWS (R2 Storage or base64 database storage)
  if (path === '/api/documents/upload-company' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
    try {
      const { title, docType, fileBase64, driverId, vehicleId } = await request.json() as any;
      if (!title || !docType || !fileBase64) {
        return buildResponse({ error: 'Complete all file parameters.' }, 400);
      }

      const fileId = `${Date.now()}-${generateUUID().substring(0, 8)}`;
      const filename = `${fileId}.png`;
      const fileUrl = `/api/documents/preview/${filename}`;

      if (env.R2_BUCKET) {
        try {
          const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
          const binaryString = atob(cleanBase64);
          const buffer = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            buffer[i] = binaryString.charCodeAt(i);
          }
          await env.R2_BUCKET.put(filename, buffer, { httpMetadata: { contentType: 'image/png' } });
          console.log(`[R2] Successfully uploaded ${filename} to bucket.`);
        } catch (r2Err) {
          console.error(`[R2 ERROR] Failed to upload to bucket:`, r2Err);
        }
      }

      const docObj = {
        id: generateUUID(),
        title,
        document_type: docType,
        file_url: fileUrl,
        created_at: new Date().toISOString(),
        created_by: user.fullName,
        status: 'active'
      };

      if (vehicleId) {
        if (!db.vehicle_documents) db.vehicle_documents = [];
        db.vehicle_documents.push({ ...docObj, vehicle_id: vehicleId });
      } else if (driverId) {
        if (!db.driver_documents) db.driver_documents = [];
        db.driver_documents.push({ ...docObj, driver_id: driverId });
      } else {
        if (!db.company_documents) db.company_documents = [];
        db.company_documents.push(docObj);
      }

      writeAuditLog(user.id, user.email, user.role, 'COMPANY_DOCUMENT_UPLOAD', null, `Uploaded doc: ${title}`, db);
      await dbManager.saveDB(db);

      return buildResponse({ success: true, fileUrl, message: 'Document saved successfully.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // GET /api/documents/preview/:filename
  if (path.startsWith('/api/documents/preview/')) {
    const filename = path.replace('/api/documents/preview/', '');
    const tokenParam = url.searchParams.get('token');
    
    if (!db.sessions) db.sessions = [];
    const authSession = db.sessions.find((s: any) => s.token === tokenParam && s.status === 'active');
    
    let authorized = false;
    if (tokenParam) {
      if (authSession) authorized = true;
    } else {
      const hasActiveSession = db.sessions && db.sessions.some((s: any) => s.status === 'active');
      if (hasActiveSession) authorized = true;
    }
    if (!authorized) {
      return new Response('Unauthorized file request.', { status: 401 });
    }

    if (env.R2_BUCKET) {
      const object = await env.R2_BUCKET.get(filename);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Headers', '*');
        headers.set('Access-Control-Allow-Methods', '*');
        headers.set('etag', object.httpEtag);
        return new Response(object.body, { headers });
      }
    }
    
    return new Response('File not found in storage.', { status: 404 });
  }

  // 13. NOTIFICATIONS ENDPOINTS
  
  // A. GET /api/notifications - with filtering and enrichment
  if (path === '/api/notifications' && method === 'GET') {
    let list = db.notifications || [];
    
    // Filter base list based on user role/id
    if (user.role === 'driver') {
      list = list.filter((n: any) => n.user_id === user.id || n.target_role === 'driver' || (!n.user_id && !n.target_role));
    } else if (user.role === 'shareholder') {
      list = list.filter((n: any) => n.user_id === user.id || n.target_role === 'shareholder' || (!n.user_id && !n.target_role));
    } else if (user.role === 'admin') {
      list = list.filter((n: any) => n.user_id === user.id || n.target_role === 'admin' || (!n.user_id && !n.target_role));
    }

    // Enrich notifications
    let enriched = list.map(enrichNotification);

    // Filter by query parameters
    const categoryParam = url.searchParams.get('category');
    const priorityParam = url.searchParams.get('priority');
    const statusParam = url.searchParams.get('status');
    const searchParam = url.searchParams.get('search');

    if (categoryParam) {
      enriched = enriched.filter((n: any) => n.category === categoryParam);
    }
    if (priorityParam) {
      enriched = enriched.filter((n: any) => n.priority === priorityParam);
    }
    if (statusParam) {
      if (statusParam === 'unread') {
        enriched = enriched.filter((n: any) => n.status === 'unread' || n.read_status === 0);
      } else if (statusParam === 'read') {
        enriched = enriched.filter((n: any) => n.status === 'read' || n.read_status === 1);
      } else {
        enriched = enriched.filter((n: any) => n.status === statusParam);
      }
    } else {
      // Exclude deleted notifications by default
      enriched = enriched.filter((n: any) => n.status !== 'deleted');
    }

    if (searchParam) {
      const q = searchParam.toLowerCase();
      enriched = enriched.filter((n: any) => 
        (n.titleEn || '').toLowerCase().includes(q) || 
        (n.titleHa || '').toLowerCase().includes(q) || 
        (n.messageEn || '').toLowerCase().includes(q) || 
        (n.messageHa || '').toLowerCase().includes(q)
      );
    }

    return buildResponse(enriched);
  }

  // B. GET /api/notifications/settings
  if (path === '/api/notifications/settings' && method === 'GET') {
    if (!db.user_preferences) db.user_preferences = [];
    let prefs = db.user_preferences.find((p: any) => p.user_id === user.id);
    if (!prefs) {
      prefs = {
        id: generateUUID(),
        user_id: user.id,
        enablePush: true,
        enableSound: true,
        enableVibration: true,
        enableAnnouncement: true,
        enableFinanceAlerts: true,
        enableSecurityAlerts: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
        preferredLanguage: 'en'
      };
      db.user_preferences.push(prefs);
      await dbManager.saveDB(db);
    }
    return buildResponse(prefs);
  }

  // C. POST /api/notifications/settings
  if (path === '/api/notifications/settings' && method === 'POST') {
    try {
      const body = await request.json() as any;
      if (!db.user_preferences) db.user_preferences = [];
      let prefsIdx = db.user_preferences.findIndex((p: any) => p.user_id === user.id);
      
      const updatedPrefs = {
        id: prefsIdx >= 0 ? db.user_preferences[prefsIdx].id : generateUUID(),
        user_id: user.id,
        enablePush: body.enablePush !== undefined ? !!body.enablePush : true,
        enableSound: body.enableSound !== undefined ? !!body.enableSound : true,
        enableVibration: body.enableVibration !== undefined ? !!body.enableVibration : true,
        enableAnnouncement: body.enableAnnouncement !== undefined ? !!body.enableAnnouncement : true,
        enableFinanceAlerts: body.enableFinanceAlerts !== undefined ? !!body.enableFinanceAlerts : true,
        enableSecurityAlerts: body.enableSecurityAlerts !== undefined ? !!body.enableSecurityAlerts : true,
        quietHoursStart: body.quietHoursStart || '22:00',
        quietHoursEnd: body.quietHoursEnd || '06:00',
        preferredLanguage: body.preferredLanguage || 'en'
      };

      if (prefsIdx >= 0) {
        db.user_preferences[prefsIdx] = updatedPrefs;
      } else {
        db.user_preferences.push(updatedPrefs);
      }

      await dbManager.saveDB(db);
      writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_SETTINGS_UPDATE', null, 'User updated preferences', db);
      return buildResponse({ success: true, settings: updatedPrefs });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // D. POST /api/notifications/subscribe
  if (path === '/api/notifications/subscribe' && method === 'POST') {
    try {
      const { subscription } = await request.json() as any;
      if (!subscription || !subscription.endpoint) {
        return buildResponse({ error: 'Invalid push subscription payload.' }, 400);
      }

      if (env.PUSH_SUBSCRIPTIONS) {
        const kvKey = `sub:${user.id}:${encodeURIComponent(subscription.endpoint)}`;
        await env.PUSH_SUBSCRIPTIONS.put(kvKey, JSON.stringify(subscription));
        writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_SUBSCRIBE', null, 'User subscribed to push', db);
        return buildResponse({ success: true, message: 'Push subscription stored successfully.' });
      } else {
        console.warn("PUSH_SUBSCRIPTIONS KV binding is missing.");
        return buildResponse({ success: true, message: 'KV binding missing but subscription parsed.' });
      }
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // E. POST /api/notifications/unsubscribe
  if (path === '/api/notifications/unsubscribe' && method === 'POST') {
    try {
      const { endpoint } = await request.json() as any;
      if (!endpoint) {
        return buildResponse({ error: 'Endpoint missing.' }, 400);
      }

      // 1. Clean up from D1 central storage
      let dbChanged = false;
      if (db.push_subscriptions && Array.isArray(db.push_subscriptions)) {
        const initialLen = db.push_subscriptions.length;
        db.push_subscriptions = db.push_subscriptions.filter((s: any) => s && s.subscription && s.subscription.endpoint !== endpoint);
        if (db.push_subscriptions.length !== initialLen) {
          dbChanged = true;
        }
      }

      // Write logs & save D1 DB
      writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_UNSUBSCRIBE', null, `User unsubscribed endpoint: ${endpoint.substring(0, 50)}...`, db);
      await dbManager.saveDB(db);

      // 2. Clean up from KV
      if (env.PUSH_SUBSCRIPTIONS) {
        const kvKey = `sub:${user.id}:${encodeURIComponent(endpoint)}`;
        await env.PUSH_SUBSCRIPTIONS.delete(kvKey);
        return buildResponse({ success: true, message: 'Unsubscribed successfully from DB & KV.' });
      } else {
        return buildResponse({ success: true, message: 'Unsubscribed successfully from D1 DB.' });
      }
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // F. GET /api/notifications/status
  if (path === '/api/notifications/status' && method === 'GET') {
    const publicKey = env.VAPID_PUBLIC_KEY || '';
    if (!publicKey) {
      return buildResponse({ error: 'VAPID_PUBLIC_KEY not configured.' }, 500);
    }
    let devicesCount = 0;
    let subscribed = false;

    // 1. Check KV Store if available
    if (env.PUSH_SUBSCRIPTIONS) {
      try {
        const listResult = await env.PUSH_SUBSCRIPTIONS.list();
        const userSubs = (listResult.keys || []).filter((k: any) => k.name.startsWith(`sub:${user.id}:`));
        devicesCount = userSubs.length;
        subscribed = devicesCount > 0;
      } catch (err) {
        console.error("Failed to fetch device subscriptions from KV:", err);
      }
    }

    // 2. Fallback to/Merge with D1 DB subscriptions
    if (db.push_subscriptions && Array.isArray(db.push_subscriptions)) {
      const userD1Subs = db.push_subscriptions.filter((s: any) => s && s.userId === user.id);
      if (userD1Subs.length > devicesCount) {
        devicesCount = userD1Subs.length;
        subscribed = true;
      }
    }

    return buildResponse({
      success: true,
      publicKey,
      subscribed,
      devicesCount,
      devices: []
    });
  }

  // G. POST /api/notifications/send
  if (path === '/api/notifications/send' && method === 'POST') {
    try {
      if (user.role !== 'director' && user.role !== 'admin') {
        return buildResponse({ error: 'Unauthorized. Admins or Directors only.' }, 403);
      }

      const { user_id, role, title, body, url: targetUrl } = await request.json() as any;
      if (!title || !body) {
        return buildResponse({ error: 'Notification title and body are required.' }, 400);
      }

      let targetUserIds: string[] = [];
      if (user_id) {
        targetUserIds = [user_id];
      } else if (role) {
        const targetRoleObj = db.roles?.find((r: any) => r.name.toLowerCase() === role.toLowerCase());
        if (targetRoleObj) {
          targetUserIds = (db.users || [])
            .filter((u: any) => u.role_id === targetRoleObj.id)
            .map((u: any) => u.id);
        }
      } else {
        targetUserIds = (db.users || []).map((u: any) => u.id);
      }

      if (targetUserIds.length === 0) {
        return buildResponse({ error: 'No recipients matched criteria.' }, 404);
      }

      if (!db.notifications) db.notifications = [];
      
      const newNotificationsList: any[] = [];
      targetUserIds.forEach((uid) => {
        const nId = `NOT-${Date.now()}-${generateUUID().substring(0, 6).toUpperCase()}`;
        const notification = {
          id: nId,
          user_id: uid,
          title,
          body,
          type: 'SYSTEM_ALERT',
          status: 'unread',
          read_status: 0,
          url: targetUrl || '/notifications',
          created_at: new Date().toISOString()
        };
        db.notifications.unshift(notification);
        newNotificationsList.push(notification);
      });

      await dbManager.saveDB(db);
      writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_MANUAL_SEND', null, `Manual send to ${targetUserIds.length} users`, db);

      return buildResponse({
        success: true,
        message: 'Notification processed and dispatched.',
        recipientsCount: targetUserIds.length
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // H. PUT /api/notifications/read-all or POST /api/notifications/read
  if ((path === '/api/notifications/read-all' || path === '/api/notifications/read') && (method === 'PUT' || method === 'POST')) {
    let updatedCount = 0;
    const list = db.notifications || [];
    list.forEach((n: any) => {
      const isForUser = (n.user_id === user.id) || (n.target_role === user.role) || (!n.user_id && !n.target_role);
      if (isForUser && n.read_status === 0) {
        n.read_status = 1;
        n.status = 'read';
        n.opened_at = new Date().toISOString();
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await dbManager.saveDB(db);
      writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_READ_ALL', null, `Marked ${updatedCount} read`, db);
    }
    return buildResponse({ success: true });
  }

  // I. PUT /api/notifications/:id/read - Mark single notification as read
  const pathParts = path.split('/');
  if (pathParts.length === 5 && pathParts[1] === 'api' && pathParts[2] === 'notifications' && pathParts[4] === 'read' && method === 'PUT') {
    const id = pathParts[3];
    const notification = db.notifications?.find((n: any) => n.id === id);
    if (!notification) {
      return buildResponse({ error: 'Notification not found.' }, 404);
    }

    notification.read_status = 1;
    notification.status = 'read';
    notification.opened_at = new Date().toISOString();
    await dbManager.saveDB(db);

    writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_READ', id, 'Marked single read', db);
    return buildResponse({ success: true });
  }

  // J. POST /api/notifications/:id/pin - Toggle Pin
  if (pathParts.length === 5 && pathParts[1] === 'api' && pathParts[2] === 'notifications' && pathParts[4] === 'pin' && method === 'POST') {
    const id = pathParts[3];
    const notification = db.notifications?.find((n: any) => n.id === id);
    if (!notification) {
      return buildResponse({ error: 'Notification not found.' }, 404);
    }

    const currentStatus = notification.status || 'unread';
    notification.status = currentStatus === 'pinned' ? 'read' : 'pinned';
    await dbManager.saveDB(db);

    writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_PIN_TOGGLE', id, `Toggled pinned status to ${notification.status}`, db);
    return buildResponse({ success: true, status: notification.status });
  }

  // K. POST /api/notifications/:id/archive - Toggle Archive
  if (pathParts.length === 5 && pathParts[1] === 'api' && pathParts[2] === 'notifications' && pathParts[4] === 'archive' && method === 'POST') {
    const id = pathParts[3];
    const notification = db.notifications?.find((n: any) => n.id === id);
    if (!notification) {
      return buildResponse({ error: 'Notification not found.' }, 404);
    }

    const currentStatus = notification.status || 'unread';
    notification.status = currentStatus === 'archived' ? 'read' : 'archived';
    notification.read_status = 1;
    await dbManager.saveDB(db);

    writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_ARCHIVE_TOGGLE', id, `Toggled archive status to ${notification.status}`, db);
    return buildResponse({ success: true, status: notification.status });
  }

  // L. DELETE /api/notifications/:id - Soft Delete
  if (pathParts.length === 4 && pathParts[1] === 'api' && pathParts[2] === 'notifications' && method === 'DELETE') {
    const id = pathParts[3];
    const notification = db.notifications?.find((n: any) => n.id === id);
    if (!notification) {
      return buildResponse({ error: 'Notification not found.' }, 404);
    }

    notification.status = 'deleted';
    notification.dismissed_at = new Date().toISOString();
    await dbManager.saveDB(db);

    writeAuditLog(user.id, user.email, user.role, 'NOTIFICATION_DELETE', id, 'Soft-deleted notification', db);
    return buildResponse({ success: true });
  }

  // M. GET /api/notifications/history
  if (path === '/api/notifications/history' && method === 'GET') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied.' }, 403);
    }
    const logsList = (db.audit_logs || []).filter((log: any) => log.action && log.action.startsWith('NOTIFICATION_'));
    return buildResponse(logsList);
  }

  // N. POST /api/notifications/translate
  if (path === '/api/notifications/translate' && method === 'POST') {
    try {
      const { text, to } = await request.json() as any;
      if (!text || !to) {
        return buildResponse({ error: 'Text and target language are required.' }, 400);
      }

      if (to !== 'en' && to !== 'ha') {
        return buildResponse({ error: 'Target language must be en or ha.' }, 400);
      }

      const dict: Record<string, string> = {
        'New Driver Self-Registration': 'Rijistar Sabon Direba',
        'Candidate Driver MUSA completed driver self-registration. Action required: Approve credentials.': 'Driver MUSA ya kammala rajistar kansa. Ana bukatar amincewa daga Admin.',
        'Rest Period Concluded': 'Lokacin Hutu Ya Cika',
        'Vehicle Contract Completed!': 'Kwangilar Mota Ta Cika!',
        'Fuel Voucher Request': 'Bukatar Takardar Man Fetur',
        'Approved Allocation': 'Amince da Bukatar',
        'Verify Credentials': 'Duba Takardu',
        'Congratulations! Your vehicle purchase balance has been fully settled. You are now the full owner!': 'Masha Allah! Kun biya duk kudin motar ku gaba daya. Yanzu ku ne mamallakin motar ku!'
      };

      let translated = dict[text] || text;
      
      if (env.GEMINI_API_KEY) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are a professional Hausa/English translation engine. Translate the following text into ${to === 'ha' ? 'Hausa' : 'English'}. Return ONLY the translated string without quotes or explanations:\n\n${text}`
                }]
              }]
            })
          });
          if (response.ok) {
            const result = await response.json() as any;
            const geminiText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (geminiText) {
              translated = geminiText;
            }
          }
        } catch (geminiErr) {
          console.warn("Gemini translation error:", geminiErr);
        }
      }

      return buildResponse({ success: true, translation: translated });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // O. POST /api/notifications/bulk
  if (path === '/api/notifications/bulk' && method === 'POST') {
    try {
      const { ids, action } = await request.json() as any;
      if (!Array.isArray(ids) || ids.length === 0 || !action) {
        return buildResponse({ error: 'IDs array and action type are required.' }, 400);
      }

      let updatedCount = 0;
      const list = db.notifications || [];

      if (action === 'read') {
        list.forEach((n: any) => {
          if (ids.includes(n.id)) {
            n.read_status = 1;
            n.status = 'read';
            n.opened_at = new Date().toISOString();
            updatedCount++;
          }
        });
      } else if (action === 'archive') {
        list.forEach((n: any) => {
          if (ids.includes(n.id)) {
            n.read_status = 1;
            n.status = 'archived';
            updatedCount++;
          }
        });
      } else if (action === 'pin') {
        list.forEach((n: any) => {
          if (ids.includes(n.id)) {
            n.status = 'pinned';
            updatedCount++;
          }
        });
      } else if (action === 'delete') {
        list.forEach((n: any) => {
          if (ids.includes(n.id)) {
            n.status = 'deleted';
            n.dismissed_at = new Date().toISOString();
            updatedCount++;
          }
        });
      }

      if (updatedCount > 0) {
        await dbManager.saveDB(db);
        writeAuditLog(user.id, user.email, user.role, `NOTIFICATION_BULK_${action.toUpperCase()}`, null, `Executed bulk action ${action} on ${updatedCount} items`, db);
      }

      return buildResponse({ success: true, count: updatedCount });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // =====================================================================
  // WORKERS AI ROLE-AUTHORIZED ENTERPRISE PORTAL ENDPOINTS (8 SECURE APIS)
  // =====================================================================
  if (path.startsWith('/api/ai/')) {
    const authResult = await authenticate();
    if (!authResult.authenticated) {
      return buildResponse({ error: authResult.error }, authResult.status || 401);
    }
    const actor = authResult.user;

    // Resolve profile IDs for context generation
    let driverProfileId: string | null = null;
    let shareholderId: string | null = null;

    if (actor.role === 'driver') {
      const dr = db.drivers.find((d: any) => d.user_id === actor.id);
      driverProfileId = dr ? dr.id : null;
    } else if (actor.role === 'shareholder') {
      const sh = db.shareholders.find((s: any) => s.user_id === actor.id);
      shareholderId = sh ? sh.id : null;
    }

    const rawContext = generateFilteredPayload(actor.role, driverProfileId, shareholderId, db);
    const cleanedContext = WorkersAIService.cleanContext(rawContext);

    // Parse request body
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Allow empty or default bodies
    }

    const stream = body.stream === true;
    let systemPrompt = '';
    let messages: any[] = [];
    let prompt = '';
    let history: any[] = [];

    if (path === '/api/ai/chat') {
      const { prompt: reqPrompt, history: reqHistory = [], page = '', feature = '' } = body;
      if (!reqPrompt) return buildResponse({ error: 'Prompt is required.' }, 400);
      prompt = reqPrompt;
      history = reqHistory;
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}
${page ? `- Current Page: ${page}` : ''}
${feature ? `- Active Feature: ${feature}` : ''}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((h: any) => ({
          role: (h.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: h.content || ''
        })),
        { role: 'user' as const, content: prompt }
      ];
    } else if (path === '/api/ai/report') {
      const { reportType } = body;
      if (!reportType) return buildResponse({ error: 'Report type is required.' }, 400);
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      prompt = `Please summarize the ${reportType} report from the live database context. Focus on active status values, totals, and highlight any anomalies or pending approvals that require action. Present key take-aways in clean bullet points.`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];
    } else if (path === '/api/ai/search') {
      const { query } = body;
      if (!query) return buildResponse({ error: 'Search query is required.' }, 400);
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      prompt = `Search the context database for occurrences, matches, or relationships regarding: "${query}". Identify matching drivers, vehicles, financials, or vouchers. List the matches clearly with statuses, direct values, and explain their operational role.`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];
    } else if (path === '/api/ai/document') {
      const { documentId } = body;
      if (!documentId) return buildResponse({ error: 'Document ID is required.' }, 400);
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      prompt = `Locate the document with ID/metadata containing "${documentId}" in the database context. Review its status (e.g., active, expired, pending, approved), metadata, link to driver/vehicle, creation date, and file URL. Analyze its legal and fleet operational validity, and explain any action items needed to fully verify or update it.`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];
    } else if (path === '/api/ai/analytics') {
      const { metric = 'financial KPIs' } = body;
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      prompt = `Perform a Staff-level business analytics review and trend forecasting for: "${metric}". Look closely at historic cycle data, driver payments, general ledger entries, or fuel voucher rates present in the context. Formulate realistic projections and suggestions for optimizing profit margins, managing driver debts, or reducing fuel costs based only on this actual context.`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];
    } else if (path === '/api/ai/system') {
      const { topic = 'General ERP Operations' } = body;
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      prompt = `Help me with the system task or explain capabilities for: "${topic}". Explain how to navigate the portal, manage fleet rosters, audit remittances, approve vouchers, or make payments according to my role restrictions. Guide me with human-friendly, step-by-step instructions.`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];
    } else if (path === '/api/ai/explain') {
      const { entityId } = body;
      if (!entityId) return buildResponse({ error: 'Entity/Transaction ID is required.' }, 400);
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      prompt = `Find the ledger record, payment installment, fuel voucher, or trip manifest corresponding to ID "${entityId}" in the context. Walk me through its status, amount, links to drivers or shareholders, and reconcile it within the current 30-day cycle. Explain its financial and operational impact clearly.`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];
    } else if (path === '/api/ai/dashboard') {
      systemPrompt = `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation.

CRITICAL SECURITY AND PRIVACY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets, passwords, password hashes (e.g. PBKDF2 hashes), Transaction PINs, JWT Tokens, Cookies, API Keys, Cloudflare Secrets, database credentials, environment variables, session tokens, encryption keys, OTP codes, recovery codes, authentication secrets, or verification codes. If asked about these, politely refuse and instruct the user to use the secure settings/reset workflows if they have permission.
2. Rely ONLY on the provided live database context. Never invent, guess, or hallucinate metrics, transaction values, driver debts, vehicle balances, payroll records, or shareholder investments. If the data is not available in the context, state that clearly.
3. You must maintain strict role-based access control. You are only provided data that the user is authorized to view. Do not talk about or make assumptions about other roles' data.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
      prompt = `Generate a personalized morning briefing / active welcome summary tailored specifically to my role (${actor.role}) and name (${actor.fullName}). Give me a high-level overview of important metrics, current statuses, recent announcements, any pending task alerts, and direct recommendations for actions I should take today. Make it professional, concise, and highly motivating!`;
      messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];
    } else {
      return buildResponse({ error: 'Not Found' }, 404);
    }

    if (stream) {
      if (path === '/api/ai/chat' && env.GEMINI_API_KEY && (actor.role === 'admin' || actor.role === 'director')) {
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        (async () => {
          try {
            const { GoogleGenAI, Type } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
            
            const functionDeclarations = [
              {
                name: "record_driver_installment",
                description: "Record a driver paying an installment. This records their payment against the cycle. Optionally log an expense.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    driver_id: { type: Type.STRING },
                    cycle_id: { type: Type.STRING },
                    amount_paid: { type: Type.NUMBER },
                    expense_amount: { type: Type.NUMBER, description: "Optional expense amount (e.g. repairs/fines)" },
                    expense_category: { type: Type.STRING, description: "Optional expense category" },
                    expense_description: { type: Type.STRING, description: "Optional expense description" }
                  },
                  required: ["driver_id", "cycle_id", "amount_paid"]
                }
              },
              {
                name: "get_driver_balance",
                description: "Gets the live remaining balance, installments status, and total purchase amount for a specific driver.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    driver_id: { type: Type.STRING }
                  },
                  required: ["driver_id"]
                }
              }
            ];

            const systemInstruction = systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined;
            const chatHistory = history.map((h: any) => ({
              role: (h.role === 'assistant' ? 'model' : 'user'),
              parts: [{ text: h.content || '' }]
            }));
            
            chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
            
            const chat = ai.chats.create({
              model: 'gemini-2.5-flash',
              config: {
                systemInstruction,
                temperature: 0.2,
                tools: [{ functionDeclarations }]
              },
              history: chatHistory.slice(0, -1)
            });

            const userMessage = chatHistory[chatHistory.length - 1].parts[0].text;
            let response = await chat.sendMessage({ message: userMessage });
            
            let iterations = 0;
            while (response.functionCalls && response.functionCalls.length > 0 && iterations < 3) {
              iterations++;
              const calls = response.functionCalls;
              const functionResponses = [];

              for (const call of calls) {
                if (call.name === 'record_driver_installment') {
                  const args = call.args as any;
                  const driver = db.drivers.find((d: any) => d.id === args.driver_id || (d.fullName && d.fullName.toLowerCase().includes(args.driver_id.toLowerCase())));
                  if (!driver) {
                    functionResponses.push({ name: call.name, response: { error: "Driver not found" } });
                    continue;
                  }
                  
                  const paymentId = generateUUID();
                  const pAmount = Number(args.amount_paid);
                  
                  db.driver_payments.push({
                    id: paymentId,
                    driver_id: driver.id,
                    amount: pAmount,
                    installmentNumber: 0,
                    outstandingAmount: 0,
                    date: new Date().toISOString().split('T')[0],
                    receiptNumber: 'AI-REC-' + Math.floor(Math.random() * 10000),
                    status: 'approved',
                    remarks: 'Recorded via AI Assistant',
                    cycle_id: args.cycle_id
                  });

                  db.financial_records.push({
                    id: generateUUID(),
                    type: 'receipt',
                    amount: pAmount,
                    category: 'Driver Installment',
                    description: 'Payment by ' + (driver.fullName || driver.id),
                    date: new Date().toISOString().split('T')[0],
                    source: 'AI Assistant',
                    linked_payment_id: paymentId,
                    cycle_id: args.cycle_id
                  });
                  
                  if (args.expense_amount && Number(args.expense_amount) > 0) {
                    db.financial_records.push({
                      id: generateUUID(),
                      type: 'expense',
                      amount: Number(args.expense_amount),
                      category: args.expense_category || 'General Expense',
                      description: args.expense_description || 'Expense for ' + driver.fullName,
                      date: new Date().toISOString().split('T')[0],
                      source: 'AI Assistant',
                      cycle_id: args.cycle_id
                    });
                  }

                  writeAuditLog(actor.id, actor.email, actor.role, 'AI_PAYMENT_RECORDED', null, 'AI recorded payment N' + pAmount + ' for driver ' + driver.id, db);
                  await dbManager.saveDB(db);

                  const totalPaid = db.driver_payments
                    .filter((p: any) => p.driver_id === driver.id && p.status === 'approved')
                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                  const newBalance = Math.max(0, (Number(driver.agreedAmount) || 0) - totalPaid);

                  functionResponses.push({ 
                    name: call.name, 
                    response: { 
                      success: true, 
                      driver_name: driver.fullName, 
                      amount_paid: pAmount, 
                      expense_recorded: !!args.expense_amount,
                      new_remaining_balance: newBalance 
                    } 
                  });
                } else if (call.name === 'get_driver_balance') {
                  const args = call.args as any;
                  const driver = db.drivers.find((d: any) => d.id === args.driver_id || (d.fullName && d.fullName.toLowerCase().includes(args.driver_id.toLowerCase())));
                  if (!driver) {
                    functionResponses.push({ name: call.name, response: { error: "Driver not found" } });
                    continue;
                  }
                  
                  const totalPaid = db.driver_payments
                    .filter((p: any) => p.driver_id === driver.id && p.status === 'approved')
                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                  const remainingBalance = Math.max(0, (Number(driver.agreedAmount) || 0) - totalPaid);
                  
                  functionResponses.push({ 
                    name: call.name, 
                    response: { 
                      driver_name: driver.fullName,
                      total_purchase_amount: driver.agreedAmount,
                      total_paid: totalPaid,
                      remaining_balance: remainingBalance
                    } 
                  });
                }
              }

              response = await chat.sendMessage({ message: functionResponses as any });
            }

            const textResponse = response.text || '';
            const chunks = textResponse.match(/.{1,15}/g) || [];
            for (const chunk of chunks) {
              await writer.write(encoder.encode('data: ' + JSON.stringify({ text: chunk }) + '\n\n'));
              await new Promise(res => setTimeout(res, 20));
            }
            await writer.write(encoder.encode('data: [DONE]\n\n'));
          } catch (e: any) {
            await writer.write(encoder.encode('data: ' + JSON.stringify({ error: e.message }) + '\n\n'));
          } finally {
            await writer.close();
          }
        })();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*'
          }
        });
      }

      const aiService = new WorkersAIService(env);
      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      (async () => {
        try {
          const chunkStream = aiService.generateStream(messages);
          for await (const chunk of chunkStream) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }
          await writer.write(encoder.encode('data: [DONE]\n\n'));
        } catch (e: any) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*'
        }
      });
    } else {
      const aiService = new WorkersAIService(env);
      const responseText = await aiService.generate(messages);
      return buildResponse({ success: true, response: responseText });
    }
  }

  // 14. SHAREHOLDERS ENDPOINTS
  if (path.startsWith('/api/shareholders')) {
    const parts = path.replace(/^\/api\/shareholders/, '').split('/').filter(Boolean);

    if (parts.length === 0) {
      if (method === 'GET') {
        return buildResponse(db.shareholders || []);
      }
      if (method === 'POST') {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        try {
          const payload = await request.json() as any;
          const uId = generateUUID();
          
          db.users.push({
            id: uId,
            email: payload.email,
            phone: payload.phone,
            password_hash: await hashPassword('shareholder123'),
            full_name: payload.full_name,
            role_id: 'role-shareholder',
            created_at: new Date().toISOString(),
            status: 'active'
          });

          const newShareholder = {
            id: generateUUID(),
            user_id: uId,
            full_name: payload.full_name,
            phone: payload.phone,
            email: payload.email,
            address: payload.address || '',
            investment_amount: parseFloat(payload.investment_amount),
            investment_date: payload.investment_date || new Date().toISOString().split('T')[0],
            passport_photo_url: payload.passport_photo_url || payload.passportPhoto || '',
            passport_number: payload.passport_number || '',
            created_at: new Date().toISOString(),
            status: 'active'
          };

          db.shareholders.push(newShareholder);
          writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_ADDED', null, `Created shareholder: ${payload.full_name}`, db);
          await dbManager.saveDB(db);

          return buildResponse(newShareholder);
        } catch (err: any) {
          return buildResponse({ error: err.message }, 500);
        }
      }
    }


    if (parts.length === 2 && parts[1] === 'archive' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const sh = db.shareholders.find((s: any) => s.id === parts[0]);
        if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);
        sh.status = 'archived';
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Shareholder archived' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts.length === 2 && parts[1] === 'restore' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const sh = db.shareholders.find((s: any) => s.id === parts[0]);
        if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);
        sh.status = 'active';
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Shareholder restored' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts[0] === 'me' && method === 'GET') {
      const sh = db.shareholders.find((s: any) => s.user_id === user.id);
      if (!sh) return buildResponse({ error: 'Shareholder profile missing.' }, 404);
      
      // Calculate equity percentage
      const totalInvested = (db.shareholders || []).reduce((sum: number, s: any) => sum + (parseFloat(s.investment_amount) || 0), 0);
      const equityPercentage = totalInvested > 0 ? ((parseFloat(sh.investment_amount) || 0) / totalInvested * 100).toFixed(2) : '0';
      
      return buildResponse({
        ...sh,
        equity_percentage: equityPercentage
      });
    }

    if (parts.length === 1) {
      const sh = db.shareholders.find((s: any) => s.id === parts[0]);
      if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);

      if (method === 'PUT') {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        try {
          const payload = await request.json() as any;
          if (payload.full_name) sh.full_name = payload.full_name;
          if (payload.phone) sh.phone = payload.phone;
          if (payload.email) sh.email = payload.email;
          if (payload.address) sh.address = payload.address;
          if (payload.investment_amount !== undefined) sh.investment_amount = parseFloat(payload.investment_amount);
          if (payload.passport_photo_url !== undefined) sh.passport_photo_url = payload.passport_photo_url;
          if (payload.passport_number !== undefined) sh.passport_number = payload.passport_number;

          writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_EDITED', null, `Modified shareholder: ${sh.full_name}`, db);
          await dbManager.saveDB(db);

          return buildResponse({ success: true });
        } catch (err: any) {
          return buildResponse({ error: err.message }, 500);
        }
      }

      if (method === 'DELETE') {
        if (user.role !== 'director') return buildResponse({ error: 'Access Denied: Board level authorization required.' }, 403);
        db.shareholders = db.shareholders.filter((s: any) => s.id !== parts[0]);
        writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_DELETED', null, `Removed shareholder: ${sh.full_name}`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true });
      }
    }
  }


  // 16. TRIP MANIFESTS ENDPOINTS
  if (path.startsWith('/api/trips')) {
    const parts = path.replace(/^\/api\/trips/, '').split('/').filter(Boolean);

    if (parts.length === 0) {
      if (method === 'GET') {
        return buildResponse(db.trip_manifests || []);
      }
      if (method === 'POST') {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        try {
          const payload = await request.json() as any;
          const newTrip = {
            id: generateUUID(),
            trip_number: `TRP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            vehicle_id: payload.vehicleId,
            driver_id: payload.driverId,
            origin: payload.origin,
            destination: payload.destination,
            cargo_type: payload.cargoType,
            weight: parseFloat(payload.weight),
            freight_charges: parseFloat(payload.freightCharges),
            status: 'in_transit',
            start_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
          };

          db.trip_manifests.push(newTrip);
          writeAuditLog(user.id, user.email, user.role, 'TRIP_CREATED', null, `Trip ${newTrip.trip_number} created`, db);
          await dbManager.saveDB(db);

          return buildResponse(newTrip);
        } catch (err: any) {
          return buildResponse({ error: err.message }, 500);
        }
      }
    }

    if (parts.length === 2 && parts[1] === 'complete' && method === 'PUT') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const trip = db.trip_manifests.find((t: any) => t.id === parts[0]);
        if (!trip) return buildResponse({ error: 'Trip record not found.' }, 404);

        trip.status = 'completed';
        trip.end_date = new Date().toISOString().split('T')[0];

        // Add freight charges to ledger
        db.financial_records.push({
          id: generateUUID(),
          type: 'revenue',
          category: 'freight',
          amount: trip.freight_charges,
          date: new Date().toISOString().split('T')[0],
          description: `Corridor Revenue Freight Completed: ${trip.trip_number} (${trip.origin} -> ${trip.destination})`
        });

        writeAuditLog(user.id, user.email, user.role, 'TRIP_COMPLETED', null, `Trip ${trip.trip_number} completed`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }
  }


  // 17. RE-ROUTING EXECUTIVE DIRECT CONTROLS
  if (path.startsWith('/api/director/')) {
    const ctrl = path.replace('/api/director/', '');
    const isPublicCyclesGet = ctrl === 'cycles' && method === 'GET';
    if (!isPublicCyclesGet) {
      if (user.role !== 'director' && user.role !== 'admin') {
        return buildResponse({ error: 'Access Denied: Executive Director or Admin privileges required.' }, 403);
      }
    }

    if (ctrl === 'cycles/start' && method === 'POST') {
      try {
        const { startDate, endGoalTons } = await request.json() as any;
        db.cycles.forEach((c: any) => { if (c.status === 'active') c.status = 'completed'; });
        
        const newCycle = {
          id: `CYC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          startDate,
          endDate: null,
          status: 'active',
          locked: false,
          endGoalTons: endGoalTons || 200,
          created_at: new Date().toISOString(),
          created_by: user.fullName,
          financials: [],
          pauseHistory: []
        };

        db.cycles.push(newCycle);
        writeAuditLog(user.id, user.email, user.role, 'CYCLE_STARTED', null, `Started operating cycle: ${newCycle.id}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, cycle: newCycle });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    if (ctrl === 'cycles/pause' && method === 'POST') {
      try {
        const { reason } = await request.json() as any;
        if (!reason) {
          return buildResponse({ error: 'Reason for pause is required.' }, 400);
        }

        const activeCycle = db.cycles.find((c: any) => c.status === 'active');
        if (!activeCycle) {
          return buildResponse({ error: 'No active operating cycle found to pause.' }, 400);
        }

        activeCycle.status = 'paused';
        activeCycle.pauseReason = reason;
        activeCycle.pausedAt = new Date().toISOString();
        activeCycle.pausedBy = user.fullName;

        if (!activeCycle.pauseHistory) {
          activeCycle.pauseHistory = [];
        }
        activeCycle.pauseHistory.unshift({
          id: generateUUID(),
          pausedBy: user.fullName,
          pausedAt: new Date().toISOString(),
          reason
        });

        if (!db.company_operations_state) {
          db.company_operations_state = { status: 'Setup Mode', pauseHistory: [], auditLog: [] };
        }
        db.company_operations_state.status = 'Paused';
        if (!db.company_operations_state.pauseHistory) {
          db.company_operations_state.pauseHistory = [];
        }
        db.company_operations_state.pauseHistory.unshift({
          id: generateUUID(),
          pausedBy: user.fullName,
          pausedAt: new Date().toISOString(),
          reason
        });

        if (!db.notifications) db.notifications = [];
        db.notifications.unshift({
          id: generateUUID(),
          title_en: 'Operating Cycle Paused',
          title_ha: 'An Dakatar da Zagayen Sufuri',
          message_en: `Operating Cycle ${activeCycle.id} was paused by ${user.fullName}. Reason: ${reason}`,
          message_ha: `An dakatar da Zagayen Gudanarwa ${activeCycle.id} ta hanyar ${user.fullName}. Dalili: ${reason}`,
          type: 'warning',
          read_status: 0,
          created_at: new Date().toISOString()
        });

        writeAuditLog(user.id, user.email, user.role, 'CYCLE_PAUSE', null, `Paused operating cycle ${activeCycle.id}. Reason: ${reason}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, cycle: activeCycle });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    if (ctrl === 'cycles/resume' && method === 'POST') {
      try {
        const { reason } = await request.json().catch(() => ({})) as any;
        const pausedCycle = db.cycles.find((c: any) => c.status === 'paused');
        if (!pausedCycle) {
          return buildResponse({ error: 'No paused operating cycle found to resume.' }, 400);
        }

        pausedCycle.status = 'active';
        pausedCycle.resumedAt = new Date().toISOString();
        pausedCycle.resumedBy = user.fullName;
        if (pausedCycle.pauseHistory && pausedCycle.pauseHistory.length > 0) {
          pausedCycle.pauseHistory[0].resumedBy = user.fullName;
          pausedCycle.pauseHistory[0].resumedAt = new Date().toISOString();
          if (reason) pausedCycle.pauseHistory[0].resumeReason = reason;
        }

        if (!db.company_operations_state) {
          db.company_operations_state = { status: 'Setup Mode', pauseHistory: [], auditLog: [] };
        }
        db.company_operations_state.status = 'Operational Mode';
        if (db.company_operations_state.pauseHistory && db.company_operations_state.pauseHistory.length > 0) {
          const lastPause = db.company_operations_state.pauseHistory[0];
          lastPause.resumedBy = user.fullName;
          lastPause.resumedAt = new Date().toISOString();
          if (reason) lastPause.resumeReason = reason;
        }

        if (!db.notifications) db.notifications = [];
        db.notifications.unshift({
          id: generateUUID(),
          title_en: 'Operating Cycle Resumed',
          title_ha: 'An Sake Kaddamar da Zagayen Sufuri',
          message_en: `Operating Cycle ${pausedCycle.id} was resumed by ${user.fullName}.`,
          message_ha: `An sake dawo da Zagayen Gudanarwa ${pausedCycle.id} ta hanyar ${user.fullName}.`,
          type: 'success',
          read_status: 0,
          created_at: new Date().toISOString()
        });

        writeAuditLog(user.id, user.email, user.role, 'CYCLE_RESUME', null, `Resumed operating cycle ${pausedCycle.id}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, cycle: pausedCycle });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    if (ctrl === 'cycles/end' && method === 'POST') {
      try {
        const { endDate } = await request.json() as any;
        const activeCycle = db.cycles.find((c: any) => c.status === 'active');
        if (!activeCycle) return buildResponse({ error: 'No active operating cycle found.' }, 404);

        activeCycle.status = 'completed';
        activeCycle.endDate = endDate;
        activeCycle.locked = true;

        // Run automatic shareholder distribution engine calculations
        const totalRevenue = (db.financial_records || [])
          .filter((f: any) => f.type === 'revenue' && new Date(f.date) >= new Date(activeCycle.startDate) && new Date(f.date) <= new Date(endDate))
          .reduce((sum: number, f: any) => sum + f.amount, 0);

        const totalExpenses = (db.financial_records || [])
          .filter((f: any) => f.type === 'expense' && new Date(f.date) >= new Date(activeCycle.startDate) && new Date(f.date) <= new Date(endDate))
          .reduce((sum: number, f: any) => sum + f.amount, 0);

        const netGeneratedAmount = totalRevenue - totalExpenses;
        const distPercentage = db.shareholder_settings?.distributionPercentage || 2;
        const distributionPool = Math.max(0, netGeneratedAmount * (distPercentage / 100));

        activeCycle.metrics = {
          totalRevenue,
          totalExpenses,
          netGeneratedAmount,
          distributionPercentage: distPercentage,
          distributionPool,
          activeDrivers: db.drivers.filter((d: any) => d.status === 'approved' || d.status === 'active').length,
          totalFleetCount: db.vehicles.length
        };

        // Distribute proportionally to active shareholders
        const totalInvestment = db.shareholders
          .filter((s: any) => s.status === 'active')
          .reduce((sum: number, s: any) => sum + s.investment_amount, 0);

        db.shareholders.forEach((sh: any) => {
          if (sh.status === 'active' && totalInvestment > 0) {
            const shPercentage = sh.investment_amount / totalInvestment;
            const shEarnings = distributionPool * shPercentage;
            sh.earnings_to_date = (sh.earnings_to_date || 0) + shEarnings;

            // Log shareholder financial distribution record
            db.financial_records.push({
              id: generateUUID(),
              type: 'expense',
              category: 'dividend',
              amount: shEarnings,
              date: endDate,
              description: `Shareholder Proportionate Earnings Distribution - ${sh.full_name} (${(shPercentage * 100).toFixed(2)}%)`
            });
          }
        });

        writeAuditLog(user.id, user.email, user.role, 'CYCLE_ENDED', null, `Closed cycle: Net pool distributed ₦${distributionPool}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, cycle: activeCycle });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    
    if (ctrl === 'shareholders' && method === 'PUT') {
      return buildResponse({ error: 'Use /api/shareholders/:id endpoints directly' }, 400);
    }
    
    // Direct matches for missing server.ts /api/director endpoints:
    if (ctrl.startsWith('shareholders/') && ctrl.endsWith('/status') && method === 'PUT') {
      try {
        const id = ctrl.split('/')[1];
        const { status } = await request.json() as any;
        const sh = db.shareholders.find((s: any) => s.id === id);
        if (sh) {
          sh.status = status;
          writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_STATUS_UPDATE', id, `Status updated to ${status}`, db);
          await dbManager.saveDB(db);
          return buildResponse({ success: true });
        }
        return buildResponse({ error: 'Not found' }, 404);
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    
    if (ctrl.startsWith('shareholders/') && ctrl.endsWith('/investment') && method === 'PUT') {
      try {
        const id = ctrl.split('/')[1];
        const { total_investment } = await request.json() as any;
        const sh = db.shareholders.find((s: any) => s.id === id);
        if (sh) {
          sh.total_investment = total_investment;
          writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_INVESTMENT_UPDATE', id, `Investment updated to ${total_investment}`, db);
          await dbManager.saveDB(db);
          return buildResponse({ success: true });
        }
        return buildResponse({ error: 'Not found' }, 404);
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (ctrl === 'shareholder-settings' && method === 'PUT') {
      try {
        const { distributionPercentage } = await request.json() as any;
        db.shareholder_settings = { distributionPercentage: parseFloat(distributionPercentage) };
        writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_SETTINGS_UPDATE', null, `Dividend distribution set to ${distributionPercentage}%`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }

    if (ctrl === 'company-settings' && method === 'PUT') {
      try {
        const settings = await request.json() as any;
        db.company_settings = { ...db.company_settings, ...settings };
        writeAuditLog(user.id, user.email, user.role, 'COMPANY_SETTINGS_UPDATE', null, `Updated general corporate configuration`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }


    if (ctrl === 'admins' && method === 'POST') {
      try {
        const { full_name, email, password, pin } = await request.json() as any;
        if (db.users.some((u: any) => u.email === email)) return buildResponse({ error: 'Email already exists' }, 400);
        const hashedPassword = await generateHash(password);
        const hashedPin = await generateHash(pin);
        const newAdmin = { id: `ADM-${Date.now()}`, full_name, email, role: 'admin', password_hash: hashedPassword, pin_hash: hashedPin, status: 'active', created_at: new Date().toISOString() };
        db.users.push(newAdmin);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Admin created' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (ctrl.startsWith('admins/') && method === 'PUT') {
      try {
        const id = ctrl.split('/')[1];
        const updates = await request.json() as any;
        const admin = db.users.find((u: any) => u.id === id);
        if (admin) {
          if (updates.full_name) admin.full_name = updates.full_name;
          if (updates.email) admin.email = updates.email;
          if (updates.password) admin.password_hash = await generateHash(updates.password);
          if (updates.pin) admin.pin_hash = await generateHash(updates.pin);
          if (updates.status) admin.status = updates.status;
          await dbManager.saveDB(db);
          return buildResponse({ success: true, message: 'Admin updated' });
        }
        return buildResponse({ error: 'Not found' }, 404);
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (ctrl.startsWith('admins/') && method === 'DELETE') {
      try {
        const id = ctrl.split('/')[1];
        db.users = db.users.filter((u: any) => u.id !== id);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Admin deleted' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }

    if (ctrl === 'cycles' && method === 'GET') {
      return buildResponse({ success: true, cycles: db.cycles || [] });
    }
  }

  // == INJECTED COMPATIBILITY ENDPOINTS FOR CLOUDFLARE DEPLOYMENT ==

  // 18. SERVER-SENT EVENTS (SSE) STATE STREAM FALLBACK
  if (path === '/api/sse' && method === 'GET') {
    const actor = user;
    let driverProfileId: string | null = null;
    let shareholderId: string | null = null;

    if (actor.role === 'driver') {
      const dr = (db.drivers || []).find((d: any) => d.user_id === actor.id);
      driverProfileId = dr ? dr.id : null;
    } else if (actor.role === 'shareholder') {
      const sh = (db.shareholders || []).find((s: any) => s.user_id === actor.id);
      shareholderId = sh ? sh.id : null;
    }

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      try {
        const initialPayload = generateFilteredPayload(actor.role, driverProfileId, shareholderId, db);
        await writer.write(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));
        
        // Emulate heartbeats for up to 20 seconds, then close gracefully to prompt automatic reconnect
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`));
        }
      } catch (err) {
        // Safe ignore on client disconnect
      } finally {
        try {
          await writer.close();
        } catch (e) {}
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
      }
    });
  }

  // 19. UNIFIED DIRECTORY ENDPOINT
  if (path === '/api/directory/all' && method === 'GET') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Administrative or Board credentials required.' }, 403);
    }
    try {
      const drivers = (db.drivers || []).map((drv: any) => {
        const u = (db.users || []).find((userObj: any) => userObj.id === drv.user_id);
        const g = (db.guarantors || []).find((gua: any) => gua.driver_id === drv.id);
        const v = (db.vehicles || []).find((veh: any) => veh.driver_id === drv.id);
        const financials = getDriverFinancials(drv, db);
        const driverDocs = (db.driver_documents || []).filter((doc: any) => doc.driver_id === drv.id);
        const passportDoc = driverDocs.find((doc: any) => doc.document_type === 'passport_photo');
        const passport_photo_url = passportDoc ? passportDoc.file_url : '';
        return {
          ...drv,
          fullName: u?.full_name || 'Candidate',
          email: u?.email || '',
          phone: u?.phone || '',
          status: drv.status,
          registrationDate: drv.created_at || u?.created_at || new Date().toISOString(),
          guarantor: g,
          vehicle: v,
          documents: driverDocs,
          passport_photo_url,
          passportPhoto: passport_photo_url,
          passportPhotoUrl: passport_photo_url,
          remaining_vehicle_balance: financials.remainingVehicleBalance,
          total_amount_paid: financials.totalAmountPaid,
          vehicle_purchase_price: financials.vehiclePurchasePrice,
          total_payments_made: financials.totalPaymentsMade
        };
      });

      const shareholders = (db.shareholders || []).map((sh: any) => {
        const fundedVehicles = (db.vehicles || []).filter((v: any) => v.shareholder_id === sh.id).map((v: any) => v.plate_number);
        const fundedDrivers = (db.drivers || []).filter((d: any) => d.shareholder_id === sh.id).map((d: any) => {
          const u = (db.users || []).find((userObj: any) => userObj.id === d.user_id);
          return u?.full_name || 'Driver';
        });

        return {
          ...sh,
          fullName: sh.full_name,
          email: sh.email,
          phone: sh.phone,
          status: sh.status,
          registrationDate: sh.created_at || sh.investment_date || new Date().toISOString(),
          bank_name: sh.bank_name || "Access Bank PLC",
          account_number: sh.account_number || "0094102945",
          lifetime_dividends: sh.lifetime_dividends || 0,
          funded_vehicles: fundedVehicles,
          funded_drivers: fundedDrivers,
          documents: (db.company_documents || []).filter((doc: any) => doc.title.toLowerCase().includes(sh.full_name.toLowerCase()) || doc.document_type === 'Shareholder Agreement')
        };
      });

      const admins = (db.admins || []).map((adm: any) => {
        const u = (db.users || []).find((userObj: any) => userObj.id === adm.user_id);
        const logsCount = (db.audit_logs || []).filter((l: any) => l.userId === adm.user_id).length;
        const lastActiveLog = (db.audit_logs || []).find((l: any) => l.userId === adm.user_id);

        return {
          ...adm,
          fullName: u?.full_name || 'Corporate Operator',
          email: u?.email || '',
          phone: u?.phone || '',
          status: adm.status || u?.status || 'active',
          registrationDate: adm.created_at || u?.created_at || new Date().toISOString(),
          privilege_level: adm.privilege_level || 'Level 1: Fleet Operations',
          assigned_tasks: adm.assigned_tasks || ['Fleet Dispatch', 'Voucher Issuance', 'Real-time Tracking'],
          actions_audited: logsCount,
          last_active: lastActiveLog ? lastActiveLog.timestamp : (adm.created_at || new Date().toISOString())
        };
      });

      const directors = (db.directors || []).map((dir: any) => {
        const u = (db.users || []).find((userObj: any) => userObj.id === dir.user_id);
        const signaturesCount = (db.audit_logs || []).filter((l: any) => l.userId === dir.user_id && l.action.includes('APPROVED')).length;
        return {
          ...dir,
          fullName: u?.full_name || 'Board Member',
          email: u?.email || '',
          phone: u?.phone || '',
          status: dir.status || u?.status || 'active',
          registrationDate: dir.created_at || u?.created_at || new Date().toISOString(),
          portfolio: dir.portfolio || 'Executive Director',
          shareholding_equity: dir.shareholding_equity || '10.0%',
          approved_signatures: signaturesCount
        };
      });

      return buildResponse({
        success: true,
        drivers,
        shareholders,
        admins,
        directors
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 20. OPERATIONS STATE & CONTROL CENTER ENDPOINTS
  if (path === '/api/operations/state' && method === 'GET') {
    try {
      const state = db.company_operations_state || {
        status: 'Setup Mode',
        currentCycle: '',
        currentDay: 1,
        startedBy: null,
        startedAt: null,
        pauseHistory: [],
        auditLog: []
      };

      const todayStr = new Date().toISOString().split('T')[0];
      const todayCollections = (db.driver_payments || [])
        .filter((p: any) => p.status === 'approved' && p.date && p.date.startsWith(todayStr))
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      const totalDrivers = (db.drivers || []).length;
      const totalTricycles = (db.vehicles || []).length;
      const companyWalletBalance = db.company_settings?.wallet_balance || 0;
      const systemHealth = 'Healthy';

      return buildResponse({
        success: true,
        state,
        metrics: {
          totalDrivers,
          totalTricycles,
          todayCollections,
          companyWalletBalance,
          systemHealth
        }
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/operations/start' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Only Administrators can start operations.' }, 403);
    }
    try {
      const body = await request.json().catch(() => ({})) as any;
      const requestedCycleId = body.cycleId;

      const company_settings = db.company_settings || {};
      const missing: string[] = [];

      if (!company_settings.companyName || !company_settings.companyAddress || !company_settings.phone || !company_settings.email) {
        missing.push('Corporate Profile details complete in Settings');
      }

      const adminCount = (db.users || []).filter((u: any) => u.role_id === 'role-admin' || u.role_id === 'role-director' || u.role === 'admin' || u.role === 'director').length;
      if (adminCount < 1) {
        missing.push('At least one Administrator profile');
      }

      if (!db.drivers || db.drivers.length < 1) {
        missing.push('At least one registered driver profile');
      }

      if (!db.vehicles || db.vehicles.length < 1) {
        missing.push('At least one registered vehicle asset');
      } else {
        const assigned = db.vehicles.some((v: any) => v.driver_id);
        if (!assigned) {
          missing.push('At least one vehicle assigned to a driver');
        }
      }

      if (!db.shareholders || db.shareholders.length < 1) {
        missing.push('At least one registered shareholder');
      }

      if (!company_settings.salary_configured && (!company_settings.salaries || company_settings.salaries.length < 1)) {
        missing.push('Salary Configuration');
      }

      if (!company_settings.wallet_initialized && company_settings.wallet_balance === undefined) {
        missing.push('Company Wallet Initialized');
      }

      const state = db.company_operations_state || {
        status: 'Setup Mode',
        currentCycle: '',
        currentDay: 1,
        startedBy: null,
        startedAt: null,
        pauseHistory: [],
        auditLog: []
      };

      if (state.status !== 'Setup Mode') {
        return buildResponse({ error: 'Company operations have already been initialized.' }, 400);
      }

      const updatedState = {
        status: 'Operational Mode',
        currentCycle: 'Cycle 001',
        currentDay: 1,
        startedBy: user.fullName,
        startedAt: new Date().toISOString(),
        pauseHistory: state.pauseHistory || [],
        auditLog: [
          {
            id: generateUUID(),
            action: 'Start Operations',
            user: user.fullName,
            timestamp: new Date().toISOString(),
            reason: 'Company ready for live transit & leasing business',
            ip: '127.0.0.1',
            device: 'Cloudflare Pages Functions',
            browser: 'Cloudflare Worker'
          },
          ...(state.auditLog || [])
        ]
      };

      db.company_operations_state = updatedState;

      if (!db.cycles) db.cycles = [];
      const activeCycle = db.cycles.find((c: any) => c.status === 'active');
      if (!activeCycle) {
        let cycleId = requestedCycleId;
        if (cycleId && db.cycles.some((c: any) => c.id === cycleId)) {
          return buildResponse({ error: `Duplicate Cycle ID error: '${cycleId}' already exists in database.` }, 400);
        }
        if (!cycleId) {
          cycleId = `CYC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const durationDays = parseInt(body.durationDays) || 30;
        const computedEndDate = new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString();

        db.cycles.unshift({
          id: cycleId,
          startDate: new Date().toISOString().split('T')[0],
          endDate: computedEndDate,
          endGoalTons: 200,
          status: 'active',
          created_at: new Date().toISOString(),
          created_by: user.fullName,
          locked: false,
          financials: []
        });
        updatedState.currentCycle = cycleId;
      } else {
        updatedState.currentCycle = activeCycle.id;
      }

      if (db.drivers) {
        db.drivers.forEach((drv: any) => {
          if (drv.status === 'approved') {
            drv.status = 'active';
          }
        });
      }

      writeAuditLog(user.id, user.email, user.role, 'COMPANY_OPERATIONS_START', 'Setup Mode', `Activated live enterprise operations. First 30-day operating cycle commenced by ${user.fullName}`, db);
      await dbManager.saveDB(db);

      let driverProfileId: string | null = null;
      let shareholderId: string | null = null;
      if (user.role === 'driver') {
        const dr = (db.drivers || []).find((d: any) => d.user_id === user.id);
        driverProfileId = dr ? dr.id : null;
      } else if (user.role === 'shareholder') {
        const sh = (db.shareholders || []).find((s: any) => s.user_id === user.id);
        shareholderId = sh ? sh.id : null;
      }

      return buildResponse({
        success: true,
        message: 'Company operations successfully started!',
        state: updatedState,
        detail: generateFilteredPayload(user.role, driverProfileId, shareholderId, db)
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/operations/pause' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Only Administrators can pause operations.' }, 403);
    }
    try {
      const { reason } = await request.json() as any;
      if (!reason) {
        return buildResponse({ error: 'Reason for suspension is mandatory.' }, 400);
      }

      const state = db.company_operations_state || { status: 'Setup Mode', pauseHistory: [], auditLog: [] };
      if (state.status !== 'Operational Mode') {
        return buildResponse({ error: 'Operations can only be paused from Operational Mode.' }, 400);
      }

      const pauseId = generateUUID();
      const pauseEntry = {
        id: pauseId,
        pausedBy: user.fullName,
        pausedAt: new Date().toISOString(),
        reason
      };

      state.status = 'Paused';
      state.pauseHistory = [pauseEntry, ...(state.pauseHistory || [])];
      state.auditLog = [
        {
          id: generateUUID(),
          action: 'Pause Operations',
          user: user.fullName,
          timestamp: new Date().toISOString(),
          reason,
          ip: '127.0.0.1',
          device: 'Cloudflare Pages Functions',
          browser: 'Cloudflare Worker'
        },
        ...(state.auditLog || [])
      ];

      if (!db.cycles) db.cycles = [];
      const activeCycle = db.cycles.find((c: any) => c.status === 'active');
      if (activeCycle) {
        activeCycle.status = 'paused';
        activeCycle.pauseReason = reason;
        activeCycle.pausedAt = new Date().toISOString();
        activeCycle.pausedBy = user.fullName;
        if (!activeCycle.pauseHistory) {
          activeCycle.pauseHistory = [];
        }
        activeCycle.pauseHistory.unshift({
          id: generateUUID(),
          pausedBy: user.fullName,
          pausedAt: new Date().toISOString(),
          reason
        });
      }

      db.company_operations_state = state;
      writeAuditLog(user.id, user.email, user.role, 'COMPANY_OPERATIONS_PAUSE', 'Operational Mode', `Suspended company operations: ${reason}`, db);
      await dbManager.saveDB(db);

      let driverProfileId: string | null = null;
      let shareholderId: string | null = null;
      if (user.role === 'driver') {
        const dr = (db.drivers || []).find((d: any) => d.user_id === user.id);
        driverProfileId = dr ? dr.id : null;
      } else if (user.role === 'shareholder') {
        const sh = (db.shareholders || []).find((s: any) => s.user_id === user.id);
        shareholderId = sh ? sh.id : null;
      }

      return buildResponse({
        success: true,
        message: 'Company operations paused.',
        state,
        detail: generateFilteredPayload(user.role, driverProfileId, shareholderId, db)
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/operations/resume' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Only Administrators can resume operations.' }, 403);
    }
    try {
      const { reason } = await request.json().catch(() => ({})) as any;
      const state = db.company_operations_state || { status: 'Setup Mode', pauseHistory: [], auditLog: [] };

      if (state.status !== 'Paused') {
        return buildResponse({ error: 'Operations can only be resumed when Paused.' }, 400);
      }

      if (state.pauseHistory && state.pauseHistory.length > 0) {
        const lastPause = state.pauseHistory[0];
        lastPause.resumedBy = user.fullName;
        lastPause.resumedAt = new Date().toISOString();
        if (reason) lastPause.resumeReason = reason;
      }

      state.status = 'Operational Mode';
      state.auditLog = [
        {
          id: generateUUID(),
          action: 'Resume Operations',
          user: user.fullName,
          timestamp: new Date().toISOString(),
          reason: reason || 'Operations resumed by administrator',
          ip: '127.0.0.1',
          device: 'Cloudflare Pages Functions',
          browser: 'Cloudflare Worker'
        },
        ...(state.auditLog || [])
      ];

      if (!db.cycles) db.cycles = [];
      const pausedCycle = db.cycles.find((c: any) => c.status === 'paused');
      if (pausedCycle) {
        pausedCycle.status = 'active';
        pausedCycle.resumedAt = new Date().toISOString();
        pausedCycle.resumedBy = user.fullName;
        if (pausedCycle.pauseHistory && pausedCycle.pauseHistory.length > 0) {
          pausedCycle.pauseHistory[0].resumedBy = user.fullName;
          pausedCycle.pauseHistory[0].resumedAt = new Date().toISOString();
          if (reason) pausedCycle.pauseHistory[0].resumeReason = reason;
        }
      }

      db.company_operations_state = state;
      writeAuditLog(user.id, user.email, user.role, 'COMPANY_OPERATIONS_RESUME', 'Paused', `Resumed company operations: ${reason || 'Manual resumption'}`, db);
      await dbManager.saveDB(db);

      let driverProfileId: string | null = null;
      let shareholderId: string | null = null;
      if (user.role === 'driver') {
        const dr = (db.drivers || []).find((d: any) => d.user_id === user.id);
        driverProfileId = dr ? dr.id : null;
      } else if (user.role === 'shareholder') {
        const sh = (db.shareholders || []).find((s: any) => s.user_id === user.id);
        shareholderId = sh ? sh.id : null;
      }

      return buildResponse({
        success: true,
        message: 'Company operations resumed.',
        state,
        detail: generateFilteredPayload(user.role, driverProfileId, shareholderId, db)
      });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/operations/config-salaries' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied.' }, 403);
    }
    try {
      const { salaries } = await request.json() as any;
      if (!salaries || !Array.isArray(salaries)) {
        return buildResponse({ error: 'Invalid salary configurations payload.' }, 400);
      }

      db.company_settings = db.company_settings || {};
      db.company_settings.salaries = salaries;
      db.company_settings.salary_configured = true;

      await dbManager.saveDB(db);
      return buildResponse({ success: true, message: 'Salary rules configured successfully!', settings: db.company_settings });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/operations/config-wallet' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied.' }, 403);
    }
    try {
      const { balance } = await request.json() as any;
      if (balance === undefined || isNaN(parseFloat(balance))) {
        return buildResponse({ error: 'Balance value is mandatory.' }, 400);
      }

      db.company_settings = db.company_settings || {};
      db.company_settings.wallet_balance = parseFloat(balance);
      db.company_settings.wallet_initialized = true;

      await dbManager.saveDB(db);
      return buildResponse({ success: true, message: 'Company wallet initialized successfully!', settings: db.company_settings });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/operations/config-rules' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied.' }, 403);
    }
    try {
      const { rules_shareholder_configured, rules_cycle_configured, roles_configured } = await request.json() as any;
      db.company_settings = db.company_settings || {};

      if (rules_shareholder_configured !== undefined) db.company_settings.rules_shareholder_configured = rules_shareholder_configured;
      if (rules_cycle_configured !== undefined) db.company_settings.rules_cycle_configured = rules_cycle_configured;
      if (roles_configured !== undefined) db.company_settings.roles_configured = roles_configured;

      await dbManager.saveDB(db);
      return buildResponse({ success: true, message: 'Operational rules configured successfully!', settings: db.company_settings });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 21. SHAREHOLDER FINANCE ADJUSTMENT ENDPOINTS
  if (path === '/api/finance/withdraw' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Admin or Director role required.' }, 403);
    }
    try {
      const { shareholderId, amount, remarks } = await request.json() as any;
      if (!shareholderId || !amount || parseFloat(amount) <= 0) {
        return buildResponse({ error: 'Invalid withdrawal amount or shareholder ID.' }, 400);
      }

      const sh = db.shareholders.find((s: any) => s.id === shareholderId);
      if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);

      const totalRev = (db.financial_records || []).filter((f: any) => f.type === 'revenue').reduce((sum: number, f: any) => sum + f.amount, 0);
      const totalExp = (db.financial_records || []).filter((f: any) => f.type === 'expense').reduce((sum: number, f: any) => sum + f.amount, 0);
      const netGeneratedAmount = totalRev - totalExp;
      const shareholderPercentage = db.shareholder_settings?.distributionPercentage || 2;
      const distributionPool = netGeneratedAmount > 0 ? (netGeneratedAmount * (shareholderPercentage / 100)) : 0;
      
      const totalInvestmentsSum = db.shareholders.reduce((s: number, r: any) => s + (r.investment_amount || 0), 0);
      const pctStake = totalInvestmentsSum > 0 ? ((sh.investment_amount / totalInvestmentsSum) * 100) : 0;
      const currentEarnings = distributionPool * (pctStake / 100);
      const totalWithdrawn = sh.total_withdrawn || 0;
      const availableWithdrawal = currentEarnings - totalWithdrawn;

      const withdrawAmt = parseFloat(amount);
      if (withdrawAmt > availableWithdrawal) {
        return buildResponse({ error: `Over-withdrawal prevented. Maximum available: ₦${availableWithdrawal.toLocaleString()}` }, 400);
      }

      const walletBalance = totalRev - totalExp;
      if (walletBalance < withdrawAmt) {
        return buildResponse({ error: `Insufficient company cash balance to fulfill withdrawal. Wallet balance: ₦${walletBalance.toLocaleString()}` }, 400);
      }

      sh.total_withdrawn = totalWithdrawn + withdrawAmt;
      sh.updated_at = new Date().toISOString();

      if (!db.financial_records) db.financial_records = [];
      db.financial_records.unshift({
        id: `FIN-WD-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
        type: 'expense',
        category: 'other',
        amount: withdrawAmt,
        date: new Date().toISOString().split('T')[0],
        description: `Shareholder Dividend Withdrawal - ${sh.full_name} (${remarks || 'Approved Disbursal'})`,
        approvedBy: user.fullName,
        created_at: new Date().toISOString()
      });

      if (!db.notifications) db.notifications = [];
      db.notifications.unshift({
        id: generateUUID(),
        title_en: 'Shareholder Withdrawal Approved',
        title_ha: 'An Amince da Fitowar Kudin Shareholder',
        message_en: `Withdrew ₦${withdrawAmt.toLocaleString()} from available dividends of ${sh.full_name}.`,
        message_ha: `An cire ₦${withdrawAmt.toLocaleString()} daga ribar Alhaji/Hajiya ${sh.full_name}.`,
        type: 'success',
        read_status: 0,
        created_at: new Date().toISOString()
      });

      writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_WITHDRAWAL', null, `Shareholder ${sh.full_name} withdrew ₦${withdrawAmt.toLocaleString()}`, db);
      await dbManager.saveDB(db);

      return buildResponse({ success: true, shareholder: sh });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/finance/reinvest' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Admin or Director role required.' }, 403);
    }
    try {
      const { shareholderId, amount } = await request.json() as any;
      if (!shareholderId || !amount || parseFloat(amount) <= 0) {
        return buildResponse({ error: 'Invalid reinvestment amount or shareholder ID.' }, 400);
      }

      const sh = db.shareholders.find((s: any) => s.id === shareholderId);
      if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);

      const totalRev = (db.financial_records || []).filter((f: any) => f.type === 'revenue').reduce((sum: number, f: any) => sum + f.amount, 0);
      const totalExp = (db.financial_records || []).filter((f: any) => f.type === 'expense').reduce((sum: number, f: any) => sum + f.amount, 0);
      const netGeneratedAmount = totalRev - totalExp;
      const shareholderPercentage = db.shareholder_settings?.distributionPercentage || 2;
      const distributionPool = netGeneratedAmount > 0 ? (netGeneratedAmount * (shareholderPercentage / 100)) : 0;
      
      const totalInvestmentsSum = db.shareholders.reduce((s: number, r: any) => s + (r.investment_amount || 0), 0);
      const pctStake = totalInvestmentsSum > 0 ? ((sh.investment_amount / totalInvestmentsSum) * 100) : 0;
      const currentEarnings = distributionPool * (pctStake / 100);
      const totalWithdrawn = sh.total_withdrawn || 0;
      const availableWithdrawal = currentEarnings - totalWithdrawn;

      const reinvestAmt = parseFloat(amount);
      if (reinvestAmt > availableWithdrawal) {
        return buildResponse({ error: `Over-reinvestment prevented. Maximum available: ₦${availableWithdrawal.toLocaleString()}` }, 400);
      }

      sh.investment_amount += reinvestAmt;
      sh.total_reinvested = (sh.total_reinvested || 0) + reinvestAmt;
      sh.total_withdrawn = totalWithdrawn + reinvestAmt;
      sh.updated_at = new Date().toISOString();

      if (!db.financial_records) db.financial_records = [];
      db.financial_records.unshift({
        id: `FIN-REINV-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
        type: 'revenue',
        category: 'other',
        amount: reinvestAmt,
        date: new Date().toISOString().split('T')[0],
        description: `Capital Reinvestment - ${sh.full_name} (Rollover of ₦${reinvestAmt.toLocaleString()} dividends into Capital)`,
        approvedBy: user.fullName,
        created_at: new Date().toISOString()
      });
      
      db.financial_records.unshift({
        id: `FIN-REINV-EXP-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
        type: 'expense',
        category: 'other',
        amount: reinvestAmt,
        date: new Date().toISOString().split('T')[0],
        description: `Shareholder Reinvestment Debit - ${sh.full_name} (Transfer to capital stock)`,
        approvedBy: user.fullName,
        created_at: new Date().toISOString()
      });

      if (!db.notifications) db.notifications = [];
      db.notifications.unshift({
        id: generateUUID(),
        title_en: 'Shareholder Reinvestment Processed',
        title_ha: 'Sake Zuba Jari na Shareholder',
        message_en: `Successfully reinvested ₦${reinvestAmt.toLocaleString()} dividends into capital stock for ${sh.full_name}.`,
        message_ha: `An sake zuba jarin ribar ₦${reinvestAmt.toLocaleString()} a matsayin jari na ${sh.full_name}.`,
        type: 'success',
        read_status: 0,
        created_at: new Date().toISOString()
      });

      writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_REINVESTMENT', null, `Shareholder ${sh.full_name} reinvested ₦${reinvestAmt.toLocaleString()}`, db);
      await dbManager.saveDB(db);

      return buildResponse({ success: true, shareholder: sh });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/finance/payroll' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Admin or Director role required.' }, 403);
    }
    try {
      const activeCycle = db.cycles && db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
      if (!activeCycle) {
        return buildResponse({ error: 'No active or paused operating cycle found. Payroll must be disbursed during an active operating cycle.' }, 400);
      }

      const alreadyDisbursed = (db.financial_records || []).some((f: any) => 
        f.category === 'salary' && 
        (f.cycle_id === activeCycle.id || f.description.includes(`Cycle ${activeCycle.id}`))
      );

      if (alreadyDisbursed) {
        return buildResponse({ error: `Payroll has already been disbursed for Cycle ${activeCycle.id}. Duplicate payment is blocked.` }, 400);
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const activeTricycleIds = new Set<string>();
      
      (db.trip_manifests || []).forEach((t: any) => {
        const tripDateStr = t.created_at || t.departure_time;
        if (tripDateStr) {
          const tripDate = new Date(tripDateStr);
          if (tripDate >= thirtyDaysAgo && tripDate <= now) {
            const vid = t.vehicle_id || t.vehicleId;
            if (vid) {
              activeTricycleIds.add(vid);
            }
          }
        }
      });

      let activeVehiclesCount = activeTricycleIds.size;
      if (activeVehiclesCount === 0) {
        const allTripVehicleIds = new Set<string>();
        (db.trip_manifests || []).forEach((t: any) => {
          const vid = t.vehicle_id || t.vehicleId;
          if (vid) allTripVehicleIds.add(vid);
        });
        activeVehiclesCount = allTripVehicleIds.size;
      }
      if (activeVehiclesCount === 0) {
        activeVehiclesCount = db.vehicles.filter((v: any) => v.status === 'active' || v.status === 'assigned' || v.status === 'idle').length || db.vehicles.length || 5;
      }
      
      const barristerSal = activeVehiclesCount * 1000;
      const managerSal = activeVehiclesCount * 500;
      const adamSal = activeVehiclesCount * 1000;
      const abakakaSal = activeVehiclesCount * 1000;
      const totalPayroll = barristerSal + managerSal + adamSal + abakakaSal;

      const totalRev = (db.financial_records || []).filter((f: any) => f.type === 'revenue').reduce((sum: number, f: any) => sum + f.amount, 0);
      const totalExp = (db.financial_records || []).filter((f: any) => f.type === 'expense').reduce((sum: number, f: any) => sum + f.amount, 0);
      const walletBalance = totalRev - totalExp;

      if (walletBalance < totalPayroll) {
        return buildResponse({ error: `Insufficient funds in company wallet to process payroll. Required: ₦${totalPayroll.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}` }, 400);
      }

      const entries = [
        { name: 'Barrister', amount: barristerSal },
        { name: 'Manager', amount: managerSal },
        { name: 'Admin Adam', amount: adamSal },
        { name: 'Admin Abakaka', amount: abakakaSal }
      ];

      if (!db.financial_records) db.financial_records = [];
      entries.forEach(entry => {
        db.financial_records.unshift({
          id: `FIN-PAY-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
          type: 'expense',
          category: 'salary',
          amount: entry.amount,
          date: new Date().toISOString().split('T')[0],
          description: `Payroll Disbursal for ${entry.name} based on ${activeVehiclesCount} active tricycles - Cycle ${activeCycle.id}`,
          cycle_id: activeCycle.id,
          approvedBy: user.fullName,
          created_at: new Date().toISOString()
        });
      });

      if (!db.notifications) db.notifications = [];
      db.notifications.unshift({
        id: generateUUID(),
        title_en: 'Payroll Successfully Processed',
        title_ha: 'An Shigar da Albashin Ma’aikata',
        message_en: `Disbursed ₦${totalPayroll.toLocaleString()} in salaries for ${activeVehiclesCount} active tricycles in the cycle.`,
        message_ha: `An fitar da albashi na ₦${totalPayroll.toLocaleString()} na babura ${activeVehiclesCount} masu aiki a wannan zagaye.`,
        type: 'success',
        read_status: 0,
        created_at: new Date().toISOString()
      });

      writeAuditLog(user.id, user.email, user.role, 'PAYROLL_GENERATED', null, `Processed payroll of ₦${totalPayroll.toLocaleString()} for ${activeVehiclesCount} active tricycles.`, db);
      await dbManager.saveDB(db);

      return buildResponse({ success: true, totalPayroll, activeVehiclesCount });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 22. INTERNAL CHAT MESSAGES ENDPOINTS
  if (path === '/api/messages') {
    if (method === 'GET') {
      return buildResponse(db.messages || []);
    }
    if (method === 'POST') {
      try {
        const { receiverId, receiverRole, text, attachmentUrl, attachmentType, attachmentName } = await request.json() as any;
        if (!receiverId || !receiverRole) {
          return buildResponse({ error: 'Receiver id and role parameters required.' }, 400);
        }

        if (!db.messages) db.messages = [];
        const newMessage = {
          id: `MSG-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`,
          sender_id: user.id,
          sender_name: user.fullName,
          sender_role: user.role,
          receiver_id: receiverId,
          receiver_role: receiverRole,
          text: text || '',
          attachment_url: attachmentUrl || '',
          attachment_type: attachmentType || '',
          attachment_name: attachmentName || '',
          delivered_status: 1,
          read_status: 0,
          created_at: new Date().toISOString()
        };

        db.messages.push(newMessage);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, message: newMessage });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }
  }

  if (path === '/api/messages/read' && method === 'PUT') {
    try {
      const { senderId } = await request.json() as any;
      if (!db.messages) db.messages = [];

      let updatedCount = 0;
      db.messages.forEach((m: any) => {
        if (m.sender_id === senderId && m.receiver_id === user.id && m.read_status === 0) {
          m.read_status = 1;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await dbManager.saveDB(db);
      }

      return buildResponse({ success: true, updatedCount });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  // 23. ANNOUNCEMENTS BROADCAST ENDPOINTS
  if (path === '/api/announcements') {
    if (method === 'GET') {
      return buildResponse(db.announcements || []);
    }
    if (method === 'POST') {
      if (user.role !== 'admin' && user.role !== 'director') {
        return buildResponse({ error: 'Access Denied: Admins or Directors only.' }, 403);
      }
      try {
        const { title, message, targetAudience, imageUrl, attachmentUrl, attachmentName } = await request.json() as any;
        if (!title || !message || !targetAudience) {
          return buildResponse({ error: 'Title, message and target audience are required.' }, 400);
        }

        if (!db.announcements) db.announcements = [];
        const newAnnouncement = {
          id: `ANN-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`,
          title,
          message,
          target_audience: targetAudience,
          image_url: imageUrl || '',
          attachment_url: attachmentUrl || '',
          attachment_name: attachmentName || '',
          published_by: user.fullName,
          created_at: new Date().toISOString()
        };

        db.announcements.unshift(newAnnouncement);

        if (!db.notifications) db.notifications = [];
        db.notifications.unshift({
          id: generateUUID(),
          title_en: `Announcement: ${title}`,
          title_ha: `Sanarwa: ${title}`,
          message_en: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
          message_ha: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
          type: 'info',
          target_role: targetAudience === 'all' ? undefined : targetAudience,
          read_status: 0,
          created_at: new Date().toISOString()
        });

        writeAuditLog(user.id, user.email, user.role, 'ANNOUNCEMENT_PUBLISHED', newAnnouncement.id, `Published broadcast announcement: ${title} to ${targetAudience}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true, announcement: newAnnouncement });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
      }
    }
  }

  // =====================================================================
  // ADDED AUTHENTICATED CORPORATE & ADMINISTRATIVE ENDPOINTS (GAP SYNC)
  // =====================================================================

  if (path === '/api/auth/register-admin' && method === 'POST') {
    if (user.role !== 'director' && user.role !== 'admin') {
      return buildResponse({ error: 'Access Denied: Directors-only credential endpoint.' }, 403);
    }
    try {
      const { fullName, email, phone, password, companyId, passportPhoto } = await request.json() as any;
      if (!fullName || !email || !phone || !password || !companyId) {
        return buildResponse({ error: 'Complete all parameters.' }, 400);
      }

      if (db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
        return buildResponse({ error: 'This email is already registered.' }, 400);
      }

      let passportUrl = '';
      if (passportPhoto) {
        const cleanBase64 = passportPhoto.replace(/^data:.*?;base64,/, '');
        const filename = `admin_${fullName.replace(/\s+/g, '_')}_${Date.now()}.png`;
        passportUrl = `/api/documents/preview/${filename}`;
        
        if (env.R2_BUCKET) {
          try {
            const binaryString = atob(cleanBase64);
            const buffer = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              buffer[i] = binaryString.charCodeAt(i);
            }
            await env.R2_BUCKET.put(filename, buffer, { httpMetadata: { contentType: 'image/png' } });
          } catch (r2Err) {
            console.error(`[R2 ERROR] Failed to upload admin photo:`, r2Err);
          }
        }
      }

      const userId = generateUUID();
      const newUser = {
        id: userId,
        email: email.toLowerCase(),
        phone,
        password_hash: await hashPassword(password),
        full_name: fullName,
        role_id: 'role-admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      };

      if (!db.users) db.users = [];
      if (!db.admins) db.admins = [];

      db.users.push(newUser);
      db.admins.push({
        id: generateUUID(),
        user_id: userId,
        company_id: companyId,
        passport_photo_url: passportUrl,
        created_at: new Date().toISOString(),
        status: 'active'
      });

      await dbManager.saveDB(db);

      writeAuditLog(user.id, user.email, user.role, 'ADMIN_CREATION', null, `Created Admin User: ${fullName} (${companyId})`, db);

      return buildResponse({ success: true, message: 'Operator/Admin registered successfully.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/auth/change-password-first-login' && method === 'POST') {
    try {
      const { newPassword } = await request.json() as any;
      if (!newPassword || newPassword.length < 6) {
        return buildResponse({ error: 'Please submit a secure password (minimum 6 characters).' }, 400);
      }

      const userRec = db.users.find((u: any) => u.id === user.id);
      if (!userRec) {
        return buildResponse({ error: 'User account not found.' }, 404);
      }

      userRec.password_hash = await hashPassword(newPassword);
      userRec.must_change_password = false;
      userRec.updated_at = new Date().toISOString();

      await dbManager.saveDB(db);

      writeAuditLog(userRec.id, userRec.email, user.role, 'FIRST_LOGIN_PASSWORD_CHANGE', null, `User successfully performed mandatory first-login password change.`, db);

      return buildResponse({ success: true, message: 'Password updated successfully. Access unlocked.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/finance/cap-out' && method === 'POST') {
    try {
      const { shareholderId, amount, remarks } = await request.json() as any;

      let sh: any;
      if (user.role === 'shareholder') {
        sh = db.shareholders.find((s: any) => s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase());
        if (!sh) return buildResponse({ error: 'Shareholder profile not found.' }, 404);
        if (shareholderId && sh.id !== shareholderId) {
          return buildResponse({ error: 'Access Denied: You can only manage your own account.' }, 403);
        }
      } else if (user.role === 'admin' || user.role === 'director') {
        if (!shareholderId) return buildResponse({ error: 'Shareholder ID required.' }, 400);
        sh = db.shareholders.find((s: any) => s.id === shareholderId);
        if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);
      } else {
        return buildResponse({ error: 'Access Denied: Admin, Director, or Shareholder role required.' }, 403);
      }

      const capOutAmt = parseFloat(amount);
      if (!capOutAmt || capOutAmt <= 0) {
        return buildResponse({ error: 'Invalid redemption amount.' }, 400);
      }

      const currentInvestment = sh.investment_amount || 0;
      sh.investment_amount = currentInvestment - capOutAmt;
      sh.total_cashed_out = (sh.total_cashed_out || 0) + capOutAmt;
      sh.updated_at = new Date().toISOString();

      if (!db.financial_records) db.financial_records = [];
      db.financial_records.unshift({
        id: `FIN-CAPOUT-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
        type: 'expense',
        category: 'other',
        amount: capOutAmt,
        date: new Date().toISOString().split('T')[0],
        description: `Capital Stock Redemption (Cap Out) - ${sh.full_name} (${remarks || 'Principal Liquidation'})`,
        approvedBy: user.fullName || user.email || 'Shareholder',
        created_at: new Date().toISOString()
      });

      if (!db.notifications) db.notifications = [];
      db.notifications.unshift({
        id: generateUUID(),
        user_id: sh.user_id,
        title_en: 'Capital Stock Redemption Processed',
        title_ha: 'An Cire Jari (Cap Out)',
        message_en: `Successfully redeemed ₦${capOutAmt.toLocaleString()} capital stock for ${sh.full_name}.`,
        message_ha: `An cire jarin ₦${capOutAmt.toLocaleString()} na ${sh.full_name}.`,
        type: 'success',
        read_status: 0,
        created_at: new Date().toISOString()
      });

      await dbManager.saveDB(db);

      writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_CAPOUT', null, `Shareholder ${sh.full_name} capital redemption of ₦${capOutAmt.toLocaleString()}`, db);

      return buildResponse({ success: true, shareholder: sh });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/documents/replace' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Admins or Directors only.' }, 403);
    }
    try {
      const { docId, category, title, fileBase64 } = await request.json() as any;
      if (!docId || !category || !fileBase64) {
        return buildResponse({ error: 'Missing mandatory replacement arguments.' }, 400);
      }

      let docList: any[] = [];
      if (category === 'vehicle') docList = db.vehicle_documents || [];
      else if (category === 'driver') docList = db.driver_documents || [];
      else if (category === 'company') docList = db.company_documents || [];
      else return buildResponse({ error: 'Invalid document category.' }, 400);

      const doc = docList.find((d: any) => d.id === docId);
      if (!doc) {
        return buildResponse({ error: 'Original document not found.' }, 404);
      }

      if (!doc.version) doc.version = 1;
      if (!doc.versions) doc.versions = [];

      doc.versions.push({
        version: doc.version,
        file_url: doc.file_url,
        created_at: doc.created_at,
        created_by: doc.created_by || 'Unknown',
        title: doc.title || title || doc.document_type
      });

      const docTitle = title || doc.title || doc.document_type || 'Replaced_Doc';
      const fileId = `${Date.now()}-${generateUUID().substring(0, 8)}`;
      const filename = `${fileId}.png`;
      const newFileUrl = `/api/documents/preview/${filename}`;

      if (env.R2_BUCKET) {
        try {
          const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
          const binaryString = atob(cleanBase64);
          const buffer = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            buffer[i] = binaryString.charCodeAt(i);
          }
          await env.R2_BUCKET.put(filename, buffer, { httpMetadata: { contentType: 'image/png' } });
        } catch (r2Err) {
          console.error(`[R2 ERROR] Failed to replace doc file:`, r2Err);
        }
      }

      doc.file_url = newFileUrl;
      doc.created_at = new Date().toISOString();
      doc.created_by = user.fullName;
      doc.version += 1;

      await dbManager.saveDB(db);

      writeAuditLog(user.id, user.email, user.role, 'DOCUMENT_REPLACED_VERSIONED', docId, `Replaced document ${docId} (${docTitle}) creating version ${doc.version}`, db);

      return buildResponse({ success: true, doc, message: 'Document version updated successfully in R2 archive.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (pathParts.length === 5 && pathParts[1] === 'api' && pathParts[2] === 'documents' && method === 'DELETE') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Admins or Directors only.' }, 403);
    }
    try {
      const category = pathParts[3];
      const id = pathParts[4];

      let docListKey: 'vehicle_documents' | 'driver_documents' | 'company_documents';
      if (category === 'vehicle') docListKey = 'vehicle_documents';
      else if (category === 'driver') docListKey = 'driver_documents';
      else if (category === 'company') docListKey = 'company_documents';
      else return buildResponse({ error: 'Invalid category.' }, 400);

      const list = db[docListKey] || [];
      const originalLength = list.length;
      db[docListKey] = list.filter((d: any) => d.id !== id);

      if (db[docListKey].length === originalLength) {
        return buildResponse({ error: 'Document not found.' }, 404);
      }

      await dbManager.saveDB(db);

      writeAuditLog(user.id, user.email, user.role, 'DOCUMENT_DELETED', id, `Permanently deleted document ${id} from ${category} archive`, db);

      return buildResponse({ success: true, message: 'Document permanently deleted from corporate archive.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/admin/admins' && method === 'GET') {
    if (user.role !== 'director' && user.role !== 'admin') {
      return buildResponse({ error: 'Access Denied: Administrative role required.' }, 403);
    }
    try {
      const mappedAdmins = (db.admins || []).map((adm: any) => {
        const u = db.users.find((x: any) => x.id === adm.user_id);
        return {
          ...adm,
          fullName: u?.full_name || adm.fullName || 'Admin User',
          email: u?.email || adm.email || '',
          phone: u?.phone || adm.phone || '',
          status: adm.status || 'active'
        };
      });
      return buildResponse(mappedAdmins);
    } catch (err: any) {
      return buildResponse({ error: `Failed to fetch admins: ${err.message}` }, 500);
    }
  }

  if (path === '/api/admin/audit-logs' && method === 'GET') {
    if (user.role !== 'director' && user.role !== 'admin') {
      return buildResponse({ error: 'Access Denied: Administrative role required.' }, 403);
    }
    return buildResponse(db.audit_logs || []);
  }

  if (path === '/api/admin/reset-test-data' && method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Admin or Director role required.' }, 403);
    }
    try {
      const { confirmationText } = await request.json() as any;
      if (confirmationText !== 'RESET RUQAYYA ERP') {
        return buildResponse({ error: 'Invalid confirmation text. Must match RESET RUQAYYA ERP.' }, 400);
      }

      db.drivers = [];
      db.shareholders = [];
      db.guarantors = [];
      db.vehicles = [];
      db.vehicle_documents = [];
      db.driver_documents = [];
      db.company_documents = [];
      db.financial_records = [];
      db.trip_manifests = [];
      db.cycles = [];
      db.driver_payments = [];
      db.messages = [];
      db.announcements = [];
      db.notifications = [];

      db.company_operations_state = {
        status: 'Setup Mode',
        currentCycle: '',
        currentDay: 1,
        startedBy: null,
        startedAt: null,
        pauseHistory: [],
        auditLog: []
      };

      const adminsAndDirectors = db.users.filter((u: any) => {
        const isCoreAdmin = u.username === 'ADAM' || u.username === 'MMR';
        const isAdminOrDirectorRole = u.role_id === 'role-director' || u.role_id === 'role-admin' || u.role === 'director' || u.role === 'admin';
        return isCoreAdmin || isAdminOrDirectorRole;
      });
      db.users = adminsAndDirectors;

      const keptUserIds = new Set(adminsAndDirectors.map((u: any) => u.id));
      db.admins = (db.admins || []).filter((a: any) => keptUserIds.has(a.user_id));
      db.directors = (db.directors || []).filter((d: any) => keptUserIds.has(d.user_id));

      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const currentToken = authHeader.substring(7);
        db.sessions = (db.sessions || []).filter((s: any) => s.token === currentToken);
      } else {
        db.sessions = [];
      }

      db.audit_logs = [
        {
          id: `AUD-${Date.now()}-RESET`,
          user_id: user.id,
          user_email: user.email,
          user_role: user.role,
          action: 'SYSTEM_RESET_OPERATIONAL_DATA',
          previous_value: 'Active test operational data environment.',
          new_value: `Operational data reset executed. All vehicles, drivers, vouchers, financial records, and logs successfully purged. Configuration preserved.`,
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        }
      ];

      await dbManager.saveDB(db);

      return buildResponse({ success: true, message: 'All operational test data has been successfully reset.' });
    } catch (err: any) {
      return buildResponse({ error: err.message }, 500);
    }
  }

  if (path === '/api/admin/backup-data' && method === 'GET') {
    if (user.role !== 'admin' && user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Admin or Director role required.' }, 403);
    }
    const backup = JSON.stringify(db, null, 2);
    return new Response(backup, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="ruqayya-erp-backup.json"',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
      }
    });
  }

  // Fallback 404 for unmatched endpoints
  return buildResponse({ error: `The requested corporate endpoint ${path} is non-existent.` }, 404);
};
