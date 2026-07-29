/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface ActiveCycleData {
  cycleId: string;
  isActive: boolean;
  status: 'active' | 'paused' | 'inactive';
  startDate: string;
  endDate: string;
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

export function subscribeToActiveCycle(onUpdate: (data: ActiveCycleData | null) => void) {
  const docRef = doc(db, 'system_status', 'activeCycle');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as ActiveCycleData);
    } else {
      onUpdate(null);
    }
  });
}
