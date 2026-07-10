/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, Info, AlertTriangle, CheckCircle2, Trash2, Search, Filter, MailOpen, Calendar } from 'lucide-react';
import { AppNotification } from '../types';
import { dbStore } from '../utils/dbStore';
import { api } from '../utils/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface NotificationInboxProps {
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

export const NotificationInbox: React.FC<NotificationInboxProps> = ({ lang }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const list = await api.request('/api/notifications');
      if (Array.isArray(list)) {
        setNotifications(list.map(mapNotification));
      } else {
        setNotifications(dbStore.getNotifications().map(mapNotification));
      }
    } catch (err) {
      console.warn("Failed to fetch notifications, using fallback store", err);
      setNotifications(dbStore.getNotifications().map(mapNotification));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

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

  const handleMarkSingleRead = async (id: string) => {
    try {
      await api.request(`/api/notifications/${id}/read`, {
        method: 'PUT'
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark single read", err);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.request('/api/notifications/read-all', {
        method: 'PUT'
      });
      dbStore.markAllNotificationsRead();
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all read", err);
      dbStore.markAllNotificationsRead();
      fetchNotifications();
    }
  };

  const handleClearAll = () => {
    dbStore.saveNotifications([]);
    setNotifications([]);
  };

  const typeIcons = {
    info: <Info className="h-5 w-5 text-blue-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    danger: <Bell className="h-5 w-5 text-red-500" />
  };

  const filtered = notifications.filter(n => {
    // Read/Unread Filter
    if (filter === 'unread' && n.read) return false;
    if (filter === 'read' && !n.read) return false;

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (lang === 'en' ? n.titleEn : n.titleHa).toLowerCase();
      const msg = (lang === 'en' ? n.messageEn : n.messageHa).toLowerCase();
      return title.includes(q) || msg.includes(q);
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto py-2 animate-fadeIn w-full flex-1">
      {/* Inbox Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main/50 pb-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-text-main flex items-center gap-3">
            <Bell className="h-8 w-8 text-brand-gold" />
            {lang === 'en' ? "Corporate Notification Inbox" : "Rumbun Sanarwa Na Kamfani"}
          </h2>
          <p className="text-sm text-text-muted mt-1 leading-normal">
            {lang === 'en'
              ? "Review, search, and manage secure fleet transmissions, financial updates, and system state notifications."
              : "Duba, bincika, da kuma sarrafa dukkan sanarwar kamfani dangane da kudi, motoci, da tafiye-tafiye."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="font-bold flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              {lang === 'en' ? "Mark All as Read" : "Karanta Duka"}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="font-bold flex items-center gap-1.5 text-xs text-brand-danger hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {lang === 'en' ? "Clear Inbox" : "Goge Duka"}
            </Button>
          )}
        </div>
      </div>

      {/* Control Panel: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-bg-surface p-4 rounded-xl border border-border-main shadow-2xs">
        {/* State Tabs */}
        <div className="flex bg-bg-base p-1 rounded-lg border border-border-main/60 w-full sm:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-white text-text-main shadow-2xs font-extrabold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "All Alerts" : "Duka"} ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all relative ${
              filter === 'unread'
                ? 'bg-white text-text-main shadow-2xs font-extrabold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "Unread" : "Ba a Karanta ba"} ({unreadCount})
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-brand-danger" />
            )}
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              filter === 'read'
                ? 'bg-white text-text-main shadow-2xs font-extrabold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "Archived" : "Wadanda aka karanta"} ({notifications.length - unreadCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            placeholder={lang === 'en' ? "Search notifications..." : "Bincika sanarwa..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-bg-base border border-border-main rounded-lg text-text-main focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
          />
        </div>
      </div>

      {/* Notifications List */}
      <Card className="flex flex-col divide-y divide-border-main/50 p-0 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-text-muted font-bold text-xs font-mono">
            {lang === 'en' ? "Synchronizing alert database..." : "Ana duba rumbun sanarwa..."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <MailOpen className="h-10 w-10 text-text-muted/40" />
            <div className="max-w-xs">
              <h4 className="text-sm font-bold text-text-main">
                {lang === 'en' ? "No notifications found" : "Babu wata sanarwa"}
              </h4>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                {lang === 'en'
                  ? "There are no notifications matching your active search query or inbox filter parameters."
                  : "Babu wata sanarwa a cikin wannan rukunin a halin yanzu."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {filtered.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`p-5 flex gap-4 transition-colors relative group border-b border-border-main/40 last:border-0 ${
                    n.read 
                      ? 'bg-transparent opacity-85 hover:bg-slate-50/40 dark:hover:bg-slate-900/10' 
                      : 'bg-brand-gold/5 hover:bg-brand-gold/10'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{typeIcons[n.type] || <Bell className="h-5 w-5" />}</div>
                  
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold leading-tight ${n.read ? 'text-text-main' : 'text-text-main font-extrabold'}`}>
                        {lang === 'en' ? n.titleEn : n.titleHa}
                      </span>
                      {!n.read && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-brand-gold text-slate-950 uppercase tracking-wider font-mono">
                          {lang === 'en' ? "New" : "Sabuwa"}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-text-muted mt-1.5 leading-relaxed font-sans max-w-3xl">
                      {lang === 'en' ? n.messageEn : n.messageHa}
                    </p>

                    <div className="flex items-center gap-4 mt-3 text-[10px] text-text-muted/70 font-semibold font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(n.timestamp).toLocaleDateString(lang === 'en' ? 'en-US' : 'en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span>
                        {new Date(n.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Context Action */}
                  {!n.read && (
                    <button
                      onClick={() => handleMarkSingleRead(n.id)}
                      className="absolute right-5 top-5 p-1.5 rounded-lg bg-white border border-border-main text-brand-gold hover:text-white hover:bg-brand-gold hover:border-brand-gold shadow-2xs opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                      title={lang === 'en' ? "Mark read" : "Karanta"}
                    >
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </div>
  );
};
