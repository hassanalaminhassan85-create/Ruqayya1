/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, Check, Info, AlertTriangle, CheckCircle2, Trash2, Search, Filter, MailOpen, Calendar,
  Shield, CreditCard, Coins, Truck, Users, Megaphone, FileText, Lock, ShieldCheck, Pin,
  Settings, Volume2, VolumeX, Smartphone, Eye, Languages, Sparkles, Loader2, ArrowRight, Activity, Clock,
  SmartphoneNfc, Archive, ShieldAlert, BadgeInfo
} from 'lucide-react';
import { AppNotification } from '../types';
import { api } from '../utils/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { playNotificationSound, triggerVibration, registerPushSubscription, requestNotificationPermission } from '../utils/notificationHelper';

interface NotificationInboxProps {
  lang: 'en' | 'ha';
}

export const NotificationInbox: React.FC<NotificationInboxProps> = ({ lang }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived' | 'history' | 'settings'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Real-time synchronization state
  const [isSyncActive, setIsSyncActive] = useState(true);
  
  // AI Translation loading map
  const [translatingMap, setTranslatingMap] = useState<Record<string, boolean>>({});

  // Settings states
  const [settingsForm, setSettingsForm] = useState({
    enablePush: true,
    enableSound: true,
    enableVibration: true,
    enableAnnouncement: true,
    enableFinanceAlerts: true,
    enableSecurityAlerts: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00',
    preferredLanguage: 'en' as 'en' | 'ha'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  const [currentUserRole, setCurrentUserRole] = useState<string>('driver');

  // Fetch all notifications from backend
  const fetchNotifications = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (activeTab === 'unread') queryParams.append('status', 'unread');
      else if (activeTab === 'archived') queryParams.append('status', 'archived');
      
      const list = await api.request(`/api/notifications?${queryParams.toString()}`);
      if (Array.isArray(list)) {
        setNotifications(list);
      }
    } catch (err) {
      console.warn("Failed to retrieve fresh notification payload", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Settings
  const fetchSettings = async () => {
    try {
      const res = await api.request('/api/notifications/settings');
      if (res && res.id) {
        setSettingsForm({
          enablePush: res.enablePush !== undefined ? !!res.enablePush : true,
          enableSound: res.enableSound !== undefined ? !!res.enableSound : true,
          enableVibration: res.enableVibration !== undefined ? !!res.enableVibration : true,
          enableAnnouncement: res.enableAnnouncement !== undefined ? !!res.enableAnnouncement : true,
          enableFinanceAlerts: res.enableFinanceAlerts !== undefined ? !!res.enableFinanceAlerts : true,
          enableSecurityAlerts: res.enableSecurityAlerts !== undefined ? !!res.enableSecurityAlerts : true,
          quietHoursStart: res.quietHoursStart || '22:00',
          quietHoursEnd: res.quietHoursEnd || '06:00',
          preferredLanguage: res.preferredLanguage || 'en'
        });
      }
    } catch (err) {
      console.warn("Could not retrieve notification preferences from DB", err);
    }
  };

  // Fetch History Audit Log (For Directors and Admins)
  const fetchHistoryLogs = async () => {
    setLoadingHistory(true);
    try {
      const logs = await api.request('/api/notifications/history');
      if (Array.isArray(logs)) {
        setHistoryLogs(logs);
      }
    } catch (err) {
      console.warn("Could not fetch notification audit trail", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
    fetchSettings();

    // Fetch user profile to check role
    api.getMe().then(payload => {
      if (payload && payload.user) {
        setCurrentUserRole(payload.user.role);
      }
    }).catch(() => {});

    // Hook to real-time events via SSE
    const handleDBChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail.notifications)) {
        // Feed direct SSE updates safely
        fetchNotifications();
      }
    };

    const handleOnlineStatus = () => setIsSyncActive(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('db-change', handleDBChange);

    return () => {
      window.removeEventListener('db-change', handleDBChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [activeTab]);

  // Handle Preferences Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsSuccess('');
    try {
      await api.request('/api/notifications/settings', {
        method: 'POST',
        body: JSON.stringify(settingsForm)
      });
      setSettingsSuccess(lang === 'en' ? "Notification preferences updated successfully." : "An adana saitunan sanarwa cikin nasara.");
      
      // Instantly switch language on local device if modified
      if (settingsForm.preferredLanguage !== lang) {
        localStorage.setItem('ruqayya_lang', settingsForm.preferredLanguage);
        window.location.reload();
      }
    } catch (err) {
      console.error("Preferences save failed", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Setup Web Push Notification Subscription Flow
  const handleEnablePushNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      alert(lang === 'en' 
        ? "Notification permissions were denied. Please enable them in your browser site settings." 
        : "An ki amincewa da izinin sanarwa. Da fatan za a kunna ta a saitunan burauzar ku.");
      return;
    }

    const success = await registerPushSubscription();
    if (success) {
      alert(lang === 'en' 
        ? "WhatsApp-style background lock screen push notifications registered!" 
        : "An yi rajistar sanarwar bangon WhatsApp cikin nasara!");
      setSettingsForm(prev => ({ ...prev, enablePush: true }));
    } else {
      alert(lang === 'en' 
        ? "Could not configure push notifications. Native notifications fallback is active." 
        : "An kasa hada push notifications. Amma sanarwar browser tana aiki.");
    }
  };

  // Toggle Pinned status
  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.request(`/api/notifications/${id}/pin`, { method: 'POST' });
      setNotifications(prev => prev.map(n => {
        if (n.id === id) {
          const isPinned = n.status === 'pinned';
          return { ...n, status: isPinned ? 'read' : 'pinned' };
        }
        return n;
      }));
    } catch (err) {
      console.error("Failed to pin notification", err);
    }
  };

  // Toggle Archived status
  const handleToggleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.request(`/api/notifications/${id}/archive`, { method: 'POST' });
      setNotifications(prev => prev.map(n => {
        if (n.id === id) {
          const isArchived = n.status === 'archived';
          return { ...n, status: isArchived ? 'read' : 'archived', read: true };
        }
        return n;
      }));
    } catch (err) {
      console.error("Failed to archive notification", err);
    }
  };

  // Mark single as read
  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.request(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, status: 'read' } : n));
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.request(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  // AI Instant Translator using Gemini API
  const handleAITranslate = async (id: string, text: string, toLang: 'en' | 'ha', e: React.MouseEvent) => {
    e.stopPropagation();
    setTranslatingMap(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.request('/api/notifications/translate', {
        method: 'POST',
        body: JSON.stringify({ text, to: toLang })
      });
      if (res && res.translation) {
        setNotifications(prev => prev.map(n => {
          if (n.id === id) {
            if (toLang === 'ha') {
              return { ...n, messageHa: res.translation, titleHa: res.translation.substring(0, 30) + '...' };
            } else {
              return { ...n, messageEn: res.translation, titleEn: res.translation.substring(0, 30) + '...' };
            }
          }
          return n;
        }));
      }
    } catch (err) {
      console.error("AI Translation failed", err);
    } finally {
      setTranslatingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: 'read' | 'archive' | 'pin' | 'delete') => {
    if (selectedIds.length === 0) return;
    try {
      await api.request('/api/notifications/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, action })
      });
      
      if (action === 'delete') {
        setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
      } else if (action === 'read') {
        setNotifications(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, read: true, status: 'read' } : n));
      } else if (action === 'archive') {
        setNotifications(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, read: true, status: 'archived' } : n));
      } else if (action === 'pin') {
        setNotifications(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, status: 'pinned' } : n));
      }
      setSelectedIds([]);
    } catch (err) {
      console.error("Bulk operations failed", err);
    }
  };

  // Handle Custom action link click
  const handleActionClick = (actionPath: string, actionName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!actionPath) return;
    
    // Dispatch a beautiful custom navigation event
    window.dispatchEvent(new CustomEvent('navigate-to-section', {
      detail: {
        section: actionPath.substring(1), // Strip leading slash e.g. 'drivers'
        tab: 'overview'
      }
    }));
  };

  // Toggle selection
  const handleSelectId = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(n => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Render Categorized Icons
  const categoryConfig: Record<string, { icon: React.ReactNode; color: string; labelEn: string; labelHa: string }> = {
    payments: { icon: <CreditCard className="h-4 w-4" />, color: 'text-emerald-500 bg-emerald-500/10', labelEn: 'Payments', labelHa: 'Biyan Kudade' },
    finance: { icon: <Coins className="h-4 w-4" />, color: 'text-brand-gold bg-brand-gold/10', labelEn: 'Financials', labelHa: 'Kuɗi' },
    drivers: { icon: <Truck className="h-4 w-4" />, color: 'text-blue-500 bg-blue-500/10', labelEn: 'Drivers & Fleet', labelHa: 'Direbobi' },
    shareholders: { icon: <Users className="h-4 w-4" />, color: 'text-purple-500 bg-purple-500/10', labelEn: 'Shareholders', labelHa: 'Abokan Kasuwanci' },
    security: { icon: <Shield className="h-4 w-4" />, color: 'text-red-500 bg-red-500/10', labelEn: 'Security & Access', labelHa: 'Tsaro' },
    reports: { icon: <FileText className="h-4 w-4" />, color: 'text-indigo-500 bg-indigo-500/10', labelEn: 'Audit Reports', labelHa: 'Rahoto' },
    announcements: { icon: <Megaphone className="h-4 w-4" />, color: 'text-amber-500 bg-amber-500/10', labelEn: 'Corporate Broadcasts', labelHa: 'Sanarwa' },
    documents: { icon: <FileText className="h-4 w-4" />, color: 'text-cyan-500 bg-cyan-500/10', labelEn: 'Documents', labelHa: 'Takardun Shaida' },
    system: { icon: <Lock className="h-4 w-4" />, color: 'text-slate-500 bg-slate-500/10', labelEn: 'System Alerts', labelHa: 'Tsarin ERP' }
  };

  const priorityConfig: Record<string, { labelEn: string; labelHa: string; badgeClass: string; textClass: string }> = {
    critical: { labelEn: 'CRITICAL', labelHa: 'MAFI GURGUNTU', badgeClass: 'bg-red-500/10 text-red-500 ring-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)] animate-pulse', textClass: 'text-red-600 font-extrabold' },
    high: { labelEn: 'HIGH', labelHa: 'MAI GIRMA', badgeClass: 'bg-amber-500/10 text-amber-500 ring-amber-500/20', textClass: 'text-amber-600 font-bold' },
    medium: { labelEn: 'MEDIUM', labelHa: 'TSAKATSAKI', badgeClass: 'bg-blue-500/10 text-blue-500 ring-blue-500/20', textClass: 'text-blue-600 font-semibold' },
    low: { labelEn: 'LOW', labelHa: 'KADAN', badgeClass: 'bg-slate-500/10 text-slate-500 ring-slate-500/20', textClass: 'text-slate-500 font-normal' }
  };

  const filtered = notifications.filter(n => {
    // Category Filter
    if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
    
    // Priority Filter
    if (selectedPriority !== 'all' && n.priority !== selectedPriority) return false;

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
  const isElevatedRole = currentUserRole === 'admin' || currentUserRole === 'director';

  // Load audit trail logs on switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && isElevatedRole) {
      fetchHistoryLogs();
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto py-2 animate-fadeIn w-full flex-1 px-4 md:px-0">
      
      {/* HEADER BANNER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main/50 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-text-main flex items-center gap-3">
              <Bell className="h-8 w-8 text-brand-gold animate-bounce" />
              {lang === 'en' ? "Notification & Localization Center" : "Wurin Sanarwa da Saituna"}
            </h2>
            
            {/* REAL-TIME PULSING SSE STATUS INDICATOR */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ring-1 ${
              isSyncActive 
                ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isSyncActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isSyncActive 
                ? (lang === 'en' ? "SSE Synchronized" : "SSE Daidaita") 
                : (lang === 'en' ? "Offline (Queueing)" : "Babu Intanet")}
            </div>
          </div>
          
          <p className="text-sm text-text-muted mt-1.5 leading-normal">
            {lang === 'en'
              ? "WhatsApp-style native pushes, customized sound synthesis, silent hour policies, and on-the-fly Gemini translations."
              : "Sanarwa irin ta WhatsApp, amo na musamman, lokutan hutu, da fassarar inji mai kwakwalwa ta Gemini."}
          </p>
        </div>
      </div>

      {/* THREE-PANE TABS CONTROL PANEL */}
      <div className="flex flex-col md:flex-row items-center gap-4 justify-between bg-bg-surface p-4 rounded-xl border border-border-main shadow-2xs">
        
        {/* State tabs */}
        <div className="flex bg-bg-base p-1 rounded-lg border border-border-main/60 w-full md:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => { setActiveTab('all'); setSelectedIds([]); }}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-text-main shadow-2xs font-extrabold border border-border-main/35'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "All Alerts" : "Duka"} ({notifications.length})
          </button>
          
          <button
            onClick={() => { setActiveTab('unread'); setSelectedIds([]); }}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
              activeTab === 'unread'
                ? 'bg-white text-text-main shadow-2xs font-extrabold border border-border-main/35'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "Unread" : "Ba a Karanta ba"} ({unreadCount})
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-brand-danger" />
            )}
          </button>
          
          <button
            onClick={() => { setActiveTab('archived'); setSelectedIds([]); }}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'archived'
                ? 'bg-white text-text-main shadow-2xs font-extrabold border border-border-main/35'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "Archived" : "Wadanda aka Adana"} ({notifications.filter(n => n.status === 'archived').length})
          </button>

          {isElevatedRole && (
            <button
              onClick={() => { setActiveTab('history'); setSelectedIds([]); }}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-text-main shadow-2xs font-extrabold border border-border-main/35'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {lang === 'en' ? "Transmission History & Audit" : "Tarihin Sanarwa & Audit"}
            </button>
          )}

          <button
            onClick={() => { setActiveTab('settings'); setSelectedIds([]); }}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-text-main shadow-2xs font-extrabold border border-border-main/35'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Settings className="h-3 w-3" />
            {lang === 'en' ? "Preferences (Saituna)" : "Saituna"}
          </button>
        </div>

        {/* Search & filters inside list-tabs */}
        {(activeTab === 'all' || activeTab === 'unread' || activeTab === 'archived') && (
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            
            {/* Category selection */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs bg-bg-base border border-border-main rounded-lg text-text-main cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-gold/45"
              >
                <option value="all">{lang === 'en' ? "All Categories" : "Duk Rukunoni"}</option>
                {Object.entries(categoryConfig).map(([key, value]) => (
                  <option key={key} value={key}>{lang === 'en' ? value.labelEn : value.labelHa}</option>
                ))}
              </select>
            </div>

            {/* Priority selection */}
            <div className="relative">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs bg-bg-base border border-border-main rounded-lg text-text-main cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-gold/45"
              >
                <option value="all">{lang === 'en' ? "All Priorities" : "Duk Matakai"}</option>
                <option value="critical">{lang === 'en' ? "Critical" : "Gaggawa"}</option>
                <option value="high">{lang === 'en' ? "High" : "Sama"}</option>
                <option value="medium">{lang === 'en' ? "Medium" : "Matsakaici"}</option>
                <option value="low">{lang === 'en' ? "Low" : "Kasa"}</option>
              </select>
            </div>

            {/* General search bar */}
            <div className="relative w-full sm:max-w-xs md:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                placeholder={lang === 'en' ? "Search..." : "Bincika..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-base border border-border-main rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-brand-gold/45"
              />
            </div>
          </div>
        )}
      </div>

      {/* MULTI-SELECT FLOATING ACTION PANEL */}
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-navy dark:bg-slate-900 border border-brand-gold/30 p-3.5 rounded-xl flex items-center justify-between text-white shadow-xl"
        >
          <div className="flex items-center gap-3 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-brand-gold" />
            <span>
              {lang === 'en' 
                ? `${selectedIds.length} items selected for bulk execution` 
                : `An zabi sanarwa guda ${selectedIds.length} domin aiwatarwa`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleBulkAction('read')}
              className="text-slate-950 font-bold border-white/20 bg-white hover:bg-slate-100 flex items-center gap-1 cursor-pointer text-[10px]"
            >
              <Check className="h-3 w-3 text-slate-950" />
              {lang === 'en' ? "Mark Read" : "Karanta"}
            </Button>
            
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleBulkAction('archive')}
              className="text-white border-white/20 bg-slate-800 hover:bg-slate-700 flex items-center gap-1 cursor-pointer text-[10px]"
            >
              <Archive className="h-3 w-3" />
              {lang === 'en' ? "Archive" : "Adana"}
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={() => handleBulkAction('pin')}
              className="text-white border-white/20 bg-slate-800 hover:bg-slate-700 flex items-center gap-1 cursor-pointer text-[10px]"
            >
              <Pin className="h-3 w-3 text-brand-gold fill-brand-gold" />
              {lang === 'en' ? "Pin Alerts" : "Saka Fil"}
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={() => handleBulkAction('delete')}
              className="border-red-500/30 bg-red-500 text-white hover:bg-red-600 flex items-center gap-1 cursor-pointer text-[10px]"
            >
              <Trash2 className="h-3 w-3" />
              {lang === 'en' ? "Delete" : "Goge"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* MASTER RENDERER */}
      <div className="flex flex-col w-full">
        {loading ? (
          <Card className="py-20 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-brand-gold animate-spin" />
            <span className="font-mono text-xs">{lang === 'en' ? "De-serializing secure transmission feeds..." : "Ana duba rumbun sanarwa..."}</span>
          </Card>
        ) : (activeTab === 'all' || activeTab === 'unread' || activeTab === 'archived') ? (
          
          /* ACTIVE NOTIFICATIONS LIST FEED */
          <Card className="p-0 overflow-hidden shadow-xs border border-border-main divide-y divide-border-main/55">
            {filtered.length === 0 ? (
              <div className="py-20 text-center text-text-muted flex flex-col items-center justify-center gap-3.5">
                <MailOpen className="h-12 w-12 text-text-muted/30" />
                <div className="max-w-md">
                  <h4 className="text-sm font-bold text-text-main">
                    {lang === 'en' ? "Your notification container is clean" : "Babu wata sanarwa a halin yanzu"}
                  </h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed px-4">
                    {lang === 'en'
                      ? "There are no transmission logs or alert states matching the selected criteria. Real-time background sync is active."
                      : "Babu wani sako da ya dace da abinda kake nema a halin yanzu."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* LIST HEADER ACTIONS */}
                <div className="px-5 py-3 bg-bg-base/35 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className="rounded text-brand-gold border-border-main focus:ring-brand-gold"
                  />
                  <span className="text-[11px] font-bold text-text-muted/80 uppercase font-mono tracking-wider">
                    {lang === 'en' ? "Select All Alerts" : "Zabi Duka"} ({filtered.length})
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {filtered.map((n, idx) => {
                    const isSelected = selectedIds.includes(n.id);
                    const catInfo = categoryConfig[n.category || 'system'] || categoryConfig.system;
                    const prioInfo = priorityConfig[n.priority || 'medium'] || priorityConfig.medium;
                    const isPinned = n.status === 'pinned';
                    const isArchived = n.status === 'archived';
                    const isTranslating = translatingMap[n.id];

                    return (
                      <motion.div
                        key={n.id || `inbox-notif-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`p-5 flex gap-4 relative group transition-all duration-150 ${
                          isSelected ? 'bg-slate-100/60 dark:bg-slate-900/40' : (n.read ? 'bg-transparent opacity-80' : 'bg-brand-gold/5 dark:bg-brand-gold/5')
                        } ${isPinned ? 'border-l-4 border-brand-gold bg-brand-gold/10' : ''}`}
                      >
                        {/* Selector checkbox */}
                        <div className="pt-1.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectId(n.id, e)}
                            className="rounded text-brand-gold border-border-main focus:ring-brand-gold cursor-pointer"
                          />
                        </div>

                        {/* Category Visualizer */}
                        <div className="shrink-0 pt-0.5">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center border border-border-main/40 ${catInfo.color}`}>
                            {catInfo.icon}
                          </div>
                        </div>

                        {/* Core text content */}
                        <div className="flex-1 min-w-0 pr-12">
                          <div className="flex items-center gap-2 flex-wrap">
                            
                            {/* Pinned visual icon */}
                            {isPinned && (
                              <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-brand-gold uppercase tracking-wider font-mono">
                                <Pin className="h-2.5 w-2.5 fill-brand-gold" />
                                {lang === 'en' ? "Pinned" : "An saka Fil"}
                              </span>
                            )}

                            {/* Category text tag */}
                            <span className="text-[10px] font-extrabold text-text-muted/75 font-mono uppercase tracking-wider">
                              {lang === 'en' ? catInfo.labelEn : catInfo.labelHa}
                            </span>
                            
                            {/* Priority Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider font-mono ${prioInfo.badgeClass}`}>
                              {lang === 'en' ? prioInfo.labelEn : prioInfo.labelHa}
                            </span>

                            {/* New unread indicator */}
                            {!n.read && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-brand-gold text-slate-950 uppercase tracking-widest font-mono">
                                {lang === 'en' ? "New" : "Sabuwa"}
                              </span>
                            )}
                          </div>

                          <h3 className={`text-sm mt-1.5 leading-snug ${n.read ? 'text-text-main font-semibold' : 'text-text-main font-black'}`}>
                            {lang === 'en' ? n.titleEn : n.titleHa}
                          </h3>

                          <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-4xl font-medium">
                            {lang === 'en' ? n.messageEn : n.messageHa}
                          </p>

                          {/* Interactive operational action links */}
                          {n.actions && n.actions.length > 0 && (
                            <div className="flex items-center gap-2 mt-3">
                              {n.actions.map((act, index) => {
                                if (act.action === 'dismiss') return null;
                                return (
                                  <button
                                    key={index}
                                    onClick={(e) => handleActionClick(act.path, act.action, e)}
                                    className="px-3 py-1 bg-brand-navy text-white hover:bg-slate-800 dark:bg-brand-gold dark:text-slate-950 dark:hover:bg-amber-400 text-[10px] font-black uppercase tracking-wider rounded flex items-center gap-1 transition-all duration-150 cursor-pointer border border-transparent shadow-2xs"
                                  >
                                    <span>{lang === 'en' ? act.labelEn : act.labelHa}</span>
                                    <ArrowRight className="h-3 w-3 stroke-[2.5]" />
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Timestamp and delivery receipts metadata */}
                          <div className="flex items-center gap-4 mt-3 text-[10px] text-text-muted/65 font-bold font-mono border-t border-border-main/30 pt-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(n.timestamp).toLocaleDateString(lang === 'en' ? 'en-US' : 'en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(n.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {lang === 'en' ? "Delivered" : "An tura"}
                            </span>
                            {n.read && (
                              <span className="text-blue-500 flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {lang === 'en' ? `Opened` : `An duba`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* HOVER ACTION CONTROLS */}
                        <div className="absolute right-4 top-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          
                          {/* AI Translate Trigger */}
                          <button
                            onClick={(e) => handleAITranslate(
                              n.id, 
                              lang === 'en' ? n.messageEn : n.messageHa, 
                              lang === 'en' ? 'ha' : 'en', 
                              e
                            )}
                            disabled={isTranslating}
                            className="p-1.5 rounded-lg bg-bg-surface border border-border-main text-brand-gold hover:bg-brand-gold/5 cursor-pointer flex items-center gap-1"
                            title={lang === 'en' ? "AI Translate to Hausa" : "Fassara da AI zuwa Turanci"}
                          >
                            {isTranslating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            <span className="text-[9px] font-extrabold uppercase font-mono tracking-wider">{lang === 'en' ? "HA" : "EN"}</span>
                          </button>

                          {/* Pin Toggle */}
                          <button
                            onClick={(e) => handleTogglePin(n.id, e)}
                            className={`p-1.5 rounded-lg bg-bg-surface border border-border-main cursor-pointer ${isPinned ? 'text-brand-gold border-brand-gold/40 bg-brand-gold/5' : 'text-text-muted hover:text-brand-gold'}`}
                            title={isPinned ? (lang === 'en' ? "Unpin" : "Cire Fil") : (lang === 'en' ? "Pin Alert" : "Saka Fil")}
                          >
                            <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-brand-gold' : ''}`} />
                          </button>

                          {/* Archive Toggle */}
                          <button
                            onClick={(e) => handleToggleArchive(n.id, e)}
                            className={`p-1.5 rounded-lg bg-bg-surface border border-border-main cursor-pointer ${isArchived ? 'text-indigo-500 border-indigo-500/40 bg-indigo-500/5' : 'text-text-muted hover:text-text-main'}`}
                            title={isArchived ? (lang === 'en' ? "Unarchive" : "Cire a Taska") : (lang === 'en' ? "Archive Alert" : "Tura Taska")}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>

                          {/* Mark Read */}
                          {!n.read && (
                            <button
                              onClick={(e) => handleMarkSingleRead(n.id, e)}
                              className="p-1.5 rounded-lg bg-bg-surface border border-border-main text-emerald-500 hover:bg-emerald-50/20 cursor-pointer"
                              title={lang === 'en' ? "Mark Read" : "Karanta"}
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                          )}

                          {/* Delete soft */}
                          <button
                            onClick={(e) => handleDeleteNotification(n.id, e)}
                            className="p-1.5 rounded-lg bg-bg-surface border border-border-main text-brand-danger hover:bg-red-50/20 cursor-pointer"
                            title={lang === 'en' ? "Delete notification" : "Goge"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </Card>
        ) : activeTab === 'history' ? (

          /* TRANSMISSION AUDIT TRAIL PANE */
          <Card className="flex flex-col gap-4">
            <div className="border-b border-border-main pb-3">
              <h3 className="text-base font-extrabold text-text-main flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-gold" />
                {lang === 'en' ? "Secure Notification Audit History" : "Rumbun Binciken Sanarwa na Kamfani"}
              </h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                {lang === 'en' 
                  ? "Verifiable ledger tracking all corporate push notification lifecycle operations (creation, queueing, device receipt, and user dismissal actions)."
                  : "Binciken tsarin rarraba dukkan sakonni da amincewar masu amfani da burauza a fadin kamfani."}
              </p>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center text-text-muted flex flex-col items-center justify-center gap-2 font-mono text-xs">
                <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
                <span>Retrieving administrative audit trail...</span>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs font-mono">
                No notification transmission logs captured in audit session ledger.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bg-base text-text-muted font-bold font-mono border-b border-border-main">
                      <th className="p-3">LOG ID</th>
                      <th className="p-3">OPERATOR / ROLE</th>
                      <th className="p-3">ACTION EVENT</th>
                      <th className="p-3">TRANSMISSION DETAIL</th>
                      <th className="p-3">METRICS / DEVICE</th>
                      <th className="p-3">TIMESTAMP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/50 font-medium">
                    {historyLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-bg-base/30">
                        <td className="p-3 font-mono text-[10px] text-brand-gold font-bold">{log.id}</td>
                        <td className="p-3">
                          <span className="block font-bold text-text-main">{log.user_email}</span>
                          <span className="text-[10px] text-text-muted font-mono uppercase font-extrabold">{log.user_role}</span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black font-mono bg-slate-100 text-slate-800 border border-slate-200/50 uppercase">
                            {log.action.replace('NOTIFICATION_', '')}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-[11px] text-text-main font-semibold" title={log.new_value}>
                          {log.new_value}
                        </td>
                        <td className="p-3 text-[10px] text-text-muted leading-tight font-mono max-w-xxs truncate" title={log.device}>
                          <span className="block font-bold">IP: {log.ip_address}</span>
                          <span className="text-[9px] opacity-75">{log.device}</span>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-text-muted">
                          {new Date(log.created_at || log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (

          /* DETAILED SETTINGS / PREFERENCES FORM */
          <Card className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
            <div className="border-b border-border-main pb-3">
              <h3 className="text-base font-extrabold text-text-main flex items-center gap-2">
                <Settings className="h-5 w-5 text-brand-gold" />
                {lang === 'en' ? "Notification Channel Preferences" : "Saitunan Karbar Sanarwa"}
              </h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                {lang === 'en'
                  ? "Configure custom sound alerts, native push infrastructure, vibration triggers, and Silent Hours rules."
                  : "Gyara amo, sautuna, tura sakonni koda kuwa application a rufe yake, da lokutan hutu na musamman."}
              </p>
            </div>

            {settingsSuccess && (
              <div className="bg-emerald-500/10 text-emerald-500 p-3.5 rounded-xl text-xs font-bold border border-emerald-500/20 shadow-2xs">
                {settingsSuccess}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="flex flex-col gap-5 text-xs text-text-main">
              
              {/* Push registration panel */}
              <div className="bg-brand-gold/5 dark:bg-brand-gold/5 border border-brand-gold/25 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex gap-3 items-start">
                  <div className="p-2 rounded-lg bg-brand-gold/10 text-brand-gold shrink-0">
                    <SmartphoneNfc className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-main">
                      {lang === 'en' ? "Enable WhatsApp-Style Background Push Notifications" : "Kunna Sanarwar tura sako a lock panel"}
                    </h4>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                      {lang === 'en' 
                        ? "Receive critical reminders immediately on your mobile/desktop lock screen even when the ERP application is closed."
                        : "Sami muhimman sanarwa kai tsaye akan allon wayar ku ko kwamfuta koda duka tab din a rufe suke."}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEnablePushNotifications}
                  className="font-bold shrink-0 text-slate-950 bg-brand-gold hover:bg-amber-400 border-brand-gold/30 cursor-pointer flex items-center gap-1"
                >
                  <Smartphone className="h-4 w-4" />
                  {lang === 'en' ? "Subscribe Device" : "Yi Rajista"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                
                {/* Visual Preference Column */}
                <div className="flex flex-col gap-4 border border-border-main/50 p-4 rounded-xl bg-bg-base/20">
                  <h4 className="font-extrabold text-xs text-text-main border-b border-border-main/40 pb-2 uppercase tracking-wide font-mono flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-brand-gold" />
                    {lang === 'en' ? "Hardware & Interface Alerts" : "Saitunan Sauti da Jijjiga"}
                  </h4>

                  {/* Sound Toggle */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div>
                      <span className="font-bold block">{lang === 'en' ? "Synthesized Sound Alerts" : "Kunna Sautin Amo"}</span>
                      <span className="text-[10px] text-text-muted">{lang === 'en' ? "Plays clean dual-beeps on arrivals via Web Audio." : "Yin amo sau biyu muddin sako ya shigo."}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.enableSound}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableSound: e.target.checked })}
                      className="rounded text-brand-gold focus:ring-brand-gold"
                    />
                  </div>

                  {/* Vibration Toggle */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div>
                      <span className="font-bold block">{lang === 'en' ? "Haptic Vibration Alerts" : "Kunna Motsin Jijjiga"}</span>
                      <span className="text-[10px] text-text-muted">{lang === 'en' ? "Trigger distinct physical vibration beats based on priority." : "Yin jijjiga ta musamman dangane da matakin gaggawa."}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.enableVibration}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableVibration: e.target.checked })}
                      className="rounded text-brand-gold focus:ring-brand-gold"
                    />
                  </div>

                  {/* Preferred Language switcher */}
                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-border-main/30">
                    <div>
                      <span className="font-bold block flex items-center gap-1.5">
                        <Languages className="h-3.5 w-3.5 text-brand-gold" />
                        {lang === 'en' ? "Default Display Language" : "Harshen Aikace-aikace"}
                      </span>
                      <span className="text-[10px] text-text-muted">{lang === 'en' ? "Your preferred ERP translation layer." : "Harshen da kafi so rumbun ya fito."}</span>
                    </div>
                    <select
                      value={settingsForm.preferredLanguage}
                      onChange={(e) => setSettingsForm({ ...settingsForm, preferredLanguage: e.target.value as 'en' | 'ha' })}
                      className="pl-2.5 pr-8 py-1 bg-bg-base border border-border-main rounded text-xs text-text-main font-bold cursor-pointer"
                    >
                      <option value="en">English (UK)</option>
                      <option value="ha">Hausa (Nijeriya)</option>
                    </select>
                  </div>
                </div>

                {/* Subscriptions Settings Column */}
                <div className="flex flex-col gap-4 border border-border-main/50 p-4 rounded-xl bg-bg-base/20">
                  <h4 className="font-extrabold text-xs text-text-main border-b border-border-main/40 pb-2 uppercase tracking-wide font-mono flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-brand-gold" />
                    {lang === 'en' ? "Quiet Hours Policy" : "Lokutan Hutu (Quiet Hours)"}
                  </h4>

                  <div className="flex flex-col gap-2 pt-1">
                    <span className="font-bold">{lang === 'en' ? "Silent Window" : "Lokacin Hutu da Sauti"}</span>
                    <span className="text-[10px] text-text-muted leading-relaxed">
                      {lang === 'en'
                        ? "Mutes physical sound and hardware vibrations within this period. Visual toasts and background history logs will still populate normally."
                        : "Ana kashe dukkan sauti da jijjiga na waya a cikin wannan lokacin don samun natsuwa."}
                    </span>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted block mb-1 uppercase font-mono">{lang === 'en' ? "Start Time" : "Fara Lokaci"}</label>
                        <input
                          type="time"
                          value={settingsForm.quietHoursStart}
                          onChange={(e) => setSettingsForm({ ...settingsForm, quietHoursStart: e.target.value })}
                          className="w-full p-2 bg-bg-base border border-border-main rounded font-bold text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted block mb-1 uppercase font-mono">{lang === 'en' ? "End Time" : "Karshen Lokaci"}</label>
                        <input
                          type="time"
                          value={settingsForm.quietHoursEnd}
                          onChange={(e) => setSettingsForm({ ...settingsForm, quietHoursEnd: e.target.value })}
                          className="w-full p-2 bg-bg-base border border-border-main rounded font-bold text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Category Filter Selectors */}
              <div className="border border-border-main/50 p-4 rounded-xl bg-bg-base/20 flex flex-col gap-3">
                <h4 className="font-extrabold text-xs text-text-main border-b border-border-main/40 pb-2 uppercase tracking-wide font-mono flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-brand-gold" />
                  {lang === 'en' ? "Subscription Transmission Channels" : "Kanal-kanal din Sanarwa"}
                </h4>

                <p className="text-[10px] text-text-muted">
                  {lang === 'en' 
                    ? "Control which groups of ERP notifications are authorized for high-priority notification buzzer triggers."
                    : "Zabi rukunonin sakonni da kake son su ringa yi maka amo ko jijjiga a waya."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                  
                  <label className="flex items-center gap-2.5 p-2.5 bg-bg-surface border border-border-main rounded-lg cursor-pointer hover:bg-slate-50/20 select-none">
                    <input
                      type="checkbox"
                      checked={settingsForm.enableAnnouncement}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableAnnouncement: e.target.checked })}
                      className="rounded text-brand-gold focus:ring-brand-gold cursor-pointer"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">{lang === 'en' ? "Broadcasts" : "Sanarwa na Kamfani"}</span>
                      <span className="text-[9px] text-text-muted">General newsletters</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-bg-surface border border-border-main rounded-lg cursor-pointer hover:bg-slate-50/20 select-none">
                    <input
                      type="checkbox"
                      checked={settingsForm.enableFinanceAlerts}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableFinanceAlerts: e.target.checked })}
                      className="rounded text-brand-gold focus:ring-brand-gold cursor-pointer"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">{lang === 'en' ? "Financials" : "Kudaden Shiga & Fitarwa"}</span>
                      <span className="text-[9px] text-text-muted">Vouchers & payments</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-bg-surface border border-border-main rounded-lg cursor-pointer hover:bg-slate-50/20 select-none">
                    <input
                      type="checkbox"
                      checked={settingsForm.enableSecurityAlerts}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableSecurityAlerts: e.target.checked })}
                      className="rounded text-brand-gold focus:ring-brand-gold cursor-pointer"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">{lang === 'en' ? "Security & Access" : "Saitunan Tsaro"}</span>
                      <span className="text-[9px] text-text-muted">Critical access alarms</span>
                    </div>
                  </label>

                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 border-t border-border-main/50 pt-4 mt-2">
                <Button
                  type="submit"
                  disabled={settingsLoading}
                  className="font-bold text-slate-950 bg-brand-gold hover:bg-amber-400 border-brand-gold/30 cursor-pointer flex items-center gap-1 min-w-[120px]"
                >
                  {settingsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {lang === 'en' ? "Save Preferences" : "Ajiye Saituna"}
                </Button>
              </div>

            </form>
          </Card>
        )}
      </div>

    </div>
  );
};
