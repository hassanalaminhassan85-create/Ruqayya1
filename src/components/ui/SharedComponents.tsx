/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';

// --- BADGE ---
export interface BadgeProps {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'gold' | 'default';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
  const styles = {
    default: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    info: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-100 dark:border-amber-800",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-100 dark:border-rose-800",
    gold: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-brand-gold border border-brand-gold/30"
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

// --- TABS ---
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`flex border-b border-border-main gap-2 overflow-x-auto scrollbar-none ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
              isActive 
                ? 'border-brand-gold text-text-main font-bold' 
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {tab.icon}
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

// --- ACCORDION ---
export interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({ title, children, defaultOpen = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-border-main rounded-lg overflow-hidden bg-bg-surface ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-text-main bg-bg-base/20 hover:bg-bg-base/50 transition-colors text-left"
      >
        <span>{title}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-text-muted" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 text-xs text-text-muted leading-relaxed border-t border-border-main bg-bg-surface">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- MODAL ---
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const widths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl"
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`relative w-full ${widths[size]} bg-bg-surface border border-border-main rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col`}
          >
            <div className="px-5 py-4 border-b border-border-main flex items-center justify-between bg-bg-base/10">
              <h4 className="text-sm font-bold text-text-main">{title}</h4>
              <button onClick={onClose} className="text-text-muted hover:text-text-main rounded-lg p-1 hover:bg-bg-base transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- DRAWER ---
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
          />

          {/* Drawer Content */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="relative w-full max-w-md bg-bg-surface border-l border-border-main h-full shadow-2xl z-10 flex flex-col"
          >
            <div className="px-5 py-4 border-b border-border-main flex items-center justify-between bg-bg-base/10">
              <h4 className="text-sm font-bold text-text-main">{title}</h4>
              <button onClick={onClose} className="text-text-muted hover:text-text-main rounded-lg p-1 hover:bg-bg-base transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 p-5 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- PROGRESS BAR ---
export const ProgressBar: React.FC<{ value: number; max?: number; variant?: 'success' | 'warning' | 'danger' | 'info' | 'gold' }> = ({
  value,
  max = 100,
  variant = 'gold'
}) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    gold: "bg-brand-gold",
    success: "bg-brand-success",
    warning: "bg-brand-warning",
    danger: "bg-brand-danger",
    info: "bg-blue-500"
  };

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`h-full ${colors[variant]}`}
      />
    </div>
  );
};

// --- CIRCULAR PROGRESS ---
export const CircularProgress: React.FC<{ value: number; size?: number; strokeWidth?: number; variant?: 'success' | 'gold' | 'danger' }> = ({
  value,
  size = 50,
  strokeWidth = 5,
  variant = 'gold'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  
  const colors = {
    gold: "text-brand-gold stroke-brand-gold",
    success: "text-brand-success stroke-brand-success",
    danger: "text-brand-danger stroke-brand-danger"
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-200 dark:stroke-slate-700 fill-none"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`fill-none ${colors[variant]}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-text-main">{Math.round(value)}%</span>
    </div>
  );
};

// --- TIMELINE ---
export interface TimelineItem {
  title: string;
  description: string;
  time: string;
  status?: 'completed' | 'current' | 'upcoming';
}

export const Timeline: React.FC<{ items: TimelineItem[] }> = ({ items }) => {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {items.map((item, itemIdx) => (
          <li key={itemIdx}>
            <div className="relative pb-8">
              {itemIdx !== items.length - 1 ? (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-border-main" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-bg-surface ${
                    item.status === 'completed' 
                      ? 'bg-emerald-500 text-white' 
                      : item.status === 'current' 
                      ? 'bg-amber-500 text-white animate-pulse' 
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                  }`}>
                    {item.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : item.status === 'current' ? (
                      <Info className="h-4 w-4" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-slate-400" />
                    )}
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-xs font-bold text-text-main">{item.title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{item.description}</p>
                  </div>
                  <div className="text-right text-[10px] whitespace-nowrap text-text-muted">
                    <time>{item.time}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// --- ALERT ---
export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({ type = 'info', title, children }) => {
  const styles = {
    info: { bg: "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60", text: "text-blue-800 dark:text-blue-300", icon: <Info className="h-4 w-4 text-blue-500" /> },
    success: { bg: "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60", text: "text-emerald-800 dark:text-emerald-300", icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> },
    warning: { bg: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60", text: "text-amber-800 dark:text-amber-300", icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
    danger: { bg: "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60", text: "text-rose-800 dark:text-rose-300", icon: <XCircle className="h-4 w-4 text-rose-500" /> }
  };

  return (
    <div className={`p-4 border rounded-xl flex items-start gap-3 ${styles[type].bg}`}>
      <div className="mt-0.5">{styles[type].icon}</div>
      <div className="flex-1 text-xs">
        {title && <h5 className={`font-bold mb-1 ${styles[type].text}`}>{title}</h5>}
        <div className="text-text-muted leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

// --- BREADCRUMB ---
export const Breadcrumbs: React.FC<{ items: { label: string; active?: boolean }[] }> = ({ items }) => {
  return (
    <nav className="flex text-xs font-medium text-text-muted gap-1.5 items-center">
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <span className={`${item.active ? 'text-text-main font-bold' : 'hover:text-text-main transition-colors cursor-pointer'}`}>
            {item.label}
          </span>
          {idx < items.length - 1 && <span className="text-slate-300 dark:text-slate-600">/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
};

// --- SKELETON LOADER ---
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`} />
  );
};
