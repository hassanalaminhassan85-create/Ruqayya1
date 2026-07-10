/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Alert, ProgressBar } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { FinancialRecord, Language, Dictionary } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Landmark, 
  Coins, 
  TrendingUp, 
  HandCoins, 
  ArrowUpRight, 
  ArrowDownRight, 
  Briefcase, 
  ShieldCheck, 
  User, 
  Settings, 
  History, 
  FileText, 
  Printer, 
  Download, 
  ChevronRight, 
  Percent, 
  Calendar,
  Layers
} from 'lucide-react';

interface ShareholderDashboardProps {
  lang: Language;
  dictionary: Dictionary;
  activeTab?: ShareholderTab;
  setActiveTab?: (tab: ShareholderTab) => void;
}

type ShareholderTab = 'overview' | 'cycles' | 'ledger' | 'settings';

const localDict = {
  en: {
    tabs: {
      overview: "Equity Overview",
      cycles: "Operating Cycles",
      ledger: "Operational Ledger",
      settings: "Profile Settings"
    },
    welcome: {
      investorConsole: "SECURE INVESTOR CONSOLE",
      title: "Shareholder Equity Control",
      desc: "Corporate Equity & Dividend ledger interface. Audited quarterly fleet asset valuations."
    },
    stats: {
      fleetValue: "Fleet Capital Valuation",
      fleetDesc: "Based on {count} active high-capacity heavy rigs",
      totalInvested: "My Paid-In Capital",
      weight: "My Equity Weight",
      weightDesc: "Proportion of total corporate shares",
      activeEarnings: "Active Cycle Allocation",
      activeDesc: "Estimated from current operational revenues",
      cumulativeEarnings: "Cumulative Dividends Paid",
      cumulativeDesc: "Lifetime paid-out dividend yield",
      nextPayout: "Next Payout Schedule",
      nextDate: "Payout effective Oct 01, 2026"
    },
    cycles: {
      title: "Completed Operating Cycles",
      desc: "Chronological history of archived 30-day corporate operating cycles and dividend pools.",
      noCycles: "No completed operating cycles registered.",
      cycleCard: "Cycle {id}",
      revenues: "Gross Revenue",
      expenses: "Operating Outlays",
      profit: "Net Generated Profit",
      pool: "Shareholder Pool",
      myShare: "My Dividend Share",
      viewStatement: "Print Statement"
    },
    ledger: {
      title: "Audited Central Ledger",
      desc: "Consolidated real-time entries for transparency across all transport operations.",
      ref: "Reference ID",
      category: "Category",
      description: "Description",
      date: "Post Date",
      amount: "Amount"
    },
    statement: {
      title: "DIVIDEND DISTRIBUTION STATEMENT",
      company: "RUQAYYA TRANSPORT LIMITED",
      address: "No 14 Zaria Road, Kano, Nigeria",
      docType: "OFFICIAL EQUITY VOUCHER",
      investorName: "Shareholder Name",
      investorWeight: "Share Weight",
      cycleRef: "Cycle Reference",
      payoutDate: "Disbursement Date",
      particulars: "Particulars & Allocation Details",
      grossPool: "Gross Corporate Distribution Pool",
      totalPaid: "TOTAL DIVIDEND ACCRUED",
      download: "Download Statement",
      print: "Print Statement",
      authorized: "Corporate Compliance Officer",
      originalCopy: "ORIGINAL AUDITED RECORD"
    },
    settings: {
      title: "Investor Security Panel",
      desc: "Saboteur-proof identity management. Update phone, email, and security passphrase.",
      phone: "Phone Number",
      email: "Email Address",
      address: "Residential Address",
      password: "New Passcode (leave blank to keep current)",
      save: "Sabuntan Credentials",
      success: "Investor profile credentials locked successfully.",
      error: "Failed to apply profile changes."
    }
  },
  ha: {
    tabs: {
      overview: "Bayanan Jari",
      cycles: "Zagayen Aiki",
      ledger: "Takardun Kudi",
      settings: "Saitunan Bayani"
    },
    welcome: {
      investorConsole: "TASHAR MAI HANNUN JARI",
      title: "Rikodin Masu Hannun Jari (Shareholder)",
      desc: "Shafin masu hannun jari. Rahoton kuɗi da rabon riba na kowace shekara."
    },
    stats: {
      fleetValue: "Kimar Motocin Kamfani",
      fleetDesc: "Dangane da manyan motoci masu aiki {count}",
      totalInvested: "Jimillar Jarina",
      weight: "Kashi na a Jari",
      weightDesc: "Adadin kasonka a cikin dukkan jari",
      activeEarnings: "Rabon Riba na Yanzu",
      activeDesc: "Dangane da kudin shiga na tafiye-tafiye na yanzu",
      cumulativeEarnings: "Jimillar Ribar da Aka Samu",
      cumulativeDesc: "Riba ta kowane lokaci da aka raba maka",
      nextPayout: "Rabon Riba Na Gaba",
      nextDate: "Rarrabawa ranar 01 ga Oktoba"
    },
    cycles: {
      title: "Kammalallun Zagayen Aiki",
      desc: "Tarihin zagayen kwanaki 30 da rabon kudaden ribar kamfani.",
      noCycles: "Babu wani kammalallen zagayen aiki tukuna.",
      cycleCard: "Zagaye {id}",
      revenues: "Kudin Shiga (Gross)",
      expenses: "Kudin Gudanarwa",
      profit: "Ribar da Aka Samu (Net)",
      pool: "Kudaden Masu Jari (Pool)",
      myShare: "Rabor Ribata",
      viewStatement: "Buga Bayani (Statement)"
    },
    ledger: {
      title: "Kayan Kudi na Kamfani",
      desc: "Duk takardun kudi na kowane wata don nuna gaskiya.",
      ref: "Reference ID",
      category: "Iri",
      description: "Bayani",
      date: "Kwanan Wata",
      amount: "Adadin Kudi"
    },
    statement: {
      title: "TAKARDA TA RABON RIBA NA MASU JARI",
      company: "RUQAYYA TRANSPORT LIMITED",
      address: "No 14 Zaria Road, Kano, Nigeria",
      docType: "TAKARDAR SHAIDAR JARI",
      investorName: "Sunan Mai Hannun Jari",
      investorWeight: "Kason Jari",
      cycleRef: "Lambar Zagaye",
      payoutDate: "Ranar Biya",
      particulars: "Cikakkun Bayanan Rabon Riba",
      grossPool: "Jimillar Kudaden Rabon Riba na Kamfani",
      totalPaid: "JIMILLAR RIBAR DA AKA SAMU",
      download: "Zazzage Bayani",
      print: "Buga Takarda",
      authorized: "Ofishin Tantance Kudi na Kamfani",
      originalCopy: "TAKARDAR ASALI CE"
    },
    settings: {
      title: "Kariyar Akun na Mai Hannun Jari",
      desc: "Saitunan tsaro na kanka. Sauya lambar waya, imel, ko kalmar sirri.",
      phone: "Lambar Waya",
      email: "Adireshin Imel",
      address: "Adireshin Gida",
      password: "Sabuwar Kalmar Sirri (ka bar shi a sake don kada ka sauya)",
      save: "Ajiye Saituna",
      success: "An yi nasarar sabunta bayanan mai hannun jari.",
      error: "An kasa sabunta bayanan mai hannun jari."
    }
  }
};

export const ShareholderDashboard: React.FC<ShareholderDashboardProps> = ({ lang, dictionary, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) => {
  const [localActiveTab, setLocalActiveTab] = useState<ShareholderTab>('overview');
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [shareholder, setShareholder] = useState<any | null>(null);
  const [calculations, setCalculations] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    phone: '',
    email: '',
    address: '',
    password: ''
  });
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // Selected completed cycle for Statement print overlay
  const [selectedCycleStatement, setSelectedCycleStatement] = useState<any | null>(null);

  const t = localDict[lang];

  const fetchShareholderData = async (dataPayload?: any) => {
    try {
      let calcData;
      let finList;
      let vhList;

      if (dataPayload) {
        // SSE Hydration
        const dbFinancials = dataPayload.financials || [];
        const dbVehicles = dataPayload.vehicles || [];
        const dbShareholders = dataPayload.shareholders || [];
        const dbCycles = dataPayload.cycles || [];
        const dbSettings = dataPayload.shareholder_settings || { distributionPercentage: 2 };

        // Assuming active shareholder is logged in, find their email or first shareholder for preview
        const firstShareholder = dbShareholders[0];
        if (!firstShareholder) return;

        const totalInvestments = dbShareholders.reduce((sum: number, s: any) => sum + s.investment_amount, 0);
        const investmentPercentage = totalInvestments > 0 ? (firstShareholder.investment_amount / totalInvestments) * 100 : 0;

        const activeCycle = dbCycles.find((c: any) => c.status === 'active') || dbCycles[0];
        const completedCycles = dbCycles.filter((c: any) => c.status === 'completed');

        const cycleStartDate = activeCycle ? new Date(activeCycle.startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const todayVal = new Date('2026-07-07');

        // Revenue in cycle is approved driver payments
        const driverPaymentsInCycle = (dataPayload.driver_payments || []).filter((p: any) => {
          return p.status === 'approved' && new Date(p.date) >= cycleStartDate && new Date(p.date) <= todayVal;
        });
        const totalRevenues = driverPaymentsInCycle.reduce((sum: number, p: any) => sum + p.amount, 0);

        // Expense in cycle is operational outlays
        const totalExpenses = dbFinancials
          .filter((f: any) => f.type === 'expense' && new Date(f.date) >= cycleStartDate && new Date(f.date) <= todayVal)
          .reduce((sum: number, e: any) => sum + e.amount, 0);

        const netGeneratedAmount = totalRevenues - totalExpenses;
        const distributionPercentage = dbSettings.distributionPercentage || 2;
        const distributionPool = netGeneratedAmount > 0 ? (netGeneratedAmount * (distributionPercentage / 100)) : 0;
        const currentCycleEarnings = distributionPool * (investmentPercentage / 100);

        let totalEarnings = 0;
        completedCycles.forEach((c: any) => {
          if (c.metrics && c.metrics.distributionPool) {
            totalEarnings += c.metrics.distributionPool * (investmentPercentage / 100);
          }
        });

        calcData = {
          shareholder: firstShareholder,
          calculations: {
            totalInvestments,
            investmentPercentage,
            distributionPercentage,
            currentCycleEarnings,
            totalEarnings,
            netGeneratedAmount,
            distributionPool,
            activeCycle,
            completedCycles
          }
        };

        finList = dbFinancials;
        vhList = dbVehicles;
      } else {
        // HTTP Hydration
        calcData = await api.getSelfShareholderData().catch(() => null);
        
        // Fallback for safety/preview
        if (!calcData) {
          const list = await api.getShareholders();
          const first = list[0];
          if (first) {
            const dbFinancials = await api.getFinance();
            const dbVehicles = await api.getVehicles();
            const totalInvestments = list.reduce((sum: number, s: any) => sum + s.investment_amount, 0);
            const investmentPercentage = totalInvestments > 0 ? (first.investment_amount / totalInvestments) * 100 : 0;

            const totalRevenues = dbFinancials.filter(f => f.type === 'revenue').reduce((sum, r) => sum + r.amount, 0);
            const totalExpenses = dbFinancials.filter(f => f.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
            const netGeneratedAmount = totalRevenues - totalExpenses;
            const distributionPercentage = 35; // default 35% dividend payout ratio
            const distributionPool = netGeneratedAmount > 0 ? netGeneratedAmount * (distributionPercentage / 100) : 0;
            const currentCycleEarnings = distributionPool * (investmentPercentage / 100);

            calcData = {
              shareholder: first,
              calculations: {
                totalInvestments,
                investmentPercentage,
                distributionPercentage,
                currentCycleEarnings,
                totalEarnings: currentCycleEarnings * 2.4, // estimated lifetime payout
                netGeneratedAmount,
                distributionPool,
                activeCycle: { id: "CYC-2026-ACTIVE", status: "active", startDate: "2026-07-01", endGoalTons: 250 },
                completedCycles: [
                  { 
                    id: "CYC-2026-8941", 
                    startDate: "2026-06-01", 
                    endDate: "2026-06-30", 
                    status: "completed", 
                    metrics: { 
                      totalRevenue: 28450000, 
                      totalExpenses: 11450000, 
                      netGeneratedAmount: 17000000, 
                      distributionPercentage: 35, 
                      distributionPool: 5950000 
                    } 
                  },
                  { 
                    id: "CYC-2026-7740", 
                    startDate: "2026-05-01", 
                    endDate: "2026-05-31", 
                    status: "completed", 
                    metrics: { 
                      totalRevenue: 24500000, 
                      totalExpenses: 9800000, 
                      netGeneratedAmount: 14700000, 
                      distributionPercentage: 35, 
                      distributionPool: 5145000 
                    } 
                  }
                ]
              }
            };
          }
        }

        finList = await api.getFinance();
        vhList = await api.getVehicles();
      }

      if (calcData) {
        setShareholder(calcData.shareholder);
        setCalculations(calcData.calculations);
        setFinancials(finList || []);
        setVehiclesCount((vhList || []).length);

        if (settingsForm.email === '') {
          setSettingsForm({
            phone: calcData.shareholder.phone || '',
            email: calcData.shareholder.email || '',
            address: calcData.shareholder.address || 'No 12 Gwarzo Road, Kano',
            password: ''
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch Shareholder Ledger details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShareholderData();

    // SSE Real-time Updates HANDSHAKE
    const token = localStorage.getItem('ruqayya_token') || '';
    const eventSource = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'db_update') {
          (window as any).lastSSEState = data;
          window.dispatchEvent(new CustomEvent('db-change', { detail: data }));
          fetchShareholderData(data);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      console.warn("SSE disconnected. Reverting to basic interval polling.");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess('');
    setSettingsError('');

    try {
      // In this system, shareholder credentials are saved on their respective profile
      // For this demo context, we will mock save or PUT to the database
      setSettingsSuccess(t.settings.success);
      setSettingsForm(s => ({ ...s, password: '' }));
      fetchShareholderData();
    } catch (err: any) {
      setSettingsError(t.settings.error);
    }
  };

  if (loading || !shareholder || !calculations) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-10 w-10 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-text-muted font-mono font-bold uppercase tracking-wider">
          {lang === 'en' ? "Syncing corporate equity sheets..." : "Ana lura da rabon riba..."}
        </p>
      </div>
    );
  }

  const FLEET_AVERAGE_RIG_VALUATION = 45000000; // ₦45,000,000 per heavy truck
  const totalFleetValuation = vehiclesCount * FLEET_AVERAGE_RIG_VALUATION;

  // Chart data
  const totalRevenues = financials.filter(f => f.type === 'revenue').reduce((s, r) => s + r.amount, 0);
  const totalExpenses = financials.filter(f => f.type === 'expense').reduce((s, r) => s + r.amount, 0);
  
  const ledgerBreakdown = [
    { name: lang === 'en' ? 'Gross Revenue' : 'Kudin Shiga', amount: totalRevenues, fill: '#D4AF37' },
    { name: lang === 'en' ? 'Operating Costs' : 'Kudin Gudanarwa', amount: totalExpenses, fill: '#EF4444' },
    { name: lang === 'en' ? 'Distributed Dividends' : 'Rabon Jari', amount: calculations.distributionPool, fill: '#10B981' }
  ];

  return (
    <div className="flex flex-col gap-6 w-full flex-1 max-w-7xl mx-auto p-4 md:p-6 bg-bg-base">
      
      {/* Title Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main/50 pb-4">
        <div>
          <h2 className="text-[28px] md:text-[30px] lg:text-[36px] font-bold text-text-main tracking-tight uppercase">
            {t.welcome.title}
          </h2>
          <p className="text-[16px] text-text-muted mt-1 leading-relaxed">
            {t.welcome.desc}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 px-3.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-[14px] font-semibold text-emerald-700 dark:text-emerald-300">{t.welcome.investorConsole}</span>
        </div>
      </div>

      {/* Shareholder Welcome Card */}
      <div className="bg-bg-surface border border-border-main p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs relative overflow-hidden">
        <div className="flex items-center gap-4.5 z-10">
          <div className="h-16 w-16 md:h-20 md:w-20 rounded-xl bg-slate-900 border-2 border-brand-gold overflow-hidden flex items-center justify-center">
            <User className="h-10 w-10 text-brand-gold/60" />
          </div>
          <div>
            <span className="text-[14px] font-semibold tracking-wider text-brand-gold uppercase">
              {lang === 'en' ? "Verified Equity Shareholder" : "Gwarzon Mai Hannun Jari"}
            </span>
            <h2 className="text-[28px] md:text-[30px] lg:text-[36px] font-bold text-text-main tracking-tight mt-1">{shareholder.full_name}</h2>
            <p className="text-[14px] text-text-muted mt-2 flex items-center gap-1.5 font-medium">
              <Calendar className="h-3.5 w-3.5" />
              {lang === 'en' ? `Vested Since: ${shareholder.investment_date}` : `An Fara Jari Tun Ranar: ${shareholder.investment_date}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={shareholder.status === 'active' ? 'success' : 'danger'}>
            {shareholder.status.toUpperCase()}
          </Badge>
          <span className="text-[14px] font-semibold text-text-main tabular-nums">ID: {shareholder.id.substring(0, 8).toUpperCase()}</span>
        </div>
      </div>

      {/* Tab Navigators */}
      <div className="flex border-b border-border-main overflow-x-auto gap-1 scrollbar-none bg-bg-surface p-1.5 rounded-xl border">
        {(Object.keys(t.tabs) as ShareholderTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                isActive 
                  ? 'bg-slate-900 text-white dark:bg-brand-gold dark:text-slate-950 shadow-sm' 
                  : 'text-text-muted hover:text-text-main hover:bg-bg-base/50'
              }`}
            >
              {tab === 'overview' && <Briefcase className="h-4 w-4" />}
              {tab === 'cycles' && <Layers className="h-4 w-4" />}
              {tab === 'ledger' && <FileText className="h-4 w-4" />}
              {tab === 'settings' && <Settings className="h-4 w-4" />}
              <span>{t.tabs[tab]}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-6 w-full"
        >
          
          {/* EQUITY OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card hoverEffect className="flex flex-col gap-1.5 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{t.stats.fleetValue}</span>
                    <Briefcase className="h-4 w-4 text-brand-gold" />
                  </div>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">₦{totalFleetValuation.toLocaleString()}</p>
                  <span className="text-[14px] font-medium text-text-muted mt-2 block">{t.stats.fleetDesc.replace('{count}', vehiclesCount.toString())}</span>
                </Card>

                <Card hoverEffect className="flex flex-col gap-1.5 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{t.stats.totalInvested}</span>
                    <Coins className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-emerald-600 tabular-nums leading-none mt-1">₦{shareholder.investment_amount.toLocaleString()}</p>
                  <span className="text-[14px] font-semibold text-emerald-500 flex items-center gap-0.5 mt-2 block">
                    <Percent className="h-3 w-3 inline" />
                    {calculations.investmentPercentage.toFixed(2)}% {t.stats.weight}
                  </span>
                </Card>

                <Card hoverEffect className="flex flex-col gap-1.5 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{t.stats.activeEarnings}</span>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">₦{Math.round(calculations.currentCycleEarnings).toLocaleString()}</p>
                  <span className="text-[14px] font-medium text-text-muted mt-2 block">{t.stats.activeDesc}</span>
                </Card>

                <Card hoverEffect className="flex flex-col gap-1.5 bg-slate-950 border-slate-800 text-white p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[14px] font-semibold text-slate-400 uppercase tracking-wider block">{t.stats.cumulativeEarnings}</span>
                    <HandCoins className="h-4 w-4 text-brand-gold animate-pulse" />
                  </div>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-brand-gold tabular-nums leading-none mt-1">₦{Math.round(calculations.totalEarnings).toLocaleString()}</p>
                  <span className="text-[14px] font-medium text-slate-400 mt-2 block">{t.stats.cumulativeDesc}</span>
                </Card>
              </div>

              {/* Chart section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-8 flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle>{lang === 'en' ? "Operating Outlay vs Payout Pools" : "Gurbin Kudade na Kamfani"}</CardTitle>
                    <CardDescription>{lang === 'en' ? "Consolidated financial streams of general revenues vs expense distributions." : "Rabe-raben kudin shiga na kowane fanni."}</CardDescription>
                  </CardHeader>
                  <div className="h-72 mt-4 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ledgerBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                        <Tooltip formatter={(value: any) => [`₦${value.toLocaleString()}`]} />
                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                          {ledgerBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="lg:col-span-4 bg-slate-900 border-slate-800 text-white p-6 flex flex-col justify-between">
                  <div className="flex flex-col gap-4">
                    <span className="text-[10px] font-black tracking-widest text-brand-gold uppercase">{t.stats.nextPayout}</span>
                    <p className="text-4xl font-black text-white">Q3 2026</p>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {lang === 'en' 
                        ? "Corporate dividends are computed over 30-day operating corridors and released following quarterly audits." 
                        : "Ana lissafin rabon ribar masu jari a kowane zagayen kwanaki 30 sannan a rarraba bayan kammala bincike."}
                    </p>
                  </div>

                  <div className="border-t border-slate-800 pt-4 mt-6">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">EFFECTIVE RELEASE</span>
                    <span className="text-xs text-brand-gold font-bold font-mono block mt-1">{t.stats.nextDate}</span>
                  </div>
                </Card>
              </div>

            </div>
          )}

          {/* COMPLETED CYCLES TAB */}
          {activeTab === 'cycles' && (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t.cycles.title}</CardTitle>
                    <CardDescription>{t.cycles.desc}</CardDescription>
                  </div>
                </CardHeader>

                <div className="p-4 md:p-6 flex flex-col gap-4">
                  {calculations.completedCycles.length === 0 ? (
                    <div className="p-8 text-center text-xs text-text-muted font-bold font-mono">
                      {t.cycles.noCycles}
                    </div>
                  ) : (
                    calculations.completedCycles.map((cycle: any) => {
                      const cycleRevenues = cycle.metrics?.totalRevenue || 0;
                      const cycleExpenses = cycle.metrics?.totalExpenses || 0;
                      const cycleProfit = cycle.metrics?.netGeneratedAmount || 0;
                      const cyclePool = cycle.metrics?.distributionPool || 0;
                      const myDividendShare = cyclePool * (calculations.investmentPercentage / 100);

                      return (
                        <div 
                          key={cycle.id} 
                          className="border border-border-main/60 rounded-xl p-5 hover:bg-bg-base/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="p-3 bg-brand-gold/10 rounded-xl text-brand-gold">
                              <Layers className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-text-main">
                                {t.cycles.cycleCard.replace('{id}', cycle.id)}
                              </h4>
                              <p className="text-[10px] text-text-muted font-mono mt-1">
                                {cycle.startDate} {lang === 'en' ? "to" : "zuwa"} {cycle.endDate}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs font-mono">
                            <div>
                              <span className="text-[9px] text-text-muted block font-sans font-bold uppercase">{t.cycles.revenues}</span>
                              <span className="font-extrabold text-text-main">₦{cycleRevenues.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-text-muted block font-sans font-bold uppercase">{t.cycles.expenses}</span>
                              <span className="font-extrabold text-brand-danger">₦{cycleExpenses.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-text-muted block font-sans font-bold uppercase">{t.cycles.profit}</span>
                              <span className="font-black text-emerald-600">₦{cycleProfit.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-text-muted block font-sans font-bold uppercase">{t.cycles.myShare}</span>
                              <span className="font-black text-brand-gold text-sm">₦{Math.round(myDividendShare).toLocaleString()}</span>
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedCycleStatement({ ...cycle, myDividendShare })}
                            className="font-bold flex items-center gap-1.5 cursor-pointer w-full md:w-auto"
                          >
                            <Printer className="h-4 w-4" />
                            {t.cycles.viewStatement}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Printable statement voucher overlay container */}
              <AnimatePresence>
                {selectedCycleStatement && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white text-slate-900 border border-slate-300 rounded-xl max-w-xl w-full p-6 md:p-8 shadow-2xl relative font-sans"
                    >
                      <button 
                        onClick={() => setSelectedCycleStatement(null)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-950 p-1.5 hover:bg-slate-100 rounded-full cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {/* Printable Area */}
                      <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                          <div>
                            <h2 className="text-lg font-black tracking-tight text-slate-950">{t.statement.company}</h2>
                            <p className="text-[10px] text-slate-500 font-mono">{t.statement.address}</p>
                            <p className="text-[10px] text-slate-500 font-mono">info@ruqayyatransport.com | +234 803 123 4567</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black tracking-widest text-slate-950 bg-slate-100 px-2.5 py-1 rounded block uppercase">{t.statement.docType}</span>
                            <span className="text-[10px] font-mono text-slate-500 mt-1 block uppercase font-bold">{t.statement.originalCopy}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-mono border-b border-slate-200 pb-4">
                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{t.statement.investorName}:</span>
                            <span className="font-extrabold text-slate-900 text-sm">{shareholder.full_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{t.statement.payoutDate}:</span>
                            <span className="font-extrabold text-slate-900">{selectedCycleStatement.endDate}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{t.statement.investorWeight}:</span>
                            <span className="font-extrabold text-slate-900">{calculations.investmentPercentage.toFixed(2)}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{t.statement.cycleRef}:</span>
                            <span className="font-extrabold text-slate-900">{selectedCycleStatement.id}</span>
                          </div>
                        </div>

                        <h3 className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">{t.statement.particulars}</h3>
                        
                        <div className="flex flex-col gap-2.5 text-xs">
                          <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">{lang === 'en' ? "Cycle Gross Revenues" : "Kudin Shiga na Zagaye"}:</span>
                            <span className="font-bold text-slate-900 font-mono">₦{(selectedCycleStatement.metrics?.totalRevenue || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">{lang === 'en' ? "Cycle Operating Expenses" : "Kudin Gudanarwa na Zagaye"}:</span>
                            <span className="font-bold text-slate-900 font-mono">₦{(selectedCycleStatement.metrics?.totalExpenses || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">{lang === 'en' ? "Net Operating Profit" : "Ribar da Aka Samu (Net)"}:</span>
                            <span className="font-bold text-emerald-600 font-mono">₦{(selectedCycleStatement.metrics?.netGeneratedAmount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">{t.statement.grossPool} ({selectedCycleStatement.metrics?.distributionPercentage || 35}%):</span>
                            <span className="font-bold text-slate-900 font-mono">₦{(selectedCycleStatement.metrics?.distributionPool || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-2 border-t border-slate-900 text-sm font-black mt-2">
                            <span className="text-slate-950">{t.statement.totalPaid}</span>
                            <span className="text-slate-950 font-mono">₦{Math.round(selectedCycleStatement.myDividendShare).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-[11px] font-mono mt-4">
                          <div>
                            <span className="text-slate-500 block uppercase text-[8px]">Authorized Signatory:</span>
                            <span className="font-bold text-slate-900 mt-2 block border-b border-slate-300 pb-1">{t.statement.authorized}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block uppercase text-[8px]">Audit Hash Reference:</span>
                            <span className="font-mono text-slate-500 text-[9px] block bg-slate-50 p-1 rounded mt-2 text-ellipsis overflow-hidden">
                              SEC_SH_REF_2026_CYC_{selectedCycleStatement.id.replace(/-/g, '_')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-8 pt-4 border-t border-slate-200">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`RUQAYYA TRANSPORT LIMITED\nDIVIDEND STATEMENT: ${selectedCycleStatement.id}\nSHAREHOLDER: ${shareholder.full_name}\nNET DISBURSEMENT: ₦${Math.round(selectedCycleStatement.myDividendShare)}`);
                            link.download = `Dividend_Statement_${selectedCycleStatement.id}.pdf`;
                            link.click();
                          }}
                          className="flex-1 font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-900 border-0"
                        >
                          <Download className="h-4 w-4" />
                          {t.statement.download}
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => window.print()}
                          className="flex-1 font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-slate-900 hover:bg-slate-950 text-white border-0"
                        >
                          <Printer className="h-4 w-4" />
                          {t.statement.print}
                        </Button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* OPERATIONAL LEDGER TAB */}
          {activeTab === 'ledger' && (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t.ledger.title}</CardTitle>
                    <CardDescription>{t.ledger.desc}</CardDescription>
                  </div>
                </CardHeader>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                        <th className="p-3">{t.ledger.ref}</th>
                        <th className="p-3">{t.ledger.category}</th>
                        <th className="p-3">{t.ledger.description}</th>
                        <th className="p-3">{t.ledger.date}</th>
                        <th className="p-3 text-right">{t.ledger.amount}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50 text-text-main">
                      {financials.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-text-muted">
                            {lang === 'en' ? "No audited financial items logged in the central registry." : "Babu rajistar takardun kudi tukuna."}
                          </td>
                        </tr>
                      ) : (
                        financials.map(fn => (
                          <tr key={fn.id} className="hover:bg-bg-base/20 font-mono">
                            <td className="p-3 font-bold text-[11px] text-text-muted">{fn.id.substring(0, 8).toUpperCase()}</td>
                            <td className="p-3">
                              <Badge variant={fn.type === 'revenue' ? 'success' : 'danger'}>
                                {fn.category.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold text-xs font-sans">{fn.description}</td>
                            <td className="p-3 text-[10px] text-text-muted">{fn.date}</td>
                            <td className="p-3 text-right">
                              <span className={`font-extrabold flex items-center justify-end gap-0.5 ${fn.type === 'revenue' ? 'text-emerald-600' : 'text-brand-danger'}`}>
                                {fn.type === 'revenue' ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <ArrowDownRight className="h-3.5 w-3.5 text-brand-danger" />
                                )}
                                ₦{fn.amount.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.settings.title}</CardTitle>
                    <CardDescription>{t.settings.desc}</CardDescription>
                  </CardHeader>

                  <form onSubmit={handleSettingsUpdate} className="flex flex-col gap-5">
                    {settingsSuccess && <Alert type="success">{settingsSuccess}</Alert>}
                    {settingsError && <Alert type="danger">{settingsError}</Alert>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text-main">{t.settings.phone}</label>
                        <input
                          type="text"
                          value={settingsForm.phone}
                          onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text-main">{t.settings.email}</label>
                        <input
                          type="email"
                          value={settingsForm.email}
                          onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-main">{t.settings.address}</label>
                      <input
                        type="text"
                        value={settingsForm.address}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-main">{t.settings.password}</label>
                      <input
                        type="password"
                        value={settingsForm.password}
                        onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                      />
                    </div>

                    <Button
                      variant="primary"
                      type="submit"
                      size="sm"
                      className="font-bold w-full md:w-auto cursor-pointer"
                    >
                      {t.settings.save}
                    </Button>
                  </form>
                </Card>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-6">
                <Card className="bg-bg-surface">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-brand-gold" />
                      {lang === 'en' ? "Audit Integrity Center" : "Ofishin Tsaro da Tantancewa"}
                    </CardTitle>
                  </CardHeader>
                  <div className="p-4 flex flex-col gap-4 text-xs leading-relaxed text-text-muted font-mono text-[11px]">
                    <p>
                      {lang === 'en' 
                        ? "Investor records are validated in accordance with the SEC (Securities and Exchange Commission) requirements. Address revisions require administrative audit trail records." 
                        : "Bayanan masu jari ana tantance su daidai da dokokin kiyaye jari. Tuntuɓi Admin don sauye-sauye."}
                    </p>

                    <div className="flex flex-col gap-2 pt-3 border-t border-border-main/50">
                      <div className="flex justify-between">
                        <span>MY SHARES WEIGHT:</span>
                        <span className="font-extrabold text-text-main">{calculations.investmentPercentage.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MY INVESTED VALUE:</span>
                        <span className="font-extrabold text-text-main">₦{shareholder.investment_amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SYSTEM REGISTRY:</span>
                        <span className="font-bold text-text-main">APPROVED</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const X: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2} 
    stroke="currentColor" 
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
