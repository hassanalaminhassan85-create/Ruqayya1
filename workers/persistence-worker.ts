/**
 * Persistence Worker - exposes secure persistence endpoints and delegates
 * critical operations to a Durable Object for serialized execution.
 *
 * Endpoints:
 *  - POST /api/payments/driver  { driver_id, amount, payment_method?, reference?, date? }
 *  - POST /api/expenses         { category, amount, driver_id?, vehicle_id?, description? }
 *  - POST /api/cycles/generate  { driver_id, cycle_id, agreed_amount_30, cycle_start_date? }
 *
 * This worker requires:
 *  - D1 binding: DB
 *  - Durable Object binding: LEDGER_DO (class LedgerLock)
 *  - MIGRATE_TOKEN (optional) - if set, must be provided in X-MIGRATE-TOKEN header
 */

interface Env {
  DB: any;
  LEDGER_DO?: DurableObjectNamespace;
  MIGRATE_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Require token if set
    if (env.MIGRATE_TOKEN) {
      const provided = request.headers.get('x-migrate-token') || '';
      if (!provided || provided !== env.MIGRATE_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'POST' && pathname === '/api/payments/driver') {
      try {
        const body = await request.json();
        const { driver_id, amount } = body || {};
        if (!driver_id) return new Response(JSON.stringify({ error: 'driver_id required' }), { status: 400 });
        if (!amount || typeof amount !== 'number') return new Response(JSON.stringify({ error: 'amount required and must be number' }), { status: 400 });

        // Delegate to Durable Object for serialized ledger ops when available
        if (env.LEDGER_DO) {
          const id = env.LEDGER_DO.idFromName(`driver:${driver_id}`);
          const obj = env.LEDGER_DO.get(id);
          const resp = await obj.fetch(new Request(`https://do/operate`, { method: 'POST', body: JSON.stringify({ op: 'driver_payment', payload: body }) }));
          const text = await resp.text();
          return new Response(text, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
        }

        // Fallback: perform op directly against D1 with best-effort (no DO locking)
        const direct = await handleDriverPaymentDirect(env.DB, body);
        return new Response(JSON.stringify(direct), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'POST' && pathname === '/api/expenses') {
      try {
        const body = await request.json();
        if (env.LEDGER_DO) {
          const id = env.LEDGER_DO.idFromName(`global:expenses`);
          const obj = env.LEDGER_DO.get(id);
          const resp = await obj.fetch(new Request(`https://do/operate`, { method: 'POST', body: JSON.stringify({ op: 'record_expense', payload: body }) }));
          const text = await resp.text();
          return new Response(text, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
        }
        const direct = await handleRecordExpenseDirect(env.DB, body);
        return new Response(JSON.stringify(direct), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'POST' && pathname === '/api/cycles/generate') {
      try {
        const body = await request.json();
        if (!body || !body.driver_id || !body.cycle_id || !body.agreed_amount_30) {
          return new Response(JSON.stringify({ error: 'driver_id, cycle_id and agreed_amount_30 required' }), { status: 400 });
        }
        if (env.LEDGER_DO) {
          const id = env.LEDGER_DO.idFromName(`driver:${body.driver_id}`);
          const obj = env.LEDGER_DO.get(id);
          const resp = await obj.fetch(new Request(`https://do/operate`, { method: 'POST', body: JSON.stringify({ op: 'generate_installments', payload: body }) }));
          const text = await resp.text();
          return new Response(text, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
        }
        const direct = await handleGenerateInstallmentsDirect(env.DB, body);
        return new Response(JSON.stringify(direct), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Persistence Worker: unsupported endpoint', { status: 404 });
  }
};

// --------------------
// Fallback direct implementations (no DO locking). These mirror the DO behavior
// but run directly in the worker environment. Use only if Durable Objects are not available.
// --------------------

async function getCollection(db: any, name: string) {
  const resp = await db.prepare('SELECT data FROM collections WHERE name = ?').bind(name).all();
  const rows = resp && (resp.results || resp) || [];
  if (!rows || rows.length === 0) return null;
  try { return JSON.parse(rows[0].data); } catch (e) { return null; }
}

async function upsertCollection(db: any, name: string, data: any) {
  const jsonStr = JSON.stringify(data || []);
  await db.prepare('INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)').bind(name, jsonStr).run();
}

async function handleDriverPaymentDirect(DB: any, body: any) {
  // Very small implementation: add driver_payment, create simple ledger record and apply to installments (best-effort)
  const driverId = body.driver_id;
  const amount = body.amount;
  const date = body.date || new Date().toISOString().split('T')[0];

  const drivers = (await getCollection(DB, 'drivers')) || [];
  const driver = drivers.find((d: any) => d.id === driverId);
  if (!driver) throw new Error('driver not found');

  const driver_payments = (await getCollection(DB, 'driver_payments')) || [];
  const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const paymentRec = { id: paymentId, driver_id: driverId, amount, date, payment_method: body.payment_method || 'unknown', reference: body.reference || null, created_at: new Date().toISOString() };
  driver_payments.unshift(paymentRec);
  await upsertCollection(DB, 'driver_payments', driver_payments);

  // Create or fetch installments and apply
  const installments = (await getCollection(DB, 'installments')) || [];
  let driverInsts = installments.filter((i: any) => i.driver_id === driverId).sort((a: any,b:any)=>a.installment_number-b.installment_number);
  if (!driverInsts || driverInsts.length === 0) {
    // generate simple 6 installments based on today
    const generated = generateSixInstallments(driverId, body.cycle_id || `cycle-${Date.now()}`, body.agreed_amount_30 || (driver.agreed_amount_30 || 180000), body.cycle_start_date);
    for (const g of generated) installments.unshift(g);
    driverInsts = generated;
    await upsertCollection(DB, 'installments', installments);
  }

  let remaining = amount;
  for (const inst of driverInsts) {
    if (remaining <= 0) break;
    const toPay = Math.min(inst.remaining || inst.amount_due - (inst.amount_paid||0), remaining);
    if (toPay <= 0) continue;
    inst.amount_paid = (inst.amount_paid || 0) + toPay;
    inst.remaining = parseFloat(((inst.amount_due || 0) - inst.amount_paid).toFixed(2));
    inst.payment_history = inst.payment_history || [];
    inst.payment_history.push(paymentId);
    if (inst.remaining <= 0) inst.status = 'PAID'; else inst.status = 'PARTIALLY_PAID';
    remaining = parseFloat((remaining - toPay).toString());
  }
  // save installments
  await upsertCollection(DB, 'installments', installments);

  // Mirror ledger entry into financial_records and financial_ledger collections
  const financial_records = (await getCollection(DB, 'financial_records')) || [];
  const ledgerId = `LEDGER-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const ledgerEntry = { id: ledgerId, type: 'revenue', subtype: 'driver_payment', amount, date, description: `Driver payment ${paymentId}` };
  financial_records.unshift(ledgerEntry);
  await upsertCollection(DB, 'financial_records', financial_records);

  const financial_ledger = (await getCollection(DB, 'financial_ledger')) || [];
  financial_ledger.unshift({ ...ledgerEntry, created_at: new Date().toISOString(), driver_id: driverId, reference_id: paymentId });
  await upsertCollection(DB, 'financial_ledger', financial_ledger);

  // return updated installments for driver
  const updatedDriverInsts = (await getCollection(DB, 'installments'))?.filter((i:any)=>i.driver_id===driverId).sort((a:any,b:any)=>a.installment_number-b.installment_number) || [];

  return { payment: paymentRec, installments: updatedDriverInsts, ledgerEntry };
}

function generateSixInstallments(driver_id: string, cycle_id: string, agreed_amount_30: number, cycle_start_date?: string) {
  const start = cycle_start_date ? new Date(cycle_start_date) : new Date();
  const per = parseFloat((agreed_amount_30 / 6).toFixed(2));
  const out: any[] = [];
  for (let k=1;k<=6;k++){
    const startDay = (k-1)*5+1; const endDay = k*5;
    const installmentStart = new Date(start.getTime() + (startDay-1)*24*3600*1000);
    const installmentEnd = new Date(start.getTime() + (endDay-1)*24*3600*1000);
    out.push({ id:`INST-${cycle_id}-${driver_id}-${k}`, cycle_id, driver_id, installment_number:k, start_date:installmentStart.toISOString().split('T')[0], end_date:installmentEnd.toISOString().split('T')[0], due_date:installmentEnd.toISOString().split('T')[0], amount_due:per, amount_paid:0, remaining:per, status:'DUE', payment_history:[] });
  }
  return out;
}

async function handleRecordExpenseDirect(DB: any, body: any) {
  const expenses = (await getCollection(DB, 'expenses')) || [];
  const id = `EXP-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const rec = { id, category: body.category || 'other', amount: body.amount || 0, date: body.date || new Date().toISOString().split('T')[0], description: body.description || '', driver_id: body.driver_id || null, vehicle_id: body.vehicle_id || null, created_by: body.created_by || 'system', approved: !!body.approved, created_at: new Date().toISOString() };
  expenses.unshift(rec);
  await upsertCollection(DB, 'expenses', expenses);

  // create ledger entry and mirror
  const financial_records = (await getCollection(DB, 'financial_records')) || [];
  const ledgerId = `LEDGER-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const ledgerEntry = { id: ledgerId, type: 'expense', subtype: rec.category, amount: rec.amount, date: rec.date, description: rec.description };
  financial_records.unshift(ledgerEntry);
  await upsertCollection(DB, 'financial_records', financial_records);

  const financial_ledger = (await getCollection(DB, 'financial_ledger')) || [];
  financial_ledger.unshift({ ...ledgerEntry, created_at: new Date().toISOString(), reference_id: rec.id, driver_id: rec.driver_id, vehicle_id: rec.vehicle_id });
  await upsertCollection(DB, 'financial_ledger', financial_ledger);

  return { expense: rec, ledgerEntry };
}

async function handleGenerateInstallmentsDirect(DB: any, body: any) {
  const installments = (await getCollection(DB, 'installments')) || [];
  const generated = generateSixInstallments(body.driver_id, body.cycle_id, body.agreed_amount_30, body.cycle_start_date);
  for (const g of generated) installments.unshift(g);
  await upsertCollection(DB, 'installments', installments);
  return { generatedCount: generated.length, installments: generated };
}
