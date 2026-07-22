/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Info, AlertTriangle, ShieldCheck, CheckCircle2, Trash2, Smartphone, BellOff, Loader2 } from 'lucide-react';
import { AppNotification } from '../types';
import { dbStore } from '../utils/dbStore';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../utils/api';
import { registerPushSubscription, unregisterPushSubscription } from '../utils/notificationHelper';

interface NotificationCenterProps {
  lang: 'en' | 'ha';
}

const mapNotification = (n: any): AppNotification => {
  return {
    id: n.id,
    titleEn: n.title_en || n.titleEn || '',
    titleHa: n.title_ha || n.titleHa || '',
    messageEn: n.message_en || n.messageEn || '',
    messageHa: n.message_ha || n.messageHa || '',
    timestamp: n.created_at || n.timestamp || new Date().toISOString(),
    read: n.read_status !== undefined ? n.read_status === 1 || n.read_status === true : (n.read !== undefined ? !!n.read : false),
    type: n.type || 'info'
  };
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ lang }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enterprise Web Push States
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushDevicesCount, setPushDevicesCount] = useState(0);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const checkPushStatus = async () => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setPushSupported(isSupported);
    if (!isSupported) return;

    setPushPermission(Notification.permission);

    try {
      const statusRes = await api.request('/api/notifications/status');
      if (statusRes && statusRes.success) {
        setIsPushSubscribed(statusRes.subscribed);
        setPushDevicesCount(statusRes.devicesCount || 0);
      }
    } catch (err) {
      console.warn('Failed to retrieve push subscription status from backend:', err);
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushError(null);
    try {
      if (isPushSubscribed) {
        const success = await unregisterPushSubscription();
        if (success) {
          setIsPushSubscribed(false);
          setPushDevicesCount(prev => Math.max(0, prev - 1));
          console.log('RUQAYYA PWA: Unsubscribed current device.');
        } else {
          setPushError(lang === 'en' ? 'Failed to unsubscribe.' : 'Gaza cire rajista.');
        }
      } else {
        if (Notification.permission === 'denied') {
          setPushError(lang === 'en' ? 'Permission blocked in browser settings.' : 'An toshe izni a cikin binciken.');
          setPushLoading(false);
          return;
        }
        
        const granted = await Notification.requestPermission();
        setPushPermission(granted);
        
        if (granted === 'granted') {
          const success = await registerPushSubscription();
          if (success) {
            setIsPushSubscribed(true);
            setPushDevicesCount(prev => prev + 1);
            console.log('RUQAYYA PWA: Subscribed current device successfully.');
          } else {
            setPushError(lang === 'en' ? 'Failed to register subscription.' : 'Gaza yin rajista.');
          }
        } else {
          setPushError(lang === 'en' ? 'Permission denied.' : 'An ki yarda da izni.');
        }
      }
    } catch (err: any) {
      setPushError(err.message || 'An unexpected error occurred.');
    } finally {
      setPushLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const list = await api.request('/api/notifications');
      if (Array.isArray(list)) {
        setNotifications(list.map(mapNotification));
      } else {
        // Fallback to local store
        setNotifications(dbStore.getNotifications().map(mapNotification));
      }
    } catch (err) {
      console.warn("Failed to fetch notifications from backend, using localStorage fallback", err);
      setNotifications(dbStore.getNotifications().map(mapNotification));
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen to real-time database update events via SSE
    const handleDBChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail.notifications)) {
        setNotifications(detail.notifications.map(mapNotification));
      }
    };

    window.addEventListener('db-change', handleDBChange);
    return () => {
      window.removeEventListener('db-change', handleDBChange);
    };
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

  useEffect(() => {
    if (isOpen) {
      checkPushStatus();
    }
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      await api.request('/api/notifications/read-all', {
        method: 'PUT'
      });
      // Fallback local update
      dbStore.markAllNotificationsRead();
      // Fetch fresh set
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read on server", err);
      dbStore.markAllNotificationsRead();
      fetchNotifications();
    }
  };

  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.request(`/api/notifications/${id}/read`, {
        method: 'PUT'
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark notification read", err);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const handleClearNotifications = async () => {
    try {
      // Clear personal ones or call bulk delete if applicable, else clear local list
      dbStore.saveNotifications([]);
      setNotifications([]);
    } catch (err) {
      setNotifications([]);
    }
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
                notifications.map((n, idx) => (
                  <div
                    key={n.id || `notif-${idx}`}
                    className={`p-3.5 flex gap-3 transition-colors relative group ${
                      n.read ? 'opacity-70 hover:bg-bg-base/20' : 'bg-brand-gold/5 hover:bg-brand-gold/10'
                    }`}
                  >
                    <div className="mt-0.5">{typeIcons[n.type] || <Bell className="h-4 w-4" />}</div>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className={`text-xs font-bold leading-tight ${n.read ? 'text-text-main' : 'text-text-main font-extrabold'}`}>
                        {lang === 'en' ? n.titleEn : n.titleHa}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                        {lang === 'en' ? n.messageEn : n.messageHa}
                      </p>
                      <span className="text-[9px] text-text-muted/65 font-mono block mt-1">
                        {new Date(n.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    {/* Floating mark as read action */}
                    {!n.read && (
                      <button
                        onClick={(e) => handleMarkSingleRead(n.id, e)}
                        className="absolute right-3 top-4 p-1 rounded bg-brand-gold/10 hover:bg-brand-gold/25 text-brand-gold opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
                        title={lang === 'en' ? "Mark read" : "Karanta"}
                      >
                        <Check className="h-3 w-3 font-extrabold" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Enterprise Push Notification Center Integration */}
            <div className="px-4 py-3 bg-slate-900 border-t border-border-main/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-blue-400" />
                  {lang === 'en' ? "Enterprise Web Push" : "Gargadin Web Push"}
                </span>
                {pushSupported && (
                  <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    isPushSubscribed 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : pushPermission === 'denied' 
                        ? 'bg-red-500/10 text-red-400' 
                        : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {isPushSubscribed 
                      ? (lang === 'en' ? 'Active' : 'Aiki') 
                      : pushPermission === 'denied' 
                        ? (lang === 'en' ? 'Blocked' : 'An Toshe') 
                        : (lang === 'en' ? 'Offline' : 'Ba ya Aiki')}
                  </span>
                )}
              </div>

              {!pushSupported ? (
                <p className="text-[10px] text-slate-500 leading-normal">
                  {lang === 'en' ? "Web Push is not supported on this browser context." : "Wannan bincike ba ya tallafawa Web Push."}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] text-slate-400 leading-normal">
                    {isPushSubscribed 
                      ? (lang === 'en' 
                          ? `Registered. Currently active on ${pushDevicesCount} of your devices.` 
                          : `An yi rajista. Yana aiki akan na'urorinka ${pushDevicesCount}.`)
                      : (lang === 'en'
                          ? "Authorize secure lock screen transmissions to receive instant payments & operational updates."
                          : "Tabbatar da amintaccen gargadi don samun kudaden shiga nan take.")}
                  </p>

                  {pushError && (
                    <span className="text-[9px] text-rose-400 font-medium">{pushError}</span>
                  )}

                  <button
                    onClick={handleTogglePush}
                    disabled={pushLoading}
                    className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                      isPushSubscribed
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                        : 'bg-brand-gold text-slate-950 hover:bg-brand-gold/90 border border-transparent shadow-sm'
                    }`}
                  >
                    {pushLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isPushSubscribed ? (
                      <>
                        <BellOff className="h-3 w-3" />
                        {lang === 'en' ? 'Deregister Current Device' : "Cire Wannan Na'urar"}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3 w-3" />
                        {lang === 'en' ? 'Enable Lock Screen Push' : 'Kunna Gargadi a Allon Kulle'}
                      </>
                    )}
                  </button>
                </div>
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
