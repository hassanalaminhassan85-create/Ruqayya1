/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Financials {
  vehiclePurchasePrice: number;
  totalAmountPaid: number;
  remainingVehicleBalance: number;
  totalPaymentsMade: number;
  agreedAmount: number;
  openingBalance: any;
  ledgerBalance: number;
  totalDebits: number;
  totalCredits: number;
}

export class FinancialCalculator {
  /**
   * Calculate driver balance from unified ledger: Positive = credit (overpaid), Negative = debit (owes)
   */
  static getDriverBalance(driverId: string, db: any): number {
    const entries = (db.driver_ledger || []).filter((e: any) => e.driverId === driverId);
    return entries.reduce((acc: number, e: any) => 
      e.type === 'debit' ? acc - e.amount : acc + e.amount, 0
    );
  }

  static getDriverLedgerStats(driverId: string, db: any) {
    const entries = (db.driver_ledger || []).filter((e: any) => e.driverId === driverId);
    let totalDebits = 0;
    let totalCredits = 0;
    entries.forEach((e: any) => {
      if (e.type === 'debit') totalDebits += e.amount;
      else totalCredits += e.amount;
    });
    return { balance: totalCredits - totalDebits, totalDebits, totalCredits };
  }

  /**
   * Authoritative calculation engine for driver financials.
   * Uses vehiclePurchasePrice as the static base to prevent double-subtraction drift.
   */
  static getDriverFinancials(driver: any, db: any): Financials {
    const rawPrice = driver.vehicle_purchase_price ?? driver.vehiclePurchasePrice;
    let vehiclePurchasePrice = 15000000;
    if (
      rawPrice !== undefined &&
      rawPrice !== null &&
      !isNaN(parseFloat(rawPrice)) &&
      parseFloat(rawPrice) > 0
    ) {
      vehiclePurchasePrice = parseFloat(rawPrice);
    }

    const rawAgreed = driver.agreed_amount ?? driver.agreedAmount;
    const agreedAmount =
      rawAgreed !== undefined &&
      rawAgreed !== null &&
      !isNaN(parseFloat(rawAgreed))
        ? parseFloat(rawAgreed)
        : 180000;

    const validIds = new Set(
      [
        driver.id,
        driver.user_id,
        driver.userId,
        driver.company_driver_id,
        driver.companyDriverId,
        driver.fullName,
        driver.full_name,
      ].filter(Boolean),
    );

    const isApprovedPayment = (p: any) => {
      if (!p) return false;
      const matchesDriver =
        validIds.has(p.driver_id) ||
        validIds.has(p.driverId) ||
        validIds.has(p.driver_name) ||
        validIds.has(p.driverName);
      if (!matchesDriver) return false;
      const st = (p.status || "").toLowerCase();
      return st === "approved" || st === "completed" || st === "paid";
    };

    const approvedPaymentsInERP = (db.driver_payments || []).filter(
      isApprovedPayment,
    );
    const totalErpPaid = approvedPaymentsInERP.reduce(
      (sum: number, p: any) => sum + (parseFloat(p.amount) || 0),
      0,
    );
    const countErpPaid = approvedPaymentsInERP.length;

    // Sum up all expenses linked to this driver in the central ledger
    const linkedExpenses = (db.financial_records || []).filter((r: any) => {
      if (!r || r.type !== "expense") return false;
      return validIds.has(r.driver_id) || validIds.has(r.driverId);
    });
    const totalLedgerExpenses = linkedExpenses.reduce(
      (sum: number, r: any) => sum + (parseFloat(r.amount) || 0),
      0,
    );

    // Also check driver's own expenseHistory array as a fallback
    const totalHistoryExpenses = (driver.expenseHistory || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.amount) || 0),
      0,
    );

    const totalExpenses = Math.max(totalLedgerExpenses, totalHistoryExpenses);

    let initialRemaining = vehiclePurchasePrice;
    let initialPaid = 0;

    if (driver.opening_balance && driver.opening_balance.is_imported) {
      const openRem = parseFloat(driver.opening_balance.remaining_vehicle_balance ?? driver.opening_balance.remainingVehicleBalance);
      initialRemaining = !isNaN(openRem) ? openRem : vehiclePurchasePrice;
      initialPaid = parseFloat(driver.opening_balance.total_paid_to_date ?? driver.opening_balance.totalPaidToDate) || 0;
    } else {
      initialRemaining = vehiclePurchasePrice;
      initialPaid = 0;
    }

    const totalAmountPaid = initialPaid + totalErpPaid;
    // Calculate remaining balance as: initialRemaining - totalErpPaid + totalExpenses
    // We use totalErpPaid here because initialRemaining already accounts for initialPaid if imported.
    const remainingVehicleBalance = Math.max(0, initialRemaining - totalErpPaid + totalExpenses);

    const ledgerStats = this.getDriverLedgerStats(driver.id, db);

    return {
      vehiclePurchasePrice,
      totalAmountPaid,
      remainingVehicleBalance,
      totalPaymentsMade: countErpPaid,
      agreedAmount,
      openingBalance: driver.opening_balance || null,
      ledgerBalance: ledgerStats.balance,
      totalDebits: ledgerStats.totalDebits,
      totalCredits: ledgerStats.totalCredits
    };
  }

  /**
   * Calculate dynamic installments for a driver based on an active cycle.
   */
  static calculateInstallmentsForDriver(driver: any, db: any, activeCycle: any) {
    const rawAgreed = driver.agreed_amount ?? driver.agreedAmount ?? driver.financials?.agreedAmount;
    const agreedAmount =
      rawAgreed !== undefined && rawAgreed !== null && !isNaN(parseFloat(rawAgreed)) && parseFloat(rawAgreed) > 0
        ? parseFloat(rawAgreed)
        : 180000;
    const installmentTarget = Math.max(20000, Math.round(agreedAmount / 6));

    const cycleStartRaw = activeCycle
      ? activeCycle.startDate || activeCycle.start_time || activeCycle.created_at
      : null;
    const startStr = cycleStartRaw
      ? typeof cycleStartRaw === "string"
        ? cycleStartRaw.split("T")[0]
        : new Date(cycleStartRaw).toISOString().split("T")[0]
      : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];

    const cycleEndRaw = activeCycle ? activeCycle.endDate || activeCycle.end_time : null;
    const endStr = cycleEndRaw
      ? typeof cycleEndRaw === "string"
        ? cycleEndRaw.split("T")[0]
        : new Date(cycleEndRaw).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const validIds = new Set(
      [
        driver.id,
        driver.user_id,
        driver.userId,
        driver.company_driver_id,
        driver.companyDriverId,
        driver.fullName,
        driver.full_name,
      ].filter(Boolean),
    );

    const payments = (db.driver_payments || []).filter((p: any) => {
      const isMatchingDriver =
        validIds.has(p.driver_id) ||
        validIds.has(p.driverId) ||
        validIds.has(p.driver_name) ||
        validIds.has(p.driverName);
      if (!isMatchingDriver || p.status !== "approved") return false;

      // Primary filter: cycleId for precision
      if (p.cycleId && activeCycle && activeCycle.id) {
        return p.cycleId === activeCycle.id;
      }

      // Fallback for legacy records or missing cycle links: Date boundaries
      if (!activeCycle) return true;
      const pDate = new Date(p.date);
      const cStart = new Date(activeCycle.startDate);
      // Use exclusive end date to prevent double counting at boundaries
      const cEnd = activeCycle.endDate ? new Date(activeCycle.endDate) : new Date(Date.now() + 86400000); // Far future if not ended
      return pDate >= cStart && pDate < cEnd;
    });

    const totalApprovedAmount = payments.reduce(
      (sum, p: any) => sum + (parseFloat(p.amount) || 0),
      0,
    );

    let totalRestDays = 0;
    const restHistory = driver.restHistory || [];
    if (activeCycle) {
      restHistory.forEach((rest: any) => {
        const restStart = new Date(rest.startDate);
        const restEnd = new Date(rest.endDate);
        const rawCycleStart =
          activeCycle.startDate || activeCycle.start_time || activeCycle.created_at;
        const cycleStart = rawCycleStart ? new Date(rawCycleStart) : new Date();

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
    const isCurrentlyOnRest =
      driver.status === "off-duty" ||
      restHistory.some((rest: any) => {
        const start = new Date(rest.startDate);
        const end = new Date(rest.endDate);
        return today >= start && today <= end;
      });

    const rawCycleStart = activeCycle
      ? activeCycle.startDate || activeCycle.start_time || activeCycle.created_at
      : null;
    let startDate = rawCycleStart
      ? new Date(rawCycleStart)
      : new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const nowMs = Date.now();
    const cycleStartMs = startDate.getTime();
    const elapsedDays = Math.max(
      1,
      Math.floor((nowMs - cycleStartMs) / (1000 * 60 * 60 * 24)) + 1,
    );
    const currentRealTimeInstallment = Math.min(6, Math.max(1, Math.ceil(elapsedDays / 5)));

    const installments = [];
    let remainingPaidPool = totalApprovedAmount;

    let masterPausedMs = (activeCycle?.totalPausedSeconds || 0) * 1000;
    if (activeCycle?.status === "paused" && activeCycle?.pausedAt) {
      masterPausedMs += Date.now() - new Date(activeCycle.pausedAt).getTime();
    }

    for (let k = 1; k <= 6; k++) {
      const endDay = k * 5;
      const startDay = (k - 1) * 5 + 1;

      const normalEndDate = new Date(startDate.getTime() + (endDay - 1) * 24 * 3600 * 1000);
      const extendedEndDate = new Date(
        normalEndDate.getTime() + totalRestDays * 24 * 3600 * 1000 + masterPausedMs,
      );

      const normalStartDate = new Date(startDate.getTime() + (startDay - 1) * 24 * 3600 * 1000);
      const extendedStartDate = new Date(
        normalStartDate.getTime() + totalRestDays * 24 * 3600 * 1000 + masterPausedMs,
      );

      const dueAmount = installmentTarget;
      const paidAmount = Math.min(dueAmount, remainingPaidPool);
      remainingPaidPool = Math.max(0, remainingPaidPool - paidAmount);

      const remaining = dueAmount - paidAmount;

      let status = "Pending";
      if (remaining <= 0) {
        status = "Completed";
      } else if (paidAmount > 0) {
        status = "Partially Paid";
      } else if (!isCurrentlyOnRest && !driver.overdue_frozen && today > extendedEndDate) {
        status = "Overdue";
      }

      const isCurrentRealTime = k === currentRealTimeInstallment;
      const matchingPayments = payments.filter(
        (p: any) => p.installment_number === k || p.installmentNumber === k,
      );

      installments.push({
        installmentNumber: k,
        dueAmount,
        paidAmount,
        remainingAmount: remaining,
        startDate: extendedStartDate.toISOString().split("T")[0],
        endDate: extendedEndDate.toISOString().split("T")[0],
        status,
        isCurrentRealTime,
        payments: matchingPayments.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          receiptNumber: p.receipt_number || p.receiptNumber || "RTL-REC",
          approvedBy: p.approved_by || p.recorded_by || p.approvedBy || "Admin",
          date: p.date || p.created_at || new Date().toISOString(),
          paymentMethod: p.payment_method || p.paymentMethod || "Bank Transfer",
          remarks: p.remarks || p.notes || "",
        })),
      });
    }

    return installments;
  }

  /**
   * Recalculates the company wallet balance based on financial records.
   */
  static calculateCompanyWallet(db: any) {
    if (!db.company_settings) db.company_settings = {};
    if (db.company_settings.wallet_initial_amount === undefined) {
      db.company_settings.wallet_initial_amount = db.company_settings.wallet_balance !== undefined ? db.company_settings.wallet_balance : 0;
    }
    const totalRev = (db.financial_records || []).filter((f: any) => f.type === 'revenue' || f.type === 'deposit').reduce((sum: number, f: any) => sum + (parseFloat(f.amount) || 0), 0);
    const totalExp = (db.financial_records || []).filter((f: any) => f.type === 'expense' || f.type === 'withdrawal').reduce((sum: number, f: any) => sum + (parseFloat(f.amount) || 0), 0);
    
    const newBalance = (parseFloat(db.company_settings.wallet_initial_amount) || 0) + totalRev - totalExp;
    return newBalance;
  }
}
