/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Bell, AlertTriangle, Info, CheckCircle2, Eye } from 'lucide-react';
import { AppNotification } from '../types';
import { CircularLogo } from './CircularLogo';
import { api } from '../utils/api';
import { playNotificationSound, triggerVibration, showLocalBrowserNotification } from '../utils/notificationHelper';

interface NotificationToastProps {
  notification: AppNotification & {
    relatedPersonName?: string;
    relatedCompanyId?: string;
    relatedPhoto?: string;
  };
  onClose: (id: string) => void;
  lang: 'en' | 'ha';
  onViewDetails?: (notification: any) => void;
}

export const NotificationToastCard: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  lang,
  onViewDetails
}) => {
  const [timeLeft, setTimeLeft] = useState(8); // 8 seconds display
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Manage timer with hover-pause
  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 0.1));
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  // Handle toast close when timer reaches zero
  useEffect(() => {
    if (timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      onClose(notification.id);
    }
  }, [timeLeft, notification.id, onClose]);

  const handleMarkAsRead = async () => {
    try {
      // Call PUT /api/notifications/:id/read
      await api.request(`/api/notifications/${notification.id}/read`, {
        method: 'PUT'
      });
      // Close the toast
      onClose(notification.id);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
      onClose(notification.id);
    }
  };

  const typeStyles = {
    info: {
      border: 'border-blue-500/30 dark:border-blue-500/50',
      glow: 'shadow-blue-500/15 dark:shadow-blue-500/25',
      indicator: 'bg-blue-500',
      icon: <Info className="h-4 w-4 text-blue-500" />
    },
    warning: {
      border: 'border-amber-500/30 dark:border-amber-500/50',
      glow: 'shadow-amber-500/15 dark:shadow-amber-500/25',
      indicator: 'bg-amber-500',
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />
    },
    success: {
      border: 'border-emerald-500/30 dark:border-emerald-500/50',
      glow: 'shadow-emerald-500/15 dark:shadow-emerald-500/25',
      indicator: 'bg-emerald-500',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    },
    danger: {
      border: 'border-rose-500/30 dark:border-rose-500/50',
      glow: 'shadow-rose-500/15 dark:shadow-rose-500/25',
      indicator: 'bg-rose-500',
      icon: <Bell className="h-4 w-4 text-rose-500 animate-pulse" />
    }
  }[notification.type || 'info'];

  // Avatar generator using initials
  const getInitials = (name?: string) => {
    if (!name) return 'RT';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Human readable date and time formatting
  const formatDateTime = (timestampStr: string) => {
    try {
      const d = new Date(timestampStr);
      if (isNaN(d.getTime())) return { date: timestampStr, time: '' };
      return {
        date: d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ha-NG', {
          month: 'short',
          day: 'numeric'
        }),
        time: d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      };
    } catch (e) {
      return { date: timestampStr, time: '' };
    }
  };

  const { date, time } = formatDateTime(notification.timestamp);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 120, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-[380px] bg-bg-surface dark:bg-brand-navy rounded-xl border ${typeStyles.border} shadow-2xl ${typeStyles.glow} overflow-hidden p-4 flex flex-col gap-3 pointer-events-auto transition-shadow duration-300`}
    >
      {/* Top auto-dismiss progress indicator */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-slate-200/50 dark:bg-slate-800/50">
        <motion.div
          className={`h-full ${typeStyles.indicator}`}
          style={{ width: `${(timeLeft / 8) * 100}%` }}
          transition={{ ease: "linear", duration: 0.1 }}
        />
      </div>

      {/* Main content grid */}
      <div className="flex gap-3 items-start mt-1">
        {/* LEFT SIDE: Ruqayya Logo + Priority Indicator */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <CircularLogo size="sm" animateContinuous={false} />
          <div className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${typeStyles.indicator}`} />
            <span className="text-[8px] font-bold text-text-muted/80 tracking-widest font-mono uppercase">
              {notification.type || 'ALERT'}
            </span>
          </div>
        </div>

        {/* CENTER: Text content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="text-xs font-extrabold text-text-main dark:text-white leading-tight font-sans tracking-tight">
            {lang === 'en' ? notification.titleEn : notification.titleHa}
          </h4>

          {/* Message */}
          <p className="text-[11px] text-text-muted mt-1 leading-relaxed break-words font-medium">
            {lang === 'en' ? notification.messageEn : notification.messageHa}
          </p>

          {/* Metadata Grid (Related Person / Company ID / Time) */}
          <div className="mt-2 pt-1.5 border-t border-border-main/40 dark:border-slate-800/40 flex flex-wrap gap-x-3 gap-y-1 items-center text-[9px] font-medium text-text-muted/85 font-mono">
            {notification.relatedPersonName && (
              <span className="text-brand-gold dark:text-brand-yellow font-bold">
                {notification.relatedPersonName}
              </span>
            )}
            {notification.relatedCompanyId && (
              <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded-sm text-[8px] border border-slate-200/50 dark:border-slate-700/50 font-bold">
                {notification.relatedCompanyId}
              </span>
            )}
            <span className="text-text-muted/60">{date} • {time}</span>
          </div>
        </div>

        {/* RIGHT SIDE: Avatar / Photo */}
        <div className="shrink-0 flex flex-col items-center justify-center">
          {notification.relatedPhoto ? (
            <div className="h-10 w-10 rounded-full border-1.5 border-brand-gold overflow-hidden bg-slate-100 shadow-xs">
              <img
                src={notification.relatedPhoto}
                alt={notification.relatedPersonName || 'Avatar'}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-navy to-slate-800 dark:from-brand-gold/20 dark:to-brand-gold/5 border-1.5 border-brand-gold/60 dark:border-brand-gold/40 flex items-center justify-center shadow-inner">
              <span className="text-[11px] font-extrabold text-brand-gold font-mono">
                {getInitials(notification.relatedPersonName)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action panel */}
      <div className="flex items-center justify-end gap-2 border-t border-border-main/30 dark:border-slate-800/30 pt-2 mt-1 shrink-0">
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(notification)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-text-main text-[10px] font-bold transition-all duration-150 cursor-pointer border border-border-main/50"
          >
            <Eye className="h-3 w-3 text-brand-gold" />
            {lang === 'en' ? 'View details' : 'Duba daki-daki'}
          </button>
        )}
        <button
          onClick={handleMarkAsRead}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-brand-gold/10 hover:bg-brand-gold/20 dark:bg-brand-gold/15 dark:hover:bg-brand-gold/25 text-brand-gold text-[10px] font-extrabold transition-all duration-150 cursor-pointer border border-brand-gold/20"
        >
          <Check className="h-3 w-3" />
          {lang === 'en' ? 'Mark read' : 'Goge shi'}
        </button>
        <button
          onClick={() => onClose(notification.id)}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-text-muted transition-colors cursor-pointer"
          aria-label="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export const NotificationToastContainer: React.FC<{ lang: 'en' | 'ha'; currentRole: string }> = ({ lang, currentRole }) => {
  const [toasts, setToasts] = useState<any[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialSyncRef = useRef<boolean>(false);

  useEffect(() => {
    if (currentRole === 'public') {
      seenIdsRef.current.clear();
      initialSyncRef.current = false;
      setToasts([]);
      return;
    }

    // Initial fetch to mark existing notifications as "already seen" so they don't pop up on load
    const loadInitialNotifications = async () => {
      try {
        const token = api.getToken();
        if (!token) {
          initialSyncRef.current = true;
          return;
        }
        const list = await api.request('/api/notifications');
        if (Array.isArray(list)) {
          list.forEach((n: any) => {
            seenIdsRef.current.add(n.id);
          });
        }
        initialSyncRef.current = true;
      } catch (err: any) {
        const errMsg = err?.message || '';
        // Suppress expected authentication errors when a session is expired or not yet loaded
        if (!errMsg.includes('Authentication required') && !errMsg.includes('Session expired') && !errMsg.includes('login again')) {
          console.error("Failed to load initial notifications for seen list", err);
        }
        initialSyncRef.current = true;
      }
    };

    loadInitialNotifications();

    // Listen to real-time state change events on the window
    const handleDBChange = (e: Event) => {
      if (!initialSyncRef.current) return;

      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail.notifications)) {
        const incoming = detail.notifications;
        const newToastsToAdd: any[] = [];

        incoming.forEach((n: any) => {
          // If notification is not read, has not been seen before, and is not already in toasts list
          const isUnread = n.read_status === 0 || n.read === false;
          if (isUnread && !seenIdsRef.current.has(n.id)) {
            seenIdsRef.current.add(n.id);

            // Double check creation time - ignore very old historical notifications
            const createdAtTime = n.created_at ? new Date(n.created_at).getTime() : Date.now();
            const ageInMs = Date.now() - createdAtTime;
            if (ageInMs < 60000) { // must be created in the last 60 seconds to pop up
              // Map snake_case to camelCase nicely for Toast
              newToastsToAdd.push({
                id: n.id,
                titleEn: n.title_en || n.titleEn || '',
                titleHa: n.title_ha || n.titleHa || '',
                messageEn: n.message_en || n.messageEn || '',
                messageHa: n.message_ha || n.messageHa || '',
                timestamp: n.created_at || n.timestamp || new Date().toISOString(),
                type: n.type || 'info',
                read: false,
                relatedPersonName: n.related_person_name || n.relatedPersonName,
                relatedCompanyId: n.related_company_id || n.relatedCompanyId,
                relatedPhoto: n.related_photo || n.relatedPhoto
              });
            }
          }
        });

        if (newToastsToAdd.length > 0) {
          setToasts((prev) => [...prev, ...newToastsToAdd]);
          
          // Trigger alarms with Quiet Hours and user settings constraints
          try {
            api.request('/api/notifications/settings').then((settings) => {
              if (settings) {
                // Evaluate Quiet Hours
                const now = new Date();
                const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                let isQuiet = false;
                
                if (settings.quietHoursStart && settings.quietHoursEnd) {
                  const start = settings.quietHoursStart;
                  const end = settings.quietHoursEnd;
                  if (start <= end) {
                    isQuiet = currentStr >= start && currentStr <= end;
                  } else {
                    isQuiet = currentStr >= start || currentStr <= end;
                  }
                }

                if (!isQuiet) {
                  if (settings.enableSound) playNotificationSound();
                  if (settings.enableVibration) {
                    const primaryToast = newToastsToAdd[0];
                    triggerVibration(primaryToast.type);
                  }
                }

                // Deliver background lock screen notification if browser tab is hidden
                if (document.hidden && settings.enablePush) {
                  newToastsToAdd.forEach(toast => {
                    const title = lang === 'en' ? toast.titleEn : toast.titleHa;
                    const message = lang === 'en' ? toast.messageEn : toast.messageHa;
                    showLocalBrowserNotification(`RUQAYYA: ${title}`, message);
                  });
                }
              }
            }).catch(() => {
              // Safety Fallback (Always alert)
              playNotificationSound();
              triggerVibration(newToastsToAdd[0].type);
              if (document.hidden) {
                newToastsToAdd.forEach(toast => {
                  const title = lang === 'en' ? toast.titleEn : toast.titleHa;
                  const message = lang === 'en' ? toast.messageEn : toast.messageHa;
                  showLocalBrowserNotification(`RUQAYYA: ${title}`, message);
                });
              }
            });
          } catch (e) {
            console.warn("Sound vibration engine failure:", e);
          }
        }
      }
    };

    window.addEventListener('db-change', handleDBChange);
    return () => {
      window.removeEventListener('db-change', handleDBChange);
    };
  }, [currentRole]);

  const handleCloseToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleViewDetails = (not: any) => {
    // Open a details modal or focus context if a custom event handler is registered
    const viewEvent = new CustomEvent('view-notification-details', { detail: not });
    window.dispatchEvent(viewEvent);
    handleCloseToast(not.id);
  };

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 pointer-events-none max-w-full overflow-hidden">
      <AnimatePresence>
        {toasts.map((toast) => (
          <NotificationToastCard
            key={toast.id}
            notification={toast}
            onClose={handleCloseToast}
            lang={lang}
            onViewDetails={handleViewDetails}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
