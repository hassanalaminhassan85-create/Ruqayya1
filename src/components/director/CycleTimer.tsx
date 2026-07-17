/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Pause, 
  Play, 
  AlertCircle, 
  Calendar, 
  User, 
  Activity, 
  CheckCircle2 
} from 'lucide-react';

interface CycleTimerProps {
  lang: 'en' | 'ha';
  activeCycle: any;
  onStateChange: () => void;
}

export const CycleTimer: React.FC<CycleTimerProps> = ({
  lang,
  activeCycle,
  onStateChange
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [showPauseModal, setShowPauseModal] = useState<boolean>(false);
  const [showResumeModal, setShowResumeModal] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>('');
  const [resumeReason, setResumeReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [skewOffset, setSkewOffset] = useState<number>(0);
  const [lastCycleId, setLastCycleId] = useState<string | null>(null);

  // Monitor activeCycle to calculate static clock skew offset
  useEffect(() => {
    if (activeCycle) {
      if (activeCycle.id !== lastCycleId) {
        setLastCycleId(activeCycle.id);
        const startMs = new Date(activeCycle.created_at || activeCycle.startDate).getTime();
        const nowMs = Date.now();
        if (!isNaN(startMs) && startMs > nowMs) {
          setSkewOffset(startMs - nowMs);
        } else {
          setSkewOffset(0);
        }
      }
    } else {
      setLastCycleId(null);
      setSkewOffset(0);
    }
  }, [activeCycle, lastCycleId]);

  // Compute active duration elapsed in seconds, deducting paused intervals
  const computeActiveDuration = (cycle: any) => {
    if (!cycle) return 0;
    
    // Fallback to startDate if created_at is missing
    const startMs = new Date(cycle.created_at || cycle.startDate).getTime();
    if (isNaN(startMs)) return 0;

    let nowMs = Date.now() + skewOffset;
    if (cycle.status === 'paused' && cycle.pausedAt) {
      const pausedMs = new Date(cycle.pausedAt).getTime();
      if (!isNaN(pausedMs)) {
        nowMs = pausedMs;
      }
    }

    let totalMs = nowMs - startMs;
    if (totalMs < 0) totalMs = 0;

    // Deduct other completed pause intervals
    let totalPausedMs = 0;
    if (cycle.pauseHistory && Array.isArray(cycle.pauseHistory)) {
      cycle.pauseHistory.forEach((p: any) => {
        const pStart = new Date(p.pausedAt).getTime();
        if (isNaN(pStart)) return;

        if (p.resumedAt) {
          const pEnd = new Date(p.resumedAt).getTime();
          if (!isNaN(pEnd)) {
            totalPausedMs += (pEnd - pStart);
          }
        }
      });
    }

    let activeMs = totalMs - totalPausedMs;
    if (activeMs < 0) activeMs = 0;
    return Math.floor(activeMs / 1000);
  };

  // Keep duration synchronized in real-time
  useEffect(() => {
    if (!activeCycle) {
      setSecondsElapsed(0);
      return;
    }

    setSecondsElapsed(computeActiveDuration(activeCycle));

    const interval = setInterval(() => {
      setSecondsElapsed(computeActiveDuration(activeCycle));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCycle, skewOffset]);

  const formatDateOnly = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    return dateStr;
  };

  const getScheduledEnd = (cycle: any) => {
    if (cycle.endDate) {
      return formatDateOnly(cycle.endDate);
    }
    const start = cycle.created_at || cycle.startDate;
    if (!start) return 'N/A';
    try {
      const d = new Date(start);
      if (isNaN(d.getTime())) return 'N/A';
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    } catch (e) {
      return 'N/A';
    }
  };

  const formatDuration = (totalSecs: number) => {
    const days = Math.floor(totalSecs / (3600 * 24));
    const hours = Math.floor((totalSecs % (3600 * 24)) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    return {
      days: pad(days),
      hours: pad(hours),
      minutes: pad(mins),
      seconds: pad(secs)
    };
  };

  // 30 days countdown
  const totalCycleSeconds = 30 * 24 * 3600;
  const remainingSeconds = Math.max(0, totalCycleSeconds - secondsElapsed);
  const time = formatDuration(remainingSeconds);

  const handlePause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pauseReason.trim()) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await api.pauseCycle({ reason: pauseReason });
      setShowPauseModal(false);
      setPauseReason('');
      onStateChange();
    } catch (err: any) {
      setError(err.message || 'Failed to pause operating cycle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResume = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.resumeCycle({ reason: resumeReason });
      setShowResumeModal(false);
      setResumeReason('');
      onStateChange();
    } catch (err: any) {
      setError(err.message || 'Failed to resume operating cycle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="cycle-timer-card" className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 flex flex-col gap-3.5 h-full justify-between">
      {/* Header Section */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-50 border border-slate-200/60 rounded-lg">
            <Clock className="h-4 w-4 text-brand-gold animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              {lang === 'en' ? "Active Cycle Timer" : "Kidayar Zagayen Gudanarwa"}
            </h4>
            <p className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">
              {lang === 'en' ? "30-Day countdown with freeze control" : "Kula da tsawon lokacin aiki"}
            </p>
          </div>
        </div>

        {activeCycle ? (
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[8px] font-black font-mono">
              {activeCycle.id}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
              activeCycle?.status === 'paused'
                ? 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse'
            }`}>
              {activeCycle?.status === 'paused' 
                ? (lang === 'en' ? "PAUSED" : "AN DAKATAR") 
                : (lang === 'en' ? "ACTIVE" : "A-AIKI")
              }
            </span>
          </div>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border bg-slate-50 border-slate-200 text-slate-400">
            {lang === 'en' ? "INACTIVE" : "A RUFE"}
          </span>
        )}
      </div>

      {activeCycle ? (
        <div className="flex-1 flex flex-col gap-3.5 justify-center">
          {/* LCD Countdown Timer Dashboard */}
          <div className="grid grid-cols-4 gap-1.5 px-0.5 max-w-md mx-auto w-full">
            {[
              { label: lang === 'en' ? "DAYS" : "KWANAKI", val: time.days },
              { label: lang === 'en' ? "HRS" : "AWARI", val: time.hours },
              { label: lang === 'en' ? "MINS" : "MINTOCI", val: time.minutes },
              { label: lang === 'en' ? "SECS" : "DAKIKU", val: time.seconds }
            ].map((unit, idx) => (
              <div key={idx} className="flex flex-col items-center p-2 bg-slate-950 border border-slate-800 rounded-lg shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-gradient from-slate-900 via-transparent to-transparent opacity-40 pointer-events-none" />
                <span className="text-xl font-black font-mono text-brand-gold tracking-tight select-none">
                  {unit.val}
                </span>
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>

          {/* Time Trackers Block */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-col gap-2 text-[10px]">
            <div className="grid grid-cols-2 gap-2 divide-x divide-slate-200/60">
              <div className="flex items-center gap-1.5 pl-0.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <div>
                  <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block leading-none">
                    {lang === 'en' ? "Start Time" : "Ranar Fara"}
                  </span>
                  <span className="font-extrabold text-slate-700 font-mono text-[10px]">
                    {formatDateOnly(activeCycle.startDate)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 pl-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <div>
                  <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block leading-none">
                    {lang === 'en' ? "Scheduled End" : "Ranar Kammalawa"}
                  </span>
                  <span className="font-extrabold text-slate-700 font-mono text-[10px]">
                    {getScheduledEnd(activeCycle)}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Pause Reason Banner */}
            {activeCycle?.status === 'paused' && (
              <div className="mt-1 border-t border-slate-200/40 pt-1.5 flex flex-col gap-0.5">
                <span className="text-[8px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {lang === 'en' ? "Operating Freeze" : "An Dakatar"}
                </span>
                <p className="text-[9px] text-slate-600 bg-amber-50/50 border border-amber-200/20 px-2 py-1 rounded italic truncate">
                  "{activeCycle?.pauseReason || "No explanation provided."}"
                </p>
              </div>
            )}
          </div>

          {/* Manual Control Action Trigger */}
          <div className="flex items-center justify-end gap-2 mt-1">
            {activeCycle?.status === 'paused' ? (
              <button
                type="button"
                onClick={() => setShowResumeModal(true)}
                className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors"
              >
                <Play className="h-3 w-3" />
                {lang === 'en' ? "Resume Cycle" : "Dawo da Zagaye"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowPauseModal(true)}
                className="w-full px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors"
              >
                <Pause className="h-3 w-3" />
                {lang === 'en' ? "Pause Cycle" : "Dakatar da Zagaye"}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Cycle Inactive State */
        <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center">
            <Activity className="h-4 w-4 text-slate-300" />
          </div>
          <div>
            <h5 className="text-[11px] font-extrabold text-slate-700">
              {lang === 'en' ? "No Operating Cycle Active" : "Babu Zagayen Aiki Yanzu"}
            </h5>
            <p className="text-[9px] text-slate-400 font-semibold max-w-xs mt-0.5 leading-relaxed">
              {lang === 'en' 
                ? "Authorizing operations will boot up high-precision active duty monitors." 
                : "Kaddamar da sabon zagaye zai fara kidaya."}
            </p>
          </div>
        </div>
      )}

      {/* PAUSE CYCLE DIALOG MODAL */}
      <AnimatePresence>
        {showPauseModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 p-6 rounded-2xl max-w-md w-full shadow-2xl relative"
            >
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-2">
                <Pause className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                {lang === 'en' ? "Pause Operations Cycle" : "Dakatar da Zagayen Sufuri"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                {lang === 'en' 
                  ? "This will freeze operations, including all driver remittance submissions. A mandatory reason for this pause is required below." 
                  : "Wannan zai dakatar da zagayen aiki na yanzu tare da daskarar da dukkan hanyoyin remittances. Dole ne ka rubuta dalilin dakatarwa."}
              </p>

              {error && (
                <div className="mb-4 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2 text-rose-600 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePause} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {lang === 'en' ? "Reason for Pausing (Mandatory)" : "Dalilin Dakatarwa (Dole)"}
                  </label>
                  <textarea
                    required
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    placeholder={lang === 'en' ? "Provide reason (e.g., fuel shortage, public holiday, maintenance break)..." : "Rubuta dalili a nan..."}
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold w-full h-24 resize-none focus:outline-brand-gold text-slate-950 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowPauseModal(false); setPauseReason(''); setError(null); }}
                    className="px-4 py-2 text-xs font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    {lang === 'en' ? "Cancel" : "Soke"}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !pauseReason.trim()}
                    className="px-4 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
                  >
                    {isSubmitting ? (lang === 'en' ? "Pausing..." : "Ana dakatarwa...") : (lang === 'en' ? "Confirm Pause" : "Dakatar")}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RESUME CYCLE DIALOG MODAL */}
      <AnimatePresence>
        {showResumeModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 p-6 rounded-2xl max-w-md w-full shadow-2xl"
            >
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-2">
                <Play className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                {lang === 'en' ? "Resume Operations Cycle" : "Dawo da Zagayen Sufuri"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                {lang === 'en' 
                  ? "Are you sure you want to resume this operating cycle? This restores active remittance collections and real-time active timers." 
                  : "Shin kana son sake dawo da zagayen aiki na yanzu? Wannan zai bayar da damar biyan kudi da kidayar lokaci."}
              </p>

              {error && (
                <div className="mb-4 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2 text-rose-600 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleResume} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {lang === 'en' ? "Comments / Notes (Optional)" : "Kalamai / Bayani (Na Zabi)"}
                  </label>
                  <textarea
                    value={resumeReason}
                    onChange={(e) => setResumeReason(e.target.value)}
                    placeholder={lang === 'en' ? "Provide comments or notes..." : "Rubuta bayani..."}
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold w-full h-20 resize-none focus:outline-brand-gold text-slate-950 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowResumeModal(false); setResumeReason(''); setError(null); }}
                    className="px-4 py-2 text-xs font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    {lang === 'en' ? "Cancel" : "Soke"}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
                  >
                    {isSubmitting ? (lang === 'en' ? "Resuming..." : "Ana farawa...") : (lang === 'en' ? "Confirm Resume" : "Tabbatar")}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
