#!/usr/bin/env node
// workers/migration-normalize.ts
// Migration tool: dry-run and apply modes to convert collections JSON into normalized SQL tables.

const fs = require('fs');
const path = require('path');

const UNIT = process.argv.includes('--unit=kobo') ? 'kobo' : 'kobo';
const DRY = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');

if (!DRY && !APPLY) {
  console.error('Usage: node migration-normalize.js --dry-run|--apply [--unit=kobo]');
  process.exit(1);
}

const DB_FILE = path.join(process.cwd(), 'storage', 'db.json.bak.2026-07-25T20-58-06Z.json');
if (!fs.existsSync(DB_FILE)) {
  console.error('Backup file not found:', DB_FILE);
  process.exit(1);
}

const raw = fs.readFileSync(DB_FILE, 'utf8');
const doc = JSON.parse(raw);

function toKobo(n) {
  if (n === null || n === undefined) return 0;
  const f = Number(n);
  if (Number.isNaN(f)) return 0;
  return Math.round(f * 100);
}

// summarize
console.log('Backup top-level collections and counts:');
Object.keys(doc).forEach(k => {
  const v = doc[k];
  if (Array.isArray(v)) console.log(` - ${k}: ${v.length}`);
  else if (v && typeof v === 'object') console.log(` - ${k}: object`);
  else console.log(` - ${k}: ${String(v).slice(0,80)}`);
});

if (DRY) {
  console.log('\nDRY RUN: sample conversions');
  // drivers
  const drivers = doc.drivers || [];
  console.log(`drivers => ${drivers.length} rows`);
  if (drivers.length > 0) console.log('sample driver:', drivers[0]);

  const shareholders = doc.shareholders || [];
  console.log(`shareholders => ${shareholders.length} rows`);
  if (shareholders.length > 0) console.log('sample shareholder:', shareholders[0]);

  const fin = doc.financial_records || [];
  console.log(`financial_records => ${fin.length} rows`);
  if (fin.length > 0) console.log('sample financial:', fin[0]);

  // money conversion check
  const samplesWithMoney = [];
  fin.slice(0,30).forEach(r => { if (r.amount) samplesWithMoney.push({id:r.id, amount:r.amount, toKobo: toKobo(r.amount)}); });
  console.log('sample money conversions:', samplesWithMoney.slice(0,10));

  console.log('\nDRY RUN complete. No changes made.');
  process.exit(0);
}

if (APPLY) {
  console.log('APPLY mode: building normalized SQL statements');
  const statements = [];
  // insert company_settings single row
  const cs = doc.company_settings || {};
  const wallet_initial = cs.wallet_initial ? toKobo(cs.wallet_initial) : 0;
  const wallet_balance = cs.wallet_balance ? toKobo(cs.wallet_balance) : 0;
  statements.push(`INSERT OR REPLACE INTO company_settings (id, currency, wallet_balance, wallet_initial, created_at) VALUES (1, '${(cs.currency||'₦')}', ${wallet_balance}, ${wallet_initial}, '${new Date().toISOString()}');`);

  // drivers
  const drivers = doc.drivers || [];
  drivers.forEach(d => {
    const vehicle_purchase_amount = d.vehicle_purchase_amount ? toKobo(d.vehicle_purchase_amount) : 0;
    const vehicle_remaining_amount = d.remainingVehicleBalance ? toKobo(d.remainingVehicleBalance) : (d.vehicle_remaining_amount ? toKobo(d.vehicle_remaining_amount) : 0);
    const agreed_amount_30 = d.agreedAmount ? toKobo(d.agreedAmount) : (d.agreed_amount_30 ? toKobo(d.agreed_amount_30) : 0);
    statements.push(`INSERT OR REPLACE INTO drivers (id, user_id, rtl_id, name, phone, assigned_vehicle_id, vehicle_purchase_amount, vehicle_remaining_amount, agreed_amount_30, created_at) VALUES ('${d.id}','${d.user_id||''}','${d.rtl_id||''}','${(d.full_name||d.name||'').replace(/'/g,"''")}','${d.phone||''}','${d.assigned_vehicle_id||''}',${vehicle_purchase_amount},${vehicle_remaining_amount},${agreed_amount_30},'${d.created_at||new Date().toISOString()}');`);
  });

  // shareholders
  const shareholders = doc.shareholders || [];
  shareholders.forEach(s => {
    const invest = s.investment_amount ? toKobo(s.investment_amount) : 0;
    statements.push(`INSERT OR REPLACE INTO shareholders (id, name, investment_amount, distribution_percentage, created_at) VALUES ('${s.id}','${(s.full_name||'').replace(/'/g,"''")}',${invest},${s.distribution_percentage||0},'${s.investment_date||new Date().toISOString()}');`);
  });

  // financial_records -> financial_ledger (summary)
  const frec = doc.financial_records || [];
  frec.forEach(fr => {
    const amt = fr.amount ? toKobo(fr.amount) : 0;
    const type = (fr.type === 'expense' ? 'expense' : 'income');
    statements.push(`INSERT OR REPLACE INTO financial_records (id, type, category, amount, date, description, created_at) VALUES ('${fr.id||'FR-'+Date.now()}', '${type}', '${(fr.category||'').replace(/'/g,"''")}', ${amt}, '${fr.date||new Date().toISOString().split('T')[0]}', '${(fr.description||'').replace(/'/g,"''")}', '${new Date().toISOString()}');`);
    statements.push(`INSERT OR REPLACE INTO financial_ledger (id, type, subtype, amount, created_at, driver_id, vehicle_id, reference_id, description) VALUES ('${fr.id||'FL-'+Date.now()}', '${type === 'income' ? 'income' : 'expense'}', '${(fr.category||'').replace(/'/g,"''")}', ${amt}, '${new Date().toISOString()}', '${fr.driver_id||''}', '${fr.vehicle_id||''}', '${fr.reference_id||''}', '${(fr.description||'').replace(/'/g,"''")}');`);
  });

  // driver_payments
  const dps = doc.driver_payments || [];
  dps.forEach(p => {
    const amt = p.amount ? toKobo(p.amount) : 0;
    statements.push(`INSERT OR REPLACE INTO driver_payments (id, driver_id, vehicle_id, cycle_id, installment_id, amount, payment_method, reference, payment_date, recorded_by, created_at) VALUES ('${p.id}','${p.driver_id||''}','${p.vehicle_id||''}','${p.cycle_id||''}','${p.installment_id||''}',${amt},'${p.payment_method||''}','${p.reference||''}','${p.date||new Date().toISOString().split('T')[0]}','${p.recorded_by||''}','${p.created_at||new Date().toISOString()}');`);
  });

  // installments
  const insts = doc.installments || [];
  insts.forEach(i => {
    const amtDue = i.amount_due ? toKobo(i.amount_due) : 0;
    const amtPaid = i.amount_paid ? toKobo(i.amount_paid) : 0;
    const remaining = i.remaining ? toKobo(i.remaining) : (amtDue-amtPaid);
    const payHist = i.payment_history ? JSON.stringify(i.payment_history) : '[]';
    statements.push(`INSERT OR REPLACE INTO installments (id, cycle_id, driver_id, installment_number, start_date, end_date, due_date, amount_due, amount_paid, remaining, paid_date, payment_history, status, created_at) VALUES ('${i.id}','${i.cycle_id||''}','${i.driver_id||''}',${i.installment_number||0},'${i.start_date||''}','${i.end_date||''}','${i.due_date||''}',${amtDue},${amtPaid},${remaining},'${i.paid_date||''}','${payHist.replace(/'/g,"''")}', '${i.status||'DUE'}','${i.created_at||new Date().toISOString()}');`);
  });

  // expenses
  const exps = doc.expenses || [];
  exps.forEach(e => {
    const amt = e.amount ? toKobo(e.amount) : 0;
    statements.push(`INSERT OR REPLACE INTO expenses (id, category, amount, driver_id, vehicle_id, description, date, created_by, created_at) VALUES ('${e.id}','${(e.category||'').replace(/'/g,"''")} ', ${amt}, '${e.driver_id||''}', '${e.vehicle_id||''}', '${(e.description||'').replace(/'/g,"''")}', '${e.date||new Date().toISOString().split('T')[0]}', '${e.created_by||''}', '${e.created_at||new Date().toISOString()}');`);
  });

  // payroll runs (if any)
  const pr = doc.payroll_runs || [];
  pr.forEach(p => {
    statements.push(`INSERT OR REPLACE INTO payroll_records (id, staff_id, cycle_id, driver_count, per_driver_amount, total_amount, paid, paid_at, created_at) VALUES ('${p.id}','${p.staff_id||''}','${p.cycle_id||''}',${p.driver_count||0},${p.per_driver_amount||0},${p.total_amount||0},${p.paid?1:0},'${p.paid_at||''}','${p.created_at||new Date().toISOString()}');`);
  });

  // Save statements to file for manual inspection and execution
  const outFile = path.join(process.cwd(), 'sql', 'normalized-import.sql');
  fs.writeFileSync(outFile, statements.join('\n'));
  console.log('Wrote normalized SQL to', outFile);
  console.log('To apply: run these statements against your D1 database (or use a worker to execute them).');
  process.exit(0);
}
