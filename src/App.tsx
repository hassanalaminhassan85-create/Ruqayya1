/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { enDictionary, haDictionary } from './i18n';
import { Role, Language, Theme } from './types';
import { dbStore } from './utils/dbStore';
import { logAuditEvent, seedAuditLogsIfEmpty, SecureSession } from './utils/security';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { GlobalSearch } from './components/GlobalSearch';
import { NotificationCenter } from './components/NotificationCenter';
import { NotificationToastContainer } from './components/NotificationToast';
import { LandingPage } from './features/LandingPage';
import { DriverDashboard } from './features/DriverDashboard';
import { AdminDashboard } from './features/AdminDashboard';
import { DirectorDashboard } from './features/DirectorDashboard';
import { ShareholderDashboard } from './features/ShareholderDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationInbox } from './components/NotificationInbox';
import { HelpCenter } from './components/HelpCenter';
import { api } from './utils/api';
import { registerPushSubscription } from './utils/notificationHelper';
import { requestNotificationPermission, subscribeToPushNotifications } from './utils/notifications';
import { CircularLogo } from './components/CircularLogo';
import { Footer } from './components/Footer';
import { PWAPanel } from './components/PWAPanel';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { ChatDashboard } from './components/ChatDashboard';
import { offlineSync } from './utils/offlineSync';
import { checkDatabaseConnection } from './utils/dbDiagnostic';
import { subscribeToActiveCycle } from './utils/cycleService';
import { 
  Truck, 
  Users, 
  MapPin, 
  TrendingUp, 
  Terminal, 
  Settings, 
  LogOut, 
  Compass, 
  ShieldCheck, 
  Menu, 
  X, 
  Lock, 
  Sun, 
  Moon, 
  Layers,
  Fuel,
  Info,
  WifiOff,
  FileText,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  Zap,
  Bell,
  CreditCard,
  ClipboardCheck,
  Upload,
  Building,
  TrendingDown,
  Briefcase,
  Coins,
  Sparkles,
  ArrowLeft,
  Clock,
  KeyRound,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ImportDriverModal, 
  AddExpenseModal, 
  PayrollModal, 
  RecordPaymentModal 
} from './components/QuickActionModals';
import { TimeDisplay } from './components/TimeDisplay';

// Consistent default values defined at module-level to ensure consistent
// initial rendering on both server and client, completely avoiding hydration mismatches.
const DEFAULT_LANG: Language = 'en';
const DEFAULT_THEME: Theme = 'light';

// Helper to normalize paths by stripping query parameters, hashes, and trailing slashes
const normalizePath = (path: string): string => {
  let clean = path.trim().split('?')[0].split('#')[0];
  if (clean.endsWith('/') && clean !== '/') {
    clean = clean.slice(0, -1);
  }
  return clean || '/';
};

export default function App() {
  const getInitialRole = (): Role => {
    return 'public';
  };

  const [lang, setLang] = useState<Language>(DEFAULT_LANG);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [currentRole, setCurrentRole] = useState<Role>(getInitialRole());
  const [authToken, setAuthToken] = useState<string | null>(SecureSession.getToken());
  const [driverName, setDriverName] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pathname, setPathname] = useState<string>(typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/');
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Progressive Web App (PWA) state variables
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);

  // Tab states for active roles to link hamburger sidebar & dashboards
  const [driverTab, setDriverTab] = useState<'overview' | 'payments' | 'history' | 'vehicle' | 'documents' | 'profile'>('overview');
  const [adminTab, setAdminTab] = useState<any>("fleet");
  const [directorTab, setDirectorTab] = useState<'overview' | 'analytics' | 'cycles' | 'admins' | 'drivers' | 'shareholders' | 'company' | 'reports' | 'audit' | 'monitoring' | 'directory'>('overview');
  const [shareholderTab, setShareholderTab] = useState<'overview' | 'cycles' | 'ledger' | 'settings'>('overview');

  // Quick actions and command states
  const [showImportDriverModal, setShowImportDriverModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [timeStr, setTimeStr] = useState<string>('');
  const [isTimeSynced, setIsTimeSynced] = useState<boolean>(false);
  const [activeCycle, setActiveCycle] = useState<any>(null);

  // Global active cycle synchronization service
  useEffect(() => {
    console.log('Ruqayya ERP [CYCLE_SYNC_DEBUG]: Initializing global active cycle subscription...');
    const unsubscribe = subscribeToActiveCycle((data) => {
      console.log('Ruqayya ERP [CYCLE_SYNC_DEBUG]: Active cycle data update received from backend:', data);
      if (data) {
        console.log(`Ruqayya ERP [CYCLE_SYNC_DEBUG]: Status: "${data.status}", Active: ${data.isActive}, CycleID: "${data.cycleId}", Progress: ${(Number(data.progressPercent) || 0).toFixed(1)}%`);
        console.log(`Ruqayya ERP [CYCLE_SYNC_DEBUG]: Days Remaining: ${data.daysRemaining}, Hours Remaining: ${data.hoursRemaining}, Minutes Remaining: ${data.minutesRemaining}`);
        console.log(`Ruqayya ERP [CYCLE_SYNC_DEBUG]: Scheduled Start Date: ${data.startDate}, Scheduled End Date: ${data.endDate}`);
      } else {
        console.log('Ruqayya ERP [CYCLE_SYNC_DEBUG]: Received null/undefined active cycle data.');
      }
      setActiveCycle(data);
      console.log('Ruqayya ERP [CYCLE_SYNC_DEBUG]: State updated and successfully passed down to child components.');
    });
    return () => {
      console.log('Ruqayya ERP [CYCLE_SYNC_DEBUG]: Cleaning up active cycle subscription...');
      unsubscribe();
    };
  }, []);

  // Ticking WAT clock effect with NTP / API-based time synchronization to prevent system time drift
  useEffect(() => {
    let timeOffset = 0; // ms offset: Server Time - Local Client Time

    const syncTime = async () => {
      try {
        // Priority 1: Local server Date header via /api/health
        const startTime = Date.now();
        const response = await fetch('/api/health', { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        const serverDateHeader = response.headers.get('Date');
        if (serverDateHeader) {
          const rtt = Date.now() - startTime;
          const serverMs = new Date(serverDateHeader).getTime() + (rtt / 2);
          const clientMs = Date.now();
          timeOffset = serverMs - clientMs;
          setIsTimeSynced(true);
          return;
        }
      } catch (err) {
        // Fall back quietly to local client time
      }
      setIsTimeSynced(true);
    };

    const updateTime = () => {
      const now = new Date(Date.now() + timeOffset);
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const watDate = new Date(utc + 3600000); // UTC + 1 for West African Time
      
      const hours = watDate.getHours().toString().padStart(2, '0');
      const mins = watDate.getMinutes().toString().padStart(2, '0');
      const secs = watDate.getSeconds().toString().padStart(2, '0');
      
      setTimeStr(`${hours}:${mins}:${secs} WAT`);
    };

    // Initial sync and tick
    syncTime().then(updateTime);
    
    // Ticking interval
    const interval = setInterval(updateTime, 1000);
    
    // Re-synchronize periodically every 5 minutes to prevent local drift
    const syncInterval = setInterval(syncTime, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, []);

  // Run D1 DB diagnostic check on component mount
  useEffect(() => {
    checkDatabaseConnection().then(res => {
      console.log('Ruqayya ERP DB Diagnostic:', res);
    });
  }, []);

  // Reset tabs on role transitions
  useEffect(() => {
    setDriverTab('overview');
    setAdminTab('fleet');
    setDirectorTab('overview');
    setShareholderTab('overview');
    setActiveSection('dashboard');
  }, [currentRole]);

  // Support seamless navigation events from custom notification action buttons
  useEffect(() => {
    const handleNavigation = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.section) {
        setActiveSection(detail.section);
        if (detail.tab) {
          if (currentRole === 'admin') setAdminTab(detail.tab);
          else if (currentRole === 'director') setDirectorTab(detail.tab);
          else if (currentRole === 'driver') setDriverTab(detail.tab);
          else if (currentRole === 'shareholder') setShareholderTab(detail.tab);
        }
      }
    };
    window.addEventListener('navigate-to-section', handleNavigation);
    return () => window.removeEventListener('navigate-to-section', handleNavigation);
  }, [currentRole]);

  // Robust session and token re-hydration check against backend using secure wrapper
  const hydrateSession = async (isInitial = false) => {
    if (isInitial) {
      setAuthLoading(true);
    }
    console.log('Ruqayya ERP [SECURE_SESSION]: Starting session re-hydration check...');
    try {
      const token = SecureSession.getToken();
      console.log('Ruqayya ERP [SECURE_SESSION]: Token retrieved via secure wrapper:', token ? 'exists' : 'null');
      if (!token) {
        setAuthToken(null);
        setCurrentRole('public');
        return;
      }

      // Bypass backend if it is a local fallback session token for offline/static compatibility
      if (token.startsWith('tok_fallback_')) {
        console.log('Ruqayya ERP [SECURE_SESSION]: Using fallback token');
        const parts = token.split('_');
        const userKey = parts[2] || '';
        let fallbackRole: Role = 'driver';
        let fullName = 'Driver MUSA';

        if (userKey === 'MMR') {
          fallbackRole = 'director';
          fullName = 'Executive Director MMR';
        } else if (userKey === 'ADAM') {
          fallbackRole = 'admin';
          fullName = 'Operations Admin ADAM';
        } else if (userKey === 'ABAKAKA') {
          fallbackRole = 'admin';
          fullName = 'Operations Admin ABAKAKA';
        } else if (userKey === 'KABIR') {
          fallbackRole = 'shareholder';
          fullName = 'Shareholder KABIR';
        } else if (userKey === 'AMINA') {
          fallbackRole = 'shareholder';
          fullName = 'Shareholder AMINA';
        } else {
          fallbackRole = 'driver';
          fullName = 'Driver MUSA';
        }

        setAuthToken(token);
        setCurrentRole(fallbackRole);
        if (fallbackRole === 'driver') {
          setDriverName(fullName);
        } else {
          setDriverName('');
        }
        return;
      }

      try {
        console.log('Ruqayya ERP [SECURE_SESSION]: Calling api.getMe() for role verification...');
        const payload = await api.getMe();
        console.log('Ruqayya ERP [SECURE_SESSION]: api.getMe() payload:', payload);
        if (payload && payload.user) {
          const userRole = payload.user.role;
          setAuthToken(token);
          setCurrentRole(userRole);
          setDriverName(payload.user.full_name || payload.user.fullName || '');
        } else if (isInitial) {
          console.log('Ruqayya ERP [SECURE_SESSION]: api.getMe() returned no user, defaulting to public or offline mode.');
        }
      } catch (e: any) {
        console.warn('Ruqayya ERP [SECURE_SESSION]: api.getMe() warning during re-hydration:', e?.message || e);
      }
    } finally {
      if (isInitial) {
        setAuthLoading(false);
      }
    }
  };

  // Trigger re-hydration check every time the tab gains focus or visibility state changes
  useEffect(() => {
    const handleFocusRehydration = () => {
      if (document.visibilityState === 'visible') {
        console.log('Ruqayya ERP [SECURE_SESSION]: Tab gained focus or visibility detected. Re-hydrating session silently...');
        hydrateSession(false);
      }
    };

    window.addEventListener('focus', handleFocusRehydration);
    document.addEventListener('visibilitychange', handleFocusRehydration);

    return () => {
      window.removeEventListener('focus', handleFocusRehydration);
      document.removeEventListener('visibilitychange', handleFocusRehydration);
    };
  }, []);

  // Load state from localStorage & Hydrate full-stack session on init
  useEffect(() => {
    seedAuditLogsIfEmpty();
    const storedTheme = (localStorage.getItem('ruqayya_theme') as Theme) || DEFAULT_THEME;
    const storedLang = (localStorage.getItem('ruqayya_lang') as Language) || DEFAULT_LANG;
    
    setTheme(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    
    setLang(storedLang);
    document.documentElement.setAttribute('lang', storedLang);

    // Track online/offline status
    setIsOnline(navigator.onLine);
    
    const runBackgroundSync = async () => {
      try {
        await offlineSync.sync(api.request);
      } catch (err) {
        console.error("Auto background sync failure:", err);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      runBackgroundSync();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check if starting online
    if (navigator.onLine) {
      runBackgroundSync();
    }

    // Capture deferred install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      const dismissed = localStorage.getItem('ruqayya_pwa_install_dismissed') === 'true';
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (!dismissed && !isStandalone) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Track sw update-available event
    const handleSWUpdate = () => {
      setUpdateAvailable(true);
    };
    window.addEventListener('pwa-update-available', handleSWUpdate);

    // Track sync queue metrics
    const updateSyncCount = () => {
      setSyncQueueCount(offlineSync.getQueue().length);
    };
    updateSyncCount();

    window.addEventListener('pwa-sync-status', updateSyncCount);
    window.addEventListener('pwa-action-queued', updateSyncCount);
    window.addEventListener('pwa-sync-completed', updateSyncCount);

    hydrateSession(true);

    const handleSessionExpired = (e: any) => {
      const msg = e.detail?.message || "Session expired. Please enter your username again.";
      setAuthToken(null);
      setCurrentRole('public');
      setDriverName('');
      SecureSession.clearToken();
      setSessionExpiredMessage(msg);
      
      const cleanPath = normalizePath(window.location.pathname);
      let redirectPath = '/';
      if (cleanPath.startsWith('/director')) {
        redirectPath = '/director';
      } else if (cleanPath.startsWith('/admin')) {
        redirectPath = '/admin';
      }
      
      window.history.pushState({}, '', redirectPath);
      setPathname(redirectPath);
    };
    window.addEventListener('session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-update-available', handleSWUpdate);
      window.removeEventListener('pwa-sync-status', updateSyncCount);
      window.removeEventListener('pwa-action-queued', updateSyncCount);
      window.removeEventListener('pwa-sync-completed', updateSyncCount);
      window.removeEventListener('session-expired', handleSessionExpired);
    };
  }, []);

  // Listen for browser popstate routing changes
  useEffect(() => {
    const handlePopState = () => {
      const nextPath = normalizePath(window.location.pathname);
      setPathname(nextPath);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Enterprise Push Notification automatic registration
  useEffect(() => {
    if (authToken && currentRole !== 'public') {
      const initPush = async () => {
        try {
          console.log('RUQAYYA PWA: Automatically registering push notifications for logged in user...');
          const granted = await requestNotificationPermission();
          if (granted) {
            const success = await subscribeToPushNotifications();
            if (success) {
              console.log('RUQAYYA PWA: Web Push subscription successfully configured and saved.');
            }
          }
        } catch (pushErr) {
          console.warn('RUQAYYA PWA: Automatic Web Push initialization skipped or failed:', pushErr);
        }
      };
      
      // Delay slightly so the user is settled in their dashboard first
      const timer = setTimeout(initPush, 2000);
      return () => clearTimeout(timer);
    }
  }, [authToken, currentRole]);

  // Role-based routing enforcement and redirection logic
  useEffect(() => {
    const cleanPath = normalizePath(pathname);
    
    if (!authToken) {
      setCurrentRole('public');
      const validPublicPaths = ['/', '/admin', '/director', '/shareholder'];
      if (!validPublicPaths.includes(cleanPath)) {
        window.history.replaceState({}, '', '/');
        setPathname('/');
      }
    } else {
      // Authenticated enforcement
      let expectedPath = '/';
      if (currentRole === 'admin') expectedPath = '/admin';
      else if (currentRole === 'director') expectedPath = '/director';
      else if (currentRole === 'shareholder') expectedPath = '/shareholder';
      else if (currentRole === 'driver') expectedPath = '/';

      if (cleanPath !== expectedPath && cleanPath !== '/' && !cleanPath.startsWith(expectedPath)) {
        window.history.replaceState({}, '', expectedPath);
        setPathname(expectedPath);
      }
    }
  }, [currentRole, pathname, authToken]);

  const handleThemeChange = (nextTheme: Theme) => {
    setTheme(nextTheme);
    localStorage.setItem('ruqayya_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    logAuditEvent("sys-admin", "admin", "THEME_TOGGLE", `Switched system theme parameters to ${nextTheme.toUpperCase()}`);
  };

  const handleLanguageChange = (nextLang: Language) => {
    setLang(nextLang);
    localStorage.setItem('ruqayya_lang', nextLang);
    document.documentElement.setAttribute('lang', nextLang);
    logAuditEvent("sys-admin", "admin", "LANG_TOGGLE", `Switched language localization files to ${nextLang.toUpperCase()}`);
  };

  const handleLogout = async () => {
    logAuditEvent(driverName || "sys-admin", currentRole, "USER_LOGOUT", `Terminated secure session node.`);
    try {
      await api.logout();
    } catch (e) {}
    setAuthToken(null);
    setCurrentRole('public');
    setDriverName('');
    setSidebarOpen(false);
    window.history.pushState({}, '', '/');
    setPathname('/');
  };

  const handleDriverLoginSuccess = (name: string) => {
    setDriverName(name);
    setAuthToken(api.getToken());
    setCurrentRole('driver');
  };

  const handleNavigateToRole = (role: 'driver' | 'admin' | 'director' | 'shareholder') => {
    const token = api.getToken();
    setAuthToken(token);
    setCurrentRole(role);
    setDriverName('');
    setActiveSection('dashboard');
    setAdminTab('overview');
    const nextPath = role === 'admin' ? '/admin' : role === 'director' ? '/director' : role === 'shareholder' ? '/shareholder' : '/';
    window.history.pushState({}, '', nextPath);
    setPathname(nextPath);
  };

  const dictionary = lang === 'en' ? enDictionary : haDictionary;

  // Sidebar items based on active role with unique IDs and active state mapping
  const getSidebarItems = () => {
    const items = [
      { id: 'dashboard', label: lang === 'en' ? "Dashboard" : "Gudunmawar Aiki", icon: <Layers className="h-4 w-4 shrink-0" />, active: activeSection === 'dashboard' },
      { id: 'ai-assistant', label: lang === 'en' ? "Ruqayya AI" : "Mataimakin AI", icon: <Sparkles className="h-4 w-4 shrink-0 text-brand-gold" />, active: activeSection === 'ai-assistant' },
      { id: 'drivers', label: lang === 'en' ? "Drivers" : "Direbobi", icon: <Users className="h-4 w-4 shrink-0" />, active: activeSection === 'drivers' },
      { id: 'tracker', label: lang === 'en' ? "Driver Tracker" : "Kula da Direbobi", icon: <Navigation className="h-4 w-4 shrink-0 text-brand-gold" />, active: activeSection === 'tracker' },
      { id: 'fleet', label: lang === 'en' ? "Fleet" : "Rukunin Motoci", icon: <Truck className="h-4 w-4 shrink-0" />, active: activeSection === 'fleet' },
      { id: 'payments', label: lang === 'en' ? "Payment Approvals" : "Tabbatar Biyan Kudi", icon: <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-500" />, active: activeSection === 'payments' },
      { id: 'finance', label: lang === 'en' ? "Financial Center" : "Asusun Kamfani", icon: <Coins className="h-4 w-4 shrink-0" />, active: activeSection === 'finance' },
      { id: 'shareholders', label: lang === 'en' ? "Shareholders" : "Masu Hannun Jari", icon: <TrendingUp className="h-4 w-4 shrink-0" />, active: activeSection === 'shareholders' },
      { id: 'trips', label: lang === 'en' ? "Trips" : "Takardun Tafiya", icon: <MapPin className="h-4 w-4 shrink-0" />, active: activeSection === 'trips' },
      { id: 'people', label: lang === 'en' ? "People Onboarding" : "Rijistar Mutane", icon: <Users className="h-4 w-4 shrink-0 text-brand-gold" />, active: activeSection === 'people' },
      { id: 'reports', label: lang === 'en' ? "Reports" : "Rahoton Aiki", icon: <FileText className="h-4 w-4 shrink-0" />, active: activeSection === 'reports' },
      { id: 'communications', label: lang === 'en' ? "Communications" : "Sada Zumunta", icon: <MessageSquare className="h-4 w-4 shrink-0" />, active: activeSection === 'communications' },
      { id: 'documents', label: lang === 'en' ? "Documents" : "Taskar Takardu", icon: <FileText className="h-4 w-4 shrink-0" />, active: activeSection === 'documents' },
      { id: 'notifications', label: lang === 'en' ? "Notifications" : "Sanarwa", icon: <Bell className="h-4 w-4 shrink-0" />, active: activeSection === 'notifications' },
      { id: 'pwa', label: lang === 'en' ? "PWA Hub" : "Kula da PWA", icon: <Zap className="h-4 w-4 shrink-0" />, active: activeSection === 'pwa' },
      { id: 'accounts', label: lang === 'en' ? "Account Controller" : "Ikon Akantoci", icon: <KeyRound className="h-4 w-4 shrink-0 text-amber-500" />, active: activeSection === 'accounts' },
      { id: 'settings', label: lang === 'en' ? "Settings" : "Kula da Akun", icon: <Settings className="h-4 w-4 shrink-0" />, active: activeSection === 'settings' },
      { id: 'help', label: lang === 'en' ? "Help & Support" : "Taimako da Support", icon: <HelpCircle className="h-4 w-4 shrink-0" />, active: activeSection === 'help' },
    ];

    if (currentRole === 'driver') {
      return items.filter(item => 
        ['dashboard', 'ai-assistant', 'notifications', 'settings', 'help'].includes(item.id)
      );
    }
    if (currentRole === 'admin') {
      return items.filter(item => ["dashboard", "fleet", "drivers", "tracker", "trips", "payments", "finance", "people", "communications", "documents", "directory", "accounts", "ai-assistant", "notifications", "settings", "help"].includes(item.id));
    }
    if (currentRole === 'shareholder') {
      return items.filter(item => 
        ['dashboard', 'ai-assistant', 'payments', 'trips', 'notifications', 'pwa', 'settings', 'help'].includes(item.id)
      ).map(item => {
        if (item.id === 'payments') return { ...item, label: lang === 'en' ? "Ledger" : "Bilan" };
        if (item.id === 'trips') return { ...item, label: lang === 'en' ? "Business Cycles" : "Tsarin Aiki" };
        return item;
      });
    }
    return items; // Director can view all
  };

  const handleSidebarClick = (id: string) => {
    setActiveSection(id);
    
    // Explicitly synchronize role-specific dashboard tabs when sidebar items are clicked
    // This ensures that when we switch back to 'dashboard' section, we land on the correct tab
    if (currentRole === 'admin') {
      const adminTabs: any[] = ['dashboard', 'fleet', 'drivers', 'tracker', 'payments', 'finance', 'trips', 'documents', 'communications', 'directory', 'people', 'accounts', 'settings'];
      if (adminTabs.includes(id)) {
        setAdminTab(id);
      }
    } else if (currentRole === 'director') {
      const directorTabs: any[] = ['dashboard', 'drivers', 'fleet', 'payments', 'shareholders', 'trips', 'reports', 'communications', 'documents', 'settings'];
      if (directorTabs.includes(id)) {
        // Map sidebar ID to the specific tabs director dashboard expects
        let tab: any = id;
        if (id === 'dashboard') tab = 'overview';
        else if (id === 'fleet') tab = 'directory';
        else if (id === 'payments') tab = 'analytics';
        else if (id === 'trips') tab = 'monitoring';
        else if (id === 'settings') tab = 'company';
        setDirectorTab(tab);
      }
    } else if (currentRole === 'driver') {
      const driverTabs: any[] = ['dashboard', 'fleet', 'payments', 'trips', 'documents', 'settings'];
      if (driverTabs.includes(id)) {
        let tab: any = id;
        if (id === 'dashboard') tab = 'overview';
        else if (id === 'fleet') tab = 'vehicle';
        else if (id === 'trips') tab = 'history';
        else if (id === 'settings') tab = 'profile';
        setDriverTab(tab);
      }
    } else if (currentRole === 'shareholder') {
      const shareholderTabs: any[] = ['dashboard', 'payments', 'trips', 'settings'];
      if (shareholderTabs.includes(id)) {
        let tab: any = id;
        if (id === 'dashboard') tab = 'overview';
        else if (id === 'payments') tab = 'ledger';
        else if (id === 'trips') tab = 'cycles';
        setShareholderTab(tab);
      }
    }

    if (window.innerWidth < 768) {
      setSidebarOpen(false); // Auto close mobile drawer on click
    }
  };

  const renderMainContent = () => {
    // Global views (accessible by any logged-in role)
    if (activeSection === 'notifications') return <NotificationInbox lang={lang} />;
    if (activeSection === 'help') return <HelpCenter lang={lang} />;
    if (activeSection === 'pwa') {
      return (
        <div className="bg-bg-surface border border-border-main rounded-[20px] p-6 shadow-xs">
          <PWAPanel lang={lang} />
        </div>
      );
    }
    if (activeSection === 'ai-assistant') {
      return (
        <ChatDashboard
          lang={lang}
          currentRole={currentRole}
          userName={currentRole === 'driver' ? driverName || 'Driver' : currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
          onExit={() => setActiveSection('dashboard')}
        />
      );
    }

    // Role-specific routing and state mapping
    if (currentRole === 'driver') {
      let driverTabValue = driverTab;
      // Force tab based on section if they were navigated via sidebar or quick action
      if (activeSection === 'dashboard' && driverTab !== 'pay-now') driverTabValue = 'overview';
      else if (activeSection === 'fleet') driverTabValue = 'vehicle';
      else if (activeSection === 'payments') driverTabValue = 'payments';
      else if (activeSection === 'trips') driverTabValue = 'history';
      else if (activeSection === 'documents') driverTabValue = 'documents';
      else if (activeSection === 'settings') driverTabValue = 'profile';
      
      const allowedDriverSections = ['dashboard', 'drivers', 'fleet', 'payments', 'trips', 'documents', 'settings'];
      if (!allowedDriverSections.includes(activeSection)) {
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto py-20 bg-white rounded-[20px] border border-border-main shadow-xs">
            <Lock className="h-12 w-12 text-brand-gold animate-bounce mb-4" />
            <h3 className="text-xl font-bold text-text-main">Restricted Section</h3>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Clearance Level insufficient to access this administrative record. Your role is restricted to self-management.
            </p>
          </div>
        );
      }

      return (
        <DriverDashboard
          key={currentRole + '-dashboard'}
          driverName={driverName}
          lang={lang}
          dictionary={dictionary}
          activeTab={driverTabValue}
          setActiveTab={(tab) => {
            setDriverTab(tab);
            if (tab === 'overview' || tab === 'pay-now') setActiveSection('dashboard');
            else if (tab === 'vehicle') setActiveSection('fleet');
            else if (tab === 'payments') setActiveSection('payments');
            else if (tab === 'history') setActiveSection('trips');
            else if (tab === 'documents') setActiveSection('documents');
            else if (tab === 'profile') setActiveSection('settings');
          }}
        />
      );
    }

    if (currentRole === 'admin') {
      let adminTabValue = adminTab;
      if (activeSection === 'dashboard') adminTabValue = 'dashboard';
      else if (activeSection === 'drivers') adminTabValue = 'drivers';
      else if (activeSection === 'tracker') adminTabValue = 'tracker';
      else if (activeSection === 'fleet') adminTabValue = 'fleet';
      else if (activeSection === 'payments') adminTabValue = 'payments';
      else if (activeSection === 'trips') adminTabValue = 'trips';
      else if (activeSection === 'communications') adminTabValue = 'communications';
      else if (activeSection === 'documents') adminTabValue = 'documents';
      else if (activeSection === 'finance') adminTabValue = 'finance';
      else if (activeSection === 'directory') adminTabValue = 'directory';
      else if (activeSection === 'people') adminTabValue = 'people';
      else if (activeSection === 'accounts') adminTabValue = 'accounts';
      else if (activeSection === 'settings') adminTabValue = 'settings';
      
      const allowedAdminSections = ["dashboard", "fleet", "drivers", "tracker", "payments", "finance", "trips", "communications", "documents", "directory", "people", "accounts", "settings"];
      if (!allowedAdminSections.includes(activeSection)) {
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto py-20 bg-white rounded-[20px] border border-border-main shadow-xs">
            <Lock className="h-12 w-12 text-brand-gold animate-bounce mb-4" />
            <h3 className="text-xl font-bold text-text-main">Executive Clearance Required</h3>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              This module requires Clearance Level 3 (Executive Director). Access is restricted for Operations Administrators.
            </p>
          </div>
        );
      }

      return (
        <AdminDashboard
          key={currentRole + '-dashboard'}
          lang={lang}
          dictionary={dictionary}
          activeTab={adminTabValue}
          activeCycle={activeCycle}
          setActiveTab={(tab) => {
            setAdminTab(tab);
            if (tab === 'dashboard') setActiveSection('dashboard');
            else if (tab === 'fleet') setActiveSection('fleet');
            else if (tab === 'drivers') setActiveSection('drivers');
            else if (tab === 'tracker') setActiveSection('tracker');
            else if (tab === 'trips') setActiveSection('trips');
            else if (tab === 'payments') setActiveSection('payments');
            else if (tab === 'documents') setActiveSection('documents');
            else if (tab === 'communications') setActiveSection('communications');
            else if (tab === 'finance') setActiveSection('finance');
            else if (tab === 'directory') setActiveSection('directory');
            else if (tab === 'people') setActiveSection('people');
            else if (tab === 'accounts') setActiveSection('accounts');
            else if (tab === 'settings') setActiveSection('settings');
          }}
        />
      );
    }

    if (currentRole === 'director') {
      let directorTabValue = directorTab;
      if (activeSection === 'dashboard') directorTabValue = 'overview';
      else if (activeSection === 'drivers') directorTabValue = 'directory';
      else if (activeSection === 'fleet') directorTabValue = 'directory';
      else if (activeSection === 'payments') directorTabValue = 'analytics';
      else if (activeSection === 'shareholders') directorTabValue = 'shareholders';
      else if (activeSection === 'trips') directorTabValue = 'monitoring';
      else if (activeSection === 'reports') directorTabValue = 'reports';
      else if (activeSection === 'communications') directorTabValue = 'communications';
      else if (activeSection === 'documents') directorTabValue = 'documents';
      else if (activeSection === 'settings') directorTabValue = 'company';

      return (
        <DirectorDashboard
          key={currentRole + '-dashboard'}
          lang={lang}
          dictionary={dictionary}
          activeTab={directorTabValue}
          activeCycle={activeCycle}
          setActiveTab={(tab) => {
            setDirectorTab(tab);
            if (tab === 'overview') setActiveSection('dashboard');
            else if (tab === 'drivers') setActiveSection('drivers');
            else if (tab === 'directory') setActiveSection('fleet');
            else if (tab === 'analytics') setActiveSection('payments');
            else if (tab === 'shareholders') setActiveSection('shareholders');
            else if (tab === 'monitoring') setActiveSection('trips');
            else if (tab === 'reports') setActiveSection('reports');
            else if (tab === 'communications') setActiveSection('communications');
            else if (tab === 'documents') setActiveSection('documents');
            else if (tab === 'company') setActiveSection('settings');
          }}
        />
      );
    }

    if (currentRole === 'shareholder') {
      let shareholderTabValue = shareholderTab;
      if (activeSection === 'dashboard') shareholderTabValue = 'overview';
      else if (activeSection === 'payments') shareholderTabValue = 'ledger';
      else if (activeSection === 'shareholders') shareholderTabValue = 'overview';
      else if (activeSection === 'trips') shareholderTabValue = 'cycles';
      else if (activeSection === 'settings') shareholderTabValue = 'settings';
      
      const allowedShareholderSections = ['dashboard', 'payments', 'shareholders', 'trips', 'settings'];
      if (!allowedShareholderSections.includes(activeSection)) {
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto py-20 bg-white rounded-[20px] border border-border-main shadow-xs">
            <Lock className="h-12 w-12 text-brand-gold animate-bounce mb-4" />
            <h3 className="text-xl font-bold text-text-main">Operational Operations Restricted</h3>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              This operational module is restricted for investor-level accounts.
            </p>
          </div>
        );
      }

      return (
        <ShareholderDashboard
          key={currentRole + '-dashboard'}
          lang={lang}
          dictionary={dictionary}
          activeTab={shareholderTabValue}
          authToken={authToken}
          setActiveTab={(tab) => {
            setShareholderTab(tab);
            if (tab === 'overview') setActiveSection('dashboard');
            else if (tab === 'ledger') setActiveSection('payments');
            else if (tab === 'cycles') setActiveSection('trips');
            else if (tab === 'settings') setActiveSection('settings');
          }}
        />
      );
    }

    // Fallback if role is not recognized or something went wrong
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto py-20 bg-white rounded-[20px] border border-border-main shadow-xs">
        <Info className="h-12 w-12 text-brand-gold mb-4" />
        <h3 className="text-xl font-bold text-text-main">Welcome to Ruqayya ERP</h3>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          Please select a module from the sidebar to begin your operations.
        </p>
      </div>
    );
  };

  if (authLoading) {
    const splashText = "RUQAYYA TRANSPORT LIMITED";
    const words = splashText.split(" ");

    return (
      <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden select-none">
        {/* Subtle high-motion ambient animated backdrops */}
        <div className="absolute inset-0 bg-radial-gradient from-brand-gold/15 via-transparent to-transparent opacity-60 animate-pulse pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-gold/5 blur-[130px] rounded-full pointer-events-none animate-float-1" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none animate-float-2" />
        
        {/* Floating tech background particles */}
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="flex flex-col items-center gap-9 max-w-md text-center relative z-10">
          {/* Animated concentric decorative rings surrounding the logo */}
          <div className="relative p-2.5">
            <motion.div 
              className="absolute inset-0 rounded-full border border-dashed border-brand-gold/25"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
            />
            <motion.div 
              className="absolute inset-1 rounded-full border border-brand-gold/10"
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
            />
            <motion.div 
              className="absolute inset-[-15px] rounded-full border-[1.5px] border-brand-gold/15"
              animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            />
            
            {/* Core Circular Motion Logo */}
            <CircularLogo size="2xl" animateContinuous={true} />
          </div>
          
          {/* Company Title - Close to the middle animated logo with High Motion fonts */}
          <div className="space-y-4">
            <motion.h2 
              className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-white flex flex-wrap justify-center gap-x-3 gap-y-1 select-none font-mono"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.04, delayChildren: 0.2 } }
              }}
            >
              {words.map((word, wordIdx) => (
                <span key={wordIdx} className="inline-block whitespace-nowrap">
                  {word.split("").map((letter, letterIdx) => (
                    <motion.span
                      key={letterIdx}
                      className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-amber-400 to-white"
                      variants={{
                        hidden: { opacity: 0, y: 18, scale: 0.7, filter: "blur(4px)" },
                        visible: { 
                          opacity: 1, 
                          y: 0, 
                          scale: 1, 
                          filter: "blur(0px)",
                          transition: { type: "spring", stiffness: 120, damping: 9 } 
                        }
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </span>
              ))}
            </motion.h2>

            <motion.div 
              className="h-[1.5px] w-20 bg-gradient-to-r from-transparent via-brand-gold/60 to-transparent mx-auto rounded-full"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 80, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1 }}
            />

            <motion.p 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.15em] animate-pulse"
            >
              {lang === 'en' ? "SECURE ENTERPRISE GATEWAY..." : "AMINTACCEN SHIGA TA MA'AIKATA..."}
            </motion.p>
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.3 }}
            className="text-[10px] text-slate-500 leading-relaxed font-semibold max-w-xs uppercase tracking-wide"
          >
            {lang === 'en' 
              ? "Connecting securely to West African operations servers. Please hold."
              : "Haɗawa cikin aminci zuwa sabar ayyukan Afirka ta Yamma. Da fatan za a jira."}
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`w-full max-w-full bg-bg-base text-text-main font-sans flex flex-col selection:bg-brand-gold/30 ${
        activeSection === 'ai-assistant' ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'
      }`}>
      
      <NotificationToastContainer lang={lang} currentRole={currentRole} />
      
      {/* OFFLINE BANNER */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white font-bold py-2 px-4 text-xs flex items-center justify-center gap-2 z-50 shrink-0"
          >
            <WifiOff className="h-4 w-4 animate-bounce" />
            <span>
              {lang === 'en' 
                ? "CONNECTION LOST: You are currently offline. Ruqayya ERP is auto-reconnecting..." 
                : "HANYAR SADARWA TA KATSE: Kana offline yanzu. Tsarin Ruqayya yana kokarin sake hadawa..."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP NAVIGATION HEADER */}
      {currentRole !== 'public' && activeSection !== 'ai-assistant' && (
        <header className="sticky top-0 z-40 bg-bg-surface border-b border-border-main backdrop-blur-md px-2 sm:px-4 py-3 shadow-xs print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-4">
            <div className="flex items-center gap-3">
              {currentRole !== 'public' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSidebarOpen(!sidebarOpen);
                  }}
                  className="md:hidden p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-base transition-colors cursor-pointer"
                  aria-label="Toggle Sidebar Menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <div 
                className="flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                onClick={() => {
                  setCurrentRole('public');
                  window.history.pushState({}, '', '/');
                  setPathname('/');
                }}
              >
                <CircularLogo size="md" className="-my-1" />
                <div>
                  <span className="font-extrabold text-sm tracking-wider text-brand-navy dark:text-white font-mono block">RUQAYYA</span>
                  <span className="text-[9px] font-bold text-brand-gold tracking-widest block uppercase -mt-1">{lang === 'en' ? "TRANSPORT" : "SUFURI"}</span>
                </div>
              </div>

              {activeSection === 'ai-assistant' && (
                <button
                  onClick={() => setActiveSection('dashboard')}
                  className="px-2.5 py-1.5 bg-[#101524] border border-slate-800 text-slate-300 hover:text-white hover:border-brand-gold/40 text-[10.5px] font-extrabold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer animate-fadeIn"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                  <span className="hidden sm:inline">{lang === 'en' ? "Back to ERP" : "Koma ga ERP"}</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-border-main/50 text-[10px] font-semibold text-text-muted">
                <span className="hidden sm:inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline text-text-main font-bold tracking-wider">OPERATIONAL</span>
                <span className="hidden sm:inline text-border-main/80">•</span>
                <TimeDisplay isTimeSynced={isTimeSynced} timeStr={timeStr} />
              </div>
            </div>

            {/* Omni Search & System Quick Switches */}
            <div className="flex-1 max-w-sm hidden md:block">
              <GlobalSearch lang={lang} />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3">

              <NotificationCenter lang={lang} />
              <div className="hidden sm:flex items-center gap-1.5">
                <LanguageSwitcher currentLanguage={lang} onLanguageChange={handleLanguageChange} />
                <ThemeSwitcher currentTheme={theme} onThemeChange={handleThemeChange} />
              </div>

              {currentRole !== 'public' && (
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/45 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title={dictionary.common.logout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold hidden sm:inline">{lang === 'en' ? "Logout" : "Fita"}</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}


      {/* QUICK ACTIONS MODALS MOUNT */}
      <ImportDriverModal
        isOpen={showImportDriverModal}
        onClose={() => setShowImportDriverModal(false)}
        lang={lang}
      />
      <AddExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        lang={lang}
      />
      <PayrollModal
        isOpen={showPayrollModal}
        onClose={() => setShowPayrollModal(false)}
        lang={lang}
      />
      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        lang={lang}
      />

      {/* MAIN CONTAINER LAYOUT */}
      <div className={`flex-1 flex w-full ${(currentRole === 'public' || activeSection === 'ai-assistant') ? 'max-w-none' : 'max-w-7xl mx-auto'}`}>
        {/* SIDEBAR BACKDROP FOR MOBILE */}
        {sidebarOpen && currentRole !== 'public' && activeSection !== 'ai-assistant' && (
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-30 md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(false);
            }}
          />
        )}

        {/* SIDEBAR FOR AUTHENTICATED ROLES */}
        {currentRole !== 'public' && activeSection !== 'ai-assistant' && (
          <aside 
            onClick={(e) => e.stopPropagation()}
            className={`fixed inset-y-0 left-0 z-40 ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'} w-64 bg-brand-navy text-white transform md:translate-x-0 md:static md:h-auto transition-all duration-300 ease-in-out border-r border-slate-800/80 p-4 flex flex-col gap-5 flex-shrink-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between md:hidden border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-300">{lang === 'en' ? "System Menu" : "Tsarin Menu"}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen(false);
                }} 
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 relative group">
              <div className="flex items-center gap-2.5">
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-200 block truncate leading-tight">
                      {currentRole === 'driver' ? (driverName || 'Authenticated Driver') : currentRole === 'admin' ? (localStorage.getItem('ruqayya_admin_name') || 'Operations Admin') : (localStorage.getItem('ruqayya_director_name') || 'General Director')}
                    </span>
                    <span className="text-[10px] text-brand-gold block font-mono font-bold leading-none mt-1 truncate">
                      {dictionary.roles[currentRole]}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Desktop collapse button */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-750 p-1 rounded-full shadow-md cursor-pointer z-50 scale-90 transition-transform"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? "→" : "←"}
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 flex flex-col gap-1.5 text-xs font-semibold text-slate-400 overflow-y-auto max-h-[50vh] md:max-h-[none] pr-1 scrollbar-none">
              {getSidebarItems().map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSidebarClick(item.id)}
                  className={`w-full py-2.5 px-3 rounded-lg flex items-center gap-3 transition-all duration-200 ease-in-out cursor-pointer text-left group ${
                    item.active
                      ? 'bg-brand-gold text-slate-950 font-extrabold shadow-sm scale-[1.02]'
                      : 'text-slate-300/80 hover:text-white hover:bg-slate-800/60 hover:translate-x-1'
                  }`}
                  title={sidebarCollapsed ? item.label : ""}
                >
                  <span className={`transition-all duration-200 shrink-0 ${
                    item.active ? 'text-slate-950' : 'text-slate-400 group-hover:text-brand-gold group-hover:scale-105'
                  }`}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1 transition-all duration-200">
                      {item.label}
                    </span>
                  )}
                  {!sidebarCollapsed && item.id === 'pwa' && syncQueueCount > 0 && (
                    <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full animate-pulse shrink-0">
                      {syncQueueCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-800/60 pt-4 flex flex-col gap-2">
              {/* Mobile-only switcher panel in sidebar */}
              <div className="flex items-center justify-between gap-2 mb-2 md:hidden px-1">
                <LanguageSwitcher currentLanguage={lang} onLanguageChange={handleLanguageChange} />
                <ThemeSwitcher currentTheme={theme} onThemeChange={handleThemeChange} />
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-3 rounded-lg flex items-center gap-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-bold transition-all cursor-pointer text-xs"
              >
                <LogOut className="h-4 w-4 text-red-500 shrink-0" />
                {!sidebarCollapsed && <span>{lang === 'en' ? "Secure Logout" : "Fita Daga Tsarin"}</span>}
              </button>
              {!sidebarCollapsed && (
                <div className="text-[9px] text-slate-500 font-mono flex flex-col gap-1 mt-1 pl-1">
                  <span>Wrangler Binding: DB</span>
                  <span>R2 Storage: Mapping Active</span>
                  <span>Node Environment: Production</span>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* WORKSPACE SURFACE VIEW */}
        <main className={`flex-1 ${(currentRole === 'public' || activeSection === 'ai-assistant') ? 'p-0 flex flex-col' : 'p-4 md:p-6 grid grid-cols-1'} w-full max-w-full overflow-x-hidden`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRole}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`flex-1 ${(currentRole === 'public' || activeSection === 'ai-assistant') ? 'flex flex-col' : 'grid grid-cols-1 w-full max-w-full'}`}
            >
              {currentRole === 'public' ? (
                <LandingPage
                  pathname={pathname}
                  dictionary={dictionary}
                  lang={lang}
                  onLoginAsDriver={handleDriverLoginSuccess}
                  onNavigateToRole={handleNavigateToRole}
                  currentTheme={theme}
                  onThemeChange={handleThemeChange}
                  onLanguageChange={handleLanguageChange}
                  sessionExpiredMessage={sessionExpiredMessage}
                  onClearSessionExpiredMessage={() => setSessionExpiredMessage('')}
                />
              ) : (
                renderMainContent()
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {currentRole === 'public' && (
        <Footer lang={lang} />
      )}

      {/* PWA UPDATE AVAILABLE BANNER */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md bg-slate-900 border border-brand-gold/30 p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-3 text-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-gold/10 rounded-xl border border-brand-gold/20 shrink-0 text-brand-gold">
                  <Zap className="h-4 w-4 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-tight uppercase text-brand-gold">
                    {lang === 'en' ? "New Version Available" : "Akwai Sabon Sabuntawa"}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-normal mt-0.5">
                    {lang === 'en' 
                      ? "A new enterprise build of RUQAYYA ERP is ready with performance upgrades."
                      : "An shirya sabon tsarin RUQAYYA ERP don inganta saurin aiki da amintaka."}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setUpdateAvailable(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="flex-1 py-1.5 px-3 bg-brand-gold text-slate-950 font-black rounded-xl text-2xs uppercase tracking-wider hover:bg-yellow-500 transition-colors cursor-pointer text-center"
              >
                {lang === 'en' ? "Update Now" : "Sabunta Yanzu"}
              </button>
              <button
                onClick={() => setUpdateAvailable(false)}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-xl text-2xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                {lang === 'en' ? "Later" : "Gaba kadan"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA INSTALL PROMPT SLIDING BANNER */}
      <AnimatePresence>
        {showInstallBanner && deferredPrompt && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-4 right-4 left-4 md:left-auto md:max-w-md bg-slate-900 border border-slate-750 p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-3 text-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-gold/10 rounded-xl border border-brand-gold/20 shrink-0">
                  <CircularLogo size="sm" />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-tight uppercase text-brand-gold">
                    {lang === 'en' ? "Install Ruqayya ERP" : "Girkawa Ruqayya ERP"}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-normal mt-0.5">
                    {lang === 'en' 
                      ? "Add Ruqayya ERP to your home screen for quick, offline-capable native mobile experience."
                      : "Sanya Ruqayya ERP a fuskar wayarka don gudanar da aiki offline cikin sauki."}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowInstallBanner(false);
                  localStorage.setItem('ruqayya_pwa_install_dismissed', 'true');
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                      localStorage.setItem('ruqayya_pwa_installed', 'true');
                    }
                    setDeferredPrompt(null);
                    setShowInstallBanner(false);
                  }
                }}
                className="flex-1 py-1.5 px-3 bg-brand-gold text-slate-950 font-black rounded-xl text-2xs uppercase tracking-wider hover:bg-yellow-500 transition-colors cursor-pointer text-center"
              >
                {lang === 'en' ? "Install App" : "Girkawa Yanzu"}
              </button>
              <button
                onClick={() => {
                  setShowInstallBanner(false);
                  localStorage.setItem('ruqayya_pwa_install_dismissed', 'true');
                }}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-xl text-2xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                {lang === 'en' ? "Not Now" : "Gaba kadan"}
              </button>
              <button
                onClick={() => {
                  setActiveSection('pwa');
                  setShowInstallBanner(false);
                }}
                className="py-1.5 px-3 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white font-medium rounded-xl text-2xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                {lang === 'en' ? "Learn More" : "Karin Bayani"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GLOBAL FLOATING AI COPILOT TRIGGER */}
      {currentRole !== 'public' && (
        <button
          id="ai-copilot-trigger"
          onClick={() => setAiCopilotOpen(true)}
          className="fixed bottom-6 right-6 h-12 w-12 bg-slate-900 hover:bg-slate-800 text-brand-gold border border-brand-gold/40 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 group z-45"
          title={lang === 'en' ? "Open Ruqayya AI" : "Bude Ruqayya AI"}
        >
          <div className="absolute inset-0 rounded-full border-2 border-brand-gold/10 group-hover:border-brand-gold/30 group-hover:animate-ping opacity-70" />
          <Sparkles className="h-5 w-5 animate-pulse" />
        </button>
      )}

      {/* AICOPILOT DRAWER */}
      <AICopilotDrawer
        isOpen={aiCopilotOpen}
        onClose={() => setAiCopilotOpen(false)}
        lang={lang}
        currentRole={currentRole}
        userName={driverName || (currentRole === 'driver' ? 'Authenticated Driver' : currentRole === 'admin' ? (localStorage.getItem('ruqayya_admin_name') || 'Operations Admin') : currentRole === 'director' ? 'General Director' : 'Shareholder')}
        activeCycleId={activeCycle?.cycleId}
      />
    </div>
    </ErrorBoundary>
  );
}
