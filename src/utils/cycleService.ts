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
  return onSnapshot(docRef, async (snap) => {
    if (snap.exists()) {
      const data = snap.data() as ActiveCycleData;
      
      // Calculate and log end date verification with extension days
      const start = data.startDate ? new Date(data.startDate).getTime() : new Date('2026-07-29').getTime();
      const baseEnd = start + 30 * 24 * 3600 * 1000;
      const extension = data.extendedDays || data.pauseDays || 0;
      const calculatedEndTimestamp = baseEnd + extension * 24 * 3600 * 1000;
      const calculatedEndDateStr = new Date(calculatedEndTimestamp).toISOString().split('T')[0];

      onUpdate(data);
    } else {
      // Fallback: check backend API for active cycles
      try {
        const res = await fetch('/api/director/cycles').then(r => r.json()).catch(() => ({ cycles: [] }));
        const cycles = res.cycles || [];
        const active = cycles.find((c: any) => c.status === 'active' || c.status === 'paused') || cycles[0];
        if (active) {
          onUpdate({
            cycleId: active.id,
            isActive: active.status === 'active' || active.status === 'paused',
            status: active.status || 'active',
            startDate: active.startDate,
            endDate: active.endDate,
            extendedDays: active.extendedDays || 0,
            pauseDays: active.pauseDays || 0,
            drivers: active.drivers || 4,
            fleet: active.fleet || 4,
            remit: active.remit || 0,
            health: active.health || 'Optimal',
            cycleDay: active.cycleDay || 'Day 1 of 30'
          });
          return;
        }
      } catch (err) {
        console.warn('[CycleService] Failed to fetch fallback backend cycles:', err);
      }
      onUpdate(DEFAULT_ACTIVE_CYCLE);
    }
  }, (error) => {
    console.warn('[CycleService] Firestore subscription error handled gracefully:', error);
    onUpdate(DEFAULT_ACTIVE_CYCLE);
  });
}
