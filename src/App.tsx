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
import { CircularLogo } from './components/CircularLogo';
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
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    if (typeof window === 'undefined') return 'public';
    const cleanPath = normalizePath(window.location.pathname);
    if (cleanPath === '/admin') return 'admin';
    if (cleanPath === '/director') return 'director';
    if (cleanPath === '/shareholder') return 'shareholder';
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

  // Tab states for active roles to link hamburger sidebar & dashboards
  const [driverTab, setDriverTab] = useState<'overview' | 'payments' | 'history' | 'vehicle' | 'documents' | 'profile'>('overview');
  const [adminTab, setAdminTab] = useState<'fleet' | 'drivers' | 'trips' | 'vouchers' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory'>('fleet');
  const [directorTab, setDirectorTab] = useState<'overview' | 'analytics' | 'cycles' | 'admins' | 'drivers' | 'shareholders' | 'company' | 'reports' | 'audit' | 'monitoring' | 'directory'>('overview');
  const [shareholderTab, setShareholderTab] = useState<'overview' | 'cycles' | 'ledger' | 'settings'>('overview');

  // Reset tabs on role transitions
  useEffect(() => {
    setDriverTab('overview');
    setAdminTab('fleet');
    setDirectorTab('overview');
    setShareholderTab('overview');
    setActiveSection('dashboard');
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
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const hydrateSession = async () => {
      const cleanPath = normalizePath(window.location.pathname);
      const targetRole = cleanPath === '/admin' ? 'admin' : cleanPath === '/director' ? 'director' : cleanPath === '/shareholder' ? 'shareholder' : null;

      const token = api.getToken();
      if (token) {
        try {
          const payload = await api.getMe();
          if (payload && payload.user) {
            const userRole = payload.user.role;
            if (targetRole && userRole !== targetRole) {
              const demoRes = await api.loginAsDemoRole(targetRole);
              setAuthToken(demoRes.token);
              setCurrentRole(targetRole);
              setDriverName('');
            } else {
              setAuthToken(token);
              setCurrentRole(userRole);
              if (userRole === 'driver') {
                setDriverName(payload.user.fullName);
              } else {
                setDriverName('');
              }
            }
          } else {
            api.clearToken();
            setAuthToken(null);
            if (targetRole) {
              const demoRes = await api.loginAsDemoRole(targetRole);
              setAuthToken(demoRes.token);
              setCurrentRole(targetRole);
              setDriverName('');
            }
          }
        } catch (e) {
          api.clearToken();
          setAuthToken(null);
          if (targetRole) {
            try {
              const demoRes = await api.loginAsDemoRole(targetRole);
              setAuthToken(demoRes.token);
              setCurrentRole(targetRole);
              setDriverName('');
            } catch (err) {}
          }
        }
      } else {
        if (targetRole) {
          try {
            const demoRes = await api.loginAsDemoRole(targetRole);
            setAuthToken(demoRes.token);
            setCurrentRole(targetRole);
            setDriverName('');
          } catch (err) {}
        }
      }
    };
    hydrateSession();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for browser popstate routing changes
  useEffect(() => {
    const handlePopState = () => {
      const nextPath = normalizePath(window.location.pathname);
      setPathname(nextPath);
      const targetRole = nextPath === '/admin' ? 'admin' : nextPath === '/director' ? 'director' : nextPath === '/shareholder' ? 'shareholder' : 'public';
      
      const autoAuth = async () => {
        if (targetRole !== 'public') {
          try {
            const demoRes = await api.loginAsDemoRole(targetRole);
            setAuthToken(demoRes.token);
            setCurrentRole(targetRole);
            setDriverName('');
          } catch (e) {
            console.error("Auto route shift failed:", e);
          }
        } else {
          setAuthToken(null);
          setCurrentRole('public');
        }
      };
      autoAuth();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Role-based routing enforcement and redirection logic
  useEffect(() => {
    const cleanPath = normalizePath(pathname);
    if (currentRole === 'public') {
      const validPublicPaths = ['/', '/admin', '/director', '/shareholder'];
      if (!validPublicPaths.includes(cleanPath)) {
        window.history.replaceState({}, '', '/');
        setPathname('/');
      }
    } else {
      let expectedPath = '/';
      if (currentRole === 'admin') expectedPath = '/admin';
      else if (currentRole === 'director') expectedPath = '/director';
      else if (currentRole === 'shareholder') expectedPath = '/shareholder';

      if (cleanPath !== expectedPath) {
        window.history.replaceState({}, '', expectedPath);
        setPathname(expectedPath);
      }
    }
  }, [currentRole, pathname]);

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

  const handleNavigateToRole = async (role: 'driver' | 'admin' | 'director' | 'shareholder') => {
    try {
      const demoRes = await api.loginAsDemoRole(role);
      setAuthToken(demoRes.token);
      setCurrentRole(role);
      setDriverName(role === 'driver' ? demoRes.user.fullName : '');
      const nextPath = role === 'admin' ? '/admin' : role === 'director' ? '/director' : role === 'shareholder' ? '/shareholder' : '/';
      window.history.pushState({}, '', nextPath);
      setPathname(nextPath);
    } catch (e) {
      console.error("Role navigation failed:", e);
    }
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
      { id: 'settings', label: lang === 'en' ? "Settings" : "Kula da Akun", icon: <Settings className="h-4 w-4 shrink-0" />, active: activeSection === 'settings' },
      { id: 'help', label: lang === 'en' ? "Help & Support" : "Taimako da Support", icon: <HelpCircle className="h-4 w-4 shrink-0" />, active: activeSection === 'help' },
    ];

    if (currentRole === 'driver') {
      return items.filter(item => 
        ['dashboard', 'drivers', 'fleet', 'payments', 'trips', 'documents', 'notifications', 'settings', 'help'].includes(item.id)
      );
    }
    if (currentRole === 'admin') {
      return items.filter(item => 
        ['dashboard', 'drivers', 'fleet', 'payments', 'trips', 'reports', 'communications', 'documents', 'notifications', 'settings', 'help'].includes(item.id)
      );
    }
    if (currentRole === 'shareholder') {
      return items.filter(item => 
        ['dashboard', 'shareholders', 'notifications', 'settings', 'help'].includes(item.id)
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
        <header className="sticky top-0 z-40 bg-bg-surface border-b border-border-main backdrop-blur-md px-4 py-3 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
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
            </div>

            {/* Omni Search & System Quick Switches */}
            <div className="flex-1 max-w-sm hidden md:block">
              <GlobalSearch lang={lang} />
            </div>

            <div className="flex items-center gap-3">
              {/* Quick Actions Dropdown */}
              {currentRole !== 'public' && (
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
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-800/60 pt-4 flex flex-col gap-2">
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
                  dictionary={dictionary}
                  lang={lang}
                  onLoginAsDriver={handleDriverLoginSuccess}
                  onNavigateToRole={(role) => setCurrentRole(role)}
                  currentTheme={theme}
                  onThemeChange={handleThemeChange}
                  onLanguageChange={handleLanguageChange}
                />
              ) : (
                renderMainContent()
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
