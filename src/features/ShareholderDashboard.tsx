import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Tabs, Modal, Alert } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { compressImageFile } from '../utils/imageCompressor';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Wallet, 
  Layers, 
  Settings, 
  ArrowUpRight,
  PieChart,
  DollarSign,
  Activity,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Info,
  Users
} from 'lucide-react';
import { Shareholder, FinancialRecord } from '../types';

interface ShareholderDashboardProps {
  lang: 'en' | 'ha';
  dictionary: any;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export const ShareholderDashboard: React.FC<ShareholderDashboardProps & { authToken: string | null }> = ({ 
  lang, 
  dictionary,
  activeTab, 
  setActiveTab,
  authToken
}) => {
  const [shareholder, setShareholder] = useState<Shareholder | null>(null);
  const [calculations, setCalculations] = useState<any>(null);
  const [serverBalance, setServerBalance] = useState<{ availableBalance: number, totalEarned: number, totalWithdrawn: number } | null>(null);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  // Action states
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isCapOutOpen, setIsCapOutOpen] = useState(false);
  const [isReinvestOpen, setIsReinvestOpen] = useState(false);
  const [shActionAmount, setShActionAmount] = useState('');
  const [shActionLoading, setShActionLoading] = useState(false);
  const [shActionError, setShActionError] = useState('');
  const [shActionSuccess, setShActionSuccess] = useState('');

  // Financial values from server balance API
  const availableWithdrawable = serverBalance?.availableBalance || 0;
  const estimatedEarnings = serverBalance?.totalEarned || 0;
  const shTotalWithdrawn = serverBalance?.totalWithdrawnCash || serverBalance?.totalWithdrawn || 0;

  // Other financial metadata
  const totalInvested = shareholder?.investment_amount || (shareholder as any)?.investmentAmount || 0;
  const equityWeight = shareholder?.equity_percentage || 0;
  const shTotalReinvested = serverBalance?.totalReinvested || shareholder?.total_reinvested || 0;

  const fetchLedgerData = async () => {
    setLedgerLoading(true);
    try {
      const fin = await api.fetchShareholderLedger();
      setFinancials(fin || []);
    } catch (err) {
      console.error("Failed to fetch ledger data:", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const [res, balanceRes] = await Promise.all([
        api.getSelfShareholderData(),
        api.getShareholderBalance()
      ]);
      
      const sh = res.shareholder ? {
        ...res.shareholder,
        equity_percentage: res.calculations?.investmentPercentage ?? res.shareholder.equity_percentage ?? 0
      } : res;
      setShareholder(sh);
      if (res.calculations) {
        setCalculations(res.calculations);
      }
      if (balanceRes) {
        setServerBalance(balanceRes);
      }
      await fetchLedgerData();
    } catch (err: any) {
      console.error("Failed to fetch shareholder data:", err);
      setGlobalError(err.message || "Failed to synchronize financial data with server. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageFile(file, 800, 800, 0.75);
      // Optimistically update UI state immediately with new image URL
      setShareholder((prev: any) => prev ? {
        ...prev,
        passportPhoto: base64,
        passport_photo_url: base64,
        passportPhotoUrl: base64,
        avatar: base64
      } : prev);

      const res = await api.request('/api/shareholders/self', {
        method: 'PUT',
        body: JSON.stringify({ passportPhoto: base64 })
      });

      if (res && res.success) {
        if (res.shareholder) {
          setShareholder((prev: any) => prev ? { ...prev, ...res.shareholder } : res.shareholder);
        }
        window.dispatchEvent(new CustomEvent('db-change'));
      } else {
        console.error("Failed to update passport photo on server:", res?.error);
      }
    } catch (err: any) {
      console.error("Error uploading passport photo:", err?.message || err);
    }
  };

  // Dedicated effect to fetch fresh data when authToken changes
  useEffect(() => {
    if (authToken) {
      fetchData();
    }
  }, [authToken]);

  // Specific effect for ledger mount
  useEffect(() => {
    fetchLedgerData();
  }, []);

  useEffect(() => {
    // SSE connection for real-time updates
    const token = api.getToken();
    let es: EventSource | null = null;
    if (token) {
      try {
        es = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
        es.onopen = () => setSseConnected(true);
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'db_update') {
              if (data.shareholders) {
                // Find self in shareholders list
                const me = data.shareholders.find((s: any) => s.email && shareholder?.email && s.email.toLowerCase() === shareholder.email.toLowerCase()) || data.shareholders.find((s: any) => s.equity_percentage !== undefined);
                if (me) setShareholder(me);
              }
              if (data.financials) setFinancials(data.financials);
            }
          } catch (err) {
            console.error("SSE parse error:", err);
          }
        };
        es.onerror = () => setSseConnected(false);
      } catch (e) {
        console.warn("SSE not supported");
      }
    }

    return () => {
      es?.close();
    };
  }, []);

  if (loading && !shareholder) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  const renderOverview = () => {
    if (!shareholder) return null;

    // Financial metadata
    const totalInvested = shareholder.investment_amount || (shareholder as any).investmentAmount || 0;
    const equityWeight = shareholder.equity_percentage || 0;
    const shTotalReinvested = shareholder.total_reinvested || 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Shareholder Identity Card (Passport Card) */}
          <Card className="lg:col-span-1 p-0 overflow-hidden hover:shadow-2xl transition-all duration-500 border-slate-200/60 flex flex-col h-full bg-white">
            <div className="p-5 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="success" className="font-mono text-[10px] font-black uppercase px-3 py-1">
                  {(Number(equityWeight) || 0).toFixed(2)}% Stake
                </Badge>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="flex items-center gap-4">
                <div className="relative shrink-0 group">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="h-20 w-20 rounded-full border-2 border-white shadow-xl overflow-hidden bg-slate-900 flex items-center justify-center relative"
                  >
                     {(() => {
                       const shUrl = shareholder.passport_photo_url || shareholder.passportPhoto || shareholder.passport_photo || shareholder.passport || shareholder.avatar || '';
                       const cleanUrl = shUrl;
                       return cleanUrl ? (
                         <img 
                           src={cleanUrl} 
                           alt={shareholder.full_name} 
                           className="h-full w-full object-cover"
                           referrerPolicy="no-referrer"
                           onError={(e: any) => {
                             e.target.style.display = 'none';
                             e.target.nextElementSibling?.classList.remove('hidden');
                           }}
                         />
                       ) : null;
                     })()}
                     <div className={`flex flex-col items-center justify-center bg-slate-900 text-brand-gold font-black text-sm h-full w-full ${(() => {
                       const shUrl = shareholder.passport_photo_url || shareholder.passportPhoto || shareholder.passport_photo || shareholder.passport || shareholder.avatar || '';
                       return shUrl ? 'hidden' : '';
                     })()}`}>
                       <span className="text-sm font-bold text-brand-gold mt-0.5">{(shareholder.full_name || 'SH').substring(0, 2).toUpperCase()}</span>
                     </div>
                  </motion.div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-900 text-lg tracking-tight truncate">{shareholder.full_name}</h4>
                  <p className="text-xs text-slate-500 font-medium truncate">{shareholder.email}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600 uppercase tracking-tighter">ID: {shareholder.id ? `RTL-SH-${shareholder.id.substring(0,4).toUpperCase()}` : 'RTL-SH-88'}</div>
                    <div className="px-2 py-0.5 bg-brand-gold/10 rounded text-[9px] font-bold text-brand-gold uppercase tracking-tighter">Active Node</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Passport / NIN</span>
                  <span className="text-[11px] font-bold text-slate-700 font-mono truncate block">{(shareholder as any).passport_number || (shareholder as any).passport || (shareholder as any).nin || (shareholder as any).passportNumber || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Phone</span>
                  <span className="text-[11px] font-bold text-slate-700 truncate block">{shareholder.phone}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide block">Investor Passport Photo</span>
                  <span className="text-[9px] text-slate-500 block">Upload real passport photograph</span>
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="shareholder-passport-upload-input" 
                    className="hidden" 
                    onChange={handlePassportUpload} 
                  />
                  <Button 
                    type="button"
                    size="sm" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      document.getElementById('shareholder-passport-upload-input')?.click();
                    }}
                    className="bg-brand-gold hover:bg-amber-400 text-slate-950 font-bold text-[10px] py-1 px-2 h-7 cursor-pointer"
                  >
                    {lang === 'en' ? "Upload 📷" : "Sanya 📷"}
                  </Button>
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl relative overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 w-20 h-20 bg-brand-gold/10 rounded-full blur-2xl -mr-10 -mt-10" />
                <label className="text-[10px] font-black text-brand-gold uppercase tracking-widest block mb-1">Available Dividend</label>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white font-mono">₦{availableWithdrawable.toLocaleString()}</span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter">Ready</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-2 border-t border-slate-100 font-mono text-[10px]">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Reinvested</span>
                  <span className="text-[11px] font-bold text-slate-700">₦{shTotalReinvested.toLocaleString()}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Withdrawn</span>
                  <span className="text-[11px] font-bold text-slate-700">₦{shTotalWithdrawn.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Actions Section - Mobile Responsive & Animated */}
            <div className="p-4 bg-slate-50 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-100">
              <Button
                variant="primary"
                disabled={availableWithdrawable <= 0}
                onClick={() => {
                  setShActionAmount(availableWithdrawable.toString());
                  setIsWithdrawOpen(true);
                }}
                className="w-full font-black bg-brand-gold hover:bg-amber-500 text-slate-900 py-3 sm:py-2 text-[11px] sm:text-[9px] uppercase border-none shadow-sm h-auto transition-all hover:scale-[1.02] active:scale-95"
              >
                Withdraw
              </Button>

              <Button
                variant="outline"
                disabled={totalInvested <= 0}
                onClick={() => {
                  setShActionAmount(totalInvested.toString());
                  setIsCapOutOpen(true);
                }}
                className="w-full font-black border-rose-200 text-rose-700 hover:bg-rose-50 py-3 sm:py-2 text-[11px] sm:text-[9px] uppercase h-auto transition-all hover:scale-[1.02] active:scale-95"
              >
                Cap. Out
              </Button>

              <Button
                variant="outline"
                disabled={availableWithdrawable <= 0}
                onClick={() => setIsReinvestOpen(true)}
                className="w-full font-black border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white py-3 sm:py-2 text-[11px] sm:text-[9px] uppercase h-auto transition-all hover:scale-[1.02] active:scale-95"
              >
                Reinvest
              </Button>
            </div>
          </Card>

          {/* Right Column: Financial Summaries */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-brand-navy text-white overflow-hidden relative shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <TrendingUp className="h-24 w-24" />
                </div>
                <CardContent className="pt-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {lang === 'en' ? "Capital Stock (Principal)" : "Jarin da aka Saka"}
                  </p>
                  <h3 className="text-3xl font-black mt-1 text-brand-gold font-mono">
                    ₦{totalInvested.toLocaleString()}
                  </h3>
                  <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>Active Investment Node</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-slate-200/60 bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {lang === 'en' ? "Total Accumulated Earnings" : "Ribar da aka samu"}
                      </p>
                      <h3 className="text-xl font-black mt-1 text-slate-900 font-mono">
                        ₦{estimatedEarnings.toLocaleString()}
                      </h3>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                      <PieChart className="h-7 w-7" />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                    <span>Pool Share: 2.0%</span>
                    <span>Last Update: Today</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-lg border-slate-200/60 bg-white h-full">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
                    <Wallet className="h-4 w-4 text-brand-gold" />
                    {lang === 'en' ? "Distribution Logs" : "Raba Ribar Kwanan Nan"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {financials.filter(f => f.type === 'revenue').slice(0, 4).map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 transition-hover hover:bg-white hover:shadow-sm">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-900 truncate uppercase">{f.description}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{new Date(f.date).toLocaleDateString()}</p>
                        </div>
                        <span className="text-[11px] font-black text-emerald-600 font-mono ml-2 shrink-0">+₦{(f.amount * (equityWeight / 100)).toLocaleString()}</span>
                      </div>
                    ))}
                    {financials.length === 0 && (
                      <p className="text-center py-10 text-xs text-slate-400 font-medium italic">
                        {lang === 'en' ? "No distributions recorded in current cycle." : "Ba a raba riba ba tukunna."}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-slate-200/60 bg-white h-full">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
                    <Activity className="h-4 w-4 text-brand-gold" />
                    {lang === 'en' ? "Operational Telemetry" : "Yanayin Aiki"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="p-4 bg-slate-900 rounded-2xl text-white relative overflow-hidden">
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-brand-gold/5 rounded-full blur-xl" />
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{lang === 'en' ? "Active Cycle" : "Tsarin Aiki"}</span>
                      <Badge variant="success" className="text-[9px] font-black">ACTIVE</Badge>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] font-black uppercase">
                        <span>{lang === 'en' ? "Progress to Goal" : "Tafiya zuwa Burinmu"}</span>
                        <span className="text-brand-gold">75%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-brand-gold rounded-full" 
                          initial={{ width: 0 }}
                          animate={{ width: "75%" }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-500 leading-relaxed italic">
                        Current logistics efficiency index is optimized for high-frequency urban dispatch.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Financial Handlers
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareholder) return;
    setShActionLoading(true);
    setShActionError('');
    try {
      await api.postShareholderWithdrawal({
        shareholderId: shareholder.id,
        amount: parseFloat(shActionAmount)
      });
      setShActionSuccess(lang === 'en' ? `Withdrawal of ₦${parseFloat(shActionAmount).toLocaleString()} initialized successfully.` : `An fara cire ₦${parseFloat(shActionAmount).toLocaleString()} cikin nasara.`);
      setTimeout(() => setIsWithdrawOpen(false), 2000);
      fetchData();
    } catch (err: any) {
      setShActionError(err.message || "Failed to process withdrawal.");
    } finally {
      setShActionLoading(false);
    }
  };

  const handleCapOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareholder) return;
    setShActionLoading(true);
    setShActionError('');
    try {
      await api.postShareholderCapOut({
        shareholderId: shareholder.id,
        amount: parseFloat(shActionAmount)
      });
      setShActionSuccess(lang === 'en' ? `Capital Redemption of ₦${parseFloat(shActionAmount).toLocaleString()} initialized.` : `An fara cire jarin ₦${parseFloat(shActionAmount).toLocaleString()}.`);
      setTimeout(() => setIsCapOutOpen(false), 2000);
      fetchData();
    } catch (err: any) {
      setShActionError(err.message || "Failed to process capital redemption.");
    } finally {
      setShActionLoading(false);
    }
  };

  const handleReinvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareholder) return;
    setShActionLoading(true);
    setShActionError('');
    try {
      await api.postShareholderReinvestment({
        shareholderId: shareholder.id,
        amount: parseFloat(shActionAmount)
      });
      setShActionSuccess(lang === 'en' ? `Reinvestment of ₦${parseFloat(shActionAmount).toLocaleString()} confirmed.` : `An tabbatar da sake zuba jarin ₦${parseFloat(shActionAmount).toLocaleString()}.`);
      setTimeout(() => setIsReinvestOpen(false), 2000);
      fetchData();
    } catch (err: any) {
      setShActionError(err.message || "Failed to reinvest dividends.");
    } finally {
      setShActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 bg-bg-base min-h-screen">
      {globalError && (
        <div className="mb-4">
          <Alert type="danger">{globalError}</Alert>
        </div>
      )}
      {shActionSuccess && (
        <div className="fixed top-20 right-4 z-[60] animate-bounce">
          <Alert type="success">{shActionSuccess}</Alert>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            {lang === 'en' ? "Investor Command" : "Bangaren Masu Hannun Jari"}
          </h1>
          <p className="text-sm text-slate-500">
            {lang === 'en' ? "Managing assets for shareholder:" : "Kula da jarin:"} <span className="font-bold text-slate-900">{shareholder?.full_name || shareholder?.name || 'N/A'}</span>
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`h-1.5 w-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              {sseConnected ? (lang === 'en' ? 'Live Synchronized' : 'An Haɗa') : (lang === 'en' ? 'Offline/Polling' : 'Ba a haɗa ba')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-sm">
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase">Stake weight</span>
               <span className="text-xs font-black text-slate-900">{shareholder?.equity_percentage || 0}%</span>
             </div>
             <div className="w-px h-6 bg-slate-100" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase">Node Status</span>
               <span className="text-[9px] font-bold text-emerald-500 uppercase">Authenticated</span>
             </div>
          </div>
        </div>
      </div>

      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: lang === 'en' ? "Overview" : "Bayanai", icon: <Layers className="h-4 w-4" /> },
          { id: 'ledger', label: lang === 'en' ? "Ledger" : "Bilan", icon: <Wallet className="h-4 w-4" /> },
          { id: 'cycles', label: lang === 'en' ? "Business Cycles" : "Tsarin Aiki", icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'settings', label: lang === 'en' ? "Settings" : "Kula da Akun", icon: <Settings className="h-4 w-4" /> },
        ]}
      />

      <div className="mt-2">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab !== 'overview' && (
          <div className="p-20 bg-white rounded-3xl border border-slate-200 text-center shadow-xs">
            <Activity className="h-12 w-12 text-brand-gold mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              {lang === 'en' ? "Secure Module Restricted" : "Wannan Bangaren Yana Gyara"}
            </h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              We are currently optimizing the <strong>{activeTab}</strong> module for high-frequency financial auditing. Please check back shortly for updated telemetry.
            </p>
            <Button 
              onClick={() => setActiveTab('overview')}
              className="mt-6 bg-brand-gold text-slate-950 hover:bg-yellow-500 font-bold"
            >
              {lang === 'en' ? "Return to Overview" : "Koma Babban Shafin"}
            </Button>
          </div>
        )}
      </div>

      {/* MODALS: SHAREHOLDER ACTIONS */}
      <Modal 
        isOpen={isWithdrawOpen} 
        onClose={() => setIsWithdrawOpen(false)} 
        title={lang === 'en' ? "Withdraw Dividends" : "Cire Riba"}
      >
        <form onSubmit={handleWithdraw} className="space-y-4">
          {shActionError && <Alert type="danger">{shActionError}</Alert>}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
             <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Available</span>
             <span className="text-xl font-black text-slate-900 font-mono">₦{availableWithdrawable.toLocaleString()}</span>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Amount to Withdraw (₦)</label>
            <input 
              type="number"
              value={shActionAmount}
              onChange={(e) => setShActionAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex gap-3">
             <Button type="button" variant="outline" onClick={() => setIsWithdrawOpen(false)} className="flex-1">Cancel</Button>
             <Button type="submit" variant="secondary" isLoading={shActionLoading} className="flex-1">Request Funds</Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isCapOutOpen} 
        onClose={() => setIsCapOutOpen(false)} 
        title={lang === 'en' ? "Capital Stock Redemption" : "Cire Jari"}
      >
        <form onSubmit={handleCapOut} className="space-y-4">
          {shActionError && <Alert type="danger">{shActionError}</Alert>}
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
             <span className="text-[10px] font-black text-rose-400 uppercase block mb-1">Current Capital Stock</span>
             <span className="text-xl font-black text-rose-900 font-mono">₦{shareholder?.investment_amount?.toLocaleString() || '0'}</span>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
             <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
             <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
               Redeeming capital stock reduces your ownership weight in Ruqayya Transport instantly. Partial redemptions are processed within 72 hours.
             </p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Redemption Amount (₦)</label>
            <input 
              type="number"
              value={shActionAmount}
              onChange={(e) => setShActionAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex gap-3">
             <Button type="button" variant="outline" onClick={() => setIsCapOutOpen(false)} className="flex-1">Cancel</Button>
             <Button type="submit" variant="danger" isLoading={shActionLoading} className="flex-1">Confirm Redemption</Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isReinvestOpen} 
        onClose={() => setIsReinvestOpen(false)} 
        title={lang === 'en' ? "Reinvest Earnings" : "Sake Zuba Jari"}
      >
        <form onSubmit={handleReinvest} className="space-y-4">
          {shActionError && <Alert type="danger">{shActionError}</Alert>}
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
             <span className="text-[10px] font-black text-emerald-400 uppercase block mb-1">Withdrawable Earnings</span>
             <span className="text-xl font-black text-emerald-900 font-mono">₦{availableWithdrawable.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
             <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
             <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
               Reinvesting transfers dividends directly into your Capital Stock, increasing your equity stake and future earnings potential.
             </p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Amount to Reinvest (₦)</label>
            <input 
              type="number"
              value={shActionAmount}
              onChange={(e) => setShActionAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex gap-3">
             <Button type="button" variant="outline" onClick={() => setIsReinvestOpen(false)} className="flex-1">Cancel</Button>
             <Button type="submit" variant="primary" isLoading={shActionLoading} className="flex-1 bg-brand-navy text-white">Authorize Reinvestment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
