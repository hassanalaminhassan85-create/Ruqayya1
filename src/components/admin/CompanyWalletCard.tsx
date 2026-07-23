/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Coins, 
  RefreshCw, 
  ShieldCheck, 
  CreditCard,
  TrendingUp,
  Activity,
  Plus,
  Minus,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../ui/Button';

interface CompanyWalletCardProps {
  lang: 'en' | 'ha';
  finance: any[];
  payments: any[];
  onStateChange?: () => void;
}

export const CompanyWalletCard: React.FC<CompanyWalletCardProps> = ({
  lang,
  finance,
  payments,
  onStateChange
}) => {
  const [balance, setBalance] = useState<number>(0);
  const [animatingBalance, setAnimatingBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Inflow / Outflow summary stats
  const totalInflow = finance
    .filter(f => f.type === 'revenue' || f.type === 'deposit')
    .reduce((sum, f) => sum + f.amount, 0) + 
    payments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.amount, 0);

  const totalOutflow = finance
    .filter(f => f.type === 'expense' || f.type === 'withdrawal')
    .reduce((sum, f) => sum + f.amount, 0);

  const fetchWalletBalance = async () => {
    try {
      const res = await api.getOperationsState();
      if (res && res.success) {
        const bal = res.metrics?.companyWalletBalance || 0;
        setBalance(bal);
      }
    } catch (err) {
      console.error('Failed to load company wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletBalance();

    const handleDbChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.company_settings) {
        setBalance(detail.company_settings.wallet_balance || 0);
      }
    };
    
    window.addEventListener('db-change', handleDbChange);
    return () => {
      window.removeEventListener('db-change', handleDbChange);
    };
  }, []);

  // Smooth balance counter animation
  useEffect(() => {
    let startTimestamp: number | null = null;
    const startVal = animatingBalance;
    const endVal = balance;
    const duration = 800; // ms

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Ease out quad
      const easedProgress = progress * (2 - progress);
      const currentVal = Math.floor(startVal + easedProgress * (endVal - startVal));
      
      setAnimatingBalance(currentVal);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [balance]);

  return (
    <motion.div 
      id="company-wallet-card" 
      className="w-full flex flex-col h-full justify-between"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Container with relative perspective for card flip effect */}
      <div className="relative w-full h-[130px] sm:h-[145px] [perspective:1000px] group cursor-pointer" onClick={() => setCardFlipped(!cardFlipped)}>
        <motion.div 
          className="w-full h-full relative [transform-style:preserve-3d] transition-all duration-700"
          animate={{ rotateY: cardFlipped ? 180 : 0 }}
        >
          {/* CARD FRONT */}
          <div className="absolute inset-0 w-full h-full rounded-xl p-3 sm:p-4 flex flex-col justify-between overflow-hidden shadow-lg border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-950 to-brand-navy [backface-visibility:hidden]">
            {/* Glossy radial gradient overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,55,0.18),transparent_60%)] pointer-events-none" />
            {/* Tech network overlay */}
            <div className="absolute inset-0 opacity-5 bg-[linear-gradient(rgba(18,24,38,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.3)_1px,transparent_1px)] bg-[size:10px_10px]" />

            <div className="flex justify-between items-start z-10">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded bg-brand-gold/10 border border-brand-gold/30">
                  <Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-brand-gold animate-spin" style={{ animationDuration: '6s' }} />
                </div>
                <div>
                  <span className="text-[8px] sm:text-[9px] uppercase font-black tracking-widest text-brand-gold leading-none block">
                    {lang === 'en' ? 'RUQAYYA TREASURY' : 'ASUSUN RUQAYYA'}
                  </span>
                  <span className="block text-[6px] sm:text-[7px] font-mono text-slate-400">CORPORATE WALLET NODE</span>
                </div>
              </div>
              <span className="text-[6px] sm:text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20 flex items-center gap-0.5 leading-none">
                <ShieldCheck className="h-1.5 w-1.5" />
                SECURE
              </span>
            </div>

            <div className="my-0.5 sm:my-1 z-10">
              <span className="text-[7.5px] sm:text-[8px] uppercase tracking-wider text-slate-400 font-bold block leading-none">
                {lang === 'en' ? 'Liquidity Balance' : 'Kudaden da Ke Akwai'}
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-50 tracking-tight flex items-baseline gap-0.5 mt-0.5 select-all">
                <span className="text-brand-gold text-sm sm:text-base">₦</span>
                <span className="font-mono text-lg sm:text-xl leading-none">{animatingBalance.toLocaleString()}</span>
                <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-brand-gold animate-pulse inline-block ml-1" />
              </div>
            </div>

            <div className="flex justify-between items-end z-10 leading-none">
              <div className="font-mono text-[7px] sm:text-[8px] text-slate-400 flex flex-col gap-0.5">
                <span>CARD NO: **** **** **** 2026</span>
                <span className="text-[6px] sm:text-[7px] text-slate-500">EXECUTIVE CLEARANCE LEVEL 2</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[5.5px] sm:text-[6px] text-slate-500 uppercase tracking-widest mr-1 font-bold">{lang === 'en' ? 'TAP TO FLIP' : 'DANNA DOMIN JUYAWA'}</span>
                <div className="w-3.5 h-2.5 sm:w-4 sm:h-3 bg-slate-800 rounded-sm opacity-60 relative flex items-center justify-center">
                  <div className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 bg-brand-gold/30 rounded-full mix-blend-screen -left-0.5" />
                  <div className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 bg-amber-500/30 rounded-full mix-blend-screen -right-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* CARD BACK */}
          <div className="absolute inset-0 w-full h-full rounded-xl p-3 sm:p-4 flex flex-col justify-between overflow-hidden shadow-lg border border-slate-700/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.1),transparent_50%)] pointer-events-none" />
            
            {/* Magnetic strip */}
            <div className="h-4 sm:h-5 bg-slate-800 w-full -mx-4 absolute top-3 sm:top-4 opacity-70" />

            <div className="mt-4 sm:mt-5 z-10 flex flex-col gap-1">
              <span className="text-[7.5px] sm:text-[8px] uppercase tracking-wider text-slate-400 font-black leading-none mb-0.5">
                {lang === 'en' ? 'Flow Telemetry' : 'Bayanin Kudade'}
              </span>
              <div className="grid grid-cols-2 gap-1 text-[8px] sm:text-[9px]">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-1 sm:p-1.5 rounded-lg">
                  <span className="text-[6.5px] sm:text-[7px] text-slate-500 block font-bold leading-none mb-0.5">{lang === 'en' ? 'INFLOW' : 'KUDADEN SHIGA'}</span>
                  <span className="font-mono font-bold text-emerald-400 text-[9px] sm:text-[10px]">₦{totalInflow.toLocaleString()}</span>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/10 p-1 sm:p-1.5 rounded-lg">
                  <span className="text-[6.5px] sm:text-[7px] text-slate-500 block font-bold leading-none mb-0.5">{lang === 'en' ? 'OUTFLOW' : 'KUDADEN KASHEWA'}</span>
                  <span className="font-mono font-bold text-rose-400 text-[9px] sm:text-[10px]">₦{totalOutflow.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center z-10 mt-0.5 sm:mt-1 border-t border-slate-800/80 pt-1 text-[6px] sm:text-[7px] text-slate-500 font-mono">
              <span>METRIC NODE #RT-402</span>
              <span className="text-brand-gold font-bold">{lang === 'en' ? 'TAP TO FLIP FRONT' : 'DANNA DOMIN JUYA GABA'}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
