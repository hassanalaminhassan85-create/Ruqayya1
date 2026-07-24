/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface Env {
  DB: any;
  PUSH_SUBSCRIPTIONS: any;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

// Helper to generate UUIDs
function generateUUID(): string {
  return 'uuid-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
}

// Helper to write audit logs
function writeAuditLog(
  userId: string,
  arg2: string,
  arg3: any,
  arg4?: any,
  arg5?: any,
  arg6?: any,
  arg7?: any
) {
  let email = "cron@ruqayyatransport.com";
  let role = "system";
  let action = "";
  let targetId: string | null = null;
  let details = "";
  let db: any = null;

  // Adapt to different argument signatures
  if (arg7 !== undefined) {
    email = arg2;
    role = arg3;
    action = arg4;
    targetId = arg5;
    details = arg6;
    db = arg7;
  } else if (arg6 !== undefined) {
    email = arg2;
    action = arg3;
    targetId = arg4;
    details = arg5;
    db = arg6;
  } else if (arg5 !== undefined) {
    action = arg2;
    details = arg3;
    targetId = arg4;
    db = arg5;
  } else {
    db = arg3;
  }

  if (!db || typeof db !== 'object') return;
  if (!db.audit_logs) db.audit_logs = [];

  db.audit_logs.unshift({
    id: generateUUID(),
    userId: userId || "system",
    email: email || "cron@ruqayyatransport.com",
    role: role || "system",
    action: action || "CRON_JOB",
    targetId: targetId || null,
    details: details || "",
    timestamp: new Date().toISOString()
  });
}

// Replicate the exact installment calculation logic from backend
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

// Compute active duration accounting for pause history
function computeActiveDuration(cycle: any): number {
  if (!cycle) return 0;
  const start = new Date(cycle.startDate).getTime();
  const now = cycle.status === 'paused' && cycle.pausedAt 
    ? new Date(cycle.pausedAt).getTime() 
    : Date.now();
  
  let totalElapsed = now - start;
  
  // Subtract paused durations
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

// Standard VAPID Header and Push Notification delivery functions using Web Crypto
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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'TTL': '2419200',
        'Content-Type': 'application/json'
      },
      body: payload
    });

    if (res.status === 200 || res.status === 201) {
      return { success: true };
    }

    console.error(`Cron Push subscription failed with status ${res.status}`);
    if (res.status === 410 || res.status === 404) {
      return { success: false, expired: true };
    }
    return { success: false };
  } catch (error: any) {
    console.error("Cron Error sending native push notification:", error);
    return { success: false };
  }
}

async function sendPushNotificationToUserOrRole(
  env: Env,
  target: { userId?: string; role?: string; all?: boolean },
  notification: { title: string; message: string; type?: string }
) {
  if (!env.PUSH_SUBSCRIPTIONS) {
    console.log("Cron: No PUSH_SUBSCRIPTIONS KV namespace bound.");
    return;
  }

  let keys: any[] = [];
  try {
    const listResult = await env.PUSH_SUBSCRIPTIONS.list();
    keys = listResult.keys || [];
  } catch (err) {
    console.error("Cron: Failed to list push subscriptions from KV:", err);
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    type: notification.type || 'info',
    timestamp: Date.now()
  });

  for (const keyInfo of keys) {
    // Key format: sub:<userId>:<escaped_endpoint> or sub:role:<roleName>:<escaped_endpoint>
    const parts = keyInfo.name.split(':');
    if (parts[0] !== 'sub') continue;

    let subUserId = parts[1];
    let isRoleSub = false;
    let subRole = '';

    if (parts[1] === 'role') {
      isRoleSub = true;
      subRole = parts[2];
    }

    let shouldSend = false;
    if (target.all) {
      shouldSend = true;
    } else if (target.userId && !isRoleSub && subUserId === target.userId) {
      shouldSend = true;
    } else if (target.role && isRoleSub && subRole === target.role) {
      shouldSend = true;
    }

    if (shouldSend) {
      try {
        const subscriptionJson = await env.PUSH_SUBSCRIPTIONS.get(keyInfo.name);
        if (subscriptionJson) {
          const subscription = JSON.parse(subscriptionJson);
          const pushRes = await sendPushNotification(env, subscription, payload);
          if (pushRes && !pushRes.success && pushRes.expired) {
            console.log(`Cron: Subscription expired, removing key ${keyInfo.name}`);
            await env.PUSH_SUBSCRIPTIONS.delete(keyInfo.name);
          }
        }
      } catch (e) {
        console.error(`Cron: Failed to send to subscription key ${keyInfo.name}`, e);
      }
    }
  }
}

// Main logic triggered every cron execution
async function runCycleUpdates(env: Env) {
  if (!env.DB) {
    throw new Error("No DB binding configured inside background worker.");
  }

  // Load database collections from Cloudflare D1
  const dbResponse = await env.DB.prepare("SELECT name, data FROM collections").all();
  const results = dbResponse?.results || (Array.isArray(dbResponse) ? dbResponse : null);
  
  if (!results) {
    console.log("No collections found in D1 database. Skipping background update.");
    return;
  }

  const db: any = {};
  for (const row of results) {
    db[row.name] = JSON.parse(row.data);
  }

  // Ensure default structures exist
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
  let cycleUpdated = false;

  if (activeCycle) {
    console.log(`Cron: Active operating cycle found: ${activeCycle.id}`);
    
    // 1. Calculate active cycle duration
    const secondsElapsed = computeActiveDuration(activeCycle);
    const daysElapsed = Math.floor(secondsElapsed / (24 * 3600)) + 1;
    const currentDayInDB = db.company_operations_state.currentDay || 1;

    console.log(`Cron: Days elapsed in cycle: ${daysElapsed} (Current recorded day: ${currentDayInDB})`);

    if (daysElapsed !== currentDayInDB && daysElapsed <= 30) {
      db.company_operations_state.currentDay = daysElapsed;
      cycleUpdated = true;
      console.log(`Cron: Updated current day of operations to Day ${daysElapsed}`);
    }

    // 2. Check if 30-day operating cycle has automatically finished
    if (daysElapsed > 30) {
      console.log(`Cron: Active cycle ${activeCycle.id} has reached its 30-day conclusion. Triggering automatic distribution and closure...`);
      
      const endDate = new Date().toISOString();
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

      db.company_operations_state.status = 'Setup Mode';
      db.company_operations_state.currentCycle = '';
      db.company_operations_state.currentDay = 1;

      // Unshift notification
      db.notifications.unshift({
        id: generateUUID(),
        title_en: 'Operating Cycle Concluded Automatically',
        title_ha: 'An Kammala Zagayen Aiki da kansa',
        message_en: `Operating Cycle ${activeCycle.id} reached its 30-day duration. System auto-concluded operations and distributed dividends of ₦${distributionPool.toLocaleString()}.`,
        message_ha: `Zagayen aiki ${activeCycle.id} ya cika kwana 30. Tsarin ya kammala aiki da kansa kuma ya raba ribar ₦${distributionPool.toLocaleString()}.`,
        type: 'success',
        read_status: 0,
        created_at: endDate
      });

      writeAuditLog("system", "cron", "CYCLE_AUTO_CONCLUDED", `Operating Cycle ${activeCycle.id} automatically completed and distributed dividends.`, db);
      cycleUpdated = true;

      // Broadcast conclude event to all users
      await sendPushNotificationToUserOrRole(env, { all: true }, {
        title: 'Operating Cycle Concluded',
        message: `Operating Cycle ${activeCycle.id} has successfully concluded. Distributions have been processed.`,
        type: 'success'
      });
    }

    // 3. Driver payments calculations (finding overdue installments)
    console.log("Cron: Assessing driver payment installments for overdue items...");
    for (const driver of db.drivers) {
      const status = driver.status;
      if (status !== 'approved' && status !== 'active') continue;

      const installments = calculateInstallmentsForDriver(driver, db, activeCycle);
      
      for (const inst of installments) {
        if (inst.status === 'Overdue') {
          // Check if already notified for this specific installment in this cycle
          const alreadyNotified = db.notifications.some((n: any) => 
            n.driver_id === driver.id && 
            n.installmentNumber === inst.installmentNumber &&
            n.cycle_id === activeCycle.id &&
            n.type === 'overdue'
          );

          if (!alreadyNotified) {
            console.log(`Cron: Flagging overdue installment #${inst.installmentNumber} for Driver ${driver.fullName || driver.id}`);
            const msg_en = `Installment #${inst.installmentNumber} for Driver ${driver.fullName || 'Candidate'} is OVERDUE. Pending amount: ₦${inst.remainingAmount.toLocaleString()}.`;
            const msg_ha = `Biyan kuɗi kashi na #${inst.installmentNumber} na Direba ${driver.fullName || 'Candidate'} ya wuce ranar biya. Ragowar kuɗi: ₦${inst.remainingAmount.toLocaleString()}.`;

            db.notifications.unshift({
              id: generateUUID(),
              driver_id: driver.id,
              installmentNumber: inst.installmentNumber,
              cycle_id: activeCycle.id,
              title_en: 'Installment Overdue Alert',
              title_ha: 'Gargaɗin Biyan Kuɗi',
              message_en: msg_en,
              message_ha: msg_ha,
              type: 'overdue',
              read_status: 0,
              created_at: new Date().toISOString()
            });

            writeAuditLog("system", "cron", "DRIVER_PAYMENT_OVERDUE", `Flagged installment #${inst.installmentNumber} overdue for driver ${driver.fullName || driver.id}`, db);
            cycleUpdated = true;

            // Deliver Push Notifications
            // 1. To the driver
            if (driver.user_id) {
              await sendPushNotificationToUserOrRole(env, { userId: driver.user_id }, {
                title: 'Installment Overdue Warning',
                message: msg_en,
                type: 'warning'
              });
            }
            // 2. To administrators and board members
            await sendPushNotificationToUserOrRole(env, { role: 'admin' }, {
              title: 'Driver Installment Overdue',
              message: `Driver ${driver.fullName || driver.id} is overdue on installment #${inst.installmentNumber}.`,
              type: 'warning'
            });
            await sendPushNotificationToUserOrRole(env, { role: 'director' }, {
              title: 'Driver Installment Overdue',
              message: `Driver ${driver.fullName || driver.id} is overdue on installment #${inst.installmentNumber}.`,
              type: 'warning'
            });
          }
        }
      }
    }
  } else {
    console.log("Cron: No active operating cycle found.");
  }

  // Always write a cron heartbeat audit log to ensure monitoring visibility
  writeAuditLog("system", "cron", "CRON_HEARTBEAT", null, `Cron trigger executed successfully. Checks complete.`, db);
  cycleUpdated = true;

  // 4. Save any changes back to D1 Database
  if (cycleUpdated) {
    console.log("Cron: Saving updated collections back to D1...");
    for (const [name, dataObj] of Object.entries(db)) {
      const jsonStr = JSON.stringify(dataObj);
      await env.DB.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
        .bind(name, jsonStr)
        .run();
    }
    console.log("Cron: Successfully synchronized database with latest calculations.");
  }
}

export default {
  // Cron Trigger entrypoint
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    console.log("Ruqayya Background Cron: Initiated scheduled cycle updates...");
    ctx.waitUntil(runCycleUpdates(env));
  },

  // HTTP entrypoint for administrative debugging
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      try {
        await runCycleUpdates(env);
        return new Response(JSON.stringify({ success: true, message: "Ruqayya Background calculations executed successfully." }), {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (err: any) {
        console.error("Ruqayya Background calculations HTTP run failure:", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    return new Response("Ruqayya Transport Background Cron Worker. GET or POST /run to trigger manually.", { status: 200 });
  }
};
