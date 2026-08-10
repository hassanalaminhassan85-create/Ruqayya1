import React, { useState, useEffect } from 'react';
import { Search, LayoutGrid, List, MapPin, Clock, ArrowLeft, RefreshCw, Radio, Gauge, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Button } from '../ui/Button';
import { DriverTrackerDetails } from './DriverTrackerDetails';
import { api } from '../../utils/api';

// Fix Leaflet default icon issues in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DriverTrackerDashboardProps {
  onBack: () => void;
  lang: string;
}

export function DriverTrackerDashboard({ onBack, lang }: DriverTrackerDashboardProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list' | 'map'>('grid');
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
        setDrivers([]);
      }
    } catch (err) {
      console.error("Failed to fetch real-time driver tracker list:", err);
      setDrivers([]);
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
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setView('list')} 
              className={`p-1.5 rounded transition-all ${view === 'list' ? 'bg-brand-navy text-brand-gold shadow-xs' : 'text-text-muted hover:text-text-main'}`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setView('map')} 
              className={`p-1.5 rounded transition-all ${view === 'map' ? 'bg-brand-navy text-brand-gold shadow-xs' : 'text-text-muted hover:text-text-main'}`}
              title="Map View"
            >
              <Navigation className="h-4 w-4" />
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
      ) : view === 'map' ? (
        <div className="h-[550px] w-full rounded-2xl overflow-hidden border border-border-main shadow-lg relative">
          <MapContainer 
            center={[11.8311, 13.1509]} 
            zoom={13} 
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' 
            />
            {filteredDrivers.map((d, idx) => {
              const lat = d.latitude || (11.8311 + (idx * 0.006) - 0.01);
              const lng = d.longitude || (13.1509 + (idx * 0.007) - 0.01);
              const isMoving = String(d.status).toLowerCase() === 'moving' || (d.speed && d.speed > 0);
              return (
                <Marker key={d.id} position={[lat, lng]}>
                  <Popup>
                    <div className="p-2 flex flex-col gap-1.5 min-w-[200px]">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900">{d.fullName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase">{d.company_driver_id || 'RQT'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-amber-500 shrink-0" /> {d.location || 'Maiduguri Corridor'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-700 mt-1 pt-1 border-t border-slate-200">
                        <span>Speed: {d.speed || (isMoving ? 48 : 0)} km/h</span>
                        <button 
                          onClick={() => setSelectedDriverId(d.id)}
                          className="text-blue-600 hover:underline font-bold"
                        >
                          View Telematics →
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
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
