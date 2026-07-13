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
  Undo
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
  activeCycle
}) => {
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

  // Raw base KPIs data dictionary
  const rawKpis = [
    {
      id: "total_drivers",
      title: labels.totalDrivers,
      value: totalDrivers,
      subtitle: labels.rosterSize,
      icon: <Users className="h-4 w-4 text-brand-gold" />,
      color: "border-brand-gold",
      accentBg: "bg-brand-gold/10"
    },
    {
      id: "classification",
      title: labels.classification,
      value: `${smartDrivers}/${assistedDrivers}`,
      subtitle: labels.classBreakdown,
      icon: <ShieldCheck className="h-4 w-4 text-blue-500" />,
      color: "border-blue-500",
      accentBg: "bg-blue-500/10"
    },
    {
      id: "rest_active",
      title: labels.restActive,
      value: `${restingDrivers}/${activeDrivers}`,
      subtitle: labels.statusBreakdown,
      icon: <Moon className="h-4 w-4 text-purple-500" />,
      color: "border-purple-500",
      accentBg: "bg-purple-500/10"
    },
    {
      id: "total_vehicles",
      title: labels.totalVehicles,
      value: totalVehicles,
      subtitle: labels.rigAssets,
      icon: <Truck className="h-4 w-4 text-indigo-500" />,
      color: "border-indigo-500",
      accentBg: "bg-indigo-500/10"
    },
    {
      id: "revenue",
      title: labels.revenue,
      value: `₦${revenueTotal.toLocaleString()}`,
      subtitle: labels.freightEarnings,
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      color: "border-emerald-500",
      accentBg: "bg-emerald-500/10",
      valueColor: "text-emerald-500"
    },
    {
      id: "payments",
      title: labels.payments,
      value: `₦${approvedPayments.toLocaleString()}`,
      subtitle: labels.installmentSum,
      icon: <Wallet className="h-4 w-4 text-sky-500" />,
      color: "border-sky-500",
      accentBg: "bg-sky-500/10",
      valueColor: "text-sky-500"
    },
    {
      id: "expenses",
      title: labels.expenses,
      value: `₦${expenseTotal.toLocaleString()}`,
      subtitle: labels.operationalCost,
      icon: <TrendingDown className="h-4 w-4 text-rose-500" />,
      color: "border-rose-500",
      accentBg: "bg-rose-500/10",
      valueColor: "text-rose-500"
    },
    {
      id: "net_amount",
      title: labels.netAmount,
      value: `₦${netEarnings.toLocaleString()}`,
      subtitle: labels.surplus,
      icon: <DollarSign className="h-4 w-4 text-teal-500" />,
      color: "border-teal-500",
      accentBg: "bg-teal-500/10",
      valueColor: netEarnings >= 0 ? "text-emerald-500 font-extrabold" : "text-rose-500 font-extrabold"
    },
    {
      id: "distribution",
      title: labels.distribution,
      value: `₦${distributionPool.toLocaleString()}`,
      subtitle: labels.pooledAmount,
      icon: <Activity className="h-4 w-4 text-amber-500" />,
      color: "border-amber-500",
      accentBg: "bg-amber-500/10",
      valueColor: "text-amber-500"
    },
    {
      id: "cycles",
      title: labels.cycles,
      value: activeCycle ? `${lang === 'en' ? 'Active' : 'Aiki'}` : `${lang === 'en' ? 'Stopped' : 'Tsaya'}`,
      subtitle: labels.cycleState,
      icon: <RefreshCw className="h-4 w-4 text-orange-500 animate-spin-slow" />,
      color: "border-orange-500",
      accentBg: "bg-orange-500/10"
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

      {/* Highly dense, visual, compact grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
        {activeWidgets.map((widget, idx) => {
          const kpi = rawKpis.find(r => r.id === widget.id);
          if (!kpi) return null;

          return (
            <motion.div
              key={widget.id}
              layoutId={`kpi-card-${widget.id}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className={`${
                widget.size === 'wide' ? 'col-span-2' : 'col-span-1'
              } h-full relative group`}
            >
              <Card className={`flex flex-col justify-between p-3.5 h-full bg-bg-surface border-t-2 ${kpi.color} shadow-xs hover:shadow-md border-x border-b border-border-main/50 rounded-xl transition-all duration-200 relative overflow-hidden`}>
                
                {/* Accent Background subtle circle */}
                <div className={`absolute -right-6 -bottom-6 w-20 h-20 rounded-full ${kpi.accentBg} blur-xl opacity-40 pointer-events-none group-hover:scale-125 transition-transform duration-300`} />

                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                      {kpi.title}
                    </span>
                    {widget.pinned && (
                      <Pin className="h-2.5 w-2.5 text-blue-500 fill-blue-500 shrink-0" title="Pinned to top" />
                    )}
                    {widget.favorite && (
                      <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500 shrink-0" title="Favorite Metric" />
                    )}
                  </div>
                  <div className="shrink-0 p-1 rounded-md bg-bg-base border border-border-main/40">
                    {kpi.icon}
                  </div>
                </div>

                <div>
                  <p className={`text-base sm:text-lg md:text-xl font-extrabold tracking-tight tabular-nums leading-tight text-text-main ${kpi.valueColor || ''}`}>
                    {kpi.value}
                  </p>
                  <span className="text-[10px] font-semibold text-text-muted mt-1 block truncate leading-none">
                    {kpi.subtitle}
                  </span>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
