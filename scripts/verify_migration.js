#!/usr/bin/env node
/*
scripts/verify_migration.js

Automated verification script for the normalized D1 migration.

Requirements:
- Node.js (>=16)
- wrangler CLI must be installed and authenticated (wrangler whoami)
- Run from the project root where wrangler.toml is present

Usage:
  node scripts/verify_migration.js --binding DB

This script runs several verification SQL queries against the D1 database using
`wrangler d1 execute` and prints a pass/fail summary. It attempts to parse numeric
results from wrangler output. Review the raw query outputs if parsing fails.

Note: This script does not modify your database.
*/

const { execSync } = require('child_process');

function runWranglerSql(binding, sql) {
  try {
    const cmd = `wrangler d1 execute --binding ${binding} --sql "${sql.replace(/"/g, '\\"')}"`;
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return out.trim();
  } catch (e) {
    return { error: true, message: (e.stdout || e.stderr || e.message).toString() };
  }
}

function extractNumber(s) {
  if (!s) return null;
  // Try to find the first integer or float in the output
  const m = s.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/);
  if (m) return Number(m[0]);
  return null;
}

function printSection(title) {
  console.log('\n=== ' + title + ' ===');
}

function exitWithFail() {
  console.log('\nSome checks failed or returned unexpected results. Inspect the raw outputs above.');
  process.exit(2);
}

function usageAndExit() {
  console.log('Usage: node scripts/verify_migration.js --binding DB');
  process.exit(1);
}

// --- entrypoint ---
const argv = process.argv.slice(2);
if (argv.length < 2 || argv[0] !== '--binding') usageAndExit();
const BINDING = argv[1];
console.log('Using D1 binding:', BINDING);

let allOk = true;

// 1) Schema: list tables
printSection('Schema: tables list');
let out = runWranglerSql(BINDING, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
if (out && out.error) {
  console.error('Error running schema query:', out.message);
  allOk = false;
} else {
  console.log('Raw output:\n', out);
}

// Helper to run a numeric query and assert non-negative
function numericCheck(sql, label, mustBeNonNegative = true) {
  printSection(label);
  const res = runWranglerSql(BINDING, sql);
  if (res && res.error) {
    console.error('Error:', res.message);
    allOk = false;
    return null;
  }
  console.log('Raw output:\n', res);
  const num = extractNumber(res);
  console.log('Parsed number:', num);
  if (num === null || (mustBeNonNegative && num < 0)) {
    console.error('Unexpected numeric result for', label);
    allOk = false;
  }
  return num;
}

// 2) Row counts
const driversCount = numericCheck("SELECT COUNT(*) AS drivers FROM drivers;", 'Drivers count');
const instCount = numericCheck("SELECT COUNT(*) AS installments FROM installments;", 'Installments count');
const paymentsCount = numericCheck("SELECT COUNT(*) AS driver_payments FROM driver_payments;", 'Driver payments count');

// 3) Ledger totals
const incomeTotal = numericCheck("SELECT COALESCE(SUM(amount),0) AS income_total FROM financial_ledger WHERE type='income';", 'Income total');
const expenseTotal = numericCheck("SELECT COALESCE(SUM(amount),0) AS expense_total FROM financial_ledger WHERE type='expense';", 'Expense total');

// 4) Wallet reconciliation
const recomputed = numericCheck("SELECT COALESCE(SUM(CASE WHEN type='IN' THEN amount WHEN type='OUT' THEN -amount END),0) AS recomputed FROM company_wallet_transactions;", 'Recomputed wallet from transactions');
const storedWallet = numericCheck("SELECT wallet_balance FROM company_settings WHERE id = 1;", 'Stored wallet_balance');

if (recomputed !== null && storedWallet !== null) {
  printSection('Wallet reconciliation');
  console.log('Recomputed:', recomputed, 'Stored:', storedWallet);
  if (Math.abs(recomputed - storedWallet) !== 0) {
    console.warn('Wallet mismatch: recomputed != stored (values above). This requires investigation.');
    allOk = false;
  } else {
    console.log('Wallet reconciliation OK');
  }
}

// 5) Outstanding per driver (top 5)
printSection('Top 5 driver outstanding (installment remaining)');
out = runWranglerSql(BINDING, "SELECT driver_id, SUM(remaining) AS outstanding FROM installments GROUP BY driver_id ORDER BY outstanding DESC LIMIT 5;");
if (out && out.error) { console.error('Error:', out.message); allOk = false; }
else console.log('Raw output:\n', out);

// 6) Recent ledger entries (count last 7 days)
const recentLedger = numericCheck("SELECT COUNT(*) AS recent_ledger FROM financial_ledger WHERE datetime(created_at) >= datetime('now','-7 days');", 'Recent ledger entries (7d count)');

// 7) Audit logs presence
const auditCount = numericCheck("SELECT COUNT(*) AS audits FROM audit_logs;", 'Audit logs count');

// 8) Sample checks for driver_payments with ledger linkage
printSection('Sample driver_payments and matching ledger rows');
out = runWranglerSql(BINDING, "SELECT id, driver_id, amount, payment_date FROM driver_payments ORDER BY created_at DESC LIMIT 5;");
if (out && out.error) { console.error('Error:', out.message); allOk = false; }
else console.log('Raw output:\n', out);

out = runWranglerSql(BINDING, "SELECT id, subtype, amount, created_at, driver_id, reference_id FROM financial_ledger ORDER BY created_at DESC LIMIT 10;");
if (out && out.error) { console.error('Error:', out.message); allOk = false; }
else console.log('Raw output:\n', out);

// Final summary
console.log('\n=== SUMMARY ===');
if (allOk) {
  console.log('All checks passed (or returned parseable results). Review the raw outputs above to confirm details.');
  process.exit(0);
} else {
  console.error('One or more checks failed or returned unexpected results. Inspect the outputs above.');
  process.exit(2);
}
