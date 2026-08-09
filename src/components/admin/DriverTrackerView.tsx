import React, { useState } from 'react';
import { Search, LayoutGrid, List, MapPin, Navigation, Clock, ShieldCheck, Activity } from 'lucide-react';
import { Button } from '../ui/Button';

interface DriverTrackerViewProps {
  drivers: any[];
  lang: string;
}

export function DriverTrackerView({ drivers, lang }: DriverTrackerViewProps) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filteredDrivers = drivers.filter(d => 
    d.fullName.toLowerCase().includes(search.toLowerCase()) || 
    (d.company_driver_id || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder={lang === 'en' ? "Search by name or ID..." : "Neman direba..."}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg-base border border-border-main text-xs focus:ring-1 focus:ring-brand-gold outline-hidden"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center bg-bg-base rounded-lg border border-border-main p-1">
          <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-brand-navy text-brand-gold' : 'text-text-muted'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-brand-navy text-brand-gold' : 'text-text-muted'}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={view === 'grid' 
        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" 
        : "flex flex-col gap-2"
      }>
        {filteredDrivers.map((d, i) => {
          // Mock data for tracking simulation
          const status = ['Moving', 'Idle', 'Stopped', 'Offline'][i % 4];
          const speed = status === 'Moving' ? Math.floor(20 + Math.random() * 40) : 0;
          const location = "Maiduguri, Borno";

          return (
            <div key={d.id || i} className={`p-4 rounded-xl bg-white border border-border-main hover:border-brand-gold/50 transition-all ${view === 'list' ? 'flex items-center gap-4' : 'flex flex-col'}`}>
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-500 mb-2">
                {d.avatar ? <img src={d.avatar} className="h-12 w-12 rounded-full" /> : d.fullName.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs">{d.fullName}</h4>
                <p className="text-[10px] text-text-muted font-mono">{d.company_driver_id || `ID-${i}`}</p>
                
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                  <span className={`h-2 w-2 rounded-full ${
                    status === 'Moving' ? 'bg-emerald-500' : 
                    status === 'Idle' ? 'bg-amber-400' :
                    status === 'Stopped' ? 'bg-rose-500' : 'bg-slate-500'
                  }`} />
                  <span className="font-medium text-text-main">{status}</span>
                  {status === 'Moving' && <span className="text-text-muted ml-auto">{speed} km/h</span>}
                </div>
                
                <div className="flex items-center gap-1 mt-1 text-[9px] text-text-muted">
                  <MapPin className="h-3 w-3" /> {location}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
