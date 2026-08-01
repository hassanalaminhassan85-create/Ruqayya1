import React, { useState, useEffect } from 'react';
import { OverviewTab } from '../components/director/OverviewTab';
import { api } from '../utils/api';
import { 
  Vehicle, 
  Driver, 
  DailyRemittance, 
  FinancialRecord, 
  Shareholder, 
  Language, 
  Dictionary 
} from '../types';
import EnterpriseDirectory from '../components/admin/EnterpriseDirectory';
import { FinancialCommandCenter } from '../components/admin/FinancialCommandCenter';
import { ReportCenter } from '../components/admin/ReportCenter';
import { CommunicationCenter } from '../components/admin/CommunicationCenter';
import { DocumentHub } from '../components/admin/DocumentHub';
import { subscribeToActiveCycle } from '../utils/cycleService';

export const DirectorDashboard: React.FC<{
  lang: Language;
  dictionary: Dictionary;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  activeCycle?: any;
}> = ({ lang, dictionary, activeTab, setActiveTab, activeCycle: propActiveCycle }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<DailyRemittance[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [localActiveCycle, setLocalActiveCycle] = useState<any>(null);
  const activeCycle = propActiveCycle !== undefined ? propActiveCycle : localActiveCycle;
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const syncData = async () => {
    try {
      const [v, d, t, f, s, c, l, adm, pay, n, sets] = await Promise.all([
        api.getVehicles(),
        api.getDrivers(),
        api.getTrips(),
        api.getFinance(),
        api.getShareholders(),
        api.request('/api/director/cycles').then(res => res?.cycles || []),
        api.getAuditLogs(),
        api.request('/api/admin/admins').then(res => res || []),
        api.getPayments(),
        api.getNotifications(),
        api.getOperationsState()
      ]);
      setVehicles(v || []);
      setDrivers(d || []);
      setTrips(t || []);
      setFinancials(f || []);
      setShareholders(s || []);
      setCycles(c || []);
      setLogs(l || []);
      setAdmins(adm || []);
      setPayments(pay || []);
      setNotifications(n || []);
      setSettings(sets || {});
    } catch (err) {
      console.error("Director data sync failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 10000);
    
    const unsubCycle = propActiveCycle !== undefined ? () => {} : subscribeToActiveCycle((data) => {
      if (data) {
        setLocalActiveCycle({
          ...data,
          id: data.cycleId
        });
      } else {
        setLocalActiveCycle(null);
      }
    });

    // SSE Simulation or real connection
    const token = api.getToken();
    let es: EventSource | null = null;
    if (token) {
      try {
        es = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
        es.onopen = () => setSseConnected(true);
        es.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.type === 'db_update') {
            if (data.vehicles) setVehicles(data.vehicles);
            if (data.drivers) setDrivers(data.drivers);
            if (data.financials) setFinancials(data.financials);
            if (data.trip_manifests) setTrips(data.trip_manifests);
            if (data.shareholders) setShareholders(data.shareholders);
            if (data.driver_payments) setPayments(data.driver_payments);
            if (data.audit_logs) setLogs(data.audit_logs);
            if (data.notifications) setNotifications(data.notifications);
            if (data.cycles) setCycles(data.cycles);
            if (data.admins) setAdmins(data.admins);
          }
        };
        es.onerror = () => setSseConnected(false);
      } catch (e) {
        console.warn("SSE not supported");
      }
    }

    return () => {
      clearInterval(interval);
      unsubCycle();
      es?.close();
    };
  }, [propActiveCycle]);

  const handleStartCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    syncData();
  };

  const handleEndCycle = async () => {
    try {
      await api.endCycle({ endDate: new Date().toISOString() });
      syncData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 bg-bg-base min-h-screen">
      {activeTab === 'overview' && (
        <OverviewTab
          lang={lang}
          dictionary={dictionary}
          logs={logs}
          financials={financials}
          vehicles={vehicles}
          drivers={drivers}
          admins={admins}
          shareholders={shareholders}
          cycles={cycles}
          activeCycle={activeCycle}
          companySettings={settings?.company_settings || {}}
          shareholderSettings={settings?.shareholder_settings || {}}
          tripManifests={trips}
          notifications={notifications}
          users={[]}
          sseConnected={sseConnected}
          onStartCycle={handleStartCycle}
          onEndCycle={handleEndCycle}
          cycleGoalForm={{ startDate: new Date().toISOString(), endGoalTons: '200' }}
          setCycleGoalForm={() => {}}
          onAddAdmin={() => {}}
          onAddShareholder={() => {}}
          setActiveTab={setActiveTab}
          setSelectedDriver={() => {}}
          backupLoading={false}
          restoreLoading={false}
          onDownloadBackup={() => {}}
          onUploadRestore={() => {}}
          restoreSuccess={null}
          restoreError={null}
          onStateChange={syncData}
        />
      )}

      {activeTab === 'directory' && (
        <EnterpriseDirectory
          lang={lang}
          dictionary={dictionary}
        />
      )}

      {(activeTab === 'analytics' || activeTab === 'shareholders' || activeTab === 'monitoring') && (
        <FinancialCommandCenter
          lang={lang}
          drivers={drivers}
          vehicles={vehicles}
          finance={financials}
          payments={payments}
          shareholders={shareholders}
          onSync={syncData}
          trips={trips}
          activeCycle={activeCycle}
        />
      )}

      {activeTab === 'reports' && (
        <ReportCenter
          lang={lang}
          drivers={drivers}
          vehicles={vehicles}
          finance={financials}
          payments={payments}
          shareholders={shareholders}
          onSync={syncData}
          trips={trips}
          activeCycle={activeCycle}
        />
      )}

      {activeTab === 'communications' && (
        <CommunicationCenter lang={lang} />
      )}

      {activeTab === 'documents' && (
        <DocumentHub lang={lang} />
      )}

      {activeTab === 'company' && (
        <div className="flex flex-col gap-6">
           <div className="bg-bg-surface border border-border-main rounded-2xl p-6 shadow-sm">
             <h3 className="text-lg font-bold text-text-main mb-4">
               {lang === 'en' ? "Directorate System Controls" : "Saitunan Tsarin Shugabanni"}
             </h3>
             <p className="text-sm text-text-muted mb-6">
               {lang === 'en' 
                 ? "Manage operational overrides, high-level auditing, and executive reports from this dashboard."
                 : "Gudanar da tsarin kamfani, duba rahotanni, da sauran saitunan shugabanni daga nan."}
             </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-4 bg-bg-base border border-border-main rounded-xl">
                 <h4 className="text-xs font-black uppercase text-brand-gold mb-2">Executive Audit</h4>
                 <p className="text-[10px] text-text-muted">Review all system-wide actions and historical audit logs.</p>
               </div>
               <div className="p-4 bg-bg-base border border-border-main rounded-xl">
                 <h4 className="text-xs font-black uppercase text-brand-gold mb-2">Policy Settings</h4>
                 <p className="text-[10px] text-text-muted">Update global company policies and remittance goal targets.</p>
               </div>
             </div>
           </div>
        </div>
      )}
      
      {['overview', 'directory', 'analytics', 'shareholders', 'monitoring', 'reports', 'communications', 'documents', 'company'].indexOf(activeTab) === -1 && (
        <div className="p-12 bg-white rounded-2xl border border-border-main text-center shadow-xs">
          <h2 className="text-xl font-bold text-text-main uppercase tracking-tight">
            {lang === 'en' ? "Module Restricted" : "Wannan bangaren yana gyara"}
          </h2>
          <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
            The {activeTab} module is currently being optimized for executive oversight.
          </p>
          <button 
            onClick={() => setActiveTab('overview')}
            className="mt-6 px-6 py-2.5 bg-brand-gold text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md cursor-pointer"
          >
            {lang === 'en' ? "Return to Command Center" : "Koma Babban Shafin Kula"}
          </button>
        </div>
      )}
    </div>
  );
};
