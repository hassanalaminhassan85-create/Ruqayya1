import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Truck, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Clock, 
  Zap, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Calendar, 
  CloudSun, 
  Settings, 
  FileText, 
  UserPlus, 
  LogOut, 
  HelpCircle, 
  UserCheck, 
  RefreshCw, 
  ChevronRight,
  Database,
  ArrowRight,
  Download,
  Upload,
  PieChart as PieIcon,
  BarChart4,
  Camera,
  Edit3,
  Sparkles
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Card } from '../ui/Card';
import { CycleTimer } from './CycleTimer';
import { ActivityFeed } from '../admin/ActivityFeed';

interface OverviewTabProps {
  lang: 'en' | 'ha';
  dictionary: any;
  logs: any[];
  financials: any[];
  vehicles: any[];
  drivers: any[];
  admins: any[];
  shareholders: any[];
  cycles: any[];
  companySettings: any;
  shareholderSettings: any;
  tripManifests: any[];
  notifications: any[];
  users: any[];
  sseConnected: boolean;
  onStartCycle: (e: React.FormEvent) => void;
  onEndCycle: () => void;
  onPauseCycleClick?: () => void;
  onResumeCycleClick?: () => void;
  cycleGoalForm: { startDate: string; endDate?: string; endGoalTons: string };
  setCycleGoalForm: React.Dispatch<React.SetStateAction<{ startDate: string; endDate?: string; endGoalTons: string }>>;
  onAddAdmin: () => void;
  onAddShareholder: () => void;
  setActiveTab: (tab: string) => void;
  setSelectedDriver: (drv: any) => void;
  backupLoading: boolean;
  restoreLoading: boolean;
  onDownloadBackup: () => void;
  onUploadRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  restoreSuccess: string | null;
  restoreError: string | null;
  onStateChange?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  lang,
  dictionary,
  logs,
  financials,
  vehicles,
  drivers,
  admins,
  shareholders,
  cycles,
  companySettings,
  shareholderSettings,
  tripManifests,
  notifications,
  users,
  sseConnected,
  onStartCycle,
  onEndCycle,
  onPauseCycleClick,
  onResumeCycleClick,
  cycleGoalForm,
  setCycleGoalForm,
  onAddAdmin,
  onAddShareholder,
  setActiveTab,
  setSelectedDriver,
  backupLoading,
  restoreLoading,
  onDownloadBackup,
  onUploadRestore,
  restoreSuccess,
  restoreError,
  onStateChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Director profile & avatar states
  const [directorName, setDirectorName] = useState(() => localStorage.getItem('ruqayya_director_name') || 'General Director');
  const [directorAvatar, setDirectorAvatar] = useState(() => localStorage.getItem('ruqayya_director_avatar') || '');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempDirectorName, setTempDirectorName] = useState(directorName);
  const [tempDirectorAvatar, setTempDirectorAvatar] = useState(directorAvatar);

  // Statistics calculations
  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter(d => d && ['approved', 'available', 'on-trip'].includes(d.status)).length;
  const restingDrivers = drivers.filter(d => d && d.status === 'off-duty').length;
  const pendingDrivers = drivers.filter(d => d && d.status === 'pending').length;
  const smartDrivers = drivers.filter(d => d && d.classification === 'Smart').length;

  const totalVehicles = vehicles.length;
  const activeVehiclesCount = vehicles.filter(v => v && (v.status === 'assigned' || v.status === 'active')).length;

  const totalShareholders = shareholders.length;
  const totalInvestments = shareholders.reduce((sum, sh) => sum + (sh && sh.investment_amount ? sh.investment_amount : 0), 0);

  const totalRevenue = financials.filter(f => f && f.type === 'revenue').reduce((sum, f) => sum + f.amount, 0);
  const totalExpenses = financials.filter(f => f && f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const sharePct = shareholderSettings?.distributionPercentage ?? 2;
  const shareholderPool = netProfit > 0 ? (netProfit * (sharePct / 100)) : 0;

  const activeCycle = (cycles || []).find(c => c && (c.status === 'active' || c.status === 'paused'));
  const targetTons = activeCycle ? activeCycle.endGoalTons : 200;
  const currentTons = 94.6; // In a real production DB, this aggregates trip manifests weights
  const completionPercentage = Math.round((currentTons / targetTons) * 100);

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!activeCycle) return;
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCycle]);

  const getRemainingDays = (cycle: any) => {
    if (!cycle) return "N/A";
    
    const rawStart = cycle.created_at || cycle.startDate;
    let startMs = NaN;
    if (rawStart) {
      if (typeof rawStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawStart)) {
        startMs = new Date(`${rawStart}T00:00:00Z`).getTime();
      } else {
        startMs = new Date(rawStart).getTime();
      }
    }
    if (isNaN(startMs)) return "N/A";

    let nowMs = nowTick;
    if (cycle.status === 'paused' && cycle.pausedAt) {
      const pausedMs = new Date(cycle.pausedAt).getTime();
      if (!isNaN(pausedMs)) {
        nowMs = pausedMs;
      }
    }

    let totalMs = nowMs - startMs;
    if (totalMs < 0) totalMs = 0;

    let totalPausedMs = 0;
    if (cycle.pauseHistory && Array.isArray(cycle.pauseHistory)) {
      cycle.pauseHistory.forEach((p: any) => {
        const pStart = new Date(p.pausedAt).getTime();
        if (isNaN(pStart)) return;

        if (p.resumedAt) {
          const pEnd = new Date(p.resumedAt).getTime();
          if (!isNaN(pEnd)) {
            totalPausedMs += (pEnd - pStart);
          }
        }
      });
    }

    let activeMs = totalMs - totalPausedMs;
    if (activeMs < 0) activeMs = 0;
    
    const secondsElapsed = Math.floor(activeMs / 1000);
    const totalDays = 30 + (cycle.extendedDays || 0);
    const totalCycleSeconds = totalDays * 24 * 3600;
    const remainingSeconds = Math.max(0, totalCycleSeconds - secondsElapsed);
    
    const days = Math.floor(remainingSeconds / (3600 * 24));
    const hours = Math.floor((remainingSeconds % (3600 * 24)) / 3600);
    
    if (days === 0 && hours === 0) {
      return lang === 'en' ? "Concluding..." : "Gama...";
    }
    
    if (days === 0) {
      return lang === 'en' ? `${hours} Hrs Left` : `${hours} Awari Suka Rage`;
    }
    
    return lang === 'en' ? `${days} Days Left` : `Kwanaki ${days} Suka Rage`;
  };

  const getScheduledEnd = (cycle: any) => {
    if (cycle.endDate) {
      const endStr = cycle.endDate;
      return endStr.includes('T') ? endStr.split('T')[0] : endStr;
    }
    const start = cycle.created_at || cycle.startDate;
    if (!start) return 'N/A';
    try {
      let d: Date;
      if (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
        d = new Date(`${start}T00:00:00Z`);
      } else {
        d = new Date(start);
      }
      if (isNaN(d.getTime())) return 'N/A';
      const totalDays = 30 + (cycle.extendedDays || 0);
      d.setUTCDate(d.getUTCDate() + totalDays);
      return d.toISOString().split('T')[0];
    } catch (e) {
      return 'N/A';
    }
  };

  // Filter items based on global search
  const handleSearch = () => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    
    const results: any[] = [];
    drivers.forEach(d => {
      if (d.fullName?.toLowerCase().includes(query) || d.company_driver_id?.toLowerCase().includes(query)) {
        results.push({ type: 'driver', label: d.fullName, subLabel: `Driver ID: ${d.company_driver_id || 'Pending'}`, item: d });
      }
    });

    vehicles.forEach(v => {
      if (v.plateNumber?.toLowerCase().includes(query) || v.brand?.toLowerCase().includes(query)) {
        results.push({ type: 'vehicle', label: `${v.brand} (${v.plateNumber})`, subLabel: 'Fleet Asset', item: v });
      }
    });

    shareholders.forEach(s => {
      if (s.full_name?.toLowerCase().includes(query) || s.phone?.toLowerCase().includes(query)) {
        results.push({ type: 'shareholder', label: s.full_name, subLabel: 'Corporate Shareholder', item: s });
      }
    });

    return results;
  };

  const searchResults = handleSearch();

  // Format currencies
  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Recharts Data Integration
  const chartData = financials.slice(0, 10).reverse().map(f => ({
    date: f.date,
    amount: f.amount,
    type: f.type,
    revenue: f.type === 'revenue' ? f.amount : 0,
    expense: f.type === 'expense' ? f.amount : 0,
  }));

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      
      {/* 1. HERO SECTION & COMPACT EXECUTIVE OVERVIEW */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-950 text-white p-4 sm:p-6 rounded-2xl border border-slate-900 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex-1 flex items-center gap-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="relative cursor-pointer group shrink-0"
            onClick={() => setIsProfileModalOpen(true)}
            title="Click to edit profile & upload avatar"
          >
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-brand-gold via-amber-400 to-purple-500 opacity-75 blur-xs group-hover:opacity-100 animate-spin" style={{ animationDuration: '6s' }} />
            <div className="relative h-16 w-16 rounded-full bg-slate-900 border-2 border-brand-gold overflow-hidden flex items-center justify-center shadow-lg">
              {directorAvatar ? (
                <img src={directorAvatar} alt={directorName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-brand-gold font-black text-sm">{directorName.split(' ').map(n => n[0]).join('').substring(0, 2)}</span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 h-4 w-4 bg-brand-gold rounded-full border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-xs">
              <Edit3 className="h-2 w-2 font-bold" />
            </div>
          </motion.div>

          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-gold animate-pulse" />
              <span className="text-[10px] font-extrabold tracking-widest text-brand-gold uppercase font-mono flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-brand-gold animate-pulse" />
                {lang === 'en' ? "EXECUTIVE CENTRAL COMMAND" : "BABBAN SHASHE NA TSARO"} 👑
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-100 font-sans mt-1">
              {(() => {
                const hours = new Date().getHours();
                let greeting = "Good Morning";
                if (hours >= 12 && hours < 17) greeting = "Good Afternoon";
                if (hours >= 17) greeting = "Good Evening";
                
                if (lang === 'ha') {
                  if (hours < 12) greeting = "In kwana lafiya (Barka da Safiya)";
                  else if (hours < 17) greeting = "Barka da Rana";
                  else greeting = "Barka da Yamma";
                }
                return `${greeting}, ${directorName} 🚀🌟`;
              })()}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xl font-medium leading-relaxed">
              {lang === 'en' 
                ? "All logistics nodes active. Corporate financial ledgers and ECOWAS cross-border transit protocols are fully in sync."
                : "Dukkan sassan sufuri suna aiki. Kundin kudi na kamfani da ka'idojin ECOWAS suna daidai da juna."}
            </p>
          </div>
        </div>

        {/* Profile Edit Modal for Director */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 text-white shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase text-brand-gold">Edit Director Profile & Avatar</h3>
                <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <span className="text-lg">&times;</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase">Director Name</label>
                <input
                  type="text"
                  value={tempDirectorName}
                  onChange={(e) => setTempDirectorName(e.target.value)}
                  className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  placeholder="e.g. General Director"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase">Profile Avatar URL or Upload</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={tempDirectorAvatar}
                    onChange={(e) => setTempDirectorAvatar(e.target.value)}
                    className="flex-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    placeholder="https://images.unsplash.com/... or image URL"
                  />
                  <label className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors">
                    <Camera className="h-4 w-4 text-brand-gold" />
                    <span>Upload</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setTempDirectorAvatar(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {tempDirectorAvatar && (
                <div className="flex items-center gap-3 p-3 bg-slate-850 border border-slate-750 rounded-xl">
                  <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-brand-gold shrink-0">
                    <img src={tempDirectorAvatar} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Avatar Preview</p>
                    <p className="text-[10px] text-slate-400">High-motion executive avatar ready.</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const finalName = tempDirectorName.trim() || 'General Director';
                    setDirectorName(finalName);
                    setDirectorAvatar(tempDirectorAvatar);
                    localStorage.setItem('ruqayya_director_name', finalName);
                    localStorage.setItem('ruqayya_director_avatar', tempDirectorAvatar);
                    setIsProfileModalOpen(false);
                  }}
                  className="px-4 py-2 bg-brand-gold hover:bg-yellow-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right side telemetry info */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 self-stretch lg:self-auto min-w-[280px]">
          <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-center">
            <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">{lang === 'en' ? "Operating Cycle" : "Zagayen Aiki"}</span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-brand-gold shrink-0" />
              {activeCycle ? (
                <span className={activeCycle.status === 'paused' ? 'text-amber-500 font-extrabold' : 'text-emerald-500 font-extrabold'}>
                  {activeCycle.status === 'paused' ? (lang === 'en' ? 'PAUSED' : 'AN DAKATAR') : (lang === 'en' ? 'ACTIVE' : 'A-AIKI')} ({activeCycle.id.substring(0, 5)})
                </span>
              ) : (
                <span className="text-slate-400">Inactive</span>
              )}
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-center">
            <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">{lang === 'en' ? "Company Status" : "Matsayin Kamfani"}</span>
            <span className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              SECURE
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-center col-span-2 md:col-span-1">
            <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">{lang === 'en' ? "SSE Channel" : "Tashar SSE"}</span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 flex items-center gap-1.5 font-mono">
              <span className={`h-1.5 w-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {sseConnected ? "LIVE STREAM" : "POLLING"}
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-center col-span-2 md:col-span-3">
            <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">{lang === 'en' ? "Active Corridor Date" : "Ranar Sufuri"}</span>
            <span className="text-xs font-bold text-brand-gold mt-0.5 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                2026-07-10
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <CloudSun className="h-3 w-3 shrink-0 text-slate-400" />
                Kaduna Corridor: 32°C Clear
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. GLOBAL OMNI-SEARCH COLD ACTION BAR */}
      <div className="relative w-full">
        <div className="flex items-center bg-white border border-slate-200/80 hover:border-slate-300 focus-within:border-slate-950 focus-within:ring-2 focus-within:ring-slate-950/5 transition-all p-3 rounded-xl shadow-xs">
          <Search className="h-4.5 w-4.5 text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder={lang === 'en' ? "Search ledger reference, driver records, active plate numbers or boardroom investors..." : "Bincika lambar rasiti, sunan direba, lamba mota ko masu hannun jari..."}
            className="w-full text-xs font-semibold focus:outline-hidden bg-transparent text-slate-900 placeholder-slate-400 font-sans"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-900 cursor-pointer font-mono px-1.5 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              ESC
            </button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        <AnimatePresence>
          {searchQuery && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto"
            >
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs font-medium text-slate-400">
                  {lang === 'en' ? "No records match search parameters." : "Babu sakamakon da ya dace."}
                </div>
              ) : (
                searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearchQuery('');
                      if (res.type === 'driver') {
                        setSelectedDriver(res.item);
                        setActiveTab('drivers');
                      } else if (res.type === 'vehicle') {
                        setActiveTab('directory');
                      } else if (res.type === 'shareholder') {
                        setActiveTab('shareholders');
                      }
                    }}
                    className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{res.label}</span>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{res.subLabel}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-brand-gold uppercase tracking-wider font-mono">
                      <span>{lang === 'en' ? "Audit" : "Kula"}</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. HORIZONTAL QUICK ACTION BAR (Mercury / Ramp Inspired) */}
      <div className="bg-slate-50/50 border border-slate-200/50 p-2 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none scroll-smooth">
          <button 
            onClick={() => setActiveTab('drivers')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs"
          >
            <UserPlus className="h-4 w-4 text-brand-gold shrink-0" />
            {lang === 'en' ? "Register Driver" : "Rijistar Direba"}
          </button>

          <button 
            onClick={() => setActiveTab('directory')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs"
          >
            <Truck className="h-4 w-4 text-blue-500 shrink-0" />
            {lang === 'en' ? "Register Vehicle" : "Rijistar Mota"}
          </button>

          <button 
            onClick={() => setActiveTab('cycles')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs"
          >
            <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
            {lang === 'en' ? "Manage Cycles" : "Sarrafa Zagaye"}
          </button>

          <button 
            onClick={() => setActiveTab('drivers')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs"
          >
            <UserCheck className="h-4 w-4 text-indigo-500 shrink-0" />
            {lang === 'en' ? "Approve Driver" : "Amince wa Direba"}
          </button>

          <button 
            onClick={onAddAdmin}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs"
          >
            <Settings className="h-4 w-4 text-violet-500 shrink-0" />
            {lang === 'en' ? "Create Admin" : "Kara Admin"}
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs"
          >
            <FileText className="h-4 w-4 text-rose-500 shrink-0" />
            {lang === 'en' ? "Export Report" : "Fitarda Rahoto"}
          </button>

          <button 
            onClick={onAddShareholder}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs"
          >
            <Coins className="h-4 w-4 text-amber-500 shrink-0" />
            {lang === 'en' ? "Manage Shareholders" : "Sarrafa Jari"}
          </button>

          <button 
            onClick={() => setActiveTab('monitoring')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-all active:scale-97 cursor-pointer shadow-xs ml-auto"
          >
            <Zap className="h-4 w-4 text-amber-500 shrink-0 fill-amber-500/20" />
            {lang === 'en' ? "System Dispatch" : "Aiken Gaggawa"}
          </button>
        </div>
      </div>

      {/* 4. EXECUTIVE TOP KPI HORIZONTAL RECTANGULAR CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Drivers Card */}
        <motion.div 
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          onMouseEnter={() => setHoveredCard('drivers')}
          onMouseLeave={() => setHoveredCard(null)}
          className="bg-white border border-slate-200/90 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-xl hover:border-brand-gold/60 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-gold" />
          <div className="flex items-center gap-4 pl-2">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-brand-gold group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">{lang === 'en' ? "Drivers" : "Direbobi"}</span>
              <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">{totalDrivers}</div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{activeDrivers} active on transit corridors</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="h-3.5 w-3.5" /> +4%
            </span>
            <svg className="h-6 w-16 text-emerald-500 mt-2" viewBox="0 0 100 30">
              <path d="M0,25 Q15,10 30,20 T60,8 T90,15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>

        {/* Fleet Assets Card */}
        <motion.div 
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.05 }}
          onMouseEnter={() => setHoveredCard('fleet')}
          onMouseLeave={() => setHoveredCard(null)}
          className="bg-white border border-slate-200/90 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-xl hover:border-blue-500/60 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <div className="flex items-center gap-4 pl-2">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-600 group-hover:scale-110 transition-transform">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">{lang === 'en' ? "Fleet Assets" : "Motoci"}</span>
              <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">{totalVehicles}</div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{activeVehiclesCount} on road (92% active utilization)</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-blue-600 flex items-center gap-0.5 bg-blue-50 px-2 py-0.5 rounded-full">
              Active
            </span>
            <svg className="h-6 w-16 text-blue-500 mt-2" viewBox="0 0 100 30">
              <path d="M0,15 Q20,15 40,20 T80,10 T100,15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>

        {/* Gross Revenue Card */}
        <motion.div 
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          onMouseEnter={() => setHoveredCard('revenue')}
          onMouseLeave={() => setHoveredCard(null)}
          className="bg-white border border-slate-200/90 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-xl hover:border-emerald-500/60 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <div className="flex items-center gap-4 pl-2">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">{lang === 'en' ? "Total Revenue" : "Kudin Shiga"}</span>
              <div className="text-xl md:text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">{formatNaira(totalRevenue)}</div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">100% audited daily collection invoices</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="h-3.5 w-3.5" /> +12.4%
            </span>
            <svg className="h-6 w-16 text-emerald-500 mt-2" viewBox="0 0 100 30">
              <path d="M0,25 Q10,15 25,5 T50,15 T75,8 T100,2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>

        {/* Payments Card */}
        <motion.div 
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
          onMouseEnter={() => setHoveredCard('payments')}
          onMouseLeave={() => setHoveredCard(null)}
          className="bg-white border border-slate-200/90 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-xl hover:border-rose-500/60 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
          <div className="flex items-center gap-4 pl-2">
            <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-600 group-hover:scale-110 transition-transform">
              <TrendingDown className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">{lang === 'en' ? "Payments & Outflows" : "Kudin Kashewa"}</span>
              <div className="text-xl md:text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">{formatNaira(totalExpenses)}</div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Verified fuel & maintenance dispatches</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-rose-600 flex items-center gap-0.5 bg-rose-50 px-2 py-0.5 rounded-full">
              <ArrowDownRight className="h-3.5 w-3.5" /> -1.5%
            </span>
            <svg className="h-6 w-16 text-rose-500 mt-2" viewBox="0 0 100 30">
              <path d="M0,5 Q20,15 40,8 T80,25 T100,22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>

        {/* Shareholders Card */}
        <motion.div 
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
          onMouseEnter={() => setHoveredCard('shareholders')}
          onMouseLeave={() => setHoveredCard(null)}
          className="bg-white border border-slate-200/90 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-xl hover:border-amber-500/60 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <div className="flex items-center gap-4 pl-2">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-600 group-hover:scale-110 transition-transform">
              <Coins className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">{lang === 'en' ? "Shareholders Pool" : "Gudunmawar Jari"}</span>
              <div className="text-xl md:text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">{formatNaira(totalInvestments)}</div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{totalShareholders} board nodes ({sharePct}% pool margin)</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              Secured
            </span>
            <svg className="h-6 w-16 text-amber-400 mt-2" viewBox="0 0 100 30">
              <path d="M0,15 L25,15 L50,15 L100,15" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
            </svg>
          </div>
        </motion.div>

        {/* Operating Cycle Card */}
        <motion.div 
          id="active-cycle-hud"
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.25 }}
          onMouseEnter={() => setHoveredCard('cycle')}
          onMouseLeave={() => setHoveredCard(null)}
          className="bg-white border border-slate-200/90 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-xl hover:border-purple-500/60 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
          <div className="flex items-center gap-4 pl-2">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-600 group-hover:scale-110 transition-transform">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">{lang === 'en' ? "Operating Cycle" : "Zagayen Aiki"}</span>
              <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">{completionPercentage}% Completed</div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{currentTons}T / {targetTons}T freight tonnage</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="w-16 bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
              <div className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full" style={{ width: `${completionPercentage}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 mt-2">
              {activeCycle ? getRemainingDays(activeCycle) : (lang === 'en' ? 'No Active' : 'Babu')}
            </span>
          </div>
        </motion.div>

      </div>

      {/* 5. TODAY'S LIVE OPERATIONS GRID */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-extrabold text-slate-500 tracking-wider uppercase font-mono">
          {lang === 'en' ? "Today's Corridor Operations" : "Ayyukan Sufuri na Yau"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 flex flex-col gap-1 hover:bg-white hover:border-slate-300/80 transition-all cursor-pointer">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? "Driver Registrations" : "Rijistar Direbobi"}</span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">{totalDrivers}</span>
            <span className="text-[9px] text-slate-500">{smartDrivers} classified Smart</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 flex flex-col gap-1 hover:bg-white hover:border-slate-300/80 transition-all cursor-pointer">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? "Payments Today" : "Biyan Kudade Yau"}</span>
            <span className="text-[9px] text-slate-500">{formatNaira(totalExpenses)} distributed</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 flex flex-col gap-1 hover:bg-white hover:border-slate-300/80 transition-all cursor-pointer">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? "Pending Approvals" : "Sauran Amincewa"}</span>
            <span className="text-lg font-extrabold text-amber-600 font-mono flex items-center gap-1.5">
              {pendingDrivers}
              {pendingDrivers > 0 && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
            </span>
            <span className="text-[9px] text-slate-500">Boardroom dossiers pending</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 flex flex-col gap-1 hover:bg-white hover:border-slate-300/80 transition-all cursor-pointer">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? "Vehicles Active" : "Motoci Masu Aiki"}</span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">{activeVehiclesCount}</span>
            <span className="text-[9px] text-slate-500">{vehicles.filter(v => v.status === 'maintenance').length} in maintenance</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 flex flex-col gap-1 hover:bg-white hover:border-slate-300/80 transition-all cursor-pointer">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? "Drivers Resting" : "Direbobi Masu Hutu"}</span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">{restingDrivers}</span>
            <span className="text-[9px] text-slate-500">Scheduled rest corridors</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 flex flex-col gap-1 hover:bg-white hover:border-slate-300/80 transition-all cursor-pointer">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? "Revenue Today" : "Ribar Aiki Yau"}</span>
            <span className="text-lg font-extrabold text-emerald-600 font-mono truncate">{formatNaira(totalRevenue)}</span>
            <span className="text-[9px] text-slate-500">Audit margin verified</span>
          </div>

        </div>
      </div>

      {/* 6. MAIN CONTENT TWO-COLUMN GRID: FINANCIAL OVERVIEW VS OPERATING CYCLE TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left main area: Stripe-like Financial Area Chart */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Finance Overview Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                  <BarChart4 className="h-4.5 w-4.5 text-brand-gold" />
                  {lang === 'en' ? "Financial Operations Corridor" : "Zanin Kudi Na Kamfani"}
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Live telemetry tracing logistics gross margins and fuel cost weights.</p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl">
                <button className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white shadow-xs text-slate-900">Live</button>
                <button className="px-2.5 py-1 text-[10px] font-bold rounded-lg text-slate-500 hover:text-slate-900">30D</button>
                <button className="px-2.5 py-1 text-[10px] font-bold rounded-lg text-slate-500 hover:text-slate-900">Cycle</button>
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Gross Revenues</span>
                  <p className="text-base font-extrabold text-slate-900 font-mono mt-0.5">{formatNaira(totalRevenue)}</p>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Expenses</span>
                  <p className="text-base font-extrabold text-rose-600 font-mono mt-0.5">- {formatNaira(totalExpenses)}</p>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Net Margin Ratio</span>
                  <p className="text-base font-extrabold text-emerald-600 font-mono mt-0.5">
                    {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0'}%
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Shareholder Pool</span>
                  <p className="text-base font-extrabold text-brand-gold font-mono mt-0.5">{formatNaira(shareholderPool)}</p>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-72 w-full">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    No financial data active for the selected corridor timeline.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: any) => [`₦${value.toLocaleString()}`]} 
                      />
                      <Area type="monotone" dataKey="revenue" name="Invoiced Revenue" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                      <Area type="monotone" dataKey="expense" name="Fuel" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Collection Progress & liabilities */}
            <div className="bg-slate-50/50 p-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
              <div>
                <div className="flex items-center justify-between mb-1 text-slate-500 font-bold">
                  <span>{lang === 'en' ? "Outstanding Debts" : "Bashi"}</span>
                  <span className="font-mono text-slate-800">₦2,400,000</span>
                </div>
                <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '42%' }} />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1 text-slate-500 font-bold">
                  <span>{lang === 'en' ? "Collection Progress" : "Kudaden da aka Karba"}</span>
                  <span className="font-mono text-slate-800">89.2%</span>
                </div>
                <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '89.2%' }} />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 bg-white border border-slate-200/60 rounded-xl text-[10px]">
                <div className="flex items-center gap-1 text-slate-500 font-bold">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Ledger Integrity</span>
                </div>
                <span className="font-bold text-emerald-600 font-mono">100% SECURE</span>
              </div>
            </div>
          </div>

          {/* Real-time Cycle Duration & Status Tracker */}
          <CycleTimer 
            lang={lang}
            activeCycle={activeCycle}
            onStateChange={onStateChange || (() => {})}
          />

          {/* Operating Cycle Timeline Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                  <Clock className="h-4.5 w-4.5 text-brand-gold" />
                  {lang === 'en' ? "Active operating Cycle Timeline" : `Zagayen Aiki Na Kwanaki ${30 + (activeCycle?.extendedDays || 0)}`}
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Continuous tricycle fleet audit mapping and boardroom settlement cycle.</p>
              </div>
              {activeCycle ? (
                <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-emerald-50 border border-emerald-200 text-emerald-600 animate-pulse uppercase tracking-wider font-mono">
                  Active
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-rose-50 border border-rose-200 text-rose-600 uppercase tracking-wider font-mono">
                  None
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Left Column: Progress Ring Gauge */}
              <div className="md:col-span-4 flex flex-col items-center justify-center py-2">
                <div className="relative h-32 w-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                    <circle cx="50" cy="50" r="40" stroke="#D4AF37" strokeWidth="8" fill="transparent" 
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - completionPercentage / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-extrabold text-slate-900 font-mono leading-none">{completionPercentage}%</span>
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase mt-1 tracking-wider">Hauled</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Timeline data */}
              <div className="md:col-span-8 flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/40">
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Corridor Commenced</span>
                    <span className="font-extrabold text-slate-800 font-mono mt-0.5 block">
                      {activeCycle ? activeCycle.startDate : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Remaining Days</span>
                    <span className="font-extrabold text-slate-800 font-mono mt-0.5 block">
                      {activeCycle ? getRemainingDays(activeCycle) : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Hauled Weight Weight Goal</span>
                    <span className="font-extrabold text-slate-800 font-mono mt-0.5 block">
                      {targetTons} Tons Target
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Next Settlement</span>
                    <span className="font-extrabold text-slate-800 font-mono mt-0.5 block">
                      {activeCycle ? getScheduledEnd(activeCycle) : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 mt-2">
                  {activeCycle ? (
                    <div className="flex items-center gap-2">
                      {activeCycle.status === 'paused' ? (
                        <button 
                          onClick={onResumeCycleClick}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-colors shadow-xs"
                        >
                          {lang === 'en' ? "Resume Cycle" : "Dawo da Zagaye"}
                        </button>
                      ) : (
                        <button 
                          onClick={onPauseCycleClick}
                          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-colors shadow-xs"
                        >
                          {lang === 'en' ? "Pause Cycle" : "Dakatar da Zagaye"}
                        </button>
                      )}
                      <button 
                        onClick={onEndCycle}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                        {lang === 'en' ? "End & Lock Active Cycle" : "Rufe Zagayen Sufuri"}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={onStartCycle} className="flex flex-wrap items-end gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">{lang === 'en' ? "Start Date" : "Ranar Fara"}</label>
                        <input
                          type="date"
                          required
                          className="bg-white border border-slate-200/80 p-2 rounded-lg text-xs font-semibold focus:outline-slate-900 focus:border-slate-900"
                          value={cycleGoalForm.startDate}
                          onChange={(e) => setCycleGoalForm({ ...cycleGoalForm, startDate: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">{lang === 'en' ? "End Date" : "Ranar Kammalawa"}</label>
                        <input
                          type="date"
                          required
                          className="bg-white border border-slate-200/80 p-2 rounded-lg text-xs font-semibold focus:outline-slate-900 focus:border-slate-900"
                          value={cycleGoalForm.endDate || ''}
                          onChange={(e) => setCycleGoalForm({ ...cycleGoalForm, endDate: e.target.value })}
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-3.5 py-2 bg-brand-gold hover:bg-brand-gold/80 text-slate-950 font-extrabold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {lang === 'en' ? "Launch Cycle" : "Fara Zagaye"}
                      </button>
                    </form>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right side timeline stream / Live activity logs & back-ups (Linear Inspired) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Real-time SSE Live Activity feed */}
          <ActivityFeed
            lang={lang}
            logs={logs}
            onRefresh={onStateChange}
          />

          {/* Corporate Database Backup & Recovery (Notion / Linear Inspired) */}
          <div id="database-backup-section" className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Database className="h-4.5 w-4.5 text-slate-600" />
                {lang === 'en' ? "Ledger Backups & Recovery" : "Ajiya & Mayar da Bayanai"}
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Secure hot-backups with full structural validation.</p>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-xs">
              
              {/* Backups trigger */}
              <button
                onClick={onDownloadBackup}
                disabled={backupLoading}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold flex items-center justify-between shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-slate-500 shrink-0" />
                  {lang === 'en' ? "Download JSON Backup" : "Sauke Bayanai (JSON)"}
                </span>
                {backupLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 text-brand-gold animate-spin" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>

              {/* Restore trigger wrapper */}
              <div className="relative">
                <label className="w-full py-2.5 px-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold flex items-center justify-between shadow-xs transition-all active:scale-98 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-slate-500 shrink-0" />
                    {lang === 'en' ? "Restore Database File" : "Mayar da Bayanai (JSON)"}
                  </span>
                  {restoreLoading ? (
                    <RefreshCw className="h-3.5 w-3.5 text-brand-gold animate-spin" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <input
                    type="file"
                    accept=".json"
                    onChange={onUploadRestore}
                    disabled={restoreLoading}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Feedback messages */}
              <AnimatePresence>
                {restoreSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-[10px]"
                  >
                    {restoreSuccess}
                  </motion.div>
                )}
                {restoreError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold text-[10px]"
                  >
                    {restoreError}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
