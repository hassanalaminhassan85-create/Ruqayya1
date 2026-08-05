import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { FinancialRecord, Cycle } from '../../types';

interface ShareholderPerformanceChartProps {
  finance: FinancialRecord[];
  cycles: Cycle[];
  shareholderId?: string;
  lang: 'en' | 'ha';
}

export const ShareholderPerformanceChart: React.FC<ShareholderPerformanceChartProps> = ({
  finance,
  cycles,
  shareholderId,
  lang
}) => {
  // Aggregate data per cycle
  const chartData = cycles
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .map((cycle, index) => {
      const cycleStart = new Date(cycle.startDate);
      const cycleEnd = new Date(cycle.endDate);

      // Filter transactions for this cycle
      const cycleTransactions = finance.filter(f => {
        const transDate = new Date(f.date);
        const matchesDate = transDate >= cycleStart && transDate <= cycleEnd;
        const matchesShareholder = shareholderId === 'all' || !shareholderId || f.referenceId === shareholderId;
        return matchesDate && matchesShareholder;
      });

      const withdrawals = cycleTransactions
        .filter(t => t.type === 'expense' && (t.category === 'dividend' || t.description.toLowerCase().includes('withdrawal')))
        .reduce((sum, t: any) => sum + (parseFloat(t.amount) || 0), 0);

      const reinvestments = cycleTransactions
        .filter(t => t.type === 'revenue' && (t.description.toLowerCase().includes('reinvestment') || t.description.toLowerCase().includes('reinvest')))
        .reduce((sum, t: any) => sum + (parseFloat(t.amount) || 0), 0);

      const capOuts = cycleTransactions
        .filter(t => t.type === 'expense' && (t.description.toLowerCase().includes('redemption') || t.description.toLowerCase().includes('cap out')))
        .reduce((sum, t: any) => sum + (parseFloat(t.amount) || 0), 0);

      return {
        name: `Cycle ${index + 1}`,
        cycleId: cycle.id.substring(0, 8),
        withdrawals,
        reinvestments,
        capOuts,
        total: withdrawals + reinvestments + capOuts
      };
    })
    .filter(d => d.total > 0 || cycles.length <= 5); // Show at least last 5 even if empty, or only non-empty ones if many

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[10px] font-bold text-slate-600 uppercase">{entry.name}:</span>
              </div>
              <span className="text-[10px] font-black text-slate-900 font-mono">₦{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorReinvestments" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorCapOuts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
            tickFormatter={(value) => `₦${(value / 1000)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 20 }}
          />
          <Area 
            type="monotone" 
            dataKey="withdrawals" 
            name={lang === 'en' ? 'Withdrawals' : 'Cirewa'} 
            stroke="#ef4444" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorWithdrawals)" 
          />
          <Area 
            type="monotone" 
            dataKey="reinvestments" 
            name={lang === 'en' ? 'Reinvestments' : 'Sake Zuba Jari'} 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorReinvestments)" 
          />
          <Area 
            type="monotone" 
            dataKey="capOuts" 
            name={lang === 'en' ? 'Cap Outs' : 'Cire Jari'} 
            stroke="#f59e0b" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorCapOuts)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
