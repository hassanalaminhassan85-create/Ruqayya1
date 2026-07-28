/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Users, 
  Fuel, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  FileText,
  Clock,
  ExternalLink,
  Filter
} from 'lucide-react';
import { Badge } from '../ui/SharedComponents';
import { Card } from '../ui/Card';

interface AuditLog {
  id: string;
  user_id?: string;
  userId?: string;
  user_email?: string;
  userEmail?: string;
  user_role?: string;
  userRole?: string;
  action: string;
  previous_value?: string | null;
  previousValue?: string | null;
  new_value?: string | null;
  newValue?: string | null;
  created_at?: string;
  timestamp?: string;
}

interface ActivityFeedProps {
  lang: 'en' | 'ha';
  logs: AuditLog[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  lang,
  logs,
  onRefresh,
  isLoading = false
}) => {
  const [filter, setFilter] = useState<'all' | 'drivers' | 'expenses' | 'status'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Localization Dictionary
  const labels = {
    en: {
      title: "Real-Time Activity Feed",
      subtitle: "Operations Stream",
      live: "Live Stream Active",
      all: "All Operations",
      drivers: "Driver Registrations",
      expenses: "Expenses & Vouchers",
      status: "Status Changes",
      empty: "No matching activities captured in this cycle",
      refresh: "Force Synchronization",
      actor: "Actor",
      role: "Authority",
      details: "Details View",
      previous: "Previous State",
      newValue: "Committed Change",
      justNow: "Just now",
      minutesAgo: "m ago",
      hoursAgo: "h ago",
      daysAgo: "d ago",
      searchHint: "Hover card or click to reveal system parameters"
    },
    ha: {
      title: "Rukuni na Ayyukan Gaske",
      subtitle: "Gudanarwa a Yanzu",
      live: "Yana Sabuntawa Kai Tsaye",
      all: "Duk Ayyuka",
      drivers: "Rijistar Direbobi",
      expenses: "Kudaden Gyara & Rasit",
      status: "Canjin Yanayi",
      empty: "Babu wani aiki da aka gani a wannan rukunin",
      refresh: "Sake Haɗawa Yanzu",
      actor: "Mai Aiki",
      role: "Iko",
      details: "Cikakken Bayani",
      previous: "Tsohon Siffa",
      newValue: "Siffar Sabuntawa",
      justNow: "Yanzu-yanzu",
      minutesAgo: "m da suka wuce",
      hoursAgo: "h da suka wuce",
      daysAgo: "d da suka wuce",
      searchHint: "Danna katin don ganin bayanan tsarin"
    }
  }[lang];

  // Helper to format date or relative time
  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return labels.justNow;
    try {
      const past = new Date(dateStr).getTime();
      const now = Date.now();
      const diffMs = now - past;
      if (diffMs < 60000) return labels.justNow;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}${labels.minutesAgo}`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}${labels.hoursAgo}`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}${labels.daysAgo}`;
    } catch {
      return labels.justNow;
    }
  };

  // Classify audit log entry
  const getLogCategory = (log: AuditLog): 'drivers' | 'expenses' | 'status' | 'other' => {
    if (!log) return 'other';
    const act = (log.action || '').toUpperCase();
    const prev = (log.previous_value || log.previousValue || '').toUpperCase();
    const next = (log.new_value || log.newValue || '').toUpperCase();

    if (
      act.includes('REGISTER') || 
      act.includes('ONBOARD') || 
      act.includes('SELF_REGISTRATION') || 
      act.includes('ASSISTED_REGISTRATION') ||
      act.includes('ONBOARDED')
    ) {
      return 'drivers';
    }

    if (
      act.includes('EXPENSE') || 
      act.includes('VOUCHER') || 
      act.includes('DISBURSE') || 
      act.includes('PAYMENT') || 
      act.includes('REMITTANCE') ||
      act.includes('FINANCE') ||
      act.includes('TRANSACTION')
    ) {
      return 'expenses';
    }

    if (
      act.includes('STATUS') || 
      act.includes('CLASSIFY') || 
      act.includes('APPROVED') || 
      act.includes('REJECTED') || 
      act.includes('REMARK') ||
      act.includes('CORRECTION') ||
      act.includes('UPDATE')
    ) {
      return 'status';
    }

    return 'other';
  };

  // Style log category card decoration
  const getCategoryStyles = (category: 'drivers' | 'expenses' | 'status' | 'other') => {
    switch (category) {
      case 'drivers':
        return {
          icon: <Users className="h-4 w-4 text-emerald-500" />,
          badgeColor: 'emerald' as const,
          border: 'border-l-4 border-l-emerald-500',
          bg: 'bg-emerald-500/5',
          title: lang === 'en' ? 'Driver Dossier' : 'Direbobi'
        };
      case 'expenses':
        return {
          icon: <Fuel className="h-4 w-4 text-brand-gold" />,
          badgeColor: 'gold' as const,
          border: 'border-l-4 border-l-brand-gold',
          bg: 'bg-brand-gold/5',
          title: lang === 'en' ? 'Treasury / Expense' : 'Kudaden Fitarwa'
        };
      case 'status':
        return {
          icon: <CheckCircle className="h-4 w-4 text-blue-500" />,
          badgeColor: 'info' as const,
          border: 'border-l-4 border-l-blue-500',
          bg: 'bg-blue-500/5',
          title: lang === 'en' ? 'State Decision' : 'Canjin Hali'
        };
      default:
        return {
          icon: <Activity className="h-4 w-4 text-slate-500" />,
          badgeColor: 'default' as const,
          border: 'border-l-4 border-l-slate-400',
          bg: 'bg-slate-500/5',
          title: lang === 'en' ? 'System Log' : 'Tsarin Gudanarwa'
        };
    }
  };

  const filteredLogs = logs
    .filter(log => {
      if (filter === 'all') return true;
      const cat = getLogCategory(log);
      return cat === filter;
    })
    .slice(0, 40); // Cap at latest 40 entries for speed and aesthetic density

  return (
    <Card className="flex flex-col h-full bg-bg-surface border border-border-main rounded-2xl shadow-sm overflow-hidden">
      
      {/* Header Fold */}
      <div className="flex items-center justify-between p-4 border-b border-border-main bg-bg-surface/50 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-text-main flex items-center gap-1.5 leading-none">
              <Activity className="h-4 w-4 text-brand-gold" />
              {labels.title}
            </h3>
            <span className="text-[10px] text-text-muted mt-0.5 block font-bold uppercase tracking-wider">
              {labels.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title={labels.refresh}
              className="p-1.5 rounded-lg border border-border-main bg-bg-base text-text-muted hover:text-brand-gold hover:border-brand-gold/40 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-brand-gold' : ''}`} />
            </button>
          )}
          <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">
            {labels.live}
          </span>
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div className="flex items-center gap-1 p-2 bg-bg-base/30 border-b border-border-main overflow-x-auto whitespace-nowrap scrollbar-none">
        {(['all', 'drivers', 'expenses', 'status'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
              filter === tab
                ? 'bg-brand-navy text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-bg-base bg-transparent'
            }`}
          >
            {tab === 'all' && <Filter className="h-3 w-3" />}
            {tab === 'drivers' && <Users className="h-3 w-3" />}
            {tab === 'expenses' && <Fuel className="h-3 w-3" />}
            {tab === 'status' && <CheckCircle className="h-3 w-3" />}
            {labels[tab]}
          </button>
        ))}
      </div>

      {/* Stream List container with Custom Scroll */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[350px] max-h-[500px] bg-bg-surface">
        <AnimatePresence initial={false} mode="popLayout">
          {filteredLogs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-2">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-text-muted px-4">{labels.empty}</p>
            </motion.div>
          ) : (
            filteredLogs.map((log, index) => {
              const category = getLogCategory(log);
              const styles = getCategoryStyles(category);
              const isExpanded = expandedLogId === log.id;
              
              return (
                <motion.div
                  key={log.id || `log-${index}`}
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={`group relative flex flex-col p-3 rounded-xl border border-border-main/50 bg-bg-surface hover:bg-bg-base/30 hover:border-brand-gold/30 transition-all duration-300 shadow-xs cursor-pointer ${styles.border}`}
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-2.5">
                      <div className={`h-8 w-8 rounded-lg ${styles.bg} flex items-center justify-center border border-border-main group-hover:scale-105 transition-transform shrink-0`}>
                        {styles.icon}
                      </div>
                      
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black tracking-wider uppercase text-text-muted flex items-center gap-1">
                          {styles.title}
                          <span className="text-slate-500 font-normal font-mono">({log.id})</span>
                        </span>
                        <h4 className="text-xs font-black text-text-main group-hover:text-brand-navy transition-colors">
                          {log.action}
                        </h4>
                        <p className="text-[10px] text-text-muted leading-relaxed font-sans max-w-md">
                          {log.new_value || log.previous_value || 'No payload parameters committed.'}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[9px] text-brand-gold font-extrabold flex items-center gap-1 font-mono">
                            <Clock className="h-2.5 w-2.5 text-text-muted" /> {getRelativeTime(log.created_at || log.timestamp)}
                          </span>
                          <span className="text-[9px] text-text-muted font-bold bg-bg-base px-2 py-0.5 rounded-full border border-border-main/50">
                            {log.user_email || log.userEmail || 'System'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[9px] font-black uppercase text-brand-gold px-1.5 py-0.5 rounded-md bg-brand-gold/5 border border-brand-gold/10 font-mono">
                        {(log.user_role || log.userRole || 'SYS').substring(0, 3)}
                      </span>
                      <div className="mt-2 text-text-muted group-hover:text-brand-gold transition-colors">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Meta details fold */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-3 pt-3 border-t border-border-main/60 overflow-hidden text-[10px] text-text-muted bg-bg-base/20 p-2.5 rounded-lg flex flex-col gap-2 font-mono"
                      >
                        <div className="flex items-center justify-between border-b border-border-main/30 pb-1">
                          <span className="font-extrabold text-brand-gold">{labels.details}</span>
                          <span className="text-[9px] text-slate-500">{log.created_at || log.timestamp}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="block font-sans font-extrabold text-text-main text-[9px] uppercase tracking-wider">{labels.actor}:</span>
                            <span className="text-text-muted">{log.user_email || log.userEmail || 'System Agent'}</span>
                          </div>
                          <div>
                            <span className="block font-sans font-extrabold text-text-main text-[9px] uppercase tracking-wider">{labels.role}:</span>
                            <span className="text-text-muted">{log.user_role || log.userRole || 'System'}</span>
                          </div>
                        </div>

                        {log.previous_value && (
                          <div className="bg-bg-surface p-1.5 rounded border border-border-main text-red-500/90 whitespace-pre-wrap break-all leading-tight">
                            <span className="block text-[8px] font-sans font-black uppercase tracking-wider text-text-muted mb-0.5">{labels.previous}</span>
                            {log.previous_value}
                          </div>
                        )}

                        {log.new_value && (
                          <div className="bg-[#D4AF37]/5 p-1.5 rounded border border-[#D4AF37]/10 text-emerald-600 dark:text-emerald-500 whitespace-pre-wrap break-all leading-tight">
                            <span className="block text-[8px] font-sans font-black uppercase tracking-wider text-[#D4AF37] mb-0.5">{labels.newValue}</span>
                            {log.new_value}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-border-main bg-bg-base/30 text-center text-[9px] text-text-muted font-bold uppercase tracking-wider">
        {labels.searchHint}
      </div>

    </Card>
  );
};
