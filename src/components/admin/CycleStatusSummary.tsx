import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/SharedComponents';
import { RefreshCw, Play, Pause, AlertTriangle } from 'lucide-react';
import { Language } from '../../types';

interface CycleStatusSummaryProps {
  lang: Language;
  activeCycle: any;
}

export const CycleStatusSummary: React.FC<CycleStatusSummaryProps> = ({ lang, activeCycle }) => {
  if (!activeCycle) {
    return (
      <Card className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <span className="text-sm font-bold text-slate-600">
          {lang === 'en' ? "No active operating cycle." : "Babu zagayen aiki mai gudana."}
        </span>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4 text-brand-gold" />
          {lang === 'en' ? "Cycle Status Summary" : "Takaitaccen Matsayin Zagaye"}
        </h3>
        <Badge variant={activeCycle.status === 'active' ? 'success' : 'warning'}>
          {activeCycle.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <span className="text-[9px] text-slate-400 font-bold uppercase">Cycle ID</span>
          <p className="text-xs font-mono font-bold text-slate-900">{activeCycle.id}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <span className="text-[9px] text-slate-400 font-bold uppercase">Start Date</span>
          <p className="text-xs font-mono font-bold text-slate-900">{new Date(activeCycle.startDate).toLocaleDateString()}</p>
        </div>
      </div>
    </Card>
  );
};
