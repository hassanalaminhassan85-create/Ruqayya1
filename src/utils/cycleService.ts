/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';

export interface ActiveCycleData {
  cycleId: string;
  isActive: boolean;
  status: 'active' | 'paused' | 'inactive';
  startDate: string;
  endDate: string;
  extendedDays?: number;
  pauseDays?: number;
  drivers: number;
  fleet: number;
  remit: number;
  health: string;
  cycleDay: string;
  pausedAt?: string;
  pauseReason?: string;
  pauseHistory?: any[];
  created_at?: string;
}

const DEFAULT_ACTIVE_CYCLE: ActiveCycleData = {
  cycleId: 'CYC-2026-001',
  isActive: true,
  status: 'active',
  startDate: '2026-07-29',
  endDate: '2026-08-28',
  extendedDays: 0,
  pauseDays: 0,
  drivers: 4,
  fleet: 4,
  remit: 45000,
  health: 'Optimal',
  cycleDay: 'Day 2 of 30'
};

export function subscribeToActiveCycle(onUpdate: (data: ActiveCycleData | null) => void) {
  const docRef = doc(db, 'system_status', 'activeCycle');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as ActiveCycleData;
      
      // Calculate and log end date verification with extension days
      const start = data.startDate ? new Date(data.startDate).getTime() : new Date('2026-07-29').getTime();
      const baseEnd = start + 30 * 24 * 3600 * 1000;
      const extension = data.extendedDays || data.pauseDays || 0;
      const calculatedEndTimestamp = baseEnd + extension * 24 * 3600 * 1000;
      const calculatedEndDateStr = new Date(calculatedEndTimestamp).toISOString().split('T')[0];

      console.log(`[CycleService DEBUG] ========================================`);
      console.log(`[CycleService DEBUG] Raw Server Cycle Data:`, JSON.parse(JSON.stringify(data)));
      console.log(`[CycleService DEBUG] Start Date: ${data.startDate || '2026-07-29'}`);
      console.log(`[CycleService DEBUG] Base 30-Day End Date: ${new Date(baseEnd).toISOString().split('T')[0]}`);
      console.log(`[CycleService DEBUG] Extension Days: ${extension}`);
      console.log(`[CycleService DEBUG] Calculated End Date: ${calculatedEndDateStr}`);
      console.log(`[CycleService DEBUG] Calculated Timestamp: ${calculatedEndTimestamp}`);
      console.log(`[CycleService DEBUG] ========================================`);

      onUpdate(data);
    } else {
      console.warn('[CycleService] system_status/activeCycle document does not exist in Firestore. Providing default fallback active cycle.');
      onUpdate(DEFAULT_ACTIVE_CYCLE);
    }
  }, (error) => {
    console.warn('[CycleService] Firestore subscription error handled gracefully (falling back to default cycle):', error);
    onUpdate(DEFAULT_ACTIVE_CYCLE);
  });
}
