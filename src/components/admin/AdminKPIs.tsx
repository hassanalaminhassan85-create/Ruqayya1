import React from 'react';
import { motion } from 'motion/react';
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
  RefreshCw 
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

  // Render variables
  const labels = {
    en: {
      totalDrivers: "Total Drivers",
      rosterSize: "r roster size",
      classification: "Smart / Assisted",
      classBreakdown: `${smartDrivers} Smart • ${assistedDrivers} Assisted`,
      restActive: "Rest / Active",
      statusBreakdown: `${restingDrivers} On Rest • ${activeDrivers} Active`,
      totalVehicles: "Total Vehicles",
      rigAssets: `${vehicles.filter(v => v.status === 'assigned').length} assigned • ${vehicles.filter(v => v.status === 'idle').length} idle`,
      revenue: "Total Revenue",
      freightEarnings: "Remittance & Contract earnings",
      payments: "Driver Payments",
      installmentSum: "Approved installments",
      expenses: "Total Expenses",
      operationalCost: "Operational & Maintenance spend",
      netAmount: "Net Balance",
      surplus: "Net company value",
      distribution: "Shareholder Div Pool",
      pooledAmount: "2% of net income pooled",
      cycles: "Operating Cycle",
      cycleState: activeCycle 
        ? `Active (Started: ${new Date(activeCycle.startDate).toLocaleDateString()})` 
        : "No Active 30-Day Cycle"
    },
    ha: {
      totalDrivers: "Jimillar Direbobi",
      rosterSize: "Yawan direbobi a rajista",
      classification: "Wayoyi (Smart / Assisted)",
      classBreakdown: `${smartDrivers} Smart • ${assistedDrivers} Assisted`,
      restActive: "Hutu / Aiki",
      statusBreakdown: `${restingDrivers} Suna Hutu • ${activeDrivers} Suna Aiki`,
      totalVehicles: "Jimillar Motoci",
      rigAssets: `${vehicles.filter(v => v.status === 'assigned').length} aiki • ${vehicles.filter(v => v.status === 'idle').length} marasa aiki`,
      revenue: "Kudin Shiga (Revenue)",
      freightEarnings: "Kudaden remittance da kwangiloli",
      payments: "Kudaden Direbobi",
      installmentSum: "Kudaden installments da aka amince",
      expenses: "Kudin da aka Kashe",
      operationalCost: "Gyaran motoci da man fetur",
      netAmount: "Riba/Kudin da Ya Rage",
      surplus: "Kudaden kamfani na yanzu",
      distribution: "Kudin Masu Hannun Jari",
      pooledAmount: "An ware kashi 2% na riba",
      cycles: "Zangon Aiki (Cycle)",
      cycleState: activeCycle 
        ? `Zango na Aiki (An fara: ${new Date(activeCycle.startDate).toLocaleDateString()})` 
        : "Babu Zangon Aiki a Yanzu"
    }
  }[lang];

  const kpis = [
    {
      id: "total_drivers",
      title: labels.totalDrivers,
      value: totalDrivers,
      subtitle: labels.rosterSize,
      icon: <Users className="h-4 w-4 text-brand-gold" />,
      color: "border-l-4 border-brand-gold"
    },
    {
      id: "classification",
      title: labels.classification,
      value: `${smartDrivers}/${assistedDrivers}`,
      subtitle: labels.classBreakdown,
      icon: <ShieldCheck className="h-4 w-4 text-blue-500" />,
      color: "border-l-4 border-blue-500"
    },
    {
      id: "rest_active",
      title: labels.restActive,
      value: `${restingDrivers}/${activeDrivers}`,
      subtitle: labels.statusBreakdown,
      icon: <Moon className="h-4 w-4 text-purple-500" />,
      color: "border-l-4 border-purple-500"
    },
    {
      id: "total_vehicles",
      title: labels.totalVehicles,
      value: totalVehicles,
      subtitle: labels.rigAssets,
      icon: <Truck className="h-4 w-4 text-indigo-500" />,
      color: "border-l-4 border-indigo-500"
    },
    {
      id: "revenue",
      title: labels.revenue,
      value: `₦${revenueTotal.toLocaleString()}`,
      subtitle: labels.freightEarnings,
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      color: "border-l-4 border-emerald-500",
      isMoney: true
    },
    {
      id: "payments",
      title: labels.payments,
      value: `₦${approvedPayments.toLocaleString()}`,
      subtitle: labels.installmentSum,
      icon: <Wallet className="h-4 w-4 text-sky-500" />,
      color: "border-l-4 border-sky-500",
      isMoney: true
    },
    {
      id: "expenses",
      title: labels.expenses,
      value: `₦${expenseTotal.toLocaleString()}`,
      subtitle: labels.operationalCost,
      icon: <TrendingDown className="h-4 w-4 text-rose-500" />,
      color: "border-l-4 border-rose-500",
      isMoney: true
    },
    {
      id: "net_amount",
      title: labels.netAmount,
      value: `₦${netEarnings.toLocaleString()}`,
      subtitle: labels.surplus,
      icon: <DollarSign className="h-4 w-4 text-teal-500" />,
      color: "border-l-4 border-teal-500",
      isMoney: true,
      valueColor: netEarnings >= 0 ? "text-emerald-500" : "text-rose-500"
    },
    {
      id: "distribution",
      title: labels.distribution,
      value: `₦${distributionPool.toLocaleString()}`,
      subtitle: labels.pooledAmount,
      icon: <Activity className="h-4 w-4 text-amber-500" />,
      color: "border-l-4 border-amber-500",
      isMoney: true
    },
    {
      id: "cycles",
      title: labels.cycles,
      value: activeCycle ? `${lang === 'en' ? 'Active' : 'Aiki'}` : `${lang === 'en' ? 'Stopped' : 'Tsaya'}`,
      subtitle: labels.cycleState,
      icon: <RefreshCw className="h-4 w-4 text-orange-500" />,
      color: "border-l-4 border-orange-500"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, idx) => (
        <motion.div
          key={kpi.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.04 }}
        >
          <Card className={`flex flex-col gap-2 p-5 h-full bg-bg-surface ${kpi.color} shadow-xs border border-border-main/40`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">
                {kpi.title}
              </span>
              {kpi.icon}
            </div>
            <div>
              <p className={`text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight tabular-nums leading-none text-text-main ${kpi.valueColor || ''}`}>
                {kpi.value}
              </p>
              <span className="text-[14px] font-medium text-text-muted mt-2 block">
                {kpi.subtitle}
              </span>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};
