/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Truck, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Moon, 
  Activity, 
  DollarSign, 
  Wallet, 
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  ChevronUp as ChevronUpIcon,
  ChevronDown as ChevronDownIcon,
  Pin,
  Star,
  Maximize2,
  Minimize2,
  Check,
  Undo,
  ArrowRight
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Driver, Vehicle, FinancialRecord } from '../../types';

interface AdminKPIsProps {
  lang: 'en' | 'ha';
  drivers: Driver[];
  vehicles: Vehicle[];
  finance: FinancialRecord[];
  payments: any[];
  activeCycle: any;
  setActiveTab?: (tab: any) => void;
}

interface WidgetConfig {
  id: string;
  visible: boolean;
  size: 'normal' | 'wide';
  pinned: boolean;
  favorite: boolean;
  order: number;
}

export const AdminKPIs: React.FC<AdminKPIsProps> = ({
  lang,
  drivers,
  vehicles,
  finance,
  payments,
  activeCycle,
  setActiveTab
}) => {
  const [selectedKPI, setSelectedKPI] = useState<any | null>(null);

  // Metrics calculation
  const totalDrivers = drivers.length;
  const smartDrivers = drivers.filter(d => d.classification === 'Smart').length;
  const assistedDrivers = drivers.filter(d => d.classification === 'Assisted' || !d.classification).length;
  
  const activeDrivers = drivers.filter(d => d.status === 'available' || d.status === 'on-trip').length;
  const restingDrivers = drivers.filter(d => d.status === 'off-duty').length;
  
  const totalVehicles = vehicles.length;
  
  const revenueTotal = finance
    .filter(f => f.type === 'revenue')
    .reduce((sum, r) => sum + r.amount, 0);
    
  const expenseTotal = finance
    .filter(f => f.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);
    
  const netEarnings = revenueTotal - expenseTotal;
  
  const approvedPayments = payments
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0);

  // Shareholder Distribution cash pool (2% setting from db)
  const distributionPool = netEarnings > 0 ? netEarnings * 0.02 : 0;

  // Localization labels
  const labels = {
    en: {
      title: "Operational Telemetry Control Panel",
      customize: "Configure Widgets",
      reset: "Restore Default Grid",
      totalDrivers: "Total Drivers",
      rosterSize: "Total registered team members",
      classification: "Classification Status",
      classBreakdown: `${smartDrivers} Smart • ${assistedDrivers} Assisted`,
      restActive: "Duty Distribution",
      statusBreakdown: `${restingDrivers} On Rest • ${activeDrivers} On Active Duty`,
      totalVehicles: "Fleet Assets",
      rigAssets: `${vehicles.filter(v => v.status === 'assigned').length} assigned • ${vehicles.filter(v => v.status === 'idle').length} idle rigs`,
      revenue: "Inflow Ledger (Revenue)",
      freightEarnings: "Accrued cycle freight invoices",
      payments: "Driver Installments",
      installmentSum: "Approved payment receipts",
      expenses: "Outflow Ledger (Expenses)",
      operationalCost: "Repairs, fuel, and agency fees",
      netAmount: "Net Corporate Balance",
      surplus: "Verified net liquid surplus",
      distribution: "Shareholder Div Pool",
      pooledAmount: "2% of corporate surplus accrued",
      cycles: "Operating Cycle State",
      cycleState: activeCycle 
        ? `Cycle running (Started: ${new Date(activeCycle.startDate).toLocaleDateString()})` 
        : "No active corporate cycle currently",
      widgetSettings: "Dashboard Widget Engine",
      visibility: "Visibility",
      size: "Grid Span",
      pin: "Pin to Top",
      fav: "Mark Favorite",
      actions: "Reorder",
      wide: "Wide",
      normal: "Standard",
      pinned: "Pinned",
      favorite: "Favorite",
      hidden: "Hidden"
    },
    ha: {
      title: "Bayanin Gudanarwa na Aiki",
      customize: "Sarrafa Akwatina",
      reset: "Maida Tsohon Tsari",
      totalDrivers: "Jimillar Direbobi",
      rosterSize: "Yawan ma'aikata a tsarin",
      classification: "Rukunin Wayoyi (Smart / Assisted)",
      classBreakdown: `${smartDrivers} Smart • ${assistedDrivers} Assisted`,
      restActive: "Raba Aiki & Hutu",
      statusBreakdown: `${restingDrivers} Suna Hutu • ${activeDrivers} Suna Aiki`,
      totalVehicles: "Rukunin Kekuna",
      rigAssets: `${vehicles.filter(v => v.status === 'assigned').length} aiki • ${vehicles.filter(v => v.status === 'idle').length} hutu`,
      revenue: "Kudaden Shiga (Revenue)",
      freightEarnings: "Kudaden da aka tara a yanzu",
      payments: "Biyan Kudin Direbobi",
      installmentSum: "Adadin kudin da aka tabbatar",
      expenses: "Kudin da aka Kashe",
      operationalCost: "Man fetur, gyaran motoci da sauransu",
      netAmount: "Riba da Ya Rage",
      surplus: "Kudaden kamfani na yanzu",
      distribution: "Hannun Jari (2% Pool)",
      pooledAmount: "Kashi 2% na riba da aka ware",
      cycles: "Zangon Aiki (Cycle)",
      cycleState: activeCycle 
        ? `Zango na aiki (An fara: ${new Date(activeCycle.startDate).toLocaleDateString()})` 
        : "Babu zangon aiki a yanzu",
      widgetSettings: "Sarrafa Akwatinan Nuna Bayanai",
      visibility: "Gani ko Boyewa",
      size: "Girman Gado",
      pin: "Saka a Sama",
      fav: "Saka Masu Muhimmanci",
      actions: "Sake Tsara",
      wide: "Fadi",
      normal: "Daidai",
      pinned: "A Manne",
      favorite: "Babban Gaba",
      hidden: "A Boye"
    }
  }[lang];

  // Raw base KPIs data dictionary with detailed metadata and redirection targets
  const rawKpis = [
    {
      id: "total_drivers",
      title: labels.totalDrivers,
      value: totalDrivers,
      subtitle: labels.rosterSize,
      icon: <Users className="h-4 w-4 text-brand-gold" />,
      color: "border-brand-gold",
      accentBg: "bg-brand-gold/10",
      detailedDescription: lang === 'en' 
        ? `Comprehensive roster of all registered tricycle operators across the transport network. Total active roster stands at ${totalDrivers} certified personnel with verified licenses and background clearances.` 
        : `Jimillar dukkan direbobin keken napep da aka yi rijista a fadin cibiyar sadarwa (${totalDrivers} direbobi).`,
      targetTab: "drivers",
      actionLabel: lang === 'en' ? "Open Drivers Directory" : "Budewa Rukunin Direbobi"
    },
    {
      id: "classification",
      title: labels.classification,
      value: `${smartDrivers}/${assistedDrivers}`,
      subtitle: labels.classBreakdown,
      icon: <ShieldCheck className="h-4 w-4 text-blue-500" />,
      color: "border-blue-500",
      accentBg: "bg-blue-500/10",
      detailedDescription: lang === 'en'
        ? `Tracks ${smartDrivers} Smart digital-onboarded operators vs ${assistedDrivers} Assisted manual registrations. Ensures precise tier-based remittance and lease contract auditing.`
        : `Rarrabewar direbobi tsakanin Smart (${smartDrivers}) da Assisted (${assistedDrivers}) don kula da biyan kudi da kwangila.`,
      targetTab: "drivers",
      actionLabel: lang === 'en' ? "Manage Driver Classifications" : "Sarrafa Rukunin Direbobi"
    },
    {
      id: "rest_active",
      title: labels.restActive,
      value: `${restingDrivers}/${activeDrivers}`,
      subtitle: labels.statusBreakdown,
      icon: <Moon className="h-4 w-4 text-purple-500" />,
      color: "border-purple-500",
      accentBg: "bg-purple-500/10",
      detailedDescription: lang === 'en'
        ? `Monitors real-time shift distributions (${activeDrivers} active on transit duty vs ${restingDrivers} on compulsory rest). Enforces safety and operational compliance.`
        : `Kula da rabon aiki da hutu ainihin lokaci (${activeDrivers} suna kan aiki, ${restingDrivers} suna hutu).`,
      targetTab: "trips",
      actionLabel: lang === 'en' ? "View Trip Manifests" : "Duba Bayanin Tafiye-tafiye"
    },
    {
      id: "total_vehicles",
      title: labels.totalVehicles,
      value: totalVehicles,
      subtitle: labels.rigAssets,
      icon: <Truck className="h-4 w-4 text-indigo-500" />,
      color: "border-indigo-500",
      accentBg: "bg-indigo-500/10",
      detailedDescription: lang === 'en'
        ? `Complete inventory of all ${totalVehicles} 30-ton tricycle rigs, maintenance records, fuel type specifications, and lease assignment nodes.`
        : `Dukkan kekunan hawa ${totalVehicles} da aka kebe don jigilar kaya da kula da lafiyar injina.`,
      targetTab: "fleet",
      actionLabel: lang === 'en' ? "Manage Fleet Assets" : "Sarrafa Kayan Kamfani"
    },
    {
      id: "revenue",
      title: labels.revenue,
      value: `₦${revenueTotal.toLocaleString()}`,
      subtitle: labels.freightEarnings,
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      color: "border-emerald-500",
      accentBg: "bg-emerald-500/10",
      valueColor: "text-emerald-500",
      detailedDescription: lang === 'en'
        ? `Real-time accumulated revenue from daily freight transport manifests, driver remittances, and fuel voucher allocations totaling ₦${revenueTotal.toLocaleString()}.`
        : `Kudaden shiga da aka tara daga jigilar kaya da biyan kudin direbobi (₦${revenueTotal.toLocaleString()}).`,
      targetTab: "finance",
      actionLabel: lang === 'en' ? "Open Financial Command Center" : "Budewa Cibiyar Kudi"
    },
    {
      id: "payments",
      title: labels.payments,
      value: `₦${approvedPayments.toLocaleString()}`,
      subtitle: labels.installmentSum,
      icon: <Wallet className="h-4 w-4 text-sky-500" />,
      color: "border-sky-500",
      accentBg: "bg-sky-500/10",
      valueColor: "text-sky-500",
      detailedDescription: lang === 'en'
        ? `Audited record of approved installment payments (₦${approvedPayments.toLocaleString()}) made by drivers toward asset ownership lease contracts.`
        : `Adadin biyan kudin sashi da aka tabbatar (₦${approvedPayments.toLocaleString()}) na mallakar kekuna.`,
      targetTab: "payments",
      actionLabel: lang === 'en' ? "Review Payment Approvals" : "Duba Tabbatar da Biya"
    },
    {
      id: "expenses",
      title: labels.expenses,
      value: `₦${expenseTotal.toLocaleString()}`,
      subtitle: labels.operationalCost,
      icon: <TrendingDown className="h-4 w-4 text-rose-500" />,
      color: "border-rose-500",
      accentBg: "bg-rose-500/10",
      valueColor: "text-rose-500",
      detailedDescription: lang === 'en'
        ? `Itemized corporate expenditures covering fuel vouchers, tricycle maintenance, spare parts, and logistics support totaling ₦${expenseTotal.toLocaleString()}.`
        : `Kudin da aka kashe wajen gyaran motoci da man fetur (₦${expenseTotal.toLocaleString()}).`,
      targetTab: "finance",
      actionLabel: lang === 'en' ? "Examine Expense Ledgers" : "Duba Kudaden da Aka Kashe"
    },
    {
      id: "net_amount",
      title: labels.netAmount,
      value: `₦${netEarnings.toLocaleString()}`,
      subtitle: labels.surplus,
      icon: <DollarSign className="h-4 w-4 text-teal-500" />,
      color: "border-teal-500",
      accentBg: "bg-teal-500/10",
      valueColor: netEarnings >= 0 ? "text-emerald-500 font-extrabold" : "text-rose-500 font-extrabold",
      detailedDescription: lang === 'en'
        ? `Calculated net corporate financial position (Total Revenue minus Total Expenses), currently standing at ₦${netEarnings.toLocaleString()} verified surplus.`
        : `Riba ko babban kudin kamfani bayan cire kashe-kashe (₦${netEarnings.toLocaleString()}).`,
      targetTab: "finance",
      actionLabel: lang === 'en' ? "View Treasury Balance" : "Duba Rumbun Kudi"
    },
    {
      id: "distribution",
      title: labels.distribution,
      value: `₦${distributionPool.toLocaleString()}`,
      subtitle: labels.pooledAmount,
      icon: <Activity className="h-4 w-4 text-amber-500" />,
      color: "border-amber-500",
      accentBg: "bg-amber-500/10",
      valueColor: "text-amber-500",
      detailedDescription: lang === 'en'
        ? `Automated 2% allocation (₦${distributionPool.toLocaleString()}) of net corporate surplus accrued for stakeholder profit-sharing and equity distributions.`
        : `Kashi 2% na riba da aka ware domin rabawa masu hannun jari (₦${distributionPool.toLocaleString()}).`,
      targetTab: "directory",
      actionLabel: lang === 'en' ? "View Shareholder Registry" : "Duba Masu Hannun Jari"
    },
    {
      id: "cycles",
      title: labels.cycles,
      value: activeCycle ? `${lang === 'en' ? 'Active' : 'Aiki'}` : `${lang === 'en' ? 'Stopped' : 'Tsaya'}`,
      subtitle: labels.cycleState,
      icon: <RefreshCw className="h-4 w-4 text-orange-500 animate-spin-slow" />,
      color: "border-orange-500",
      accentBg: "bg-orange-500/10",
      detailedDescription: lang === 'en'
        ? `Controls the active 30-day corporate operating cycle engine, countdown timers, freight tonnage goals, and payroll scheduling.`
        : `Yana kula da zangon aiki na kwanaki 30 da ragowar lokaci da burin kamfani.`,
      targetTab: "dashboard",
      actionLabel: lang === 'en' ? "Manage Operating Cycles" : "Sarrafa Zangon Aiki"
    }
  ];

  // Default widget configurations
  const defaultWidgets: WidgetConfig[] = rawKpis.map((k, idx) => ({
    id: k.id,
    visible: true,
    size: 'normal',
    pinned: idx < 3, // first 3 pinned by default
    favorite: idx === 7 || idx === 4, // financial summaries as favorite
    order: idx
  }));

  const [configs, setConfigs] = useState<WidgetConfig[]>([]);
  const [showEditor, setShowEditor] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('ruqayya_kpi_widgets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all default widgets exist in saved configs
        const merged = defaultWidgets.map(def => {
          const match = parsed.find((p: any) => p.id === def.id);
          return match ? { ...def, ...match } : def;
        });
        setConfigs(merged);
      } catch (e) {
        setConfigs(defaultWidgets);
      }
    } else {
      setConfigs(defaultWidgets);
    }
  }, [lang, totalDrivers, totalVehicles, netEarnings]); // Re-trigger mapping when underlying counts scale

  const saveConfigs = (newConfigs: WidgetConfig[]) => {
    setConfigs(newConfigs);
    localStorage.setItem('ruqayya_kpi_widgets', JSON.stringify(newConfigs));
  };

  const handleReset = () => {
    saveConfigs(defaultWidgets);
  };

  const toggleVisibility = (id: string) => {
    saveConfigs(configs.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const toggleSize = (id: string) => {
    saveConfigs(configs.map(c => c.id === id ? { ...c, size: c.size === 'normal' ? 'wide' : 'normal' } : c));
  };

  const togglePinned = (id: string) => {
    saveConfigs(configs.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
  };

  const toggleFavorite = (id: string) => {
    saveConfigs(configs.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c));
  };

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= configs.length) return;
    
    const copy = [...configs];
    const temp = copy[index].order;
    copy[index].order = copy[nextIdx].order;
    copy[nextIdx].order = temp;
    
    // Sort and re-save
    copy.sort((a, b) => a.order - b.order);
    saveConfigs(copy.map((c, i) => ({ ...c, order: i })));
  };

  // Sort and filter active cards to show
  // Sorting: Pinned first, then favorites, then by custom order
  const activeWidgets = [...configs]
    .filter(c => c.visible)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.order - b.order;
    });

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* KPI Section Subheader with Control Action Trigger */}
      <div className="flex items-center justify-between border-b border-border-main/50 pb-2 mb-1">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-gold" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-main">
            {labels.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="px-2.5 py-1 rounded-lg border border-border-main hover:border-text-main text-[11px] font-bold text-text-main hover:bg-bg-base/50 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className={`h-3 w-3 ${showEditor ? 'rotate-90' : ''} transition-transform`} />
            <span>{labels.customize}</span>
          </button>
          {showEditor && (
            <button
              onClick={handleReset}
              className="px-2 py-1 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/5 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title={labels.reset}
            >
              <Undo className="h-3 w-3" />
              <span className="hidden sm:inline">{labels.reset}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sliding Customizer Panel */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-bg-surface border border-border-main/80 rounded-xl p-3 mb-2 shadow-sm">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted mb-2 font-mono flex items-center gap-1">
                <span>{labels.widgetSettings}</span>
                <span className="text-brand-gold">•</span>
                <span>Active Grid Layout Engine</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {configs
                  .sort((a, b) => a.order - b.order)
                  .map((widget, idx) => {
                    const raw = rawKpis.find(r => r.id === widget.id);
                    if (!raw) return null;
                    return (
                      <div 
                        key={widget.id} 
                        className={`flex items-center justify-between p-2 rounded-lg border ${widget.visible ? 'border-border-main' : 'border-dashed border-border-main/40 opacity-50'} bg-bg-base/40 text-xs`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-text-muted shrink-0 text-[10px] font-mono w-4">#{idx + 1}</span>
                          <span className="text-[11px] font-bold text-text-main truncate">{raw.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Toggle visibility */}
                          <button
                            onClick={() => toggleVisibility(widget.id)}
                            className={`p-1 rounded hover:bg-bg-base text-text-muted cursor-pointer ${widget.visible ? 'text-emerald-500' : ''}`}
                            title={labels.visibility}
                          >
                            {widget.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-rose-400" />}
                          </button>
                          
                          {/* Toggle size (wide/normal) */}
                          <button
                            onClick={() => toggleSize(widget.id)}
                            className={`p-1 rounded hover:bg-bg-base text-text-muted cursor-pointer ${widget.size === 'wide' ? 'text-brand-gold' : ''}`}
                            title={labels.size}
                          >
                            {widget.size === 'wide' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                          </button>

                          {/* Pin to top */}
                          <button
                            onClick={() => togglePinned(widget.id)}
                            className={`p-1 rounded hover:bg-bg-base text-text-muted cursor-pointer ${widget.pinned ? 'text-blue-500' : ''}`}
                            title={labels.pin}
                          >
                            <Pin className="h-3.5 w-3.5 fill-current" style={{ fillOpacity: widget.pinned ? 1 : 0 }} />
                          </button>

                          {/* Favorite status */}
                          <button
                            onClick={() => toggleFavorite(widget.id)}
                            className={`p-1 rounded hover:bg-bg-base text-text-muted cursor-pointer ${widget.favorite ? 'text-amber-500' : ''}`}
                            title={labels.fav}
                          >
                            <Star className="h-3.5 w-3.5 fill-current" style={{ fillOpacity: widget.favorite ? 1 : 0 }} />
                          </button>

                          {/* Up/Down ordering */}
                          <div className="flex flex-col">
                            <button 
                              disabled={idx === 0} 
                              onClick={() => moveOrder(idx, 'up')}
                              className="text-text-muted hover:text-text-main disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronUpIcon className="h-3 w-3" />
                            </button>
                            <button 
                              disabled={idx === configs.length - 1} 
                              onClick={() => moveOrder(idx, 'down')}
                              className="text-text-muted hover:text-text-main disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronDownIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Highly dense, visual, horizontal rectangular motion cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeWidgets.map((widget, idx) => {
          const kpi = rawKpis.find(r => r.id === widget.id);
          if (!kpi) return null;

          return (
            <motion.div
              key={widget.id}
              layoutId={`kpi-card-${widget.id}`}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: idx * 0.03 }}
              className={`${
                widget.size === 'wide' ? 'md:col-span-2' : 'col-span-1'
              } h-full relative group`}
            >
              <div className="bg-white border border-slate-200/90 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-xl hover:border-brand-gold/60 transition-all group relative overflow-hidden h-full">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${kpi.id === 'revenue' ? 'bg-emerald-500' : kpi.id === 'expenses' ? 'bg-rose-500' : kpi.id === 'payments' ? 'bg-sky-500' : 'bg-brand-gold'}`} />
                <div className="flex items-center gap-4 pl-2">
                  <div className={`h-12 w-12 rounded-xl ${kpi.accentBg} flex items-center justify-center border border-slate-200/60 group-hover:scale-110 transition-transform shrink-0`}>
                    {kpi.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        {kpi.title}
                      </span>
                      {widget.pinned && <Pin className="h-3 w-3 text-blue-500 fill-blue-500 shrink-0" />}
                      {widget.favorite && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                    </div>
                    <div className={`text-xl md:text-2xl font-extrabold tracking-tight tabular-nums mt-0.5 text-slate-900 ${kpi.valueColor || ''}`}>
                      {kpi.value}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-1">
                      {kpi.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 pl-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                    Live
                  </span>
                  <div className="w-12 h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-brand-gold rounded-full w-3/4 animate-pulse" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
