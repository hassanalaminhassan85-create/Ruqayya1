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
import { LandingPage } from './features/LandingPage';
import { DriverDashboard } from './features/DriverDashboard';
import { AdminDashboard } from './features/AdminDashboard';
import { DirectorDashboard } from './features/DirectorDashboard';
import { ShareholderDashboard } from './features/ShareholderDashboard';
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
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Consistent default values defined at module-level to ensure consistent
// initial rendering on both server and client, completely avoiding hydration mismatches.
const DEFAULT_LANG: Language = 'en';
const DEFAULT_THEME: Theme = 'light';

export default function App() {
  const getInitialRole = (): Role => {
    if (typeof window === 'undefined') return 'public';
    const path = window.location.pathname;
    if (path === '/admin') return 'admin';
    if (path === '/director') return 'director';
    if (path === '/shareholder') return 'shareholder';
    return 'public';
  };

  const [lang, setLang] = useState<Language>(DEFAULT_LANG);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [currentRole, setCurrentRole] = useState<Role>(getInitialRole());
  const [driverName, setDriverName] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pathname, setPathname] = useState<string>(typeof window !== 'undefined' ? window.location.pathname : '/');

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
      const path = window.location.pathname;
      const targetRole = path === '/admin' ? 'admin' : path === '/director' ? 'director' : path === '/shareholder' ? 'shareholder' : null;

      const token = api.getToken();
      if (token) {
        try {
          const payload = await api.getMe();
          if (payload && payload.user) {
            const userRole = payload.user.role;
            if (targetRole && userRole !== targetRole) {
              const demoRes = await api.loginAsDemoRole(targetRole);
              setCurrentRole(targetRole);
              setDriverName('');
            } else {
              setCurrentRole(userRole);
              if (userRole === 'driver') {
                setDriverName(payload.user.fullName);
              } else {
                setDriverName('');
              }
            }
          } else {
            api.clearToken();
            if (targetRole) {
              await api.loginAsDemoRole(targetRole);
              setCurrentRole(targetRole);
              setDriverName('');
            }
          }
        } catch (e) {
          api.clearToken();
          if (targetRole) {
            try {
              await api.loginAsDemoRole(targetRole);
              setCurrentRole(targetRole);
              setDriverName('');
            } catch (err) {}
          }
        }
      } else {
        if (targetRole) {
          try {
            await api.loginAsDemoRole(targetRole);
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
      const nextPath = window.location.pathname;
      setPathname(nextPath);
      const targetRole = nextPath === '/admin' ? 'admin' : nextPath === '/director' ? 'director' : nextPath === '/shareholder' ? 'shareholder' : 'public';
      
      const autoAuth = async () => {
        if (targetRole !== 'public') {
          try {
            const demoRes = await api.loginAsDemoRole(targetRole);
            setCurrentRole(targetRole);
            setDriverName('');
          } catch (e) {
            console.error("Auto route shift failed:", e);
          }
        } else {
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
    if (currentRole === 'public') {
      const validPublicPaths = ['/', '/admin', '/director', '/shareholder'];
      if (!validPublicPaths.includes(pathname)) {
        window.history.replaceState({}, '', '/');
        setPathname('/');
      }
    } else {
      let expectedPath = '/';
      if (currentRole === 'admin') expectedPath = '/admin';
      else if (currentRole === 'director') expectedPath = '/director';
      else if (currentRole === 'shareholder') expectedPath = '/shareholder';

      if (pathname !== expectedPath) {
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
    setCurrentRole('public');
    setDriverName('');
    setSidebarOpen(false);
    window.history.pushState({}, '', '/');
    setPathname('/');
  };

  const handleDriverLoginSuccess = (name: string) => {
    setDriverName(name);
    setCurrentRole('driver');
  };

  const handleNavigateToRole = async (role: 'driver' | 'admin' | 'director' | 'shareholder') => {
    try {
      const demoRes = await api.loginAsDemoRole(role);
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

  // Sidebar items based on active role
  const getSidebarItems = () => {
    switch (currentRole) {
      case 'driver':
        return [
          { label: dictionary.sidebar.dashboard, icon: <Compass className="h-4 w-4" />, active: true },
          { label: dictionary.sidebar.vouchers, icon: <Fuel className="h-4 w-4" /> }
        ];
      case 'admin':
        return [
          { label: dictionary.sidebar.dashboard, icon: <Layers className="h-4 w-4" />, active: true },
          { label: dictionary.sidebar.fleet, icon: <Truck className="h-4 w-4" /> },
          { label: dictionary.sidebar.drivers, icon: <Users className="h-4 w-4" /> },
          { label: dictionary.sidebar.trips, icon: <MapPin className="h-4 w-4" /> },
          { label: dictionary.sidebar.vouchers, icon: <Fuel className="h-4 w-4" /> }
        ];
      case 'director':
        return [
          { label: dictionary.sidebar.dashboard, icon: <Layers className="h-4 w-4" />, active: true },
          { label: dictionary.sidebar.finance, icon: <TrendingUp className="h-4 w-4" /> },
          { label: dictionary.sidebar.auditLogs, icon: <Terminal className="h-4 w-4" /> }
        ];
      case 'shareholder':
        return [
          { label: dictionary.sidebar.finance, icon: <TrendingUp className="h-4 w-4" />, active: true }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-sans flex flex-col selection:bg-brand-gold/30">
      
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
                <span className="text-xs font-bold">{lang === 'en' ? "Logout" : "Fita"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER LAYOUT */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* SIDEBAR FOR AUTHENTICATED ROLES */}
        {currentRole !== 'public' && (
          <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-brand-navy text-white transform lg:translate-x-0 lg:static lg:h-auto transition-transform duration-300 ease-in-out border-r border-slate-800/80 p-5 flex flex-col gap-6 flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex items-center justify-between lg:hidden border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-300">{lang === 'en' ? "System Menu" : "Tsarin Menu"}</span>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-brand-gold text-xs">
                  {currentRole === 'driver' ? 'DR' : currentRole === 'admin' ? 'AD' : 'EX'}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-300 block leading-tight">
                    {currentRole === 'driver' ? driverName : currentRole === 'admin' ? "Operator Ibrahim" : "Director Kabir"}
                  </span>
                  <span className="text-[9px] text-brand-gold block font-mono font-bold leading-none mt-1">
                    {dictionary.roles[currentRole]}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 flex flex-col gap-1 text-xs font-semibold text-slate-300">
              {getSidebarItems().map((item, idx) => (
                <button
                  key={idx}
                  className={`w-full py-2.5 px-3 rounded-lg flex items-center gap-3 transition-colors cursor-pointer ${
                    item.active
                      ? 'bg-brand-gold text-slate-950 font-extrabold'
                      : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-800/60 pt-4 flex flex-col gap-2">
              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-3 rounded-lg flex items-center gap-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-bold transition-all cursor-pointer text-xs"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                <span>{lang === 'en' ? "Secure Logout" : "Fita Daga Tsarin"}</span>
              </button>
              <div className="text-[9px] text-slate-500 font-mono flex flex-col gap-1 mt-1">
                <span>Wrangler Binding: DB</span>
                <span>R2 Storage: Mapping Active</span>
                <span>Node Environment: Production</span>
              </div>
            </div>
          </aside>
        )}

        {/* WORKSPACE SURFACE VIEW */}
        <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRole}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {currentRole === 'public' && (
                <LandingPage
                  dictionary={dictionary}
                  lang={lang}
                  onLoginAsDriver={handleDriverLoginSuccess}
                  onNavigateToRole={(role) => setCurrentRole(role)}
                />
              )}
              {currentRole === 'driver' && (
                <DriverDashboard
                  driverName={driverName}
                  lang={lang}
                  dictionary={dictionary}
                />
              )}
              {currentRole === 'admin' && (
                <AdminDashboard
                  lang={lang}
                  dictionary={dictionary}
                />
              )}
              {currentRole === 'director' && (
                <DirectorDashboard
                  lang={lang}
                  dictionary={dictionary}
                />
              )}
              {currentRole === 'shareholder' && (
                <ShareholderDashboard
                  lang={lang}
                  dictionary={dictionary}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
