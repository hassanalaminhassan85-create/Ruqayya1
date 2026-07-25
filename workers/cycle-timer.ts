/**
 * Ruqayya Transport - Background Cycle Timer Worker
 * Manages 30-day operating cycles, payment installments, overdue charges, penalties, and document expirations.
 */

interface Env {
  DB: any;
  PUSH_SUBSCRIPTIONS?: any;
  R2_BUCKET?: any;
  AI?: any;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

// Helper to generate unique IDs
function generateUUID(): string {
  return 'uuid-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
}

// Helper to write audit logs to the operations DB
function writeAuditLog(
  userId: string,
  email: string,
  role: string,
  action: string,
  targetId: string | null,
  details: string,
  db: any
) {
  if (!db || typeof db !== 'object') return;
  if (!db.audit_logs) db.audit_logs = [];

  db.audit_logs.unshift({
    id: generateUUID(),
    userId: userId || "system",
    email: email || "cron@ruqayyatransport.com",
    role: role || "system",
    action: action || "CYCLE_CRON",
    targetId: targetId || null,
    details: details || "",
    timestamp: new Date().toISOString()
  });
}

// Replicate standard installment verification from ERP model
function calculateInstallmentsForDriver(driver: any, db: any, activeCycle: any) {
  const agreedAmount = driver.agreed_amount || 180000;
  const installmentTarget = Math.round(agreedAmount / 6);
  
  let startDate = activeCycle ? new Date(activeCycle.startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  
  const payments = (db.driver_payments || []).filter((p: any) => {
    return p.driver_id === driver.id && p.status === 'approved' &&
      new Date(p.date) >= startDate &&
      (activeCycle && activeCycle.endDate ? new Date(p.date) <= new Date(activeCycle.endDate) : true);
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

// Compute active cycle active seconds, discounting paused periods
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

// Cryptographic Web Push payload sender helper
async function generateVapidHeader(env: Env, endpoint: string): Promise<string> {
  const publicKey = env.VAPID_PUBLIC_KEY || 'BITZn5RUFNAiDT00zIT7QnCn-BzrOb1F1YT2dxnglz29nJ_ueg_G6VlaXfRGofieR2dSOJRNsWYF7aGYjorYfXg';
  const privateKey = env.VAPID_PRIVATE_KEY || 'vPMa7vScOargYGEdGvVFoFiQpIVZxPh4hhkUV4pt5Gk';

  function base64url(buffer: ArrayBuffer | Uint8Array): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
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

async function sendPushNotification(
  env: Env,
  subscription: any,
  payload: string
): Promise<{ success: boolean; expired?: boolean }> {
  try {
    const endpoint = subscription.endpoint;
    if (!endpoint) {
      return { success: false };
    }

    const authHeader = await generateVapidHeader(env, endpoint);

    // Try sending with payload body first (unencrypted JSON)
    let res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'TTL': '2419200',
        'Content-Type': 'application/json'
      },
      body: payload
    });

    // If push service (like FCM/Mozilla) rejects unencrypted payload, fallback to a secure silent push
    if (res.status === 400 || res.status === 401 || res.status === 411) {
      console.warn(`CycleTimer Worker: Push service rejected unencrypted body (${res.status}). Retrying with silent push...`);
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'TTL': '2419200',
          'Content-Length': '0'
        }
      });
    }

    if (res.status === 200 || res.status === 201) {
      return { success: true };
    }

    if (res.status === 410 || res.status === 404) {
      return { success: false, expired: true };
    }
    return { success: false };
  } catch (error) {
    console.error("CycleTimer Worker: Push dispatch error:", error);
    return { success: false };
  }
}

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
        const parts = keyInfo.name.split(':');
        if (parts[0] !== 'sub') continue;
        const subUserId = parts[1];
        
        let isRoleSub = parts[1] === 'role';
        let subRole = isRoleSub ? parts[2] : '';

        let shouldSend = false;
        if (target.all) {
          shouldSend = true;
        } else if (target.userId && !isRoleSub && subUserId === target.userId) {
          shouldSend = true;
        } else if (target.role && isRoleSub && subRole === target.role) {
          shouldSend = true;
        }

        if (shouldSend) {
          const subscriptionJson = await env.PUSH_SUBSCRIPTIONS.get(keyInfo.name);
          if (subscriptionJson) {
            subscriptionsToNotify.push({
              userId: isRoleSub ? 'role' : subUserId,
              subscription: JSON.parse(subscriptionJson),
              keyName: keyInfo.name
            });
          }
        }
      }
    } catch (err) {
      console.error("CycleTimer Worker: Failed to list KV subscriptions:", err);
    }
  }

  // 2. Gather subscriptions from D1 database (collections.push_subscriptions) if available
  if (db && db.push_subscriptions && Array.isArray(db.push_subscriptions)) {
    db.push_subscriptions.forEach((entry: any) => {
      if (entry && entry.subscription && entry.subscription.endpoint) {
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
        // Subscription has expired, delete it from KV
        if (item.keyName && env.PUSH_SUBSCRIPTIONS) {
          await env.PUSH_SUBSCRIPTIONS.delete(item.keyName).catch(() => {});
          console.log(`CycleTimer Worker: Deleted expired subscription from KV: ${item.keyName}`);
        }
        // Delete it from D1
        if (db && db.push_subscriptions) {
          const beforeLen = db.push_subscriptions.length;
          db.push_subscriptions = db.push_subscriptions.filter((s: any) => s && s.subscription && s.subscription.endpoint !== item.subscription.endpoint);
          if (db.push_subscriptions.length !== beforeLen) {
            dbChanged = true;
          }
        }
      }
    } catch (e) {
      console.error(`CycleTimer Worker: Failed push for endpoint ${item.subscription.endpoint}`, e);
    }
  }

  if (dbChanged && db && env.DB) {
    try {
      await env.DB.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
        .bind('push_subscriptions', JSON.stringify(db.push_subscriptions))
        .run();
      console.log("CycleTimer Worker: Successfully updated and saved push_subscriptions collection in D1 after pruning.");
    } catch (dbErr) {
      console.error("CycleTimer Worker: Failed to save pruned subscriptions to D1:", dbErr);
    }
  }
}

// Background Task Executor
async function processCycleManagement(env: Env) {
  if (!env.DB) {
    throw new Error("D1 DB database binding is not configured in this background worker.");
  }

  console.log("CycleTimer Worker: Loading collections from D1 database...");
  const dbResponse = await env.DB.prepare("SELECT name, data FROM collections").all();
  const results = dbResponse?.results || (Array.isArray(dbResponse) ? dbResponse : null);
  
  if (!results) {
    console.log("CycleTimer Worker: Database collections empty. Postponing task.");
    return;
  }

  const db: any = {};
  for (const row of results) {
    db[row.name] = JSON.parse(row.data);
  }

  // Fallbacks to guarantee data completeness
  if (!db.cycles) db.cycles = [];
  if (!db.drivers) db.drivers = [];
  if (!db.vehicles) db.vehicles = [];
  if (!db.shareholders) db.shareholders = [];
  if (!db.driver_payments) db.driver_payments = [];
  if (!db.notifications) db.notifications = [];
  if (!db.financial_records) db.financial_records = [];
  if (!db.audit_logs) db.audit_logs = [];
  if (!db.company_operations_state) {
    db.company_operations_state = { status: 'Setup Mode', currentCycle: '', currentDay: 1, pauseHistory: [], auditLog: [] };
  }

  const activeCycle = db.cycles.find((c: any) => c.status === 'active');
  let dbChanged = false;

  let stats = {
    driversChecked: 0,
    penaltiesIssued: 0,
    remindersIssued: 0,
    cycleEnded: false
  };

  if (activeCycle) {
    console.log(`CycleTimer Worker: Found active cycle: ${activeCycle.id}`);

    const secondsElapsed = computeActiveDuration(activeCycle);
    const daysElapsed = Math.floor(secondsElapsed / (24 * 3600)) + 1;
    const currentDayInDB = db.company_operations_state.currentDay || 1;

    if (daysElapsed !== currentDayInDB && daysElapsed <= 30) {
      db.company_operations_state.currentDay = daysElapsed;
      dbChanged = true;
      console.log(`CycleTimer Worker: Corrected current day parameter to Day ${daysElapsed}`);
    }

    // End-of-cycle distribution trigger (30-day countdown expiration)
    if (daysElapsed > 30) {
      console.log(`CycleTimer Worker: Concluding 30-day cycle: ${activeCycle.id}`);
      const endDate = new Date().toISOString();
      activeCycle.status = 'completed';
      activeCycle.endDate = endDate;
      activeCycle.locked = true;

      // Distribution accounting
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

      // Proportionate distribution
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
        title_en: 'Operating Cycle Concluded',
        title_ha: 'Zagayen Aiki Ya Kammala',
        message_en: `Operations Cycle ${activeCycle.id} reached its 30-day limit. Dividend pool of ₦${distributionPool.toLocaleString()} has been processed.`,
        message_ha: `Zagayen aiki ${activeCycle.id} ya kai haddi. An raba jarin riba ₦${distributionPool.toLocaleString()}.`,
        type: 'success',
        read_status: 0,
        created_at: endDate
      });

      writeAuditLog("system", "cron@ruqayyatransport.com", "system", "CYCLE_AUTO_CONCLUDE", activeCycle.id, `Operating cycle automatically concluded. Dividend pool: ₦${distributionPool}`, db);
      stats.cycleEnded = true;
      dbChanged = true;

      await sendPushNotificationToUserOrRole(env, { all: true }, {
        title: 'Operating Cycle Concluded',
        message: `Cycle ${activeCycle.id} has reached its 30-day limit and was automatically finalized.`,
        type: 'success'
      }, db);
    }

    // Verify installments, trigger penalties and warnings
    for (const driver of db.drivers) {
      if (driver.status !== 'approved' && driver.status !== 'active') continue;
      stats.driversChecked++;

      const installments = calculateInstallmentsForDriver(driver, db, activeCycle);

      for (const inst of installments) {
        const today = new Date();
        const instEndDate = new Date(inst.endDate);
        const hoursRemaining = (instEndDate.getTime() - today.getTime()) / (1000 * 60 * 60);

        // Overdue status check and ₦5,000 penalty assessment
        if (inst.status === 'Overdue') {
          if (!driver.penalties_history) {
            driver.penalties_history = [];
          }

          const hasPenalty = driver.penalties_history.some((p: any) => 
            p.installmentNumber === inst.installmentNumber && 
            p.cycleId === activeCycle.id
          );

          if (!hasPenalty) {
            const overdueCharge = 5000;
            console.log(`CycleTimer Worker: Applying ₦${overdueCharge} penalty to driver ${driver.fullName || driver.id}`);

            driver.total_penalty_amount = (driver.total_penalty_amount || 0) + overdueCharge;
            driver.debt_amount = (driver.debt_amount || 0) + overdueCharge;

            driver.penalties_history.push({
              id: generateUUID(),
              installmentNumber: inst.installmentNumber,
              cycleId: activeCycle.id,
              amount: overdueCharge,
              appliedAt: new Date().toISOString()
            });

            db.financial_records.push({
              id: generateUUID(),
              type: 'revenue',
              category: 'penalty',
              amount: overdueCharge,
              date: new Date().toISOString(),
              description: `Overdue Charge Penalty: Driver ${driver.fullName || 'Candidate'} (Installment #${inst.installmentNumber})`
            });

            const warningEn = `Installment #${inst.installmentNumber} for Driver ${driver.fullName || 'Candidate'} is OVERDUE! A ₦5,000 penalty has been applied.`;
            const warningHa = `Kashin biya #${inst.installmentNumber} na Direba ${driver.fullName || 'Candidate'} ya wuce lokaci! An tara tarar ₦5,000.`;

            db.notifications.unshift({
              id: generateUUID(),
              driver_id: driver.id,
              installmentNumber: inst.installmentNumber,
              cycle_id: activeCycle.id,
              title_en: 'Installment Overdue & Penalty Applied',
              title_ha: 'An Sanya Tara Domin Jinkiri',
              message_en: warningEn,
              message_ha: warningHa,
              type: 'overdue',
              read_status: 0,
              created_at: new Date().toISOString()
            });

            writeAuditLog("system", "cron@ruqayyatransport.com", "system", "DRIVER_PAYMENT_PENALTY", driver.id, `Charged ₦5,000 penalty for installment #${inst.installmentNumber}`, db);
            stats.penaltiesIssued++;
            dbChanged = true;

            if (driver.user_id) {
              await sendPushNotificationToUserOrRole(env, { userId: driver.user_id }, {
                title: 'Overdue Penalty Charge',
                message: warningEn,
                type: 'danger'
              }, db);
            }
            await sendPushNotificationToUserOrRole(env, { role: 'admin' }, {
              title: 'Driver Penalty Logged',
              message: `Driver ${driver.fullName || driver.id} charged ₦5,000 for installment #${inst.installmentNumber}.`,
              type: 'warning'
            }, db);
          }
        }

        // Upcoming installments due soon (within 48 hours)
        else if (inst.status !== 'Completed' && hoursRemaining > 0 && hoursRemaining <= 48) {
          const sentRecently = db.notifications.some((n: any) => 
            n.driver_id === driver.id && 
            n.installmentNumber === inst.installmentNumber &&
            n.cycle_id === activeCycle.id &&
            n.type === 'upcoming_reminder' &&
            (new Date().getTime() - new Date(n.created_at).getTime()) < 24 * 3600 * 1000
          );

          if (!sentRecently) {
            const remindEn = `Payment Reminder: Your installment #${inst.installmentNumber} of ₦${inst.remainingAmount.toLocaleString()} is due on ${inst.endDate}.`;
            const remindHa = `Gargaɗi: Biyan kuɗi kashi na #${inst.installmentNumber} na ₦${inst.remainingAmount.toLocaleString()} na kusa cika a ranar ${inst.endDate}.`;

            db.notifications.unshift({
              id: generateUUID(),
              driver_id: driver.id,
              installmentNumber: inst.installmentNumber,
              cycle_id: activeCycle.id,
              title_en: 'Installment Due Soon',
              title_ha: 'Kwanan Biyan Kudi Ya Gabato',
              message_en: remindEn,
              message_ha: remindHa,
              type: 'upcoming_reminder',
              read_status: 0,
              created_at: new Date().toISOString()
            });

            stats.remindersIssued++;
            dbChanged = true;

            if (driver.user_id) {
              await sendPushNotificationToUserOrRole(env, { userId: driver.user_id }, {
                title: 'Upcoming Payment Warning',
                message: remindEn,
                type: 'info'
              }, db);
            }
          }
        }
      }
    }
  } else {
    console.log("CycleTimer Worker: No active operating cycle exists.");
  }

  // Monitor document renewals (insurance/registration expiries)
  for (const vehicle of (db.vehicles || [])) {
    const today = new Date();
    const thresholdMs = 7 * 24 * 3600 * 1000; // 7 days warning window
    
    const docs = [
      { key: 'insurance', val: vehicle.insurance_expiry, name: 'Insurance policy' },
      { key: 'registration', val: vehicle.registration_expiry, name: 'Registration file' }
    ];

    for (const doc of docs) {
      if (!doc.val) continue;
      const expiry = new Date(doc.val);
      const diff = expiry.getTime() - today.getTime();

      if (diff <= thresholdMs) {
        const alreadyFlagged = db.notifications.some((n: any) => 
          n.vehicle_plate === vehicle.plate_number && 
          n.document_type === doc.key &&
          (new Date().getTime() - new Date(n.created_at).getTime()) < 3 * 24 * 3600 * 1000
        );

        if (!alreadyFlagged) {
          const expired = diff < 0;
          const statusText = expired ? 'EXPIRED' : 'EXPIRING SOON';
          const msgEn = `Vehicle Alert: ${doc.name} for Tricycle ${vehicle.plate_number} has ${statusText} (${doc.val}).`;
          const msgHa = `Gargadi: ${doc.name} na Babur ${vehicle.plate_number} ya ${expired ? 'kare' : 'kusa karewa'} (${doc.val}).`;

          db.notifications.unshift({
            id: generateUUID(),
            vehicle_plate: vehicle.plate_number,
            document_type: doc.key,
            title_en: `${doc.name} ${statusText}`,
            title_ha: `Matsayin Takarda: ${doc.name}`,
            message_en: msgEn,
            message_ha: msgHa,
            type: 'warning',
            read_status: 0,
            created_at: new Date().toISOString()
          });

          dbChanged = true;

          await sendPushNotificationToUserOrRole(env, { role: 'admin' }, {
            title: `Document warning: ${vehicle.plate_number}`,
            message: msgEn,
            type: 'warning'
          }, db);
        }
      }
    }
  }

  // Mileage-based oil check alerts
  for (const vehicle of (db.vehicles || [])) {
    if (vehicle.current_mileage && vehicle.oil_change_mileage) {
      const cur = parseFloat(vehicle.current_mileage);
      const limit = parseFloat(vehicle.oil_change_mileage);

      if (cur >= limit && vehicle.status !== 'maintenance required' && vehicle.status !== 'maintenance') {
        vehicle.status = 'maintenance required';
        dbChanged = true;

        const oilEn = `Maintenance Alert: Vehicle ${vehicle.plate_number} exceeded oil change mileage limit (${cur} km / limit: ${limit} km).`;
        const oilHa = `Gargadin Gyara: Babur ${vehicle.plate_number} ya haura iyakar nisan canza mai (${cur} km / iyaka: ${limit} km).`;

        db.notifications.unshift({
          id: generateUUID(),
          vehicle_plate: vehicle.plate_number,
          title_en: 'Oil Change Maintenance Required',
          title_ha: 'Lokacin Canza Mai Ya Cika',
          message_en: oilEn,
          message_ha: oilHa,
          type: 'warning',
          read_status: 0,
          created_at: new Date().toISOString()
        });

        writeAuditLog("system", "cron@ruqayyatransport.com", "system", "VEHICLE_MAINTENANCE_DUE", vehicle.plate_number, `Flagged vehicle for oil change service: ${cur} km`, db);

        await sendPushNotificationToUserOrRole(env, { role: 'admin' }, {
          title: `Oil change required: ${vehicle.plate_number}`,
          message: oilEn,
          type: 'warning'
        }, db);
      }
    }
  }

  // Record operation success
  writeAuditLog("system", "cron@ruqayyatransport.com", "system", "CRON_HEARTBEAT", null, `Cycle timer checked. Drivers: ${stats.driversChecked}, Penalties applied: ${stats.penaltiesIssued}, Warnings: ${stats.remindersIssued}`, db);
  dbChanged = true;

  // Persist calculations back to D1 Database
  if (dbChanged) {
    console.log("CycleTimer Worker: Saving updated collections to D1...");
    for (const [name, dataObj] of Object.entries(db)) {
      const jsonStr = JSON.stringify(dataObj);
      await env.DB.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
        .bind(name, jsonStr)
        .run();
    }
    console.log("CycleTimer Worker: Database collections updated successfully.");
  }
}

export default {
  // Cloudflare Cron event trigger entrypoint
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    console.log(`CycleTimer Worker: Triggered scheduled tasks. Event Time: ${new Date(event.scheduledTime).toISOString()}`);
    ctx.waitUntil(processCycleManagement(env));
  },

  // HTTP access trigger (GET/POST to /run) to permit administrative runs
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      try {
        await processCycleManagement(env);
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Ruqayya Background calculations executed successfully by administrative fetch request." 
        }), {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (err: any) {
        console.error("CycleTimer Worker: Execution failed via HTTP trigger:", err);
        return new Response(JSON.stringify({ 
          success: false, 
          error: err.message 
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    return new Response("Ruqayya Transport Background CycleTimer Worker. Submit GET/POST request to /run to trigger operations on demand.", { status: 200 });
  }
};
