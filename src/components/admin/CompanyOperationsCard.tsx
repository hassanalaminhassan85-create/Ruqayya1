/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { 
  Play, 
  Pause, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Wallet, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  UserCheck, 
  Info,
  Server,
  Briefcase,
  Coins
} from 'lucide-react';

interface CompanyOperationsCardProps {
  lang: 'en' | 'ha';
  onStateChange?: () => void;
  driversCount: number;
  vehiclesCount: number;
}

export const CompanyOperationsCard: React.FC<CompanyOperationsCardProps> = ({ 
  lang, 
  onStateChange,
  driversCount,
  vehiclesCount
}) => {
  const [opsState, setOpsState] = useState<any>({
    status: 'Setup Mode',
    currentCycle: '',
    currentDay: 1,
    startedBy: null,
    startedAt: null,
    pauseHistory: [],
    auditLog: []
  });
  const [metrics, setMetrics] = useState<any>({
    totalDrivers: 0,
    totalTricycles: 0,
    todayCollections: 0,
    companyWalletBalance: 0,
    systemHealth: 'Healthy'
  });
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [checklist, setChecklist] = useState<any>([]);

  // Inline forms state
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [salaryRole, setSalaryRole] = useState('Admin');
  const [salaryAmount, setSalaryAmount] = useState('150000');
  
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletBalance, setWalletBalance] = useState('5000000');

  const fetchOperationsState = async () => {
    try {
      const res = await api.getOperationsState();
      if (res && res.success) {
        setOpsState(res.state);
        setMetrics(res.metrics);
      }
    } catch (err) {
      console.error("Failed to fetch company operations state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperationsState();
    
    // Register event listener for real-time state changes via custom SSE DB dispatch
    const handleDbChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.company_operations_state) {
        setOpsState(detail.company_operations_state);
        if (detail.financials) {
          // Recalculate metrics based on detail
          const todayStr = new Date().toISOString().split('T')[0];
          const todayCol = (detail.driver_payments || [])
            .filter((p: any) => p.status === 'approved' && p.date && p.date.startsWith(todayStr))
            .reduce((sum: number, p: any) => sum + p.amount, 0);

          setMetrics({
            totalDrivers: detail.drivers?.length || 0,
            totalTricycles: detail.vehicles?.length || 0,
            todayCollections: todayCol,
            companyWalletBalance: detail.company_settings?.wallet_balance || 0,
            systemHealth: 'Healthy'
          });
        }
      }
    };
    
    window.addEventListener('db-change', handleDbChange);
    return () => {
      window.removeEventListener('db-change', handleDbChange);
    };
  }, []);

  const evaluateChecklist = async () => {
    setActionError('');
    try {
      const stateRes = await api.getOperationsState();
      const currentDB = (window as any).lastSSEState || {};
      const companySettings = currentDB.company_settings || {};
      const drivers = currentDB.drivers || [];
      const vehicles = currentDB.vehicles || [];
      const shareholders = currentDB.shareholders || [];
      const users = currentDB.users || [];

      const adminCount = users.filter((u: any) => u.role_id === 'role-admin' || u.role_id === 'role-director' || u.role === 'admin' || u.role === 'director').length;

      const profileComplete = companySettings.companyName && companySettings.companyAddress && companySettings.phone && companySettings.email;
      const driverComplete = drivers.length >= 1;
      const tricycleComplete = vehicles.length >= 1 && vehicles.some((v: any) => v.driverId || v.driver_id);
      const shareholderComplete = shareholders.length >= 1;
      const salaryComplete = companySettings.salary_configured || (companySettings.salaries && companySettings.salaries.length >= 1);
      const walletComplete = companySettings.wallet_initialized || companySettings.wallet_balance !== undefined;
      const rulesComplete = companySettings.rules_shareholder_configured && companySettings.rules_cycle_configured;

      const items = [
        {
          id: 'profile',
          titleEn: 'Corporate Profile Configured',
          titleHa: 'Siffar Kamfani a Tsare',
          descEn: 'Requires company name, address, phone, and email.',
          descHa: 'Ana buƙatar sunan kamfani, adireshi, tarho, da imel.',
          isDone: !!profileComplete,
        },
        {
          id: 'admin',
          titleEn: 'Administrator Registered',
          titleHa: 'Akalla Akwai Mai Kula Guda Guda',
          descEn: 'Requires at least one Administrator or Executive Director account.',
          descHa: 'Ana buƙatar aƙalla asusun mai kula guda ɗaya.',
          isDone: adminCount >= 1,
        },
        {
          id: 'driver',
          titleEn: 'Drivers Registered',
          titleHa: 'Rijistar Direbobi',
          descEn: 'Requires at least one active driver registered in the system.',
          descHa: 'Ana buƙatar aƙalla direba guda ɗaya a cikin tsarin.',
          isDone: driverComplete,
        },
        {
          id: 'tricycle',
          titleEn: 'Tricycles Assigned',
          titleHa: 'Kekuna da aka raba wa Direbobi',
          descEn: 'Requires at least one registered tricycle assigned to an active driver.',
          descHa: 'Ana buƙatar aƙalla keke guda ɗaya da aka raba wa direba.',
          isDone: tricycleComplete,
        },
        {
          id: 'shareholder',
          titleEn: 'Shareholders Registered',
          titleHa: 'Rijistar Masu Sanya Jari',
          descEn: 'Requires at least one shareholder profile registered.',
          descHa: 'Ana buƙatar aƙalla mai sanya jari guda ɗaya.',
          isDone: shareholderComplete,
        },
        {
          id: 'salary',
          titleEn: 'Salary Configurations Complete',
          titleHa: 'Sari da Tsarin Albashi',
          descEn: 'Requires setting operational salaries for administrative roles.',
          descHa: 'Ana buƙatar saita albashin masu gudanarwa.',
          isDone: !!salaryComplete,
          action: () => setShowSalaryForm(true)
        },
        {
          id: 'wallet',
          titleEn: 'Company Wallet Initialized',
          titleHa: 'Asusun Kamfani (Wallet)',
          descEn: 'Requires initializing company financial balance sheet.',
          descHa: 'Ana buƙatar buɗe asusun kuɗi na kamfani.',
          isDone: !!walletComplete,
          action: () => setShowWalletForm(true)
        },
        {
          id: 'rules',
          titleEn: 'Operational Rules Configured',
          titleHa: 'Dokokin Gudanarwa da Zagaye',
          descEn: 'Requires 30-Day operating cycle rules and shareholder investment ratio setup.',
          descHa: 'Ana buƙatar tsarin zagaye na kwanaki 30 da dokokin raba riba.',
          isDone: !!rulesComplete,
          action: async () => {
            try {
              await api.configRules({ rules_shareholder_configured: true, rules_cycle_configured: true, roles_configured: true });
              evaluateChecklist();
            } catch (err: any) {
              setActionError(err.message);
            }
          }
        }
      ];

      setChecklist(items);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartCompanyOperations = async () => {
    setActionError('');
    try {
      const res = await api.startOperations();
      if (res && res.success) {
        setOpsState(res.state);
        setShowChecklistModal(false);
        if (onStateChange) onStateChange();
        fetchOperationsState();
      }
    } catch (err: any) {
      setActionError(err.message || 'Validation failed. Ensure checklist is 100% complete.');
    }
  };

  const handlePauseCompanyOperations = async () => {
    if (!pauseReason) {
      setActionError(lang === 'en' ? 'Reason is required to suspend operations.' : 'Ana buƙatar bayanin dalili.');
      return;
    }
    setActionError('');
    try {
      const res = await api.pauseOperations(pauseReason);
      if (res && res.success) {
        setOpsState(res.state);
        setShowPauseModal(false);
        setPauseReason('');
        if (onStateChange) onStateChange();
        fetchOperationsState();
      }
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleResumeCompanyOperations = async () => {
    setActionError('');
    try {
      const res = await api.resumeOperations('Resumed by administrator');
      if (res && res.success) {
        setOpsState(res.state);
        if (onStateChange) onStateChange();
        fetchOperationsState();
      }
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleSaveSalary = async () => {
    try {
      await api.configSalaries([{ role: salaryRole, amount: parseFloat(salaryAmount) }]);
      setShowSalaryForm(false);
      evaluateChecklist();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleSaveWallet = async () => {
    try {
      await api.configWallet(parseFloat(walletBalance));
      setShowWalletForm(false);
      evaluateChecklist();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleOpenChecklist = () => {
    evaluateChecklist();
    setShowChecklistModal(true);
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-900 border border-slate-800 rounded-xl p-6 h-28 w-full flex items-center justify-center">
        <span className="text-xs text-slate-500 font-mono">Syncing enterprise state engine...</span>
      </div>
    );
  }

  // Determine styling based on status
  const isSetup = opsState.status === 'Setup Mode';
  const isPaused = opsState.status === 'Paused';
  const isOperational = opsState.status === 'Operational Mode';

  let borderStyle = 'border-amber-500/30 bg-amber-950/10';
  let badgeStyle = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  if (isOperational) {
    borderStyle = 'border-emerald-500/30 bg-emerald-950/10';
    badgeStyle = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  } else if (isPaused) {
    borderStyle = 'border-rose-500/30 bg-rose-950/10';
    badgeStyle = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
  }

  return (
    <div id="company-operations-container" className="w-full flex flex-col gap-2">
      {/* Primary operations banner card */}
      <Card className={`relative overflow-hidden border p-4 transition-all duration-300 rounded-xl shadow-md backdrop-blur-md ${borderStyle}`}>
        {/* Glow effect at background */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full blur-2xl opacity-10 bg-primary-gold" />
        
        <div className="flex flex-col gap-3 z-10 relative">
          
          {/* Status block */}
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg border flex items-center justify-center shrink-0 ${
              isSetup ? 'bg-amber-500/15 border-amber-500/20 text-amber-500' :
              isPaused ? 'bg-rose-500/15 border-rose-500/20 text-rose-500' :
              'bg-emerald-500/15 border-emerald-500/20 text-emerald-500'
            }`}>
              <Activity className={`h-5 w-5 ${isOperational ? 'animate-pulse' : ''}`} />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted font-bold">
                  {lang === 'en' ? 'ENTERPRISE SYSTEM STATE' : 'TSARIN GUDANAR DA SASHIN AIKI'}
                </span>
                <span className={`px-2 py-0.2 rounded-full text-[8px] font-extrabold uppercase tracking-wider border ${badgeStyle}`}>
                  {opsState.status}
                </span>
              </div>
              <h3 className="text-sm font-black text-text-main tracking-tight mt-0.5">
                {isSetup && (lang === 'en' ? 'Setup & Staging Phase' : 'Matakin Shirya Kayan Aiki')}
                {isOperational && (lang === 'en' ? 'Live Fleet Operations Active' : 'Rukunin Keken Napep Na Kan Hanyar Aiki')}
                {isPaused && (lang === 'en' ? 'Corporate Suspension Active' : 'An Dakatar da Ayyuka Na Dan Lokaci')}
              </h3>
              <p className="text-[10px] text-text-muted max-w-sm leading-relaxed mt-0.5">
                {isSetup && (lang === 'en' ? 'Configure drivers, assign tricycles, and finalize wallet setups safely before live operations.' : 'Sanya direbobi, kekuna, da asusun wallet kafin a fara aiki.')}
                {isOperational && (lang === 'en' ? 'Auto remittance logs, fuel vouchers, and profit allocation models are fully live.' : 'Ana lissafin kudaden remittance da rabon riba na kwanaki 30 a raye.')}
                {isPaused && (lang === 'en' ? 'System locked. Installments are frozen and drivers cannot submit transactions.' : 'An dakatar da lissafi, sanya kudi, da duk wani aiki na asusu har sai an dawo da shi.')}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Action Area */}
          <div className="flex flex-col gap-2.5 w-full mt-1 border-t border-border-main/20 pt-2.5">
            
            {/* Operating Cycle stats */}
            {!isSetup && (
              <div className="grid grid-cols-2 gap-2 bg-card-bg/40 border border-border-main/30 rounded-lg py-1 px-3 text-center">
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-text-muted block font-semibold">{lang === 'en' ? 'Cycle' : 'Zagaye'}</span>
                  <div className="text-xs font-black text-text-main flex items-center justify-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-primary-gold" />
                    {opsState.currentCycle || 'N/A'}
                  </div>
                </div>
                <div className="border-l border-border-main/30 pl-2">
                  <span className="text-[8px] uppercase tracking-wider text-text-muted block font-semibold">{lang === 'en' ? 'Cycle Day' : 'Rana'}</span>
                  <span className="text-xs font-black text-text-main mt-0.5 block">
                    Day {opsState.currentDay || 1}/30
                  </span>
                </div>
              </div>
            )}

            {/* State Controls */}
            <div className="flex items-center justify-between gap-1.5 w-full">
              {isSetup && (
                <Button 
                  id="btn-start-ops"
                  onClick={handleOpenChecklist}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black flex items-center justify-center gap-1 py-2 rounded-lg shadow-sm transition-all duration-200 cursor-pointer text-[10px]"
                >
                  <Play className="h-3.5 w-3.5 fill-slate-950" />
                  {lang === 'en' ? 'Start Operations' : 'Fara Gudanarwa'}
                </Button>
              )}

              {isOperational && (
                <Button 
                  id="btn-pause-ops"
                  onClick={() => { setActionError(''); setShowPauseModal(true); }}
                  className="flex-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-600/30 font-bold flex items-center justify-center gap-1 py-2 rounded-lg cursor-pointer text-[10px]"
                >
                  <Pause className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Pause' : 'Dakatar'}
                </Button>
              )}

              {isPaused && (
                <Button 
                  id="btn-resume-ops"
                  onClick={handleResumeCompanyOperations}
                  className="flex-1 bg-emerald-500 text-slate-950 hover:bg-emerald-600 font-extrabold flex items-center justify-center gap-1 py-2 rounded-lg border-b border-emerald-700 cursor-pointer text-[10px]"
                >
                  <Play className="h-3.5 w-3.5 fill-slate-950" />
                  {lang === 'en' ? 'Resume' : 'Ci Gaba'}
                </Button>
              )}

              <Button 
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
                className="px-2 py-2 rounded-lg border border-border-main hover:bg-card-bg/80 text-text-muted font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <History className="h-3.5 w-3.5" />
                {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Small live metrics grid underneath for immediate visibility */}
        <div className="grid grid-cols-4 gap-1 border-t border-border-main/30 mt-2.5 pt-2 text-[10px] leading-tight">
          <div className="flex flex-col items-center justify-center p-1 bg-slate-500/5 rounded">
            <span className="text-[7px] uppercase text-text-muted font-bold block">{lang === 'en' ? 'Drivers' : 'Direbobi'}</span>
            <span className="text-xs font-black text-text-main">{metrics.totalDrivers || driversCount}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-1 bg-slate-500/5 rounded">
            <span className="text-[7px] uppercase text-text-muted font-bold block">{lang === 'en' ? 'Fleet' : 'Kekuna'}</span>
            <span className="text-xs font-black text-text-main">{metrics.totalTricycles || vehiclesCount}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-1 bg-slate-500/5 rounded">
            <span className="text-[7px] uppercase text-text-muted font-bold block">{lang === 'en' ? "Remits" : 'Remittance'}</span>
            <span className="text-xs font-black text-text-main">₦{(metrics.todayCollections || 0).toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-1 bg-slate-500/5 rounded">
            <span className="text-[7px] uppercase text-text-muted font-bold block">{lang === 'en' ? 'Health' : 'Lafiya'}</span>
            <span className="text-[10px] font-black text-cyan-500">{metrics.systemHealth}</span>
          </div>
        </div>
      </Card>

      {/* Expandable operations history log */}
      {showHistory && (
        <Card className="border border-border-main bg-card-bg/65 backdrop-blur-md rounded-xl p-5 shadow-inner animate-fadeIn">
          <div className="flex justify-between items-center pb-3 border-b border-border-main/50 mb-3">
            <h4 className="text-xs font-black text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-4 w-4 text-primary-gold" />
              {lang === 'en' ? 'Operations Audit Trail (Immutable)' : 'Tarihin Sauye-sauyen Aiki (Baya Goguwa)'}
            </h4>
            <span className="text-[10px] font-mono text-text-muted">ROOT_NODE_SECURE</span>
          </div>

          {(!opsState.auditLog || opsState.auditLog.length === 0) ? (
            <div className="text-center py-6 text-text-muted text-xs font-mono">
              {lang === 'en' ? 'No operational phase shifts recorded yet.' : 'Babu tarihin sauya matakin aiki tukunna.'}
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
              {opsState.auditLog.map((log: any, idx: number) => (
                <div key={log.id || idx} className="p-3 rounded-lg bg-bg-base/80 border border-border-main/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        log.action.includes('Start') ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25' :
                        log.action.includes('Pause') ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25' :
                        'bg-blue-500/10 text-blue-500 border border-blue-500/25'
                      }`}>
                        {log.action}
                      </span>
                      <span className="font-extrabold text-text-main">{log.user}</span>
                    </div>
                    <p className="text-text-muted mt-1 leading-normal italic">
                      "{log.reason}"
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-start sm:items-end gap-0.5 font-mono text-[10px] text-text-muted">
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    <span>IP: {log.ip || '127.0.0.1'} | {log.browser}</span>
                    <span className="text-[8px] truncate max-w-[150px]">{log.device}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
           {/* Streamlined Launch Activation Modal - No More Setup, only Start & End dates */}
      {showChecklistModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative flex flex-col">
            
            <div className="flex justify-between items-start pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <Play className="h-4.5 w-4.5 fill-amber-500 text-amber-500" />
                  {lang === 'en' ? 'Start Operating Cycle' : 'Fara Zagayen Aiki'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'en' ? 'Bypassing setup checklist. Ready to deploy live operations immediately.' : 'Tsallake matakan saiti. An shirya tsaf domin fara ayyuka.'}
                </p>
              </div>
              <button 
                onClick={() => { setShowChecklistModal(false); setActionError(''); }}
                className="text-slate-400 hover:text-slate-200 cursor-pointer text-xl"
              >
                &times;
              </button>
            </div>

            {actionError && (
              <div className="my-3 p-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs rounded-lg flex items-start gap-2 animate-shake">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Start and Scheduled End Dates display */}
            <div className="py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    {lang === 'en' ? 'START DATE' : 'RANAR FARA'}
                  </span>
                  <span className="font-extrabold text-amber-400 font-mono text-xs mt-1 block">
                    {new Date().toISOString().split('T')[0]}
                  </span>
                </div>
                
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    {lang === 'en' ? 'SCHEDULED END' : 'RANAR KAMMALAWA'}
                  </span>
                  <span className="font-extrabold text-emerald-400 font-mono text-xs mt-1 block">
                    {new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-[10px] text-slate-400 leading-normal">
                {lang === 'en' 
                  ? 'Confirming will activate real-time tracking, open the financial center ledger, and start the high-precision 30-day operating cycle timer instantly.'
                  : 'Tabbatarwa zai fara kidayar lokaci na kwanaki 30 da lissafin kudaden shiga nan take.'}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => { setShowChecklistModal(false); setActionError(''); }}
                className="px-3 py-1.5 border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer text-[11px]"
              >
                {lang === 'en' ? 'Cancel' : 'Soke'}
              </Button>
              <Button 
                onClick={handleStartCompanyOperations}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-black flex items-center gap-1 rounded shadow-lg border-b-2 border-emerald-700 cursor-pointer text-[11px]"
              >
                <Play className="h-3 w-3 fill-slate-950 text-slate-950" />
                {lang === 'en' ? 'Confirm & Start Live' : 'Tabbatar & Fara Aiki'}
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* Pause Operations Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
              <Pause className="h-5 w-5 text-rose-500" />
              {lang === 'en' ? 'Confirm Operations Suspension' : 'Dakatar da Gudanar da Kamfani'}
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              {lang === 'en' ? 'Suspension freezes installments, restricts new payouts, halts interest, and places a safety freeze across the system. Fully auditing-logged.' : 'Dakatarwa zai tsayar da duk wani lissafi da remittan kudi da sauran ayyuka na asusu.'}
            </p>

            {actionError && (
              <div className="my-3 p-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold mb-1">
                {lang === 'en' ? 'Reason for Suspension (Immutable Audited Comment)' : 'Dalilin Dakatarwa'}
              </label>
              <textarea 
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder={lang === 'en' ? "E.g., Mid-year financial alignment checks" : "Sanya takaitaccen dalili a nan"}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500 h-24"
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <Button 
                variant="outline" 
                onClick={() => { setShowPauseModal(false); setPauseReason(''); setActionError(''); }}
                className="px-4 py-2 border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer text-xs"
              >
                {lang === 'en' ? 'Cancel' : 'Soke'}
              </Button>
              <Button 
                onClick={handlePauseCompanyOperations}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-slate-100 font-extrabold rounded shadow-md cursor-pointer text-xs"
              >
                {lang === 'en' ? 'Suspend Operations' : 'Dakatar da Aiki'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
