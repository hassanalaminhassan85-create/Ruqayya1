import { WorkersAIService } from '../../src/utils/ai_service';

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

function calculateInstallmentsForDriver(driver: any, db: any, activeCycle: any) {
  const agreedAmount = driver.agreed_amount || 180000;
  const installmentTarget = Math.round(agreedAmount / 6);
  
  let startDate = activeCycle ? new Date(activeCycle.startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
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
    return {
      ...common,
      company_settings: db.company_settings || {},
      announcements: db.announcements || []
    };
  }
}

// Database Manager Class with D1 persistent storage & memory fallback
class D1Manager {
  private env: Env;
  private memoryDb: any = null;

  constructor(env: Env) {
    this.env = env;
  }

  private getD1(): any {
    if (this.env.DB && typeof this.env.DB.prepare === 'function') {
      return this.env.DB;
    }
    if (this.env.ruqayya && typeof this.env.ruqayya.prepare === 'function') {
      return this.env.ruqayya;
    }
    return null;
  }

  async getDB(): Promise<any> {
    const d1 = this.getD1();
    if (d1) {
      await d1.prepare(`
        CREATE TABLE IF NOT EXISTS collections (
          name TEXT PRIMARY KEY,
          data TEXT
        )
      `).run();

      const dbResponse = await d1.prepare("SELECT name, data FROM collections").all();
      const results = dbResponse?.results || (Array.isArray(dbResponse) ? dbResponse : null);
      if (results && results.length > 0) {
        const state: any = {};
        for (const row of results) {
          state[row.name] = JSON.parse(row.data);
        }
        return await this.ensureDefaults(state);
      } else {
        const seedState = await this.ensureDefaults({});
        await this.saveDB(seedState);
        return seedState;
      }
    } else {
      if (!this.memoryDb) {
        this.memoryDb = await this.ensureDefaults({});
      }
      return this.memoryDb;
    }
  }

  async saveDB(state: any): Promise<void> {
    const d1 = this.getD1();
    if (d1) {
      const statements = [];
      for (const [key, val] of Object.entries(state)) {
        statements.push(
          d1.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
            .bind(key, JSON.stringify(val))
        );
      }
      if (statements.length > 0) {
        await d1.batch(statements);
      }
    } else {
      this.memoryDb = state;
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

      parsed.fuel_vouchers = [];
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
    if (!parsed.fuel_vouchers) { parsed.fuel_vouchers = []; changed = true; }
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

// Helper to send a single push notification
async function sendPushNotification(
  env: Env,
  subscription: any,
  payload: string
): Promise<{ success: boolean; expired?: boolean }> {
  const publicKey = env.VAPID_PUBLIC_KEY || 'BITZn5RUFNAiDT00zIT7QnCn-BzrOb1F1YT2dxnglz29nJ_ueg_G6VlaXfRGofieR2dSOJRNsWYF7aGYjorYfXg';
  const privateKey = env.VAPID_PRIVATE_KEY || 'vPMa7vScOargYGEdGvVFoFiQpIVZxPh4hhkUV4pt5Gk';

  try {
    const webpush = await import('web-push').then(m => m.default || m);
    webpush.setVapidDetails(
      'mailto:hassanalaminhassan85@gmail.com',
      publicKey,
      privateKey
    );

    await webpush.sendNotification(subscription, payload);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending push notification via web-push:", error);
    if (error && (error.statusCode === 410 || error.statusCode === 404)) {
      return { success: false, expired: true };
    }
    return { success: false };
  }
}

// Helper to broadcast push notifications to users or roles based on subscriptions in KV
async function sendPushNotificationToUserOrRole(
  env: Env,
  target: { userId?: string; role?: string; all?: boolean },
  notification: { title: string; message: string; type?: string }
) {
  if (!env.PUSH_SUBSCRIPTIONS) {
    console.log("No PUSH_SUBSCRIPTIONS KV namespace bound. Skipping push notification.");
    return;
  }

  let keys: any[] = [];
  try {
    const listResult = await env.PUSH_SUBSCRIPTIONS.list();
    keys = listResult.keys || [];
  } catch (err) {
    console.error("Failed to list push subscriptions from KV:", err);
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    type: notification.type || 'info',
    timestamp: Date.now()
  });

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
      try {
        const subscriptionJson = await env.PUSH_SUBSCRIPTIONS.get(keyInfo.name);
        if (subscriptionJson) {
          const subscription = JSON.parse(subscriptionJson);
          const pushRes = await sendPushNotification(env, subscription, payload);
          if (pushRes && !pushRes.success && pushRes.expired) {
            // Subscription has expired, delete it from KV
            await env.PUSH_SUBSCRIPTIONS.delete(keyInfo.name);
            console.log(`Deleted expired subscription key: ${keyInfo.name}`);
          }
        }
      } catch (err) {
        console.error(`Error processing subscription for key ${keyInfo.name}:`, err);
      }
    }
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

  // Helper to check authentication with stateless/ephemeral session rehydration matching server.ts
  const authenticate = async () => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return { authenticated: false, error: 'Authentication required. Active session parameters not found.', status: 412 };
    }

    const token = authHeader.replace('Bearer ', '').trim();
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
                password_hash: await hashPassword('director123'),
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
                password_hash: await hashPassword('admin123'),
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
                password_hash: await hashPassword('shareholder123'),
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
                password_hash: await hashPassword('driver123'),
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
            user_ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1',
            user_agent: request.headers.get('user-agent') || 'Corporate API Consumer',
            created_at: new Date().toISOString(),
            status: 'active'
          };
          db.sessions.push(session);
          await dbManager.saveDB(db);
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

  // PUBLIC: VAPID Public Key Retrieval
  if (path === '/api/notifications/vapid-public-key' && method === 'GET') {
    const publicKey = env.VAPID_PUBLIC_KEY || 'BITZn5RUFNAiDT00zIT7QnCn-BzrOb1F1YT2dxnglz29nJ_ueg_G6VlaXfRGofieR2dSOJRNsWYF7aGYjorYfXg';
    return buildResponse({ publicKey });
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

      if (env.PUSH_SUBSCRIPTIONS) {
        const kvKey = `sub:${userId}:${encodeURIComponent(subscription.endpoint)}`;
        await env.PUSH_SUBSCRIPTIONS.put(kvKey, JSON.stringify(subscription));
        return buildResponse({ success: true, message: 'Push subscription stored successfully.' });
      } else {
        console.warn("PUSH_SUBSCRIPTIONS KV binding is missing.");
        return buildResponse({ 
          success: true, 
          message: 'KV binding not configured, but payload parsed successfully (sandbox-mode).' 
        });
      }
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
          const buffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
          await env.R2_BUCKET.put(`${fileId}.png`, buffer, { httpMetadata: { contentType: 'image/png' } });
        }
      }

      if (guarantor.passport) {
        const fileId = `${Date.now()}-${generateUUID().substring(0, 8)}`;
        guarantorPassportUrl = `/api/documents/preview/${fileId}.png`;
        if (env.R2_BUCKET) {
          const cleanBase64 = guarantor.passport.replace(/^data:.*?;base64,/, '');
          const buffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
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
      const { email, password, rememberMe } = await request.json() as any;
      if (!email || !password) {
        return buildResponse({ error: 'Please enter both corporate email and security password.' }, 400);
      }

      const user = db.users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase() && u.status === 'active');
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

      const durationHours = rememberMe ? 24 * 30 : 2;
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const token = `tok_${generateUUID().replace(/-/g, '')}${generateUUID().substring(0, 10)}`;

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
      const roleName = db.roles.find((r: any) => r.id === user.role_id)?.name || 'public';
      
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
      const token = `tok_${generateUUID().replace(/-/g, '')}${generateUUID().substring(0, 10)}`;

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
        profileDetails = {
          driverId: dr.id,
          companyDriverId: dr.company_driver_id,
          address: dr.address,
          nin: dr.nin,
          licenseNumber: dr.license_number,
          licenseExpiry: dr.license_expiry,
          classification: dr.classification,
          rating: dr.rating,
          status: dr.status,
          guarantor,
          vehicle,
          financials
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
        profileDetails
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
    if (user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Director role required for audit trails.' }, 403);
    }
    return buildResponse(db.audit_logs || []);
  }

  // 8. DRIVERS ENDPOINTS
  if (path.startsWith('/api/drivers')) {
    const parts = path.replace(/^\/api\/drivers/, '').split('/').filter(Boolean);
    
    // GET /api/drivers (List drivers)
    if (parts.length === 0 && method === 'GET') {
      const searchParam = url.searchParams.get('search')?.toLowerCase() || '';
      let list = db.drivers || [];

      if (user.role === 'driver') {
        list = list.filter((d: any) => d.user_id === user.id);
      }

      const results = list.map((drv: any) => {
        const u = db.users.find((userObj: any) => userObj.id === drv.user_id) || {};
        const g = db.guarantors.find((gua: any) => gua.driver_id === drv.id) || null;
        const v = db.vehicles.find((veh: any) => veh.driver_id === drv.id) || null;
        const financials = getDriverFinancials(drv, db);
        const documents = (db.driver_documents || []).filter((doc: any) => doc.driver_id === drv.id);
        const passportDoc = documents.find((doc: any) => doc.document_type === 'passport_photo');
        const passport_photo_url = passportDoc ? passportDoc.file_url : '';

        return {
          ...drv,
          fullName: u.full_name || drv.fullName || '',
          email: u.email || '',
          phone: u.phone || drv.phone || '',
          guarantor: g,
          vehicle: v,
          financials,
          documents,
          passport_photo_url,
          passportPhoto: passport_photo_url,
          passportPhotoUrl: passport_photo_url
        };
      });

      if (searchParam) {
        return buildResponse(results.filter((drv: any) => 
          drv.fullName.toLowerCase().includes(searchParam) ||
          drv.company_driver_id.toLowerCase().includes(searchParam) ||
          drv.nin.includes(searchParam)
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
        const documents = (db.driver_documents || []).filter((doc: any) => doc.driver_id === drv.id);
        const passportDoc = documents.find((doc: any) => doc.document_type === 'passport_photo');
        const passport_photo_url = passportDoc ? passportDoc.file_url : '';

        return buildResponse({
          ...drv,
          fullName: u.full_name || '',
          email: u.email || '',
          phone: u.phone || '',
          guarantor: g,
          vehicle: v,
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
      const fileUrl = `/api/documents/preview/${fileId}.png`;

      if (env.R2_BUCKET) {
        const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
        const buffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        await env.R2_BUCKET.put(`${fileId}.png`, buffer, { httpMetadata: { contentType: 'image/png' } });
      }

      if (vehicleId) {
        db.vehicle_documents.push({
          id: generateUUID(),
          vehicle_id: vehicleId,
          document_type: docType,
          file_url: fileUrl,
          created_at: new Date().toISOString(),
          created_by: user.fullName,
          status: 'active'
        });
      } else if (driverId) {
        db.driver_documents.push({
          id: generateUUID(),
          driver_id: driverId,
          document_type: docType,
          file_url: fileUrl,
          created_at: new Date().toISOString(),
          created_by: user.fullName,
          status: 'active'
        });
      } else {
        db.company_documents.push({
          id: generateUUID(),
          title,
          document_type: docType,
          file_url: fileUrl,
          created_at: new Date().toISOString(),
          created_by: user.fullName,
          status: 'active'
        });
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
    
    // Check token authentication parameter
    const tokenParam = url.searchParams.get('token');
    const authSession = db.sessions.find((s: any) => s.token === tokenParam && s.status === 'active');
    
    if (!tokenParam || !authSession) {
      return new Response('Unauthorized file request.', { status: 401 });
    }

    if (env.R2_BUCKET) {
      const object = await env.R2_BUCKET.get(filename);
      if (!object) {
        return new Response('File not found in storage bucket.', {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*'
          }
        });
      }
      const fileData = await object.arrayBuffer();
      return new Response(fileData, {
        headers: {
          'Content-Type': filename.endsWith('.pdf') ? 'application/pdf' : 'image/png',
          'Cache-Control': 'max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*'
        }
      });
    } else {
      // Memory mock empty image for safety if no R2 bound
      const mockPixel = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 108, 11, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 96, 64, 0, 0, 0, 2, 0, 1, 73, 175, 168, 116, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
      return new Response(mockPixel, {
        headers: {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*'
        }
      });
    }
  }

  // 13. NOTIFICATIONS ENDPOINTS
  if (path === '/api/notifications' && method === 'GET') {
    let list = db.notifications || [];
    if (user.role === 'driver') {
      const activeDriver = db.drivers.find((d: any) => d.user_id === user.id);
      list = list.filter((n: any) => n.user_id === user.id || n.target_role === 'driver' || (!n.user_id && !n.target_role));
    } else if (user.role === 'shareholder') {
      list = list.filter((n: any) => n.user_id === user.id || n.target_role === 'shareholder' || (!n.user_id && !n.target_role));
    }
    return buildResponse(list);
  }

  if (path === '/api/notifications/read' && method === 'POST') {
    const list = db.notifications || [];
    list.forEach((n: any) => {
      if (user.role === 'driver') {
        if (n.user_id === user.id) n.read_status = 1;
      } else {
        n.read_status = 1;
      }
    });
    await dbManager.saveDB(db);
    return buildResponse({ success: true });
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

    if (path === '/api/ai/chat') {
      const { prompt: reqPrompt, history = [], page = '', feature = '' } = body;
      if (!reqPrompt) return buildResponse({ error: 'Prompt is required.' }, 400);
      prompt = reqPrompt;
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

    if (parts[0] === 'me' && method === 'GET') {
      const sh = db.shareholders.find((s: any) => s.user_id === user.id);
      if (!sh) return buildResponse({ error: 'Shareholder profile missing.' }, 404);
      return buildResponse(sh);
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
          if (payload.address) sh.address = payload.address;
          if (payload.investment_amount !== undefined) sh.investment_amount = parseFloat(payload.investment_amount);

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

  // 15. FUEL VOUCHERS ENDPOINTS
  if (path.startsWith('/api/vouchers')) {
    const parts = path.replace(/^\/api\/vouchers/, '').split('/').filter(Boolean);

    if (parts.length === 0) {
      if (method === 'GET') {
        return buildResponse(db.fuel_vouchers || []);
      }
      if (method === 'POST') {
        try {
          const { vehicleId, litersRequested, estimatedCost } = await request.json() as any;
          const activeDriver = db.drivers.find((d: any) => d.user_id === user.id);
          
          const newVoucher = {
            id: generateUUID(),
            voucher_number: `FL-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            vehicle_id: vehicleId,
            driver_id: activeDriver ? activeDriver.id : null,
            liters_requested: parseFloat(litersRequested),
            estimated_cost: parseFloat(estimatedCost),
            status: 'pending',
            request_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            created_at: new Date().toISOString()
          };

          db.fuel_vouchers.push(newVoucher);
          writeAuditLog(user.id, user.email, user.role, 'FUEL_VOUCHER_REQUESTED', null, `Voucher fuel liters requested: ${litersRequested}`, db);
          await dbManager.saveDB(db);

          return buildResponse(newVoucher);
        } catch (err: any) {
          return buildResponse({ error: err.message }, 500);
        }
      }
    }

    if (parts.length === 2 && parts[1] === 'approve' && method === 'PUT') {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      try {
        const vouch = db.fuel_vouchers.find((v: any) => v.id === parts[0]);
        if (!vouch) return buildResponse({ error: 'Fuel voucher not found.' }, 404);

        vouch.status = 'approved';
        vouch.approval_date = new Date().toISOString().replace('T', ' ').substring(0, 16);

        // Record direct corporate maintenance expense automatically
        db.financial_records.push({
          id: generateUUID(),
          type: 'expense',
          category: 'fuel',
          amount: vouch.estimated_cost,
          date: new Date().toISOString().split('T')[0],
          description: `Disbursement: Approved Fuel Allocation Voucher ${vouch.voucher_number}`
        });

        writeAuditLog(user.id, user.email, user.role, 'FUEL_VOUCHER_AUTHORIZED', null, `Authorized voucher ${vouch.voucher_number}`, db);
        await dbManager.saveDB(db);

        return buildResponse({ success: true });
      } catch (err: any) {
        return buildResponse({ error: err.message }, 500);
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
    if (user.role !== 'director') {
      return buildResponse({ error: 'Access Denied: Executive Director privileges required.' }, 403);
    }
    const ctrl = path.replace('/api/director/', '');

    if (ctrl === 'cycles/start' && method === 'POST') {
      try {
        const { startDate, endGoalTons } = await request.json() as any;
        db.cycles.forEach((c: any) => { if (c.status === 'active') c.status = 'completed'; });
        
        const newCycle = {
          id: `CYC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          startDate,
          status: 'active',
          locked: false,
          endGoalTons: endGoalTons || 200
        };

        db.cycles.push(newCycle);
        writeAuditLog(user.id, user.email, user.role, 'CYCLE_STARTED', null, `Started operating cycle: ${newCycle.id}`, db);
        await dbManager.saveDB(db);

        return buildResponse(newCycle);
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

    if (ctrl === 'cycles' && method === 'GET') {
      return buildResponse(db.cycles || []);
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

        db.cycles.unshift({
          id: cycleId,
          startDate: new Date().toISOString().split('T')[0],
          endDate: null,
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

  // Fallback 404 for unmatched endpoints
  return buildResponse({ error: `The requested corporate endpoint ${path} is non-existent.` }, 404);
};
