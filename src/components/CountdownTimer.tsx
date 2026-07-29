/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  startDate?: string;
  endDate?: string;
  cycleId?: string;
  status?: 'active' | 'paused' | 'inactive' | 'Setup Mode' | 'Operational Mode' | string;
  isActive?: boolean;
  lang?: 'en' | 'ha';
  onPauseToggle?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  startDate = '2026-07-29',
  endDate = '2026-08-28',
  cycleId = 'CYC-2026-2459',
  status = 'active',
  isActive = true,
  lang = 'en',
  onPauseToggle
}) => {
  // Determine if cycle is truly active based on props
  const cycleIsActive = isActive && status !== 'inactive' && status !== 'Setup Mode';

  // Target date parsing (pure client-side compatible for Cloudflare Pages static hosting)
  const getTargetTimestamp = (dateStr: string): number => {
    try {
      if (dateStr.includes('T')) {
        return new Date(dateStr).getTime();
      }
      return new Date(`${dateStr}T23:59:59`).getTime();
    } catch {
      return new Date('2026-08-28T23:59:59').getTime();
    }
  };

  const getStartTimestamp = (dateStr: string): number => {
    try {
      if (dateStr.includes('T')) {
        return new Date(dateStr).getTime();
      }
      return new Date(`${dateStr}T00:00:00`).getTime();
    } catch {
      return new Date('2026-07-29T00:00:00').getTime();
    }
  };

  const [timeLeft, setTimeLeft] = useState({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
    progress: 0
  });

  useEffect(() => {
    if (!cycleIsActive) return;

    const calculateTimeRemaining = () => {
      const now = Date.now();
      const targetTime = getTargetTimestamp(endDate);
      const startTime = getStartTimestamp(startDate);
      const totalDuration = Math.max(1, targetTime - startTime);

      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({
          days: '00',
          hours: '00',
          minutes: '00',
          seconds: '00',
          progress: 100
        });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const elapsed = Math.max(0, now - startTime);
      const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

      const pad = (num: number) => String(num).padStart(2, '0');

      setTimeLeft({
        days: pad(days),
        hours: pad(hours),
        minutes: pad(minutes),
        seconds: pad(seconds),
        progress
      });
    };

    calculateTimeRemaining();
    const timer = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(timer);
  }, [startDate, endDate, cycleIsActive]);

  const units = [
    { label: lang === 'ha' ? 'KWANAKI' : 'DAYS', value: timeLeft.days },
    { label: lang === 'ha' ? 'AWARI' : 'HRS', value: timeLeft.hours },
    { label: lang === 'ha' ? 'MINTOCI' : 'MINS', value: timeLeft.minutes },
    { label: lang === 'ha' ? 'DAKIKU' : 'SECS', value: timeLeft.seconds }
  ];

  // Render Inactive Banner State when cycle is not running
  if (!cycleIsActive) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-50 border border-slate-200/80 rounded-lg shadow-2xs">
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
                {lang === 'ha' ? 'KIDAYAR ZAGAYEN AIKI' : 'ACTIVE CYCLE TIMER'}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold leading-none mt-0.5">
                {lang === 'ha' ? 'Kidayar kwanaki 30' : '30-Day countdown status'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-black font-mono">
              {cycleId}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-amber-50 border-amber-200 text-amber-600">
              {lang === 'ha' ? 'BA A FARA BA' : 'INACTIVE'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 font-medium">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
          <span>
            {lang === 'ha'
              ? 'Babu zagayen aiki mai gudana yanzu. Fara aiki daga bangaren gudanarwa don buɗe kidayar kwanaki 30.'
              : 'No active operating cycle. Start operations from the Enterprise System card to begin the 30-day countdown.'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg border border-slate-200/60 shrink-0">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block leading-none">
                {lang === 'ha' ? 'LOKACIN FARA' : 'START TIME'}
              </span>
              <span className="font-extrabold text-slate-800 font-mono text-[11px] leading-none mt-1 block">
                {startDate}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200/60">
            <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg border border-slate-200/60 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block leading-none">
                {lang === 'ha' ? 'RANAR KAMMALAWA' : 'SCHEDULED END'}
              </span>
              <span className="font-extrabold text-slate-800 font-mono text-[11px] leading-none mt-1 block">
                {endDate}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 flex flex-col gap-3 w-full">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-50 border border-slate-200/80 rounded-lg shadow-2xs">
            <Clock className="h-4 w-4 text-brand-gold animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
              {lang === 'ha' ? 'KIDAYAR ZAGAYEN AIKI' : 'ACTIVE CYCLE TIMER'}
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold leading-none mt-0.5">
              {lang === 'ha' ? 'Kidayar kwanaki 30 tare da sarrafa dakatarwa' : '30-Day countdown with freeze control'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[9px] font-black font-mono">
            {cycleId}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
              status === 'paused'
                ? 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse'
            }`}
          >
            {status === 'paused'
              ? lang === 'ha' ? 'AN DAKATAR' : 'PAUSED'
              : lang === 'ha' ? 'A-AIKI' : 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* Timer LCD Display Grid */}
      <div className="grid grid-cols-4 gap-2 my-1">
        {units.map((unit, index) => (
          <div
            key={index}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-xl shadow-xs relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-radial-gradient from-slate-900 via-transparent to-transparent opacity-40 pointer-events-none" />
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-tight leading-none">
              {unit.value}
            </span>
            <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-none">
              {unit.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/60">
        <div
          className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${timeLeft.progress}%` }}
        />
      </div>

      {/* Start Time and Scheduled End Footer */}
      <div className="grid grid-cols-2 gap-2 bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200/60 shrink-0">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block leading-none">
              {lang === 'ha' ? 'LOKACIN FARA' : 'START TIME'}
            </span>
            <span className="font-extrabold text-slate-800 font-mono text-[11px] leading-none mt-1 block">
              {startDate}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200/60">
          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-200/60 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block leading-none">
              {lang === 'ha' ? 'RANAR KAMMALAWA' : 'SCHEDULED END'}
            </span>
            <span className="font-extrabold text-slate-800 font-mono text-[11px] leading-none mt-1 block">
              {endDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
