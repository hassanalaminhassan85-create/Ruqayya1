// workers/ledger-lock-do.ts
export interface Env {
  DB: any; // D1
  MIGRATE_TOKEN?: string;
}

function nowIso() { return new Date().toISOString(); }

export class LedgerLock {
  state: DurableObjectState;
  env: Env | undefined;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Helper: D1 collection helpers (read/write JSON stored in collections.name)
  async readCollection(name: string) {
    const db = this.env!.DB;
    const resp = await db.prepare('SELECT data FROM collections WHERE name = ?').bind(name).all();
    const rows = (resp && (resp.results || resp)) || [];
    if (!rows || rows.length === 0) return null;
    try { return JSON.parse(rows[0].data); } catch { return null; }
  }

  async writeCollection(name: string, data: any) {
    const db = this.env!.DB;
    const json = JSON.stringify(data || []);
    await db.prepare('INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)').bind(name, json).run();
  }

  // Idempotency store (in DO durable storage)
  async lookupIdempotency(key: string) {
    if (!key) return null;
    const val = await this.state.storage.get<string>('idem:' + key);
    return val ? JSON.parse(val) : null;
  }
  async storeIdempotency(key: string, result: any) {
    if (!key) return;
    await this.state.storage.put('idem:' + key, JSON.stringify({ result, created_at: nowIso() }));
  }

  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

      const body = await request.json();
      const op = body.op;
      const payload = body.payload || {};
      const idemKey = body.idempotency_key || request.headers.get('x-idempotency-key') || null;

      // If idempotency key present, return stored result when available
      if (idemKey) {
        const prev = await this.lookupIdempotency(idemKey);
        if (prev) return new Response(JSON.stringify(prev.result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      let result: any;
      if (op === 'driver_payment') result = await this.handleDriverPayment(payload);
      else if (op === 'record_expense') result = await this.handleRecordExpense(payload);
      else if (op === 'generate_installments') result = await this.handleGenerateInstallments(payload);
      else return new Response(JSON.stringify({ error: 'unknown_op' }), { status: 400 });

      if (idemKey) await this.storeIdempotency(idemKey, result);
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Business ops ------------------------------------------------------------
  // 1) Apply a driver payment across installments and create ledger + audit
  async handleDriverPayment(payload: any) {
    const driver_id = payload.driver_id;
    const amount = Number(payload.amount || 0);
    if (!driver_id || amount <= 0) throw new Error('driver_id and positive amount required');

    // load collections
    const drivers = (await this.readCollection('drivers')) || [];
    const installments = (await this.readCollection('installments')) || [];
    const payments = (await this.readCollection('driver_payments')) || [];
    const fin_records = (await this.readCollection('financial_records')) || [];
    const fin_ledger = (await this.readCollection('financial_ledger')) || [];
    const audit_logs = (await this.readCollection('audit_logs')) || [];

    const driver = drivers.find((d: any) => d.id === driver_id);
    if (!driver) throw new Error('driver not found');

    const paymentId = `PAY-${Date.now()}-${cryptoRandom(6)}`;
    const paymentRecord = { id: paymentId, driver_id, amount, payment_method: payload.payment_method || 'unknown', reference: payload.reference || null, date: payload.date || new Date().toISOString().split('T')[0], created_at: nowIso() };
    payments.unshift(paymentRecord);

    // find driver installments (ordered)
    const driverInsts = installments.filter((i: any) => i.driver_id === driver_id).sort((a: any, b: any) => a.installment_number - b.installment_number);

    // If none found, we can generate (payload should include cycle info); simple generate if missing
    if (!driverInsts || driverInsts.length === 0) {
      const gen = generateSixInstallments(driver_id, payload.cycle_id || `cycle-${Date.now()}`, payload.agreed_amount_30 || (driver.agreed_amount_30 || 180000), payload.cycle_start_date);
      for (const g of gen) installments.unshift(g);
    }

    // Recompute driverInsts after possible generation
    const insts = installments.filter((i: any) => i.driver_id === driver_id).sort((a: any, b: any) => a.installment_number - b.installment_number);

    // Apply payment across installments
    let remaining = amount;
    for (const inst of insts) {
      if (remaining <= 0) break;
      const rem = Number(inst.remaining ?? (inst.amount_due - (inst.amount_paid || 0)));
      if (rem <= 0) continue;
      const toPay = Math.min(rem, remaining);
      inst.amount_paid = (inst.amount_paid || 0) + toPay;
      inst.remaining = parseFloat(((inst.amount_due || 0) - inst.amount_paid).toFixed(2));
      inst.payment_history = inst.payment_history || [];
      inst.payment_history.push(paymentId);
      inst.status = inst.remaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      remaining = parseFloat((remaining - toPay).toString());
    }

    // Overpayment: keep as company credit (ledger revenue overpayment_credit)
    if (remaining > 0) {
      fin_records.unshift({ id: `LEDGER-${Date.now()}-${cryptoRandom(4)}`, type: 'revenue', category: 'overpayment', amount: remaining, date: new Date().toISOString().split('T')[0], description: `Overpayment credit from ${paymentId}` });
      fin_ledger.unshift({ id: `LEDGER-${Date.now()}-${cryptoRandom(4)}`, type: 'revenue', subtype: 'overpayment_credit', amount: remaining, created_at: nowIso(), driver_id, reference_id: paymentId, description: 'overpayment credit' });
    }

    // Create ledger entry for the payment (full amount)
    const ledgerId = `LEDGER-${Date.now()}-${cryptoRandom(4)}`;
    const ledgerEntry = { id: ledgerId, type: 'revenue', subtype: 'driver_payment', amount, created_at: nowIso(), driver_id, reference_id: paymentId, description: `Driver payment ${paymentId}` };
    fin_records.unshift({ id: ledgerEntry.id, type: ledgerEntry.type, category: ledgerEntry.subtype, amount: ledgerEntry.amount, date: new Date().toISOString().split('T')[0], description: ledgerEntry.description });
    fin_ledger.unshift(ledgerEntry);

    // Audit log entry
    const audit = { id: `AUD-${Date.now()}-${cryptoRandom(4)}`, user_id: payload.actor || null, action: 'DRIVER_PAYMENT', previous_value: null, new_value: { paymentId, driver_id, amount }, created_at: nowIso() };
    audit_logs.unshift(audit);

    // Persist all changed collections
    await this.writeCollection('driver_payments', payments);
    await this.writeCollection('installments', installments);
    await this.writeCollection('financial_records', fin_records);
    await this.writeCollection('financial_ledger', fin_ledger);
    await this.writeCollection('audit_logs', audit_logs);

    return { payment: paymentRecord, updated_installments: insts, ledgerEntry, audit };
  }

  // 2) Record an expense
  async handleRecordExpense(payload: any) {
    const category = payload.category || 'other';
    const amount = Number(payload.amount || 0);
    if (amount <= 0) throw new Error('positive amount required');

    const expenses = (await this.readCollection('expenses')) || [];
    const fin_records = (await this.readCollection('financial_records')) || [];
    const fin_ledger = (await this.readCollection('financial_ledger')) || [];
    const audit_logs = (await this.readCollection('audit_logs')) || [];

    const id = `EXP-${Date.now()}-${cryptoRandom(4)}`;
    const rec = { id, category, amount, date: payload.date || new Date().toISOString().split('T')[0], description: payload.description || '', driver_id: payload.driver_id || null, vehicle_id: payload.vehicle_id || null, created_by: payload.actor || 'system', created_at: nowIso() };
    expenses.unshift(rec);

    // Ledger/outflow
    const ledgerId = `LEDGER-${Date.now()}-${cryptoRandom(4)}`;
    const ledgerEntry = { id: ledgerId, type: 'expense', subtype: category, amount, created_at: nowIso(), reference_id: id, driver_id: rec.driver_id, vehicle_id: rec.vehicle_id, description: rec.description };
    fin_records.unshift({ id: ledgerEntry.id, type: ledgerEntry.type, category: ledgerEntry.subtype, amount: ledgerEntry.amount, date: rec.date, description: rec.description });
    fin_ledger.unshift(ledgerEntry);

    const audit = { id: `AUD-${Date.now()}-${cryptoRandom(4)}`, user_id: payload.actor || null, action: 'RECORD_EXPENSE', previous_value: null, new_value: rec, created_at: nowIso() };
    audit_logs.unshift(audit);

    await this.writeCollection('expenses', expenses);
    await this.writeCollection('financial_records', fin_records);
    await this.writeCollection('financial_ledger', fin_ledger);
    await this.writeCollection('audit_logs', audit_logs);

    return { expense: rec, ledgerEntry, audit };
  }

  // 3) Generate 6 installments for a driver/cycle
  async handleGenerateInstallments(payload: any) {
    const driver_id = payload.driver_id;
    const cycle_id = payload.cycle_id;
    const agreed_amount_30 = Number(payload.agreed_amount_30 || 0);
    if (!driver_id || !cycle_id || agreed_amount_30 <= 0) throw new Error('driver_id, cycle_id and agreed_amount_30 required');

    const installments = (await this.readCollection('installments')) || [];
    const generated = generateSixInstallments(driver_id, cycle_id, agreed_amount_30, payload.cycle_start_date);
    for (const g of generated) installments.unshift(g);
    await this.writeCollection('installments', installments);

    const audit_logs = (await this.readCollection('audit_logs')) || [];
    const audit = { id: `AUD-${Date.now()}-${cryptoRandom(4)}`, user_id: payload.actor || null, action: 'GENERATE_INSTALLMENTS', previous_value: null, new_value: { driver_id, cycle_id, count: generated.length }, created_at: nowIso() };
    audit_logs.unshift(audit);
    await this.writeCollection('audit_logs', audit_logs);

    return { generatedCount: generated.length, installments: generated, audit };
  }
}

// small helpers --------------------------------------------------------------
function cryptoRandom(n = 6) {
  // basic secure random hex
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, n).toUpperCase();
}

function generateSixInstallments(driver_id: string, cycle_id: string, agreed_amount_30: number, cycle_start_date?: string) {
  const start = cycle_start_date ? new Date(cycle_start_date) : new Date();
  const per = parseFloat((agreed_amount_30 / 6).toFixed(2));
  const out: any[] = [];
  for (let k = 1; k <= 6; k++) {
    const startDay = (k - 1) * 5 + 1;
    const endDay = k * 5;
    const s = new Date(start.getTime() + (startDay - 1) * 24 * 3600 * 1000);
    const e = new Date(start.getTime() + (endDay - 1) * 24 * 3600 * 1000);
    out.push({
      id: `INST-${cycle_id}-${driver_id}-${k}`,
      cycle_id,
      driver_id,
      installment_number: k,
      start_date: s.toISOString().split('T')[0],
      end_date: e.toISOString().split('T')[0],
      due_date: e.toISOString().split('T')[0],
      amount_due: per,
      amount_paid: 0,
      remaining: per,
      status: 'DUE',
      payment_history: []
    });
  }
  return out;
        }
