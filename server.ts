/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { 
  loadDB, 
  saveDB, 
  seedDBIfEmpty, 
  hashPassword, 
  verifyPassword, 
  generateUUID, 
  saveR2File, 
  getR2FilePath,
  setDBChangeListener
} from './src/utils/server_db';
import { PushService } from './src/utils/PushService';

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
  saveDB(db);
}

// Authentication Middleware
function authenticateSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(412).json({ error: 'Authentication required. Active session parameters not found.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const db = loadDB();
  const session = db.sessions.find(s => s.token === token && s.status === 'active');

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
    return {
      ...d,
      fullName: user?.full_name || d.fullName || 'Candidate',
      email: user?.email || d.email || '',
      phone: user?.phone || d.phone || '',
      guarantor,
      vehicle,
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
      vouchers: db.fuel_vouchers || [],
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
    // Admins receive operational events, excluding sensitive audit logs & shareholder details (except basic list)
    return {
      ...common,
      drivers: mappedDrivers,
      vehicles: mappedVehicles,
      vouchers: db.fuel_vouchers || [],
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
      notifications: (db.notifications || []).filter((n: any) => n.user_id === shareholderId || n.target_role === 'shareholder' || (!n.user_id && !n.target_role))
    };
  } else if (role === 'driver') {
    // Drivers cannot receive other drivers' private events. They only get their own profile data, payments, etc.
    const activeDriver = mappedDrivers.find((d: any) => d.id === driverProfileId) || {};
    const driverVouchers = (db.fuel_vouchers || []).filter((v: any) => v.driver_id === driverProfileId);
    const driverPayments = (db.driver_payments || []).filter((p: any) => p.driver_id === driverProfileId);
    const driverDocuments = (db.driver_documents || []).filter((doc: any) => doc.driver_id === driverProfileId);
    const driverTrips = mappedTrips.filter((t: any) => t.driverId === driverProfileId);
    const driverNotifications = (db.notifications || []).filter((n: any) => n.user_id === activeDriver.user_id || n.target_role === 'driver' || (!n.user_id && !n.target_role));
    const driverMessages = (db.messages || []).filter((m: any) => m.sender_id === activeDriver.user_id || m.receiver_id === activeDriver.user_id);

    return {
      ...common,
      drivers: [activeDriver],
      vehicles: mappedVehicles.filter((v: any) => v.driverId === driverProfileId),
      vouchers: driverVouchers,
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

// Background automated engine for status checks, overdue alerts and progress updates
setInterval(() => {
  try {
    const db = loadDB();
    const opsState = db.company_operations_state || { status: 'Setup Mode' };
    if (opsState.status === 'Setup Mode') {
      return; // Skip automation checks in Setup Mode
    }
    let dbChanged = false;
    const now = new Date();

    // Scan for vehicle purchase contract completions
    const activeDrivers = (db.drivers || []).filter((d: any) => d.status === 'active');
    activeDrivers.forEach((drv: any) => {
      if (drv.remaining_vehicle_balance !== undefined && drv.remaining_vehicle_balance <= 0 && drv.status !== 'completed') {
        drv.status = 'completed';
        dbChanged = true;
        
        db.notifications.unshift({
          id: generateUUID(),
          user_id: drv.user_id,
          title_en: 'Vehicle Contract Completed!',
          title_ha: 'Kwangilar Mota Ta Cika!',
          message_en: 'Congratulations! Your vehicle purchase balance has been fully settled. You are now the full owner!',
          message_ha: 'Masha Allah! Kun biya duk kudin motar ku gaba daya. Yanzu ku ne mamallakin motar ku!',
          type: 'success',
          read_status: 0,
          created_at: now.toISOString()
        });
      }
    });

    // Automated rest mode tracking and recovery release
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
          title_ha: 'Lokacin Hutu Ya Cika',
          message_en: 'Your medical rest period has completed. Your status is now reverted to Active duty.',
          message_ha: 'Lokacin hutun lafiyar ku ya cika. An mayar da ku a matsayin mai aiki mai karshe.',
          type: 'info',
          read_status: 0,
          created_at: now.toISOString()
        });
      }
    });

    // Check for vehicle purchase contract completions using dynamic financials
    const activeDriversList = (db.drivers || []).filter((d: any) => d.status === 'active' || d.status === 'approved' || d.status === 'available');
    activeDriversList.forEach((drv: any) => {
      const financials = getDriverFinancials(drv, db);
      if (financials.remainingVehicleBalance <= 0 && drv.status !== 'completed') {
        drv.status = 'completed';
        dbChanged = true;
        
        db.notifications.unshift({
          id: generateUUID(),
          user_id: drv.user_id,
          title_en: 'Vehicle Contract Completed!',
          title_ha: 'Kwangilar Mota Ta Cika!',
          message_en: 'Congratulations! Your vehicle purchase balance has been fully settled. You are now the full owner!',
          message_ha: 'Masha Allah! Kun biya duk kudin motar ku gaba daya. Yanzu ku ne mamallakin motar ku!',
          type: 'success',
          read_status: 0,
          created_at: now.toISOString()
        });
      }
    });

    if (dbChanged) {
      saveDB(db);
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

// 2. PUBLIC: Driver Self-Registration Form
app.post('/api/auth/register-driver', (req, res) => {
  try {
    const { personal, guarantor, vehicle } = req.body;
    
    if (!personal || !guarantor || !vehicle) {
      return res.status(400).json({ error: 'Missing registration details. Personal, guarantor, and vehicle are required.' });
    }

    const db = loadDB();

    // Check unique constraints
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
      status: 'pending' // Pending approval workflow
    };

    // B. Create Driver Profile
    const driverId = generateUUID();
    const newDriver = {
      id: driverId,
      user_id: userId,
      company_driver_id: personal.companyDriverId || `PEND-${generateUUID().substring(0, 4).toUpperCase()}`,
      address: personal.address,
      nin: personal.nin,
      license_number: personal.licenseNumber || `LIC-${generateUUID().substring(0, 5).toUpperCase()}`,
      license_expiry: personal.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      classification: 'Assisted', // Default classification, editable by admins
      rating: 5.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'pending' // Needs approval
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
      mileage: 0,
      created_at: new Date().toISOString(),
      status: 'idle'
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
      title_en: 'New Self-Registered Driver Candidate',
      title_ha: 'Sabuwar Rijistar Direba',
      message_en: `Driver ${personal.fullName} submitted profile & vehicle ${vehicle.plateNumber}. Review required.`,
      message_ha: `Direba ${personal.fullName} ya mika bayanan motar sa ${vehicle.plateNumber}. Tana jiran amincewa.`,
      type: 'warning',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    // Server Audit Logs
    writeServerAuditLog(
      null, 
      personal.email, 
      'public', 
      'DRIVER_SELF_REGISTRATION', 
      null, 
      `Registered driver ${personal.fullName} with vehicle ${vehicle.plateNumber}`, 
      req
    );

    res.json({ success: true, message: 'Your registration was submitted successfully. Pending Admin review.' });
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
      agreed_amount: parseFloat(personal.agreedAmount) || 180000,
      vehicle_purchase_price: parseFloat(personal.vehiclePurchasePrice) || 15000000,
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
    if (actor.role !== 'director') {
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
      const trimmedUsername = username.trim().toUpperCase();

      // Route-specific username enforcement
      if (portal) {
        if (portal.startsWith('/director') && trimmedUsername !== 'MMR') {
          return res.status(401).json({ error: 'Access Denied: Only authorized Director credentials can access this secure node.' });
        }
        if (portal.startsWith('/admin') && trimmedUsername !== 'ADAM' && trimmedUsername !== 'ABAKAKA') {
          return res.status(401).json({ error: 'Access Denied: Only authorized Admin credentials can access this secure node.' });
        }
      } else {
        // General portal switcher validation
        if (trimmedUsername !== 'MMR' && trimmedUsername !== 'ADAM' && trimmedUsername !== 'ABAKAKA') {
          return res.status(401).json({ error: 'Access Denied: Unregistered enterprise username.' });
        }
      }

      // Dynamically retrieve or seed standard users with their associated usernames
      user = db.users.find(u => u.username === trimmedUsername);
      if (!user) {
        if (trimmedUsername === 'MMR') {
          user = db.users.find(u => u.role_id === 'role-director');
          if (user) {
            user.username = 'MMR';
            user.full_name = 'Director MMR Kabir';
          } else {
            const directorId = generateUUID();
            user = {
              id: directorId,
              username: 'MMR',
              email: 'director@ruqayyatransport.com',
              phone: '+234 803 111 0001',
              password_hash: hashPassword('director123'),
              full_name: 'Director MMR Kabir',
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
        } else if (trimmedUsername === 'ADAM' || trimmedUsername === 'ABAKAKA') {
          const existingAdmins = db.users.filter(u => u.role_id === 'role-admin');
          if (trimmedUsername === 'ADAM' && existingAdmins[0]) {
            user = existingAdmins[0];
            user.username = 'ADAM';
            user.full_name = 'Operator ADAM Ibrahim';
          } else if (trimmedUsername === 'ABAKAKA' && existingAdmins[1]) {
            user = existingAdmins[1];
            user.username = 'ABAKAKA';
            user.full_name = 'Operator ABAKAKA Bello';
          } else {
            const adminId = generateUUID();
            user = {
              id: adminId,
              username: trimmedUsername,
              email: `${trimmedUsername.toLowerCase()}@ruqayyatransport.com`,
              phone: '+234 803 222 0002',
              password_hash: hashPassword('admin123'),
              full_name: trimmedUsername === 'ADAM' ? 'Operator ADAM Ibrahim' : 'Operator ABAKAKA Bello',
              role_id: 'role-admin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'active'
            };
            db.users.push(user);
            db.admins.push({
              id: generateUUID(),
              user_id: adminId,
              company_id: `ADM-2026-${trimmedUsername}`,
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
      authType = 'username-only';
    } else {
      // Standard email & password login for public users (drivers, shareholders)
      if (!email || !password) {
        return res.status(400).json({ error: 'Please submit both email and password validation credentials.' });
      }

      user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
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
    const token = `tok_${generateUUID().replace(/-/g, '')}${generateUUID().substring(0, 10)}`;
    
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

    const roleName = db.roles.find(r => r.id === user.role_id)?.name || 'public';

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

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: actor.role,
      mustChangePassword: !!user.must_change_password,
      permissions,
      profile: profileDetails
    }
  });
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
    return {
      ...drv,
      fullName: user?.full_name || 'Candidate',
      email: user?.email || '',
      phone: user?.phone || '',
      guarantor,
      vehicle,
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
  if (actor.role !== 'admin' && actor.role !== 'director') {
    return res.status(403).json({ error: 'Access Denied.' });
  }

  const db = loadDB();
  const drv = db.drivers.find(d => d.id === req.params.id);
  if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

  const user = db.users.find(u => u.id === drv.user_id);
  const guarantor = db.guarantors.find(g => g.driver_id === drv.id);
  const vehicle = db.vehicles.find(v => v.driver_id === drv.id);
  const documents = db.driver_documents.filter(doc => doc.driver_id === drv.id);
  const financials = getDriverFinancials(drv, db);

  res.json({
    ...drv,
    fullName: user?.full_name || 'Candidate',
    email: user?.email || '',
    phone: user?.phone || '',
    guarantor,
    vehicle,
    documents,
    remaining_vehicle_balance: financials.remainingVehicleBalance,
    total_amount_paid: financials.totalAmountPaid,
    vehicle_purchase_price: financials.vehiclePurchasePrice,
    total_payments_made: financials.totalPaymentsMade
  });
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
      drv.company_driver_id = companyDriverId || `DRV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      
      // Update linked vehicle status
      const vehicle = db.vehicles.find(v => v.driver_id === drv.id);
      if (vehicle) {
        vehicle.status = 'assigned';
      }

      // Automatically register 350L fuel vouchers as welcome
      db.fuel_vouchers.unshift({
        id: generateUUID(),
        voucher_number: `FL-WELCOME-${Math.floor(1000 + Math.random() * 9000)}`,
        vehicle_id: vehicle ? vehicle.id : 'N/A',
        driver_id: drv.id,
        liters_requested: 350,
        estimated_cost: 507500,
        status: 'approved',
        request_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        approval_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        created_at: new Date().toISOString()
      });
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
    if (!token) {
      return res.status(403).send('Forbidden: Active token parameter required.');
    }

    const db = loadDB();
    const session = db.sessions.find(s => s.token === token && s.status === 'active');
    if (!session) {
      return res.status(401).send('Session expired or unauthorized.');
    }

    const filePath = getR2FilePath(req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Document not found inside R2 bucket.');
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
  const titleEn = n.title_en || n.titleEn || '';
  const titleHa = n.title_ha || n.titleHa || '';
  const messageEn = n.message_en || n.messageEn || '';
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
app.get('/api/notifications/vapid-public-key', authenticateSession, (req, res) => {
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
      const isForUser = (n.user_id === actor.id) || (n.target_role === actor.role) || (!n.user_id && !n.target_role);
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
      const isForUser = (n.user_id === actor.id) || (n.target_role === actor.role) || (!n.user_id && !n.target_role);
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
        'Candidate Alhaji Musa Garba completed driver self-registration. Action required: Approve credentials.': 'Alhaji Musa Garba ya kammala rajistar kansa. Ana bukatar amincewa daga Admin.',
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
      model: 'gemini-3.5-flash',
      contents: `You are a professional Hausa/English translation engine for an enterprise logistics software. Translate the following text into ${to === 'ha' ? 'Hausa' : 'English'}. Match the exact context of driver fleet remittances and financial reports. Return ONLY the translated string without quotes, explanations or conversational fillers:\n\n${text}`,
    });

    const resultText = response.text?.trim() || text;
    res.json({ success: true, translation: resultText, fallback: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
      const driverDocs = db.driver_documents.filter((doc: any) => doc.driver_id === drv.id);
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

    const { fullName, phone, email, address, investmentAmount, investmentDate, passportPhoto } = req.body;
    if (!fullName || !phone || !email || !address || !investmentAmount || !investmentDate) {
      return res.status(400).json({ error: 'All fields are mandatory.' });
    }

    const db = loadDB();
    if (db.shareholders.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email registered to another investor node.' });
    }

    let passportUrl = '';
    if (passportPhoto) {
      passportUrl = saveR2File(`shareholder_${fullName.replace(/\s+/g, '_')}`, passportPhoto);
    }

    const newShareholder = {
      id: generateUUID(),
      full_name: fullName,
      phone,
      email: email.toLowerCase(),
      address,
      passport_photo_url: passportUrl,
      investment_amount: parseFloat(investmentAmount) || 0.0,
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
      amount: parseFloat(investmentAmount),
      date: investmentDate,
      description: `Corporate equity capital investment - Shareholder ${fullName}`
    });

    // Create user account if not exists for the shareholder
    let targetUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
      const { password, mustChangePassword } = req.body;
      const hashed = hashPassword(password || 'shareholder123');
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
    }

    // Notify shareholder of capital contribution
    db.notifications.unshift({
      id: generateUUID(),
      user_id: targetUser ? targetUser.id : undefined,
      target_role: 'shareholder',
      title_en: 'Capital Contribution Registered',
      title_ha: 'An Yi Rijistar Gudunmawar Kudi',
      message_en: `Equity investment of ₦${parseFloat(investmentAmount).toLocaleString()} has been confirmed for ${fullName}.`,
      message_ha: `An tabbatar da jarin kudi na karkashin sunan ${fullName} na naira ₦${parseFloat(investmentAmount).toLocaleString()}.`,
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
      `Registered investor: ${fullName} | Investment: ₦${parseFloat(investmentAmount).toLocaleString()}`,
      req
    );

    res.json({ success: true, message: 'Shareholder logged successfully.' });
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

    const { type, category, amount, date, description } = req.body;
    if (!type || !category || !amount || !date || !description) {
      return res.status(400).json({ error: 'Missing parameters.' });
    }

    const db = loadDB();
    const newRecord = {
      id: generateUUID(),
      type,
      category,
      amount: parseFloat(amount),
      date,
      description,
      approvedBy: actor.fullName,
      created_at: new Date().toISOString()
    };

    db.financial_records.unshift(newRecord);
    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'LEDGER_POST',
      null,
      `Posted ₦${parseFloat(amount).toLocaleString()} (${type} -> ${category})`,
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

// 18. AUTHENTICATED: Get/Create Fuel Vouchers
app.get('/api/vouchers', authenticateSession, (req, res) => {
  const db = loadDB();
  res.json(db.fuel_vouchers);
});

app.post('/api/vouchers', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    const db = loadDB();
    const opsState = db.company_operations_state || { status: 'Setup Mode' };
    if (opsState.status === 'Setup Mode') {
      return res.status(400).json({ error: 'Company is currently in Setup Mode. Financial operations are disabled until operations officially start.' });
    }
    const { vehicleId, litersRequested, estimatedCost } = req.body;

    if (!vehicleId || !litersRequested || !estimatedCost) {
      return res.status(400).json({ error: 'Missing voucher payload parameters.' });
    }

    const newVoucher = {
      id: generateUUID(),
      voucher_number: `FL-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicle_id: vehicleId,
      driver_id: actor.id,
      liters_requested: parseFloat(litersRequested),
      estimated_cost: parseFloat(estimatedCost),
      status: 'pending',
      request_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      created_at: new Date().toISOString()
    };

    db.fuel_vouchers.unshift(newVoucher);
    db.notifications.unshift({
      id: generateUUID(),
      title_en: 'New Fuel Voucher Request Raised',
      title_ha: 'Sabuwar Bukatar Takardar Mai',
      message_en: `Driver ${actor.fullName} submitted a voucher request for ${litersRequested} Liters.`,
      message_ha: `Direba ${actor.fullName} ya nemi takardar mai lita ${litersRequested}.`,
      type: 'warning',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'FUEL_VOUCHER_REQUEST',
      null,
      `Driver requested ${litersRequested}L (₦${parseFloat(estimatedCost).toLocaleString()})`,
      req
    );

    res.json({ success: true, voucher: newVoucher });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vouchers/:id/approve', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const voucher = db.fuel_vouchers.find(v => v.id === req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found.' });

    if (voucher.status !== 'pending') {
      return res.status(400).json({ error: 'Voucher has already been reviewed.' });
    }

    voucher.status = 'approved';
    voucher.approval_date = new Date().toISOString().replace('T', ' ').substring(0, 16);
    voucher.updated_at = new Date().toISOString();
    voucher.updated_by = actor.fullName;

    const targetDriver = db.drivers.find(d => d.id === voucher.driver_id);

    // Post to financial ledger as fuel expense
    db.financial_records.unshift({
      id: generateUUID(),
      type: 'expense',
      category: 'fuel',
      amount: voucher.estimated_cost,
      date: new Date().toISOString().split('T')[0],
      description: `Fuel disbursement - Voucher ${voucher.voucher_number}`,
      approvedBy: actor.fullName
    });

    // Notify Driver
    db.notifications.unshift({
      id: generateUUID(),
      user_id: targetDriver ? targetDriver.user_id : voucher.driver_id,
      title_en: 'Fuel Voucher Approved',
      title_ha: 'An Amince Da Takardar Mai',
      message_en: `Your voucher ${voucher.voucher_number} for ${voucher.liters_requested}L (Est. Cost: ₦${(voucher.estimated_cost || 0).toLocaleString()}) has been approved at ${voucher.station_name || 'the designated station'}.`,
      message_ha: `An amince da takardar mai ${voucher.voucher_number} na lita ${voucher.liters_requested} (Kudi: ₦${(voucher.estimated_cost || 0).toLocaleString()}) a gidan mai na ${voucher.station_name || 'da aka ayyana'}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'FUEL_VOUCHER_APPROVAL',
      'pending',
      `Approved voucher ${voucher.voucher_number} of ₦${voucher.estimated_cost.toLocaleString()}`,
      req
    );

    res.json({ success: true });
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

export function getDriverFinancials(driver: any, db: any) {
  const purchasePrice = parseFloat(driver.vehicle_purchase_price) || 15000000;
  const agreedAmount = parseFloat(driver.agreed_amount) || 180000;
  
  if (driver.opening_balance && driver.opening_balance.is_imported) {
    const openingRemaining = parseFloat(driver.opening_balance.remaining_vehicle_balance) || 0;
    const openingPaid = parseFloat(driver.opening_balance.total_paid_to_date) || 0;
    
    // Sum of all approved payments in ERP
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
    // New Driver
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

export function calculateInstallmentsForDriver(driver: any, db: any, activeCycle: any) {
  const agreedAmount = driver.agreed_amount || 180000;
  const installmentTarget = Math.round(agreedAmount / 6);
  
  // Find all approved payments for this driver during the active cycle
  let startDate = activeCycle ? new Date(activeCycle.startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  let endDate = activeCycle && activeCycle.endDate ? new Date(activeCycle.endDate) : new Date();
  
  const payments = (db.driver_payments || []).filter((p: any) => {
    return p.driver_id === driver.id && p.status === 'approved' &&
      new Date(p.date) >= startDate &&
      (activeCycle && activeCycle.endDate ? new Date(p.date) <= endDate : true);
  });

  // Calculate total rest days during this active cycle to extend installments
  let totalRestDays = 0;
  const restHistory = driver.restHistory || [];
  if (activeCycle) {
    restHistory.forEach((rest: any) => {
      const restStart = new Date(rest.startDate);
      const restEnd = new Date(rest.endDate);
      const cycleStart = new Date(activeCycle.startDate);
      
      // If rest period overlaps with cycle
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

  // Check if driver is currently on rest
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

    // Shift dates by rest days
    const normalEndDate = new Date(startDate.getTime() + (endDay - 1) * 24 * 3600 * 1000);
    const extendedEndDate = new Date(normalEndDate.getTime() + totalRestDays * 24 * 3600 * 1000);
    
    const normalStartDate = new Date(startDate.getTime() + (startDay - 1) * 24 * 3600 * 1000);
    const extendedStartDate = new Date(normalStartDate.getTime() + totalRestDays * 24 * 3600 * 1000);

    const dueAmount = installmentTarget + carryForward;
    const paidAmount = payments
      .filter((p: any) => p.installment_number === k)
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const remaining = dueAmount - paidAmount;
    carryForward = remaining; // outstanding balance carries forward to the next installment

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
      startDate: extendedStartDate.toISOString().split('T')[0],
      endDate: extendedEndDate.toISOString().split('T')[0],
      targetAmount: installmentTarget,
      carriedForward: dueAmount - installmentTarget,
      totalDue: dueAmount,
      totalPaid: paidAmount,
      remainingBalance: remaining,
      status
    });
  }

  return installments;
}

// GET dynamic driver installments list
app.get('/api/drivers/:id/installments', authenticateSession, (req, res) => {
  try {
    const db = loadDB();
    const opsState = db.company_operations_state || { status: 'Setup Mode' };
    if (opsState.status === 'Setup Mode') {
      return res.json({ success: true, installments: [] });
    }
    const driver = db.drivers.find(d => d.id === req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver profile not found.' });
    const activeCycle = db.cycles.find(c => c.status === 'active') || db.cycles[0];
    const installments = calculateInstallmentsForDriver(driver, db, activeCycle);
    res.json({ success: true, installments });
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


// ==================================================
// 22. AUTHENTICATED: EXECUTIVE DIRECTOR CONTROLS & MANAGEMENT
// ==================================================

// Start New 30-Day Operation Cycle
app.post('/api/director/cycles/start', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied. Executive Director clearance required.' });
    }

    const { startDate, endGoalTons } = req.body;
    if (!startDate) {
      return res.status(400).json({ error: 'Start date parameter is mandatory.' });
    }

    const db = loadDB();
    const activeCycle = db.cycles.find(c => c.status === 'active');
    if (activeCycle) {
      return res.status(400).json({ error: 'An active operating cycle is already running. Complete and lock it first.' });
    }

    const cycleId = `CYC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCycle = {
      id: cycleId,
      startDate,
      endDate: null,
      endGoalTons: parseFloat(endGoalTons) || 200,
      status: 'active',
      created_at: new Date().toISOString(),
      created_by: actor.fullName,
      locked: false,
      financials: []
    };

    db.cycles.push(newCycle);

    // Notify all devices of cycle commencement
    db.notifications.unshift({
      id: generateUUID(),
      title_en: 'New Company Cycle Commenced',
      title_ha: 'An Fara Sabon Zagayen Sufuri',
      message_en: `30-Day Operation Cycle ${cycleId} started on ${startDate}. Goal set to ${newCycle.endGoalTons} Tons.`,
      message_ha: `An fara zagayen aiki na kwanaki 30 ${cycleId} a ranar ${startDate}. Burin nauyi: lita/Tons ${newCycle.endGoalTons}.`,
      type: 'success',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'CYCLE_START',
      null,
      `Started new 30-day operating cycle: ${cycleId}`,
      req
    );

    res.json({ success: true, cycle: newCycle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// End and Permanently Archive Current Cycle
app.post('/api/director/cycles/end', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied. Executive Director clearance required.' });
    }

    const { endDate } = req.body;
    if (!endDate) {
      return res.status(400).json({ error: 'End date parameter is mandatory.' });
    }

    const db = loadDB();
    const activeCycleIndex = db.cycles.findIndex(c => c.status === 'active');
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
        agreedAmount: d.agreed_amount || 180000,
        paymentsDuringCycle: collected,
        expensesApplied,
        openingVehicleBalance,
        closingVehicleBalance,
        outstandingBalance: Math.max(0, (d.agreed_amount || 180000) - collected),
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
        remainingVehicleBalance: assignedDriver ? (assignedDriver.remaining_vehicle_balance || 15000000) : 15000000
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

    // Notify of cycle completion
    db.notifications.unshift({
      id: generateUUID(),
      title_en: 'Operating Cycle Completed & Locked',
      title_ha: 'An Kammala Kuma An Rufe Zagayen Sufuri',
      message_en: `Operation Cycle ${closedCycle.id} has ended. Net profit: ₦${netGeneratedAmount.toLocaleString()}. Shareholder pool: ₦${distributionPool.toLocaleString()}.`,
      message_ha: `Zagayen aiki ${closedCycle.id} ya kare. Ribar kudi: ₦${netGeneratedAmount.toLocaleString()}. Kudin Masu Hannun Jari: ₦${distributionPool.toLocaleString()}.`,
      type: 'info',
      read_status: 0,
      created_at: new Date().toISOString()
    });

    saveDB(db);

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

// Update Shareholder Settings (Rabon Jari Percentage)
app.put('/api/director/shareholder-settings', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied. Executive Director clearance required.' });
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
    if (actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied. Executive Director clearance required.' });
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
app.post('/api/operations/start', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Only Administrators can start operations.' });
    }

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
      return res.status(400).json({
        error: 'Operations starting blocked: Company setup requirements are incomplete.',
        missing
      });
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
      const cycleId = `CYC-${Math.floor(100 + Math.random() * 900)}`;
      db.cycles.unshift({
        id: cycleId,
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
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

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_OPERATIONS_START',
      'Setup Mode',
      `Activated live enterprise operations. First 30-day operating cycle commenced by ${actor.fullName}`,
      req
    );

    res.json({ success: true, message: 'Company operations successfully started!', state: updatedState });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST pause company operations
app.post('/api/operations/pause', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Only Administrators can pause operations.' });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason for suspension is mandatory.' });
    }

    const db = loadDB();
    const state = db.company_operations_state || { status: 'Setup Mode', pauseHistory: [], auditLog: [] };

    if (state.status !== 'Operational Mode') {
      return res.status(400).json({ error: 'Operations can only be paused from Operational Mode.' });
    }

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

    db.company_operations_state = state;
    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_OPERATIONS_PAUSE',
      'Operational Mode',
      `Suspended company operations: ${reason}`,
      req
    );

    res.json({ success: true, message: 'Company operations paused.', state });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST resume company operations
app.post('/api/operations/resume', authenticateSession, (req, res) => {
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

    db.company_operations_state = state;
    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'COMPANY_OPERATIONS_RESUME',
      'Paused',
      `Resumed company operations: ${reason || 'Manual resumption'}`,
      req
    );

    res.json({ success: true, message: 'Company operations resumed.', state });
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
    if (actor.role !== 'director') {
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
    if (actor.role !== 'director') {
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
    if (actor.role !== 'director') {
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
    if (actor.role !== 'director') {
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
    if (actor.role !== 'director') {
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
    if (actor.role !== 'director') {
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
    if (actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
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
    if (actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
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
    if (opsState.status === 'Setup Mode') {
      return res.status(400).json({ error: 'Company is currently in Setup Mode. Financial operations are disabled until operations officially start.' });
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

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment has already been reviewed.' });
    }

    payment.status = status;
    payment.remarks = remarks || payment.remarks;
    payment.approved_by = actor.fullName;
    payment.updated_at = new Date().toISOString();

    const drv = db.drivers.find(d => d.id === payment.driver_id);

    if (status === 'approved') {
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

// Edit Driver Profile Complete (Admin/Director can edit complete driver profile details)
app.put('/api/drivers/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const db = loadDB();
    const drv = db.drivers.find(d => d.id === req.params.id);
    if (!drv) return res.status(404).json({ error: 'Driver profile not found.' });

    const { fullName, phone, address, nin, licenseNumber, licenseExpiry, agreedAmount, remainingVehicleBalance, status, passportPhoto } = req.body;
    
    const user = db.users.find(u => u.id === drv.user_id);
    const prevDrvVal = JSON.stringify(drv);

    if (passportPhoto) {
      const fileUrl = saveR2File(`driver_${drv.id}_passport`, passportPhoto);
      (drv as any).passport_photo_url = fileUrl;
      
      // Update or insert in driver_documents
      if (!db.driver_documents) db.driver_documents = [];
      const existingDoc = db.driver_documents.find(d => d.driver_id === drv.id && d.document_type === 'passport_photo');
      if (existingDoc) {
        existingDoc.file_url = fileUrl;
        existingDoc.created_at = new Date().toISOString();
        existingDoc.created_by = actor.fullName;
      } else {
        db.driver_documents.push({
          id: generateUUID(),
          driver_id: drv.id,
          document_type: 'passport_photo',
          file_url: fileUrl,
          created_at: new Date().toISOString(),
          created_by: actor.fullName,
          status: 'active'
        });
      }
    }

    if (user) {
      if (fullName) user.full_name = fullName;
      if (phone) user.phone = phone;
    }
    if (address !== undefined) drv.address = address;
    if (nin !== undefined) drv.nin = nin;
    if (licenseNumber !== undefined) drv.license_number = licenseNumber;
    if (licenseExpiry !== undefined) drv.license_expiry = licenseExpiry;
    if (agreedAmount !== undefined) drv.agreed_amount = parseFloat(agreedAmount);
    if (remainingVehicleBalance !== undefined) drv.remaining_vehicle_balance = parseFloat(remainingVehicleBalance);
    
    if (status) {
      drv.status = status;
      if (user) {
        user.status = status === 'approved' || status === 'available' ? 'active' : status;
      }
    }

    drv.updated_at = new Date().toISOString();
    drv.updated_by = actor.fullName;

    saveDB(db);

    writeServerAuditLog(
      actor.id,
      actor.email,
      actor.role,
      'DRIVER_PROFILE_EDIT',
      prevDrvVal,
      JSON.stringify(drv),
      req
    );

    res.json({ success: true, driver: drv });
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

    const { phone, email, address, password } = req.body;
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

    const activeCycle = db.cycles.find(c => c.status === 'active');
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

    // If driver linked and category is 'maintenance' or 'accident', update their specific records if helpful
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
      }
    }

    // Register notification for live feedback
    db.notifications.unshift({
      id: generateUUID(),
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
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }
    const { shareholderId, amount, remarks } = req.body;
    if (!shareholderId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount or shareholder ID.' });
    }

    const db = loadDB();
    const sh = db.shareholders.find((s: any) => s.id === shareholderId);
    if (!sh) return res.status(404).json({ error: 'Shareholder not found.' });

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
      return res.status(400).json({ error: `Over-withdrawal prevented. Maximum available: ₦${availableWithdrawal.toLocaleString()}` });
    }

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
      approvedBy: actor.fullName,
      created_at: new Date().toISOString()
    });

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
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }
    const { shareholderId, amount } = req.body;
    if (!shareholderId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid reinvestment amount or shareholder ID.' });
    }

    const db = loadDB();
    const sh = db.shareholders.find((s: any) => s.id === shareholderId);
    if (!sh) return res.status(404).json({ error: 'Shareholder not found.' });

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
      return res.status(400).json({ error: `Over-reinvestment prevented. Maximum available: ₦${availableWithdrawal.toLocaleString()}` });
    }

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
      approvedBy: actor.fullName,
      created_at: new Date().toISOString()
    });
    
    db.financial_records.unshift({
      id: `FIN-REINV-EXP-${Date.now()}-${generateUUID().substring(0,4).toUpperCase()}`,
      type: 'expense',
      category: 'other',
      amount: reinvestAmt,
      date: new Date().toISOString().split('T')[0],
      description: `Shareholder Reinvestment Debit - ${sh.full_name} (Transfer to capital stock)`,
      approvedBy: actor.fullName,
      created_at: new Date().toISOString()
    });

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

// AUTOMATED PAYROLL MANAGEMENT
app.post('/api/finance/payroll', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'admin' && actor.role !== 'director') {
      return res.status(403).json({ error: 'Access Denied: Admin or Director role required.' });
    }
    const db = loadDB();
    const activeVehiclesCount = db.vehicles.filter((v: any) => v.status === 'active' || v.status === 'assigned' || v.status === 'idle').length || db.vehicles.length || 5;
    
    const barristerSal = activeVehiclesCount * 1000;
    const managerSal = activeVehiclesCount * 1000;
    const hegelSal = activeVehiclesCount * 500;
    const adamSal = activeVehiclesCount * 1000;
    const abakakaSal = activeVehiclesCount * 1000;
    const totalPayroll = barristerSal + managerSal + hegelSal + adamSal + abakakaSal;

    const totalRev = (db.financial_records || []).filter((f: any) => f.type === 'revenue').reduce((sum: number, f: any) => sum + f.amount, 0);
    const totalExp = (db.financial_records || []).filter((f: any) => f.type === 'expense').reduce((sum: number, f: any) => sum + f.amount, 0);
    const walletBalance = totalRev - totalExp;

    if (walletBalance < totalPayroll) {
      return res.status(400).json({ error: `Insufficient funds in company wallet to process payroll. Required: ₦${totalPayroll.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}` });
    }

    const entries = [
      { name: 'Barrister', amount: barristerSal },
      { name: 'Manager', amount: managerSal },
      { name: 'Hegel', amount: hegelSal },
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
        description: `Payroll Disbursal for ${entry.name} based on ${activeVehiclesCount} active tricycles`,
        approvedBy: actor.fullName,
        created_at: new Date().toISOString()
      });
    });

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
      title: enriched.titleEn || enriched.title_en || n.title_en || '',
      body: enriched.messageEn || enriched.message_en || n.message_en || '',
      titleEn: enriched.titleEn || enriched.title_en || n.title_en || '',
      titleHa: enriched.titleHa || enriched.title_ha || n.title_ha || '',
      messageEn: enriched.messageEn || enriched.message_en || n.message_en || '',
      messageHa: enriched.messageHa || enriched.message_ha || n.message_ha || '',
      type: n.type || 'info',
      category: enriched.category || 'system',
      priority: enriched.priority || 'medium',
      actions: enriched.actions || [],
      timestamp: n.created_at || new Date().toISOString()
    };

    if (n.user_id) {
      // Check user preference
      const prefs = db.user_preferences?.find((p: any) => p.user_id === n.user_id);
      if (prefs && prefs.enablePush === false) {
        console.log(`PushService: Skipping push for user ${n.user_id} due to opt-out preference.`);
        return;
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
          console.log(`PushService: Skipping push for user ${n.user_id} due to active Quiet Hours.`);
          return;
        }
      }

      const results = await PushService.sendNotification(n.user_id, payload);
      console.log(`PushService: Dispatched to user ${n.user_id}:`, results);
    } else {
      // Broadcast to all devices
      const results = await PushService.broadcastNotification(payload);
      console.log(`PushService: Broadcasted notification to all devices:`, results);
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
