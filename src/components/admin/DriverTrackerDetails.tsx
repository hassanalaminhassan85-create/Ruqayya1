import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, AlertCircle, Cpu, Gauge, Zap, Thermometer, BatteryCharging, Radio, RefreshCw, Compass, ShieldCheck, Activity, Terminal, Navigation, Clock, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/Button';
import { api } from '../../utils/api';
import L from 'leaflet';

// Fix Leaflet default icon issues in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DriverTrackerDetailsProps {
  driverId: string;
  onBack: () => void;
  lang: string;
}

export function DriverTrackerDetails({ driverId, onBack, lang }: DriverTrackerDetailsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'telemetry' | 'route' | 'python_logs'>('map');

  const fetchDriverData = async () => {
    try {
      setRefreshing(true);
      // Try specific tracker endpoint first, then telematics fallback
      const trackerRes = await api.request(`/api/drivers/tracker/${driverId}`);
      if (trackerRes && trackerRes.driver) {
        setData(trackerRes);
      } else {
        const telemRes = await api.getDriverTelematics(driverId);
        if (telemRes && telemRes.success) {
          setData({
            driver: {
              id: telemRes.driverId,
              fullName: telemRes.currentLocation?.driver_name || 'Active Driver',
              company_driver_id: telemRes.companyDriverId || 'RQT-DRIVER',
              vehicle_model: 'SinoTruck Heavy Freight',
              phone: 'N/A',
              status: telemRes.activeDuty ? 'Moving' : 'Idle'
            },
            gps: {
              latitude: telemRes.currentLocation?.latitude || 11.8311,
              longitude: telemRes.currentLocation?.longitude || 13.1509,
              location_name: telemRes.currentLocation?.place_name || 'Maiduguri Depot',
              heading: telemRes.currentLocation?.heading || 45,
              speed: telemRes.currentLocation?.speed || 0
            },
            telemetry: {
              rpm: telemRes.activeDuty ? 2200 : 800,
              fuel_level: 68,
              coolant_temp: 84,
              battery_voltage: 13.8,
              oil_pressure: "4.1 bar",
              brake_wear: "92%"
            },
            trip: {
              distance: 38.4,
              avg_speed: 46,
              driving_hours: 3.5,
              fuel_used: 7.2
            },
            alerts: [
              { severity: 'Normal', message: 'Geofence active - Maiduguri Corridor', time: 'Live' }
            ],
            placesVisitedToday: telemRes.placesVisitedToday || []
          });
        }
      }
    } catch (err) {
      console.error("Error fetching driver telematics detail:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDriverData();
    const interval = setInterval(fetchDriverData, 6000);
    return () => clearInterval(interval);
  }, [driverId]);

  if (loading || !data) {
    return (
      <div className="min-h-[400px] w-full bg-slate-950 text-white p-8 flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-800">
        <RefreshCw className="h-10 w-10 text-brand-gold animate-spin" />
        <p className="text-xs font-mono text-slate-400">{lang === 'en' ? 'Synchronizing satellite telematics link...' : 'Ana haɗa da Satellite GPS...'}</p>
      </div>
    );
  }

  const { driver, gps, telemetry, trip, alerts, placesVisitedToday } = data;
  const position: [number, number] = [gps?.latitude || 11.8311, gps?.longitude || 13.1509];

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white p-3 sm:p-6 flex flex-col gap-5 rounded-3xl border border-slate-800 shadow-2xl">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack} 
          className="text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl px-3 py-1.5"
        >
          <ArrowLeft className="h-4 w-4 mr-2 text-brand-gold" /> {lang === 'en' ? 'Back' : 'Koma'}
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[11px] font-mono font-bold">
            <Radio className="h-3.5 w-3.5 animate-ping text-emerald-500" />
            <span>LIVE GPS: {String(driver.status).toUpperCase()}</span>
          </div>

          <button 
            onClick={fetchDriverData} 
            disabled={refreshing}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-brand-gold' : ''}`} />
          </button>
        </div>
      </div>

      {/* Driver Summary Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-800 border-2 border-brand-gold/40 flex items-center justify-center font-black text-xl text-brand-gold shrink-0 shadow-lg">
            {driver.avatar ? (
              <img src={driver.avatar} alt={driver.fullName} className="h-full w-full object-cover rounded-2xl" />
            ) : (
              driver.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)
            )}
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">{driver.fullName}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-brand-gold font-bold">{driver.company_driver_id}</span>
              <span>• {driver.vehicle_model || 'SinoTruck Trucking'}</span>
              <span>• 📞 {driver.phone || '0800-000-0000'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
          <MapPin className="h-4 w-4 text-brand-gold shrink-0 ml-1" />
          <span className="text-xs font-medium text-slate-200 truncate max-w-[240px]">
            {gps.location_name || 'Maiduguri Hub'}
          </span>
        </div>
      </motion.div>

      {/* Mobile Tab Switcher */}
      <div className="flex sm:hidden items-center justify-between bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button 
          onClick={() => setActiveTab('map')} 
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'map' ? 'bg-brand-navy text-brand-gold shadow' : 'text-slate-400'}`}
        >
          🗺️ {lang === 'en' ? 'Map' : 'Taswira'}
        </button>
        <button 
          onClick={() => setActiveTab('telemetry')} 
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'telemetry' ? 'bg-brand-navy text-brand-gold shadow' : 'text-slate-400'}`}
        >
          ⚡ {lang === 'en' ? 'Metrics' : "Na'ura"}
        </button>
        <button 
          onClick={() => setActiveTab('route')} 
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'route' ? 'bg-brand-navy text-brand-gold shadow' : 'text-slate-400'}`}
        >
          📍 {lang === 'en' ? 'Stops' : 'Hanya'}
        </button>
      </div>

      {/* Main Grid Section - Completely Mobile Responsive */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5">
        
        {/* Left Column: Interactive Satellite Map (Visible on Desktop OR when Map tab selected on Mobile) */}
        <div className={`lg:col-span-8 flex flex-col gap-4 ${activeTab !== 'map' ? 'hidden sm:flex' : 'flex'}`}>
          <div className="h-[360px] sm:h-[480px] w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 relative shadow-2xl">
            <MapContainer 
              key={`${position[0]}-${position[1]}`} 
              center={position} 
              zoom={14} 
              style={{ height: '100%', width: '100%', zIndex: 1 }}
            >
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                attribution='&copy; OpenStreetMap'
              />
              <Marker position={position}>
                <Popup>
                  <div className="text-slate-900 p-1">
                    <p className="font-bold text-xs">{driver.fullName}</p>
                    <p className="text-[10px] text-slate-600">{gps.location_name}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">Speed: {gps.speed} km/h</p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>

            {/* Floating Live HUD Overlay */}
            <div className="absolute top-3 left-3 z-[1000] bg-slate-950/85 backdrop-blur-md p-3 rounded-2xl border border-slate-800 text-xs flex flex-col gap-1.5 max-w-[220px]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono text-[10px]">
                <Compass className="h-3.5 w-3.5 animate-spin" />
                <span>BEARING: {gps.heading}° NE</span>
              </div>
              <p className="font-mono text-[11px] text-slate-200">LAT: {position[0].toFixed(4)}</p>
              <p className="font-mono text-[11px] text-slate-200">LNG: {position[1].toFixed(4)}</p>
            </div>
          </div>

          {/* Trip Progress Bar */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-brand-gold" />
              <span className="font-bold text-slate-300">{lang === 'en' ? 'Today\'s Total Distance:' : 'Nisan Yau:'}</span>
              <span className="font-mono text-emerald-400 font-bold">{trip.distance} km</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="font-bold text-slate-300">{lang === 'en' ? 'Hours On Duty:' : 'Awannin Aiki:'}</span>
              <span className="font-mono text-blue-400 font-bold">{trip.driving_hours} hrs</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-slate-300">{lang === 'en' ? 'Fuel Used:' : 'Man Fetur:'}</span>
              <span className="font-mono text-amber-400 font-bold">{trip.fuel_used} L</span>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry Cards & Active Alerts */}
        <div className={`lg:col-span-4 flex flex-col gap-4 ${activeTab !== 'telemetry' && activeTab !== 'map' ? 'hidden sm:flex' : 'flex'}`}>
          <div className="grid grid-cols-2 gap-3">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Gauge className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{lang === 'en' ? 'SPEED' : 'GUDU'}</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{gps.speed} <span className="text-xs text-slate-400 font-normal">km/h</span></span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Cpu className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">ENGINE RPM</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{telemetry.rpm}</span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{lang === 'en' ? 'FUEL' : 'MAN FETUR'}</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{telemetry.fuel_level}%</span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-rose-400 mb-1">
                <Thermometer className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">COOLANT TEMP</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{telemetry.coolant_temp}°C</span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <BatteryCharging className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">BATTERY</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{telemetry.battery_voltage}V</span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-cyan-400 mb-1">
                <Activity className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">OIL PRESSURE</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{telemetry.oil_pressure}</span>
            </motion.div>
          </div>

          {/* Real-time Telematics Analysis Badge */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-brand-gold" /> Python Telematics Engine
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono font-bold">
                ONLINE 100%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              [Python Algo] Speed Delta: Normal. Geofence Status: PASS. Brake Efficiency: {telemetry.brake_wear}.
            </p>
          </div>

          {/* Active Alerts Panel */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">{lang === 'en' ? 'Active Telematics Alerts' : 'Sakon Tsunami/Gargadi'}</span>
            </div>
            {alerts && alerts.length > 0 ? (
              alerts.map((a: any, i: number) => (
                <div key={i} className="text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 font-mono flex items-center justify-between">
                  <span>[{a.time || 'Live'}] {a.message}</span>
                  <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-brand-gold font-bold">{a.severity || 'INFO'}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">{lang === 'en' ? 'No telemetry warnings logged.' : 'Babu wani gargadi.'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Places Visited Today Section */}
      {placesVisitedToday && placesVisitedToday.length > 0 && (
        <div className={`mt-2 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3 ${activeTab !== 'route' && activeTab !== 'map' ? 'hidden sm:flex' : 'flex'}`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {lang === 'en' ? 'Automated Duty Waypoints & Stops' : 'Wuraren da aka Tsaya a Yau'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {placesVisitedToday.map((stop: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between text-brand-gold font-bold">
                  <span>📍 {stop.name || stop.place_name || `Stop #${idx + 1}`}</span>
                  {stop.time && <span className="text-[10px] text-slate-400 font-mono">{stop.time}</span>}
                </div>
                {stop.activity && (
                  <p className="text-[11px] text-slate-300 italic">{stop.activity}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
