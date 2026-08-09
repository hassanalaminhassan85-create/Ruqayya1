import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, AlertCircle, Cpu, Gauge, Zap, Thermometer, BatteryCharging } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'motion/react';
import { Button } from '../ui/Button';
import L from 'leaflet';

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

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-700 flex flex-col justify-between"
  >
    <div className="flex items-center gap-2 text-slate-400 mb-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-2xl font-black text-white font-mono">{value}</span>
  </motion.div>
);

export function DriverTrackerDetails({ driverId, onBack, lang }: DriverTrackerDetailsProps) {
  const [driver, setDriver] = useState<any>(null);

  useEffect(() => {
    // Simulate data fetch for now
    setDriver({
      fullName: 'Ahmad Musa',
      company_driver_id: 'RTY-778',
      status: 'Moving',
      location: [11.8311, 13.1509],
      speed: 65,
      telemetry: { rpm: 2400, fuel_level: 45, coolant_temp: 85, battery_voltage: 13.8 },
      alerts: [{ severity: 'Warning', message: 'Speeding detected', time: '10:25' }]
    });
  }, [driverId]);

  if (!driver) return <div className="text-white">Loading...</div>;

  return (
    <div className="h-screen w-full bg-slate-950 text-white p-4 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="text-xs font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-800 text-emerald-400">
          LIVE TRACKING: {driver.status.toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-4 grid-rows-3 gap-4 h-full">
        <div className="col-span-3 row-span-3 rounded-3xl overflow-hidden border border-slate-700 bg-slate-900 relative">
          <MapContainer key={driver.location.join(',')} center={driver.location} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={driver.location}>
              <Popup>{driver.fullName}</Popup>
            </Marker>
          </MapContainer>
          <div className="absolute top-4 left-4 z-[1000] bg-slate-950/80 backdrop-blur p-4 rounded-2xl border border-slate-700">
            <h2 className="text-xl font-black">{driver.fullName}</h2>
            <p className="text-xs text-slate-400 font-mono">{driver.company_driver_id}</p>
          </div>
        </div>

        <StatCard icon={Gauge} label="Speed" value={`${driver.speed} km/h`} color="text-emerald-400" />
        <StatCard icon={Cpu} label="RPM" value={driver.telemetry.rpm} color="text-blue-400" />
        <StatCard icon={Zap} label="Fuel" value={`${driver.telemetry.fuel_level}%`} color="text-amber-400" />
        <StatCard icon={Thermometer} label="Temp" value={`${driver.telemetry.coolant_temp}°C`} color="text-rose-400" />
        <StatCard icon={BatteryCharging} label="Battery" value={`${driver.telemetry.battery_voltage}V`} color="text-purple-400" />
        
        <motion.div 
            className="col-span-1 row-span-1 bg-rose-900/20 backdrop-blur-md p-4 rounded-2xl border border-rose-900/50 flex flex-col"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex items-center gap-2 text-rose-400 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Active Alerts</span>
            </div>
            {driver.alerts.map((a: any, i: number) => (
                <div key={i} className="text-xs text-rose-100 bg-rose-950/50 p-2 rounded-lg font-mono">
                    [{a.time}] {a.severity}: {a.message}
                </div>
            ))}
        </motion.div>
      </div>
    </div>
  );
}

