
/**
 * Migration script to fix corrupted driver records with incorrect vehicle balances.
 * 
 * PROBLEM: Double-Subtraction Bug and Expense Fallback Bug corrupted financial fields.
 * SOLUTION: Recalculate total_amount_paid, remaining_vehicle_balance, and ownership_percentage
 * based on the source of truth (approved payments and the original purchase price).
 */

import { loadDB, saveDB, generateUUID, initCloudPersistence } from '../utils/server_db';

async function runMigration() {
  console.log('--- STARTING DRIVER BALANCE MIGRATION ---');
  
  // Sync with Firestore first
  await initCloudPersistence();
  
  const db = loadDB();
  const logs: any[] = [];
  let fixedCount = 0;
  let reviewedCount = 0;

  if (!db.drivers || !Array.isArray(db.drivers)) {
    console.error('No drivers found in database.');
    return;
  }

  db.drivers.forEach((drv: any) => {
    const originalPrice = parseFloat(drv.vehicle_purchase_price ?? drv.vehiclePurchasePrice);
    const driverId = drv.id;
    
    // Define identifiers for matching payments
    const validIds = new Set([
      drv.id,
      drv.user_id,
      drv.userId,
      drv.company_driver_id,
      drv.companyDriverId,
      drv.fullName,
      drv.full_name
    ].filter(Boolean));

    // Calculate total paid from approved payments in the central ledger
    const approvedPayments = (db.driver_payments || []).filter((p: any) => {
      const matchesDriver = validIds.has(p.driver_id) || validIds.has(p.driverId) || validIds.has(p.driver_name) || validIds.has(p.driverName);
      const status = (p.status || '').toLowerCase();
      return matchesDriver && (status === 'approved' || status === 'completed' || status === 'paid');
    });

    const totalPaid = approvedPayments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

    // Skip if price is corrupted (suspiciously low)
    if (originalPrice < 1000000) {
      logs.push({
        driverId: drv.id,
        driverName: drv.fullName || drv.full_name,
        vehiclePrice: originalPrice,
        issue: 'SUSPICIOUSLY_LOW_PRICE',
        action: 'REQUIRES_MANUAL_REVIEW'
      });
      reviewedCount++;
      return;
    }

    // Recalculate balances
    const oldPaid = drv.total_amount_paid ?? 0;
    const oldRemaining = drv.remaining_vehicle_balance ?? 0;
    const oldPercent = drv.ownership_percentage ?? 0;

    drv.total_amount_paid = totalPaid;
    drv.totalAmountPaid = totalPaid;
    
    // remaining_vehicle_balance = vehiclePurchasePrice - total_amount_paid
    // Note: We might also want to account for opening balance if it exists
    let initialPaid = 0;
    if (drv.opening_balance && drv.opening_balance.is_imported) {
       initialPaid = parseFloat(drv.opening_balance.total_paid_to_date ?? drv.opening_balance.totalPaidToDate) || 0;
    }
    
    const finalTotalPaid = totalPaid + initialPaid;
    drv.total_amount_paid = finalTotalPaid;
    drv.totalAmountPaid = finalTotalPaid;

    drv.remaining_vehicle_balance = Math.max(0, originalPrice - finalTotalPaid);
    drv.remainingVehicleBalance = drv.remaining_vehicle_balance;

    drv.ownership_percentage = originalPrice > 0 ? (finalTotalPaid / originalPrice) * 100 : 0;

    logs.push({
      driverId: drv.id,
      driverName: drv.fullName || drv.full_name,
      vehiclePrice: originalPrice,
      previousPaid: oldPaid,
      newPaid: finalTotalPaid,
      previousRemaining: oldRemaining,
      newRemaining: drv.remaining_vehicle_balance,
      previousPercent: oldPercent,
      newPercent: drv.ownership_percentage,
      action: 'recalculated_from_approved_payments'
    });
    fixedCount++;
  });

  // Save the logs for audit in the DB
  const migrationLogEntry = {
    id: `MIG-${Date.now()}`,
    date: new Date().toISOString(),
    type: 'fix_driver_balances',
    driversProcessed: db.drivers.length,
    fixedCount,
    reviewedCount,
    logs: logs
  };

  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.unshift({
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    userId: 'system-migration',
    userRole: 'admin',
    action: 'DATA_MIGRATION_DRIVER_BALANCES',
    details: `Processed ${db.drivers.length} drivers. Fixed: ${fixedCount}, Flagged: ${reviewedCount}.`,
    ipAddress: '127.0.0.1'
  });

  // We could also store it in a specific migration_logs collection if it existed, but audit_logs is safer for now.
  // The user requested db.migration_logs specifically in their example.
  if (!(db as any).migration_logs) (db as any).migration_logs = [];
  (db as any).migration_logs.push(migrationLogEntry);

  saveDB(db);

  console.log(`--- MIGRATION COMPLETE ---`);
  console.log(`Processed: ${db.drivers.length}`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Flagged: ${reviewedCount}`);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
