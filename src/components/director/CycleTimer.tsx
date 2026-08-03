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
import { ProgressBar } from '../ui/SharedComponents';

interface CycleTimerProps {
  lang: 'en' | 'ha';
  activeCycle: any;
  onStateChange: () => void;
}

import { subscribeToActiveCycle, ActiveCycleData } from '../../utils/cycleService';

// ... (keep other imports)

export const CycleTimer: React.FC<CycleTimerProps> = ({
  lang,
  onStateChange
}) => {
  const [activeCycle, setActiveCycle] = useState<ActiveCycleData | null>(null);
  const [showPauseModal, setShowPauseModal] = useState<boolean>(false);
  const [showResumeModal, setShowResumeModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>('');
  const [pauseDays, setPauseDays] = useState<number>(2);
  const [resumeReason, setResumeReason] = useState<string>('');

  const getExtendedEndDate = () => {
    if (!activeCycle?.endDate) return 'N/A';
    const baseDate = new Date(activeCycle.endDate);
    const daysToAdd = parseInt(String(pauseDays), 10) || 0;
    baseDate.setDate(baseDate.getDate() + daysToAdd);
    return baseDate.toISOString().split('T')[0];
  };
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00'
  });

  // Subscribe to canonical cycle status from the single source of truth
  useEffect(() => {
    const unsubscribe = subscribeToActiveCycle((data) => {
      setActiveCycle(data as any);
      if (data) {
        setTimeLeft({
          days: String(data.daysRemaining).padStart(2, '0'),
          hours: String(data.hoursRemaining).padStart(2, '0'),
          minutes: String(data.minutesRemaining).padStart(2, '0'),
          seconds: String(data.secondsRemaining).padStart(2, '0')
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Local ticker for smooth UI
  useEffect(() => {
    if (!activeCycle) return;
    if (activeCycle.status !== 'active' && !(activeCycle.status === 'paused' && activeCycle.pauseDays > 0)) return;

    const tick = () => {
      setTimeLeft(prev => {
        let d = parseInt(prev.days);
        let h = parseInt(prev.hours);
        let m = parseInt(prev.minutes);
        let s = parseInt(prev.seconds);

        if (d === 0 && h === 0 && m === 0 && s === 0) return prev;

        s--;
        if (s < 0) {
          s = 59;
          m--;
          if (m < 0) {
            m = 59;
            h--;
            if (h < 0) {
              h = 23;
              d--;
            }
          }
        }

        const pad = (num: number) => String(num).padStart(2, '0');
        return {
          days: pad(d),
          hours: pad(h),
          minutes: pad(m),
          seconds: pad(s)
        };
      });
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeCycle]);

  const formatDateOnly = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    return dateStr.split('T')[0];
  };

  const currentDay = activeCycle?.currentDay || 0;
  const totalDays = activeCycle?.totalCycleDays || 30;
  const progressPercent = activeCycle?.progressPercent || 0;

  const handlePause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pauseReason.trim()) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await api.pauseCycle({ reason: pauseReason, pauseDays: Number(pauseDays) || 0 });
      setShowPauseModal(false);
      setPauseReason('');
      onStateChange();
    } catch (err: any) {
      setError(err.message || 'Failed to pause operating cycle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCycle = async () => {
    if (!activeCycle?.id) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await api.deleteCycle(activeCycle.id);
      setShowDeleteModal(false);
      onStateChange();
    } catch (err: any) {
      setError(err.message || 'Failed to delete operating cycle.');
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
    <div id="cycle-timer-card" className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 h-full justify-between min-h-[130px] sm:min-h-[145px]">
      {/* Header Section */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-50 border border-slate-200/60 rounded-md">
            <Clock className="h-3.5 w-3.5 text-brand-gold animate-pulse" />
          </div>
          <div>
            <h4 className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-wider">
              {lang === 'en' ? "Active Cycle Timer" : "Kidayar Zagayen Gudanarwa"}
            </h4>
            <p className="text-[8px] sm:text-[9px] text-slate-400 font-semibold leading-none mt-0.5">
              {lang === 'en' ? `${totalDays}-Day countdown with freeze control` : `Kula da kwanaki ${totalDays} na aiki`}
            </p>
          </div>
        </div>

        {activeCycle ? (
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[7.5px] sm:text-[8px] font-black font-mono leading-none">
              {activeCycle.id}
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 text-[7.5px] sm:text-[8px] font-black font-mono leading-none">
              Day {currentDay}/{totalDays}
            </span>
            <span className={`px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[8px] font-black uppercase tracking-widest border leading-none ${
              activeCycle?.status === 'paused'
                ? 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse'
            }`}>
              {activeCycle?.status === 'paused' 
                ? (lang === 'en' ? "EXTENDED" : "AN KARA") 
                : (lang === 'en' ? "ACTIVE" : "A-AIKI")
              }
            </span>
          </div>
        ) : (
          <span className="px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[8px] font-black uppercase tracking-widest border bg-slate-50 border-slate-200 text-slate-400 leading-none">
            {lang === 'en' ? "INACTIVE" : "A RUFE"}
          </span>
        )}
      </div>

      {activeCycle ? (
        <div className="flex-1 flex flex-col gap-2 sm:gap-3 justify-center">
          {/* LCD Countdown Timer Dashboard */}
          <div className="grid grid-cols-4 gap-1 px-0.5 max-w-md mx-auto w-full">
            {[
              { label: lang === 'en' ? "DAYS" : "KWANAKI", val: timeLeft.days },
              { label: lang === 'en' ? "HRS" : "AWARI", val: timeLeft.hours },
              { label: lang === 'en' ? "MINS" : "MINTOCI", val: timeLeft.minutes },
              { label: lang === 'en' ? "SECS" : "DAKIKU", val: timeLeft.seconds }
            ].map((unit, idx) => (
              <div key={`time-${idx}`} className="flex flex-col items-center p-1 sm:p-2 bg-slate-950 border border-slate-800 rounded-lg shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-gradient from-slate-900 via-transparent to-transparent opacity-40 pointer-events-none" />
                <span className="text-base sm:text-lg font-black font-mono text-brand-gold tracking-tight select-none leading-none">
                  {unit.val}
                </span>
                <span className="text-[6px] sm:text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5 leading-none">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>

          <div className="px-1">
            <ProgressBar value={progressPercent} variant="gold" />
          </div>

          {/* Time Trackers Block */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 sm:p-2 flex flex-col gap-1 sm:gap-1.5 text-[8px] sm:text-[10px]">
            <div className="grid grid-cols-2 gap-2 divide-x divide-slate-200/60">
              <div className="flex items-center gap-1.5 pl-0.5">
                <Calendar className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-emerald-500 shrink-0" />
                <div>
                  <span className="text-[7.5px] sm:text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block leading-none">
                    {lang === 'en' ? "Start Time" : "Ranar Fara"}
                  </span>
                  <span className="font-extrabold text-slate-700 font-mono text-[9px] sm:text-[10px] leading-none mt-0.5 block">
                    {formatDateOnly(activeCycle.startDate)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 pl-2">
                <CheckCircle2 className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-rose-500 shrink-0" />
                <div>
                  <span className="text-[7.5px] sm:text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block leading-none">
                    {lang === 'en' ? "Scheduled End" : "Ranar Kammalawa"}
                  </span>
                  <span className="font-extrabold text-slate-700 font-mono text-[9px] sm:text-[10px] leading-none mt-0.5 block">
                    {formatDateOnly(activeCycle.endDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Pause Reason Banner */}
            {activeCycle?.status === 'paused' && (
              <div className="mt-1 border-t border-slate-200/40 pt-1 flex flex-col gap-0.5">
                <span className="text-[7.5px] sm:text-[8px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                  {lang === 'en' ? "The cycle operation is paused" : "An dakatar da gudanarwar zagayen"}
                </span>
                <p className="text-[8px] sm:text-[9px] text-slate-600 bg-amber-50/50 border border-amber-200/20 px-1.5 py-0.5 rounded font-medium">
                  {lang === 'en' ? `Reason: ${activeCycle?.pauseReason || "No explanation provided."}` : `Dalili: ${activeCycle?.pauseReason || "Babu dalili."}`}
                </p>
              </div>
            )}
          </div>

          {/* Manual Control Action Trigger */}
          <div className="flex items-center justify-end gap-2 mt-0.5">
            {activeCycle?.status === 'paused' ? (
              <button
                type="button"
                onClick={() => setShowResumeModal(true)}
                className="flex-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] sm:text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors"
              >
                <Play className="h-2.5 w-2.5" />
                {lang === 'en' ? "Resume Cycle" : "Dawo da Zagaye"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowPauseModal(true)}
                className="flex-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] sm:text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors"
              >
                <Pause className="h-2.5 w-2.5" />
                {lang === 'en' ? "Pause Cycle" : "Dakatar da Zagaye"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[9px] sm:text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title={lang === 'en' ? "Delete Cycle Everywhere" : "Goge Zagayen Aiki"}
            >
              {lang === 'en' ? "Delete Cycle" : "Goge Zagaye"}
            </button>
          </div>
        </div>
      ) : (
        /* Cycle Inactive State */
        <div className="py-3 sm:py-4 flex flex-col items-center justify-center text-center gap-1.5">
          <div className="h-6 sm:h-7 w-6 sm:w-7 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center">
            <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-300" />
          </div>
          <div>
            <h5 className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 leading-none">
              {lang === 'en' ? "No Operating Cycle Active" : "Babu Zagayen Aiki Yanzu"}
            </h5>
            <p className="text-[8px] sm:text-[9px] text-slate-400 font-semibold max-w-xs mt-0.5 leading-tight">
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
                <Clock className="h-4.5 w-4.5 text-brand-gold shrink-0" />
                {lang === 'en' ? "Extend/Pause Operations Cycle" : "Kara Lokaci / Dakatar da Zagaye"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                {lang === 'en' 
                  ? "This will add the specified days to the current cycle. The timer will automatically extend to the new scheduled end date." 
                  : "Wannan zai kara kwanakin da ka zaba zuwa zagayen yanzu. Kidayar za ta ci gaba zuwa sabuwar ranar kammalawa."}
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
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold w-full h-20 resize-none focus:outline-brand-gold text-slate-950 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {lang === 'en' ? "Extension Duration (How many days to extend?)" : "Kwanakin Tsawa (Kwanaki nawa zai karu?)"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={pauseDays}
                    onChange={(e) => setPauseDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-brand-gold w-full font-mono"
                  />
                  <p className="text-[10px] text-emerald-600 font-semibold italic">
                    {lang === 'en' 
                      ? `The scheduled cycle end date will automatically extend to ${getExtendedEndDate()} (+${pauseDays} day(s)).`
                      : `Ranar gama zagaye zata kasance ${getExtendedEndDate()} (+kwanaki ${pauseDays}).`}
                  </p>
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

      {/* DELETE CYCLE DIALOG MODAL */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-rose-200 p-6 rounded-2xl max-w-md w-full shadow-2xl"
            >
              <h3 className="text-sm font-black text-rose-600 uppercase tracking-tight flex items-center gap-2 mb-2">
                <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                {lang === 'en' ? "Permanently Delete Operating Cycle" : "Goge Zagayen Aiki Baki Daya"}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                {lang === 'en' 
                  ? `Are you sure you want to permanently delete Operating Cycle ${activeCycle?.id}? This action will remove this cycle from every dashboard, financial center, and executive report globally.` 
                  : `Shin kana da tabbacin goge zagaye ${activeCycle?.id}? Wannan zai goge shi daga dukkan rukunin gudanarwa da rahotannin kudi.`}
              </p>

              {error && (
                <div className="mb-4 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2 text-rose-600 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setError(null); }}
                  className="px-4 py-2 text-xs font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {lang === 'en' ? "Cancel" : "Soke"}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCycle}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
                >
                  {isSubmitting ? (lang === 'en' ? "Deleting..." : "Ana gogewa...") : (lang === 'en' ? "Confirm Delete Everywhere" : "Goge Daga Ko'ina")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
