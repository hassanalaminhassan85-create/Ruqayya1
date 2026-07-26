export interface Env {
  DB: any; // D1
  MIGRATE_TOKEN?: string;
  DUAL_WRITE?: string; // '1' or '0' or absent
}

function nowIso() { return new Date().toISOString(); }
const DEFAULT_DUAL_WRITE = true; // default for migration safety

export class LedgerLock {
  state: any;
  env: Env | undefined;

  constructor(state: any, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Small helpers
  toKobo(v: any) {
    // Accept integer kobo or decimal naira; prefer integers, otherwise convert
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    if (Number.isInteger(n)) return n;
    // assume provided in naira (float) -> convert to kobo
    return Math.round(n * 100);
  }

  async runTransaction(statements: Array<{ sql: string, binds?: any[] }>) {
    const db = this.env!.DB;
    await db.prepare('BEGIN').run();
    try {
      for (const s of statements) {
        const p = db.prepare(s.sql);
        if (s.binds && s.binds.length) p.bind(...s.binds);
        await p.run();
      }
      await db.prepare('COMMIT').run();
    } catch (e) {
      await db.prepare('ROLLBACK').run().catch(() => {});
      throw e;
    }
  }

  // Legacy collections helpers (dual-write support)
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

  // Idempotency
  async lookupIdempotency(key: string) {
    if (!key) return null;
    const val = await this.state.storage.get('idem:' + key);
    return val ? JSON.parse(val) : null;
  }
  async storeIdempotency(key: string, result: any) {
    if (!key) return;
    await this.state.storage.put('idem:' + key, JSON.stringify({ result, created_at: nowIso() }));
  }

  dualWriteEnabled(): boolean {
    try {
      if (!this.env) return DEFAULT_DUAL_WRITE;
      const v = (this.env as any).DUAL_WRITE ?? (this.env as any).DUAL_WRITE;
      if (v === undefined || v === null) return DEFAULT_DUAL_WRITE;
      return String(v) === '1' || String(v).toLowerCase() === 'true';
    } catch {
      return DEFAULT_DUAL_WRITE;
    }
  }

  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

      const body = await request.json();
      const op = body.op;
      const payload = body.payload || {};
      const idemKey = body.idempotency_key || request.headers.get('x-idempotency-key') || null;

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

  // Business ops
  async handleDriverPayment(payload: any) {
    const driver_id = payload.driver_id;
    const rawAmount = payload.amount;
    if (!driver_id || rawAmount == null) throw new Error('driver_id and amount required');

    const amount = this.toKobo(rawAmount); // integer kobo
    if (amount <= 0) throw new Error('positive amount required');

    const db = this.env!.DB;
    const dual = this.dualWriteEnabled();

    // Generate ids
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const ledgerId = `LEDGER-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const walletTxId = `WAL-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const auditId = `AUD-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

    // Load installments for the driver (normalized)
    const instRows = await db.prepare('SELECT id, amount_due, amount_paid, remaining FROM installments WHERE driver_id = ? ORDER BY installment_number').bind(driver_id).all();
    const insts = (instRows && (instRows.results || instRows)) || [];

    // If no installments found and payload provides cycle info, generate simple six installments in-memory and insert
    if (insts.length === 0 && payload.agreed_amount_30) {
      // create 6 installments and insert them
      const per = Math.floor(this.toKobo(payload.agreed_amount_30) / 6);
      const stmts: any[] = [];
      for (let k = 1; k <= 6; k++) {
        const id = `INST-${payload.cycle_id || 'cycle'}-${driver_id}-${k}`;
        stmts.push({
          sql: `INSERT OR REPLACE INTO installments (id, cycle_id, driver_id, installment_number, amount_due, amount_paid, remaining, status, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, 'DUE', ?)`,
          binds: [id, payload.cycle_id || `cycle-${Date.now()}`, driver_id, k, per, per, nowIso()]
        });
      }
      await this.runTransaction(stmts);
    }

    // re-read installments
    const instRows2 = await db.prepare('SELECT id, amount_due, amount_paid, remaining FROM installments WHERE driver_id = ? ORDER BY installment_number').bind(driver_id).all();
    const driverInsts = (instRows2 && (instRows2.results || instRows2)) || [];

    // Compute statement list
    const stmts: Array<{ sql: string, binds?: any[] }> = [];

    // Insert driver payment row (store amount in kobo)
    stmts.push({
      sql: `INSERT INTO driver_payments (id, driver_id, vehicle_id, cycle_id, installment_id, amount, payment_method, reference, payment_date, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      binds: [paymentId, driver_id, payload.vehicle_id || null, payload.cycle_id || null, payload.installment_id || null, amount, payload.payment_method || null, payload.reference || null, payload.payment_date || nowIso(), payload.actor || null, nowIso()]
    });

    // Apply amount across installments
    let remaining = amount;
    for (const r of driverInsts) {
      if (remaining <= 0) break;
      const instId = r.id;
      const rem = Number(r.remaining ?? (r.amount_due - (r.amount_paid || 0)));
      if (rem <= 0) continue;
      const toPay = Math.min(rem, remaining);
      // update installment atomically
      const newPaidBind = toPay;
      stmts.push({
        sql: `UPDATE installments SET amount_paid = amount_paid + ?, remaining = amount_due - (amount_paid + ?), payment_history = COALESCE(payment_history, '[]') WHERE id = ?`,
        binds: [newPaidBind, newPaidBind, instId]
      });
      // Push audit per-installment if desired (skipped here to reduce volume)
      remaining -= toPay;
    }

    // If overpayment remains, create an overpayment ledger entry
    if (remaining > 0) {
      stmts.push({
        sql: `INSERT INTO financial_ledger (id, type, subtype, amount, created_at, driver_id, reference_id, description) VALUES (?, 'income', 'overpayment_credit', ?, ?, ?, ?, ?)`,
        binds: [`${ledgerId}-OP`, remaining, nowIso(), driver_id, paymentId, `Overpayment credit for ${paymentId}`]
      });
      // Increase company wallet by overpayment amount
      stmts.push({
        sql: `INSERT INTO company_wallet_transactions (id, type, category, amount, date, reference_id, description, created_by, created_at) VALUES (?, 'IN', 'overpayment', ?, ?, ?, ?, ?, ?)`,
        binds: [walletTxId + '-OP', remaining, nowIso(), paymentId, `Overpayment credit ${paymentId}`, payload.actor || null, nowIso()]
      });
      stmts.push({
        sql: `UPDATE company_settings SET wallet_balance = COALESCE(wallet_balance,0) + ? WHERE id = 1`,
        binds: [remaining]
      });
    }

    // Insert the main ledger entry for the payment (full amount)
    stmts.push({
      sql: `INSERT INTO financial_ledger (id, type, subtype, amount, created_at, driver_id, reference_id, description) VALUES (?, 'income', 'driver_payment', ?, ?, ?, ?, ?)`,
      binds: [ledgerId, amount, nowIso(), driver_id, paymentId, `Driver payment ${paymentId}`]
    });

    // Insert wallet transaction and update balance
    stmts.push({
      sql: `INSERT INTO company_wallet_transactions (id, type, category, amount, date, reference_id, description, created_by, created_at) VALUES (?, 'IN', 'driver_payment', ?, ?, ?, ?, ?, ?)`,
      binds: [walletTxId, amount, nowIso(), paymentId, `Driver payment ${paymentId}`, payload.actor || null, nowIso()]
    });
    stmts.push({
      sql: `UPDATE company_settings SET wallet_balance = COALESCE(wallet_balance,0) + ? WHERE id = 1`,
      binds: [amount]
    });

    // Audit entry
    stmts.push({
      sql: `INSERT INTO audit_logs (id, user_id, action, previous_value, new_value, reference_id, created_at) VALUES (?, ?, 'DRIVER_PAYMENT', NULL, ?, ?, ?)`,
      binds: [auditId, payload.actor || null, JSON.stringify({ paymentId, driver_id, amount }), paymentId, nowIso()]
    });

    // Run all statements inside a transaction
    await this.runTransaction(stmts);

    // Dual-write to legacy collections if enabled (best-effort, not transactional)
    if (dual) {
      try {
        const payments = (await this.readCollection('driver_payments')) || [];
        payments.unshift({ id: paymentId, driver_id, amount, created_at: nowIso(), metadata: payload });
        await this.writeCollection('driver_payments', payments);

        const ledger = (await this.readCollection('financial_ledger')) || [];
        ledger.unshift({ id: ledgerId, type: 'income', subtype: 'driver_payment', amount, created_at: nowIso(), driver_id, reference_id: paymentId });
        await this.writeCollection('financial_ledger', ledger);

        const audits = (await this.readCollection('audit_logs')) || [];
        audits.unshift({ id: auditId, user_id: payload.actor || null, action: 'DRIVER_PAYMENT', new_value: { paymentId, driver_id, amount }, created_at: nowIso() });
        await this.writeCollection('audit_logs', audits);
      } catch (e) {
        // do not fail the main transaction for legacy write failures; log and continue
        console.warn('Dual-write legacy collections failed', e);
      }
    }

    return { success: true, paymentId, ledgerId, walletTxId };
  }

  // Expense handler (similar pattern)
  async handleRecordExpense(payload: any) {
    const amount = this.toKobo(payload.amount);
    if (amount <= 0) throw new Error('positive amount required');
    const db = this.env!.DB;
    const dual = this.dualWriteEnabled();

    const expenseId = `EXP-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const ledgerId = `LEDGER-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const walletTxId = `WAL-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const auditId = `AUD-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

    const stmts: Array<{ sql: string, binds?: any[] }> = [];

    stmts.push({
      sql: `INSERT INTO expenses (id, category, amount, driver_id, vehicle_id, description, date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      binds: [expenseId, payload.category || 'other', amount, payload.driver_id || null, payload.vehicle_id || null, payload.description || null, payload.date || nowIso(), payload.actor || null, nowIso()]
    });

    // Ledger/outflow
    stmts.push({
      sql: `INSERT INTO financial_ledger (id, type, subtype, amount, created_at, reference_id, driver_id, vehicle_id, description) VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?)`,
      binds: [ledgerId, payload.category || 'expense', amount, nowIso(), expenseId, payload.driver_id || null, payload.vehicle_id || null, payload.description || null]
    });

    // Wallet out
    stmts.push({
      sql: `INSERT INTO company_wallet_transactions (id, type, category, amount, date, reference_id, description, created_by, created_at) VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?, ?)`,
      binds: [walletTxId, payload.category || 'expense', amount, nowIso(), expenseId, payload.description || null, payload.actor || null, nowIso()]
    });
    stmts.push({
      sql: `UPDATE company_settings SET wallet_balance = COALESCE(wallet_balance,0) - ? WHERE id = 1`,
      binds: [amount]
    });

    // Audit
    stmts.push({
      sql: `INSERT INTO audit_logs (id, user_id, action, previous_value, new_value, reference_id, created_at) VALUES (?, ?, 'RECORD_EXPENSE', NULL, ?, ?, ?)`,
      binds: [auditId, payload.actor || null, JSON.stringify({ expenseId, amount }), expenseId, nowIso()]
    });

    await this.runTransaction(stmts);

    if (dual) {
      try {
        const ex = (await this.readCollection('expenses')) || [];
        ex.unshift({ id: expenseId, category: payload.category || 'other', amount, driver_id: payload.driver_id || null, vehicle_id: payload.vehicle_id || null, created_at: nowIso() });
        await this.writeCollection('expenses', ex);

        const ledger = (await this.readCollection('financial_ledger')) || [];
        ledger.unshift({ id: ledgerId, type: 'expense', subtype: payload.category || 'expense', amount, created_at: nowIso(), reference_id: expenseId });
        await this.writeCollection('financial_ledger', ledger);
      } catch (e) {
        console.warn('Dual-write legacy collections failed', e);
      }
    }

    return { success: true, expenseId, ledgerId, walletTxId };
  }

  // Generate installments (simpler: insert normalized rows)
  async handleGenerateInstallments(payload: any) {
    const driver_id = payload.driver_id;
    const cycle_id = payload.cycle_id || `cycle-${Date.now()}`;
    const agreed_30 = this.toKobo(payload.agreed_amount_30 || 0);
    if (!driver_id || agreed_30 <= 0) throw new Error('driver_id and agreed_amount_30 required');

    const per = Math.floor(agreed_30 / 6);
    const stmts: Array<{ sql: string, binds?: any[] }> = [];
    for (let k = 1; k <= 6; k++) {
      const id = `INST-${cycle_id}-${driver_id}-${k}`;
      stmts.push({
        sql: `INSERT OR REPLACE INTO installments (id, cycle_id, driver_id, installment_number, start_date, end_date, due_date, amount_due, amount_paid, remaining, status, payment_history, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'DUE', '[]', ?)`,
        binds: [id, cycle_id, driver_id, k, payload.cycle_start_date || nowIso(), payload.cycle_end_date || nowIso(), payload.cycle_end_date || nowIso(), per, per, nowIso()]
      });
    }

    await this.runTransaction(stmts);

    if (this.dualWriteEnabled()) {
      try {
        const current = (await this.readCollection('installments')) || [];
        for (let k = 1; k <= 6; k++) {
          const id = `INST-${cycle_id}-${driver_id}-${k}`;
          current.unshift({ id, cycle_id, driver_id, installment_number: k, amount_due: per, amount_paid: 0, remaining: per, status: 'DUE' });
        }
        await this.writeCollection('installments', current);
      } catch (e) { console.warn('Dual-write install failed', e); }
    }

    return { success: true, generated: 6, cycle_id };
  }
}
