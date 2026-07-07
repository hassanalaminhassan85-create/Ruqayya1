/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Info, AlertTriangle, ShieldCheck, CheckCircle2, Trash2 } from 'lucide-react';
import { AppNotification } from '../types';
import { dbStore } from '../utils/dbStore';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationCenterProps {
  lang: 'en' | 'ha';
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ lang }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    setNotifications(dbStore.getNotifications());
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for notifications occasionally to simulate background sync
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    dbStore.markAllNotificationsRead();
    fetchNotifications();
  };

  const handleClearNotifications = () => {
    dbStore.saveNotifications([]);
    setNotifications([]);
  };

  const typeIcons = {
    info: <Info className="h-4 w-4 text-blue-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    danger: <Bell className="h-4 w-4 text-red-500" />
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-bg-base hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main transition-colors duration-200 border border-border-main/50 cursor-pointer"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-danger text-[9px] font-bold text-white ring-2 ring-bg-surface animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Pane */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-bg-surface border border-border-main rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[420px]"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border-main flex items-center justify-between bg-bg-base/30">
              <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-brand-gold" />
                {lang === 'en' ? "Corporate Alerts" : "Sanarwa Na Kamfani"}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-bold text-brand-gold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  {lang === 'en' ? "Mark all read" : "Karanta Duka"}
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border-main/50 scrollbar-none">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  {lang === 'en' ? "Your notification stream is clear." : "Babu wata sanarwa a halin yanzu."}
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 flex gap-3 transition-colors ${
                      n.read ? 'opacity-70 hover:bg-bg-base/20' : 'bg-brand-gold/5 hover:bg-brand-gold/10'
                    }`}
                  >
                    <div className="mt-0.5">{typeIcons[n.type] || <Bell className="h-4 w-4" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold leading-tight ${n.read ? 'text-text-main' : 'text-text-main font-extrabold'}`}>
                        {lang === 'en' ? n.titleEn : n.titleHa}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                        {lang === 'en' ? n.messageEn : n.messageHa}
                      </p>
                      <span className="text-[9px] text-text-muted/65 font-mono block mt-1">{n.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 bg-bg-base/30 border-t border-border-main flex justify-end">
                <button
                  onClick={handleClearNotifications}
                  className="text-[10px] text-brand-danger font-medium hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  {lang === 'en' ? "Clear all logs" : "Goge Duka"}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
