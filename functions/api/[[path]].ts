interface Env {
  DB?: any;
  R2_BUCKET?: any;
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

  if (role === 'director') {
    return {
      ...common,
      drivers: db.drivers || [],
      vehicles: db.vehicles || [],
      vouchers: db.fuel_vouchers || [],
      financials: db.financial_records || [],
      notifications: db.notifications || [],
      audit_logs: db.audit_logs || [],
      users: db.users || [],
      admins: db.admins || [],
      shareholders: db.shareholders || [],
      cycles: db.cycles || [],
      shareholder_settings: db.shareholder_settings || {},
      trip_manifests: db.trip_manifests || [],
      driver_payments: db.driver_payments || [],
      messages: db.messages || [],
      vehicle_documents: db.vehicle_documents || [],
      driver_documents: db.driver_documents || [],
      company_documents: db.company_documents || []
    };
  } else if (role === 'admin') {
    return {
      ...common,
      drivers: db.drivers || [],
      vehicles: db.vehicles || [],
      vouchers: db.fuel_vouchers || [],
      financials: db.financial_records || [],
      notifications: db.notifications || [],
      users: db.users || [],
      admins: db.admins || [],
      shareholders: (db.shareholders || []).map((s: any) => ({ id: s.id, full_name: s.full_name, status: s.status })),
      cycles: db.cycles || [],
      trip_manifests: db.trip_manifests || [],
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
    const activeDriver = db.drivers.find((d: any) => d.id === driverProfileId) || {};
    const driverVouchers = (db.fuel_vouchers || []).filter((v: any) => v.driver_id === driverProfileId);
    const driverPayments = (db.driver_payments || []).filter((p: any) => p.driver_id === driverProfileId);
    const driverDocuments = (db.driver_documents || []).filter((doc: any) => doc.driver_id === driverProfileId);
    const driverTrips = (db.trip_manifests || []).filter((t: any) => t.driver_id === driverProfileId);
    const driverNotifications = (db.notifications || []).filter((n: any) => n.user_id === activeDriver.user_id || n.target_role === 'driver' || (!n.user_id && !n.target_role));
    const driverMessages = (db.messages || []).filter((m: any) => m.sender_id === activeDriver.user_id || m.receiver_id === activeDriver.user_id);

    return {
      ...common,
      drivers: [activeDriver],
      vehicles: (db.vehicles || []).filter((v: any) => v.driver_id === driverProfileId),
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

  async getDB(): Promise<any> {
    if (this.env.DB) {
      await this.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS collections (
          name TEXT PRIMARY KEY,
          data TEXT
        )
      `).run();

      const { results } = await this.env.DB.prepare("SELECT name, data FROM collections").all();
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
    if (this.env.DB) {
      const statements = [];
      for (const [key, val] of Object.entries(state)) {
        statements.push(
          this.env.DB.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
            .bind(key, JSON.stringify(val))
        );
      }
      await this.env.DB.batch(statements);
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

  // Helper to check authentication
  const authenticate = () => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return { authenticated: false, error: 'Authentication required. Active session parameters not found.', status: 412 };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const session = db.sessions.find((s: any) => s.token === token && s.status === 'active');

    if (!session) {
      return { authenticated: false, error: 'Session expired or invalidated. Please login again.', status: 401 };
    }

    if (new Date(session.expires_at) < new Date()) {
      session.status = 'expired';
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
  const auth = authenticate();
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

        return {
          ...drv,
          fullName: u.full_name || drv.fullName || '',
          email: u.email || '',
          phone: u.phone || drv.phone || '',
          guarantor: g,
          vehicle: v,
          financials
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

        return buildResponse({
          ...drv,
          fullName: u.full_name || '',
          email: u.email || '',
          phone: u.phone || '',
          guarantor: g,
          vehicle: v,
          financials
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
        return new Response('File not found in storage bucket.', { status: 404 });
      }
      const fileData = await object.arrayBuffer();
      return new Response(fileData, {
        headers: {
          'Content-Type': filename.endsWith('.pdf') ? 'application/pdf' : 'image/png',
          'Cache-Control': 'max-age=3600'
        }
      });
    } else {
      // Memory mock empty image for safety if no R2 bound
      const mockPixel = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 108, 11, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 96, 64, 0, 0, 0, 2, 0, 1, 73, 175, 168, 116, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
      return new Response(mockPixel, {
        headers: { 'Content-Type': 'image/png' }
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

  // Fallback 404 for unmatched endpoints
  return buildResponse({ error: `The requested corporate endpoint ${path} is non-existent.` }, 404);
};
