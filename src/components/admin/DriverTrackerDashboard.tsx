import React, { useState } from 'react';
import { Search, LayoutGrid, List, MapPin, Navigation, Clock, ShieldCheck, Activity, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { DriverTrackerDetails } from './DriverTrackerDetails';

// Sample Driver Data
const MOCK_DRIVERS = Array.from({ length: 12 }).map((_, i) => ({
  id: `drv_${i}`,
  company_driver_id: `RQT-${(100 + i).toString()}`,
  fullName: ['Ahmed Musa', 'Bala Ibrahim', 'Chinedu Okafor', 'Fatima Bello', 'Garba Suleiman', 'Hauwa Abubakar', 'Jamilu Usman', 'Kabir Lawal', 'Ladi Hassan', 'Musa Danjuma', 'Ngozi Adeyemi', 'Oluwaseun Ade'][i % 12],
  avatar: null, // Initials will be used
  status: ['Moving', 'Idle', 'Stopped', 'Offline'][i % 4],
  speed: [45, 0, 0, 0][i % 4] + Math.floor(Math.random() * 20),
  location: ['Maiduguri Hub', 'Biu Road', 'Airport Corridor', 'University Area'][i % 4],
  lastUpdate: '2 mins ago',
}));

interface DriverTrackerDashboardProps {
  onBack: () => void;
  lang: string;
}

export function DriverTrackerDashboard({ onBack, lang }: DriverTrackerDashboardProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  if (selectedDriverId) {
    return <DriverTrackerDetails driverId={selectedDriverId} onBack={() => setSelectedDriverId(null)} lang={lang} />;
  }

  const filteredDrivers = MOCK_DRIVERS.filter(d => 
    d.fullName.toLowerCase().includes(search.toLowerCase()) || 
    (d.company_driver_id || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-text-muted hover:text-text-main">
          <ArrowLeft className="h-4 w-4 mr-2" /> {lang === 'en' ? "Back to Dashboard" : "Koma Dashboard"}
        </Button>
        <h2 className="text-lg font-black text-text-main">📍 {lang === 'en' ? "Driver Tracker" : "Kula da Direbobi"}</h2>
      </div>

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
          <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'brand-navy' ? 'bg-brand-navy text-brand-gold' : 'text-text-muted'}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={view === 'grid' 
        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" 
        : "flex flex-col gap-2"
      }>
        {filteredDrivers.map((d) => (
          <div key={d.id} onClick={() => setSelectedDriverId(d.id)} className={`p-4 rounded-xl bg-white border border-border-main hover:border-brand-gold/50 transition-all cursor-pointer ${view === 'list' ? 'flex items-center gap-4' : 'flex flex-col'}`}>
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0">
              {d.fullName.split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-xs">{d.fullName}</h4>
              <p className="text-[10px] text-text-muted font-mono">{d.company_driver_id}</p>
              
              <div className="flex items-center gap-2 mt-2 text-[10px]">
                <span className={`h-2 w-2 rounded-full ${
                  d.status === 'Moving' ? 'bg-emerald-500' : 
                  d.status === 'Idle' ? 'bg-amber-400' :
                  d.status === 'Stopped' ? 'bg-rose-500' : 'bg-slate-500'
                }`} />
                <span className="font-medium text-text-main uppercase">{d.status}</span>
                {d.status === 'Moving' && <span className="text-text-muted ml-auto">{d.speed} km/h</span>}
              </div>
              
              <div className="flex items-center gap-1 mt-1 text-[9px] text-text-muted">
                <MapPin className="h-3 w-3" /> {d.location}
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[9px] text-text-muted font-mono">
                <Clock className="h-3 w-3" /> {d.lastUpdate}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
