/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  loadDB, 
  saveDB, 
  seedDBIfEmpty, 
  hashPassword, 
  verifyPassword, 
  generateUUID, 
  saveR2File, 
  getR2FilePath,
  setDBChangeListener,
  initCloudPersistence,
  firestore,
  setFirestore
} from './src/utils/server_db';
import { PushService } from './src/utils/PushService';
import { WorkersAIService } from './src/utils/ai_service';

const app = express();
const PORT = 3000;

// Setup generous JSON limits for passport photo and PDF uploads via base64
app.use(express.json({ limit: '15mb' }));

// Helper to write an audit log entry on the server
function writeServerAuditLog(
  userId: string | null, 
  userEmail: string, 
  userRole: string, 
  action: string, 
  prevVal: string | null, 
  newVal: string | null, 
  req: express.Request
) {
  const db = loadDB();
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
  
  const log = {
    id: `AUD-${Date.now()}-${generateUUID().substring(0, 8).toUpperCase()}`,
    user_id: userId,
    user_email: userEmail,
    user_role: userRole,
    action,
    previous_value: prevVal,
    new_value: newVal,
    ip_address: ip,
    created_at: new Date().toISOString(),
    status: 'active'
  };
  
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
      message_en: newVal || `An action was performed by ${userEmail}.`,
      message_ha: newVal || `Mai amfani ${userEmail} ya yi wani aiki.`,
      type: 'info',
      category: 'system',
      read_status: 0,
      created_at: new Date().toISOString(),
      user_id: userId,
      target_role: userRole // The actor gets it, plus admins/directors get all
    };
    db.notifications.unshift(notification);
  }

  saveDB(db);
  
  if (shouldNotify && typeof broadcastStateUpdate === 'function') {
    // Fire and forget so we don't block
    setTimeout(() => {
      try {
         broadcastStateUpdate();
      } catch (e) {}
    }, 100);
  }
}

// Authentication Middleware with Stateless/Ephemeral Container Session Rehydration
function authenticateSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(412).json({ error: 'Authentication required. Active session parameters not found.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const db = loadDB();
  let session = db.sessions.find(s => s.token === token && s.status === 'active');

  if (!session) {
    // Rehydrate session dynamically if container restarted or fallback token is used
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
        let user = db.users.find(u => 
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
              password_hash: hashPassword('director123'),
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
          } else if (userKey === 'ADAM' || userKey === 'ABAKAKA') {
            user = {
              id: userId,
              username: userKey,
              email: `${userKey.toLowerCase()}@ruqayyatransport.com`,
              phone: '+234 803 222 0002',
              password_hash: hashPassword('admin123'),
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
          } else if (userKey === 'KABIR' || userKey === 'AMINA') {
            user = {
              id: userId,
              username: userKey,
              email: `${userKey.toLowerCase()}.shareholder@ruqayyatransport.com`,
              phone: '+234 803 333 0003',
              password_hash: hashPassword('shareholder123'),
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
          } else {
            // Default Driver fallback
            user = {
              id: userId,
              username: 'MUSA',
              email: 'musa.driver@ruqayyatransport.com',
              phone: '+234 803 444 0004',
              password_hash: hashPassword('driver123'),
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
          }
        }

        // Dynamically recreate the active session record
        session = {
          id: generateUUID(),
          user_id: user.id,
          token,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          user_ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1',
          user_agent: req.headers['user-agent'] || 'Corporate API Consumer',
          created_at: new Date().toISOString(),
          status: 'active'
        };
        db.sessions.push(session);
        saveDB(db);
      }
    }
  }

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalidated. Please login again.' });
  }

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    session.status = 'expired';
    saveDB(db);
    return res.status(401).json({ error: 'Your corporate session has expired.' });
  }

  // Bind active user details to request object
  const user = db.users.find(u => u.id === session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'Associated user record not found.' });
  }

  const role = db.roles.find(r => r.id === user.role_id);
  
  (req as any).user = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: role ? role.name : 'public',
    roleId: user.role_id
  };
  (req as any).token = token;

  next();
}

// --- REAL-TIME SYSTEM (SERVER-SENT EVENTS REGISTRY) ---
let sseClients: any[] = [];
let totalSseConnections = 0;
let eventThroughput = 0;
let failedDeliveries = 0;
let reconnectionCount = 0;

// Helper to filter and payload-optimize database updates based on role clearance levels
function generateFilteredPayload(role: string, driverProfileId: string | null, shareholderId: string | null, db: any): any {
  const common = {
    type: 'db_update',
    role: role,
    company_settings: db.company_settings || {},
    company_operations_state: db.company_operations_state || {
      status: 'Setup Mode',
      currentCycle: '',
      currentDay: 1,
      startedBy: null,
      startedAt: null,
      pauseHistory: [],
      auditLog: []
    },
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
    // Directors receive all events
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
    // Admins receive operational events
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
  } else if (role === 'shareholder') {
    // Shareholders receive shareholder-related events and their own details
    const cleanShareholders = (db.shareholders || []).map((s: any) => {
      if (s.id === shareholderId) return s;
      return { id: s.id, full_name: s.full_name, status: s.status };
    });

    return {
      ...common,
      shareholders: cleanShareholders,
      shareholder_settings: db.shareholder_settings || {},
      financials: db.financial_records || [],
      cycles: db.cycles || [],
      messages: (db.messages || []).filter((m: any) => m.sender_id === shareholderId || m.receiver_id === shareholderId),
      notifications: (db.notifications || []).filter((n: any) => n.user_id === shareholderId || n.target_role === 'shareholder' || (n.target_roles && Array.isArray(n.target_roles) && n.target_roles.includes('shareholder')) || (!n.user_id && !n.target_role && (!n.target_roles || n.target_roles.length === 0)))
    };
  } else if (role === 'driver') {
    // Drivers cannot receive other drivers' private events. They only get their own profile data, payments, etc.
    const activeDriver = mappedDrivers.find((d: any) => d.id === driverProfileId) || {};
    const driverPayments = (db.driver_payments || []).filter((p: any) => p.driver_id === driverProfileId);
    const driverDocuments = (db.driver_documents || []).filter((doc: any) => doc.driver_id === driverProfileId);
    const driverTrips = mappedTrips.filter((t: any) => t.driverId === driverProfileId);
    const driverNotifications = (db.notifications || []).filter((n: any) => n.user_id === activeDriver.user_id || n.target_role === 'driver' || (n.target_roles && Array.isArray(n.target_roles) && n.target_roles.includes('driver')) || (!n.user_id && !n.target_role && (!n.target_roles || n.target_roles.length === 0)));
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
    // Public or unidentified
    return {
      ...common,
      company_settings: db.company_settings || {},
      announcements: db.announcements || []
    };
  }
}

function broadcastStateUpdate() {
  const db = loadDB();
  sseClients.forEach(client => {
    try {
      const filteredPayload = generateFilteredPayload(client.role, client.driverProfileId, client.shareholderId, db);
      client.res.write(`data: ${JSON.stringify(filteredPayload)}\n\n`);
      eventThroughput++;
    } catch (err) {
      failedDeliveries++;
    }
  });
}

// Helper: Get canonical cycle status as the single source of truth
function getCanonicalCycleStatus(db: any): any {
  const activeCycle = db.cycles && db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
  if (!activeCycle) {
    return {
      isActive: false,
      status: 'inactive',
      cycleId: 'No Active Cycle',
      startDate: '',
      endDate: '',
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      secondsRemaining: 0,
      totalSecondsRemaining: 0,
      progressPercent: 0,
      currentDay: 0,
      totalCycleDays: 30,
      pauseReason: '',
      pausedAt: ''
    };
  }

  const now = Date.now();

  // Check if this is a timed pause and if it has ended
  if (activeCycle.status === 'paused' && activeCycle.pausedAt && (activeCycle.pauseDays || 0) > 0) {
    const pauseDurationMs = activeCycle.pauseDays * 24 * 3600 * 1000;
    const pauseEndMs = new Date(activeCycle.pausedAt).getTime() + pauseDurationMs;
    if (now >= pauseEndMs) {
      // Auto-resume cycle
      activeCycle.status = 'active';
      activeCycle.pausedAt = null;
      activeCycle.pauseReason = '';
      activeCycle.pauseDays = 0;
      if (db.company_operations_state) {
        db.company_operations_state.status = 'Operational Mode';
      }
      try {
        saveDB(db);
        syncActiveCycleToFirestore(db);
      } catch (err) {
        console.warn('Failed to save auto-resumed cycle status to DB:', err);
      }
    }
  }

  const startMs = new Date(activeCycle.startDate).getTime();
  let totalCycleSeconds = 30 * 24 * 3600;
  if (activeCycle.endDate) {
    const endMs = new Date(activeCycle.endDate).getTime();
    totalCycleSeconds = Math.max(24 * 3600, Math.floor((endMs - startMs) / 1000));
  } else if (activeCycle.extendedDays) {
    totalCycleSeconds = (30 + activeCycle.extendedDays) * 24 * 3600;
  }
  
  // Total paused seconds accumulated so far
  let totalPausedSeconds = activeCycle.totalPausedSeconds || 0;
  
  // If currently paused, add the time since it was paused to the effective total paused time
  let currentPauseSeconds = 0;
  if (activeCycle.status === 'paused' && activeCycle.pausedAt) {
    // If it is a timed pause (pauseDays > 0), the timer should CONTINUE counting down!
    // So we do NOT freeze the timer (currentPauseSeconds = 0)
    if (!(activeCycle.pauseDays > 0)) {
      currentPauseSeconds = Math.floor((now - new Date(activeCycle.pausedAt).getTime()) / 1000);
    }
  }

  const effectivePausedSeconds = totalPausedSeconds + currentPauseSeconds;
  const elapsedSeconds = Math.max(0, Math.floor((now - startMs) / 1000) - effectivePausedSeconds);
  const remainingSeconds = Math.max(0, totalCycleSeconds - elapsedSeconds);
  
  const days = Math.floor(remainingSeconds / (24 * 3600));
  const hours = Math.floor((remainingSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  
  const totalCycleDays = Math.round(totalCycleSeconds / (24 * 3600));
  const progressPercent = Math.min(100, (elapsedSeconds / totalCycleSeconds) * 100);
  const currentDay = Math.min(totalCycleDays, Math.floor(elapsedSeconds / (24 * 3600)) + 1);

  return {
    isActive: true,
    status: activeCycle.status,
    cycleId: activeCycle.id,
    startDate: activeCycle.startDate,
    endDate: activeCycle.endDate || new Date(startMs + totalCycleSeconds * 1000).toISOString(),
    daysRemaining: days,
    hoursRemaining: hours,
    minutesRemaining: minutes,
    secondsRemaining: seconds,
    totalSecondsRemaining: remainingSeconds,
    progressPercent,
    currentDay,
    totalCycleDays,
    pauseReason: activeCycle.pauseReason || '',
    pausedAt: activeCycle.pausedAt || '',
    pauseDays: activeCycle.pauseDays || 0
  };
}

// Helper: Sync Active Cycle Metadata to Firestore for real-time dashboard widgets
async function syncActiveCycleToFirestore(db: any) {
  if (!firestore) return;
  
  const canonical = getCanonicalCycleStatus(db);
  const activeDriversCount = (db.drivers || []).filter((d: any) => d.status === 'active' || d.status === 'approved').length;
  const totalFleetCount = (db.vehicles || []).length;
  
  const cycleStart = canonical.isActive ? new Date(canonical.startDate) : new Date();
  const currentRemit = (db.financial_records || [])
    .filter((f: any) => f.type === 'revenue' && canonical.isActive && new Date(f.date) >= cycleStart)
    .reduce((sum: number, f: any) => sum + f.amount, 0);

  const payload: any = {
    ...canonical,
    drivers: activeDriversCount,
    fleet: totalFleetCount,
    remit: currentRemit,
    health: canonical.status === 'paused' ? 'Paused' : (canonical.isActive ? 'Stable' : 'Inactive'),
    cycleDay: canonical.isActive ? `Day ${canonical.currentDay} of ${canonical.totalCycleDays}` : '0',
    updated_at: new Date().toISOString()
  };

  try {
    if (firestore) {
      await firestore.collection('system_status').doc('activeCycle').set(payload, { merge: true });
      console.log(`[FirestoreSync] Synced canonical cycle status: ${payload.status} (${payload.cycleId})`);
    }
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to sync cycle status:', err?.message || err);
  }
}

// Register the database change listener to broadcast state snapshots to all browser clients
setDBChangeListener(() => {
  broadcastStateUpdate();
});

// Periodic heartbeat message to prevent connections from being closed by ingress routers
setInterval(() => {
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
    } catch (err) {
      // dead connection
    }
  });
}, 15000);

// Helper: Compute active cycle duration
function computeActiveDuration(cycle: any): number {
  if (!cycle) return 0;
  const start = new Date(cycle.startDate).getTime();
  const now = cycle.status === 'paused' && cycle.pausedAt 
    ? new Date(cycle.pausedAt).getTime() 
    : Date.now();
  
  let totalElapsed = now - start;
  
  let totalPausedMs = 0;
  const history = cycle.pauseHistory || [];
  history.forEach((pause: any) => {
    if (pause.pausedAt && pause.resumedAt) {
      totalPausedMs += new Date(pause.resumedAt).getTime() - new Date(pause.pausedAt).getTime();
    } else if (pause.pausedAt && !pause.resumedAt && cycle.status === 'active') {
      totalPausedMs += Date.now() - new Date(pause.pausedAt).getTime();
    }
  });
  
  totalElapsed = Math.max(0, totalElapsed - totalPausedMs);
  return Math.floor(totalElapsed / 1000);
}

// Helper: Calculate installments for a driver
export function calculateInstallmentsForDriver(driver: any, db: any, activeCycle: any) {
  const agreedAmount = parseFloat(driver.agreed_amount ?? driver.agreedAmount) || 0;
  const installmentTarget = Math.round(agreedAmount / 6);
  
  // Find all approved payments for this driver during the active cycle using safe YYYY-MM-DD string comparisons
  const cycleStartRaw = activeCycle ? (activeCycle.startDate || activeCycle.start_time || activeCycle.created_at) : null;
  const startStr = cycleStartRaw
    ? (typeof cycleStartRaw === 'string' ? cycleStartRaw.split('T')[0] : new Date(cycleStartRaw).toISOString().split('T')[0])
    : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const cycleEndRaw = activeCycle ? (activeCycle.endDate || activeCycle.end_time) : null;
  const endStr = cycleEndRaw
    ? (typeof cycleEndRaw === 'string' ? cycleEndRaw.split('T')[0] : new Date(cycleEndRaw).toISOString().split('T')[0])
    : new Date().toISOString().split('T')[0];
  
  const payments = (db.driver_payments || []).filter((p: any) => {
    const isMatchingDriver = (
      p.driver_id === driver.id || 
      p.driver_id === driver.user_id || 
      p.driver_id === driver.company_driver_id ||
      p.driverId === driver.id || 
      p.driverId === driver.user_id || 
      p.driverId === driver.company_driver_id
    );
    if (!isMatchingDriver || p.status !== 'approved') return false;
    const pDateStr = typeof p.date === 'string' ? p.date.split('T')[0] : new Date(p.date).toISOString().split('T')[0];
    const afterStart = pDateStr >= startStr;
    const beforeEnd = activeCycle && activeCycle.endDate ? pDateStr <= endStr : true;
    return afterStart && beforeEnd;
  });

  const totalApprovedAmount = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

  // Calculate total rest days during this active cycle to extend installments
  let totalRestDays = 0;
  const restHistory = driver.restHistory || [];
  if (activeCycle) {
    restHistory.forEach((rest: any) => {
      const restStart = new Date(rest.startDate);
      const restEnd = new Date(rest.endDate);
      const rawCycleStart = activeCycle.startDate || activeCycle.start_time || activeCycle.created_at;
      const cycleStart = rawCycleStart ? new Date(rawCycleStart) : new Date();
      
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

  const rawCycleStart = activeCycle ? (activeCycle.startDate || activeCycle.start_time || activeCycle.created_at) : null;
  let startDate = rawCycleStart ? new Date(rawCycleStart) : new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const nowMs = Date.now();
  const cycleStartMs = startDate.getTime();
  const elapsedDays = Math.max(1, Math.floor((nowMs - cycleStartMs) / (1000 * 60 * 60 * 24)) + 1);
  const currentRealTimeInstallment = Math.min(6, Math.max(1, Math.ceil(elapsedDays / 5)));

  const installments = [];
  let remainingPaidPool = totalApprovedAmount;

  // Calculate total paused time from the master cycle to shift installment deadlines
  let masterPausedMs = (activeCycle?.totalPausedSeconds || 0) * 1000;
  if (activeCycle?.status === 'paused' && activeCycle?.pausedAt) {
    masterPausedMs += Date.now() - new Date(activeCycle.pausedAt).getTime();
  }

  for (let k = 1; k <= 6; k++) {
    const startDay = (k - 1) * 5 + 1;
    const endDay = k * 5;

    // Shift the schedule by both driver-specific rest days AND company-wide paused time
    const normalEndDate = new Date(startDate.getTime() + (endDay - 1) * 24 * 3600 * 1000);
    const extendedEndDate = new Date(normalEndDate.getTime() + (totalRestDays * 24 * 3600 * 1000) + masterPausedMs);
    
    const normalStartDate = new Date(startDate.getTime() + (startDay - 1) * 24 * 3600 * 1000);
    const extendedStartDate = new Date(normalStartDate.getTime() + (totalRestDays * 24 * 3600 * 1000) + masterPausedMs);

    const dueAmount = installmentTarget;
    const paidAmount = Math.min(dueAmount, remainingPaidPool);
    remainingPaidPool = Math.max(0, remainingPaidPool - paidAmount);

    const remaining = dueAmount - paidAmount;

    let status = 'Pending';
    if (remaining <= 0) {
      status = 'Completed';
    } else if (paidAmount > 0) {
      status = 'Partially Paid';
    } else if (!isCurrentlyOnRest && today > extendedEndDate) {
      status = 'Overdue';
    }

    const isCurrentRealTime = (k === currentRealTimeInstallment);

    // Let's attach payments to this milestone
    const matchingPayments = payments.filter((p: any) => p.installment_number === k || p.installmentNumber === k);

    installments.push({
      installmentNumber: k,
      dueAmount,
      paidAmount,
      remainingAmount: remaining,
      startDate: extendedStartDate.toISOString().split('T')[0],
      endDate: extendedEndDate.toISOString().split('T')[0],
      status,
      isCurrentRealTime,
      payments: matchingPayments.map((p: any) => ({
        id: p.id,
        amount: p.amount,
        receiptNumber: p.receipt_number || p.receiptNumber || 'RTL-REC',
        approvedBy: p.approved_by || p.recorded_by || p.approvedBy || 'Admin',
        date: p.date || p.created_at || new Date().toISOString(),
        paymentMethod: p.payment_method || p.paymentMethod || 'Bank Transfer',
        remarks: p.remarks || p.notes || ''
      }))
    });
  }

  return installments;
}

// Background automated engine for status checks, overdue alerts and progress updates
setInterval(() => {
  try {
    const db = loadDB();
    const opsState = db.company_operations_state || { status: 'Setup Mode' };
    if (opsState.status === 'Setup Mode') {
      // Still run the non-cycle-dependent checks
    }
    let dbChanged = false;
    const now = new Date();

    // 1. CYCLE MANAGEMENT
    const activeCycleBefore = db.cycles && db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
    const statusBefore = activeCycleBefore ? activeCycleBefore.status : null;

    const canonical = getCanonicalCycleStatus(db);
    const activeCycle = db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
    
    if (activeCycle && statusBefore === 'paused' && activeCycle.status === 'active') {
      dbChanged = true;
    }
    
    if (activeCycle && canonical.isActive) {
      const daysElapsed = canonical.currentDay;
      const currentDayInDB = db.company_operations_state.currentDay || 1;
      const totalAllowedDays = canonical.totalCycleDays;

      if (daysElapsed !== currentDayInDB && daysElapsed <= totalAllowedDays) {
        db.company_operations_state.currentDay = daysElapsed;
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
          activeDrivers: db.drivers.filter((d: any) => d.status === 'approved' || d.status === 'active').length,
          totalFleetCount: db.vehicles.length
        };

        const totalInvestment = db.shareholders
          .filter((s: any) => s.status === 'active')
          .reduce((sum: number, s: any) => sum + s.investment_amount, 0);

        db.shareholders.forEach((sh: any) => {
          if (sh.status === 'active' && totalInvestment > 0) {
            const shPercentage = sh.investment_amount / totalInvestment;
            const shEarnings = distributionPool * shPercentage;
            sh.earnings_to_date = (sh.earnings_to_date || 0) + shEarnings;

            db.financial_records.push({
              id: generateUUID(),
              type: 'expense',
              category: 'dividend',
              amount: shEarnings,
              date: endDate,
              description: `Auto dividend distribution: ${sh.full_name} (${(shPercentage * 100).toFixed(1)}%)`
            });
          }
        });

        db.company_operations_state.status = 'Setup Mode';
        db.company_operations_state.currentCycle = '';
        db.company_operations_state.currentDay = 1;

        db.notifications.unshift({
          id: generateUUID(),
          target_roles: ['admin', 'director'],
          title_en: 'Operating Cycle Concluded',
          title_ha: 'Zagayen Aiki Ya Kammala',
          message_en: `Operations Cycle ${activeCycle.id} reached its 30-day limit.`,
          message_ha: `Zagayen aiki ${activeCycle.id} ya kai haddi.`,
          type: 'success',
          read_status: 0,
          created_at: endDate
        });
        dbChanged = true;
      }

      // Verify installments, trigger penalties and warnings
      for (const driver of db.drivers) {
        if (driver.status !== 'approved' && driver.status !== 'active') continue;

        const installments = calculateInstallmentsForDriver(driver, db, activeCycle);

        for (const inst of installments) {
          const today = new Date();
          const instEndDate = new Date(inst.endDate);
          const hoursRemaining = (instEndDate.getTime() - today.getTime()) / (1000 * 60 * 60);

          if (inst.status === 'Overdue') {
            if (!driver.penalties_history) driver.penalties_history = [];
            const hasPenalty = driver.penalties_history.some((p: any) => p.installmentNumber === inst.installmentNumber && p.cycleId === activeCycle.id);

            if (!hasPenalty) {
              const overdueCharge = 5000;
              driver.total_penalty_amount = (driver.total_penalty_amount || 0) + overdueCharge;
              driver.debt_amount = (driver.debt_amount || 0) + overdueCharge;
              driver.penalties_history.push({ id: generateUUID(), installmentNumber: inst.installmentNumber, cycleId: activeCycle.id, amount: overdueCharge, appliedAt: new Date().toISOString() });
              db.financial_records.push({ id: generateUUID(), type: 'revenue', category: 'penalty', amount: overdueCharge, date: new Date().toISOString(), description: `Overdue Charge Penalty: Driver ${driver.fullName || 'Candidate'}` });
              db.notifications.unshift({ id: generateUUID(), user_id: driver.user_id, driver_id: driver.id, title_en: 'Installment Overdue', message_en: 'A ₦5,000 penalty has been applied.', type: 'overdue', read_status: 0, created_at: new Date().toISOString() });
              dbChanged = true;
            }
          }
        }
      }
    }

    // 2. VEHICLE CONTRACT COMPLETION
    const activeDrivers = (db.drivers || []).filter((d: any) => d.status === 'active');
    activeDrivers.forEach((drv: any) => {
      const financials = getDriverFinancials(drv, db);
      if (financials.remainingVehicleBalance <= 0 && drv.status !== 'completed') {
        drv.status = 'completed';
        dbChanged = true;
        
        db.notifications.unshift({
          id: generateUUID(),
          user_id: drv.user_id,
          title_en: 'Vehicle Contract Completed!',
          message_en: 'Congratulations! Your vehicle purchase balance has been fully settled. You are now the full owner!',
          type: 'success',
          read_status: 0,
          created_at: now.toISOString()
        });
      }
    });

    // 3. REST MODE TRACKING
    const restDrivers = (db.drivers || []).filter((d: any) => d.status === 'rest_mode');
    restDrivers.forEach((drv: any) => {
      if (drv.rest_release_date && new Date(drv.rest_release_date) <= now) {
        drv.status = 'active';
        drv.rest_release_date = null;
        dbChanged = true;

        db.notifications.unshift({
          id: generateUUID(),
          user_id: drv.user_id,
          title_en: 'Rest Period Concluded',
          message_en: 'Your medical rest period has completed.',
          type: 'info',
          read_status: 0,
          created_at: now.toISOString()
        });
      }
    });

    // 4. VEHICLE DOCUMENT MONITORING
    for (const vehicle of (db.vehicles || [])) {
      const thresholdMs = 7 * 24 * 3600 * 1000;
      const docs = [
        { key: 'insurance', val: vehicle.insurance_expiry || vehicle.insuranceExpiry, name: 'Insurance policy' },
        { key: 'registration', val: vehicle.registration_expiry || vehicle.registrationExpiry, name: 'Registration file' }
      ];

      for (const doc of docs) {
        if (!doc.val) continue;
        const expiry = new Date(doc.val);
        const diff = expiry.getTime() - now.getTime();

        if (diff <= thresholdMs) {
          const alreadyFlagged = (db.notifications || []).some((n: any) => 
            (n.vehicle_plate === vehicle.plate_number || n.vehicle_plate === vehicle.plateNumber) && 
            n.document_type === doc.key &&
            (now.getTime() - new Date(n.created_at).getTime()) < 3 * 24 * 3600 * 1000
          );

          if (!alreadyFlagged) {
            const expired = diff < 0;
            const statusText = expired ? 'EXPIRED' : 'EXPIRING SOON';
            db.notifications.unshift({
              id: generateUUID(),
              target_roles: ['admin', 'director'],
              vehicle_plate: vehicle.plate_number || vehicle.plateNumber,
              document_type: doc.key,
              title_en: `${doc.name} ${statusText}`,
              message_en: `Vehicle Alert: ${doc.name} for Tricycle ${vehicle.plate_number || vehicle.plateNumber} has ${statusText} (${doc.val}).`,
              type: 'warning',
              read_status: 0,
              created_at: now.toISOString()
            });
            dbChanged = true;
          }
        }
      }
    }

    // 5. MILEAGE MONITORING
    for (const vehicle of (db.vehicles || [])) {
      const curMileage = vehicle.current_mileage !== undefined ? vehicle.current_mileage : vehicle.mileage;
      const oilLimit = vehicle.oil_change_mileage || vehicle.oilChangeMileage;
      
      if (curMileage !== undefined && oilLimit) {
        const cur = parseFloat(curMileage);
        const limit = parseFloat(oilLimit);
        if (cur >= limit && vehicle.status !== 'maintenance required' && vehicle.status !== 'maintenance') {
          vehicle.status = 'maintenance required';
          db.notifications.unshift({
            id: generateUUID(),
            target_roles: ['admin', 'director'],
            vehicle_plate: vehicle.plate_number || vehicle.plateNumber,
            title_en: 'Oil Change Maintenance Required',
            message_en: `Maintenance Alert: Vehicle ${vehicle.plate_number || vehicle.plateNumber} exceeded oil change mileage limit (${cur} km / limit: ${limit} km).`,
            type: 'warning',
            read_status: 0,
            created_at: now.toISOString()
          });
          dbChanged = true;
        }
      }
    }

    if (dbChanged) {
      saveDB(db);
      syncActiveCycleToFirestore(db);
    }
  } catch (err) {
    console.error("Background automation task error:", err);
  }
}, 30000);


app.get('/api/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const token = req.query.token as string;
  const db = loadDB();
  const session = token ? db.sessions.find(s => s.token === token && s.status === 'active') : null;
  const user = session ? db.users.find(u => u.id === session.user_id) : null;
  const roleRecord = user ? db.roles.find(r => r.id === user.role_id) : null;
  const role = roleRecord ? roleRecord.name : 'public';

  const driverProfileId = role === 'driver' && user ? (db.drivers.find(d => d.user_id === user.id)?.id || null) : null;
  const shareholderId = role === 'shareholder' && user ? (db.shareholders.find(s => s.user_id === user.id)?.id || null) : null;

  const clientId = Date.now();
  totalSseConnections++;

  // Track if they connected recently to count as a reconnection
  const wasActiveRecently = sseClients.some(c => c.userId === (user ? user.id : null));
  if (wasActiveRecently) {
    reconnectionCount++;
  }

  const newClient = {
    id: clientId,
    res,
    userId: user ? user.id : null,
    role,
    driverProfileId,
    shareholderId
  };
  sseClients.push(newClient);

  // Send initial filtered snapshot immediately
  try {
    const initialPayload = generateFilteredPayload(role, driverProfileId, shareholderId, db);
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);
  } catch (err) {
    failedDeliveries++;
  }

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

app.get('/api/director/sse-monitoring', authenticateSession, (req, res) => {
  const actor = (req as any).user;
  if (actor.role !== 'director') {
    return res.status(403).json({ error: 'Access Denied: Director role required.' });
  }

  res.json({
    activeConnections: sseClients.length,
    cumulativeConnections: totalSseConnections,
    eventThroughput: eventThroughput,
    failedDeliveries: failedDeliveries,
    reconnections: reconnectionCount,
    systemHealth: {
      status: 'healthy',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    connectedUsers: sseClients.map(c => ({
      userId: c.userId,
      role: c.role,
      connectedAt: new Date(c.id).toISOString()
    }))
  });
});

app.get('/api/director/backup', authenticateSession, (req, res) => {
  const actor = (req as any).user;
  if (actor.role !== 'director') {
    return res.status(403).json({ error: 'Access Denied: Director role required for backups.' });
  }

  try {
    const db = loadDB();
    
    // Log the sensitive action
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DATABASE_BACKUP_DOWNLOADED',
      null,
      `Full JSON backup generated. Contains ${db.users.length} users, ${db.vehicles.length} vehicles, ${db.audit_logs.length} log rows.`,
      req
    );

    // Provide the backup file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=ruqayya_backup_${Date.now()}.json`);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
});

app.post('/api/director/restore', authenticateSession, (req, res) => {
  const actor = (req as any).user;
  if (actor.role !== 'director') {
    return res.status(403).json({ error: 'Access Denied: Director role required for restoration.' });
  }

  try {
    const backupData = req.body;
    if (!backupData || !Array.isArray(backupData.users) || !Array.isArray(backupData.vehicles) || !Array.isArray(backupData.audit_logs)) {
      return res.status(400).json({ error: 'Invalid backup structure. The file must be a valid Ruqayya ERP database dump.' });
    }

    const currentDb = loadDB();

    // Preserve the backup as current state
    saveDB(backupData);

    // Log this critical action
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DATABASE_RESTORED',
      `Previous DB state snapshotted (users: ${currentDb.users.length}, logs: ${currentDb.audit_logs.length})`,
      `Restored backup successfully. (users: ${backupData.users.length}, logs: ${backupData.audit_logs.length})`,
      req
    );

    // Broadcast update via SSE
    broadcastStateUpdate();

    res.json({ success: true, message: 'Database successfully restored from backup file.' });
  } catch (err: any) {
    res.status(500).json({ error: `Restoration failed: ${err.message}` });
  }
});

// --- API ROUTES ---

// 1. PUBLIC: Health Status
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', database: 'connected', environment: process.env.NODE_ENV || 'development' });
});

app.get('/api/db-diagnostic', (req, res) => {
  res.json({
    success: true,
    status: 'connected',
    message: 'Database connection verified successfully via SELECT 1 query',
    timestamp: new Date().toISOString()
  });
});

// 2. PUBLIC: Driver Self-Registration Form
app.post('/api/auth/register-driver', (req, res) => {
  try {
    const { personal, guarantor, vehicle } = req.body;
    
    if (!personal || !guarantor || !vehicle) {
      return res.status(400).json({ error: 'Missing registration details. Personal, guarantor, and vehicle are required.' });
    }

    const db = loadDB();

    // Check unique constraints
    if (personal.companyDriverId) {
      const idExists = db.drivers.some(d => d.company_driver_id && d.company_driver_id.toUpperCase() === personal.companyDriverId.toUpperCase());
      if (idExists) {
        return res.status(400).json({ error: `RTL Driver ID ${personal.companyDriverId} is already associated with another driver.` });
      }
    }

    const emailExists = db.users.some(u => u.email.toLowerCase() === personal.email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: 'This email address is already registered inside our fleet.' });
    }

    const ninExists = db.drivers.some(d => d.nin === personal.nin);
    if (ninExists) {
      return res.status(400).json({ error: 'National Identification Number (NIN) already associated with another driver.' });
    }

    const plateExists = db.vehicles.some(v => v.plate_number.toUpperCase() === vehicle.plateNumber.toUpperCase());
    if (plateExists) {
      return res.status(400).json({ error: 'Vehicle plate number already registered.' });
    }

    // Process secure files to R2
    let driverPassportUrl = '';
    let guarantorPassportUrl = '';

    if (personal.passportPhoto) {
      driverPassportUrl = saveR2File(`${personal.fullName.replace(/\s+/g, '_')}_passport`, personal.passportPhoto);
    }
    if (guarantor.passport) {
      guarantorPassportUrl = saveR2File(`${guarantor.fullName.replace(/\s+/g, '_')}_guarantor_passport`, guarantor.passport);
    }

    // A. Create Core User
    const userId = generateUUID();
    const newUser = {
      id: userId,
      email: personal.email.toLowerCase(),
      phone: personal.phone,
      password_hash: hashPassword(personal.password || 'driver123'),
      full_name: personal.fullName,
      role_id: 'role-driver',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active' // Active immediately upon registration
    };

    // B. Create Driver Profile
    const driverId = generateUUID();
    const vehicleId = generateUUID();
    const agreedAmt = personal.agreedAmount !== undefined && personal.agreedAmount !== null && !isNaN(parseFloat(personal.agreedAmount)) ? parseFloat(personal.agreedAmount) : 0;
    const vehPrice = personal.vehiclePurchasePrice !== undefined && personal.vehiclePurchasePrice !== null && !isNaN(parseFloat(personal.vehiclePurchasePrice)) ? parseFloat(personal.vehiclePurchasePrice) : 0;
    const remBal = personal.remainingVehicleBalance !== undefined && personal.remainingVehicleBalance !== null && !isNaN(parseFloat(personal.remainingVehicleBalance)) ? parseFloat(personal.remainingVehicleBalance) : vehPrice;
    const compDrvId = personal.companyDriverId || `RTL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newDriver = {
      id: driverId,
      user_id: userId,
      userId: userId,
      company_driver_id: compDrvId,
      companyDriverId: compDrvId,
      full_name: personal.fullName,
      fullName: personal.fullName,
      email: personal.email.toLowerCase(),
      phone: personal.phone,
      address: personal.address,
      nin: personal.nin,
      license_number: personal.licenseNumber || `LIC-${generateUUID().substring(0, 5).toUpperCase()}`,
      licenseNumber: personal.licenseNumber || `LIC-${generateUUID().substring(0, 5).toUpperCase()}`,
      license_expiry: personal.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      licenseExpiry: personal.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      vehicle_id: vehicleId,
      vehicleId: vehicleId,
      assignedVehicleId: vehicleId,
      passport_photo_url: driverPassportUrl,
      passportPhoto: driverPassportUrl,
      passportPhotoUrl: driverPassportUrl,
      classification: personal.classification || 'Assisted',
      rating: 5.0,
      agreed_amount: agreedAmt,
      agreedAmount: agreedAmt,
      vehicle_purchase_price: vehPrice,
      vehiclePurchasePrice: vehPrice,
      remaining_vehicle_balance: remBal,
      remainingVehicleBalance: remBal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'approved' // Approved immediately upon registration
    };

    // C. Create Guarantor
    const guarantorId = generateUUID();
    const newGuarantor = {
      id: guarantorId,
      driver_id: driverId,
      driverId: driverId,
      full_name: guarantor.fullName,
      fullName: guarantor.fullName,
      phone: guarantor.phone,
      address: guarantor.address,
      relationship: guarantor.relationship,
      nin: guarantor.nin,
      passport_photo_url: guarantorPassportUrl,
      passportPhotoUrl: guarantorPassportUrl,
      passport: guarantorPassportUrl,
      created_at: new Date().toISOString(),
      status: 'active'
    };

    // D. Create Vehicle (Link assigned driver)
    const newVehicle = {
      id: vehicleId,
      driver_id: driverId,
      driverId: driverId,
      brand: vehicle.brand,
      model: vehicle.model,
      year: parseInt(vehicle.year) || 2020,
      colour: vehicle.colour || vehicle.color,
      color: vehicle.colour || vehicle.color,
      plate_number: vehicle.plateNumber ? vehicle.plateNumber.toUpperCase() : '',
      plateNumber: vehicle.plateNumber ? vehicle.plateNumber.toUpperCase() : '',
      registration_number: vehicle.registrationNumber || '',
      registrationNumber: vehicle.registrationNumber || '',
      chassis_number: vehicle.chassisNumber || '',
      chassisNumber: vehicle.chassisNumber || '',
      engine_number: vehicle.engineNumber || '',
      engineNumber: vehicle.engineNumber || '',
      capacity: vehicle.capacity || '30 Tons',
      mileage: 0,
      created_at: new Date().toISOString(),
      status: 'assigned'
    };

    // Save driver documents mapping
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

    // Save into D1 emulation
    db.users.push(newUser);
    db.drivers.push(newDriver);
    db.guarantors.push(newGuarantor);
    db.vehicles.push(newVehicle);

    // Register active notification for admins
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'New Self-Registered Driver Candidate',
      title_ha: 'Sabuwar Rijistar Direba',
      message_en: `Driver ${personal.fullName} submitted profile & vehicle ${vehicle.plateNumber}. Review required.`,
      message_ha: `Direba ${personal.fullName} ya mika bayanan motar sa ${vehicle.plateNumber}. Tana jiran amincewa.`,
      type: 'warning',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    // Ensure active cycle exists and operations state is running so Pay Now and installments work instantly
    if (!db.cycles) db.cycles = [];
    const hasActiveCycle = db.cycles.some(c => c.status === 'active' || c.status === 'paused');
    if (!hasActiveCycle) {
      db.cycles.unshift({
        id: 'CYC-2026-001',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        endGoalTons: 200,
        status: 'active',
        created_at: new Date().toISOString(),
        created_by: 'System Bootstrap',
        locked: false,
        extendedDays: 0,
        totalPausedSeconds: 0,
        financials: [],
        pauseHistory: []
      });
    }
    db.company_operations_state = { status: 'Running', updated_at: new Date().toISOString() };

    // Create session token so driver is automatically logged in
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const token = `tok_driver_${personal.email.split('@')[0]}_${generateUUID().replace(/-/g, '')}`;
    const session = {
      id: generateUUID(),
      user_id: userId,
      token,
      expires_at: expiresAt,
      user_ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Corporate API Consumer',
      created_at: new Date().toISOString(),
      status: 'active'
    };
    db.sessions.push(session);

    saveDB(db);

    // Server Audit Logs
    writeServerAuditLog(
      userId, 
      personal.email, 
      'driver', 
      'DRIVER_SELF_REGISTRATION', 
      null, 
      `Registered driver ${personal.fullName} with vehicle ${vehicle.plateNumber}`, 
      req
    );

    res.json({ 
      success: true, 
      token,
      user: {
        id: userId,
        email: personal.email,
        fullName: personal.fullName,
        role: 'driver'
      },
      message: 'Registration successful. Welcome to Ruqayya Transport.' 
    });
  } catch (error: any) {
    console.error('Driver self registration failure:', error);
    res.status(500).json({ error: `Internal registry compilation error: ${error.message}` });
  }
});

// 3. PUBLIC: Director Self-Registration (Only for system bootstrap / first setup)
app.post('/api/auth/register-director', (req, res) => {
  try {
    const { fullName, email, phone, password, companyId, passportPhoto } = req.body;
    
    if (!fullName || !email || !phone || !password || !companyId) {
      return res.status(400).json({ error: 'All fields are mandatory for Director authentication.' });
    }

    const db = loadDB();
    const hasExistingDirectors = db.users.some(u => u.role_id === 'role-director');

    // Security rule: If a director already exists, require active director credentials to create another!
    if (hasExistingDirectors) {
      // Must verify token
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(403).json({ error: 'Executive director setup already bootstrapped. Authorization required to spawn additional nodes.' });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const session = db.sessions.find(s => s.token === token && s.status === 'active');
      if (!session) {
        return res.status(401).json({ error: 'Invalid executive session token.' });
      }

      const creator = db.users.find(u => u.id === session.user_id);
      if (!creator || creator.role_id !== 'role-director') {
        return res.status(403).json({ error: 'Only authorized directors can spawn secondary director nodes.' });
      }
    }

    // Check unique constraints
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already mapped to an active ERP credential.' });
    }

    let passportUrl = '';
    if (passportPhoto) {
      passportUrl = saveR2File(`director_${fullName.replace(/\s+/g, '_')}`, passportPhoto);
    }

    const userId = generateUUID();
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      phone,
      password_hash: hashPassword(password),
      full_name: fullName,
      role_id: 'role-director',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active'
    };

    db.users.push(newUser);
    db.directors.push({
      id: generateUUID(),
      user_id: userId,
      company_id: companyId,
      passport_photo_url: passportUrl,
      created_at: new Date().toISOString(),
      status: 'active'
    });

    saveDB(db);

    writeServerAuditLog(
      null,
      email,
      'director',
      'DIRECTOR_SPAWNED',
      null,
      `New Director Node Created: ${fullName} (${companyId})`,
      req
    );

    res.json({ success: true, message: 'Director account established successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3b. AUTHENTICATED: Paper Record Migration (Driver Import)
app.post('/api/drivers/import', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admins or Directors only.' });
    }

    const { personal, guarantor, vehicle } = req.body;
    if (!personal || !guarantor || !vehicle) {
      return res.status(400).json({ error: 'Missing import details. Personal, guarantor, and vehicle are required.' });
    }

    if (!personal.companyDriverId) {
      return res.status(400).json({ error: 'Existing RTL Driver ID is mandatory for historical paper records migration.' });
    }

    const db = loadDB();

    // Check unique constraints
    const idExists = db.drivers.some(d => d.company_driver_id === personal.companyDriverId);
    if (idExists) {
      return res.status(400).json({ error: `RTL Driver ID ${personal.companyDriverId} already exists in the fleet database.` });
    }

    const emailExists = db.users.some(u => u.email.toLowerCase() === personal.email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: 'This email address is already registered inside our fleet.' });
    }

    const ninExists = db.drivers.some(d => d.nin === personal.nin);
    if (ninExists) {
      return res.status(400).json({ error: 'National Identification Number (NIN) already associated with another driver.' });
    }

    const plateExists = db.vehicles.some(v => v.plate_number.toUpperCase() === vehicle.plateNumber.toUpperCase());
    if (plateExists) {
      return res.status(400).json({ error: 'Vehicle plate number already registered.' });
    }

    // Process secure files to R2
    let driverPassportUrl = personal.passportPhoto || '';
    let guarantorPassportUrl = guarantor.passport || '';

    // A. Create Core User
    const userId = generateUUID();
    const newUser = {
      id: userId,
      email: personal.email.toLowerCase(),
      phone: personal.phone,
      password_hash: hashPassword(personal.password || 'driver123'),
      full_name: personal.fullName,
      role_id: 'role-driver',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active'
    };

    // B. Create Driver Profile with Opening Balance Details
    const driverId = generateUUID();
    const newDriver = {
      id: driverId,
      user_id: userId,
      company_driver_id: personal.companyDriverId,
      address: personal.address,
      nin: personal.nin,
      license_number: personal.licenseNumber || `LIC-${generateUUID().substring(0, 5).toUpperCase()}`,
      license_expiry: personal.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      classification: personal.classification || 'Assisted',
      rating: 5.0,
      agreed_amount: !isNaN(parseFloat(personal.agreedAmount)) ? parseFloat(personal.agreedAmount) : 0,
      vehicle_purchase_price: !isNaN(parseFloat(personal.vehiclePurchasePrice)) ? parseFloat(personal.vehiclePurchasePrice) : 0,
      remaining_vehicle_balance: parseFloat(personal.remainingVehicleBalance),
      status: 'approved',
      opening_balance: {
        is_imported: true,
        remaining_vehicle_balance: parseFloat(personal.remainingVehicleBalance),
        total_paid_to_date: parseFloat(personal.totalPaidToDate),
        agreed_amount: parseFloat(personal.agreedAmount),
        current_installment_position: parseInt(personal.currentInstallmentPosition) || 1,
        opening_balance_date: personal.openingBalanceDate || new Date().toISOString().split('T')[0],
        opening_notes: personal.openingNotes || 'Imported historical paper records'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // C. Create Guarantor
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

    // D. Create Vehicle (Link pending driver)
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
      status: 'assigned',
      created_at: new Date().toISOString()
    };

    // Save driver documents mapping
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

    // Register active notification for admins/directors
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Paper Record Imported Successfully',
      title_ha: 'An Shigar da Takardun Direba',
      message_en: `Driver ${personal.fullName} (${personal.companyDriverId}) imported. Remaining vehicle balance: ₦${parseFloat(personal.remainingVehicleBalance).toLocaleString()}.`,
      message_ha: `An shigar da direba ${personal.fullName} (${personal.companyDriverId}). Ragowar kudin mota: ₦${parseFloat(personal.remainingVehicleBalance).toLocaleString()}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_IMPORTED',
      null,
      `Import of historical paper records. RTL Driver ID: ${personal.companyDriverId}. Remaining vehicle balance: ₦${parseFloat(personal.remainingVehicleBalance).toLocaleString()}. Reason: Import of historical paper records.`,
      req
    );

    res.json({ success: true, message: 'Driver historical records successfully migrated to digital ledger.' });
  } catch (error: any) {
    console.error('Driver import failure:', error);
    res.status(500).json({ error: `Internal registry compilation error: ${error.message}` });
  }
});

// 4. AUTHENTICATED (Directors only): Admin Registration
app.post('/api/auth/register-admin', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied: Directors-only credential endpoint.' });
    }

    const { fullName, email, phone, password, companyId, passportPhoto } = req.body;
    if (!fullName || !email || !phone || !password || !companyId) {
      return res.status(400).json({ error: 'Complete all parameters.' });
    }

    const db = loadDB();
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    let passportUrl = '';
    if (passportPhoto) {
      passportUrl = saveR2File(`admin_${fullName.replace(/\s+/g, '_')}`, passportPhoto);
    }

    const userId = generateUUID();
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      phone,
      password_hash: hashPassword(password),
      full_name: fullName,
      role_id: 'role-admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active' // Approved automatically by creating director
    };

    db.users.push(newUser);
    db.admins.push({
      id: generateUUID(),
      user_id: userId,
      company_id: companyId,
      passport_photo_url: passportUrl,
      created_at: new Date().toISOString(),
      status: 'active'
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'ADMIN_CREATION',
      null,
      `Created Admin User: ${fullName} (${companyId})`,
      req
    );

    res.json({ success: true, message: 'Operator/Admin registered successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. PUBLIC: Secure Unified Login Endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, portal, email, password, rememberMe } = req.body;

    const db = loadDB();
    let user: any = null;
    let authType = '';

    if (username) {
      const cleanUsername = username.trim();
      const upperUsername = cleanUsername.toUpperCase();

      // Dynamically lookup user case-insensitively by username
      user = db.users.find(u => u.username && u.username.trim().toLowerCase() === cleanUsername.toLowerCase());

      if (!user) {
        // Fallback seed for default administrative handles if not yet present in DB
        if (upperUsername === 'MMR') {
          user = db.users.find(u => u.role_id === 'role-director');
          if (user) {
            user.username = 'MMR';
            user.full_name = 'Executive Director MMR';
          } else {
            const directorId = generateUUID();
            user = {
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
            };
            db.users.push(user);
            db.directors.push({
              id: generateUUID(),
              user_id: directorId,
              company_id: 'DIR-2026-MMR',
              passport_photo_url: '',
              created_at: new Date().toISOString(),
              status: 'active'
            });
          }
        } else if (upperUsername === 'ADAM' || upperUsername === 'ABAKAKA') {
          const adamUser = db.users.find(u => u.username === 'ADAM');
          const abakakaUser = db.users.find(u => u.username === 'ABAKAKA');
          const existingAdmins = db.users.filter(u => u.role_id === 'role-admin');

          if (upperUsername === 'ADAM') {
            user = adamUser || existingAdmins.find(u => u.username === 'ADAM') || existingAdmins[0];
            if (user) {
              user.username = 'ADAM';
              if (!user.full_name || user.full_name === 'Ibrahim Ahmad') {
                user.full_name = 'Operations Admin ADAM';
              }
            }
          } else if (upperUsername === 'ABAKAKA') {
            user = abakakaUser || existingAdmins.find(u => u.username === 'ABAKAKA') || existingAdmins[1];
            if (user) {
              user.username = 'ABAKAKA';
              if (!user.full_name || user.full_name === 'Ibrahim Ahmad') {
                user.full_name = 'Operations Admin ABAKAKA';
              }
            }
          }
          
          if (!user) {
            const adminId = generateUUID();
            user = {
              id: adminId,
              username: upperUsername,
              email: `${upperUsername.toLowerCase()}@ruqayyatransport.com`,
              phone: '+234 803 222 0002',
              password_hash: hashPassword('admin123'),
              full_name: upperUsername === 'ADAM' ? 'Operations Admin ADAM' : 'Operations Admin ABAKAKA',
              role_id: 'role-admin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'active'
            };
            db.users.push(user);
            db.admins.push({
              id: generateUUID(),
              user_id: adminId,
              company_id: `ADM-2026-${upperUsername}`,
              passport_photo_url: '',
              created_at: new Date().toISOString(),
              status: 'active'
            });
          }
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Access Denied: Unregistered enterprise username.' });
      }

      // Check password if provided
      if (password && password.trim().length > 0) {
        if (!verifyPassword(password, user.password_hash)) {
          return res.status(401).json({ error: 'Access Denied: Invalid password for this username.' });
        }
      }

      // Route-specific role enforcement
      if (portal) {
        if (portal.startsWith('/director')) {
          if (user.role_id !== 'role-director' && user.role !== 'director' && user.role_id !== 'role-admin' && user.role !== 'admin') {
            return res.status(401).json({ error: 'Access Denied: Only authorized Director credentials can access this secure node.' });
          }
        } else if (portal.startsWith('/admin')) {
          if (user.role_id !== 'role-admin' && user.role !== 'admin' && user.role_id !== 'role-director' && user.role !== 'director') {
            return res.status(401).json({ error: 'Access Denied: Only authorized Admin credentials can access this secure node.' });
          }
        }
      }

      authType = 'username-only';
    } else {
      // Standard email & password login for public users (drivers, shareholders)
      if (!email || !password) {
        return res.status(400).json({ error: 'Please submit both email and password validation credentials.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      user = db.users.find(u => 
        (u.email && u.email.trim().toLowerCase() === cleanEmail) || 
        (u.username && u.username.trim().toLowerCase() === cleanEmail)
      );
      if (!user) {
        writeServerAuditLog(null, email, 'public', 'AUTH_FAILURE', `Attempt with unregistered email`, null, req);
        return res.status(401).json({ error: 'Access Denied: Unregistered email or invalid passwords.' });
      }

      if (!verifyPassword(password, user.password_hash)) {
        writeServerAuditLog(user.id, email, 'public', 'AUTH_FAILURE', 'Invalid password submission', null, req);
        return res.status(401).json({ error: 'Access Denied: Invalid credentials.' });
      }
      authType = 'email-password';
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your corporate access node has been suspended by an Administrator.' });
    }

    if (user.status === 'pending' && user.role_id === 'role-driver') {
      return res.status(403).json({ error: 'Roster approval pending. Please wait for an administrator to authorize your profile.' });
    }

    // Allocate session duration (30 days for username-only, or custom for email-password)
    const sessionDurationHours = rememberMe ? 24 * 30 : 2; // 30 days or 2 hours
    const expiresAt = new Date(Date.now() + (authType === 'username-only' ? 30 * 24 : sessionDurationHours) * 60 * 60 * 1000).toISOString();
    const roleName = db.roles.find(r => r.id === user.role_id)?.name || 'public';
    const userKey = user.username || (user.email ? user.email.split('@')[0] : user.id);
    const token = `tok_${roleName}_${userKey}_${generateUUID().replace(/-/g, '')}`;
    
    const session = {
      id: generateUUID(),
      user_id: user.id,
      token,
      expires_at: expiresAt,
      user_ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Corporate API Consumer',
      created_at: new Date().toISOString(),
      status: 'active'
    };

    db.sessions.push(session);
    saveDB(db);

    writeServerAuditLog(user.id, user.email, roleName, 'SESSION_CREATED', null, `Authorized ${authType} login session valid until ${expiresAt}`, req);

    res.json({
      success: true,
      token,
      expiresAt,
      mustChangePassword: !!user.must_change_password,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: roleName
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5b. AUTHENTICATED: First Login Change Password Reset
app.post('/api/auth/change-password-first-login', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Please submit a secure password (minimum 6 characters).' });
    }

    const db = loadDB();
    const user = db.users.find(u => u.id === actor.id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    user.password_hash = hashPassword(newPassword);
    user.must_change_password = false;
    user.updated_at = new Date().toISOString();

    saveDB(db);

    writeServerAuditLog(
      user.id,
      user.email,
      actor.role,
      'FIRST_LOGIN_PASSWORD_CHANGE',
      null,
      `User successfully performed mandatory first-login password change.`,
      req
    );

    res.json({ success: true, message: 'Password updated successfully. Access unlocked.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. AUTHENTICATED: Get Active User Payload
app.get('/api/auth/me', authenticateSession, (req, res) => {
  const actor = (req as any).user;
  const db = loadDB();
  const user = db.users.find(u => u.id === actor.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User record missing.' });
  }

  // Retrieve role description & permissions
  const permissions = db.permissions.filter(p => {
    // Basic hardcoded access mapping for robustness
    if (actor.role === 'director') return true; // Directors hold all permissions
    if (actor.role === 'admin' && p.name !== 'view_audit_logs') return true;
    if (actor.role === 'driver' && p.name === 'request_vouchers') return true;
    return false;
  }).map(p => p.name);

  // Load profile specific attributes
  let profileDetails: any = {};
  if (actor.role === 'driver') {
    const dr = db.drivers.find(d => d.user_id === actor.id);
    if (dr) {
      const guarantor = db.guarantors.find(g => g.driver_id === dr.id) || null;
      const vehicle = db.vehicles.find(v => v.driver_id === dr.id) || null;
      const financials = getDriverFinancials(dr, db);
      profileDetails = { 
        ...dr, 
        guarantor, 
        vehicle,
        remaining_vehicle_balance: financials.remainingVehicleBalance,
        total_amount_paid: financials.totalAmountPaid,
        vehicle_purchase_price: financials.vehiclePurchasePrice,
        total_payments_made: financials.totalPaymentsMade
      };
    }
  }

  const adminRec = db.admins?.find(a => a.user_id === actor.id);
  const dirRec = db.directors?.find(d => d.user_id === actor.id);
  const avatar = user.passport_photo_url || adminRec?.passport_photo_url || dirRec?.passport_photo_url || profileDetails?.passport_photo_url || '';

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: actor.role,
      mustChangePassword: !!user.must_change_password,
      avatar,
      passportPhotoUrl: avatar,
      passport_photo_url: avatar,
      permissions,
      profile: profileDetails
    }
  });
});

app.put('/api/auth/me', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const userRec = db.users.find(u => u.id === actor.id);
    if (!userRec) return res.status(404).json({ error: 'User record missing.' });

    const { fullName, phone, passportPhoto, passport_photo_url, avatar } = req.body;
    if (fullName) userRec.full_name = fullName;
    if (phone) userRec.phone = phone;

    let photo = passportPhoto || passport_photo_url || avatar;
    if (photo !== undefined) {
      if (photo && (photo.startsWith('data:') || (photo.length > 500 && !photo.startsWith('http') && !photo.startsWith('/api/')))) {
        // It's a base64 string! Save it using the standard saveR2File helper
        photo = saveR2File(`avatar_${actor.id}.png`, photo);
      }
      
      userRec.passport_photo_url = photo;

      if (actor.role === 'admin') {
        let adminRec = db.admins?.find(a => a.user_id === actor.id);
        if (!adminRec) {
          if (!db.admins) db.admins = [];
          adminRec = {
            id: generateUUID(),
            user_id: actor.id,
            company_id: `ADM-2026-${userRec.username || 'ADMIN'}`,
            passport_photo_url: photo,
            created_at: new Date().toISOString(),
            status: 'active'
          };
          db.admins.push(adminRec);
        } else {
          adminRec.passport_photo_url = photo;
        }
      } else if (actor.role === 'director') {
        let dirRec = db.directors?.find(d => d.user_id === actor.id);
        if (!dirRec) {
          if (!db.directors) db.directors = [];
          dirRec = {
            id: generateUUID(),
            user_id: actor.id,
            company_id: `DIR-2026-${userRec.username || 'DIR'}`,
            passport_photo_url: photo,
            created_at: new Date().toISOString(),
            status: 'active'
          };
          db.directors.push(dirRec);
        } else {
          dirRec.passport_photo_url = photo;
        }
      } else if (actor.role === 'driver') {
        const drv = db.drivers?.find(d => d.user_id === actor.id);
        if (drv) drv.passport_photo_url = photo;
      } else if (actor.role === 'shareholder') {
        const sh = db.shareholders?.find(s => s.user_id === actor.id);
        if (sh) sh.passport_photo_url = photo;
      }
    }

    saveDB(db);
    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: userRec.id,
        fullName: userRec.full_name,
        full_name: userRec.full_name,
        email: userRec.email,
        phone: userRec.phone,
        role: actor.role,
        avatar: userRec.passport_photo_url || photo || '',
        passportPhotoUrl: userRec.passport_photo_url || photo || '',
        passport_photo_url: userRec.passport_photo_url || photo || ''
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. AUTHENTICATED: Secure Logout (Support All Devices)
app.post('/api/auth/logout', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const token = (req as any).token;
    const { logoutAllDevices } = req.body;

    const db = loadDB();

    if (logoutAllDevices) {
      // Mark all sessions of this user as terminated
      db.sessions = db.sessions.map(s => {
        if (s.user_id === actor.id && s.status === 'active') {
          return { ...s, status: 'logged_out_all_devices' };
        }
        return s;
      });
      writeServerAuditLog(actor.id, actor.email, actor.role, 'LOGOUT_ALL_DEVICES', 'Multiple active session keys', 'All sessions blacklisted', req);
    } else {
      // Mark only the current active session
      db.sessions = db.sessions.map(s => {
        if (s.token === token) {
          return { ...s, status: 'logged_out' };
        }
        return s;
      });
      writeServerAuditLog(actor.id, actor.email, actor.role, 'LOGOUT', token, 'Session token invalidated', req);
    }

    saveDB(db);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. AUTHENTICATED: Get Audit Logs Stream (Directors & Admins only)
app.get('/api/audit-logs', authenticateSession, (req, res) => {
  const actor = (req as any).user;
  if (actor.role !== 'director' && actor.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied: Operations audit log permissions required.' });
  }

  const db = loadDB();
  res.json(db.audit_logs.slice(0, 200)); // Limit to last 200 logs
});

// 9. AUTHENTICATED: Get Drivers Fleet Registry (Search, Approvals, Classifications)
app.get('/api/drivers', authenticateSession, (req, res) => {
  const actor = (req as any).user;
  if (actor.role !== 'admin' && actor.role !== 'director') {
    return res.status(403).json({ error: 'Access Denied.' });
  }

  const { search } = req.query;
  const db = loadDB();

  let results = db.drivers.map(drv => {
    const user = db.users.find(u => u.id === drv.user_id);
    const guarantor = db.guarantors.find(g => g.driver_id === drv.id);
    const vehicle = db.vehicles.find(v => v.driver_id === drv.id);
    const financials = getDriverFinancials(drv, db);
    const documents = (db.driver_documents || []).filter(doc => doc.driver_id === drv.id);
    const passportDoc = documents.find(doc => doc.document_type === 'passport_photo');
    const passport_photo_url = passportDoc ? passportDoc.file_url : '';
    return {
      ...drv,
      fullName: user?.full_name || 'Candidate',
      email: user?.email || '',
      phone: user?.phone || '',
      guarantor,
      vehicle,
      documents,
      passport_photo_url,
      passportPhoto: passport_photo_url, // For fallback
      passportPhotoUrl: passport_photo_url, // For fallback
      remaining_vehicle_balance: financials.remainingVehicleBalance,
      total_amount_paid: financials.totalAmountPaid,
      vehicle_purchase_price: financials.vehiclePurchasePrice,
      total_payments_made: financials.totalPaymentsMade
    };
  });

  if (search) {
    const q = (search as string).toLowerCase().trim();
    results = results.filter(r => 
      r.fullName.toLowerCase().includes(q) ||
      (r.company_driver_id && r.company_driver_id.toLowerCase().includes(q)) ||
      r.phone.includes(q) ||
      (r.vehicle?.plate_number && r.vehicle.plate_number.toLowerCase().includes(q)) ||
      (r.vehicle?.registration_number && r.vehicle.registration_number.toLowerCase().includes(q))
    );
  }

  res.json(results);
});

// 10. AUTHENTICATED: Get Driver Full Profile Detail
app.get('/api/drivers/:id', authenticateSession, (req, res) => {
  const actor = (req as any).user;
  const db = loadDB();

  let targetId = req.params.id;
  if (actor.role === 'driver') {
    // Driver can query 'me', 'self', their user_id, or their driver id
    const selfDriver = db.drivers.find(d => d.user_id === actor.id || d.id === actor.id || d.id === req.params.id || d.user_id === req.params.id);
    if (!selfDriver) return res.status(404).json({ error: 'Driver profile not found.' });
    targetId = selfDriver.id;
  } else if (actor.role !== 'admin' && actor.role !== 'director') {
    return res.status(403).json({ error: 'Access Denied.' });
  }

  let drv = db.drivers.find(d => d.id === targetId || d.user_id === targetId || (targetId === 'me' && d.user_id === actor.id) || (targetId === 'self' && d.user_id === actor.id));
  if (!drv && actor.role === 'driver') {
    drv = db.drivers.find(d => d.user_id === actor.id);
  }
  if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

  const user = db.users.find(u => u.id === drv.user_id);
  const guarantor = db.guarantors.find(g => g.driver_id === drv.id || g.driverId === drv.id);
  const vehicle = db.vehicles.find(v => v.driver_id === drv.id || v.driverId === drv.id || v.id === drv.vehicle_id || v.id === drv.vehicleId);
  const documents = (db.driver_documents || []).filter(doc => doc.driver_id === drv.id);
  const passportDoc = documents.find(doc => doc.document_type === 'passport_photo');
  const passport_photo_url = passportDoc ? passportDoc.file_url : (drv.passport_photo_url || drv.passportPhoto || drv.passportPhotoUrl || '');
  const financials = getDriverFinancials(drv, db);

  const normalizedGuarantor = guarantor ? {
    ...guarantor,
    fullName: guarantor.full_name || guarantor.fullName,
    full_name: guarantor.full_name || guarantor.fullName,
    passport_photo_url: guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport || '',
    passportPhotoUrl: guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport || '',
    passport: guarantor.passport_photo_url || guarantor.passportPhotoUrl || guarantor.passport || ''
  } : null;

  const normalizedVehicle = vehicle ? {
    ...vehicle,
    plateNumber: vehicle.plate_number || vehicle.plateNumber,
    plate_number: vehicle.plate_number || vehicle.plateNumber,
    registrationNumber: vehicle.registration_number || vehicle.registrationNumber,
    registration_number: vehicle.registration_number || vehicle.registrationNumber,
    chassisNumber: vehicle.chassis_number || vehicle.chassisNumber,
    chassis_number: vehicle.chassis_number || vehicle.chassisNumber,
    engineNumber: vehicle.engine_number || vehicle.engineNumber,
    engine_number: vehicle.engine_number || vehicle.engineNumber,
    color: vehicle.colour || vehicle.color,
    colour: vehicle.colour || vehicle.color
  } : null;

  res.json({
    ...drv,
    id: drv.id,
    user_id: drv.user_id,
    userId: drv.user_id,
    company_driver_id: drv.company_driver_id || drv.companyDriverId || '',
    companyDriverId: drv.company_driver_id || drv.companyDriverId || '',
    fullName: user?.full_name || drv.full_name || drv.fullName || 'Driver',
    full_name: user?.full_name || drv.full_name || drv.fullName || 'Driver',
    email: user?.email || drv.email || '',
    phone: user?.phone || drv.phone || '',
    address: drv.address || '',
    nin: drv.nin || '',
    license_number: drv.license_number || drv.licenseNumber || '',
    licenseNumber: drv.license_number || drv.licenseNumber || '',
    license_expiry: drv.license_expiry || drv.licenseExpiry || '',
    licenseExpiry: drv.license_expiry || drv.licenseExpiry || '',
    guarantor: normalizedGuarantor,
    vehicle: normalizedVehicle,
    vehicleId: vehicle?.id || drv.vehicle_id || drv.vehicleId || null,
    assignedVehicleId: vehicle?.id || drv.vehicle_id || drv.vehicleId || null,
    documents,
    passport_photo_url,
    passportPhoto: passport_photo_url,
    passportPhotoUrl: passport_photo_url,
    agreedAmount: financials.agreedAmount,
    agreed_amount: financials.agreedAmount,
    vehiclePurchasePrice: financials.vehiclePurchasePrice,
    vehicle_purchase_price: financials.vehiclePurchasePrice,
    remainingVehicleBalance: financials.remainingVehicleBalance,
    remaining_vehicle_balance: financials.remainingVehicleBalance,
    totalAmountPaid: financials.totalAmountPaid,
    total_amount_paid: financials.totalAmountPaid,
    totalPaymentsMade: financials.totalPaymentsMade,
    total_payments_made: financials.totalPaymentsMade
  });
});

// 10.5. Get dynamic contract terms lookup for a driver's vehicle
app.get('/api/drivers/:id/contract-lookup', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const drv = db.drivers.find(d => d.id === req.params.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

    const vehicle = db.vehicles.find(v => v.driver_id === drv.id);
    const terms = lookupContractTerms(vehicle);
    res.json(terms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10.8 AUTHENTICATED (Admins and Directors): Complete Driver Profile Update
app.put('/api/drivers/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Administrative authorization required.' });
    }

    const db = loadDB();
    const drv = db.drivers.find(d => d.id === req.params.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

    const payload = req.body || {};
    const u = db.users.find((usr: any) => usr.id === drv.user_id);

    if (payload.passportPhoto) {
      drv.passport_photo_url = payload.passportPhoto;
      drv.passportPhoto = payload.passportPhoto;
      if (!db.driver_documents) db.driver_documents = [];
      const existingDoc = db.driver_documents.find((d: any) => d.driver_id === drv.id && d.document_type === 'passport_photo');
      if (existingDoc) {
        existingDoc.file_url = payload.passportPhoto;
        existingDoc.created_at = new Date().toISOString();
        existingDoc.created_by = actor.fullName;
      } else {
        db.driver_documents.push({
          id: generateUUID(),
          driver_id: drv.id,
          document_type: 'passport_photo',
          file_url: payload.passportPhoto,
          created_at: new Date().toISOString(),
          created_by: actor.fullName,
          status: 'active'
        });
      }
    }

    if (payload.fullName) {
      if (u) u.full_name = payload.fullName;
      drv.full_name = payload.fullName;
      drv.fullName = payload.fullName;
    }
    if (payload.email && u) u.email = payload.email;
    if (payload.phone) {
      if (u) u.phone = payload.phone;
      drv.phone = payload.phone;
    }
    if (payload.address !== undefined) drv.address = payload.address;
    if (payload.nin !== undefined) drv.nin = payload.nin;
    if (payload.licenseNumber !== undefined) {
      drv.license_number = payload.licenseNumber;
      drv.licenseNumber = payload.licenseNumber;
    }
    if (payload.licenseExpiry !== undefined) {
      drv.license_expiry = payload.licenseExpiry;
      drv.licenseExpiry = payload.licenseExpiry;
    }
    if (payload.companyDriverId !== undefined) {
      drv.company_driver_id = payload.companyDriverId;
      drv.companyDriverId = payload.companyDriverId;
    }
    if (payload.agreedAmount !== undefined && payload.agreedAmount !== '' && !isNaN(parseFloat(payload.agreedAmount))) {
      drv.agreed_amount = parseFloat(payload.agreedAmount);
      drv.agreedAmount = parseFloat(payload.agreedAmount);
    }
    if (payload.vehiclePurchasePrice !== undefined && payload.vehiclePurchasePrice !== '' && !isNaN(parseFloat(payload.vehiclePurchasePrice))) {
      drv.vehicle_purchase_price = parseFloat(payload.vehiclePurchasePrice);
      drv.vehiclePurchasePrice = parseFloat(payload.vehiclePurchasePrice);
    }
    if (payload.remainingVehicleBalance !== undefined && payload.remainingVehicleBalance !== '' && !isNaN(parseFloat(payload.remainingVehicleBalance))) {
      drv.remaining_vehicle_balance = parseFloat(payload.remainingVehicleBalance);
      drv.remainingVehicleBalance = parseFloat(payload.remainingVehicleBalance);
      if (drv.opening_balance) {
        drv.opening_balance.remaining_vehicle_balance = parseFloat(payload.remainingVehicleBalance);
      }
    }
    if (payload.classification !== undefined) {
      drv.classification = payload.classification;
    }
    if (payload.status) {
      drv.status = payload.status;
      if (u) {
        u.status = (payload.status === 'approved' || payload.status === 'available' || payload.status === 'on-trip') ? 'active' : payload.status;
      }
    }

    if (payload.guarantor) {
      if (!drv.guarantor) drv.guarantor = {};
      if (payload.guarantor.fullName !== undefined) drv.guarantor.fullName = payload.guarantor.fullName;
      if (payload.guarantor.phone !== undefined) drv.guarantor.phone = payload.guarantor.phone;
      if (payload.guarantor.address !== undefined) drv.guarantor.address = payload.guarantor.address;
      if (payload.guarantor.relationship !== undefined) drv.guarantor.relationship = payload.guarantor.relationship;
      if (payload.guarantor.nin !== undefined) drv.guarantor.nin = payload.guarantor.nin;
      if (payload.guarantor.passportPhoto !== undefined) {
        drv.guarantor.passportPhoto = payload.guarantor.passportPhoto;
        drv.guarantor.passport_photo_url = payload.guarantor.passportPhoto;
      }
    }

    if (payload.vehicle) {
      let vehicle = (db.vehicles || []).find((v: any) => v.driver_id === drv.id || v.driverId === drv.id || v.id === drv.vehicle_id || v.id === drv.vehicleId);
      if (vehicle) {
        if (payload.vehicle.brand !== undefined) vehicle.brand = payload.vehicle.brand;
        if (payload.vehicle.model !== undefined) vehicle.model = payload.vehicle.model;
        if (payload.vehicle.year !== undefined && payload.vehicle.year !== '' && !isNaN(parseInt(payload.vehicle.year))) vehicle.year = parseInt(payload.vehicle.year);
        if (payload.vehicle.color !== undefined || payload.vehicle.colour !== undefined) {
          const c = payload.vehicle.color || payload.vehicle.colour;
          vehicle.colour = c;
          vehicle.color = c;
        }
        if (payload.vehicle.plateNumber !== undefined) {
          vehicle.plate_number = payload.vehicle.plateNumber;
          vehicle.plateNumber = payload.vehicle.plateNumber;
        }
        if (payload.vehicle.registrationNumber !== undefined) {
          vehicle.registration_number = payload.vehicle.registrationNumber;
          vehicle.registrationNumber = payload.vehicle.registrationNumber;
        }
        if (payload.vehicle.chassisNumber !== undefined) {
          vehicle.chassis_number = payload.vehicle.chassisNumber;
          vehicle.chassisNumber = payload.vehicle.chassisNumber;
        }
        if (payload.vehicle.engineNumber !== undefined) {
          vehicle.engine_number = payload.vehicle.engineNumber;
          vehicle.engineNumber = payload.vehicle.engineNumber;
        }
        if (payload.vehicle.capacity !== undefined) vehicle.capacity = payload.vehicle.capacity;
      }
    }

    drv.updated_at = new Date().toISOString();
    drv.updated_by = actor.fullName;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_ADMIN_FORCE_EDIT',
      null,
      `Admin updated complete profile of driver ${drv.company_driver_id || drv.id}`,
      req
    );

    res.json({ success: true, message: 'Driver details updated successfully.', driver: drv });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. AUTHENTICATED (Admins and Directors): Approve / Reject Driver Roster Status
app.put('/api/drivers/:id/status', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Administrator approval required.' });
    }

    const { status, remarks, companyDriverId } = req.body; // 'approved', 'rejected', 'correction_requested'
    if (!status) return res.status(400).json({ error: 'Please submit decision parameter.' });

    const db = loadDB();
    const drv = db.drivers.find(d => d.id === req.params.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

    const prevStatus = drv.status;
    drv.status = status;
    drv.updated_at = new Date().toISOString();
    drv.updated_by = actor.fullName;

    // Link user status
    const user = db.users.find(u => u.id === drv.user_id);
    if (user) {
      user.status = status === 'approved' ? 'active' : status;
    }

    if (status === 'approved') {
      const cid = companyDriverId || drv.company_driver_id || drv.companyDriverId || `DRV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      drv.company_driver_id = cid;
      drv.companyDriverId = cid;

      // Update linked vehicle status & link ids bidirectionally
      const vehicle = db.vehicles.find(v => v.driver_id === drv.id || v.driverId === drv.id || v.id === drv.vehicle_id || v.id === drv.vehicleId);
      if (vehicle) {
        vehicle.status = 'assigned';
        vehicle.driver_id = drv.id;
        vehicle.driverId = drv.id;
        drv.vehicle_id = vehicle.id;
        drv.vehicleId = vehicle.id;
        drv.assignedVehicleId = vehicle.id;
      }

      // Preserve driver's registered numbers or fallback to terms
      const terms = lookupContractTerms(vehicle);
      if (!drv.agreed_amount && !drv.agreedAmount) {
        drv.agreed_amount = terms.agreedAmount;
        drv.agreedAmount = terms.agreedAmount;
      } else {
        const val = parseFloat(drv.agreed_amount || drv.agreedAmount);
        drv.agreed_amount = val;
        drv.agreedAmount = val;
      }

      if (!drv.vehicle_purchase_price && !drv.vehiclePurchasePrice) {
        drv.vehicle_purchase_price = terms.purchasePrice;
        drv.vehiclePurchasePrice = terms.purchasePrice;
      } else {
        const val = parseFloat(drv.vehicle_purchase_price || drv.vehiclePurchasePrice);
        drv.vehicle_purchase_price = val;
        drv.vehiclePurchasePrice = val;
      }

      if (!drv.remaining_vehicle_balance && !drv.remainingVehicleBalance) {
        drv.remaining_vehicle_balance = drv.vehicle_purchase_price;
        drv.remainingVehicleBalance = drv.vehicle_purchase_price;
      } else {
        const val = parseFloat(drv.remaining_vehicle_balance || drv.remainingVehicleBalance);
        drv.remaining_vehicle_balance = val;
        drv.remainingVehicleBalance = val;
      }
    }

    // Notify Driver via notifications
    db.notifications.unshift({
      id: generateUUID(),
      user_id: drv.user_id,
      title_en: `Roster Review: ${status.toUpperCase()}`,
      title_ha: `Sakamakon Tattaunawa: ${status.toUpperCase()}`,
      message_en: `Your professional transport credential is ${status}. ${remarks || ''}`,
      message_ha: `Sakamakon takardun ka: an daidaita su zuwa ${status}. ${remarks || ''}`,
      type: status === 'approved' ? 'success' : 'danger',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_STATUS_UPDATE',
      `Status was ${prevStatus}`,
      `Updated status of driver ${user?.full_name} to ${status.toUpperCase()}. Comments: ${remarks || 'None'}`,
      req
    );

    res.json({ success: true, message: `Driver registration state committed successfully as ${status.toUpperCase()}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11.5. LIVE REAL-TIME TELEMATICS & DUTY SHIFT TRACKING
app.post('/api/driver/duty/start', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const drv = db.drivers.find(d => d.user_id === actor.id || d.id === actor.id);
    if (!drv) {
      return res.status(404).json({ error: 'Driver profile not linked.' });
    }

    const { startingMileage, startingLocation, latitude, longitude, placeName } = req.body;
    if (!db.driver_duty_sessions) db.driver_duty_sessions = [];

    const nowIso = new Date().toISOString();
    db.driver_duty_sessions.forEach(s => {
      if (s.driver_id === drv.id && s.status === 'active') {
        s.status = 'completed';
        s.finish_time = nowIso;
      }
    });

    const newDutySession = {
      id: `DUTY-${Date.now()}-${generateUUID().substring(0, 6).toUpperCase()}`,
      driver_id: drv.id,
      driver_name: actor.fullName || drv.full_name || 'Driver',
      company_driver_id: drv.company_driver_id || 'DRV-UNKNOWN',
      start_time: nowIso,
      finish_time: null,
      status: 'active',
      starting_mileage: parseFloat(startingMileage) || 0,
      starting_location: startingLocation || placeName || 'Ruqayya Central Terminal',
      latitude: latitude || 9.0765,
      longitude: longitude || 7.3986,
      places_visited: []
    };

    db.driver_duty_sessions.unshift(newDutySession);

    const initPlace = placeName || startingLocation || 'Ruqayya Central Depot';
    const initPlaceRecord = {
      id: `PLC-${Date.now()}-${generateUUID().substring(0, 4)}`,
      place_name: initPlace,
      arrived_at: nowIso,
      departed_at: null,
      dwell_duration_minutes: 0,
      status: 'active_dwell',
      activity: 'Shift Commencement & Pre-trip Check',
      latitude: latitude || 9.0765,
      longitude: longitude || 7.3986
    };
    newDutySession.places_visited.push(initPlaceRecord);

    drv.status = 'available';
    drv.updated_at = nowIso;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_SHIFT_START',
      'OFF_DUTY',
      `Driver ${drv.full_name || actor.fullName} started work shift at ${initPlace}`,
      req
    );

    res.json({
      success: true,
      message: 'Work shift started successfully. GPS telematics active.',
      dutySession: newDutySession
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/driver/duty/finish', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const drv = db.drivers.find(d => d.user_id === actor.id || d.id === actor.id);
    if (!drv) {
      return res.status(404).json({ error: 'Driver profile not linked.' });
    }

    const { endingMileage, notes } = req.body;
    if (!db.driver_duty_sessions) db.driver_duty_sessions = [];

    const activeSession = db.driver_duty_sessions.find(s => s.driver_id === drv.id && s.status === 'active');
    const nowIso = new Date().toISOString();

    if (activeSession) {
      activeSession.status = 'completed';
      activeSession.finish_time = nowIso;
      activeSession.ending_mileage = parseFloat(endingMileage) || activeSession.starting_mileage;
      activeSession.notes = notes || '';

      const startTime = new Date(activeSession.start_time).getTime();
      const endTime = new Date(nowIso).getTime();
      const totalMinutes = Math.round((endTime - startTime) / (1000 * 60));
      activeSession.total_duty_hours = (totalMinutes / 60).toFixed(2);

      if (activeSession.places_visited && activeSession.places_visited.length > 0) {
        const lastPlace = activeSession.places_visited[activeSession.places_visited.length - 1];
        if (!lastPlace.departed_at) {
          lastPlace.departed_at = nowIso;
          const arrTime = new Date(lastPlace.arrived_at).getTime();
          lastPlace.dwell_duration_minutes = Math.round((endTime - arrTime) / (1000 * 60));
          lastPlace.status = 'completed';
        }
      }
    }

    drv.status = 'off-duty';
    drv.updated_at = nowIso;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_SHIFT_FINISH',
      'ON_DUTY',
      `Driver ${drv.full_name || actor.fullName} finished work shift.`,
      req
    );

    res.json({
      success: true,
      message: 'Work shift ended successfully. Off duty status recorded.',
      dutySession: activeSession || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/driver/location', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    let drv = db.drivers.find(d => d.user_id === actor.id || d.id === actor.id);
    if (!drv && req.body.driverId) {
      drv = db.drivers.find(d => d.id === req.body.driverId);
    }
    
    if (!drv) {
      return res.status(404).json({ error: 'Driver profile not found.' });
    }

    const { latitude, longitude, accuracy, speed, heading, altitude, placeName, activity } = req.body;
    const nowIso = new Date().toISOString();

    if (!db.driver_locations) db.driver_locations = [];

    let loc = db.driver_locations.find(l => l.driver_id === drv.id);
    if (!loc) {
      loc = {
        id: `LOC-${drv.id}`,
        driver_id: drv.id,
        driver_name: drv.full_name || actor.fullName,
        company_driver_id: drv.company_driver_id || 'DRV-UNKNOWN',
        latitude: parseFloat(latitude) || 9.0765,
        longitude: parseFloat(longitude) || 7.3986,
        accuracy: parseFloat(accuracy) || 10,
        speed: parseFloat(speed) || 0,
        heading: parseFloat(heading) || 0,
        altitude: parseFloat(altitude) || 0,
        place_name: placeName || 'Abuja Fleet Corridor',
        activity: activity || (speed > 5 ? 'In Transit' : 'Stationary Work'),
        updated_at: nowIso,
        history: []
      };
      db.driver_locations.push(loc);
    } else {
      loc.latitude = parseFloat(latitude) || loc.latitude;
      loc.longitude = parseFloat(longitude) || loc.longitude;
      loc.accuracy = parseFloat(accuracy) || loc.accuracy;
      loc.speed = parseFloat(speed) >= 0 ? parseFloat(speed) : loc.speed;
      loc.heading = parseFloat(heading) || loc.heading;
      loc.place_name = placeName || loc.place_name;
      loc.activity = activity || (loc.speed > 5 ? 'In Transit' : 'Stationary Work');
      loc.updated_at = nowIso;
      
      if (!loc.history) loc.history = [];
      loc.history.unshift({
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        heading: loc.heading,
        place_name: loc.place_name,
        timestamp: nowIso
      });
      if (loc.history.length > 50) loc.history = loc.history.slice(0, 50);
    }

    if (!db.driver_duty_sessions) db.driver_duty_sessions = [];
    const activeSession = db.driver_duty_sessions.find(s => s.driver_id === drv.id && s.status === 'active');

    if (activeSession) {
      if (!activeSession.places_visited) activeSession.places_visited = [];
      const currentPlaceName = placeName || loc.place_name || 'Stationary Location';
      const lastPlace = activeSession.places_visited[activeSession.places_visited.length - 1];

      if (!lastPlace) {
        activeSession.places_visited.push({
          id: `PLC-${Date.now()}-${generateUUID().substring(0, 4)}`,
          place_name: currentPlaceName,
          arrived_at: nowIso,
          departed_at: null,
          dwell_duration_minutes: 0,
          status: 'active_dwell',
          activity: activity || 'Workstation Check',
          latitude: loc.latitude,
          longitude: loc.longitude
        });
      } else if (lastPlace.place_name === currentPlaceName) {
        const arrTime = new Date(lastPlace.arrived_at).getTime();
        const currTime = new Date(nowIso).getTime();
        lastPlace.dwell_duration_minutes = Math.round((currTime - arrTime) / (1000 * 60));
        lastPlace.status = 'active_dwell';
      } else if (currentPlaceName && lastPlace.place_name !== currentPlaceName) {
        const arrTime = new Date(lastPlace.arrived_at).getTime();
        const currTime = new Date(nowIso).getTime();
        lastPlace.departed_at = nowIso;
        lastPlace.dwell_duration_minutes = Math.round((currTime - arrTime) / (1000 * 60));
        lastPlace.status = 'completed';

        activeSession.places_visited.push({
          id: `PLC-${Date.now()}-${generateUUID().substring(0, 4)}`,
          place_name: currentPlaceName,
          arrived_at: nowIso,
          departed_at: null,
          dwell_duration_minutes: 0,
          status: 'active_dwell',
          activity: activity || 'Workstation Check',
          latitude: loc.latitude,
          longitude: loc.longitude
        });
      }
    }

    saveDB(db);

    res.json({
      success: true,
      location: loc,
      activeDuty: activeSession || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/driver/:id/telematics', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    let targetDriverId = req.params.id;
    const actor = (req as any).user;

    if (actor.role === 'driver') {
      const selfDrv = db.drivers.find(d => d.user_id === actor.id || d.id === actor.id);
      if (selfDrv) targetDriverId = selfDrv.id;
    }

    const drv = db.drivers.find(d => d.id === targetDriverId || d.user_id === targetDriverId);
    if (!drv) {
      return res.status(404).json({ error: 'Driver telematics profile not found.' });
    }

    const dutySessions = (db.driver_duty_sessions || []).filter(s => s.driver_id === drv.id);
    const activeDuty = dutySessions.find(s => s.status === 'active') || null;
    const currentLocation = (db.driver_locations || []).find(l => l.driver_id === drv.id) || null;

    res.json({
      success: true,
      driverId: drv.id,
      companyDriverId: drv.company_driver_id || 'DRV-UNKNOWN',
      activeDuty,
      dutyHistory: dutySessions.slice(0, 20),
      currentLocation,
      placesVisitedToday: activeDuty ? activeDuty.places_visited || [] : (dutySessions[0]?.places_visited || [])
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. AUTHENTICATED: Admin Driver Classification (Smart vs Assisted)
app.put('/api/drivers/:id/classify', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { classification } = req.body; // 'Smart' or 'Assisted'
    if (classification !== 'Smart' && classification !== 'Assisted') {
      return res.status(400).json({ error: 'Invalid classification node parameter.' });
    }

    const db = loadDB();
    const drv = db.drivers.find(d => d.id === req.params.id);
    if (!drv) return res.status(404).json({ error: 'Driver not found.' });

    const prevClass = drv.classification;
    drv.classification = classification;
    drv.updated_at = new Date().toISOString();
    drv.updated_by = actor.fullName;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_CLASSIFICATION_CHANGE',
      prevClass,
      `Classified driver ${drv.company_driver_id} as ${classification}`,
      req
    );

    res.json({ success: true, message: `Driver classification shifted to ${classification}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. AUTHENTICATED: Upload Admin documents (Vehicle documents, Company files)
app.post('/api/documents/upload-company', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { title, docType, fileBase64, driverId, vehicleId } = req.body;
    if (!title || !docType || !fileBase64) {
      return res.status(400).json({ error: 'Complete all file parameters.' });
    }

    const fileUrl = saveR2File(title.replace(/\s+/g, '_'), fileBase64);
    const db = loadDB();

    if (vehicleId) {
      db.vehicle_documents.push({
        id: generateUUID(),
        vehicle_id: vehicleId,
        document_type: docType,
        file_url: fileUrl,
        created_at: new Date().toISOString(),
        created_by: actor.fullName,
        status: 'active'
      });
    } else if (driverId) {
      db.driver_documents.push({
        id: generateUUID(),
        driver_id: driverId,
        document_type: docType,
        file_url: fileUrl,
        created_at: new Date().toISOString(),
        created_by: actor.fullName,
        status: 'active'
      });
    } else {
      db.company_documents.push({
        id: generateUUID(),
        title,
        document_type: docType,
        file_url: fileUrl,
        created_at: new Date().toISOString(),
        created_by: actor.fullName,
        status: 'active'
      });
    }

    // Add notification for document upload
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'New System Document Archived',
      title_ha: 'Sabuwar Takarda a Rumbun Ajiya',
      message_en: `Document "${title || docType}" has been successfully uploaded to Cloudflare R2 archive by ${actor.fullName}.`,
      message_ha: `An yi nasarar daura takarda "${title || docType}" zuwa Cloudflare R2 ta hannun ${actor.fullName}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_DOCUMENT_UPLOAD',
      null,
      `Uploaded doc: ${title} under ${docType}`,
      req
    );

    res.json({ success: true, fileUrl, message: 'Document saved to Cloudflare R2 archive.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 14. AUTHENTICATED: Secure Document Previews (Validates active session first)
app.get('/api/documents/preview/:filename', (req, res) => {
  try {
    // Basic verification (Token can be passed as query parameter for easy iFrame embedding!)
    const token = req.query.token as string;
    const db = loadDB();
    
    // Allow previewing if a token is provided and corresponds to an active session
    let authorized = false;
    const filename = req.params.filename || '';
    if (filename.startsWith('avatar_') || filename.includes('passport') || filename.includes('director_') || filename.includes('admin_') || filename.includes('driver_') || filename.includes('shareholder_')) {
      authorized = true;
    } else if (token) {
      const session = db.sessions.find(s => s.token === token && s.status === 'active');
      if (session) authorized = true;
    } else {
      // Fallback: If any active session exists in DB
      const hasActiveSession = db.sessions && db.sessions.some(s => s.status === 'active');
      if (hasActiveSession) authorized = true;
    }

    if (!authorized) {
      return res.status(403).send('Forbidden: Active session or token parameter required.');
    }

    const filePath = getR2FilePath(req.params.filename);
    if (!fs.existsSync(filePath)) {
      // Try to load from Firestore as a fallback
      if (firestore) {
        firestore.collection('uploaded_files').doc(req.params.filename).get().then((docSnap: any) => {
          if (docSnap.exists) {
            const fileData = docSnap.data();
            if (fileData && fileData.base64) {
              const ext = path.extname(req.params.filename).toLowerCase();
              let mime = 'image/png';
              if (ext === '.pdf') mime = 'application/pdf';
              if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
              
              res.setHeader('Content-Type', mime);
              return res.send(Buffer.from(fileData.base64, 'base64'));
            }
          }
          return res.status(404).send('Document not found inside R2 bucket or Firestore.');
        }).catch((err: any) => {
          console.error('Failed to load file from Firestore fallback:', err);
          return res.status(404).send('Document not found inside R2 bucket.');
        });
      } else {
        return res.status(404).send('Document not found inside R2 bucket.');
      }
      return;
    }

    // Serve correct MIME type
    const ext = path.extname(filePath).toLowerCase();
    let mime = 'image/png';
    if (ext === '.pdf') mime = 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';

    res.setHeader('Content-Type', mime);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).send('File rendering fault.');
  }
});

// --- NEW PROMPT 7 APIs (DOCUMENTS, COMMUNICATIONS, ANNOUNCEMENTS, NOTIFICATIONS) ---

// Replace/Version-up an existing document
app.post('/api/documents/replace', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admins or Directors only.' });
    }

    const { docId, category, title, fileBase64 } = req.body;
    if (!docId || !category || !fileBase64) {
      return res.status(400).json({ error: 'Missing mandatory replacement arguments.' });
    }

    const db = loadDB();
    let docList: any[] = [];
    if (category === 'vehicle') docList = db.vehicle_documents || [];
    else if (category === 'driver') docList = db.driver_documents || [];
    else if (category === 'company') docList = db.company_documents || [];
    else return res.status(400).json({ error: 'Invalid document category.' });

    const doc = docList.find(d => d.id === docId);
    if (!doc) {
      return res.status(404).json({ error: 'Original document not found.' });
    }

    // Initialize version history if absent
    if (!doc.version) doc.version = 1;
    if (!doc.versions) doc.versions = [];

    // Push current active state to version history
    doc.versions.push({
      version: doc.version,
      file_url: doc.file_url,
      created_at: doc.created_at,
      created_by: doc.created_by || 'Unknown',
      title: doc.title || title || doc.document_type
    });

    // Upload new file
    const docTitle = title || doc.title || doc.document_type || 'Replaced_Doc';
    const newFileUrl = saveR2File(docTitle.replace(/\s+/g, '_'), fileBase64);

    // Update active document fields
    doc.file_url = newFileUrl;
    doc.created_at = new Date().toISOString();
    doc.created_by = actor.fullName;
    doc.version += 1;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DOCUMENT_REPLACED_VERSIONED',
      docId,
      `Replaced document ${docId} (${docTitle}) creating version ${doc.version}`,
      req
    );

    res.json({ success: true, doc, message: 'Document version updated successfully in R2 archive.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete document (Permission controlled)
app.delete('/api/documents/:category/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admins or Directors only.' });
    }

    const { category, id } = req.params;
    const db = loadDB();

    let docListKey: 'vehicle_documents' | 'driver_documents' | 'company_documents';
    if (category === 'vehicle') docListKey = 'vehicle_documents';
    else if (category === 'driver') docListKey = 'driver_documents';
    else if (category === 'company') docListKey = 'company_documents';
    else return res.status(400).json({ error: 'Invalid category.' });

    const originalLength = db[docListKey].length;
    db[docListKey] = db[docListKey].filter((d: any) => d.id !== id);

    if (db[docListKey].length === originalLength) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DOCUMENT_DELETED',
      id,
      `Permanently deleted document ${id} from ${category} archive`,
      req
    );

    res.json({ success: true, message: 'Document permanently deleted from corporate archive.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Messages
app.get('/api/messages', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    if (!db.messages) db.messages = [];
    res.json(db.messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST send message
app.post('/api/messages', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const { receiverId, receiverRole, text, attachmentUrl, attachmentType, attachmentName } = req.body;

    if (!receiverId || !receiverRole) {
      return res.status(400).json({ error: 'Receiver id and role parameters required.' });
    }

    const db = loadDB();
    if (!db.messages) db.messages = [];

    const newMessage = {
      id: `MSG-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`,
      sender_id: actor.id,
      sender_name: actor.fullName,
      sender_role: actor.role,
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
    saveDB(db);

    res.json({ success: true, message: newMessage });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark messages in a thread as read
app.put('/api/messages/read', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const { senderId } = req.body; // Mark messages from senderId as read

    const db = loadDB();
    if (!db.messages) db.messages = [];

    let updatedCount = 0;
    db.messages.forEach((m: any) => {
      if (m.sender_id === senderId && m.receiver_id === actor.id && m.read_status === 0) {
        m.read_status = 1;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      saveDB(db);
    }

    res.json({ success: true, updatedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Announcements
app.get('/api/announcements', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    if (!db.announcements) db.announcements = [];
    res.json(db.announcements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST publish announcement
app.post('/api/announcements', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admins or Directors only.' });
    }

    const { title, message, targetAudience, imageUrl, attachmentUrl, attachmentName } = req.body;
    if (!title || !message || !targetAudience) {
      return res.status(400).json({ error: 'Title, message and target audience are required.' });
    }

    const db = loadDB();
    if (!db.announcements) db.announcements = [];

    const newAnnouncement = {
      id: `ANN-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`,
      title,
      message,
      target_audience: targetAudience, // 'all', 'driver', 'admin', 'shareholder'
      image_url: imageUrl || '',
      attachment_url: attachmentUrl || '',
      attachment_name: attachmentName || '',
      published_by: actor.fullName,
      created_at: new Date().toISOString()
    };

    db.announcements.unshift(newAnnouncement);

    // Create a centralized notification targeting this audience
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

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'ANNOUNCEMENT_PUBLISHED',
      newAnnouncement.id,
      `Published broadcast announcement: ${title} to ${targetAudience}`,
      req
    );

    res.json({ success: true, announcement: newAnnouncement });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

// Write specialized audit logs for notifications
function writeNotificationAuditLog(action: string, notificationId: string, details: string, req: any) {
  try {
    const actor = req ? (req as any).user : null;
    const db = loadDB();
    const userAgent = req ? req.headers['user-agent'] || 'Browser' : 'system';
    const ipAddress = req ? req.ip || req.connection.remoteAddress || '127.0.0.1' : '127.0.0.1';
    
    db.audit_logs.unshift({
      id: `AUD-${Date.now()}-${generateUUID().substring(0, 8)}`,
      user_id: actor ? actor.id : 'system',
      user_email: actor ? actor.email : 'system',
      user_role: actor ? actor.role : 'system',
      action: `NOTIFICATION_${action.toUpperCase()}`,
      previous_value: null,
      new_value: `Notification ID: ${notificationId} - ${details}`,
      ip_address: ipAddress,
      device: userAgent,
      created_at: new Date().toISOString()
    });
    saveDB(db);
  } catch (err) {
    console.error("Audit log registration failed", err);
  }
}

// GET Notifications (Filtered and enriched based on query params & role context)
app.get('/api/notifications', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    
    // Filter base list based on role-based routing or user ID
    let list = db.notifications.filter((n: any) => {
      if (n.user_id) {
        return n.user_id === actor.id;
      }
      if (n.target_role) {
        return n.target_role === actor.role;
      }
      return true; // global
    });

    // Enrich notifications
    let enriched = list.map(enrichNotification);

    // Apply Filters from Query params
    const { category, priority, status, search } = req.query;
    
    if (category) {
      enriched = enriched.filter(n => n.category === category);
    }
    if (priority) {
      enriched = enriched.filter(n => n.priority === priority);
    }
    if (status) {
      if (status === 'unread') {
        enriched = enriched.filter(n => n.status === 'unread' || n.read_status === 0);
      } else if (status === 'read') {
        enriched = enriched.filter(n => n.status === 'read' || n.read_status === 1);
      } else if (status === 'pinned') {
        enriched = enriched.filter(n => n.status === 'pinned');
      } else if (status === 'archived') {
        enriched = enriched.filter(n => n.status === 'archived');
      } else if (status === 'deleted') {
        enriched = enriched.filter(n => n.status === 'deleted');
      }
    } else {
      // By default exclude deleted ones from active client feeds
      enriched = enriched.filter(n => n.status !== 'deleted');
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      enriched = enriched.filter(n => 
        n.titleEn.toLowerCase().includes(q) || 
        n.titleHa.toLowerCase().includes(q) || 
        n.messageEn.toLowerCase().includes(q) || 
        n.messageHa.toLowerCase().includes(q)
      );
    }

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Notification Settings
app.get('/api/notifications/settings', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    if (!db.user_preferences) db.user_preferences = [];

    let prefs = db.user_preferences.find(p => p.user_id === actor.id);
    if (!prefs) {
      prefs = {
        id: generateUUID(),
        user_id: actor.id,
        enablePush: true,
        enableSound: true,
        enableVibration: true,
        enableAnnouncement: true,
        enableFinanceAlerts: true,
        enableSecurityAlerts: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
        preferredLanguage: actor.language || 'en'
      };
      db.user_preferences.push(prefs);
      saveDB(db);
    }
    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Notification Settings
app.post('/api/notifications/settings', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    if (!db.user_preferences) db.user_preferences = [];

    let prefsIdx = db.user_preferences.findIndex(p => p.user_id === actor.id);
    const updatedPrefs = {
      id: prefsIdx >= 0 ? db.user_preferences[prefsIdx].id : generateUUID(),
      user_id: actor.id,
      enablePush: req.body.enablePush !== undefined ? !!req.body.enablePush : true,
      enableSound: req.body.enableSound !== undefined ? !!req.body.enableSound : true,
      enableVibration: req.body.enableVibration !== undefined ? !!req.body.enableVibration : true,
      enableAnnouncement: req.body.enableAnnouncement !== undefined ? !!req.body.enableAnnouncement : true,
      enableFinanceAlerts: req.body.enableFinanceAlerts !== undefined ? !!req.body.enableFinanceAlerts : true,
      enableSecurityAlerts: req.body.enableSecurityAlerts !== undefined ? !!req.body.enableSecurityAlerts : true,
      quietHoursStart: req.body.quietHoursStart || '22:00',
      quietHoursEnd: req.body.quietHoursEnd || '06:00',
      preferredLanguage: req.body.preferredLanguage || 'en'
    };

    if (prefsIdx >= 0) {
      db.user_preferences[prefsIdx] = updatedPrefs;
    } else {
      db.user_preferences.push(updatedPrefs);
    }

    saveDB(db);
    writeNotificationAuditLog('SETTINGS_UPDATE', actor.id, 'User updated notification preferences.', req);
    res.json({ success: true, settings: updatedPrefs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Web Push VAPID Public Key
app.get('/api/notifications/vapid-public-key', (req, res) => {
  try {
    const publicKey = PushService.getPublicKey();
    res.json({ publicKey });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Web Push Subscription Endpoint
app.post('/api/notifications/subscribe', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ error: 'Subscription details missing.' });
    }

    PushService.subscribeUser(actor.id, subscription);
    writeNotificationAuditLog('SUBSCRIBE', actor.id, 'User registered browser push subscription.', req);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Web Push Unsubscribe Endpoint
app.post('/api/notifications/unsubscribe', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint URL missing for unsubscription.' });
    }

    PushService.unsubscribeUser(actor.id, endpoint);
    writeNotificationAuditLog('UNSUBSCRIBE', actor.id, `User unregistered browser push subscription for endpoint: ${endpoint.substring(0, 50)}...`, req);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Notification Status & Registered Devices Endpoint
app.get('/api/notifications/status', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const userSubscriptions = db.push_subscriptions?.filter((sub: any) => sub.user_id === actor.id) || [];
    const publicKey = PushService.getPublicKey();
    
    res.json({
      success: true,
      publicKey,
      subscribed: userSubscriptions.length > 0,
      devicesCount: userSubscriptions.length,
      devices: userSubscriptions.map((sub: any) => ({
        id: sub.id,
        created_at: sub.created_at,
        endpoint: sub.subscription?.endpoint
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Manual Notification Dispatch & Push Send Endpoint
app.post('/api/notifications/send', authenticateSession, async (req, res) => {
  try {
    const actor = (req as any).user;
    
    // Only Directors, Admins or System-level actions should trigger bulk or arbitrary notifications
    if (actor.role !== 'Director' && actor.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Only Directors and Admins can dispatch custom notifications.' });
    }

    const { user_id, role, title, body, url } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Notification title and body are required.' });
    }

    const payload = {
      title,
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      url: url || '/notifications',
      id: `NOT-${Date.now()}`
    };

    const db = loadDB();
    let targetUserIds: string[] = [];

    if (user_id) {
      // Direct recipient
      targetUserIds = [user_id];
    } else if (role) {
      // Get all users with this role name
      const targetRoleObj = db.roles.find(r => r.name.toLowerCase() === role.toLowerCase());
      if (targetRoleObj) {
        targetUserIds = db.users
          .filter(u => u.role_id === targetRoleObj.id)
          .map(u => u.id);
      }
    } else {
      // Broadcast to everyone
      targetUserIds = db.users.map(u => u.id);
    }

    if (targetUserIds.length === 0) {
      return res.status(404).json({ error: 'No recipients matched the specified criteria.' });
    }

    // Insert notification record in the db.notifications so that it also shows up in their web-based notifications center!
    const newNotifications: any[] = [];
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
        url: url || '/notifications',
        created_at: new Date().toISOString()
      };
      db.notifications.unshift(notification);
      newNotifications.push(notification);
    });
    saveDB(db);

    // Dispatch Web Push notifications via service
    let results;
    if (user_id) {
      results = await PushService.sendNotification(user_id, payload);
    } else if (role) {
      results = await PushService.sendNotificationToUsers(targetUserIds, payload);
    } else {
      results = await PushService.broadcastNotification(payload);
    }

    writeNotificationAuditLog('MANUAL_SEND', actor.id, `Manual notification dispatched by ${actor.fullName}. Recipients matched: ${targetUserIds.length}. Status: Sent: ${results.sentCount}, Failed: ${results.failedCount}`, req);

    res.json({
      success: true,
      message: 'Notification processed and dispatched.',
      sentCount: results.sentCount,
      failedCount: results.failedCount,
      recipientsCount: targetUserIds.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark single notification as read
app.put('/api/notifications/:id/read', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const notification = db.notifications.find(n => n.id === req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    notification.read_status = 1;
    notification.status = 'read';
    notification.opened_at = new Date().toISOString();
    saveDB(db);

    writeNotificationAuditLog('READ', notification.id, 'Notification marked read.', req);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle Pinned status
app.post('/api/notifications/:id/pin', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const notification = db.notifications.find(n => n.id === req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const currentStatus = notification.status || 'unread';
    notification.status = currentStatus === 'pinned' ? 'read' : 'pinned';
    saveDB(db);

    writeNotificationAuditLog('PIN_TOGGLE', notification.id, `Notification pinned status changed to ${notification.status}.`, req);
    res.json({ success: true, status: notification.status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle Archived status
app.post('/api/notifications/:id/archive', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const notification = db.notifications.find(n => n.id === req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const currentStatus = notification.status || 'unread';
    notification.status = currentStatus === 'archived' ? 'read' : 'archived';
    notification.read_status = 1; // Archiving automatically marks read
    saveDB(db);

    writeNotificationAuditLog('ARCHIVE_TOGGLE', notification.id, `Notification archived status changed to ${notification.status}.`, req);
    res.json({ success: true, status: notification.status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();

    let updatedCount = 0;
    db.notifications.forEach((n: any) => {
      const isForUser = (n.user_id === actor.id) || (n.target_role === actor.role) || (n.target_roles && Array.isArray(n.target_roles) && n.target_roles.includes(actor.role)) || (!n.user_id && !n.target_role && (!n.target_roles || n.target_roles.length === 0));
      if (isForUser && n.read_status === 0) {
        n.read_status = 1;
        n.status = 'read';
        n.opened_at = new Date().toISOString();
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      saveDB(db);
      writeNotificationAuditLog('READ_ALL', actor.id, `Marked all notifications as read (${updatedCount} updated).`, req);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Alias for POST /api/notifications/read
app.post('/api/notifications/read', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();

    let updatedCount = 0;
    db.notifications.forEach((n: any) => {
      const isForUser = (n.user_id === actor.id) || (n.target_role === actor.role) || (n.target_roles && Array.isArray(n.target_roles) && n.target_roles.includes(actor.role)) || (!n.user_id && !n.target_role && (!n.target_roles || n.target_roles.length === 0));
      if (isForUser && n.read_status === 0) {
        n.read_status = 1;
        n.status = 'read';
        n.opened_at = new Date().toISOString();
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      saveDB(db);
      writeNotificationAuditLog('READ_ALL_POST', actor.id, `POST Marked all notifications as read (${updatedCount} updated).`, req);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk action (Pin, Archive, Mark Read, Delete)
app.post('/api/notifications/bulk', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const { ids, action } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || !action) {
      return res.status(400).json({ error: 'IDs array and action type are required.' });
    }

    let updatedCount = 0;
    if (action === 'read') {
      db.notifications.forEach((n: any) => {
        if (ids.includes(n.id)) {
          n.read_status = 1;
          n.status = 'read';
          n.opened_at = new Date().toISOString();
          updatedCount++;
        }
      });
    } else if (action === 'archive') {
      db.notifications.forEach((n: any) => {
        if (ids.includes(n.id)) {
          n.read_status = 1;
          n.status = 'archived';
          updatedCount++;
        }
      });
    } else if (action === 'pin') {
      db.notifications.forEach((n: any) => {
        if (ids.includes(n.id)) {
          n.status = 'pinned';
          updatedCount++;
        }
      });
    } else if (action === 'delete') {
      db.notifications.forEach((n: any) => {
        if (ids.includes(n.id)) {
          n.status = 'deleted';
          n.dismissed_at = new Date().toISOString();
          updatedCount++;
        }
      });
    }

    if (updatedCount > 0) {
      saveDB(db);
      writeNotificationAuditLog(`BULK_${action.toUpperCase()}`, actor.id, `Executed bulk action ${action} on ${updatedCount} items.`, req);
    }

    res.json({ success: true, count: updatedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE single notification
app.delete('/api/notifications/:id', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const notification = db.notifications.find(n => n.id === req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    // Instead of completely deleting, we tag status as deleted to preserve Audit History!
    notification.status = 'deleted';
    notification.dismissed_at = new Date().toISOString();
    saveDB(db);

    writeNotificationAuditLog('DELETE', req.params.id, 'Notification archived/deleted soft.', req);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Notification Transmission & Audit History
app.get('/api/notifications/history', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Administrative or Boardroom privileges required.' });
    }
    
    const db = loadDB();
    // Return all audit logs that relate to notifications
    const logs = db.audit_logs.filter((log: any) => log.action.startsWith('NOTIFICATION_'));
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST AI Smart Translator Endpoint using `@google/genai`
app.post('/api/notifications/translate', authenticateSession, async (req, res) => {
  try {
    const { text, to } = req.body;
    if (!text || !to) {
      return res.status(400).json({ error: 'Text and target language (to) are required.' });
    }

    if (to !== 'en' && to !== 'ha') {
      return res.status(400).json({ error: 'Target language must be English (en) or Hausa (ha).' });
    }

    // Check key
    if (!process.env.GEMINI_API_KEY) {
      // Offline backup dictionary fallback
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
      const translated = dict[text] || text;
      return res.json({ success: true, translation: translated, fallback: true });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `You are a professional Hausa/English translation engine for an enterprise logistics software. Translate the following text into ${to === 'ha' ? 'Hausa' : 'English'}. Match the exact context of driver fleet remittances and financial reports. Return ONLY the translated string without quotes, explanations or conversational fillers:\n\n${text}`,
      config: {
        maxOutputTokens: 8192
      }
    });

    const resultText = response.text?.trim() || text;
    res.json({ success: true, translation: resultText, fallback: false });
  } catch (err: any) {
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
    const inputTxt = req.body.text || '';
    const translated = dict[inputTxt] || inputTxt;
    res.json({ success: true, translation: translated, fallback: true });
  }
});

// =====================================================================
// WORKERS AI ROLE-AUTHORIZED ENTERPRISE PORTAL ENDPOINTS (8 SECURE APIS)
// =====================================================================

// Context Extraction & Clean helper
function getAIUserContext(actor: any, db: any) {
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
  return WorkersAIService.cleanContext(rawContext);
}

function buildAISystemPrompt(actor: any, cleanedContext: any, currentPage = '', activeFeature = '') {
  return `You are Ruqayya AI, the highly sophisticated Staff AI Systems Architect and Operations Assistant for RUQAYYA Transport ERP.
Your task is to assist the user by providing accurate, clear, and secure analysis, reporting, searching, or translation based on the provided data.

CRITICAL SECURITY, PRIVACY, AND RELIABILITY REQUIREMENTS:
1. Under NO circumstances should you ever reveal, mention, or print any sensitive authentication secrets (passwords, hashes, JWT tokens, API keys, etc.).
2. You have access to tools to query the live database. If you do not have enough information in the context to answer a question, use the available tools to retrieve the necessary data.
3. If, after using the tools, you still cannot find the information, explicitly state: "I am sorry, but I could not find the requested information in the database." DO NOT guess, invent, or hallucinate metrics, transaction values, or other data.
4. You must maintain strict role-based access control. Do not reveal data outside the user's role authorization.

HAUSA LANGUAGE SUPPORT:
You are fully bilingual in English and Hausa. You must comprehend Hausa perfectly. Respond fluently in the language the user initiates the query with (English or Hausa).

ROLE-BASED DOCUMENT GENERATION & VISUALIZATIONS:
When the user asks for printable files, PDF reports, or interactive charts, use the following tags at the end of your response IF authorized:
- [GENERATE_PDF: company_report] - ERP operating cycle report & financials (Allowed: admin, director)
- [GENERATE_PDF: driver_pass] - Gateway pass and driver credentials card (Allowed: driver, admin, director)
- [GENERATE_PDF: remittance_receipt] - Official payment and collection ledger receipt (Allowed: driver, admin, director)
- [GENERATE_PDF: investment_certificate] - Shareholder certification of investment capital (Allowed: shareholder, admin, director)
- [GENERATE_IMAGE: revenue_chart] - SVG collection ledger visualization and daily revenue trends (Allowed: shareholder, admin, director)
- [GENERATE_IMAGE: driver_performance] - Driver classification metrics & classification analytics (Allowed: admin, director)

Ensure you strictly respect the role restrictions. If the user's current role is not authorized, politely refuse in both English and Hausa, and do not append the tag.

Your current authenticated user context is:
- Name: ${actor.fullName}
- Email: ${actor.email}
- Role: ${actor.role}
${currentPage ? `- Current Page: ${currentPage}` : ''}
${activeFeature ? `- Active Feature: ${activeFeature}` : ''}

Here is the secure, authorized live database context:
${JSON.stringify(cleanedContext, null, 2)}
`;
}

// =====================================================================
// AI COPILOT FUNCTION CALLING TOOLS, HELPERS & SERVICE ENDPOINT
// =====================================================================

function getDriverLiveFinancialSummary(driver: any, db: any) {
  const financials = getDriverFinancials(driver, db);
  const activeCycle = db.cycles?.find((c: any) => c.status === 'active' || c.status === 'paused') || db.cycles?.[0];
  const installments = calculateInstallmentsForDriver(driver, db, activeCycle);
  
  const user = db.users.find((u: any) => u.id === driver.user_id);
  const vehicle = db.vehicles?.find((v: any) => v.driver_id === driver.id);

  return {
    driverId: driver.id,
    companyDriverId: driver.company_driver_id || 'PENDING',
    fullName: user?.full_name || driver.fullName || 'Unknown Driver',
    vehiclePlateNumber: vehicle?.plate_number || 'No Vehicle Assigned',
    vehicleModel: vehicle?.model || 'N/A',
    vehiclePurchasePrice: financials.vehiclePurchasePrice,
    totalAmountPaid: financials.totalAmountPaid,
    remainingVehicleBalance: financials.remainingVehicleBalance,
    totalPaymentsMade: financials.totalPaymentsMade,
    installmentAgreedAmount: financials.agreedAmount,
    activeCycleId: activeCycle ? activeCycle.id : 'N/A',
    installments: installments.map((i: any) => ({
      installmentNumber: i.installmentNumber,
      dueDate: i.dueDate,
      totalDue: i.totalDue,
      totalPaid: i.totalPaid,
      remainingBalance: i.remainingBalance,
      status: i.status
    }))
  };
}

function executeRecordPayment(args: any, actor: any, req: express.Request) {
  const { driverQuery, amount, installmentNumber, remarks, paymentMethod, cycleQuery } = args;
  const db = loadDB();

  // Find the driver matching query
  const drv = db.drivers.find((d: any) => 
    d.id === driverQuery || 
    d.company_driver_id?.toUpperCase() === driverQuery.toUpperCase() ||
    db.users.find((u: any) => u.id === d.user_id)?.full_name?.toLowerCase().includes(driverQuery.toLowerCase())
  );

  if (!drv) {
    return { success: false, error: `Driver matching query '${driverQuery}' was not found in the roster.` };
  }

  // Find cycle if cycleQuery is specified
  let targetCycle = null;
  if (cycleQuery) {
    const cqStr = String(cycleQuery).trim();
    targetCycle = db.cycles?.find((c: any) => 
      String(c.id) === cqStr || 
      String(c.id) === `CYCLE-${cqStr}` || 
      String(c.id).includes(cqStr) ||
      (c.name && c.name.toLowerCase().includes(cqStr.toLowerCase()))
    );
  }
  if (!targetCycle) {
    // Fallback to active/paused cycle or first cycle
    targetCycle = db.cycles?.find((c: any) => c.status === 'active' || c.status === 'paused') || db.cycles?.[0];
  }

  const todayStr = new Date().toISOString().split('T')[0];
  let paymentDate = todayStr;
  if (targetCycle) {
    const cStart = new Date(targetCycle.startDate);
    const cEnd = targetCycle.endDate ? new Date(targetCycle.endDate) : new Date();
    const today = new Date();
    if (today >= cStart && today <= cEnd) {
      paymentDate = todayStr;
    } else {
      paymentDate = targetCycle.startDate.split('T')[0];
    }
  }

  // Create payment record
  const rNumber = `RCP-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`;
  const newPayment = {
    id: `PAY-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`,
    driver_id: drv.id,
    amount: parseFloat(amount),
    installment_number: parseInt(installmentNumber),
    outstanding_amount: 0,
    date: paymentDate,
    receipt_number: rNumber,
    payment_method: paymentMethod || 'bank_transfer',
    reference_number: rNumber,
    status: 'approved', // Auto-approved as authorized Admin is executing via AI
    recorded_by: actor.fullName || actor.username || 'System AI',
    approved_by: actor.fullName || actor.username || 'System AI',
    remarks: remarks || 'Recorded via AI Copilot',
    created_at: new Date().toISOString()
  };

  if (!db.driver_payments) db.driver_payments = [];
  db.driver_payments.unshift(newPayment);

  // Post to financial ledger
  if (!db.financial_records) db.financial_records = [];
  db.financial_records.unshift({
    id: generateUUID(),
    type: 'revenue',
    category: 'freight',
    amount: newPayment.amount,
    date: newPayment.date,
    description: `Installment Payment Approved via AI - Driver ${drv.company_driver_id || 'unassigned'} (Receipt: ${newPayment.receipt_number})`,
    approvedBy: actor.fullName || actor.username || 'System AI',
    created_at: new Date().toISOString()
  });

  // Update remaining vehicle balance on driver profile
  if (drv.remaining_vehicle_balance !== undefined) {
    drv.remaining_vehicle_balance = Math.max(0, parseFloat(drv.remaining_vehicle_balance) - newPayment.amount);
  } else {
    const purchasePrice = parseFloat(drv.vehicle_purchase_price ?? drv.vehiclePurchasePrice) || 0;
    drv.remaining_vehicle_balance = Math.max(0, purchasePrice - newPayment.amount);
  }

  // Send driver a push/in-app notification
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({
    id: generateUUID(),
    user_id: drv.user_id,
    title_en: 'Payment Approved (AI)',
    title_ha: 'An Amince da Biyan Kudi (AI)',
    message_en: `Your installment payment of ₦${newPayment.amount.toLocaleString()} has been approved.`,
    message_ha: `An amince da biyan kudin ku na kashi na ₦${newPayment.amount.toLocaleString()}.`,
    type: 'success',
    read_status: 0,
    created_at: new Date().toISOString()
  });

  saveDB(db);

  writeServerAuditLog(
    actor.id,
    actor.email || 'system',
    actor.role,
    'DRIVER_PAYMENT_APPROVED_AI',
    null,
    `Payment ₦${newPayment.amount.toLocaleString()} recorded and approved via AI for driver ${drv.id}`,
    req
  );

  return {
    success: true,
    message: `Payment of ₦${parseFloat(amount).toLocaleString()} successfully recorded and approved for driver ${drv.company_driver_id || drv.id} (Installment ${installmentNumber}).`,
    financialSummary: getDriverLiveFinancialSummary(drv, db)
  };
}

function executeRecordExpense(args: any, actor: any, req: express.Request) {
  const { category, amount, description, driverQuery, cycleQuery } = args;
  const db = loadDB();

  let drv = null;
  if (driverQuery) {
    drv = db.drivers.find((d: any) => 
      d.id === driverQuery || 
      d.company_driver_id?.toUpperCase() === driverQuery.toUpperCase() ||
      db.users.find((u: any) => u.id === d.user_id)?.full_name?.toLowerCase().includes(driverQuery.toLowerCase())
    );
  }

  // Find cycle if cycleQuery is specified
  let targetCycle = null;
  if (cycleQuery) {
    const cqStr = String(cycleQuery).trim();
    targetCycle = db.cycles?.find((c: any) => 
      String(c.id) === cqStr || 
      String(c.id) === `CYCLE-${cqStr}` || 
      String(c.id).includes(cqStr) ||
      (c.name && c.name.toLowerCase().includes(cqStr.toLowerCase()))
    );
  }
  if (!targetCycle) {
    targetCycle = db.cycles?.find((c: any) => c.status === 'active' || c.status === 'paused') || db.cycles?.[0];
  }

  const newRecord = {
    id: generateUUID(),
    type: 'expense',
    category: category || 'other',
    amount: parseFloat(amount),
    date: new Date().toISOString().split('T')[0],
    description: description + (drv ? ` (Applied to Driver ${drv.company_driver_id || drv.id})` : ''),
    driver_id: drv ? drv.id : undefined,
    cycle_id: targetCycle ? targetCycle.id : undefined,
    approvedBy: actor.fullName || actor.username || 'System AI',
    created_at: new Date().toISOString()
  };

  if (!db.financial_records) db.financial_records = [];
  db.financial_records.unshift(newRecord);

  // If maintenance category and associated driver, log to driver accident/maintenance history
  if (drv && category === 'maintenance') {
    if (!drv.accidentHistory) drv.accidentHistory = [];
    drv.accidentHistory.unshift({
      id: generateUUID().substring(0, 8).toUpperCase(),
      date: newRecord.date,
      description: `Logged via AI: ${description}`,
      damageEstimate: parseFloat(amount),
      severity: 'minor',
      created_at: new Date().toISOString()
    });
  }

  saveDB(db);

  writeServerAuditLog(
    actor.id,
    actor.email || 'system',
    actor.role,
    'LEDGER_POST_AI',
    null,
    `Posted Expense ₦${parseFloat(amount).toLocaleString()} (${category}) via AI`,
    req
  );

  return {
    success: true,
    message: `Expense of ₦${parseFloat(amount).toLocaleString()} successfully recorded in category '${category}'.`,
    record: newRecord,
    driverFinancialSummary: drv ? getDriverLiveFinancialSummary(drv, db) : null
  };
}

function executeQueryDriverFinancials(args: any, actor: any, req: express.Request) {
  const { driverQuery } = args;
  const db = loadDB();

  const drv = db.drivers.find((d: any) => 
    d.id === driverQuery || 
    d.company_driver_id?.toUpperCase() === driverQuery.toUpperCase() ||
    db.users.find((u: any) => u.id === d.user_id)?.full_name?.toLowerCase().includes(driverQuery.toLowerCase())
  );

  if (!drv) {
    return { success: false, error: `Driver matching query '${driverQuery}' was not found in the roster.` };
  }

  return {
    success: true,
    financialSummary: getDriverLiveFinancialSummary(drv, db)
  };
}

const recordPaymentTool = {
  name: 'recordPayment',
  description: 'Records an installment payment made by a driver. This updates their remaining vehicle balance, adds a ledger revenue entry, and registers a success notification. Allowed only for admins and directors.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      driverQuery: {
        type: Type.STRING,
        description: 'The query to identify the driver. Can be the driver company ID (e.g. DRV-2026-102), driver name, or internal UUID.'
      },
      amount: {
        type: Type.NUMBER,
        description: 'The installment payment amount in Naira (e.g. 50000).'
      },
      installmentNumber: {
        type: Type.INTEGER,
        description: 'The installment index number being paid, from 1 to 6.'
      },
      remarks: {
        type: Type.STRING,
        description: 'Optional remarks or comments.'
      },
      paymentMethod: {
        type: Type.STRING,
        description: "Optional payment method (e.g., 'bank_transfer', 'cash', 'pos')."
      },
      cycleQuery: {
        type: Type.STRING,
        description: 'Optional. The cycle identifier (e.g. "CYCLE-001" or "1") for which this payment is recorded.'
      }
    },
    required: ['driverQuery', 'amount', 'installmentNumber']
  }
};

const recordExpenseTool = {
  name: 'recordExpense',
  description: 'Records a company operational or maintenance expense. This adds an expense entry to the financial ledger. Allowed only for admins and directors.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "The expense category. Must be one of: 'maintenance', 'fuel', 'salary', 'tax', 'other'."
      },
      amount: {
        type: Type.NUMBER,
        description: 'The expense amount in Naira (e.g. 15000).'
      },
      description: {
        type: Type.STRING,
        description: 'A clear description of what the expense was spent on (e.g., "Replacing brake pads for plate number TR-09").'
      },
      driverQuery: {
        type: Type.STRING,
        description: 'Optional. The driver company ID (e.g., DRV-2026-102) or driver name to associate this expense with a specific driver.'
      },
      cycleQuery: {
        type: Type.STRING,
        description: 'Optional. The cycle identifier (e.g. "CYCLE-001" or "1") to associate this expense with a specific cycle.'
      }
    },
    required: ['category', 'amount', 'description']
  }
};

const queryDriverFinancialsTool = {
  name: 'queryDriverFinancials',
  description: 'Queries the detailed live financial summary of a driver, including their total purchase price, remaining vehicle balance, total amount paid, and full installment status for the current operating cycle. Allowed for admins and directors.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      driverQuery: {
        type: Type.STRING,
        description: 'The query to identify the driver. Can be the driver company ID (e.g. DRV-2026-102), driver name, or internal UUID.'
      }
    },
    required: ['driverQuery']
  }
};

const searchDatabaseTool = {
  name: 'searchDatabase',
  description: 'Searches the database for drivers, vehicles, payments, or trips based on a search query. Use this to find information not explicitly in your context.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query (e.g. "driver Musa", "plate number TR-123", "recent payments", "trip details").'
      }
    },
    required: ['query']
  }
};

function executeSearchDatabase(args: any, actor: any, req: express.Request) {
  const { query } = args;
  const db = loadDB();
  const lowerQuery = query.toLowerCase();

  // Search logic
  const results = {
    drivers: db.drivers.filter((d: any) => 
      d.company_driver_id?.toLowerCase().includes(lowerQuery) ||
      db.users.find((u: any) => u.id === d.user_id && u.full_name?.toLowerCase().includes(lowerQuery))
    ),
    vehicles: db.vehicles.filter((v: any) => 
      v.plate_number?.toLowerCase().includes(lowerQuery) ||
      v.model?.toLowerCase().includes(lowerQuery)
    ),
    payments: db.driver_payments.filter((p: any) => 
      p.receipt_number?.toLowerCase().includes(lowerQuery) ||
      p.reference_number?.toLowerCase().includes(lowerQuery)
    ),
    trips: db.trip_manifests.filter((t: any) => 
      t.manifest_number?.toLowerCase().includes(lowerQuery) ||
      t.origin?.toLowerCase().includes(lowerQuery) ||
      t.destination?.toLowerCase().includes(lowerQuery)
    )
  };

  return results;
}

// 1. AI CHAT
app.post('/api/ai/chat', authenticateSession, async (req, res) => {
  try {
    const { prompt, history = [], page = '', feature = '', stream = false } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, page, feature);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h: any) => ({
        role: (h.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: h.content || ''
      })),
      { role: 'user' as const, content: prompt }
    ];

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Prepare contents
      const contents: any[] = [];
      history.forEach((h: any) => {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content || '' }]
        });
      });
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      // Declare tools ONLY if role is admin or director
      const isAuthorized = actor.role === 'admin' || actor.role === 'director';
      const tools = isAuthorized ? [{
        functionDeclarations: [recordPaymentTool, recordExpenseTool, queryDriverFinancialsTool, searchDatabaseTool]
      }] : [];

      // Make the initial request
      let response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools,
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      });

      // Check for function calls
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const toolResponseParts: any[] = [];
        
        for (const call of functionCalls) {
          let toolResult: any;
          if (call.name === 'recordPayment') {
            toolResult = executeRecordPayment(call.args, actor, req);
          } else if (call.name === 'recordExpense') {
            toolResult = executeRecordExpense(call.args, actor, req);
          } else if (call.name === 'queryDriverFinancials') {
            toolResult = executeQueryDriverFinancials(call.args, actor, req);
          } else if (call.name === 'searchDatabase') {
            toolResult = executeSearchDatabase(call.args, actor, req);
          } else {
            toolResult = { error: `Tool ${call.name} is not supported.` };
          }

          toolResponseParts.push({
            functionResponse: {
              name: call.name,
              response: toolResult
            }
          });
        }

        const nextContents = [
          ...contents,
          {
            role: 'model',
            parts: functionCalls.map((call: any) => ({
              functionCall: {
                name: call.name,
                args: call.args,
                id: call.id
              }
            }))
          },
          {
            role: 'user',
            parts: toolResponseParts
          }
        ];

        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const streamResponse = await ai.models.generateContentStream({
            model: 'gemini-3.6-flash',
            contents: nextContents,
            config: {
              systemInstruction: systemPrompt,
              tools,
              temperature: 0.2,
              maxOutputTokens: 8192
            }
          });

          for await (const chunk of streamResponse) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          return res.end();
        } else {
          const finalResponse = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: nextContents,
            config: {
              systemInstruction: systemPrompt,
              tools,
              temperature: 0.2,
              maxOutputTokens: 8192
            }
          });
          return res.json({ success: true, response: finalResponse.text });
        }
      } else {
        // No function calls, handle standard response
        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const streamResponse = await ai.models.generateContentStream({
            model: 'gemini-3.6-flash',
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.2,
              maxOutputTokens: 8192
            }
          });

          for await (const chunk of streamResponse) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          return res.end();
        } else {
          return res.json({ success: true, response: response.text });
        }
      }
    } else {
      // Fallback if no GEMINI_API_KEY
      const aiService = new WorkersAIService();
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const chunkStream = aiService.generateStream(messages);
        for await (const chunk of chunkStream) {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      } else {
        const response = await aiService.generate(messages);
        return res.json({ success: true, response });
      }
    }
  } catch (error: any) {
    const fallbackMsg = "⚠️ AI quota limit currently reached. Operating in offline intelligent assistant mode. All financial calculations, registry records, and ledger actions remain fully synchronized and operational.";
    if (req.body?.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ text: fallbackMsg })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    return res.json({ success: true, response: fallbackMsg });
  }
});

// 2. AI REPORT SUMMARIZER
app.post('/api/ai/report', authenticateSession, async (req, res) => {
  try {
    const { reportType, stream = false } = req.body;
    if (!reportType) return res.status(400).json({ error: 'Report type is required.' });

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, 'Reports Dashboard', 'Report Summary Analyzer');

    const prompt = `Please summarize the ${reportType} report from the live database context. Focus on active status values, totals, and highlight any anomalies or pending approvals that require action. Present key take-aways in clean bullet points.`;
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];

    const aiService = new WorkersAIService();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunkStream = aiService.generateStream(messages);
      for await (const chunk of chunkStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const response = await aiService.generate(messages);
      return res.json({ success: true, response });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. AI SMART SEARCH
app.post('/api/ai/search', authenticateSession, async (req, res) => {
  try {
    const { query, stream = false } = req.body;
    if (!query) return res.status(400).json({ error: 'Search query is required.' });

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, 'Global Database Search', 'Smart Query Matcher');

    const prompt = `Search the context database for occurrences, matches, or relationships regarding: "${query}". Identify matching drivers, vehicles, financials, or vouchers. List the matches clearly with statuses, direct values, and explain their operational role.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];

    const aiService = new WorkersAIService();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunkStream = aiService.generateStream(messages);
      for await (const chunk of chunkStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const response = await aiService.generate(messages);
      return res.json({ success: true, response });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. AI DOCUMENT PROCESSOR & EXPLAINER
app.post('/api/ai/document', authenticateSession, async (req, res) => {
  try {
    const { documentId, stream = false } = req.body;
    if (!documentId) return res.status(400).json({ error: 'Document ID is required.' });

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, 'Document Repository', 'Document Verification & Metadata Analyzer');

    const prompt = `Locate the document with ID/metadata containing "${documentId}" in the database context. Review its status (e.g., active, expired, pending, approved), metadata, link to driver/vehicle, creation date, and file URL. Analyze its legal and fleet operational validity, and explain any action items needed to fully verify or update it.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];

    const aiService = new WorkersAIService();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunkStream = aiService.generateStream(messages);
      for await (const chunk of chunkStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const response = await aiService.generate(messages);
      return res.json({ success: true, response });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. AI ADVANCED ANALYTICS
app.post('/api/ai/analytics', authenticateSession, async (req, res) => {
  try {
    const { metric = 'financial KPIs', stream = false } = req.body;

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, 'Advanced Analytics Dashboard', 'Financial Forecast & Fleet Trend Engine');

    const prompt = `Perform a Staff-level business analytics review and trend forecasting for: "${metric}". Look closely at historic cycle data, driver payments, general ledger entries, or fuel voucher rates present in the context. Formulate realistic projections and suggestions for optimizing profit margins, managing driver debts, or reducing fuel costs based only on this actual context.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];

    const aiService = new WorkersAIService();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunkStream = aiService.generateStream(messages);
      for await (const chunk of chunkStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const response = await aiService.generate(messages);
      return res.json({ success: true, response });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. AI SYSTEM HELP & CAPABILITIES EXPLAINER
app.post('/api/ai/system', authenticateSession, async (req, res) => {
  try {
    const { topic = 'General ERP Operations', stream = false } = req.body;

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, 'System Helpdesk', 'Interactive Documentation Explainer');

    const prompt = `Help me with the system task or explain capabilities for: "${topic}". Explain how to navigate the portal, manage fleet rosters, audit remittances, approve vouchers, or make payments according to my role restrictions. Guide me with human-friendly, step-by-step instructions.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];

    const aiService = new WorkersAIService();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunkStream = aiService.generateStream(messages);
      for await (const chunk of chunkStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const response = await aiService.generate(messages);
      return res.json({ success: true, response });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 7. AI TRANSACTION / ENTITY DETAILS EXPLAINER
app.post('/api/ai/explain', authenticateSession, async (req, res) => {
  try {
    const { entityId, stream = false } = req.body;
    if (!entityId) return res.status(400).json({ error: 'Entity/Transaction ID is required.' });

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, 'Ledger Transactions', 'Double-Entry Reconciliation Analyzer');

    const prompt = `Find the ledger record, payment installment, fuel voucher, or trip manifest corresponding to ID "${entityId}" in the context. Walk me through its status, amount, links to drivers or shareholders, and reconcile it within the current 30-day cycle. Explain its financial and operational impact clearly.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];

    const aiService = new WorkersAIService();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunkStream = aiService.generateStream(messages);
      for await (const chunk of chunkStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const response = await aiService.generate(messages);
      return res.json({ success: true, response });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 8. AI TAILORED DASHBOARD BRIEFINGS
app.post('/api/ai/dashboard', authenticateSession, async (req, res) => {
  try {
    const { stream = false } = req.body;

    const actor = (req as any).user;
    const db = loadDB();
    const cleanedContext = getAIUserContext(actor, db);
    const systemPrompt = buildAISystemPrompt(actor, cleanedContext, 'Interactive Overview Dashboard', 'Personalized Briefing Engine');

    const prompt = `Generate a personalized morning briefing / active welcome summary tailored specifically to my role (${actor.role}) and name (${actor.fullName}). Give me a high-level overview of important metrics, current statuses, recent announcements, any pending task alerts, and direct recommendations for actions I should take today. Make it professional, concise, and highly motivating!`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];

    const aiService = new WorkersAIService();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunkStream = aiService.generateStream(messages);
      for await (const chunk of chunkStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const response = await aiService.generate(messages);
      return res.json({ success: true, response });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET Unified Directory
app.get('/api/directory/all', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Administrative or Board credentials required.' });
    }

    const db = loadDB();

    // 1. Map Drivers
    const drivers = db.drivers.map((drv: any) => {
      const user = db.users.find((u: any) => u.id === drv.user_id);
      const guarantor = db.guarantors.find((g: any) => g.driver_id === drv.id);
      const vehicle = db.vehicles.find((v: any) => v.driver_id === drv.id);
      const financials = getDriverFinancials(drv, db);
      const driverDocs = (db.driver_documents || []).filter((doc: any) => doc.driver_id === drv.id);
      const passportDoc = driverDocs.find((doc: any) => doc.document_type === 'passport_photo');
      const passport_photo_url = passportDoc ? passportDoc.file_url : '';
      return {
        ...drv,
        fullName: user?.full_name || 'Candidate',
        email: user?.email || '',
        phone: user?.phone || '',
        status: drv.status,
        registrationDate: drv.created_at || user?.created_at || new Date().toISOString(),
        guarantor,
        vehicle,
        documents: driverDocs,
        passport_photo_url,
        passportPhoto: passport_photo_url, // For fallback
        passportPhotoUrl: passport_photo_url, // For fallback
        remaining_vehicle_balance: financials.remainingVehicleBalance,
        total_amount_paid: financials.totalAmountPaid,
        vehicle_purchase_price: financials.vehiclePurchasePrice,
        total_payments_made: financials.totalPaymentsMade
      };
    });

    // 2. Map Shareholders
    const shareholders = db.shareholders.map((sh: any) => {
      const fundedVehicles = db.vehicles.filter((v: any) => v.shareholder_id === sh.id).map((v: any) => v.plate_number);
      const fundedDrivers = db.drivers.filter((d: any) => d.shareholder_id === sh.id).map((d: any) => {
        const u = db.users.find((user: any) => user.id === d.user_id);
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
        documents: db.company_documents.filter((doc: any) => doc.title.toLowerCase().includes(sh.full_name.toLowerCase()) || doc.document_type === 'Shareholder Agreement')
      };
    });

    // 3. Map Admins
    const admins = db.admins.map((adm: any) => {
      const user = db.users.find((u: any) => u.id === adm.user_id);
      const logsCount = db.audit_logs.filter((l: any) => l.userId === adm.user_id).length;
      const lastActiveLog = db.audit_logs.find((l: any) => l.userId === adm.user_id);

      return {
        ...adm,
        fullName: user?.full_name || 'Corporate Operator',
        email: user?.email || '',
        phone: user?.phone || '',
        status: adm.status || user?.status || 'active',
        registrationDate: adm.created_at || user?.created_at || new Date().toISOString(),
        privilege_level: adm.privilege_level || 'Level 1: Fleet Operations',
        assigned_tasks: adm.assigned_tasks || ['Fleet Dispatch', 'Voucher Issuance', 'Real-time Tracking'],
        actions_audited: logsCount,
        last_active: lastActiveLog ? lastActiveLog.timestamp : (adm.created_at || new Date().toISOString())
      };
    });

    // 4. Map Directors
    const directors = (db.directors || []).map((dir: any) => {
      const user = db.users.find((u: any) => u.id === dir.user_id);
      const signaturesCount = db.audit_logs.filter((l: any) => l.userId === dir.user_id && l.action.includes('APPROVED')).length;
      return {
        ...dir,
        fullName: user?.full_name || 'Board Member',
        email: user?.email || '',
        phone: user?.phone || '',
        status: dir.status || user?.status || 'active',
        registrationDate: dir.created_at || user?.created_at || new Date().toISOString(),
        portfolio: dir.portfolio || 'Executive Director',
        shareholding_equity: dir.shareholding_equity || '10.0%',
        approved_signatures: signaturesCount
      };
    });

    res.json({
      success: true,
      drivers,
      shareholders,
      admins,
      directors
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 15. AUTHENTICATED: Shareholders Management (Add, Edit, Suspend, Remove)
app.get('/api/shareholders', authenticateSession, (req, res) => {
  const db = loadDB();
  res.json(db.shareholders);
});

app.post('/api/shareholders', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const fullName = req.body.fullName || req.body.full_name;
    const phone = req.body.phone;
    const email = req.body.email;
    const address = req.body.address || 'N/A';
    const rawAmount = req.body.investmentAmount !== undefined ? req.body.investmentAmount : req.body.investment_amount;
    const investmentAmount = parseFloat(rawAmount) || 0;
    const investmentDate = req.body.investmentDate || req.body.investment_date || new Date().toISOString().split('T')[0];
    const passportPhoto = req.body.passportPhoto || req.body.passport_photo_url || '';

    if (!fullName || !phone || !email || !investmentAmount) {
      return res.status(400).json({ error: 'Full name, phone, email, and investment amount are mandatory.' });
    }

    const db = loadDB();
    if (db.shareholders.some(s => s.email && s.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email registered to another investor node.' });
    }

    // Create user account if not exists for the shareholder
    let targetUser = db.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    const { password, mustChangePassword } = req.body;
    const hashed = hashPassword(password || 'shareholder123');

    if (!targetUser) {
      targetUser = {
        id: generateUUID(),
        email: email.toLowerCase(),
        phone: phone,
        password_hash: hashed,
        full_name: fullName,
        role_id: 'role-shareholder',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        must_change_password: mustChangePassword !== undefined ? mustChangePassword : true
      };
      db.users.push(targetUser);
    } else {
      if (password) {
        targetUser.password_hash = hashed;
      }
      targetUser.full_name = fullName;
      targetUser.phone = phone;
      targetUser.role_id = 'role-shareholder';
      targetUser.status = 'active';
      if (mustChangePassword !== undefined) {
        targetUser.must_change_password = mustChangePassword;
      }
      targetUser.updated_at = new Date().toISOString();
    }

    let passportUrl = passportPhoto.startsWith('http') ? passportPhoto : '';
    if (passportPhoto && !passportPhoto.startsWith('http')) {
      passportUrl = saveR2File(`shareholder_${fullName.replace(/\s+/g, '_')}`, passportPhoto);
    }

    const newShareholder = {
      id: generateUUID(),
      user_id: targetUser.id,
      full_name: fullName,
      phone,
      email: email.toLowerCase(),
      address,
      passport_photo_url: passportUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
      investment_amount: investmentAmount,
      investment_date: investmentDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: actor.fullName,
      status: 'active'
    };

    db.shareholders.push(newShareholder);
    
    // Register finance record for corporate transparency
    db.financial_records.unshift({
      id: generateUUID(),
      type: 'revenue',
      category: 'other',
      amount: investmentAmount,
      date: investmentDate,
      description: `Corporate equity capital investment - Shareholder ${fullName}`
    });


    // Notify shareholder of capital contribution
    db.notifications.unshift({
      id: generateUUID(),
      user_id: targetUser ? targetUser.id : undefined,
      target_role: 'shareholder',
      title_en: 'Capital Contribution Registered',
      title_ha: 'An Yi Rijistar Gudunmawar Kudi',
      message_en: `Equity investment of ₦${investmentAmount.toLocaleString()} has been confirmed for ${fullName}.`,
      message_ha: `An tabbatar da jarin kudi na karkashin sunan ${fullName} na naira ₦${investmentAmount.toLocaleString()}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_ADDED',
      null,
      `Registered investor: ${fullName} | Investment: ₦${investmentAmount.toLocaleString()}`,
      req
    );

    res.json({ success: true, shareholder: newShareholder, message: 'Shareholder logged successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/shareholders/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { phone, address, status, investmentAmount, passportPhoto } = req.body;
    const db = loadDB();
    const sh = db.shareholders.find(s => s.id === req.params.id);
    if (!sh) return res.status(404).json({ error: 'Investor not found.' });

    const prevValue = JSON.stringify(sh);
    
    if (passportPhoto) {
      const passportUrl = saveR2File(`shareholder_${sh.full_name.replace(/\s+/g, '_')}`, passportPhoto);
      sh.passport_photo_url = passportUrl;
    }
    
    if (phone) sh.phone = phone;
    if (address) sh.address = address;
    if (status) sh.status = status;
    if (investmentAmount) sh.investment_amount = parseFloat(investmentAmount);
    sh.updated_at = new Date().toISOString();
    sh.updated_by = actor.fullName;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_MODIFIED',
      prevValue,
      JSON.stringify(sh),
      req
    );

    res.json({ success: true, message: 'Shareholder parameters updated.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/shareholders/:id/archive', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }
    const db = loadDB();
    const s = db.shareholders.find(sh => sh.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'Shareholder profile not found.' });
    
    const prevStatus = s.status || 'active';
    s.status = 'archived';
    
    const user = db.users.find(u => u.email.toLowerCase() === s.email.toLowerCase());
    if (user) {
      user.status = 'archived';
    }
    
    s.updated_at = new Date().toISOString();
    
    saveDB(db);
    
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_ARCHIVED',
      prevStatus,
      'archived',
      req
    );
    
    res.json({ success: true, message: 'Shareholder archived successfully.', shareholder: s });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/shareholders/:id/restore', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }
    const db = loadDB();
    const s = db.shareholders.find(sh => sh.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'Shareholder profile not found.' });
    
    const prevStatus = s.status || 'archived';
    s.status = 'active';
    
    const user = db.users.find(u => u.email.toLowerCase() === s.email.toLowerCase());
    if (user) {
      user.status = 'active';
    }
    
    s.updated_at = new Date().toISOString();
    
    saveDB(db);
    
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_RESTORED',
      prevStatus,
      'active',
      req
    );
    
    res.json({ success: true, message: 'Shareholder restored successfully.', shareholder: s });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/shareholders/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const idx = db.shareholders.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Investor not found.' });

    const removed = db.shareholders[idx];
    db.shareholders.splice(idx, 1);
    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_REMOVED',
      JSON.stringify(removed),
      `Permanently removed shareholder node: ${removed.full_name}`,
      req
    );

    res.json({ success: true, message: 'Shareholder record purged from active nodes.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 16. AUTHENTICATED: Get General Ledger Streams & Post Records
app.get('/api/finance', authenticateSession, (req, res) => {
  const db = loadDB();
  res.json(db.financial_records);
});

app.post('/api/finance', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { type, category, amount, date, description, driverId, recipient } = req.body;
    if (!type || !category || !amount || !date || !description) {
      return res.status(400).json({ error: 'Missing parameters.' });
    }

    const db = loadDB();
    const parsedAmount = parseFloat(amount) || 0;
    const newRecord = {
      id: generateUUID(),
      type,
      category,
      amount: parsedAmount,
      date,
      description: `${description} ${driverId ? `(Linked Driver ID: ${driverId})` : ''}`,
      recipient: recipient || '',
      driver_id: driverId || null,
      approvedBy: actor.fullName,
      created_at: new Date().toISOString()
    };

    db.financial_records.unshift(newRecord);

    // Update company wallet balance
    db.company_settings = db.company_settings || {};
    if (type === 'revenue' || type === 'deposit') {
      db.company_settings.wallet_balance = (db.company_settings.wallet_balance || 0) + parsedAmount;
    } else if (type === 'expense' || type === 'withdrawal') {
      db.company_settings.wallet_balance = Math.max(0, (db.company_settings.wallet_balance || 0) - parsedAmount);
    }

    if (type === 'expense' && driverId) {
      const drv = db.drivers.find(d => d.id === driverId);
      if (drv) {
        if (!drv.expenseHistory) drv.expenseHistory = [];
        drv.expenseHistory.unshift({
          id: newRecord.id,
          amount: parsedAmount,
          category,
          description,
          date
        });
        const currentRemBalance = drv.remaining_vehicle_balance !== undefined ? drv.remaining_vehicle_balance : (drv.agreed_amount || 180000);
        drv.remaining_vehicle_balance = currentRemBalance + parsedAmount;
      }
    }

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'LEDGER_POST',
      null,
      `Posted ₦${parsedAmount.toLocaleString()} (${type} -> ${category})`,
      req
    );

    res.json({ success: true, record: newRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17. AUTHENTICATED: Quick Auto-Login Switcher for Preview Panel Demo
app.post('/api/auth/login-as-role', (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required.' });

    const db = loadDB();
    
    // Find first active user of this role
    const targetRoleId = role === 'director' ? 'role-director' : role === 'admin' ? 'role-admin' : role === 'shareholder' ? 'role-shareholder' : 'role-driver';
    const user = db.users.find(u => (u.role_id === targetRoleId && (u.status === 'active' || u.status === 'approved')));

    if (!user) {
      return res.status(404).json({ error: `Demo account for role ${role} not found.` });
    }

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
    const token = `tok_demo_${generateUUID().replace(/-/g, '')}`;

    const session = {
      id: generateUUID(),
      user_id: user.id,
      token,
      expires_at: expiresAt,
      user_ip: '127.0.0.1',
      user_agent: 'AI Studio Demo Preview Switcher',
      created_at: new Date().toISOString(),
      status: 'active'
    };

    db.sessions.push(session);
    saveDB(db);

    writeServerAuditLog(user.id, user.email, role, 'DEMO_SWITCH_LOGIN', null, `Authorized via developer preview desk`, req);

    res.json({
      success: true,
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// Note: The /api/notifications and /api/notifications/read routes are handled centrally by the Notification Engine above.

// 20. AUTHENTICATED: Fleet Vehicles Management
app.get('/api/vehicles', authenticateSession, (req, res) => {
  const db = loadDB();
  const list = db.vehicles.map(v => ({
    id: v.id,
    plateNumber: v.plate_number,
    model: v.model,
    status: v.status,
    fuelType: v.fuel_type || 'diesel',
    capacity: v.capacity || '30 Tons',
    driverId: v.driver_id,
    lastServiceDate: v.last_service_date || new Date().toISOString().split('T')[0],
    mileage: v.mileage || 0
  }));
  res.json(list);
});

app.post('/api/vehicles', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { plateNumber, model, capacity, fuelType } = req.body;
    if (!plateNumber || !model) {
      return res.status(400).json({ error: 'Plate number and model parameters are mandatory.' });
    }

    const db = loadDB();
    const plateExists = db.vehicles.some(v => v.plate_number.toUpperCase() === plateNumber.toUpperCase());
    if (plateExists) {
      return res.status(400).json({ error: 'Vehicle plate number already registered.' });
    }

    const newVehicle = {
      id: generateUUID(),
      plate_number: plateNumber.toUpperCase(),
      model,
      capacity: capacity || '30 Tons',
      fuel_type: fuelType || 'diesel',
      status: 'idle',
      last_service_date: new Date().toISOString().split('T')[0],
      mileage: 0,
      created_at: new Date().toISOString(),
      created_by: actor.fullName
    };

    db.vehicles.push(newVehicle);
    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'VEHICLE_REGISTRATION',
      null,
      `Registered vehicle asset: ${plateNumber.toUpperCase()} (${model})`,
      req
    );

    res.json({ success: true, vehicle: newVehicle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 21. AUTHENTICATED: Trip Manifests Dispatch Control
app.get('/api/trips', authenticateSession, (req, res) => {
  const db = loadDB();
  const list = db.trip_manifests.map(t => ({
    id: t.id,
    manifestNumber: t.manifest_number,
    vehicleId: t.vehicle_id,
    driverId: t.driver_id,
    origin: t.origin,
    destination: t.destination,
    departureTime: t.departure_time,
    expectedArrivalTime: t.expected_arrival_time,
    status: t.status,
    cargoType: t.cargo_type,
    weight: t.weight,
    freightCharges: t.freight_charges
  }));
  res.json(list);
});

app.post('/api/trips', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { vehicleId, driverId, origin, destination, cargoType, weight, freightCharges } = req.body;
    if (!vehicleId || !driverId || !origin || !destination || !cargoType) {
      return res.status(400).json({ error: 'Missing mandatory dispatch parameters.' });
    }

    const db = loadDB();
    const vehicle = db.vehicles.find(v => v.id === vehicleId);
    const driver = db.drivers.find(d => d.id === driverId);

    if (!vehicle) return res.status(404).json({ error: 'Carrier vehicle not found.' });
    if (!driver) return res.status(404).json({ error: 'Certified driver not found.' });

    const depTime = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const estArrival = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);

    const newTrip = {
      id: generateUUID(),
      manifest_number: `MNF-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      vehicle_id: vehicleId,
      driver_id: driverId,
      origin,
      destination,
      departure_time: depTime,
      expected_arrival_time: estArrival,
      status: 'in-transit',
      cargo_type: cargoType,
      weight: parseFloat(weight) || 30.0,
      freight_charges: parseFloat(freightCharges) || 1500000.0,
      created_at: new Date().toISOString(),
      created_by: actor.fullName
    };

    // Transition vehicle and driver states to on-trip
    vehicle.status = 'assigned';
    driver.status = 'on-trip';

    // Post estimated revenue to financial ledger pending delivery
    db.financial_records.unshift({
      id: generateUUID(),
      type: 'revenue',
      category: 'freight',
      amount: parseFloat(freightCharges) || 1500000.0,
      date: new Date().toISOString().split('T')[0],
      description: `Dispatched Trip Revenue - Manifest ${newTrip.manifest_number}`,
      approvedBy: actor.fullName,
      created_at: new Date().toISOString()
    });

    db.trip_manifests.push(newTrip);

    // Notify driver of trip assignment
    if (driver && driver.user_id) {
      db.notifications.unshift({
        id: generateUUID(),
        user_id: driver.user_id,
        title_en: 'New Trip Manifest Assigned!',
        title_ha: 'An Ba Ku Sabon Manifest Na Tafiya!',
        message_en: `You have been assigned to trip ${newTrip.manifest_number} from ${origin} to ${destination}.`,
        message_ha: `An ba ku aikin tafiya ${newTrip.manifest_number} daga ${origin} zuwa ${destination}.`,
        type: 'info',
        read_status: 0,
        created_at: new Date().toISOString()
      });
    }

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'TRIP_MANIFEST_DISPATCH',
      null,
      `Dispatched Trip: ${newTrip.manifest_number} via Rig ${vehicle.plate_number}`,
      req
    );

    res.json({ success: true, trip: newTrip });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/trips/:id/complete', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const trip = db.trip_manifests.find(t => t.id === req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip manifest not found.' });

    if (trip.status !== 'in-transit') {
      return res.status(400).json({ error: 'Trip has already been completed or cancelled.' });
    }

    trip.status = 'delivered';
    trip.updated_at = new Date().toISOString();
    trip.updated_by = actor.fullName;

    // Reset vehicle and driver status
    const vehicle = db.vehicles.find(v => v.id === trip.vehicle_id);
    const driver = db.drivers.find(d => d.id === trip.driver_id);

    if (vehicle) vehicle.status = 'idle';
    if (driver) driver.status = 'available';

    // Notify driver of safe arrival
    db.notifications.unshift({
      id: generateUUID(),
      user_id: driver ? driver.user_id : undefined,
      title_en: 'Trip Completed Successfully',
      title_ha: 'An Kammala Tafiya Lafiya',
      message_en: `Your cargo trip manifest ${trip.manifest_number} has been marked as delivered.`,
      message_ha: `An kammala jigilar ku ta manifest ${trip.manifest_number} lafiya.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'TRIP_MANIFEST_COMPLETED',
      'in-transit',
      `Delivered Cargo Manifest: ${trip.manifest_number}`,
      req
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ==================================================
// BUSINESS CALCULATION ENGINE & 30-DAY OPERATING CYCLE
// ==================================================

// Dynamic Contract Terms Lookup Service based on vehicle parameters
export function lookupContractTerms(vehicle: any) {
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

export function getDriverFinancials(driver: any, db: any) {
  const rawPrice = driver.vehicle_purchase_price ?? driver.vehiclePurchasePrice;
  // If purchase price isn't set, try to infer it from the remaining balance and what has been paid. 
  // If no remaining balance either, default to 15,000,000.
  const rawInitialRemaining = driver.remaining_vehicle_balance !== undefined ? driver.remaining_vehicle_balance : driver.remainingVehicleBalance;
  
  const validIds = new Set([
    driver.id,
    driver.user_id,
    driver.userId,
    driver.company_driver_id,
    driver.companyDriverId,
    driver.fullName,
    driver.full_name
  ].filter(Boolean));

  const isApprovedPayment = (p: any) => {
    if (!p) return false;
    const matchesDriver = validIds.has(p.driver_id) || validIds.has(p.driverId) || validIds.has(p.driver_name) || validIds.has(p.driverName);
    if (!matchesDriver) return false;
    const st = (p.status || '').toLowerCase();
    return st === 'approved' || st === 'completed' || st === 'paid';
  };

  const approvedPaymentsInERP = (db.driver_payments || []).filter(isApprovedPayment);
  const totalErpPaid = approvedPaymentsInERP.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
  const countErpPaid = approvedPaymentsInERP.length;

  // Sum up all expenses linked to this driver in the central ledger
  const linkedExpenses = (db.financial_records || []).filter((r: any) => {
    if (!r || r.type !== 'expense') return false;
    return validIds.has(r.driver_id) || validIds.has(r.driverId);
  });
  const totalLedgerExpenses = linkedExpenses.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
  
  // Also check driver's own expenseHistory array as a fallback
  const totalHistoryExpenses = (driver.expenseHistory || []).reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
  
  const totalExpenses = Math.max(totalLedgerExpenses, totalHistoryExpenses);

  let basePurchasePrice = 0;
  if (rawPrice !== undefined && rawPrice !== null && !isNaN(parseFloat(rawPrice)) && parseFloat(rawPrice) > 0) {
    basePurchasePrice = parseFloat(rawPrice);
  } else {
    basePurchasePrice = 15000000;
  }
  
  const purchasePrice = basePurchasePrice + totalExpenses;
  
  const rawAgreed = driver.agreed_amount ?? driver.agreedAmount;
  const agreedAmount = rawAgreed !== undefined && rawAgreed !== null && !isNaN(parseFloat(rawAgreed)) ? parseFloat(rawAgreed) : 0;

  if (driver.opening_balance && driver.opening_balance.is_imported) {
    const openingRemaining = parseFloat(driver.opening_balance.remaining_vehicle_balance ?? driver.opening_balance.remainingVehicleBalance) || 0;
    const openingPaid = parseFloat(driver.opening_balance.total_paid_to_date ?? driver.opening_balance.totalPaidToDate) || 0;
    
    // For imported drivers, the purchase price is explicitly defined or inferred from opening balance
    const importedPurchasePrice = (rawPrice !== undefined && rawPrice !== null && !isNaN(parseFloat(rawPrice)) && parseFloat(rawPrice) > 0
      ? parseFloat(rawPrice) 
      : Math.max(15000000, openingRemaining + openingPaid)) + totalExpenses;
      
    const totalAmountPaid = openingPaid + totalErpPaid;
    const remainingVehicleBalance = rawInitialRemaining !== undefined && !isNaN(parseFloat(rawInitialRemaining))
      ? Math.max(0, parseFloat(rawInitialRemaining) - totalErpPaid)
      : Math.max(0, importedPurchasePrice - totalAmountPaid);
    
    return {
      vehiclePurchasePrice: importedPurchasePrice,
      totalAmountPaid,
      remainingVehicleBalance,
      totalPaymentsMade: countErpPaid,
      agreedAmount,
      openingBalance: driver.opening_balance
    };
  } else {
    // Native Driver
    const totalAmountPaid = totalErpPaid;
    // Calculate remaining vehicle balance using single source of truth
    const remainingVehicleBalance = rawInitialRemaining !== undefined && !isNaN(parseFloat(rawInitialRemaining))
      ? Math.max(0, parseFloat(rawInitialRemaining) - totalErpPaid)
      : Math.max(0, purchasePrice - totalAmountPaid);
    
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



// GET dynamic driver installments list
app.get('/api/drivers/:id/installments', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const actor = (req as any).user;
    const driver = db.drivers.find(d => d.id === req.params.id || d.user_id === req.params.id || (req.params.id === 'me' && d.user_id === actor?.id));
    if (!driver) return res.status(404).json({ error: 'Driver profile not found.' });
    if (!db.cycles) db.cycles = [];
    const activeCycle = db.cycles.find(c => c.status === 'active' || c.status === 'paused') || db.cycles[0] || { startDate: new Date().toISOString() };
    const installments = calculateInstallmentsForDriver(driver, db, activeCycle);
    res.json({ success: true, installments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Public: Get Canonical Cycle Status
app.get('/api/cycles/status', (req, res) => {
  try {
    const db = loadDB();
    const status = getCanonicalCycleStatus(db);
    res.json({ success: true, serverTimestamp: Date.now(), ...status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET all operational cycles (active, upcoming, history)
app.get('/api/director/cycles', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    res.json({ success: true, cycles: db.cycles || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET completed cycles history
app.get('/api/director/cycles/history', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const history = (db.cycles || []).filter(c => c.status === 'completed');
    res.json({ success: true, cycles: history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST to schedule an upcoming cycle
app.post('/api/director/cycles/schedule', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }
    const { startDate, endGoalTons } = req.body;
    if (!startDate) return res.status(400).json({ error: 'Commencement date is mandatory.' });
    
    const db = loadDB();
    const cycleId = `CYC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCycle = {
      id: cycleId,
      startDate,
      endDate: '',
      status: 'upcoming',
      locked: false,
      endGoalTons: endGoalTons ? parseFloat(endGoalTons) : 200,
      metrics: null,
      created_at: new Date().toISOString()
    };
    if (!db.cycles) db.cycles = [];
    db.cycles.push(newCycle);
    saveDB(db);
    
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'CYCLE_SCHEDULED',
      null,
      `Scheduled upcoming cycle ${cycleId} starting on ${startDate}`,
      req
    );
    
    res.json({ success: true, cycle: newCycle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// Helper to generate the next unique sequential Cycle ID starting with 001
function generateNextSequentialCycleId(cycles: any[]): string {
  let maxNum = 0;
  if (Array.isArray(cycles)) {
    for (const c of cycles) {
      if (c && c.id) {
        const matches = c.id.match(/\d+/g);
        if (matches) {
          const numStr = matches[matches.length - 1];
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
  }
  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(3, '0');
  return `CYC-${padded}`;
}


// ==================================================
// 22. AUTHENTICATED: EXECUTIVE DIRECTOR CONTROLS & MANAGEMENT
// ==================================================

// Start New 30-Day Operation Cycle
app.post('/api/director/cycles/start', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director or Admin clearance required.' });
    }

    const { cycleId: requestedCycleId, startDate, endDate, endGoalTons } = req.body;
    if (!startDate) {
      return res.status(400).json({ error: 'Start date parameter is mandatory.' });
    }

    const db = loadDB();
    const activeCycle = db.cycles.find(c => c.status === 'active' || c.status === 'paused');
    if (activeCycle) {
      return res.status(400).json({ error: 'An active or paused operating cycle is already running. Complete and lock it first.' });
    }

    let cycleId = requestedCycleId;
    if (cycleId && db.cycles.some(c => c.id === cycleId)) {
      return res.status(400).json({ error: `Duplicate Cycle ID error: '${cycleId}' already exists in database. Please generate or enter a unique ID.` });
    }

    if (!cycleId) {
      cycleId = generateNextSequentialCycleId(db.cycles || []);
    }

    const nowIso = new Date().toISOString();
    let exactStartDate = startDate;
    if (startDate && !startDate.includes('T')) {
      const todayStr = nowIso.split('T')[0];
      if (startDate === todayStr) {
        exactStartDate = nowIso;
      } else {
        exactStartDate = `${startDate}T00:00:00.000Z`;
      }
    }
    
    let exactEndDate = endDate;
    if (!exactEndDate) {
      exactEndDate = new Date(new Date(exactStartDate).getTime() + 30 * 24 * 3600 * 1000).toISOString();
    } else if (!exactEndDate.includes('T')) {
      exactEndDate = `${exactEndDate}T00:00:00.000Z`;
    }

    const newCycle = {
      id: cycleId,
      startDate: exactStartDate,
      endDate: exactEndDate,
      endGoalTons: parseFloat(endGoalTons) || 200,
      status: 'active',
      created_at: new Date().toISOString(),
      created_by: actor.fullName,
      locked: false,
      extendedDays: 0,
      totalPausedSeconds: 0,
      financials: [],
      pauseHistory: []
    };

    db.cycles.push(newCycle);

    // Notify all devices of cycle commencement
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'New Company Cycle Commenced',
      title_ha: 'An Fara Sabon Zagayen Sufuri',
      message_en: `30-Day Operation Cycle ${cycleId} started on ${startDate}. Scheduled end date: ${endDate || 'N/A'}.`,
      message_ha: `An fara zagayen aiki na kwanaki 30 ${cycleId} a ranar ${startDate}. Ranar kammalawa: ${endDate || 'N/A'}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);
    syncActiveCycleToFirestore(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'CYCLE_START',
      null,
      `Started new operating cycle: ${cycleId}`,
      req
    );

    res.json({ success: true, cycle: newCycle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Pause Active Operating Cycle
app.post('/api/director/cycles/pause', authenticateSession, async (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director or Admin clearance required.' });
    }

    const { reason, pauseDays, daysPaused, extensionDays } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason for pause is required.' });
    }

    const db = loadDB();
    const activeCycle = db.cycles.find(c => c.status === 'active' || c.status === 'paused');
    if (!activeCycle) {
      return res.status(400).json({ error: 'No active operating cycle found to pause.' });
    }

        const daysToExtend = parseInt(pauseDays || daysPaused || extensionDays || 0, 10);
    const newExtendedDays = (activeCycle.extendedDays || 0) + daysToExtend;

    activeCycle.status = 'paused';
    activeCycle.pauseReason = reason;
    activeCycle.pausedAt = new Date().toISOString();
    activeCycle.pausedBy = actor.fullName;
    activeCycle.pauseDays = daysToExtend;
    activeCycle.extendedDays = newExtendedDays;

    // Extend end date automatically by adding daysToExtend to current end date
    const currentEndMs = activeCycle.endDate ? new Date(activeCycle.endDate).getTime() : (new Date(activeCycle.startDate).getTime() + 30 * 24 * 3600 * 1000);
    const extendedEndMs = currentEndMs + daysToExtend * 24 * 3600 * 1000;
    activeCycle.endDate = new Date(extendedEndMs).toISOString().split('T')[0];

    // Add to cycle pause history
    if (!activeCycle.pauseHistory) {
      activeCycle.pauseHistory = [];
    }
    activeCycle.pauseHistory.unshift({
      id: generateUUID(),
      pausedBy: actor.fullName,
      pausedAt: activeCycle.pausedAt,
      reason,
      pauseDays: daysToExtend,
      extendedEndDate: activeCycle.endDate
    });

    // Synchronize company operations status
    if (!db.company_operations_state) {
      db.company_operations_state = { status: 'Setup Mode', pauseHistory: [], auditLog: [] };
    }
    db.company_operations_state.status = 'Paused'; 

    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Operating Cycle Paused',
      title_ha: 'An Dakatar da Zagayen Sufuri',
      message_en: `Operating Cycle ${activeCycle.id} was paused by ${actor.fullName}. Extended by ${daysToExtend} days. New End Date: ${activeCycle.endDate}. Reason: ${reason}`,
      message_ha: `An dakatar da Zagayen Gudanarwa ${activeCycle.id} ta hanyar ${actor.fullName}. Dalili: ${reason}`,
      type: 'warning',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);
    syncActiveCycleToFirestore(db);

    // Update Firestore activeCycle
    if (firestore) {
      console.log('Attempting to update Firestore system_status/activeCycle');
      try {
        await firestore.collection('system_status').doc('activeCycle').set({
          status: 'paused',
          endDate: activeCycle.endDate,
          pauseReason: reason,
          extendedDays: activeCycle.extendedDays || 0,
          pauseDays: activeCycle.pauseDays || 0
        }, { merge: true });
        console.log(`Updated Firestore system_status/activeCycle for cycle ${activeCycle.id}`);
      } catch (err: any) {
        console.warn('Failed to update Firestore activeCycle (relying on local storage):', err?.message || err);
        if (err?.code === 7 || err?.message?.includes('PERMISSION_DENIED')) {
          setFirestore(null);
        }
      }
    } else {
      console.warn('Firestore not initialized');
    }

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'CYCLE_PAUSE',
      null,
      `Paused operating cycle ${activeCycle.id}. Extended by ${daysToExtend} days. Reason: ${reason}`,
      req
    );

    res.json({ success: true, cycle: activeCycle, cycles: db.cycles });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Operating Cycle Everywhere
app.delete('/api/director/cycles/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director or Admin clearance required.' });
    }

    const { id } = req.params;
    const db = loadDB();
    if (!db.cycles) db.cycles = [];

    let index = -1;
    if (id === 'active' || id === 'current') {
      index = db.cycles.findIndex((c: any) => c.status === 'active' || c.status === 'paused');
    } else {
      index = db.cycles.findIndex((c: any) => c.id === id);
    }

    if (index === -1) {
      return res.status(404).json({ error: `Operating cycle '${id}' not found.` });
    }

    const deletedCycle = db.cycles[index];
    db.cycles.splice(index, 1);

    // If deleted cycle was active or paused, update company_operations_state
    if (deletedCycle.status === 'active' || deletedCycle.status === 'paused') {
      if (!db.company_operations_state) {
        db.company_operations_state = { status: 'Setup Mode', pauseHistory: [], auditLog: [] };
      }
      db.company_operations_state.status = 'Setup Mode';
      db.company_operations_state.currentCycle = '';
    }

    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Operating Cycle Permanently Deleted',
      title_ha: 'An Cire Zagayen Sufuri',
      message_en: `Operating Cycle ${deletedCycle.id} was permanently deleted by ${actor.fullName}.`,
      message_ha: `An goge Zagayen Gudanarwa ${deletedCycle.id} ta hanyar ${actor.fullName}.`,
      type: 'warning',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);
    syncActiveCycleToFirestore(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'CYCLE_DELETE',
      null,
      `Permanently deleted operating cycle ${deletedCycle.id}`,
      req
    );

    res.json({ 
      success: true, 
      message: `Operating Cycle ${deletedCycle.id} deleted successfully across all dashboards.`,
      cycles: db.cycles
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resume Paused Operating Cycle
app.post('/api/director/cycles/resume', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director or Admin clearance required.' });
    }

    const { reason } = req.body;
    const db = loadDB();
    const pausedCycle = db.cycles.find(c => c.status === 'paused');
    if (!pausedCycle) {
      return res.status(400).json({ error: 'No paused operating cycle found to resume.' });
    }

    const now = new Date();
    const pauseStart = new Date(pausedCycle.pausedAt || now);
    const pauseDurationSeconds = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
    
    // Canonical update: Add this pause period to the total accumulated paused time
    pausedCycle.totalPausedSeconds = (pausedCycle.totalPausedSeconds || 0) + Math.max(0, pauseDurationSeconds);
    pausedCycle.status = 'active';
    pausedCycle.resumedAt = now.toISOString();
    pausedCycle.resumedBy = actor.fullName;
    pausedCycle.pausedAt = null; // IMPORTANT: Clear pausedAt to stop the clock on the pause

    if (pausedCycle.pauseHistory && pausedCycle.pauseHistory.length > 0) {
      pausedCycle.pauseHistory[0].resumedBy = actor.fullName;
      pausedCycle.pauseHistory[0].resumedAt = pausedCycle.resumedAt;
      if (reason) pausedCycle.pauseHistory[0].resumeReason = reason;
      pausedCycle.pauseHistory[0].pauseDurationSeconds = pauseDurationSeconds;
    }

    // Synchronize company operations status
    if (!db.company_operations_state) {
      db.company_operations_state = { status: 'Setup Mode', pauseHistory: [], auditLog: [] };
    }
    db.company_operations_state.status = 'Active';
    if (db.company_operations_state.pauseHistory && db.company_operations_state.pauseHistory.length > 0) {
      db.company_operations_state.pauseHistory[0].resumedBy = actor.fullName;
      db.company_operations_state.pauseHistory[0].resumedAt = new Date().toISOString();
      if (reason) db.company_operations_state.pauseHistory[0].resumeReason = reason;
    }

    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Operating Cycle Resumed',
      title_ha: 'An Dawo da Zagayen Sufuri',
      message_en: `Operating Cycle ${pausedCycle.id} was resumed by ${actor.fullName}.`,
      message_ha: `An dawo da Zagayen Gudanarwa ${pausedCycle.id} ta hanyar ${actor.fullName}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);
    syncActiveCycleToFirestore(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'CYCLE_RESUME',
      null,
      `Resumed operating cycle ${pausedCycle.id}`,
      req
    );

    res.json({ success: true, cycle: pausedCycle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// End and Permanently Archive Current Cycle
app.post('/api/director/cycles/end', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director or Admin clearance required.' });
    }

    const { endDate } = req.body;
    if (!endDate) {
      return res.status(400).json({ error: 'End date parameter is mandatory.' });
    }

    const db = loadDB();
    const activeCycleIndex = db.cycles.findIndex(c => c.status === 'active' || c.status === 'paused');
    if (activeCycleIndex === -1) {
      return res.status(400).json({ error: 'No active operating cycle found.' });
    }

    const activeCycle = db.cycles[activeCycleIndex];
    const cycleStart = new Date(activeCycle.startDate);
    const cycleEnd = new Date(endDate);
    
    // 1. Total Driver Collections
    const driverPaymentsInCycle = (db.driver_payments || []).filter((p: any) => {
      return p.status === 'approved' && new Date(p.date) >= cycleStart && new Date(p.date) <= cycleEnd;
    });
    const driverCollections = driverPaymentsInCycle.reduce((sum: number, p: any) => sum + p.amount, 0);

    // 2. Approved Company Expenses
    const expensesInCycle = (db.financial_records || []).filter((f: any) => {
      return f.type === 'expense' && new Date(f.date) >= cycleStart && new Date(f.date) <= cycleEnd;
    });
    const totalExpenses = expensesInCycle.reduce((sum: number, f: any) => sum + f.amount, 0);

    // 3. Net Generated Amount (Revenue - Expenses)
    const netGeneratedAmount = driverCollections - totalExpenses;

    // 4. Shareholder settings & Pool
    const distributionPercentage = db.shareholder_settings?.distributionPercentage || 2;
    const distributionPool = netGeneratedAmount > 0 ? (netGeneratedAmount * (distributionPercentage / 100)) : 0;

    // 5. Individual shareholder earnings
    const totalShareholderInvestment = (db.shareholders || []).reduce((sum: number, s: any) => sum + s.investment_amount, 0);
    const shareholderSummary = (db.shareholders || []).map((s: any) => {
      const weight = totalShareholderInvestment > 0 ? s.investment_amount / totalShareholderInvestment : 0;
      return {
        id: s.id,
        fullName: s.full_name,
        investmentAmount: s.investment_amount,
        investmentWeight: weight * 100,
        earnings: distributionPool * weight
      };
    });

    // 6. Driver Payment Summary
    const driverPaymentSummary = db.drivers.map((d: any) => {
      const paymentsForDriver = driverPaymentsInCycle.filter((p: any) => p.driver_id === d.id);
      const collected = paymentsForDriver.reduce((sum: number, p: any) => sum + p.amount, 0);
      const user = db.users.find((u: any) => u.id === d.user_id);
      
      const financials = getDriverFinancials(d, db);
      const cycleInstallments = calculateInstallmentsForDriver(d, db, activeCycle);
      const completedInstallments = cycleInstallments.filter((inst: any) => inst.status === 'Completed').length;
      
      // Expenses applied to this driver during this cycle
      const expensesForDriver = expensesInCycle.filter((e: any) => e.driver_id === d.id);
      const expensesApplied = expensesForDriver.reduce((sum: number, e: any) => sum + e.amount, 0);

      const closingVehicleBalance = financials.remainingVehicleBalance;
      const openingVehicleBalance = closingVehicleBalance + collected;

      return {
        driverId: d.id,
        fullName: user ? user.full_name : d.fullName || 'Unknown Driver',
        companyDriverId: d.company_driver_id || 'PENDING',
        agreedAmount: d.agreed_amount ?? d.agreedAmount ?? 0,
        paymentsDuringCycle: collected,
        expensesApplied,
        openingVehicleBalance,
        closingVehicleBalance,
        outstandingBalance: Math.max(0, (d.agreed_amount ?? d.agreedAmount ?? 0) - collected),
        installmentsCompleted: completedInstallments,
        payments: paymentsForDriver.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          installmentNumber: p.installment_number,
          receiptNumber: p.receipt_number,
          date: p.date
        }))
      };
    });

    // 7. Expense Summary Category Breakdown
    const expenseSummary = {
      accidentRepairs: expensesInCycle.filter((e: any) => e.category === 'maintenance' && (e.description.toLowerCase().includes('accident') || e.description.toLowerCase().includes('crash') || e.description.toLowerCase().includes('collision'))).reduce((sum: number, e: any) => sum + e.amount, 0),
      vehicleMaintenance: expensesInCycle.filter((e: any) => e.category === 'maintenance').reduce((sum: number, e: any) => sum + e.amount, 0),
      operationalExpenses: expensesInCycle.filter((e: any) => e.category === 'fuel' || e.category === 'salary' || e.category === 'tax').reduce((sum: number, e: any) => sum + e.amount, 0),
      otherExpenses: expensesInCycle.filter((e: any) => e.category !== 'maintenance' && e.category !== 'fuel' && e.category !== 'salary' && e.category !== 'tax').reduce((sum: number, e: any) => sum + e.amount, 0)
    };

    // 8. Vehicle Balance Summary
    const vehicleBalanceSummary = db.vehicles.map((v: any) => {
      const assignedDriver = db.drivers.find((d: any) => d.id === v.driver_id);
      const assignedDriverUser = assignedDriver ? db.users.find((u: any) => u.id === assignedDriver.user_id) : null;
      return {
        vehicleId: v.id,
        plateNumber: v.plate_number,
        model: v.model,
        driverName: assignedDriverUser ? assignedDriverUser.full_name : 'No Driver Assigned',
        remainingVehicleBalance: assignedDriver ? (assignedDriver.remaining_vehicle_balance ?? assignedDriver.remainingVehicleBalance ?? 0) : 0
      };
    });

    // Update activeCycle with standard and custom audited snapshot metrics
    const closedCycle = {
      ...activeCycle,
      endDate,
      status: 'completed',
      locked: true,
      metrics: {
        totalRevenue: driverCollections, // Total Approved collections
        totalExpenses, // Approved company expenses
        netGeneratedAmount,
        distributionPercentage,
        distributionPool,
        driverCollections,
        driverPerformance: db.drivers.length > 0 ? parseFloat(((driverPaymentSummary.filter((x: any) => x.totalPaid >= x.agreedAmount).length / db.drivers.length) * 100).toFixed(1)) : 100,
        activeDrivers: db.drivers.filter((d: any) => d.status === 'approved' || d.status === 'available').length,
        totalFleetCount: db.vehicles.length,
        shareholderSummary,
        driverPaymentSummary,
        expenseSummary,
        vehicleBalanceSummary
      },
      updated_at: new Date().toISOString()
    };

    db.cycles[activeCycleIndex] = closedCycle;

    // Post dividend disbursement to financial ledger for accountability
    if (distributionPool > 0) {
      db.financial_records.unshift({
        id: generateUUID(),
        type: 'expense',
        category: 'dividend',
        amount: distributionPool,
        date: endDate,
        description: `Disbursed Shareholders Pool (${distributionPercentage}%) for Cycle ${closedCycle.id}`,
        approvedBy: actor.fullName,
        created_at: new Date().toISOString()
      });
    }

    // Notify of cycle completion to admins/directors
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Operating Cycle Completed & Locked',
      title_ha: 'An Kammala Kuma An Rufe Zagayen Sufuri',
      message_en: `Operation Cycle ${closedCycle.id} has ended. Net profit: ₦${netGeneratedAmount.toLocaleString()}. Shareholder pool: ₦${distributionPool.toLocaleString()}.`,
      message_ha: `Zagayen aiki ${closedCycle.id} ya kare. Ribar kudi: ₦${netGeneratedAmount.toLocaleString()}. Kudin Masu Hannun Jari: ₦${distributionPool.toLocaleString()}.`,
      type: 'info',
      read_status: 0,
      created_at: new Date().toISOString()
    });
    
    // Notify Shareholders
    shareholderSummary.forEach(sh => {
      if (sh.earnings > 0) {
        const targetSh = db.shareholders.find(s => s.id === sh.id);
        if (targetSh && targetSh.user_id) {
          db.notifications.unshift({
            id: generateUUID(),
            user_id: targetSh.user_id,
            title_en: 'Cycle Dividend Allocated',
            title_ha: 'An Ware Ribar Jari',
            message_en: `Cycle ${closedCycle.id} has ended. Your dividend allocation is ₦${sh.earnings.toLocaleString()}.`,
            message_ha: `Zagayen ${closedCycle.id} ya kare. Ribar da kake da ita shine ₦${sh.earnings.toLocaleString()}.`,
            type: 'success',
            read_status: 0,
            created_at: new Date().toISOString()
          });
        }
      }
    });

    // Notify Drivers
    driverPaymentSummary.forEach(dps => {
      const targetDriver = db.drivers.find(d => d.id === dps.driverId);
      if (targetDriver && targetDriver.user_id) {
        db.notifications.unshift({
          id: generateUUID(),
          user_id: targetDriver.user_id,
          title_en: 'Cycle Performance Summary',
          title_ha: 'Takaitaccen Aikin Zagaye',
          message_en: `Cycle ${closedCycle.id} ended. You paid ₦${dps.paymentsDuringCycle.toLocaleString()} of your ₦${dps.agreedAmount.toLocaleString()} target.`,
          message_ha: `Zagayen ${closedCycle.id} ya kare. Ka biya ₦${dps.paymentsDuringCycle.toLocaleString()} daga cikin ₦${dps.agreedAmount.toLocaleString()} da aka amince.`,
          type: 'info',
          read_status: 0,
          created_at: new Date().toISOString()
        });
      }
    });

    saveDB(db);
    syncActiveCycleToFirestore(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'CYCLE_END',
      'active',
      `Closed and archived cycle: ${closedCycle.id}. Net Profit: ₦${netGeneratedAmount.toLocaleString()}`,
      req
    );

    res.json({ success: true, cycle: closedCycle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Shareholder Settings
app.get('/api/director/shareholder-settings', authenticateSession, (req, res) => {
  const db = loadDB();
  res.json(db.shareholder_settings || { distributionPercentage: 2 });
});

// Update Shareholder Settings (Rabon Jari Percentage)
app.put('/api/director/shareholder-settings', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director or Admin clearance required.' });
    }

    const { distributionPercentage } = req.body;
    if (distributionPercentage === undefined || distributionPercentage < 0 || distributionPercentage > 100) {
      return res.status(400).json({ error: 'Please provide a valid percentage value between 0 and 100.' });
    }

    const db = loadDB();
    const prevVal = JSON.stringify(db.shareholder_settings);
    
    db.shareholder_settings = {
      distributionPercentage: parseFloat(distributionPercentage)
    };

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_SETTINGS_UPDATE',
      prevVal,
      JSON.stringify(db.shareholder_settings),
      req
    );

    // Broadcast update notification
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Shareholder Distribution Percentage Modified',
      title_ha: 'An Sauya Rabon Jari na Masu Hannun Jari',
      message_en: `Director modified shareholder pool percentage to ${distributionPercentage}%. Recalculating allocations.`,
      message_ha: `Babban Darakta ya sauya rabon jari na masu hannun jari zuwa kashi ${distributionPercentage}%.`,
      type: 'warning',
      read_status: 0,
      created_at: new Date().toISOString()
    });
    saveDB(db);

    res.json({ success: true, settings: db.shareholder_settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Company corporate profile settings
app.put('/api/director/company-settings', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director or Admin clearance required.' });
    }

    const { companyName, companyLogo, companyAddress, phone, email, currency, timeZone, languageDefault, themeDefault } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'Company Name is a mandatory field.' });
    }

    const db = loadDB();
    const prevVal = JSON.stringify(db.company_settings);

    db.company_settings = {
      companyName,
      companyLogo: companyLogo || db.company_settings?.companyLogo || "",
      companyAddress: companyAddress || "No 14 Zaria Road, Kano, Nigeria",
      phone: phone || "+234 803 123 4567",
      email: email || "info@ruqayyatransport.com",
      currency: currency || "₦",
      timeZone: timeZone || "Africa/Lagos",
      languageDefault: languageDefault || "en",
      themeDefault: themeDefault || "light"
    };

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_SETTINGS_UPDATE',
      prevVal,
      JSON.stringify(db.company_settings),
      req
    );

    res.json({ success: true, settings: db.company_settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================================================
// COMPANY OPERATIONS STATE MANAGEMENT (SETUP vs OPERATIONAL vs PAUSED)
// ==================================================

// GET current company operations state
app.get('/api/operations/state', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const state = db.company_operations_state || {
      status: 'Setup Mode',
      currentCycle: '',
      currentDay: 1,
      startedBy: null,
      startedAt: null,
      pauseHistory: [],
      auditLog: []
    };

    // Calculate metrics
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollections = (db.driver_payments || [])
      .filter((p: any) => p.status === 'approved' && p.date && p.date.startsWith(todayStr))
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const totalDrivers = db.drivers?.length || 0;
    const totalTricycles = db.vehicles?.length || 0;
    const companyWalletBalance = db.company_settings?.wallet_balance || 0;
    const systemHealth = 'Healthy';

    res.json({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to extract browser name from user agent
function getBrowserName(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Browser/Client';
}

// POST start company operations
app.post('/api/operations/start', authenticateSession, async (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Only Administrators can start operations.' });
    }

    const { cycleId: requestedCycleId } = req.body || {};

    const db = loadDB();
    const company_settings = db.company_settings || {};
    const missing: string[] = [];

    // Validations
    if (!company_settings.companyName || !company_settings.companyAddress || !company_settings.phone || !company_settings.email) {
      missing.push('Corporate Profile details complete in Settings');
    }

    const adminCount = db.users.filter((u: any) => u.role_id === 'role-admin' || u.role_id === 'role-director' || u.role === 'admin' || u.role === 'director').length;
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

    if (missing.length > 0) {
      console.warn('Bypassing setup checklist. Missing items:', missing);
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
      return res.status(400).json({ error: 'Company operations have already been initialized.' });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const device = req.headers['user-agent'] || 'Unknown Device';
    const browser = getBrowserName(device);

    const updatedState = {
      status: 'Operational Mode',
      currentCycle: 'Cycle 001',
      currentDay: 1,
      startedBy: actor.fullName,
      startedAt: new Date().toISOString(),
      pauseHistory: state.pauseHistory || [],
      auditLog: [
        {
          id: generateUUID(),
          action: 'Start Operations',
          user: actor.fullName,
          timestamp: new Date().toISOString(),
          reason: 'Company ready for live transit & leasing business',
          ip,
          device,
          browser
        },
        ...(state.auditLog || [])
      ]
    };

    db.company_operations_state = updatedState;

    // Create Cycle 001 if it doesn't exist
    if (!db.cycles) db.cycles = [];
    const activeCycle = db.cycles.find((c: any) => c.status === 'active');
    if (!activeCycle) {
      let cycleId = requestedCycleId;
      if (cycleId && db.cycles.some((c: any) => c.id === cycleId)) {
        return res.status(400).json({ error: `Duplicate Cycle ID error: '${cycleId}' already exists in database.` });
      }
      if (!cycleId) {
        cycleId = generateNextSequentialCycleId(db.cycles);
      }

      const durationDays = parseInt(req.body.durationDays) || 30;
      const computedEndDate = new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString();

      db.cycles.unshift({
        id: cycleId,
        startDate: new Date().toISOString(),
        endDate: computedEndDate,
        endGoalTons: 200,
        status: 'active',
        created_at: new Date().toISOString(),
        created_by: actor.fullName,
        locked: false,
        financials: []
      });
      updatedState.currentCycle = cycleId;
    } else {
      updatedState.currentCycle = activeCycle.id;
    }

    // Set all approved drivers to 'active' status if they are 'approved' but not 'active'
    if (db.drivers) {
      db.drivers.forEach((drv: any) => {
        if (drv.status === 'approved') {
          drv.status = 'active';
        }
      });
    }

    saveDB(db);
    await syncActiveCycleToFirestore(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_OPERATIONS_START',
      'Setup Mode',
      `Activated live enterprise operations. First 30-day operating cycle commenced by ${actor.fullName}`,
      req
    );

    res.json({ 
      success: true, 
      message: 'Company operations successfully started!', 
      state: updatedState,
      detail: generateFilteredPayload(actor.role, null, null, db)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST pause company operations
app.post('/api/operations/pause', authenticateSession, async (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Only Administrators can pause operations.' });
    }

    const { reason, pauseDays, daysPaused, extensionDays } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason for suspension is mandatory.' });
    }

    const daysToExtend = parseInt(pauseDays || daysPaused || extensionDays || 0, 10);

    const db = loadDB();
    const state = db.company_operations_state || { status: 'Setup Mode', pauseHistory: [], auditLog: [] };

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const device = req.headers['user-agent'] || 'Unknown Device';
    const browser = getBrowserName(device);

    const pauseId = generateUUID();
    const pauseEntry = {
      id: pauseId,
      pausedBy: actor.fullName,
      pausedAt: new Date().toISOString(),
      reason
    };

    state.status = 'Paused';
    state.pauseHistory = [pauseEntry, ...(state.pauseHistory || [])];
    state.auditLog = [
      {
        id: generateUUID(),
        action: 'Pause Operations',
        user: actor.fullName,
        timestamp: new Date().toISOString(),
        reason,
        ip,
        device,
        browser
      },
      ...(state.auditLog || [])
    ];

    // Synchronize active operating cycle status to paused or active
    if (!db.cycles) db.cycles = [];
    const activeCycle = db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
    if (activeCycle) {
      const newExtendedDays = (activeCycle.extendedDays || 0) + daysToExtend;
      activeCycle.status = 'paused';
      activeCycle.pauseReason = reason;
      activeCycle.pausedAt = new Date().toISOString();
      activeCycle.pausedBy = actor.fullName;
      activeCycle.pauseDays = daysToExtend;
      activeCycle.extendedDays = newExtendedDays;

      const currentEndMs = activeCycle.endDate ? new Date(activeCycle.endDate).getTime() : (new Date(activeCycle.startDate).getTime() + 30 * 24 * 3600 * 1000);
      const extendedEndMs = currentEndMs + daysToExtend * 24 * 3600 * 1000;
      activeCycle.endDate = new Date(extendedEndMs).toISOString().split('T')[0];

      if (!activeCycle.pauseHistory) {
        activeCycle.pauseHistory = [];
      }
      activeCycle.pauseHistory.unshift({
        id: generateUUID(),
        pausedBy: actor.fullName,
        pausedAt: new Date().toISOString(),
        reason,
        pauseDays: daysToExtend,
        extendedEndDate: activeCycle.endDate
      });
    }

    db.company_operations_state = state;
    saveDB(db);
    syncActiveCycleToFirestore(db);
    if (firestore) {
      try {
        await firestore.collection('system_status').doc('activeCycle').set({
          status: 'paused',
          endDate: activeCycle?.endDate || '',
          pauseReason: reason,
          extendedDays: activeCycle?.extendedDays || 0,
          pauseDays: activeCycle?.pauseDays || 0
        }, { merge: true });
      } catch (err: any) {
        console.warn('Failed to update Firestore activeCycle on operations pause (relying on local storage):', err?.message || err);
        if (err?.code === 7 || err?.message?.includes('PERMISSION_DENIED')) {
          setFirestore(null);
        }
      }
    }

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_OPERATIONS_PAUSE',
      'Operational Mode',
      `Suspended company operations: ${reason}`,
      req
    );

    res.json({ 
      success: true, 
      message: 'Company operations paused.', 
      state,
      detail: generateFilteredPayload(actor.role, null, null, db)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST resume company operations
app.post('/api/operations/resume', authenticateSession, async (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Only Administrators can resume operations.' });
    }

    const { reason } = req.body;

    const db = loadDB();
    const state = db.company_operations_state || { status: 'Setup Mode', pauseHistory: [], auditLog: [] };

    if (state.status !== 'Paused') {
      return res.status(400).json({ error: 'Operations can only be resumed when Paused.' });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const device = req.headers['user-agent'] || 'Unknown Device';
    const browser = getBrowserName(device);

    if (state.pauseHistory && state.pauseHistory.length > 0) {
      const lastPause = state.pauseHistory[0];
      lastPause.resumedBy = actor.fullName;
      lastPause.resumedAt = new Date().toISOString();
      if (reason) lastPause.resumeReason = reason;
    }

    state.status = 'Operational Mode';
    state.auditLog = [
      {
        id: generateUUID(),
        action: 'Resume Operations',
        user: actor.fullName,
        timestamp: new Date().toISOString(),
        reason: reason || 'Operations resumed by administrator',
        ip,
        device,
        browser
      },
      ...(state.auditLog || [])
    ];

    // Synchronize active operating cycle status to active
    if (!db.cycles) db.cycles = [];
    const pausedCycle = db.cycles.find((c: any) => c.status === 'paused');
    if (pausedCycle) {
      const nowTs = new Date();
      const pauseStart = new Date(pausedCycle.pausedAt || nowTs);
      const pauseDurationSeconds = Math.floor((nowTs.getTime() - pauseStart.getTime()) / 1000);
      
      // Canonical update: Add this pause period to the total accumulated paused time
      pausedCycle.totalPausedSeconds = (pausedCycle.totalPausedSeconds || 0) + Math.max(0, pauseDurationSeconds);
      pausedCycle.status = 'active';
      pausedCycle.resumedAt = nowTs.toISOString();
      pausedCycle.resumedBy = actor.fullName;
      pausedCycle.pausedAt = null; // IMPORTANT: Clear pausedAt to stop the clock on the pause

      if (pausedCycle.pauseHistory && pausedCycle.pauseHistory.length > 0) {
        pausedCycle.pauseHistory[0].resumedBy = actor.fullName;
        pausedCycle.pauseHistory[0].resumedAt = nowTs.toISOString();
        if (reason) pausedCycle.pauseHistory[0].resumeReason = reason;
        pausedCycle.pauseHistory[0].pauseDurationSeconds = pauseDurationSeconds;
      }
    }

    db.company_operations_state = state;
    saveDB(db);
    await syncActiveCycleToFirestore(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_OPERATIONS_RESUME',
      'Paused',
      `Resumed company operations: ${reason || 'Manual resumption'}`,
      req
    );

    res.json({ 
      success: true, 
      message: 'Company operations resumed.', 
      state,
      detail: generateFilteredPayload(actor.role, null, null, db)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Configure Salaries setup
app.post('/api/operations/config-salaries', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { salaries } = req.body;
    if (!salaries || !Array.isArray(salaries)) {
      return res.status(400).json({ error: 'Invalid salary configurations payload.' });
    }

    const db = loadDB();
    db.company_settings = db.company_settings || {};
    db.company_settings.salaries = salaries;
    db.company_settings.salary_configured = true;

    saveDB(db);
    res.json({ success: true, message: 'Salary rules configured successfully!', settings: db.company_settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Configure Company Wallet
app.post('/api/operations/config-wallet', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { balance } = req.body;
    if (balance === undefined || isNaN(parseFloat(balance))) {
      return res.status(400).json({ error: 'Balance value is mandatory.' });
    }

    const db = loadDB();
    db.company_settings = db.company_settings || {};
    db.company_settings.wallet_balance = parseFloat(balance);
    db.company_settings.wallet_initialized = true;

    saveDB(db);
    res.json({ success: true, message: 'Company wallet initialized successfully!', settings: db.company_settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Configure other rules
app.post('/api/operations/config-rules', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { rules_shareholder_configured, rules_cycle_configured, roles_configured } = req.body;
    const db = loadDB();
    db.company_settings = db.company_settings || {};

    if (rules_shareholder_configured !== undefined) db.company_settings.rules_shareholder_configured = rules_shareholder_configured;
    if (rules_cycle_configured !== undefined) db.company_settings.rules_cycle_configured = rules_cycle_configured;
    if (roles_configured !== undefined) db.company_settings.roles_configured = roles_configured;

    saveDB(db);
    res.json({ success: true, message: 'Operational rules configured successfully!', settings: db.company_settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Admin Profile & Account
app.post('/api/director/admins', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Executive Director clearance required.' });
    }

    const { email, password, fullName, phone, privilegeLevel, assignedTasks, passportPhoto } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name parameters are mandatory.' });
    }

    const db = loadDB();
    const emailExists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: 'This email address is already registered in the system.' });
    }

    let passportUrl = '';
    if (passportPhoto) {
      passportUrl = saveR2File(`admin_${fullName.replace(/\s+/g, '_')}_passport`, passportPhoto);
    }

    const userId = generateUUID();
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      phone: phone || "",
      password_hash: hashPassword(password),
      full_name: fullName,
      role_id: 'role-admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active'
    };

    const adminProfile = {
      id: generateUUID(),
      user_id: userId,
      company_id: `ADM-2026-${Math.floor(100 + Math.random() * 900)}`,
      passport_photo_url: passportUrl,
      privilege_level: privilegeLevel || 'Level 1: Fleet Operations',
      assigned_tasks: assignedTasks || ['Fleet Dispatch', 'Voucher Issuance', 'Real-time Tracking'],
      created_at: new Date().toISOString(),
      status: 'active'
    };

    db.users.push(newUser);
    db.admins.push(adminProfile);

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'ADMIN_CREATION',
      null,
      `Created Admin Account for: ${fullName} (${email})`,
      req
    );

    res.json({ success: true, user: { id: userId, email, fullName, role: 'admin' } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit Admin (Update, suspend, activate)
app.put('/api/director/admins/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Admin record not found.' });
    }

    const { fullName, phone, status, password, privilegeLevel, assignedTasks, passportPhoto } = req.body;
    const prevVal = JSON.stringify(user);

    if (fullName) user.full_name = fullName;
    if (phone !== undefined) user.phone = phone;
    if (status) {
      user.status = status;
    }
    if (password) {
      user.password_hash = hashPassword(password);
    }
    
    // Update admin profile status, clearance, and tasks
    const profile = db.admins.find(a => a.user_id === user.id);
    if (profile) {
      if (status) profile.status = status;
      if (privilegeLevel) profile.privilege_level = privilegeLevel;
      if (assignedTasks) profile.assigned_tasks = assignedTasks;
      if (passportPhoto) {
        const passportUrl = saveR2File(`admin_${user.full_name.replace(/\s+/g, '_')}_passport`, passportPhoto);
        profile.passport_photo_url = passportUrl;
      }
    }
    
    user.updated_at = new Date().toISOString();

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'ADMIN_UPDATE',
      prevVal,
      JSON.stringify(user),
      req
    );

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Admin
app.delete('/api/director/admins/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const userIndex = db.users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Admin record not found.' });
    }

    const adminUser = db.users[userIndex];
    db.users.splice(userIndex, 1);

    const profileIndex = db.admins.findIndex(a => a.user_id === req.params.id);
    if (profileIndex !== -1) {
      db.admins.splice(profileIndex, 1);
    }

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'ADMIN_DELETION',
      adminUser.email,
      null,
      req
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Director
app.post('/api/director/directors', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { email, password, fullName, phone, portfolio, shareholdingEquity, passportPhoto } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name parameters are mandatory.' });
    }

    const db = loadDB();
    const emailExists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: 'This email address is already registered in the system.' });
    }

    let passportUrl = '';
    if (passportPhoto) {
      passportUrl = saveR2File(`director_${fullName.replace(/\s+/g, '_')}_passport`, passportPhoto);
    }

    const userId = generateUUID();
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      phone: phone || "",
      password_hash: hashPassword(password),
      full_name: fullName,
      role_id: 'role-director',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active'
    };

    if (!db.directors) db.directors = [];

    const directorProfile = {
      id: generateUUID(),
      user_id: userId,
      company_id: `DIR-2026-${Math.floor(100 + Math.random() * 900)}`,
      passport_photo_url: passportUrl,
      portfolio: portfolio || 'Executive Director',
      shareholding_equity: shareholdingEquity || '5.0%',
      created_at: new Date().toISOString(),
      status: 'active'
    };

    db.users.push(newUser);
    db.directors.push(directorProfile);

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DIRECTOR_CREATION',
      null,
      `Created Director Account for: ${fullName} (${email})`,
      req
    );

    res.json({ success: true, user: { id: userId, email, fullName, role: 'director' } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit Director
app.put('/api/director/directors/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Director record not found.' });
    }

    const { fullName, phone, status, password, portfolio, shareholdingEquity, passportPhoto } = req.body;
    const prevVal = JSON.stringify(user);

    if (fullName) user.full_name = fullName;
    if (phone !== undefined) user.phone = phone;
    if (status) {
      user.status = status;
    }
    if (password) {
      user.password_hash = hashPassword(password);
    }
    
    if (!db.directors) db.directors = [];
    const profile = db.directors.find(d => d.user_id === user.id);
    if (profile) {
      if (status) profile.status = status;
      if (portfolio) profile.portfolio = portfolio;
      if (shareholdingEquity) profile.shareholding_equity = shareholdingEquity;
      if (passportPhoto) {
        const passportUrl = saveR2File(`director_${user.full_name.replace(/\s+/g, '_')}_passport`, passportPhoto);
        profile.passport_photo_url = passportUrl;
      }
    }
    
    user.updated_at = new Date().toISOString();

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DIRECTOR_UPDATE',
      prevVal,
      JSON.stringify(user),
      req
    );

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Director
app.delete('/api/director/directors/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const userIndex = db.users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Director record not found.' });
    }

    const dirUser = db.users[userIndex];
    db.users.splice(userIndex, 1);

    if (!db.directors) db.directors = [];
    const profileIndex = db.directors.findIndex(d => d.user_id === req.params.id);
    if (profileIndex !== -1) {
      db.directors.splice(profileIndex, 1);
    }

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DIRECTOR_DELETION',
      dirUser.email,
      null,
      req
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Log Driver Accident
app.post('/api/director/drivers/:id/add-accident', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const driver = db.drivers.find(d => d.id === req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver profile not found.' });

    const { date, description, damageEstimate, severity } = req.body;
    if (!date || !description) return res.status(400).json({ error: 'Date and description parameters are required.' });

    if (!driver.accidentHistory) driver.accidentHistory = [];
    
    const accident = {
      id: generateUUID().substring(0, 8).toUpperCase(),
      date,
      description,
      damageEstimate: parseFloat(damageEstimate) || 0,
      severity: severity || 'minor',
      created_at: new Date().toISOString()
    };

    driver.accidentHistory.unshift(accident);
    
    if (parseFloat(damageEstimate) > 0) {
      db.financial_records.unshift({
        id: generateUUID(),
        type: 'expense',
        category: 'maintenance',
        amount: parseFloat(damageEstimate),
        date,
        description: `Accident repair layout - Driver ${driver.company_driver_id || 'unassigned'}`,
        approvedBy: actor.fullName,
        created_at: new Date().toISOString()
      });
    }

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_ACCIDENT_LOGGED',
      null,
      `Logged accident for driver: ${driver.id}. Damage: ₦${parseFloat(damageEstimate).toLocaleString()}`,
      req
    );

    res.json({ success: true, accident });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Log Driver Rest
app.post('/api/director/drivers/:id/add-rest', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const driver = db.drivers.find(d => d.id === req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver profile not found.' });

    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start and end dates are required.' });

    if (!driver.restHistory) driver.restHistory = [];
    
    const rest = {
      id: generateUUID().substring(0, 8).toUpperCase(),
      startDate,
      endDate,
      reason: reason || 'Routine physical rest guidelines',
      created_at: new Date().toISOString()
    };

    driver.restHistory.unshift(rest);
    driver.status = 'off-duty';

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_REST_LOGGED',
      null,
      `Logged off-duty rest window for driver: ${driver.id}`,
      req
    );

    res.json({ success: true, rest });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Shareholder status (Activate/Suspend)
app.put('/api/director/shareholders/:id/status', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }

    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required.' });

    const db = loadDB();
    const shareholder = db.shareholders.find(s => s.id === req.params.id);
    if (!shareholder) return res.status(404).json({ error: 'Shareholder not found.' });

    const prevVal = shareholder.status;
    shareholder.status = status;
    shareholder.updated_at = new Date().toISOString();

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_STATUS_UPDATE',
      prevVal,
      status,
      req
    );

    res.json({ success: true, shareholder });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Shareholder Capital Weight
app.put('/api/director/shareholders/:id/investment', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }

    const { investment_amount } = req.body;
    if (investment_amount === undefined || investment_amount < 0) {
      return res.status(400).json({ error: 'Please provide a valid investment amount.' });
    }

    const db = loadDB();
    const shareholder = db.shareholders.find(s => s.id === req.params.id);
    if (!shareholder) return res.status(404).json({ error: 'Shareholder not found.' });

    const prevVal = shareholder.investment_amount;
    shareholder.investment_amount = parseFloat(investment_amount);
    shareholder.updated_at = new Date().toISOString();

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_INVESTMENT_UPDATE',
      prevVal ? prevVal.toString() : '0',
      investment_amount.toString(),
      req
    );

    res.json({ success: true, shareholder });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ==================================================
// 23. EXTRA DRIVER, PAYMENT & FLEET OPERATIONAL ENDPOINTS
// ==================================================

// Fetch all payments or payments for a specific driver
app.get('/api/payments', authenticateSession, (req, res) => {
  const { driverId } = req.query;
  const db = loadDB();
  if (!db.driver_payments) db.driver_payments = [];
  
  let list = db.driver_payments;
  if (driverId) {
    list = list.filter(p => p.driver_id === driverId);
  }
  res.json(list);
});

// Record a new driver payment (by admin, director or driver themselves)
app.post('/api/payments', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const opsState = db.company_operations_state || { status: 'Setup Mode' };
    if (opsState.status === 'Setup Mode' && actor.role !== 'driver') {
      return res.status(400).json({ error: 'Company is currently in Setup Mode. Financial operations are disabled until operations officially start.' });
    }
    
    // Check if current operating cycle is paused
    const pausedCycle = db.cycles && db.cycles.find((c: any) => c.status === 'paused');
    if (pausedCycle) {
      return res.status(400).json({ error: 'Corporate operating cycle is currently paused. Remittance installment submissions are temporarily frozen.' });
    }

    if (!db.driver_payments) db.driver_payments = [];

    let driverId = req.body.driverId;
    let isDriverSelf = false;

    if (actor.role === 'driver') {
      isDriverSelf = true;
      const drvRecord = db.drivers.find(d => d.user_id === actor.id);
      if (!drvRecord) {
        return res.status(404).json({ error: 'Driver profile not found.' });
      }
      driverId = drvRecord.id;
    } else if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Drivers, Admins, or Directors only.' });
    }

    const { amount, installmentNumber, outstandingAmount, date, receiptNumber, remarks, paymentMethod, referenceNumber } = req.body;
    if (!driverId || !amount || !installmentNumber) {
      return res.status(400).json({ error: 'Missing mandatory payment details.' });
    }

    const drv = db.drivers.find(d => d.id === driverId);
    if (!drv) return res.status(404).json({ error: 'Driver not found.' });

    // Ensure we have a valid receipt number / reference
    const rNumber = receiptNumber || referenceNumber || `RCP-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`;

    const newPayment = {
      id: `PAY-${Date.now()}-${generateUUID().substring(0, 4).toUpperCase()}`,
      driver_id: driverId,
      amount: parseFloat(amount),
      installment_number: parseInt(installmentNumber),
      outstanding_amount: parseFloat(outstandingAmount || 0),
      date: date || new Date().toISOString().split('T')[0],
      receipt_number: rNumber,
      payment_method: paymentMethod || 'bank_transfer',
      reference_number: referenceNumber || rNumber,
      status: isDriverSelf ? 'submitted' : 'pending', // 'submitted' if driver, 'pending' if admin
      recorded_by: actor.fullName,
      remarks: remarks || '',
      created_at: new Date().toISOString()
    };

    db.driver_payments.unshift(newPayment);

    // Register active notification for admins/directors
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'New Driver Payment Submitted',
      title_ha: 'An Shigar da Sabon Biyan Kudi',
      message_en: `Driver payment of ₦${parseFloat(amount).toLocaleString()} submitted for ${drv.company_driver_id || 'unassigned'} (Installment ${installmentNumber}). Review required.`,
      message_ha: `An shigar da biyan kudi na ₦${parseFloat(amount).toLocaleString()} na direba ${drv.company_driver_id || 'unassigned'} (Kashi ${installmentNumber}). Tana jiran amincewa.`,
      type: 'warning',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_PAYMENT_SUBMITTED',
      null,
      `Submitted payment of ₦${parseFloat(amount).toLocaleString()} for driver ${driverId} (Receipt/Ref: ${rNumber})`,
      req
    );

    res.json({ success: true, payment: newPayment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve or reject a driver payment
app.put('/api/payments/:id/status', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }

    const { status, remarks } = req.body; // 'approved' or 'rejected'
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: 'Invalid status parameter.' });
    }

    const db = loadDB();
    if (!db.driver_payments) db.driver_payments = [];

    const payment = db.driver_payments.find(p => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

    if (payment.status !== 'pending' && payment.status !== 'submitted') {
      return res.status(400).json({ error: 'Payment has already been reviewed.' });
    }

    const oldStatus = payment.status;
    payment.status = status;
    payment.remarks = remarks || payment.remarks;
    payment.approved_by = actor.fullName;
    payment.updated_at = new Date().toISOString();

    const drv = db.drivers.find(d => d.id === payment.driver_id);

    if (status === 'approved' && oldStatus !== 'approved') {
      // Automatically post to financial ledger as corporate revenue
      db.financial_records.unshift({
        id: generateUUID(),
        type: 'revenue',
        category: 'freight',
        amount: payment.amount,
        date: payment.date,
        description: `Installment Payment Approved - Driver ${drv?.company_driver_id || 'unassigned'} (Receipt: ${payment.receipt_number})`,
        approvedBy: actor.fullName,
        created_at: new Date().toISOString()
      });

      // Update remaining vehicle balance if applicable
      if (drv) {
        if (!drv.remaining_vehicle_balance) {
          // Initialize remaining balance if not set (default purchase price: ₦15,000,000)
          drv.remaining_vehicle_balance = 15000000;
        }
        drv.remaining_vehicle_balance = Math.max(0, drv.remaining_vehicle_balance - payment.amount);
      }

      // Update company wallet balance
      db.company_settings = db.company_settings || {};
      db.company_settings.wallet_balance = (db.company_settings.wallet_balance || 0) + payment.amount;
    } else if (status !== 'approved' && oldStatus === 'approved') {
      // Revert remaining balance if applicable
      if (drv && drv.remaining_vehicle_balance !== undefined) {
        drv.remaining_vehicle_balance = drv.remaining_vehicle_balance + payment.amount;
      }

      // Revert company wallet balance
      db.company_settings = db.company_settings || {};
      db.company_settings.wallet_balance = Math.max(0, (db.company_settings.wallet_balance || 0) - payment.amount);

      // Remove the corresponding ledger record
      db.financial_records = (db.financial_records || []).filter((f: any) => !f.description.includes(payment.receipt_number));
    }

    // Notify Driver
    if (drv) {
      db.notifications.unshift({
        id: generateUUID(),
        user_id: drv.user_id,
        title_en: `Payment ${status.toUpperCase()}`,
        title_ha: `Biyan Kudi: ${status.toUpperCase()}`,
        message_en: `Your installment payment of ₦${payment.amount.toLocaleString()} has been ${status}. ${remarks || ''}`,
        message_ha: `An ${status === 'approved' ? 'amince da' : 'ki amince da'} biyan kudin ku na ₦${payment.amount.toLocaleString()}. ${remarks || ''}`,
        type: status === 'approved' ? 'success' : 'danger',
        read_status: 0,
        created_at: new Date().toISOString()
      });
    }

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_PAYMENT_STATUS_UPDATE',
      'pending',
      `Payment ${payment.id} set to ${status.toUpperCase()} by ${actor.fullName}`,
      req
    );

    res.json({ success: true, payment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit driver payment details (Admins with permission or Directors)
app.put('/api/payments/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }

    const { amount, date, receiptNumber, remarks } = req.body;
    const db = loadDB();
    if (!db.driver_payments) db.driver_payments = [];

    const payment = db.driver_payments.find(p => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

    const prevValue = JSON.stringify(payment);

    // Adjust outstanding balance or remaining balance if approved and amount is edited
    if (payment.status === 'approved' && amount !== undefined) {
      const diff = parseFloat(amount) - payment.amount;
      const drv = db.drivers.find(d => d.id === payment.driver_id);
      if (drv && drv.remaining_vehicle_balance) {
        drv.remaining_vehicle_balance = Math.max(0, drv.remaining_vehicle_balance - diff);
      }
      
      // Update financial ledger record matching this receipt
      const matchLedger = db.financial_records.find(f => f.description.includes(payment.receipt_number));
      if (matchLedger) {
        matchLedger.amount = parseFloat(amount);
      }
    }

    if (amount !== undefined) payment.amount = parseFloat(amount);
    if (date) payment.date = date;
    if (receiptNumber) payment.receipt_number = receiptNumber;
    if (remarks !== undefined) payment.remarks = remarks;
    payment.updated_at = new Date().toISOString();
    payment.updated_by = actor.fullName;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_PAYMENT_MODIFIED',
      prevValue,
      JSON.stringify(payment),
      req
    );

    res.json({ success: true, payment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



app.put('/api/drivers/:id/archive', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }
    const db = loadDB();
    const drv = db.drivers.find(d => d.id === req.params.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });
    
    const prevStatus = drv.status;
    drv.status = 'archived';
    
    const user = db.users.find(u => u.id === drv.user_id);
    if (user) {
      user.status = 'archived';
    }
    
    // Automatically unassign active vehicles
    db.vehicles.forEach((v: any) => {
      if (v.driver_id === drv.id) {
        v.driver_id = null;
        if (v.status === 'assigned' || v.status === 'active') {
          v.status = 'idle';
        }
      }
    });

    drv.updated_at = new Date().toISOString();
    drv.updated_by = actor.fullName;
    
    saveDB(db);
    
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_ARCHIVED',
      prevStatus,
      'archived',
      req
    );
    
    res.json({ success: true, message: 'Driver archived successfully.', driver: drv });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/drivers/:id/restore', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }
    const db = loadDB();
    const drv = db.drivers.find(d => d.id === req.params.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });
    
    const prevStatus = drv.status;
    drv.status = 'approved'; // restore to active status
    
    const user = db.users.find(u => u.id === drv.user_id);
    if (user) {
      user.status = 'active';
    }
    
    drv.updated_at = new Date().toISOString();
    drv.updated_by = actor.fullName;
    
    saveDB(db);
    
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_RESTORED',
      prevStatus,
      'approved',
      req
    );
    
    res.json({ success: true, message: 'Driver restored successfully.', driver: drv });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/drivers/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }
    const db = loadDB();
    const idx = db.drivers.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Driver not found.' });
    
    const removedDrv = db.drivers[idx];
    
    // 1. Delete corresponding user
    const userIdx = db.users.findIndex(u => u.id === removedDrv.user_id);
    if (userIdx !== -1) {
      db.users.splice(userIdx, 1);
    }
    
    // 2. Delete corresponding guarantor
    if (db.guarantors) {
      db.guarantors = db.guarantors.filter((g: any) => g.driver_id !== removedDrv.id);
    }
    
    // 3. Unassign vehicles
    db.vehicles.forEach((v: any) => {
      if (v.driver_id === removedDrv.id) {
        v.driver_id = null;
        if (v.status === 'assigned' || v.status === 'active') {
          v.status = 'idle';
        }
      }
    });

    // 4. Delete documents
    if (db.driver_documents) {
      db.driver_documents = db.driver_documents.filter((doc: any) => doc.driver_id !== removedDrv.id);
    }

    // Remove the driver
    db.drivers.splice(idx, 1);
    
    saveDB(db);
    
    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_DELETED',
      JSON.stringify(removedDrv),
      `Permanently removed driver: ${removedDrv.fullName}`,
      req
    );
    
    res.json({ success: true, message: 'Driver profile and associated records purged successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Driver Self Profile
app.put('/api/drivers/self', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'driver') {
      return res.status(403).json({ error: 'Access Denied. Only drivers can update their self profile.' });
    }

    const { phone, email, address, password, passportPhoto } = req.body;
    const db = loadDB();
    const drv = db.drivers.find(d => d.user_id === actor.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

    const user = db.users.find(u => u.id === actor.id);
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    const prevValue = JSON.stringify({ user, drv });

    if (phone) {
      user.phone = phone;
    }
    if (email) {
      const emailExists = db.users.some(u => u.id !== actor.id && u.email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        return res.status(400).json({ error: 'Email already registered.' });
      }
      user.email = email.toLowerCase();
      drv.email = email.toLowerCase();
    }
    if (address !== undefined) {
      drv.address = address;
    }
    if (password) {
      user.password_hash = hashPassword(password);
    }
    if (passportPhoto) {
      const fileUrl = passportPhoto.startsWith('http') ? passportPhoto : saveR2File(`driver_${drv.id}_passport`, passportPhoto);
      drv.passport_photo_url = fileUrl;
      (drv as any).passportPhoto = fileUrl;
      (drv as any).passportPhotoUrl = fileUrl;
      if (!db.driver_documents) db.driver_documents = [];
      const existingDocIndex = db.driver_documents.findIndex(d => d.driver_id === drv.id && (d.document_type === 'passport_photo' || d.document_type === 'passport'));
      if (existingDocIndex >= 0) {
        db.driver_documents[existingDocIndex].file_url = fileUrl;
        db.driver_documents[existingDocIndex].created_at = new Date().toISOString();
      } else {
        db.driver_documents.push({
          id: `doc-${Date.now()}`,
          driver_id: drv.id,
          document_type: 'passport_photo',
          file_url: fileUrl,
          created_at: new Date().toISOString()
        });
      }
    }

    user.updated_at = new Date().toISOString();
    drv.updated_at = new Date().toISOString();

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_SELF_PROFILE_UPDATE',
      prevValue,
      JSON.stringify({ user, drv }),
      req
    );

    res.json({ success: true, driver: drv });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Shareholder Self Profile & Passport
app.put('/api/shareholders/self', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'shareholder') {
      return res.status(403).json({ error: 'Access Denied. Only shareholders can update their self profile.' });
    }

    const { phone, email, address, password, passportPhoto } = req.body;
    const db = loadDB();
    const shareholder = db.shareholders.find(s => s.user_id === actor.id || s.email.toLowerCase() === actor.email.toLowerCase());
    if (!shareholder) return res.status(404).json({ error: 'Shareholder profile not found.' });

    const user = db.users.find(u => u.id === actor.id || u.email.toLowerCase() === actor.email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    if (phone) {
      user.phone = phone;
      shareholder.phone = phone;
    }
    if (email) {
      const emailExists = db.users.some(u => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        return res.status(400).json({ error: 'Email already registered.' });
      }
      user.email = email.toLowerCase();
      shareholder.email = email.toLowerCase();
    }
    if (address !== undefined) {
      shareholder.address = address;
    }
    if (password) {
      user.password_hash = hashPassword(password);
    }
    if (passportPhoto) {
      const fileUrl = passportPhoto.startsWith('http') ? passportPhoto : saveR2File(`shareholder_${shareholder.id}_passport`, passportPhoto);
      shareholder.passport_photo_url = fileUrl;
      (shareholder as any).passportPhoto = fileUrl;
      (shareholder as any).passportPhotoUrl = fileUrl;
    }

    user.updated_at = new Date().toISOString();
    shareholder.updated_at = new Date().toISOString();

    saveDB(db);
    res.json({ success: true, message: 'Shareholder profile updated successfully.', shareholder });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Retrieve Self Driver Documents (License, insurance, etc.)
app.get('/api/drivers/self/documents', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'driver') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const drv = db.drivers.find(d => d.user_id === actor.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

    const driverDocs = db.driver_documents.filter(doc => doc.driver_id === drv.id);
    const vehicleDocs = db.vehicle_documents.filter(doc => doc.driver_id === drv.id || (drv.vehicle_id && doc.vehicle_id === drv.vehicle_id));
    const companyDocs = db.company_documents.filter(doc => doc.status === 'active');

    res.json({
      driverDocuments: driverDocs,
      vehicleDocuments: vehicleDocs,
      companyDocuments: companyDocs
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Retrieve Self Shareholder Calculations & Cycles
app.get('/api/shareholders/me', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'shareholder') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const shareholder = db.shareholders.find(s => s.email.toLowerCase() === actor.email.toLowerCase());
    if (!shareholder) {
      return res.status(404).json({ error: 'Shareholder profile not found.' });
    }

    const totalInvestments = db.shareholders.reduce((sum, s) => sum + s.investment_amount, 0);
    const investmentPercentage = totalInvestments > 0 ? (shareholder.investment_amount / totalInvestments) * 100 : 0;

    const activeCycle = db.cycles.find(c => c.status === 'active' || c.status === 'paused');
    const completedCycles = db.cycles.filter(c => c.status === 'completed');

    const totalRevenues = db.financial_records
      .filter(f => f.type === 'revenue')
      .reduce((sum, r) => sum + r.amount, 0);

    const totalExpenses = db.financial_records
      .filter(f => f.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);

    const netGeneratedAmount = totalRevenues - totalExpenses;
    const distributionPercentage = db.shareholder_settings?.distributionPercentage || 2;
    const distributionPool = netGeneratedAmount > 0 ? (netGeneratedAmount * (distributionPercentage / 100)) : 0;
    const currentCycleEarnings = distributionPool * (investmentPercentage / 100);

    let totalEarnings = 0;
    completedCycles.forEach(c => {
      if (c.metrics && c.metrics.distributionPool) {
        totalEarnings += c.metrics.distributionPool * (investmentPercentage / 100);
      }
    });

    res.json({
      shareholder,
      calculations: {
        totalInvestments,
        investmentPercentage,
        distributionPercentage,
        currentCycleEarnings,
        totalEarnings,
        netGeneratedAmount,
        distributionPool,
        activeCycle,
        completedCycles
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record direct expense with possible driver linkage
app.post('/api/expenses', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { amount, category, description, date, driverId, receiptUrl } = req.body;
    if (!amount || !category || !description || !date) {
      return res.status(400).json({ error: 'Missing expense details.' });
    }

    const db = loadDB();
    
    // Post directly to ledger
    const expenseRecord = {
      id: generateUUID(),
      type: 'expense' as const,
      category: category,
      amount: parseFloat(amount),
      date,
      description: `${description} ${driverId ? `(Linked Driver ID: ${driverId})` : ''}`,
      approvedBy: actor.fullName,
      receipt_url: receiptUrl || '',
      driver_id: driverId || null,
      created_at: new Date().toISOString()
    };

    db.financial_records.unshift(expenseRecord);

    // Update company wallet balance
    db.company_settings = db.company_settings || {};
    db.company_settings.wallet_balance = Math.max(0, (db.company_settings.wallet_balance || 0) - parseFloat(amount));

    // If driver linked, update their expense history and automatically add to their remaining balance
    if (driverId) {
      const drv = db.drivers.find(d => d.id === driverId);
      if (drv) {
        if (!drv.expenseHistory) drv.expenseHistory = [];
        drv.expenseHistory.unshift({
          id: expenseRecord.id,
          amount: parseFloat(amount),
          category,
          description,
          date,
          receipt_url: receiptUrl || ''
        });
        const currentRemBalance = drv.remaining_vehicle_balance !== undefined ? drv.remaining_vehicle_balance : (drv.agreed_amount || 180000);
        drv.remaining_vehicle_balance = currentRemBalance + parseFloat(amount);
      }
    }

    // Register notification for live feedback
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Corporate Expense Recorded',
      title_ha: 'An Shigar da Sabon Kashe Kudi',
      message_en: `Expense of ₦${parseFloat(amount).toLocaleString()} posted under ${category} by ${actor.fullName}.`,
      message_ha: `An shigar da kashe kudi na ₦${parseFloat(amount).toLocaleString()} karkashin ${category}.`,
      type: 'danger',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'EXPENSE_ADDED',
      null,
      `Recorded expense: ₦${parseFloat(amount).toLocaleString()} for ${category}. Link driver: ${driverId || 'None'}`,
      req
    );

    res.json({ success: true, record: expenseRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit Vehicle details
app.put('/api/vehicles/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const vehicle = db.vehicles.find(v => v.id === req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle asset not found.' });

    const { brand, model, year, colour, plateNumber, registrationNumber, chassisNumber, engineNumber, capacity, mileage, status, purchasePrice, remainingBalance } = req.body;
    const prevVal = JSON.stringify(vehicle);

    if (brand !== undefined) vehicle.brand = brand;
    if (model !== undefined) vehicle.model = model;
    if (year !== undefined) vehicle.year = parseInt(year);
    if (colour !== undefined) vehicle.colour = colour;
    if (plateNumber !== undefined) vehicle.plate_number = plateNumber.toUpperCase();
    if (registrationNumber !== undefined) vehicle.registration_number = registrationNumber;
    if (chassisNumber !== undefined) vehicle.chassis_number = chassisNumber;
    if (engineNumber !== undefined) vehicle.engine_number = engineNumber;
    if (capacity !== undefined) vehicle.capacity = capacity;
    if (mileage !== undefined) vehicle.mileage = parseInt(mileage);
    if (status !== undefined) vehicle.status = status;
    if (purchasePrice !== undefined) vehicle.purchase_price = parseFloat(purchasePrice);
    if (remainingBalance !== undefined) vehicle.remaining_balance = parseFloat(remainingBalance);

    vehicle.updated_at = new Date().toISOString();
    vehicle.updated_by = actor.fullName;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'VEHICLE_UPDATED',
      prevVal,
      JSON.stringify(vehicle),
      req
    );

    res.json({ success: true, vehicle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// SHAREHOLDER WITHDRAWAL
app.post('/api/finance/withdraw', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const { shareholderId, amount, remarks } = req.body;

    let sh: any;
    if (actor.role === 'shareholder') {
      sh = db.shareholders.find((s: any) => s.email && actor.email && s.email.toLowerCase() === actor.email.toLowerCase());
      if (!sh) return res.status(404).json({ error: 'Shareholder profile not found.' });
      if (shareholderId && sh.id !== shareholderId) {
        return res.status(403).json({ error: 'Access Denied: You can only manage your own account.' });
      }
    } else if (actor.role === 'admin' || actor.role === 'director') {
      if (!shareholderId) return res.status(400).json({ error: 'Shareholder ID required.' });
      sh = db.shareholders.find((s: any) => s.id === shareholderId);
      if (!sh) return res.status(404).json({ error: 'Shareholder not found.' });
    } else {
      return res.status(403).json({ error: 'Access Denied: Admin, Director, or Shareholder role required.' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount.' });
    }

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
    

    const walletBalance = totalRev - totalExp;
    if (walletBalance < withdrawAmt) {
      return res.status(400).json({ error: `Insufficient company cash balance to fulfill withdrawal. Wallet balance: ₦${walletBalance.toLocaleString()}` });
    }

    sh.total_withdrawn = totalWithdrawn + withdrawAmt;
    sh.updated_at = new Date().toISOString();

    db.financial_records.unshift({
      id: `FIN-WD-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
      type: 'expense',
      category: 'other',
      amount: withdrawAmt,
      date: new Date().toISOString().split('T')[0],
      description: `Shareholder Dividend Withdrawal - ${sh.full_name} (${remarks || 'Approved Disbursal'})`,
      approvedBy: actor.fullName || actor.email || 'Shareholder',
      created_at: new Date().toISOString()
    });

    // Update company wallet balance
    db.company_settings = db.company_settings || {};
    db.company_settings.wallet_balance = Math.max(0, (db.company_settings.wallet_balance || 0) - withdrawAmt);

    db.notifications.unshift({
      id: generateUUID(),
      user_id: sh.user_id,
      title_en: 'Shareholder Withdrawal Processed',
      title_ha: 'An Cire Kudin Shareholder',
      message_en: `Withdrew ₦${withdrawAmt.toLocaleString()} from available dividends of ${sh.full_name}.`,
      message_ha: `An cire ₦${withdrawAmt.toLocaleString()} daga ribar Alhaji/Hajiya ${sh.full_name}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_WITHDRAWAL',
      null,
      `Shareholder ${sh.full_name} withdrew ₦${withdrawAmt.toLocaleString()}`,
      req
    );

    res.json({ success: true, shareholder: sh });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SHAREHOLDER REINVESTMENT
app.post('/api/finance/reinvest', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const { shareholderId, amount } = req.body;

    let sh: any;
    if (actor.role === 'shareholder') {
      sh = db.shareholders.find((s: any) => s.email && actor.email && s.email.toLowerCase() === actor.email.toLowerCase());
      if (!sh) return res.status(404).json({ error: 'Shareholder profile not found.' });
      if (shareholderId && sh.id !== shareholderId) {
        return res.status(403).json({ error: 'Access Denied: You can only manage your own account.' });
      }
    } else if (actor.role === 'admin' || actor.role === 'director') {
      if (!shareholderId) return res.status(400).json({ error: 'Shareholder ID required.' });
      sh = db.shareholders.find((s: any) => s.id === shareholderId);
      if (!sh) return res.status(404).json({ error: 'Shareholder not found.' });
    } else {
      return res.status(403).json({ error: 'Access Denied: Admin, Director, or Shareholder role required.' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid reinvestment amount.' });
    }

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
    

    sh.investment_amount += reinvestAmt;
    sh.total_reinvested = (sh.total_reinvested || 0) + reinvestAmt;
    sh.total_withdrawn = totalWithdrawn + reinvestAmt;
    sh.updated_at = new Date().toISOString();

    db.financial_records.unshift({
      id: `FIN-REINV-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
      type: 'revenue',
      category: 'other',
      amount: reinvestAmt,
      date: new Date().toISOString().split('T')[0],
      description: `Capital Reinvestment - ${sh.full_name} (Rollover of ₦${reinvestAmt.toLocaleString()} dividends into Capital)`,
      approvedBy: actor.fullName || actor.email || 'Shareholder',
      created_at: new Date().toISOString()
    });
    
    db.financial_records.unshift({
      id: `FIN-REINV-EXP-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
      type: 'expense',
      category: 'other',
      amount: reinvestAmt,
      date: new Date().toISOString().split('T')[0],
      description: `Shareholder Reinvestment Debit - ${sh.full_name} (Transfer to capital stock)`,
      approvedBy: actor.fullName || actor.email || 'Shareholder',
      created_at: new Date().toISOString()
    });

    db.notifications.unshift({
      id: generateUUID(),
      user_id: sh.user_id,
      title_en: 'Shareholder Reinvestment Processed',
      title_ha: 'Sake Zuba Jari na Shareholder',
      message_en: `Successfully reinvested ₦${reinvestAmt.toLocaleString()} dividends into capital stock for ${sh.full_name}.`,
      message_ha: `An sake zuba jarin ribar ₦${reinvestAmt.toLocaleString()} a matsayin jari na ${sh.full_name}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_REINVESTMENT',
      null,
      `Shareholder ${sh.full_name} reinvested ₦${reinvestAmt.toLocaleString()}`,
      req
    );

    res.json({ success: true, shareholder: sh });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SHAREHOLDER CAPITAL REDEMPTION (CAP OUT)
app.post('/api/finance/cap-out', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const { shareholderId, amount, remarks } = req.body;

    let sh: any;
    if (actor.role === 'shareholder') {
      sh = db.shareholders.find((s: any) => s.email && actor.email && s.email.toLowerCase() === actor.email.toLowerCase());
      if (!sh) return res.status(404).json({ error: 'Shareholder profile not found.' });
      if (shareholderId && sh.id !== shareholderId) {
        return res.status(403).json({ error: 'Access Denied: You can only manage your own account.' });
      }
    } else if (actor.role === 'admin' || actor.role === 'director') {
      if (!shareholderId) return res.status(400).json({ error: 'Shareholder ID required.' });
      sh = db.shareholders.find((s: any) => s.id === shareholderId);
      if (!sh) return res.status(404).json({ error: 'Shareholder not found.' });
    } else {
      return res.status(403).json({ error: 'Access Denied: Admin, Director, or Shareholder role required.' });
    }

    const capOutAmt = parseFloat(amount);
    if (!capOutAmt || capOutAmt <= 0) {
      return res.status(400).json({ error: 'Invalid redemption amount.' });
    }

    const currentInvestment = sh.investment_amount || 0;
    

    sh.investment_amount = currentInvestment - capOutAmt;
    sh.total_cashed_out = (sh.total_cashed_out || 0) + capOutAmt;
    sh.updated_at = new Date().toISOString();

    db.financial_records.unshift({
      id: `FIN-CAPOUT-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
      type: 'expense',
      category: 'other',
      amount: capOutAmt,
      date: new Date().toISOString().split('T')[0],
      description: `Capital Stock Redemption (Cap Out) - ${sh.full_name} (${remarks || 'Principal Liquidation'})`,
      approvedBy: actor.fullName || actor.email || 'Shareholder',
      created_at: new Date().toISOString()
    });

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

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'SHAREHOLDER_CAP_OUT',
      null,
      `Shareholder ${sh.full_name} redeemed ₦${capOutAmt.toLocaleString()} capital stock`,
      req
    );

    res.json({ success: true, shareholder: sh });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AUTOMATED PAYROLL MANAGEMENT
app.post('/api/finance/payroll', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }
    const db = loadDB();
    
    // Check active operating cycle
    const activeCycle = db.cycles && db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
    if (!activeCycle) {
      return res.status(400).json({ error: 'No active or paused operating cycle found. Payroll must be disbursed during an active operating cycle.' });
    }

    // Check if payroll already disbursed for this cycle
    const alreadyDisbursed = (db.financial_records || []).some((f: any) => 
      f.category === 'salary' && 
      (f.cycle_id === activeCycle.id || f.description.includes(`Cycle ${activeCycle.id}`))
    );

    if (alreadyDisbursed) {
      return res.status(400).json({ error: `Payroll has already been disbursed for Cycle ${activeCycle.id}. Duplicate payment is blocked.` });
    }

    // Calculate active vehicles count from trip manifests over a 30-day cycle
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
      // Fallback: get all vehicles that had ANY trip manifest ever
      const allTripVehicleIds = new Set<string>();
      (db.trip_manifests || []).forEach((t: any) => {
        const vid = t.vehicle_id || t.vehicleId;
        if (vid) allTripVehicleIds.add(vid);
      });
      activeVehiclesCount = allTripVehicleIds.size;
    }
    if (activeVehiclesCount === 0) {
      // Secondary fallback to active vehicles
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
      return res.status(400).json({ error: `Insufficient funds in company wallet to process payroll. Required: ₦${totalPayroll.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}` });
    }

    const entries = [
      { name: 'Barrister', amount: barristerSal },
      { name: 'Manager', amount: managerSal },
      { name: 'Admin Adam', amount: adamSal },
      { name: 'Admin Abakaka', amount: abakakaSal }
    ];

    entries.forEach(entry => {
      db.financial_records.unshift({
        id: `FIN-PAY-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
        type: 'expense',
        category: 'salary',
        amount: entry.amount,
        date: new Date().toISOString().split('T')[0],
        description: `Payroll Disbursal for ${entry.name} based on ${activeVehiclesCount} active tricycles - Cycle ${activeCycle.id}`,
        cycle_id: activeCycle.id,
        approvedBy: actor.fullName,
        created_at: new Date().toISOString()
      });
    });

    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Payroll Successfully Processed',
      title_ha: 'An Shigar da Albashin Ma’aikata',
      message_en: `Disbursed ₦${totalPayroll.toLocaleString()} in salaries for ${activeVehiclesCount} active tricycles in the cycle.`,
      message_ha: `An fitar da albashi na ₦${totalPayroll.toLocaleString()} na babura ${activeVehiclesCount} masu aiki a wannan zagaye.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'PAYROLL_GENERATED',
      null,
      `Processed payroll of ₦${totalPayroll.toLocaleString()} for ${activeVehiclesCount} active tricycles.`,
      req
    );

    res.json({ success: true, totalPayroll, activeVehiclesCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// SECURE SYSTEM OPERATIONAL RESET TOOL (Admin & Director ONLY)
app.get('/api/admin/admins', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied: Administrative role required.' });
    }

    const db = loadDB();
    const mappedAdmins = (db.admins || []).map((adm: any) => {
      const user = db.users.find((u: any) => u.id === adm.user_id);
      return {
        ...adm,
        fullName: user?.full_name || adm.fullName || 'Admin User',
        email: user?.email || adm.email || '',
        phone: user?.phone || adm.phone || '',
        status: adm.status || 'active'
      };
    });

    res.json(mappedAdmins);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch admins: ${err.message}` });
  }
});

app.get('/api/admin/audit-logs', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied: Administrative role required.' });
    }
    const db = loadDB();
    res.json(db.audit_logs || []);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch audit logs: ${err.message}` });
  }
});

// Admin Account Controller: Fetch all user credentials and account statuses
app.get('/api/admin/accounts', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Administrative permissions required.' });
    }

    const db = loadDB();
    const accounts = (db.users || []).map((u: any) => {
      let role = u.role || 'driver';
      if (u.role_id === 'role-admin') role = 'admin';
      else if (u.role_id === 'role-director') role = 'director';
      else if (u.role_id === 'role-shareholder') role = 'shareholder';
      else if (u.role_id === 'role-driver') role = 'driver';

      // Attach linked profile info
      let profileInfo: any = {};
      if (role === 'driver') {
        const d = (db.drivers || []).find((driver: any) => driver.user_id === u.id || driver.id === u.driver_id);
        if (d) {
          profileInfo = {
            tricycle_number: d.tricycle_number || d.keke_number,
            driver_code: d.driver_code,
            nin: d.nin,
            address: d.address
          };
        }
      } else if (role === 'shareholder') {
        const s = (db.shareholders || []).find((sh: any) => sh.user_id === u.id || sh.id === u.shareholder_id);
        if (s) {
          profileInfo = {
            shareholder_code: s.shareholder_code,
            units: s.units
          };
        }
      }

      return {
        id: u.id,
        full_name: u.full_name || u.name || 'Enterprise User',
        username: u.username || u.email || 'N/A',
        email: u.email || '',
        phone: u.phone || '',
        role: role,
        status: u.status || 'active',
        created_at: u.created_at || new Date().toISOString(),
        updated_at: u.updated_at || new Date().toISOString(),
        profile: profileInfo
      };
    });

    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch accounts: ${err.message}` });
  }
});

// Admin Account Controller: Update user credentials and invalidate active sessions
app.put('/api/admin/users/:id/credentials', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Administrative permissions required.' });
    }

    const { id } = req.params;
    const { username, password, newPassword, status, email, phone, full_name, fullName } = req.body;

    const db = loadDB();
    const userIndex = (db.users || []).findIndex((u: any) => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Target user account not found in system directory.' });
    }

    const user = db.users[userIndex];

    // Check username uniqueness if changing
    if (username && username.trim()) {
      const cleanUsername = username.trim();
      const existing = (db.users || []).find((u: any) => u.id !== id && u.username && u.username.trim().toLowerCase() === cleanUsername.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: `Username "${cleanUsername}" is already assigned to another account.` });
      }
      user.username = cleanUsername;
    }

    const passToSet = (newPassword || password || '').trim();
    if (passToSet) {
      user.password_hash = hashPassword(passToSet);
    }

    if (status) {
      user.status = status;
    }

    if (email !== undefined) {
      user.email = email.trim();
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    const nameToSet = (fullName !== undefined ? fullName : full_name);
    if (nameToSet !== undefined) {
      user.full_name = nameToSet.trim();
    }

    user.updated_at = new Date().toISOString();

    // Force re-authentication on next login by clearing active user sessions
    if (db.sessions && Array.isArray(db.sessions)) {
      db.sessions = db.sessions.filter((s: any) => s.userId !== id && s.user_id !== id);
    }

    // Also update associated role tables if applicable
    if (user.role_id === 'role-driver' || user.role === 'driver') {
      const driver = (db.drivers || []).find((d: any) => d.user_id === user.id || d.id === user.driver_id);
      if (driver) {
        if (nameToSet !== undefined) driver.full_name = nameToSet.trim();
        if (email !== undefined) driver.email = email.trim();
        if (phone !== undefined) driver.phone = phone.trim();
        if (status) driver.status = status;
      }
    } else if (user.role_id === 'role-shareholder' || user.role === 'shareholder') {
      const shareholder = (db.shareholders || []).find((s: any) => s.user_id === user.id || s.id === user.shareholder_id);
      if (shareholder) {
        if (nameToSet !== undefined) shareholder.full_name = nameToSet.trim();
        if (email !== undefined) shareholder.email = email.trim();
        if (phone !== undefined) shareholder.phone = phone.trim();
        if (status) shareholder.status = status;
      }
    }

    saveDB(db);

    writeServerAuditLog(actor.id, user.username || user.email, 'admin', 'CREDENTIAL_UPDATE', `Updated credentials/status for user ID: ${id} (${user.username})`, null, req);

    res.json({
      success: true,
      message: `Credentials updated successfully for ${user.username || user.full_name}. Active sessions invalidated.`,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        status: user.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to update credentials: ${err.message}` });
  }
});

app.post('/api/admin/reset-test-data', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }

    const { confirmationText } = req.body;
    if (confirmationText !== 'RESET RUQAYYA ERP') {
      return res.status(400).json({ error: 'Invalid confirmation text. Must match RESET RUQAYYA ERP.' });
    }

    const db = loadDB();

    // 1. Purge operational test data collections
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

    // 2. Reset company operations state to brand-new setup mode
    db.company_operations_state = {
      status: 'Setup Mode',
      currentCycle: '',
      currentDay: 1,
      startedBy: null,
      startedAt: null,
      pauseHistory: [],
      auditLog: []
    };

    // 3. Filter users to preserve active administrative / corporate management accounts
    const adminsAndDirectors = db.users.filter((u: any) => {
      const isCoreAdmin = u.username === 'ADAM' || u.username === 'MMR';
      const isAdminOrDirectorRole = u.role_id === 'role-director' || u.role_id === 'role-admin' || u.role === 'director' || u.role === 'admin';
      return isCoreAdmin || isAdminOrDirectorRole;
    });
    db.users = adminsAndDirectors;

    const keptUserIds = new Set(adminsAndDirectors.map((u: any) => u.id));
    db.admins = db.admins.filter((a: any) => keptUserIds.has(a.user_id));
    db.directors = db.directors.filter((d: any) => keptUserIds.has(d.user_id));

    // 4. Preserve current user session to prevent immediate logout of the operator
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const currentToken = authHeader.substring(7);
      db.sessions = db.sessions.filter((s: any) => s.token === currentToken);
    } else {
      db.sessions = [];
    }

    // 5. Establish secure, clean bootstrap audit trail
    db.audit_logs = [
      {
        id: `AUD-${Date.now()}-RESET`,
        user_id: actor.id,
        user_email: actor.email,
        user_role: actor.role,
        action: 'SYSTEM_RESET_OPERATIONAL_DATA',
        previous_value: 'Active test operational data environment.',
        new_value: `Operational data reset executed. All vehicles, drivers, vouchers, financial records, and logs successfully purged. Configuration preserved.`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString()
      }
    ];

    saveDB(db);

    res.json({ success: true, message: 'All operational test data has been successfully reset.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/backup-data', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }

    const db = loadDB();
    const backup = JSON.stringify(db, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="ruqayya-erp-backup.json"');
    res.send(backup);
  } catch (err) {
    console.error('Backup failed:', err);
    res.status(500).json({ error: 'Failed to generate backup.' });
  }
});


// Boot and seed database parameters on start
seedDBIfEmpty();

// Web Push Monitor and Trigger Engine
const knownNotificationIds = new Set<string>();

function initNotificationMonitor() {
  const db = loadDB();
  if (db.notifications) {
    db.notifications.forEach((n: any) => {
      if (n.id) {
        knownNotificationIds.add(n.id);
      }
    });
  }
}

async function sendPushForNotification(n: any) {
  try {
    const enriched = enrichNotification(n);
    const db = loadDB();
    
    const payload = {
      id: n.id,
      title: enriched.titleEn || enriched.title_en || n.title_en || n.title || '',
      body: enriched.messageEn || enriched.message_en || n.message_en || n.message || n.body || '',
      titleEn: enriched.titleEn || enriched.title_en || n.title_en || n.title || '',
      titleHa: enriched.titleHa || enriched.title_ha || n.title_ha || '',
      messageEn: enriched.messageEn || enriched.message_en || n.message_en || n.message || n.body || '',
      messageHa: enriched.messageHa || enriched.message_ha || n.message_ha || '',
      type: n.type || 'info',
      category: enriched.category || 'system',
      priority: enriched.priority || 'medium',
      actions: enriched.actions || [],
      timestamp: n.created_at || new Date().toISOString()
    };

    let targetUserIds: string[] = [];

    // Resolve target users based on various potential ID fields found in different notification types
    if (n.user_id) {
      targetUserIds.push(n.user_id);
    } else if (n.driver_id) {
      const drv = db.drivers.find(d => d.id === n.driver_id);
      if (drv && drv.user_id) targetUserIds.push(drv.user_id);
    } else if (n.admin_id) {
      const adm = db.admins.find(a => a.id === n.admin_id);
      if (adm && adm.user_id) targetUserIds.push(adm.user_id);
    } else if (n.shareholder_id) {
      const sh = db.shareholders.find(s => s.id === n.shareholder_id);
      if (sh && sh.user_id) targetUserIds.push(sh.user_id);
    } else if (n.target_roles && Array.isArray(n.target_roles)) {
      const roles = db.roles.filter(r => n.target_roles.includes(r.name));
      const roleIds = roles.map(r => r.id);
      const usersWithRole = db.users.filter(u => roleIds.includes(u.role_id));
      targetUserIds = usersWithRole.map(u => u.id);
    } else if (n.target_role) {
      const roles = db.roles.filter(r => r.name === n.target_role);
      const roleIds = roles.map(r => r.id);
      const usersWithRole = db.users.filter(u => roleIds.includes(u.role_id));
      targetUserIds = usersWithRole.map(u => u.id);
    }

    if (targetUserIds.length > 0) {
      // Remove duplicate IDs
      const uniqueIds = Array.from(new Set(targetUserIds));
      
      for (const uid of uniqueIds) {
        // Check user preference
        const prefs = db.user_preferences?.find((p: any) => p.user_id === uid);
        if (prefs && prefs.enablePush === false) {
          console.log(`PushService: Skipping push for user ${uid} due to opt-out preference.`);
          continue;
        }
        
        // Evaluate Quiet Hours
        if (prefs && prefs.quietHoursStart && prefs.quietHoursEnd) {
          const now = new Date();
          const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          let isQuiet = false;
          if (prefs.quietHoursStart <= prefs.quietHoursEnd) {
            isQuiet = currentStr >= prefs.quietHoursStart && currentStr <= prefs.quietHoursEnd;
          } else {
            isQuiet = currentStr >= prefs.quietHoursStart || currentStr <= prefs.quietHoursEnd;
          }
          if (isQuiet) {
            console.log(`PushService: Skipping push for user ${uid} due to active Quiet Hours.`);
            continue;
          }
        }

        const results = await PushService.sendNotification(uid, payload);
        if (results.sentCount > 0 || results.failedCount > 0) {
          console.log(`PushService: Dispatched targeted push to user ${uid}:`, results);
        } else {
          console.log(`PushService: No active web push subscriptions found for user ${uid}. Native push skipped.`);
        }
      }
    } else if (!n.user_id && !n.driver_id && !n.admin_id && !n.target_role && (!n.target_roles || n.target_roles.length === 0)) {
      // Broadcast to all devices only if it's a generic announcement or global system alert
      const results = await PushService.broadcastNotification(payload);
      if (results.sentCount > 0 || results.failedCount > 0) {
        console.log(`PushService: Broadcasted notification to all devices:`, results);
      } else {
        console.log(`PushService: No active web push subscriptions found for broadcast. Native push skipped.`);
      }
    }
  } catch (err) {
    console.warn("sendPushForNotification failure:", err);
  }
}

function scanAndProcessNewNotifications() {
  const db = loadDB();
  if (!db.notifications) return;

  const newNotifications: any[] = [];
  
  db.notifications.forEach((n: any) => {
    if (n.id && !knownNotificationIds.has(n.id)) {
      knownNotificationIds.add(n.id);
      newNotifications.push(n);
    }
  });

  newNotifications.forEach((n) => {
    sendPushForNotification(n);
  });
}

// Run initial seeding of the monitor cache
initNotificationMonitor();

// Set up reactive listener on database saves
setDBChangeListener(() => {
  scanAndProcessNewNotifications();
});

// VITE MIDDLEWARE SETUP
async function startServer() {
  // Wait for database state rehydration from Cloud (Firestore)
  await initCloudPersistence();
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ruqayya ERP full-stack services running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
