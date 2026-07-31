import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/SharedComponents';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Language } from '../../types';

interface CycleStatusSummaryProps {
  lang: Language;
  activeCycle: any;
}

export const CycleStatusSummary: React.FC<CycleStatusSummaryProps> = ({ lang, activeCycle }) => {
  if (!activeCycle || activeCycle.status === 'inactive' || activeCycle.isActive === false) {
    return (
      <Card className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-center items-center text-center gap-2.5 shadow-xs">
        <div className="p-2 bg-amber-50 rounded-full border border-amber-200/60">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            {lang === 'en' ? "Operating Cycle Inactive" : "Babu Zagayen Aiki"}
          </h4>
          <p className="text-[11px] font-semibold text-slate-500 mt-1 max-w-[200px] leading-tight">
            {lang === 'en' ? "No active operating cycle." : "Babu zagayen aiki mai gudana."}
          </p>
        </div>
        {activeCycle?.cycleId && (
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-mono font-bold">
            ID: {activeCycle.cycleId}
          </span>
        )}
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5 font-mono">
          <RefreshCw className="h-4 w-4 text-brand-gold animate-spin-slow" />
          {lang === 'en' ? "Cycle Status Summary" : "Takaitaccen Matsayin Zagaye"}
        </h3>
        <Badge variant={activeCycle.status === 'active' ? 'success' : 'warning'}>
          {activeCycle.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Cycle ID</span>
          <p className="text-xs font-mono font-black text-amber-600 mt-0.5">{activeCycle.cycleId}</p>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Start Date</span>
          <p className="text-xs font-mono font-black text-slate-800 mt-0.5">{activeCycle.startDate}</p>
        </div>
      </div>
    </Card>
  );
};
