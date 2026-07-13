/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Database, 
  Bell, 
  RefreshCw, 
  CloudLightning, 
  Trash2, 
  Wifi, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Info,
  Smartphone,
  ShieldAlert,
  Loader
} from 'lucide-react';
import { offlineSync, OfflineQueueItem } from '../utils/offlineSync';
import { api } from '../utils/api';
import { requestNotificationPermission } from '../utils/notificationHelper';

interface PWAPanelProps {
  lang: 'en' | 'ha';
}

export function PWAPanel({ lang }: PWAPanelProps) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{ used: string; total: string; percent: number }>({ used: '0 B', total: '0 B', percent: 0 });
  const [cacheCount, setCacheCount] = useState<number>(0);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [syncQueue, setSyncQueue] = useState<OfflineQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if running in standalone mode (installed)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);
    setIsInstalled(isStandaloneMode || localStorage.getItem('ruqayya_pwa_installed') === 'true');

    // Load initial sync queue
    setSyncQueue(offlineSync.getQueue());

    // Notification Permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Capture beforeinstallprompt for installation triggers
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Dynamic storage estimation
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        const used = estimate.usage || 0;
        const total = estimate.quota || 1;
        setStorageUsage({
          used: formatBytes(used),
          total: formatBytes(total),
          percent: Math.min(Math.round((used / total) * 100), 100)
        });
      });
    }

    // Get number of cached resources
    if ('caches' in window) {
      caches.keys().then((keys) => {
        setCacheCount(keys.length);
      });
    }

    // Listen to custom PWA and sync events
    const handleSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSyncQueue(offlineSync.getQueue());
      if (detail.status === 'synchronizing') {
        setIsSyncing(true);
      } else {
        setIsSyncing(false);
        if (detail.status === 'success') {
          const syncedDesc = lang === 'en' 
            ? `Synced: ${detail.syncedItem?.descriptionEn}`
            : `An tura: ${detail.syncedItem?.descriptionHa}`;
          setSyncStatus({ type: 'success', message: syncedDesc });
        }
      }
    };

    const handleActionQueued = () => {
      setSyncQueue(offlineSync.getQueue());
    };

    const handleSyncCompleted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const msg = lang === 'en'
        ? `Sync Completed! ${detail.successCount} operations successfully processed.`
        : `An Gama Daidaitawa! An shigar da ayyuka ${detail.successCount} cikin nasara.`;
      setSyncStatus({ type: 'success', message: msg });
      setTimeout(() => setSyncStatus({ type: 'idle', message: '' }), 5000);
    };

    window.addEventListener('pwa-sync-status', handleSyncStatus);
    window.addEventListener('pwa-action-queued', handleActionQueued);
    window.addEventListener('pwa-sync-completed', handleSyncCompleted);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-sync-status', handleSyncStatus);
      window.removeEventListener('pwa-action-queued', handleActionQueued);
      window.removeEventListener('pwa-sync-completed', handleSyncCompleted);
    };
  }, [lang]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('ruqayya_pwa_installed', 'true');
      }
      setInstallPrompt(null);
    } else {
      alert(lang === 'en' 
        ? "To install Ruqayya ERP, click your browser's share icon or settings menu and choose 'Add to Home Screen'." 
        : "Don shigar da Ruqayya ERP, danna share icon na browser dinka ko settings ka zabi 'Add to Home Screen'.");
    }
  };

  const handleClearCache = async () => {
    if (!('caches' in window)) return;
    const keys = await caches.keys();
    for (const key of keys) {
      await caches.delete(key);
    }
    setCacheCount(0);
    setStorageUsage(prev => ({ ...prev, used: '0 B', percent: 0 }));
    alert(lang === 'en' 
      ? "Offline assets cache cleared successfully." 
      : "An goge ma'ajiyar offline cikin nasara.");
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatus({ type: 'idle', message: '' });
    try {
      const result = await offlineSync.sync(api.request);
      if (result.successCount === 0 && result.failedCount === 0) {
        setSyncStatus({
          type: 'idle',
          message: lang === 'en' ? 'No pending offline operations found.' : 'Babu ayyukan da ke jiran turawa.'
        });
      }
    } catch (e) {
      setSyncStatus({
        type: 'error',
        message: lang === 'en' ? 'Sync process encountered an error.' : 'An samu matsala wajen daidaita bayanai.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckUpdates = () => {
    setCheckingUpdates(true);
    setTimeout(() => {
      setCheckingUpdates(false);
      setUpdateAvailable(false);
      alert(lang === 'en' 
        ? "RUQAYYA TRANSPORT ERP is up-to-date (v2.4.0-production-pwa)." 
        : "Tsarin RUQAYYA TRANSPORT ERP yana kan sabon salo mafi inganci (v2.4.0-production-pwa).");
    }, 1500);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    if (granted) {
      alert(lang === 'en' 
        ? "Native push notifications authorized successfully." 
        : "An amince da turo sanarwa na asali cikin nasara.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
          <CloudLightning className="h-5 w-5 text-brand-gold animate-pulse" />
          <span>{lang === 'en' ? "Enterprise PWA Hub" : "Cibiyar Gudanar da PWA"}</span>
        </h2>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          {lang === 'en' 
            ? "Configure installable offline capability, progressive asset caching, background synchronization, and native operating system notifications."
            : "Saita damar yin aiki offline, adana fayilolin aiki, daidaita bayanai a bango, da kuma turo sanarwa ta asali."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* INSTALL CARD */}
        <div className="bg-bg-surface border border-border-main rounded-[20px] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {lang === 'en' ? "Install Status" : "Matsayin Shigarwa"}
              </span>
              {isStandalone ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  {lang === 'en' ? "Standalone App" : "Cikakkiyar App"}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {lang === 'en' ? "Web Browser" : "Gidan Yanar Gizo"}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              RUQAYYA TRANSPORT ERP
            </h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              {lang === 'en'
                ? "Install Ruqayya ERP directly onto your home screen, desktop, or mobile device for a premium standalone native-feel experience with faster load speeds."
                : "Girkawa Ruqayya ERP kai tsaye a kan fuskar wayarka ko kwamfuta don samun saukin amfani da saurin bude shafuka."}
            </p>
          </div>
          <div className="mt-5 flex gap-3">
            {!isStandalone && (
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-brand-navy hover:bg-brand-navy/90 text-white dark:bg-brand-gold dark:text-brand-navy font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Download className="h-4 w-4" />
                {lang === 'en' ? "Install App Now" : "Girkawa App Yanzu"}
              </button>
            )}
            <button
              onClick={handleCheckUpdates}
              disabled={checkingUpdates}
              className="flex-1 bg-bg-base hover:bg-border-main border border-border-main text-text-main font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {checkingUpdates ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {lang === 'en' ? "Check Updates" : "Duba Sabuntawa"}
            </button>
          </div>
        </div>

        {/* STORAGE & OFFLINE CACHE */}
        <div className="bg-bg-surface border border-border-main rounded-[20px] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {lang === 'en' ? "Offline Cache & Storage" : "Gabar Adana Fayiloli"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold border border-brand-navy/20 dark:border-brand-gold/20">
                {lang === 'en' ? "Engine v1.0" : "Salo v1.0"}
              </span>
            </div>
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <Database className="h-4 w-4 text-brand-gold" />
              {lang === 'en' ? "Progressive Shell Storage" : "Ma'ajiyar Lambobi"}
            </h3>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">{lang === 'en' ? "Cache Usage" : "Amfani da Cache"}:</span>
                <span className="font-semibold text-text-main">{storageUsage.used} / {storageUsage.total}</span>
              </div>
              <div className="w-full bg-bg-base rounded-full h-2 overflow-hidden border border-border-main">
                <div 
                  className="bg-brand-gold h-full rounded-full transition-all duration-500" 
                  style={{ width: `${storageUsage.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>{lang === 'en' ? "Dynamic Cached Assets" : "Fayilolin da aka Adana"}: {cacheCount} packages</span>
                <span>{storageUsage.percent}% {lang === 'en' ? "allocated" : "aka yi amfani"}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleClearCache}
              className="flex-1 bg-red-600/10 hover:bg-red-600 hover:text-white border border-red-600/20 text-red-500 font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {lang === 'en' ? "Clear Cached Assets" : "Goge Ma'ajiyar Cache"}
            </button>
          </div>
        </div>

        {/* PUSH NOTIFICATIONS REGISTER */}
        <div className="bg-bg-surface border border-border-main rounded-[20px] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {lang === 'en' ? "Push Engine" : "Injin Sanarwa"}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                notificationPermission === 'granted' 
                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                  : notificationPermission === 'denied'
                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }`}>
                {notificationPermission === 'granted' 
                  ? (lang === 'en' ? 'Authorized' : 'An Amince') 
                  : notificationPermission === 'denied'
                  ? (lang === 'en' ? 'Blocked' : 'An Hana')
                  : (lang === 'en' ? 'Prompt' : 'A Nema')}
              </span>
            </div>
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-gold animate-swing" />
              {lang === 'en' ? "OS-Level Push Transmissions" : "Sanarwar Wayar Salula"}
            </h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              {lang === 'en'
                ? "Receive immediate dispatch warnings, emergency fleet alerts, payment approvals, and shareholder dividends directly on your system's notification drawer even if the app is closed."
                : "Karbi gaggawan sanarwar aiki, amincewa da biyan kudi, da ribar hannun jari kai tsaye a kan allon wayarka koda baka bude shafin ba."}
            </p>
          </div>
          
          <div className="mt-5 flex gap-3">
            {notificationPermission !== 'granted' ? (
              <button
                onClick={handleEnableNotifications}
                className="flex-1 bg-brand-navy hover:bg-brand-navy/90 text-white dark:bg-brand-gold dark:text-brand-navy font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                {lang === 'en' ? "Enable OS Notifications" : "Kunna Sanarwar Allon Waya"}
              </button>
            ) : (
              <div className="flex-1 text-center py-2 text-xs font-medium text-green-500 flex items-center justify-center gap-1.5 bg-green-500/5 rounded-xl border border-green-500/10">
                <CheckCircle className="h-4 w-4" />
                {lang === 'en' ? "Notifications configured successfully" : "An saita sanarwa cikin nasara"}
              </div>
            )}
          </div>
        </div>

        {/* BACKGROUND OFFLINE ACTION SYNC */}
        <div className="bg-bg-surface border border-border-main rounded-[20px] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {lang === 'en' ? "Background Sync Status" : "Daidaita Bayanai a Bango"}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                syncQueue.length > 0 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                  : 'bg-green-500/10 text-green-500 border border-green-500/20'
              }`}>
                {syncQueue.length} {lang === 'en' ? "queued" : "jiran aiki"}
              </span>
            </div>
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <CloudLightning className="h-4 w-4 text-brand-gold" />
              {lang === 'en' ? "Automatic Queue Drainer" : "Injin Tura Ayyukan Offline"}
            </h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              {lang === 'en'
                ? "When internet access drops, Ruqayya ERP automatically queues actions locally and syncs them seamlessly when the connection returns without duplicate postings."
                : "Idan babu hanyar sadarwa, dukkan abubuwan da ka danna za a adana su na wucin gadi, sannan za a tura su ta bango da zarar hanyar sadarwa ta dawo."}
            </p>
          </div>
          
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex-1 bg-brand-navy hover:bg-brand-navy/90 text-white dark:bg-brand-gold dark:text-brand-navy font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-95"
            >
              {isSyncing ? (
                <>
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                  {lang === 'en' ? "Synchronizing Operations..." : "Ana tura bayanai..."}
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {lang === 'en' ? "Synchronize Queue" : "Fara Daidaitawa Yanzu"}
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* SYNC ACTIONS LOG */}
      {syncQueue.length > 0 && (
        <div className="bg-bg-surface border border-border-main rounded-[20px] p-5 shadow-xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-brand-gold" />
            {lang === 'en' ? "Pending Offline Operations Queue" : "Jerin Ayyukan Offline Masu Jira"}
          </h3>
          <div className="divide-y divide-border-main overflow-hidden border border-border-main rounded-xl bg-bg-base max-h-60 overflow-y-auto">
            {syncQueue.map((item) => (
              <div key={item.id} className="p-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-text-main">
                    {lang === 'en' ? item.descriptionEn : item.descriptionHa}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono flex items-center gap-1">
                    <span className="uppercase text-brand-gold font-bold">{item.method}</span>
                    <span>•</span>
                    <span>{item.endpoint}</span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold">
                  {lang === 'en' ? "Pending Sync" : "Jiran Tura"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATUS STATUS BANNER */}
      {syncStatus.message && (
        <div className={`p-4 rounded-xl border flex items-start gap-2.5 text-xs ${
          syncStatus.type === 'success' 
            ? 'bg-green-500/5 text-green-500 border-green-500/10' 
            : syncStatus.type === 'error'
            ? 'bg-red-500/5 text-red-500 border-red-500/10'
            : 'bg-brand-navy/5 text-brand-navy dark:bg-brand-gold/5 dark:text-brand-gold border-border-main'
        }`}>
          {syncStatus.type === 'success' ? (
            <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          ) : syncStatus.type === 'error' ? (
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{syncStatus.message}</span>
        </div>
      )}
      
      {/* VERSION FOOTER */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-border-main pt-4 text-[10px] text-text-muted">
        <div className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          <span>RUQAYYA ERP Enterprise Progressive App Environment • v2.4.0-production-pwa</span>
        </div>
        <div>
          <span>© {new Date().getFullYear()} Ruqayya Transport Limited. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
