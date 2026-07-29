import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { 
  Truck, 
  Wallet, 
  History as HistoryIcon, 
  FileText, 
  User, 
  Activity,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { DailyRemittance, Driver, Vehicle } from '../types';

interface DriverDashboardProps {
  driverName: string;
  lang: 'en' | 'ha';
  dictionary: any;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ 
  driverName, 
  lang, 
  dictionary,
  activeTab, 
  setActiveTab 
}) => {
  const [trips, setTrips] = useState<DailyRemittance[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [driverData, setDriverData] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // In a real app, we would use api.getMe() or similar to get the current driver's data
      const me = await api.getMe();
      if (me && me.role === 'driver') {
        const d = await api.getDriverById(me.id);
        setDriverData(d);
        if (d?.vehicleId) {
          const v = await api.getVehicles().then(list => list.find((item: any) => item.id === d.vehicleId));
          setVehicle(v);
        }
        const p = await api.getPayments(me.id);
        setPayments(p || []);
        const t = await api.getTrips().then(list => list.filter((item: any) => item.driverId === me.id));
        setTrips(t || []);
      }
    } catch (err) {
      console.error("Failed to fetch driver data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !driverData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-brand-gold">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === 'en' ? "Active Vehicle" : "Motar da Kake Aiki"}
                </p>
                <h3 className="text-xl font-black mt-1 text-slate-900">
                  {vehicle?.plateNumber || "---"}
                </h3>
              </div>
              <div className="p-3 bg-brand-gold/10 rounded-xl text-brand-gold">
                <Truck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === 'en' ? "Total Payments" : "Jimillar Biyan Kudi"}
                </p>
                <h3 className="text-xl font-black mt-1 text-slate-900">
                  ₦{payments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === 'en' ? "Trips Completed" : "Tafiyar da aka kammala"}
                </p>
                <h3 className="text-xl font-black mt-1 text-slate-900">
                  {trips.filter(t => t.status === 'completed').length}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-brand-gold" />
            {lang === 'en' ? "Recent Activity" : "Ayyukan Kwanan Nan"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trips.slice(0, 5).map((trip, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{trip.destination}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : '---'}
                    </p>
                  </div>
                </div>
                <Badge variant={trip.status === 'completed' ? 'success' : 'warning'}>
                  {trip.status}
                </Badge>
              </div>
            ))}
            {trips.length === 0 && (
              <p className="text-center py-6 text-sm text-slate-400 italic">
                {lang === 'en' ? "No recent trips found." : "Ba a sami tafiye-tafiye ba."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 bg-bg-base min-h-screen">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl text-white border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-2xl font-black tracking-tight">
            {lang === 'en' ? `Welcome, ${driverName}` : `Barka da zuwa, ${driverName}`}
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-md">
            {lang === 'en' 
              ? "Monitor your fleet performance, track remittances, and manage your documents in one central hub."
              : "Bibiyar aikinka, duba biyan kudinka, da kuma sarrafa takardun aikinka a wuri daya."}
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-4 bg-brand-gold/10 rounded-2xl border border-brand-gold/20">
            <CircularLogo size="sm" />
          </div>
        </div>
      </div>

      <Tabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabs={[
          { id: 'overview', label: lang === 'en' ? "Overview" : "Bayanai", icon: <Layers className="h-4 w-4" /> },
          { id: 'vehicle', label: lang === 'en' ? "My Vehicle" : "Motata", icon: <Truck className="h-4 w-4" /> },
          { id: 'payments', label: lang === 'en' ? "Payments" : "Biyan Kudi", icon: <Wallet className="h-4 w-4" /> },
          { id: 'history', label: lang === 'en' ? "History" : "Tarihi", icon: <HistoryIcon className="h-4 w-4" /> },
          { id: 'documents', label: lang === 'en' ? "Documents" : "Takardu", icon: <FileText className="h-4 w-4" /> },
          { id: 'profile', label: lang === 'en' ? "Profile" : "Akuna", icon: <User className="h-4 w-4" /> },
        ]}
      />

      <div className="mt-2">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab !== 'overview' && (
          <Card className="py-20">
            <CardContent className="flex flex-col items-center text-center">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
                <Clock className="h-10 w-10 text-brand-gold animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                {lang === 'en' ? "View Under Maintenance" : "Ana Gyaran Wannan Bangaren"}
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                We are currently enhancing the <strong>{activeTab}</strong> module to provide you with better insights and smoother operations.
              </p>
              <Button 
                onClick={() => setActiveTab('overview')}
                className="mt-6"
                variant="outline"
              >
                {lang === 'en' ? "Back to Overview" : "Koma Babban Shafin"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Helper components for icons and logo
const Layers = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);

const CircularLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };
  return (
    <div className={`${sizes[size]} rounded-full bg-brand-gold flex items-center justify-center font-black text-slate-950 text-xs`}>
      RQ
    </div>
  );
};
