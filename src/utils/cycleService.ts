/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './firebase';

export interface ActiveCycleData {
  isActive: boolean;
  status: 'active' | 'paused' | 'completed' | 'inactive';
  cycleId: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining: number;
  totalSecondsRemaining: number;
  progressPercent: number;
  currentDay: number;
  totalCycleDays: number;
  pauseReason?: string;
  pausedAt?: string;
  // Stats
  drivers?: number;
  fleet?: number;
  remit?: number;
  health?: string;
  cycleDay?: string;
}

const DEFAULT_ACTIVE_CYCLE: ActiveCycleData = {
  isActive: false,
  status: 'inactive',
  cycleId: 'No Active Cycle',
  startDate: '',
  endDate: '',
  daysRemaining: 0,
  hoursRemaining: 0,
  minutesRemaining: 0,
  secondsRemaining: 0,
  totalSecondsRemaining: 0,
  progressPercent: 0,
  currentDay: 0,
  totalCycleDays: 30,
  pauseReason: '',
  pausedAt: ''
};

export function subscribeToActiveCycle(onUpdate: (data: ActiveCycleData | null) => void) {
  let isSubscribed = true;

  const fetchStatus = async () => {
    if (!isSubscribed) return;
    try {
      const res = await fetch('/api/cycles/status').then(r => r.json());
      if (res.success) {
        onUpdate(res);
      } else {
        onUpdate(DEFAULT_ACTIVE_CYCLE);
      }
    } catch (err) {
      console.warn('[CycleService] Failed to fetch backend status:', err);
      onUpdate(DEFAULT_ACTIVE_CYCLE);
    }
  };

  // Fetch immediately
  fetchStatus();

  // Poll every 5 seconds to stay in sync with backend
  const interval = setInterval(fetchStatus, 5000);

  return () => {
    isSubscribed = false;
    clearInterval(interval);
  };
}
