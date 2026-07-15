/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { enDictionary, haDictionary } from './i18n';
import { Role, Language, Theme } from './types';
import { dbStore } from './utils/dbStore';
import { logAuditEvent, seedAuditLogsIfEmpty } from './utils/security';
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
import { NotificationInbox } from './components/NotificationInbox';
import { HelpCenter } from './components/HelpCenter';
import { api } from './utils/api';
import { registerPushSubscription } from './utils/notificationHelper';
import { CircularLogo } from './components/CircularLogo';
import { PWAPanel } from './components/PWAPanel';
import { offlineSync } from './utils/offlineSync';
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
  Upload,
  Building,
  TrendingDown,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ImportDriverModal, 
  AddExpenseModal, 
  PayrollModal, 
  RecordPaymentModal 
} from './components/QuickActionModals';

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
  const [authToken, setAuthToken] = useState<string | null>(typeof window !== 'undefined' ? localStorage.getItem('ruqayya_token') : null);
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
  const [adminTab, setAdminTab] = useState<'fleet' | 'drivers' | 'trips' | 'vouchers' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory'>('fleet');
  const [directorTab, setDirectorTab] = useState<'overview' | 'analytics' | 'cycles' | 'admins' | 'drivers' | 'shareholders' | 'company' | 'reports' | 'audit' | 'monitoring' | 'directory'>('overview');
  const [shareholderTab, setShareholderTab] = useState<'overview' | 'cycles' | 'ledger' | 'settings'>('overview');

  // Quick actions and command states
  const [showImportDriverModal, setShowImportDriverModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [timeStr, setTimeStr] = useState<string>('');

  // Ticking WAT clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const watDate = new Date(utc + 3600000); // UTC + 1 for West African Time
      
      const hours = watDate.getHours().toString().padStart(2, '0');
      const mins = watDate.getMinutes().toString().padStart(2, '0');
      const secs = watDate.getSeconds().toString().padStart(2, '0');
      
      setTimeStr(`${hours}:${mins}:${secs} WAT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
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

    const hydrateSession = async () => {
      setAuthLoading(true);
      try {
        const token = api.getToken();
        if (!token) {
          setAuthToken(null);
          setCurrentRole('public');
          return;
        }

        // Bypass backend if it is a local fallback session token for offline/static compatibility
        if (token.startsWith('tok_fallback_')) {
          const parts = token.split('_');
          const userKey = parts[2] || '';
          let fallbackRole: Role = 'driver';
          let fullName = 'Alhaji Musa Garba';

          if (userKey === 'MMR') {
            fallbackRole = 'director';
            fullName = 'Director Kabir Mohammed';
          } else if (userKey === 'ADAM') {
            fallbackRole = 'admin';
            fullName = 'Operator Ibrahim Bello';
          } else if (userKey === 'ABAKAKA') {
            fallbackRole = 'admin';
            fullName = 'Operator ABAKAKA Bello';
          } else if (userKey === 'KABIR') {
            fallbackRole = 'shareholder';
            fullName = 'Alhaji Kabir Mohammed';
          } else if (userKey === 'AMINA') {
            fallbackRole = 'shareholder';
            fullName = 'Hajiya Amina Garba';
          } else {
            fallbackRole = 'driver';
            fullName = 'Alhaji Musa Garba';
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
          const payload = await api.getMe();
          if (payload && payload.user) {
            const userRole = payload.user.role;
            setAuthToken(token);
            setCurrentRole(userRole);
            if (userRole === 'driver') {
              setDriverName(payload.user.fullName);
            } else {
              setDriverName('');
            }
          } else {
            api.clearToken();
            setAuthToken(null);
            setCurrentRole('public');
          }
        } catch (e) {
          api.clearToken();
          setAuthToken(null);
          setCurrentRole('public');
        }
      } finally {
        setAuthLoading(false);
      }
    };
    hydrateSession();

    const handleSessionExpired = (e: any) => {
      const msg = e.detail?.message || "Session expired. Please enter your username again.";
      setAuthToken(null);
      setCurrentRole('public');
      setDriverName('');
      api.clearToken();
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
          // Request notification permission and register subscription if granted
          if ('Notification' in window) {
            if (Notification.permission === 'default') {
              // Ask gracefully after a short delay so the user is already settled in their dashboard!
              setTimeout(async () => {
                const granted = await Notification.requestPermission();
                if (granted === 'granted') {
                  const success = await registerPushSubscription();
                  if (success) {
                    console.log('RUQAYYA PWA: Web Push subscription successfully configured.');
                  }
                }
              }, 2500);
            } else if (Notification.permission === 'granted') {
              // Already granted, register subscription
              const success = await registerPushSubscription();
              if (success) {
                console.log('RUQAYYA PWA: Web Push subscription successfully refreshed.');
              }
            }
          }
        } catch (pushErr) {
          console.warn('RUQAYYA PWA: Automatic Web Push initialization skipped or failed:', pushErr);
        }
      };
      initPush();
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
    const nextPath = role === 'admin' ? '/admin' : role === 'director' ? '/director' : role === 'shareholder' ? '/shareholder' : '/';
    window.history.pushState({}, '', nextPath);
    setPathname(nextPath);
  };

  const dictionary = lang === 'en' ? enDictionary : haDictionary;

  // Sidebar items based on active role with unique IDs and active state mapping
  const getSidebarItems = () => {
    const items = [
      { id: 'dashboard', label: lang === 'en' ? "Dashboard" : "Gudunmawar Aiki", icon: <Layers className="h-4 w-4 shrink-0" />, active: activeSection === 'dashboard' },
      { id: 'drivers', label: lang === 'en' ? "Drivers" : "Direbobi", icon: <Users className="h-4 w-4 shrink-0" />, active: activeSection === 'drivers' },
      { id: 'fleet', label: lang === 'en' ? "Fleet" : "Rukunin Motoci", icon: <Truck className="h-4 w-4 shrink-0" />, active: activeSection === 'fleet' },
      { id: 'payments', label: lang === 'en' ? "Payments" : "Biyan Kudade", icon: <ShieldCheck className="h-4 w-4 shrink-0" />, active: activeSection === 'payments' },
      { id: 'shareholders', label: lang === 'en' ? "Shareholders" : "Masu Hannun Jari", icon: <TrendingUp className="h-4 w-4 shrink-0" />, active: activeSection === 'shareholders' },
      { id: 'trips', label: lang === 'en' ? "Trips" : "Takardun Tafiya", icon: <MapPin className="h-4 w-4 shrink-0" />, active: activeSection === 'trips' },
      { id: 'reports', label: lang === 'en' ? "Reports" : "Rahoton Aiki", icon: <FileText className="h-4 w-4 shrink-0" />, active: activeSection === 'reports' },
      { id: 'communications', label: lang === 'en' ? "Communications" : "Sada Zumunta", icon: <MessageSquare className="h-4 w-4 shrink-0" />, active: activeSection === 'communications' },
      { id: 'documents', label: lang === 'en' ? "Documents" : "Taskar Takardu", icon: <FileText className="h-4 w-4 shrink-0" />, active: activeSection === 'documents' },
      { id: 'notifications', label: lang === 'en' ? "Notifications" : "Sanarwa", icon: <Bell className="h-4 w-4 shrink-0" />, active: activeSection === 'notifications' },
      { id: 'pwa', label: lang === 'en' ? "PWA Hub" : "Kula da PWA", icon: <Zap className="h-4 w-4 shrink-0" />, active: activeSection === 'pwa' },
      { id: 'settings', label: lang === 'en' ? "Settings" : "Kula da Akun", icon: <Settings className="h-4 w-4 shrink-0" />, active: activeSection === 'settings' },
      { id: 'help', label: lang === 'en' ? "Help & Support" : "Taimako da Support", icon: <HelpCircle className="h-4 w-4 shrink-0" />, active: activeSection === 'help' },
    ];

    if (currentRole === 'driver') {
      return items.filter(item => 
        ['dashboard', 'notifications', 'settings', 'help'].includes(item.id)
      );
    }
    if (currentRole === 'admin') {
      return items.filter(item => 
        ['dashboard', 'drivers', 'fleet', 'payments', 'trips', 'reports', 'communications', 'documents', 'notifications', 'pwa', 'settings', 'help'].includes(item.id)
      );
    }
    if (currentRole === 'shareholder') {
      return items.filter(item => 
        ['dashboard', 'shareholders', 'notifications', 'pwa', 'settings', 'help'].includes(item.id)
      );
    }
    return items; // Director can view all
  };

  const handleSidebarClick = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false); // Auto close mobile drawer on click
  };

  const renderMainContent = () => {
    if (activeSection === 'notifications') {
      return <NotificationInbox lang={lang} />;
    }
    if (activeSection === 'help') {
      return <HelpCenter lang={lang} />;
    }
    if (activeSection === 'pwa') {
      return (
        <div className="bg-bg-surface border border-border-main rounded-[20px] p-6 shadow-xs">
          <PWAPanel lang={lang} />
        </div>
      );
    }

    // Role-specific routing
    if (currentRole === 'driver') {
      let driverTabValue: 'overview' | 'payments' | 'history' | 'vehicle' | 'documents' | 'profile' = 'overview';
      if (activeSection === 'dashboard') driverTabValue = 'overview';
      else if (activeSection === 'drivers') driverTabValue = 'profile'; // self
      else if (activeSection === 'fleet') driverTabValue = 'vehicle';
      else if (activeSection === 'payments') driverTabValue = 'payments';
      else if (activeSection === 'trips') driverTabValue = 'history';
      else if (activeSection === 'documents') driverTabValue = 'documents';
      else if (activeSection === 'settings') driverTabValue = 'profile';
      else {
        // Restricted / unsupported sections for drivers
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
          key={currentRole + '-' + (authToken || 'no-token')}
          driverName={driverName}
          lang={lang}
          dictionary={dictionary}
          activeTab={driverTabValue}
          setActiveTab={(tab) => {
            setDriverTab(tab);
            // sync section
            if (tab === 'overview') setActiveSection('dashboard');
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
      let adminTabValue: 'fleet' | 'drivers' | 'trips' | 'vouchers' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory' = 'fleet';
      if (activeSection === 'dashboard') {
        adminTabValue = 'fleet'; // Shows active fleet dashboard stats
      }
      else if (activeSection === 'drivers') adminTabValue = 'drivers';
      else if (activeSection === 'fleet') adminTabValue = 'fleet';
      else if (activeSection === 'payments') adminTabValue = 'payments';
      else if (activeSection === 'trips') adminTabValue = 'trips';
      else if (activeSection === 'communications') adminTabValue = 'communications';
      else if (activeSection === 'documents') adminTabValue = 'documents';
      else if (activeSection === 'vouchers') adminTabValue = 'vouchers';
      else if (activeSection === 'finance') adminTabValue = 'finance';
      else if (activeSection === 'directory') adminTabValue = 'directory';
      else if (activeSection === 'reports') {
        adminTabValue = 'directory';
      }
      else if (activeSection === 'settings') adminTabValue = 'fleet';
      else {
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
          key={currentRole + '-' + (authToken || 'no-token')}
          lang={lang}
          dictionary={dictionary}
          activeTab={adminTabValue}
          setActiveTab={(tab) => {
            setAdminTab(tab);
            if (tab === 'fleet') setActiveSection('fleet');
            else if (tab === 'drivers') setActiveSection('drivers');
            else if (tab === 'trips') setActiveSection('trips');
            else if (tab === 'payments') setActiveSection('payments');
            else if (tab === 'documents') setActiveSection('documents');
            else if (tab === 'communications') setActiveSection('communications');
            else if (tab === 'vouchers') setActiveSection('vouchers');
            else if (tab === 'finance') setActiveSection('finance');
            else if (tab === 'directory') setActiveSection('directory');
          }}
        />
      );
    }

    if (currentRole === 'director') {
      let directorTabValue: 'overview' | 'analytics' | 'cycles' | 'admins' | 'drivers' | 'shareholders' | 'company' | 'reports' | 'audit' | 'monitoring' | 'directory' = 'overview';
      if (activeSection === 'dashboard') directorTabValue = 'overview';
      else if (activeSection === 'drivers') directorTabValue = 'drivers';
      else if (activeSection === 'fleet') directorTabValue = 'directory';
      else if (activeSection === 'payments') directorTabValue = 'analytics';
      else if (activeSection === 'shareholders') directorTabValue = 'shareholders';
      else if (activeSection === 'trips') directorTabValue = 'monitoring';
      else if (activeSection === 'reports') directorTabValue = 'reports';
      else if (activeSection === 'communications') {
        directorTabValue = 'directory';
      }
      else if (activeSection === 'documents') {
        directorTabValue = 'reports';
      }
      else if (activeSection === 'settings') directorTabValue = 'company';
      return (
        <DirectorDashboard
          key={currentRole + '-' + (authToken || 'no-token')}
          lang={lang}
          dictionary={dictionary}
          activeTab={directorTabValue}
          setActiveTab={(tab) => {
            setDirectorTab(tab);
            if (tab === 'overview') setActiveSection('dashboard');
            else if (tab === 'drivers') setActiveSection('drivers');
            else if (tab === 'analytics') setActiveSection('payments');
            else if (tab === 'shareholders') setActiveSection('shareholders');
            else if (tab === 'reports') setActiveSection('reports');
            else if (tab === 'company') setActiveSection('settings');
          }}
        />
      );
    }

    if (currentRole === 'shareholder') {
      let shareholderTabValue: 'overview' | 'cycles' | 'ledger' | 'settings' = 'overview';
      if (activeSection === 'dashboard') shareholderTabValue = 'overview';
      else if (activeSection === 'drivers') {
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto py-20 bg-white rounded-[20px] border border-border-main shadow-xs">
            <Lock className="h-12 w-12 text-brand-gold animate-bounce mb-4" />
            <h3 className="text-xl font-bold text-text-main">Operational Operations Restricted</h3>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Operational directories are restricted for Shareholders. Please refer to executive financial ledgers.
            </p>
          </div>
        );
      }
      else if (activeSection === 'fleet') {
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto py-20 bg-white rounded-[20px] border border-border-main shadow-xs">
            <Lock className="h-12 w-12 text-brand-gold animate-bounce mb-4" />
            <h3 className="text-xl font-bold text-text-main">Operational Operations Restricted</h3>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Physical fleet inventories are restricted for Shareholders. Please refer to financial asset registers.
            </p>
          </div>
        );
      }
      else if (activeSection === 'payments') shareholderTabValue = 'ledger';
      else if (activeSection === 'shareholders') shareholderTabValue = 'overview';
      else if (activeSection === 'trips') shareholderTabValue = 'cycles';
      else if (activeSection === 'settings') shareholderTabValue = 'settings';
      else {
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
          key={currentRole + '-' + (authToken || 'no-token')}
          lang={lang}
          dictionary={dictionary}
          activeTab={shareholderTabValue}
          setActiveTab={(tab) => {
            setShareholderTab(tab);
            if (tab === 'overview') setActiveSection('dashboard');
            else if (tab === 'ledger') setActiveSection('payments');
            else if (tab === 'settings') setActiveSection('settings');
          }}
        />
      );
    }

    return null;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden">
        {/* Subtle ambient animated backdrop */}
        <div className="absolute inset-0 bg-radial-gradient from-brand-gold/10 via-transparent to-transparent opacity-50 animate-pulse pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-gold/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col items-center gap-6 max-w-sm text-center relative z-10">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-4 border-brand-gold/20 animate-ping opacity-30" />
            <div className="absolute inset-0 rounded-full border-2 border-t-brand-gold border-r-transparent border-b-transparent border-l-transparent animate-spin duration-1000" />
            <div className="p-5 bg-slate-900 rounded-full border border-slate-800 shadow-2xl relative">
              <Truck className="h-10 w-10 text-brand-gold animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-widest text-brand-gold">
              RUQAYYA ERP
            </h2>
            <div className="h-1 w-12 bg-gradient-to-r from-transparent via-brand-gold to-transparent mx-auto rounded-full" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider animate-pulse">
              {lang === 'en' ? "Validating Enterprise Session..." : "Tabbatar da Zama na Kamfani..."}
            </p>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            {lang === 'en' 
              ? "Connecting securely to West African operations servers. Please hold."
              : "Haɗawa cikin aminci zuwa sabar ayyukan Afirka ta Yamma. Da fatan za a jira."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-bg-base text-text-main font-sans flex flex-col selection:bg-brand-gold/30">
      
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
      {currentRole !== 'public' && (
        <header className="sticky top-0 z-40 bg-bg-surface border-b border-border-main backdrop-blur-md px-2 sm:px-4 py-3 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-4">
            <div className="flex items-center gap-3">
              {currentRole !== 'public' && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-base transition-colors cursor-pointer"
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

              <div className="hidden lg:flex items-center gap-2 pl-3 ml-1 border-l border-border-main/50 text-[10px] font-semibold text-text-muted">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-text-main font-bold tracking-wider">OPERATIONAL</span>
                <span className="text-border-main/80">•</span>
                <span className="font-mono text-text-muted">{timeStr}</span>
              </div>
            </div>

            {/* Omni Search & System Quick Switches */}
            <div className="flex-1 max-w-sm hidden md:block">
              <GlobalSearch lang={lang} />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Quick Actions Dropdown */}
              {currentRole !== 'public' && currentRole !== 'driver' && (
                <div className="relative">
                  <button
                    onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                    className="px-3 py-1.5 rounded-lg bg-brand-gold text-slate-950 hover:bg-brand-gold/90 transition-all font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Zap className="h-3.5 w-3.5 fill-slate-950 animate-pulse shrink-0" />
                    <span className="hidden sm:inline">{lang === 'en' ? "Quick Actions" : "Ayyuka Sauri"}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${quickActionsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {quickActionsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setQuickActionsOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white border border-border-main rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-border-main/50 font-sans">
                        <div className="px-3.5 py-2 bg-slate-50/50 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          {lang === 'en' ? "Shortcuts" : "Hanyoyin Sauri"}
                        </div>
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setActiveSection('fleet');
                              setQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-text-main hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Truck className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                            {lang === 'en' ? "Register Tricycle" : "Rijistar Sabon Keke"}
                          </button>
                          <button
                            onClick={() => {
                              setActiveSection('trips');
                              setQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-text-main hover:bg-slate-50 flex items-center gap-2"
                          >
                            <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            {lang === 'en' ? "Log Daily Remittance" : "Sanya Remittance"}
                          </button>
                          <button
                            onClick={() => {
                              setActiveSection('payments');
                              setQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-text-main hover:bg-slate-50 flex items-center gap-2"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            {lang === 'en' ? "Record Driver Payment" : "Shigar da Biyan Kudi"}
                          </button>
                        </div>
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setActiveSection('help');
                              setQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-text-main hover:bg-slate-50 flex items-center gap-2"
                          >
                            <HelpCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            {lang === 'en' ? "Help Command Center" : "Cibiyar Taimako"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <NotificationCenter lang={lang} />
              <LanguageSwitcher currentLanguage={lang} onLanguageChange={handleLanguageChange} />
              <ThemeSwitcher currentTheme={theme} onThemeChange={handleThemeChange} />

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

      {/* QUICK ACTIONS HORIZONTAL BAR */}
      {currentRole !== 'public' && currentRole !== 'driver' && (
        <div className="bg-bg-surface border-b border-border-main/50 px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-xs">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 min-w-0 pr-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted font-mono whitespace-nowrap mr-2 flex items-center gap-1 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-gold animate-pulse shrink-0" />
                {lang === 'en' ? "QUICK ACTIONS" : "AYYUKAN SAURI"}:
              </span>
              
              <button
                onClick={() => setShowRecordPaymentModal(true)}
                className="px-2.5 py-1.5 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-transparent"
              >
                <CreditCard className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{lang === 'en' ? "Record Payment" : "Sanya Biyan Kudi"}</span>
              </button>

              <button
                onClick={() => {
                  setCurrentRole('admin');
                  setActiveSection('dashboard');
                  setAdminTab('drivers');
                  // Trigger standard driver registration open
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('open-assisted-driver'));
                  }, 100);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-transparent"
              >
                <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>{lang === 'en' ? "Register Driver" : "Yi Rajistar Direba"}</span>
              </button>

              <button
                onClick={() => setShowImportDriverModal(true)}
                className="px-2.5 py-1.5 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-transparent"
              >
                <Upload className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                <span>{lang === 'en' ? "Import Driver" : "Shigar da CSV"}</span>
              </button>

              <button
                onClick={() => {
                  if (currentRole === 'director') {
                    setDirectorTab('shareholders');
                  } else {
                    setCurrentRole('director');
                    setActiveSection('dashboard');
                    setDirectorTab('shareholders');
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-transparent"
              >
                <Building className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                <span>{lang === 'en' ? "Add Shareholder" : "Saka Mai Hanni"}</span>
              </button>

              <button
                onClick={() => setShowAddExpenseModal(true)}
                className="px-2.5 py-1.5 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-transparent"
              >
                <TrendingDown className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>{lang === 'en' ? "Add Expense" : "Shigar da Asara"}</span>
              </button>

              <button
                onClick={() => {
                  window.print();
                }}
                className="px-2.5 py-1.5 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-transparent"
              >
                <FileText className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                <span>{lang === 'en' ? "Generate Report" : "Fitar da Rahoto"}</span>
              </button>

              <button
                onClick={() => setShowPayrollModal(true)}
                className="px-2.5 py-1.5 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-transparent"
              >
                <Briefcase className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span>{lang === 'en' ? "Payroll" : "Albashin Ma'aikata"}</span>
              </button>
            </div>
            
            <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-text-muted font-mono shrink-0">
              <span className="px-1.5 py-0.5 rounded bg-bg-base border border-border-main/50">SECURE NODE</span>
              <span className="text-brand-gold">•</span>
              <span>AES-256</span>
            </div>
          </div>
        </div>
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
      <div className={`flex-1 flex w-full ${currentRole === 'public' ? 'max-w-none' : 'max-w-7xl mx-auto'}`}>
        {/* SIDEBAR BACKDROP FOR MOBILE */}
        {sidebarOpen && currentRole !== 'public' && (
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR FOR AUTHENTICATED ROLES */}
        {currentRole !== 'public' && (
          <aside className={`fixed inset-y-0 left-0 z-40 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64 bg-brand-navy text-white transform lg:translate-x-0 lg:static lg:h-auto transition-all duration-300 ease-in-out border-r border-slate-800/80 p-4 flex flex-col gap-5 flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex items-center justify-between lg:hidden border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-300">{lang === 'en' ? "System Menu" : "Tsarin Menu"}</span>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 relative group">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-brand-gold text-xs shrink-0 ring-2 ring-slate-700">
                  {currentRole === 'driver' ? 'DR' : currentRole === 'admin' ? 'AD' : 'EX'}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-200 block truncate leading-tight">
                      {currentRole === 'driver' ? driverName : currentRole === 'admin' ? "Operator Ibrahim" : "Director Kabir"}
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
                className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-750 p-1 rounded-full shadow-md cursor-pointer z-50 scale-90 transition-transform"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? "→" : "←"}
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 flex flex-col gap-1 text-xs font-semibold text-slate-300 overflow-y-auto max-h-[50vh] lg:max-h-[none] pr-1 scrollbar-none">
              {getSidebarItems().map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSidebarClick(item.id)}
                  className={`w-full py-2.5 px-3 rounded-lg flex items-center gap-3 transition-colors cursor-pointer text-left ${
                    item.active
                      ? 'bg-brand-gold text-slate-950 font-extrabold shadow-sm'
                      : 'hover:bg-slate-800 hover:text-white'
                  }`}
                  title={sidebarCollapsed ? item.label : ""}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span className="truncate flex-1">{item.label}</span>}
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
              <div className="flex items-center justify-between gap-2 mb-2 lg:hidden px-1">
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
        <main className={`flex-1 ${currentRole === 'public' ? 'p-0 flex flex-col' : 'p-4 md:p-6 grid grid-cols-1'} w-full max-w-full overflow-x-hidden`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRole + '-' + activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`flex-1 ${currentRole === 'public' ? 'flex flex-col' : 'grid grid-cols-1 w-full max-w-full'}`}
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
    </div>
  );
}
