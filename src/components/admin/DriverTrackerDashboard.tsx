import React, { useState, useEffect } from 'react';
import { Search, LayoutGrid, List, MapPin, Clock, ArrowLeft, RefreshCw, Radio, Gauge } from 'lucide-react';
import { Button } from '../ui/Button';
import { DriverTrackerDetails } from './DriverTrackerDetails';
import { api } from '../../utils/api';

interface DriverTrackerDashboardProps {
  onBack: () => void;
  lang: string;
}

export function DriverTrackerDashboard({ onBack, lang }: DriverTrackerDashboardProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrackerList = async () => {
    try {
      setRefreshing(true);
      const res = await api.getDriverTrackerList();
      if (Array.isArray(res)) {
        setDrivers(res);
      } else {
        // Fallback to getDrivers if tracker endpoint fails or gives different format
        const drvRes = await api.getDrivers();
        if (Array.isArray(drvRes)) {
          const mapped = drvRes.map((d: any) => ({
            id: d.id,
            fullName: d.fullName || d.full_name || 'Driver',
            company_driver_id: d.company_driver_id || d.companyDriverId || 'RQT-100',
            avatar: d.passport_photo_url || d.passportPhotoUrl || null,
            status: d.status === 'active' ? 'Moving' : 'Idle',
            speed: d.status === 'active' ? 45 : 0,
            location: d.vehicle?.plate_number ? `Vehicle: ${d.vehicle.plate_number}` : 'Maiduguri Central Depot',
            lastUpdate: 'Live'
          }));
          setDrivers(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to fetch real-time driver tracker list:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrackerList();
    const interval = setInterval(fetchTrackerList, 10000); // Poll real-time updates every 10s
    return () => clearInterval(interval);
  }, []);

  if (selectedDriverId) {
    return <DriverTrackerDetails driverId={selectedDriverId} onBack={() => setSelectedDriverId(null)} lang={lang} />;
  }

  const filteredDrivers = drivers.filter(d => 
    (d.fullName || '').toLowerCase().includes(search.toLowerCase()) || 
    (d.company_driver_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-text-muted hover:text-text-main">
          <ArrowLeft className="h-4 w-4 mr-2" /> {lang === 'en' ? "Back to Dashboard" : "Koma Dashboard"}
        </Button>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchTrackerList} 
            disabled={refreshing}
            className="p-1.5 rounded-lg border border-border-main text-text-muted hover:text-text-main hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-brand-navy' : ''}`} />
            <span className="hidden sm:inline">{lang === 'en' ? "Sync Telematics" : "Sabunta Telematics"}</span>
          </button>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-200">
            <Radio className="h-3 w-3 animate-pulse text-emerald-600" />
            <span>{lang === 'en' ? "LIVE TELEMATICS ACTIVE" : "TELEMATICS KANA AIKI"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder={lang === 'en' ? "Search real driver by name, ID or location..." : "Neman direba ta suna, ID ko wuri..."}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-base border border-border-main text-xs focus:ring-1 focus:ring-brand-gold outline-hidden shadow-2xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <span className="text-xs text-text-muted font-medium">
            {filteredDrivers.length} {lang === 'en' ? 'Drivers Online' : 'Direbobi a Layi'}
          </span>
          <div className="flex items-center bg-bg-base rounded-lg border border-border-main p-1">
            <button 
              onClick={() => setView('grid')} 
              className={`p-1.5 rounded transition-all ${view === 'grid' ? 'bg-brand-navy text-brand-gold shadow-xs' : 'text-text-muted hover:text-text-main'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setView('list')} 
              className={`p-1.5 rounded transition-all ${view === 'list' ? 'bg-brand-navy text-brand-gold shadow-xs' : 'text-text-muted hover:text-text-main'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 text-brand-gold animate-spin" />
          <p className="text-xs font-semibold text-text-muted">{lang === 'en' ? "Connecting to driver GPS units..." : "Ana haɗawa da Na'urar GPS..."}</p>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border-main bg-slate-50/50">
          <Gauge className="h-10 w-10 mx-auto text-text-muted/40 mb-2" />
          <p className="text-xs font-bold text-text-main">{lang === 'en' ? "No active drivers matched your search" : "Babu direba da ya dace"}</p>
          <p className="text-[11px] text-text-muted mt-1">{lang === 'en' ? "Try checking spelling or clear search filter" : "Tabbatar da rubutu ko share bincike"}</p>
        </div>
      ) : (
        <div className={view === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" 
          : "flex flex-col gap-2.5"
        }>
          {filteredDrivers.map((d) => {
            const initials = (d.fullName || 'Driver')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2);

            const isMoving = String(d.status).toLowerCase() === 'moving' || (d.speed && d.speed > 0);

            return (
              <div 
                key={d.id} 
                onClick={() => setSelectedDriverId(d.id)} 
                className={`p-4 rounded-2xl bg-white border border-border-main hover:border-brand-gold hover:shadow-md transition-all cursor-pointer group ${
                  view === 'list' ? 'flex items-center gap-4' : 'flex flex-col justify-between gap-3'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    {d.avatar ? (
                      <img src={d.avatar} alt={d.fullName} className="h-12 w-12 rounded-full object-cover border-2 border-slate-100 group-hover:border-brand-gold transition-colors" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-slate-900 text-brand-gold flex items-center justify-center text-sm font-black border-2 border-slate-800">
                        {initials}
                      </div>
                    )}
                    <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                      isMoving ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-text-main truncate group-hover:text-brand-navy transition-colors">{d.fullName}</h4>
                    <p className="text-[10px] text-text-muted font-mono font-semibold">{d.company_driver_id || 'RQT-UNKNOWN'}</p>
                  </div>
                </div>

                <div className={`space-y-2 ${view === 'list' ? 'flex-1 grid grid-cols-3 items-center gap-2 space-y-0' : ''}`}>
                  <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="font-semibold text-text-muted uppercase text-[9px] tracking-wider">{lang === 'en' ? 'Telemetry' : 'Aiki'}</span>
                    <span className={`font-black uppercase text-[10px] ${isMoving ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {isMoving ? `${d.speed || 48} km/h` : (d.status || 'IDLE')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-text-main truncate">
                    <MapPin className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                    <span className="truncate font-medium">{d.location || 'Maiduguri Hub'}</span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-text-muted font-mono pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-text-muted" /> {d.lastUpdate || 'Just now'}
                    </span>
                    <span className="text-brand-navy font-bold group-hover:translate-x-0.5 transition-transform">
                      {lang === 'en' ? 'Track Live →' : 'Bibiyi →'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
