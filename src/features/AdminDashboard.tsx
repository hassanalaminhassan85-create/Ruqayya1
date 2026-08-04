/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import EnterpriseDirectory from '../components/admin/EnterpriseDirectory';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Alert, Tabs, Modal, ProgressBar } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { SecureSession } from '../utils/security';
import { Vehicle, Driver, DailyRemittance, Dictionary, Language, FinancialRecord, Shareholder } from '../types';
import { 
  Truck, 
  Users, 
  MapPin, 
  Fuel, 
  CirclePlus, 
  Plus,
  ClipboardCheck, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Search, 
  X,
  Navigation,
  FileText,
  User,
  Activity,
  Layers,
  AlertTriangle,
  UserCheck,
  UserX,
  RotateCcw,
  MessageSquare,
  Wallet,
  Coins,
  Settings,
  Camera,
  Edit3,
  Sparkles
} from 'lucide-react';

import { AdminKPIs } from '../components/admin/AdminKPIs';
import { FinancialCommandCenter } from '../components/admin/FinancialCommandCenter';
import { Driver360Modal } from '../components/admin/Driver360Modal';
import { RegisterAssistedDriverModal } from '../components/admin/RegisterAssistedDriverModal';
import { DocumentHub } from '../components/admin/DocumentHub';
import { CommunicationCenter } from '../components/admin/CommunicationCenter';
import { PaymentWorkflow } from '../components/admin/PaymentWorkflow';
import { CompanyOperationsCard } from '../components/admin/CompanyOperationsCard';
import { CompanyWalletCard } from '../components/admin/CompanyWalletCard';
import { SystemStatusCard } from '../components/admin/SystemStatusCard';
import { CycleStatusSummary } from '../components/admin/CycleStatusSummary';
import { PeopleManagement } from '../components/admin/PeopleManagement';
import { CycleTimer } from '../components/director/CycleTimer';
import { CountdownTimer } from '../components/CountdownTimer';
import { ActivityFeed } from '../components/admin/ActivityFeed';
import { subscribeToActiveCycle } from '../utils/cycleService';

interface AdminDashboardProps {
  lang: Language;
  dictionary: Dictionary;
  activeTab?: 'dashboard' | 'fleet' | 'drivers' | 'trips' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory' | 'people' | 'settings';
  setActiveTab?: (tab: 'dashboard' | 'fleet' | 'drivers' | 'trips' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory' | 'people' | 'settings') => void;
  activeCycle?: any;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, dictionary, activeTab: propActiveTab, setActiveTab: propSetActiveTab, activeCycle: propActiveCycle }) => {
  // Tabs & Views
  const [localActiveTab, setLocalActiveTab] = useState<'dashboard' | 'fleet' | 'drivers' | 'trips' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory' | 'people' | 'settings'>('dashboard');
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;
  
  // Storage states
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<DailyRemittance[]>([]);
  const [finance, setFinance] = useState<FinancialRecord[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [localActiveCycle, setLocalActiveCycle] = useState<any>(null);
  const activeCycle = propActiveCycle !== undefined ? propActiveCycle : localActiveCycle;
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // Admin profile & avatar states
  const [adminName, setAdminName] = useState('Operations Admin');
  const [adminAvatar, setAdminAvatar] = useState('');
  const [adminId, setAdminId] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempAdminName, setTempAdminName] = useState('');
  const [tempAdminAvatar, setTempAdminAvatar] = useState('');

  useEffect(() => {
    api.getMe().then(payload => {
      if (payload && payload.user) {
        setAdminId(payload.user.id);
        
        const backendName = payload.user.full_name || payload.user.fullName;
        const savedName = localStorage.getItem(`ruqayya_admin_name_${payload.user.id}`);
        const finalName = backendName || savedName || 'Operations Admin';
        setAdminName(finalName);
        setTempAdminName(finalName);
        
        const backendAvatar = payload.user.avatar || payload.user.passportPhotoUrl || payload.user.passport_photo_url || payload.user.profile?.passport_photo_url;
        const savedAvatar = localStorage.getItem(`ruqayya_admin_avatar_${payload.user.id}`);
        const finalAvatar = backendAvatar || savedAvatar || '';
        setAdminAvatar(finalAvatar);
        setTempAdminAvatar(finalAvatar);
      }
    }).catch(() => {
       setAdminName('Operations Admin');
       setAdminAvatar('');
       setTempAdminName('Operations Admin');
       setTempAdminAvatar('');
    });
  }, []);

  // Filter States
  const [driverFilter, setDriverFilter] = useState<'all' | 'pending' | 'approved' | 'correction_requested' | 'rejected'>('all');
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetPage, setFleetPage] = useState(1);
  const itemsPerPage = 5;

  // Modal States
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isDispatchTripOpen, setIsDispatchTripOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewDriver, setSelectedReviewDriver] = useState<Driver | null>(null);
  
  // 360 & Register Assisted States
  const [selected360Driver, setSelected360Driver] = useState<Driver | null>(null);
  const [isRegisterAssistedOpen, setIsRegisterAssistedOpen] = useState(false);

  // New Vehicle form state
  const [plateNumber, setPlateNumber] = useState('');
  const [model, setModel] = useState('');
  const [capacity, setCapacity] = useState('30 Tons');
  const [fuelType, setFuelType] = useState<'diesel' | 'petrol'>('diesel');
  const [vehicleError, setVehicleError] = useState('');

  // New Trip form state
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [tricycleType, setTricycleType] = useState('');
  const [weight, setWeight] = useState(30);
  const [charges, setCharges] = useState(1500000);
  const [tripError, setTripError] = useState('');

  // Approval Workflow Modal state
  const [companyDriverId, setCompanyDriverId] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [lookupTerms, setLookupTerms] = useState<{ agreedAmount: number, purchasePrice: number } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Secure System Reset States & Handler
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const handleExecuteSystemReset = async () => {
    if (resetConfirmText !== 'RESET RUQAYYA ERP') {
      setResetStatus(lang === 'en' ? "Please type RESET RUQAYYA ERP exactly to confirm." : "Da fatan za a rubuta RESET RUQAYYA ERP daidai don tabbatarwa.");
      return;
    }
    setResetLoading(true);
    setResetStatus(lang === 'en' ? "Initializing database purge..." : "Ana fara share ma'ajiyar bayanai...");
    try {
      await api.resetTestData(resetConfirmText);
      setResetStatus(lang === 'en' ? "Success! All operational test data wiped. Reloading environment..." : "An yi nasara! An goge dukkan bayanan gwaji. Ana sake loda tsarin...");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setResetStatus(lang === 'en' ? `Error: ${err.message || "Failed to execute system reset."}` : `Kuskure: Goge tsarin ya gaza.`);
      setResetLoading(false);
    }
  };

  useEffect(() => {
    if (selectedReviewDriver) {
      setLookupLoading(true);
      setLookupTerms(null);
      api.getContractLookup(selectedReviewDriver.id)
        .then((terms: any) => {
          setLookupTerms(terms);
          setLookupLoading(false);
        })
        .catch((err) => {
          console.error("Contract lookup failed:", err);
          setLookupLoading(false);
        });
    } else {
      setLookupTerms(null);
    }
  }, [selectedReviewDriver]);

  const syncAllData = async () => {
    const token = api.getToken();
    if (!token || token === 'null' || token === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      const [vList, dList, tList, fin, payList, shList, logList] = await Promise.all([
        api.getVehicles().catch(() => []),
        api.getDrivers().catch(() => []),
        api.getTrips().catch(() => []),
        api.getFinance().catch(() => []),
        api.getPayments().catch(() => []),
        api.getShareholders().catch(() => []),
        api.getAuditLogs().catch(() => [])
      ]);
      setVehicles(vList || []);
      setDrivers(dList || []);
      setTrips(tList || []);
      setFinance(fin || []);
      setPayments(payList || []);
      setShareholders(shList || []);
      setLogs(logList || []);
      
      const revTotal = (fin || [])
        .filter((f: any) => f.type === 'revenue')
        .reduce((sum: number, r: any) => sum + r.amount, 0);
      setTotalEarnings(revTotal);
    } catch (e) {
      console.error("Failed to sync backend data in AdminDashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleOpenAssisted = () => {
      setIsRegisterAssistedOpen(true);
    };

    window.addEventListener('open-assisted-driver', handleOpenAssisted);

    const unsubscribe = propActiveCycle !== undefined ? () => {} : subscribeToActiveCycle((data) => {
      if (data) {
        console.log('[AdminDashboard] Received cycle update:', data);
        setLocalActiveCycle({
          ...data,
          id: data.cycleId // Ensure id is mapped if components expect .id
        });
      } else {
        console.log('[AdminDashboard] No active cycle received');
        setLocalActiveCycle(null);
      }
    });

    return () => {
      window.removeEventListener('open-assisted-driver', handleOpenAssisted);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    syncAllData();
    
    // Establish real-time SSE stream sync
    const token = SecureSession.getToken() || '';
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'db_update') {
            (window as any).lastSSEState = data;
            window.dispatchEvent(new CustomEvent('db-change', { detail: data }));

            setVehicles(data.vehicles || []);
            setDrivers(data.drivers || []);
            setTrips(data.trip_manifests || []);
            setFinance(data.financials || []);
            setPayments(data.driver_payments || []);
            if (data.shareholders) setShareholders(data.shareholders);
            if (data.audit_logs) setLogs(data.audit_logs);
            if (data.cycles) setLocalActiveCycle(data.cycles.find((c: any) => c.isActive) || null);
            
            const revTotal = (data.financials || [])
              .filter((f: any) => f.type === 'revenue')
              .reduce((sum: number, r: any) => sum + r.amount, 0);
            setTotalEarnings(revTotal);
          }
        } catch (err) {
          console.error("Failed to parse live stream chunk in AdminDashboard:", err);
        }
      };

      eventSource.onerror = () => {
        console.warn("SSE connection interrupted. Reverting to backup interval polling.");
      };
    } catch (e) {
      console.warn("EventSource creation blocked or unsupported in this sandboxed context:", e);
    }

    const interval = setInterval(syncAllData, 5000);
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, []);

  // Handlers
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleError('');
    if (!plateNumber || !model) {
      setVehicleError(lang === 'en' ? "Plate number and model parameters are mandatory." : "Dole ne ka shigar da lambar mota da irin ta.");
      return;
    }

    try {
      await api.addVehicle({
        plateNumber,
        model,
        capacity,
        fuelType
      });
      setPlateNumber('');
      setModel('');
      setIsAddVehicleOpen(false);
      syncAllData();
    } catch (err: any) {
      setVehicleError(err.message || "Failed to register vehicle.");
    }
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTripError('');

    if (!selectedVehicle || !selectedDriver || !origin || !destination || !tricycleType) {
      setTripError(lang === 'en' ? "Please compile all dispatch dispatch parameters." : "Da fatan za a cika duka filayen da ake buƙata.");
      return;
    }

    try {
      await api.addTrip({
        vehicleId: selectedVehicle,
        driverId: selectedDriver,
        origin,
        destination,
        tricycleType,
        weight,
        remittanceAmount: charges
      });
      setSelectedVehicle('');
      setSelectedDriver('');
      setOrigin('');
      setDestination('');
      setTricycleType('');
      setIsDispatchTripOpen(false);
      syncAllData();
    } catch (err: any) {
      setTripError(err.message || "Failed to dispatch tricycle fleet.");
    }
  };


  const handleCompleteTrip = async (tripId: string) => {
    try {
      await api.completeTrip(tripId);
      syncAllData();
    } catch (err) {
      console.error("Daily remittance update failed:", err);
    }
  };

  // Approval Workflow Submit
  const handleReviewAction = async (status: 'approved' | 'rejected' | 'correction_requested') => {
    if (!selectedReviewDriver) return;
    setReviewError('');
    setReviewSuccess('');

    if (status === 'approved' && !companyDriverId) {
      setReviewError(lang === 'en' ? "Please allocate a company driver ID node." : "Da fatan za a samar da lambar shaida ta direba.");
      return;
    }
    if (status === 'correction_requested' && !reviewRemarks) {
      setReviewError(lang === 'en' ? "Feedback remarks are required for requesting candidate correction." : "Ana buƙatar bayanai don neman gyara.");
      return;
    }

    try {
      await api.updateDriverStatus(selectedReviewDriver.id, {
        status,
        companyDriverId,
        remarks: reviewRemarks
      });

      setReviewSuccess(lang === 'en' ? `Driver application committed successfully as ${status.toUpperCase()}!` : `An kammala tantancewa cikin nasara: ${status}!`);
      setReviewRemarks('');
      setCompanyDriverId('');
      
      setTimeout(() => {
        setIsReviewModalOpen(false);
        setSelectedReviewDriver(null);
        syncAllData();
      }, 1200);
    } catch (err: any) {
      setReviewError(err.message || "Approval transaction processing failed.");
    }
  };

  const handleClassifyDriverToggle = async (driverId: string, currentClass: 'Smart' | 'Assisted') => {
    const nextClass = currentClass === 'Smart' ? 'Assisted' : 'Smart';
    try {
      await api.classifyDriver(driverId, nextClass);
      syncAllData();
    } catch (err) {
      console.error("Classification transition failed:", err);
    }
  };

  // Filter Drivers based on Selector Tab
  const filteredDrivers = drivers.filter(d => {
    if (driverFilter === 'all') return true;
    if (driverFilter === 'pending') return d.status === 'pending';
    if (driverFilter === 'approved') return d.status === 'approved' || d.status === 'available' || d.status === 'on-trip' || d.status === 'off-duty';
    if (driverFilter === 'correction_requested') return d.status === 'correction_requested';
    if (driverFilter === 'rejected') return d.status === 'rejected';
    return true;
  });

  const filteredVehicles = vehicles.filter(v => 
    String(v.plateNumber || '').toLowerCase().includes(String(fleetSearch || '').toLowerCase()) ||
    String(v.model || '').toLowerCase().includes(String(fleetSearch || '').toLowerCase())
  );

  const paginatedVehicles = filteredVehicles.slice(
    (fleetPage - 1) * itemsPerPage,
    fleetPage * itemsPerPage
  );

  const totalRigs = vehicles.length;
  const activeTripsCount = trips.filter(t => t.status === 'in-transit').length;

  return (
    <div className="flex flex-col gap-3 w-full flex-1 max-w-7xl mx-auto p-2 md:p-4 bg-bg-base">
      
      {activeTab === 'dashboard' && (
        <>
          {/* Header with quick indicators and high-motion welcome profile avatar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-main/50 pb-3 mb-2">
            <div className="flex items-center gap-3.5">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative cursor-pointer group"
                onClick={() => setIsProfileModalOpen(true)}
                title="Click to edit profile & upload avatar"
              >
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-brand-gold via-amber-400 to-blue-500 opacity-75 blur-xs group-hover:opacity-100 animate-spin" style={{ animationDuration: '6s' }} />
                <div className="relative h-14 w-14 rounded-full bg-slate-900 border-2 border-brand-gold overflow-hidden flex items-center justify-center shadow-lg">
                  {adminAvatar ? (
                    <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }} src={adminAvatar} alt={adminName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-brand-gold font-black text-sm">{adminName.split(' ').map(n => n[0]).join('').substring(0, 2)}</span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 h-4 w-4 bg-brand-gold rounded-full border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-xs">
                  <Edit3 className="h-2 w-2 font-bold" />
                </div>
              </motion.div>

              <div>
                <motion.span 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[11px] font-black tracking-widest text-brand-gold uppercase flex items-center gap-1.5"
                >
                  <Sparkles className="h-3 w-3 animate-pulse text-brand-gold" />
                  {(() => {
                    const hours = new Date().getHours();
                    let greeting = "Good Morning";
                    if (hours >= 12 && hours < 17) greeting = "Good Afternoon";
                    if (hours >= 17) greeting = "Good Evening";
                    
                    if (lang === 'ha') {
                      if (hours < 12) greeting = "In kwana lafiya (Barka da Safiya)";
                      else if (hours < 17) greeting = "Barka da Rana";
                      else greeting = "Barka da Yamma";
                    }
                    return `${greeting}, ${adminName} 🚀✨`;
                  })()}
                </motion.span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <h2 className="text-base font-black tracking-tight text-text-main uppercase flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand-gold animate-ping" />
                    {lang === 'en' ? "Admin Operations Control" : "Gudanarwar Masu Kula (Admin)"} 👑
                  </h2>
                </div>
                <p className="text-[10px] text-text-muted mt-0.5 leading-snug font-semibold">
                  {lang === 'en' ? "Tricycle lease assets, certified driver registry nodes, and remittance ledger control." : "Kekunan napep, tantance direbobi, da duba kudaden remittance."}
                </p>
              </div>
            </div>

            {/* Telemetry Indicator */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] font-bold shadow-xs">
                SECURE ACCESS II 🛡️
              </span>
              <span className="px-2 py-1 rounded-lg bg-brand-gold/10 border border-brand-gold/20 text-brand-gold font-mono text-[9px] font-bold shadow-xs">
                FLEET: {vehicles.length} RIGS 🛺
              </span>
              <span className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 font-mono text-[9px] font-bold shadow-xs">
                DRIVERS: {drivers.length} ACTIVE 👤
              </span>
            </div>
          </div>

          {/* Profile Edit Modal */}
          <Modal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            title={lang === 'en' ? "Edit Admin Profile & Avatar" : "Gyara Bayanan Admin da Hoton Hoto"}
          >
            <div className="flex flex-col gap-4 p-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Administrator Name</label>
                <input
                  type="text"
                  value={tempAdminName}
                  onChange={(e) => setTempAdminName(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  placeholder="e.g. Operations Admin"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Profile Avatar URL or Upload Image</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={tempAdminAvatar}
                    onChange={(e) => setTempAdminAvatar(e.target.value)}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    placeholder=""
                  />
                  <label className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors">
                    <Camera className="h-4 w-4 text-brand-gold" />
                    <span>Upload</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setTempAdminAvatar(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {tempAdminAvatar && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-brand-gold shrink-0">
                    <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }} src={tempAdminAvatar} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Avatar Preview</p>
                    <p className="text-[10px] text-slate-500">Looks great! High-motion avatar active.</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button variant="ghost" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
                <Button 
                  variant="primary" 
                  onClick={async () => {
                    const finalName = tempAdminName.trim() || 'Operations Admin';
                    setAdminName(finalName);
                    setAdminAvatar(tempAdminAvatar);
                    if (adminId) {
                      localStorage.setItem(`ruqayya_admin_name_${adminId}`, finalName);
                      localStorage.setItem(`ruqayya_admin_avatar_${adminId}`, tempAdminAvatar);
                    }
                    try {
                      await api.updateProfile({ fullName: finalName, passportPhoto: tempAdminAvatar });
                    } catch (err) {
                      console.error("Failed to update profile on server:", err);
                    }
                    setIsProfileModalOpen(false);
                  }}
                >
                  Save Profile
                </Button>
              </div>
            </div>
          </Modal>

      {loading ? (
        <div className="py-6 text-center text-text-muted font-bold font-mono text-xs">
          {lang === 'en' ? "Syncing real-time tricycle assets..." : "Ana duba rukunin kekuna..."}
        </div>
      ) : (
        <>
          {/* Redesigned compact responsive dashboard overview fold */}
          <div className="flex flex-col gap-2.5 w-full">
            {/* Operations State: main full-width compact card at the top */}
            <div className="w-full">
              <CompanyOperationsCard
                lang={lang}
                onStateChange={syncAllData}
                driversCount={drivers.length}
                vehiclesCount={vehicles.length}
                activeCycle={activeCycle}
              />
            </div>

            {/* Enterprise Treasury & Active Cycle Timer side-by-side underneath */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 w-full">
              <CompanyWalletCard
                lang={lang}
                finance={finance}
                payments={payments}
                onStateChange={syncAllData}
              />
              <CountdownTimer
                lang={lang}
                startDate={activeCycle?.startDate || ''}
                endDate={activeCycle?.endDate || ''}
                cycleId={activeCycle?.cycleId || 'No Active Cycle'}
                status={activeCycle?.status || 'inactive'}
                isActive={activeCycle?.isActive ?? false}
                daysRemaining={activeCycle?.daysRemaining || 0}
                hoursRemaining={activeCycle?.hoursRemaining || 0}
                minutesRemaining={activeCycle?.minutesRemaining || 0}
                secondsRemaining={activeCycle?.secondsRemaining || 0}
                progressPercent={activeCycle?.progressPercent || 0}
                currentDay={activeCycle?.currentDay || 0}
                totalCycleDays={activeCycle?.totalCycleDays || 30}
                drivers={activeCycle?.drivers}
                fleet={activeCycle?.fleet}
                remit={activeCycle?.remit}
                health={activeCycle?.health}
                cycleDay={activeCycle?.cycleDay}
              />
              <CycleStatusSummary
                lang={lang}
                activeCycle={activeCycle}
              />
            </div>

            {/* Dedicated, Customizable System Status and Live Telemetry */}
            <div className="w-full">
              <SystemStatusCard
                lang={lang}
                syncAllData={syncAllData}
              />
            </div>
          </div>

          {/* PRIORITY ACTION CARDS (moved below the core overview) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('fleet');
                setTimeout(() => {
                  const el = document.getElementById('register-tricycle-card');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
              className="text-left bg-gradient-to-br from-brand-navy to-slate-900 border border-slate-800 text-white p-3.5 rounded-xl cursor-pointer hover:scale-[1.01] transition-all hover:shadow-md flex flex-col justify-between h-24 group"
            >
              <div className="flex justify-between items-start w-full">
                <div className="p-1.5 bg-brand-gold/10 rounded-lg border border-brand-gold/20 text-brand-gold group-hover:scale-110 transition-transform">
                  <Truck className="h-4 w-4" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-brand-gold group-hover:translate-x-1 transition-all" />
              </div>
              <div>
                <span className="text-[8px] font-black text-brand-gold uppercase tracking-wider block">
                  {lang === 'en' ? "ASSETS INVENTORY" : "KAYAN KAMFANI"}
                </span>
                <h4 className="text-xs font-extrabold text-white leading-tight mt-0.5">
                  {lang === 'en' ? "Register a New Tricycle" : "Rijistar Sabon Keke"}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                  {lang === 'en' ? "Onboard newly acquired tricycles directly" : "Shigar da sabon Keke/Napep cikin jerin rukunin"}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('drivers');
                setDriverFilter('pending');
              }}
              className="text-left bg-bg-surface border border-border-main p-3.5 rounded-xl cursor-pointer hover:scale-[1.01] transition-all hover:shadow-md flex flex-col justify-between h-24 group"
            >
              <div className="flex justify-between items-start w-full">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-600 group-hover:scale-110 transition-transform">
                  <Users className="h-4 w-4" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-text-muted group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
              </div>
              <div>
                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider block">
                  {lang === 'en' ? "DRIVER REGISTRY" : "TAKARDUN DIREBOBI"}
                </span>
                <h4 className="text-xs font-extrabold text-text-main leading-tight mt-0.5">
                  {lang === 'en' ? "Approve Pending Drivers" : "Tantance Sabbin Direbobi"}
                </h4>
                <p className="text-[10px] text-text-muted mt-0.5 leading-none">
                  {lang === 'en' ? "Review and certify newly applied driver profiles" : "Duba da yarda da takardun direban da ke jira"}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('finance')}
              className="text-left bg-bg-surface border border-border-main p-3.5 rounded-xl cursor-pointer hover:scale-[1.01] transition-all hover:shadow-md flex flex-col justify-between h-24 group"
            >
              <div className="flex justify-between items-start w-full">
                <div className="p-1.5 bg-brand-gold/10 rounded-lg border border-brand-gold/20 text-brand-gold group-hover:scale-110 transition-transform">
                  <Fuel className="h-4 w-4" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-text-muted group-hover:text-brand-gold group-hover:translate-x-1 transition-all" />
              </div>
              <div>
                <span className="text-[8px] font-black text-brand-gold uppercase tracking-wider block">
                  {lang === 'en' ? "FUEL DISBURSEMENT" : "KUDIN MAN FETUR"}
                </span>
                <h4 className="text-xs font-extrabold text-text-main leading-tight mt-0.5">
                  {lang === 'en' ? "Disburse Fuel Voucher" : "Amince da Rasit na Mai"}
                </h4>
                <p className="text-[10px] text-text-muted mt-0.5 leading-none">
                  {lang === 'en' ? "Approve pending liters and distribute invoices" : "Bada litar mai da buga takardun shaida"}
                </p>
              </div>
            </button>
          </div>

          {/* Dashboard Summary Widgets & Live Activity Feed Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 items-start">
            <div className="lg:col-span-8 flex flex-col gap-4">
              <AdminKPIs
                lang={lang}
                drivers={drivers}
                vehicles={vehicles}
                finance={finance}
                payments={payments}
                activeCycle={activeCycle}
                setActiveTab={setActiveTab}
              />
            </div>
            <div className="lg:col-span-4 h-full">
              <ActivityFeed
                lang={lang}
                logs={logs}
                onRefresh={syncAllData}
                isLoading={loading}
              />
            </div>
          </div>
        </>
      )}
    </>
  )}

          {/* Module Tab Switchers */}
          <div className="print:hidden">
            <Tabs
              activeTab={activeTab}
              onChange={(id) => { setActiveTab(id as any); setFleetPage(1); }}
              tabs={[
                { id: 'dashboard', label: lang === 'en' ? "Overview" : "Bayanai", icon: <Layers className="h-3.5 w-3.5" /> },
                { id: 'fleet', label: lang === 'en' ? "Tricycle Fleet" : "Rukunin Kekuna", icon: <Truck className="h-3.5 w-3.5" /> },
                { id: 'drivers', label: `${lang === 'en' ? "Driver Registry" : "Direbobi"} (${drivers.filter(d => d.status === 'pending').length} pending)`, icon: <Users className="h-3.5 w-3.5" /> },
                { id: 'trips', label: lang === 'en' ? "Daily Remittances" : "Kudaden Remittance", icon: <MapPin className="h-3.5 w-3.5" /> },
                { id: 'payments', label: lang === 'en' ? "Payment Approvals" : "Tabbatar Biyan Kudi", icon: <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" /> },
                { id: 'finance', label: lang === 'en' ? "Financial Center" : "Asusun Kamfani", icon: <Wallet className="h-3.5 w-3.5" /> },
                { id: 'documents', label: lang === 'en' ? "Document Hub" : "Taskar Takardu", icon: <FileText className="h-3.5 w-3.5" /> },
                { id: 'people', label: lang === 'en' ? "People Onboarding" : "Rijistar Mutane", icon: <Users className="h-3.5 w-3.5 text-brand-gold" /> },
                { id: 'communications', label: lang === 'en' ? "Communications" : "Sada Zumunta", icon: <MessageSquare className="h-3.5 w-3.5" /> },
                { id: 'directory', label: lang === 'en' ? "Enterprise Directory" : "Kundayen Kamfani", icon: <Users className="h-3.5 w-3.5" /> },
                { id: 'settings', label: lang === 'en' ? "System Settings" : "Saitunan Tsarin", icon: <Settings className="h-3.5 w-3.5 text-brand-gold" /> }
              ]}
            />
          </div>

          {/* Tab Content Display */}
          <div className="bg-bg-surface border border-border-main rounded-2xl p-4 md:p-6 shadow-xs">
            
            {/* TAB 1: FLEET ASSETS */}
            {activeTab === 'fleet' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                    <input
                      type="text"
                      placeholder={lang === 'en' ? "Search Plate Number, Model..." : "Nemo lambar mota..."}
                      value={fleetSearch}
                      onChange={(e) => { setFleetSearch(e.target.value); setFleetPage(1); }}
                      className="w-full pl-9 pr-4 py-1.5 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-text-muted font-bold font-mono">Found {filteredVehicles.length} rigs registered</span>
                    <Button 
                      id="register-tricycle-card"
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsAddVehicleOpen(true)}
                      className="font-bold flex items-center gap-1.5 text-xs border-brand-gold text-brand-gold hover:bg-brand-gold/10 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {lang === 'en' ? "Add Tricycle" : "Sanya Keke"}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                        <th className="p-3">Plate Number</th>
                        <th className="p-3">Vehicle Details</th>
                        <th className="p-3">Tonnage Limit</th>
                        <th className="p-3">Fuel Class</th>
                        <th className="p-3">Last Service</th>
                        <th className="p-3">Asset Mileage</th>
                        <th className="p-3 text-center">Rig Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50 text-text-main">
                      {paginatedVehicles.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-text-muted">
                            {lang === 'en' ? "No carrier rigs found matching parameters." : "Babu wata mota da ta dace."}
                          </td>
                        </tr>
                      ) : (
                        paginatedVehicles.map((v, idx) => (
                          <tr key={`${v.id || 'vehicle'}-${idx}`} className="hover:bg-bg-base/20">
                            <td className="p-3 font-bold font-mono text-[11px] text-brand-gold">{v.plateNumber}</td>
                            <td className="p-3 font-extrabold text-text-main">{v.model}</td>
                            <td className="p-3 font-bold text-text-muted">{v.capacity}</td>
                            <td className="p-3 font-semibold text-text-muted font-mono">{(v.fuelType || '').toUpperCase()}</td>
                            <td className="p-3 text-text-muted text-[11px]">{v.lastServiceDate}</td>
                            <td className="p-3 font-mono font-bold">{(v.mileage || 0).toLocaleString()} KM</td>
                            <td className="p-3 text-center">
                              <Badge variant={v.status === 'assigned' ? 'warning' : v.status === 'maintenance' ? 'danger' : v.status === 'idle' ? 'info' : 'success'}>
                                {(v.status || '').toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredVehicles.length > itemsPerPage && (
                  <div className="flex justify-between items-center border-t border-border-main/40 pt-4 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={fleetPage === 1}
                      onClick={() => setFleetPage(v => Math.max(1, v - 1))}
                      className="px-3 py-1 cursor-pointer"
                    >
                      {lang === 'en' ? "Previous" : "Baya"}
                    </Button>
                    <span className="text-[11px] text-text-muted font-bold font-mono">Page {fleetPage} of {Math.ceil(filteredVehicles.length / itemsPerPage)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={fleetPage * itemsPerPage >= filteredVehicles.length}
                      onClick={() => setFleetPage(v => v + 1)}
                      className="px-3 py-1 cursor-pointer"
                    >
                      {lang === 'en' ? "Next" : "Gaba"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DRIVER REGISTRY & APPROVAL WORKFLOW */}
            {activeTab === 'drivers' && (
              <div className="flex flex-col gap-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Status Segment Filter */}
                  <div className="flex items-center gap-1.5 flex-wrap bg-bg-base p-1 rounded-lg border border-border-main/30">
                    <button
                      onClick={() => setDriverFilter('all')}
                      className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${driverFilter === 'all' ? 'bg-brand-navy text-brand-gold' : 'text-text-muted hover:text-text-main'}`}
                    >
                      All ({drivers.length})
                    </button>
                    <button
                      onClick={() => setDriverFilter('pending')}
                      className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${driverFilter === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-text-muted hover:text-text-main'}`}
                    >
                      Pending Review ({drivers.filter(d => d.status === 'pending').length})
                    </button>
                    <button
                      onClick={() => setDriverFilter('approved')}
                      className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${driverFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-text-muted hover:text-text-main'}`}
                    >
                      Active Roster ({drivers.filter(d => d.status !== 'pending' && d.status !== 'correction_requested' && d.status !== 'rejected').length})
                    </button>
                    <button
                      onClick={() => setDriverFilter('correction_requested')}
                      className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${driverFilter === 'correction_requested' ? 'bg-slate-800 text-slate-200' : 'text-text-muted hover:text-text-main'}`}
                    >
                      Correction Requested ({drivers.filter(d => d.status === 'correction_requested').length})
                    </button>
                    <button
                      onClick={() => setDriverFilter('rejected')}
                      className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${driverFilter === 'rejected' ? 'bg-rose-950 text-rose-300' : 'text-text-muted hover:text-text-main'}`}
                    >
                      Rejected ({drivers.filter(d => d.status === 'rejected').length})
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRegisterAssistedOpen(true)}
                    className="font-bold flex items-center gap-1.5 cursor-pointer text-xs border-brand-gold text-brand-gold hover:bg-brand-gold/10"
                  >
                    <Users className="h-4 w-4" />
                    {lang === 'en' ? "Register Assisted Driver" : "Rijistar Assisted Direba"}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                        <th className="p-3">Corporate ID</th>
                        <th className="p-3">Full Name</th>
                        <th className="p-3">License & NIN</th>
                        <th className="p-3">Telephone</th>
                        <th className="p-3">Classification</th>
                        <th className="p-3">Roster Status</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50 text-text-main">
                      {filteredDrivers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-text-muted">
                            {lang === 'en' ? "No drivers found in this segment." : "Babu direbobi a wannan rukunin."}
                          </td>
                        </tr>
                      ) : (
                        filteredDrivers.map((d, idx) => (
                          <tr key={`${d.id || 'driver'}-${idx}`} className="hover:bg-bg-base/20">
                            <td className="p-3 font-bold font-mono text-[11px]">{d.company_driver_id || `PEND-${(d.id || 'DRV').substring(0, 5).toUpperCase()}`}</td>
                            <td className="p-3 font-extrabold text-text-main">
                              <div className="flex flex-col">
                                <span>{d.fullName}</span>
                                <span className="text-[9px] text-text-muted font-normal">{d.email}</span>
                              </div>
                            </td>
                            <td className="p-3 font-medium text-text-muted">
                              <div className="flex flex-col font-mono text-[10px]">
                                <span>DL: {d.licenseNumber}</span>
                                <span>NIN: {d.nin || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-text-muted font-mono">{d.phone}</td>
                            <td className="p-3">
                              {d.status === 'pending' || d.status === 'correction_requested' || d.status === 'rejected' ? (
                                <span className="text-text-muted italic text-[10px]">Pending Approval</span>
                              ) : (
                                <button
                                  onClick={() => handleClassifyDriverToggle(d.id, d.classification as any || 'Assisted')}
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer border ${
                                    d.classification === 'Smart'
                                      ? 'bg-blue-950 text-blue-400 border-blue-900'
                                      : 'bg-slate-900 text-slate-400 border-slate-800'
                                  }`}
                                  title="Click to toggle carrier safety classification"
                                >
                                  {(d.classification || 'Assisted').toUpperCase()}
                                </button>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge variant={
                                d.status === 'pending' ? 'warning' :
                                d.status === 'correction_requested' ? 'default' :
                                d.status === 'rejected' ? 'danger' : 'success'
                              }>
                                {(d.status || '').toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              {d.status === 'pending' || d.status === 'correction_requested' || d.status === 'rejected' ? (
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => {
                                    setSelectedReviewDriver(d);
                                    setCompanyDriverId(`RTL-DRV-${Math.floor(100 + Math.random() * 900)}`);
                                    setIsReviewModalOpen(true);
                                  }}
                                  className="px-2 py-1 font-bold text-[10px] cursor-pointer"
                                >
                                  Review Dossier
                                </Button>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-emerald-500 font-bold flex items-center gap-0.5 text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" /> Certified
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => setSelected360Driver(d)}
                                    className="px-2 py-1 font-bold text-[9px] text-brand-gold border-brand-gold hover:bg-brand-gold/10 bg-transparent cursor-pointer"
                                  >
                                    360° Profile
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: DAILY REMITTANCES */}
            {activeTab === 'trips' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                      <th className="p-3">Remittance ID</th>
                      <th className="p-3">Assigned Tricycle & Driver</th>
                      <th className="p-3">Route Journey</th>
                      <th className="p-3">Tricycle Spec</th>
                      <th className="p-3">Remittance Amount</th>
                      <th className="p-3">Remittance Status</th>
                      <th className="p-3 text-center">Operation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/50 text-text-main">
                    {trips.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-text-muted">
                          {lang === 'en' ? "No daily remittances logged yet." : "Babu kudaden remittance tukuna."}
                        </td>
                      </tr>
                    ) : (
                      trips.map((t, idx) => {
                        const driverName = drivers.find(d => d.id === t.driverId)?.fullName || "Driver";
                        const vehiclePlate = vehicles.find(v => v.id === t.vehicleId)?.plateNumber || "Tricycle";
                        return (
                          <tr key={`${t.id || 'trip'}-${idx}`} className="hover:bg-bg-base/20">
                            <td className="p-3 font-bold font-mono text-[11px] text-brand-gold">{t.remittanceNumber}</td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-text-main">{driverName}</span>
                                <span className="text-[10px] text-text-muted font-mono">{vehiclePlate}</span>
                              </div>
                            </td>
                            <td className="p-3 font-semibold">
                              <div className="flex items-center gap-1">
                                <span className="text-text-main font-bold">{t.origin}</span>
                                <ArrowRight className="h-3 w-3 text-brand-gold" />
                                <span className="text-brand-navy font-bold">{t.destination}</span>
                              </div>
                            </td>
                            <td className="p-3 text-text-muted font-medium">
                              <div className="flex flex-col">
                                <span>{t.tricycleType}</span>
                                <span className="text-[10px] font-bold font-mono">{t.remittanceCount} Cycles</span>
                              </div>
                            </td>
                            <td className="p-3 font-extrabold text-emerald-600">₦{(t.remittanceAmount || 0).toLocaleString()}</td>
                            <td className="p-3">
                              <Badge variant={t.status === 'delivered' ? 'success' : t.status === 'cancelled' ? 'danger' : 'warning'}>
                                {(t.status || '').toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              {t.status === 'in-transit' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCompleteTrip(t.id)}
                                  className="px-2 py-1 font-bold text-[10px] text-emerald-600 border-emerald-500 hover:bg-emerald-50 bg-transparent cursor-pointer"
                                >
                                  Confirm Safe Collection
                                </Button>
                              ) : (
                                <span className="text-text-muted text-[10px] font-semibold">{lang === 'en' ? "Arrived Safely" : "An isa lafiya"}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}


            {/* TAB 5: FINANCIAL COMMAND CENTER */}
            {activeTab === 'finance' && (
              <FinancialCommandCenter
                lang={lang}
                drivers={drivers}
                vehicles={vehicles}
                finance={finance}
                payments={payments}
                shareholders={shareholders}
                onSync={syncAllData}
                trips={trips}
                activeCycle={activeCycle}
              />
            )}

            {/* TAB 6: INSTALLMENTS APPROVAL WORKFLOW */}
            {activeTab === 'payments' && (
              <PaymentWorkflow lang={lang} />
            )}

            {/* TAB 7: DOCUMENT MANAGEMENT SYSTEM */}
            {activeTab === 'documents' && (
              <DocumentHub lang={lang} />
            )}

            {/* TAB: PEOPLE ONBOARDING & MANAGEMENT */}
            {activeTab === 'people' && (
              <PeopleManagement
                lang={lang}
                drivers={drivers}
                vehicles={vehicles}
                shareholders={shareholders}
                onSync={syncAllData}
                currentUserRole="admin"
              />
            )}

            {/* TAB 8: COMMUNICATIONS CONTROL */}
            {activeTab === 'communications' && (
              <CommunicationCenter lang={lang} />
            )}

            {/* TAB 9: ENTERPRISE DIRECTORY */}
            {activeTab === 'directory' && (
              <EnterpriseDirectory lang={lang} dictionary={dictionary} />
            )}

            {/* TAB 10: SYSTEM SETTINGS & PRODUCTION RESET UTILITIES */}
            {activeTab === 'settings' && (
              <div className="flex flex-col gap-6">
                {/* System Status Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-bg-surface border border-border-main/50 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-5 w-5 text-emerald-500" />
                        <h3 className="text-sm font-black text-text-main uppercase tracking-wider">
                          {lang === 'en' ? "System Status" : "Matakin Tsarin"}
                        </h3>
                      </div>
                      <p className="text-xs text-text-muted mb-4 leading-relaxed">
                        {lang === 'en'
                          ? "Real-time monitoring stats for the RUQAYYA TRANSPORT ERP cloud container node."
                          : "Kididdigar lokaci na gaske don asusun kula da rukunin tsarin RUQAYYA."}
                      </p>
                      
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-xs pb-2 border-b border-border-main/20">
                          <span className="text-text-muted">{lang === 'en' ? "Node Status" : "Matakin Node"}</span>
                          <span className="font-bold text-emerald-500 flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            ONLINE
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs pb-2 border-b border-border-main/20">
                          <span className="text-text-muted">{lang === 'en' ? "Secure Encryption" : "Tsaro na AES"}</span>
                          <span className="font-mono font-bold text-text-main">AES-256-GCM</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pb-2 border-b border-border-main/20">
                          <span className="text-text-muted">{lang === 'en' ? "Database Protocol" : "Asusun Database"}</span>
                          <span className="font-mono font-bold text-brand-gold">Local-JSON Sync Engine</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-text-muted">{lang === 'en' ? "Primary Location" : "Wurin Node"}</span>
                          <span className="font-bold text-text-main">Kano, Nigeria</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-bg-surface border border-border-main/50 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5 text-brand-gold" />
                      <h3 className="text-sm font-black text-text-main uppercase tracking-wider">
                        {lang === 'en' ? "Database Registry Stats" : "Rahoton Ma'ajiyar Bayanai"}
                      </h3>
                    </div>
                    <p className="text-xs text-text-muted mb-4 leading-relaxed">
                      {lang === 'en'
                        ? "Active data objects compiled within the system storage layer."
                        : "Adadin bayanan da aka ajiye a cikin ma'ajiyar tsarin."}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-bg-base border border-border-main/30 rounded-xl p-3">
                        <span className="text-[10px] text-text-muted uppercase block leading-none">{lang === 'en' ? "Vehicles" : "Ababen Hawa"}</span>
                        <span className="text-lg font-black text-text-main mt-1 block">{vehicles.length}</span>
                      </div>
                      <div className="bg-bg-base border border-border-main/30 rounded-xl p-3">
                        <span className="text-[10px] text-text-muted uppercase block leading-none">{lang === 'en' ? "Drivers" : "Direbobi"}</span>
                        <span className="text-lg font-black text-text-main mt-1 block">{drivers.length}</span>
                      </div>
                      <div className="bg-bg-base border border-border-main/30 rounded-xl p-3">
                        <span className="text-[10px] text-text-muted uppercase block leading-none">{lang === 'en' ? "Remittances" : "Kudaden shiga"}</span>
                        <span className="text-lg font-black text-text-main mt-1 block">{trips.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secure Production Reset Tool */}
                <div className="bg-bg-surface border-2 border-rose-500/20 rounded-2xl p-6 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
                  
                  <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
                        <h3 className="text-sm font-black text-text-main uppercase tracking-wider text-rose-600">
                          {lang === 'en' ? "Production Testing & Reset Tool" : "Kayan Goge Bayanan Gwaji"}
                        </h3>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed max-w-2xl">
                        {lang === 'en'
                          ? "This administrative utility wipes operational test entries to prepare the ERP for pristine production deployment. It purges all drivers, tricycle fleet items, voucher authorizations, financial records, and operational logs."
                          : "Wannan kayan aiki yana share duk bayanan gwaji don shirya ERP don amfanin gaske. Zai goge duk direbobi, kekuna, rasit na mai, kudaden shiga, da rahotanni."}
                      </p>
                      
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono font-bold text-text-muted">
                        <span className="flex items-center gap-1 text-rose-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          {lang === 'en' ? "DELETES ALL OPERATIONAL DATA" : "ZAI GOGE DUK BAYANAN AYYUKA"}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {lang === 'en' ? "PRESERVES ADMIN ACCOUNTS" : "ZAI AJIYE ASUSUN KULAWA"}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {lang === 'en' ? "PRESERVES ROLES & CONFIG" : "ZAI AJIYE MATAKAN TSARIN"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-border-main/20 flex flex-col gap-4 max-w-xl">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-black text-text-main uppercase tracking-wider">
                        {lang === 'en' ? "Confirm Reset Authorization" : "Tabbatar da Izinin Goge Tsarin"}
                      </label>
                      <p className="text-[10px] text-text-muted leading-tight mb-2">
                        {lang === 'en'
                          ? 'To authorize this destructive action, please type "RESET RUQAYYA ERP" exactly as shown below:'
                          : 'Don ba da izinin wannan aiki, da fatan za a rubuta "RESET RUQAYYA ERP" a akwatin da ke ƙasa:'}
                      </p>
                      <input
                        type="text"
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value)}
                        placeholder="RESET RUQAYYA ERP"
                        className="w-full px-3 py-2 text-xs rounded-lg border-2 border-border-main bg-bg-base font-mono font-bold focus:border-rose-500 focus:outline-hidden transition-all text-rose-600 tracking-wide"
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = '/api/admin/backup-data';
                        }}
                        className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-all"
                      >
                        {lang === 'en' ? "Download Backup" : "Zazzage Bayanan Ajiyar"}
                      </button>

                      <button
                        type="button"
                        onClick={handleExecuteSystemReset}
                        disabled={resetConfirmText !== 'RESET RUQAYYA ERP' || resetLoading}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border transition-all cursor-pointer ${
                          resetConfirmText === 'RESET RUQAYYA ERP' && !resetLoading
                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 hover:shadow-md hover:scale-[1.01]'
                            : 'bg-bg-base text-text-muted border-border-main/50 cursor-not-allowed'
                        }`}
                      >
                        {resetLoading ? (
                          <>
                            <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {lang === 'en' ? "Executing Purge..." : "Ana Goge Tsarin..."}
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" />
                            {lang === 'en' ? "Reset Operational Data" : "Goge Bayanan Gwaji"}
                          </>
                        )}
                      </button>
                    </div>

                    {resetStatus && (
                      <div className={`mt-3 p-3 rounded-xl border text-xs font-bold ${
                        resetStatus.startsWith('Error') || resetStatus.startsWith('Tabbatar')
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                      }`}>
                        {resetStatus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

      {/* MODAL: ADD VEHICLE ASSET */}
      <Modal isOpen={isAddVehicleOpen} onClose={() => setIsAddVehicleOpen(false)} title={lang === 'en' ? "Register New Fleet Asset" : "Rijistar Sabuwar Mota"}>
        <form onSubmit={handleAddVehicleSubmit} className="flex flex-col gap-4">
          {vehicleError && <Alert type="danger">{vehicleError}</Alert>}
          
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">{dictionary.forms.plateNumber}</label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder="e.g. KANO-432-KN"
              className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">{dictionary.forms.model}</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Mercedes-Benz Actros 3340"
              className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">{dictionary.forms.capacity}</label>
              <select
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              >
                <option value="25 Tons">25 Tons</option>
                <option value="30 Tons">30 Tons</option>
                <option value="35 Tons">35 Tons</option>
                <option value="40 Tons">40 Tons</option>
                <option value="45 Tons">45 Tons</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Fuel Type</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              >
                <option value="diesel">Diesel (D1)</option>
                <option value="petrol">Petrol (PMS)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border-main/50 mt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddVehicleOpen(false)}>
              {dictionary.common.cancel}
            </Button>
            <Button variant="secondary" size="sm" type="submit">
              {lang === 'en' ? "Register Rig Asset" : "Rijistar Mota"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DISPATCH TRIP */}
      <Modal isOpen={isDispatchTripOpen} onClose={() => setIsDispatchTripOpen(false)} title={lang === 'en' ? "Log Daily Remittance Collection" : "Sanya Kudin Remittance"}>
        <form onSubmit={handleDispatchSubmit} className="flex flex-col gap-4">
          {tripError && <Alert type="danger">{tripError}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Select Assigned Tricycle</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              >
                <option value="">-- Choose Vehicle --</option>
                {vehicles.filter(v => v.status === 'idle').map((v, idx) => (
                  <option key={`${v.id}-${idx}`} value={v.id}>{v.plateNumber} ({v.model})</option>
                ))}
              </select>
              <span className="text-[9px] text-text-muted">Showing idle fleet tricycles</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Select Available Driver</label>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              >
                <option value="">-- Choose Driver --</option>
                {drivers.filter(d => d.status === 'available').map((d, idx) => (
                  <option key={`${d.id}-${idx}`} value={d.id}>{d.fullName}</option>
                ))}
              </select>
              <span className="text-[9px] text-text-muted">Showing available certified drivers</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Route Departure Origin</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Kano Central Terminal"
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Remittance Station</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Zaria Road Depot"
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">Tricycle Description Type</label>
            <input
              type="text"
              value={tricycleType}
              onChange={(e) => setTricycleType(e.target.value)}
              placeholder="e.g. Passenger Tricycle or Delivery Tricycle"
              className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Collection Cycles</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Remittance Amount (₦)</label>
              <input
                type="number"
                value={charges}
                onChange={(e) => setCharges(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border-main/50 mt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsDispatchTripOpen(false)}>
              {dictionary.common.cancel}
            </Button>
            <Button variant="secondary" size="sm" type="submit">
              Dispatch Carrier Rig
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DRIVER DOSSIER REVIEW AND APPROVAL WORKFLOW */}
      <Modal 
        isOpen={isReviewModalOpen} 
        onClose={() => setIsReviewModalOpen(false)} 
        title={lang === 'en' ? "RTL Candidate Dossier Review" : "Tantance Takardun Direba"}
      >
        {selectedReviewDriver && (
          <div className="flex flex-col gap-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            
            {reviewError && <Alert type="danger">{reviewError}</Alert>}
            {reviewSuccess && <Alert type="success">{reviewSuccess}</Alert>}

            {/* Candidate Summary Row */}
            <div className="flex items-center gap-4 bg-bg-base/30 p-3 rounded-xl border border-border-main/50">
              <div className="h-14 w-14 rounded-full bg-slate-800 border border-border-main overflow-hidden flex items-center justify-center shrink-0">
                {selectedReviewDriver.documents?.find(d => d.document_type === 'passport_photo')?.file_url ? (
                  <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }} 
                    src={selectedReviewDriver.documents?.find(d => d.document_type === 'passport_photo')?.file_url} 
                    alt="Passport" 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="h-6 w-6 text-text-muted" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-extrabold text-text-main">{selectedReviewDriver.fullName}</span>
                <span className="text-[10px] text-text-muted font-mono">{selectedReviewDriver.email} | {selectedReviewDriver.phone}</span>
                <span className="text-[9px] text-brand-gold font-bold">NIN: {selectedReviewDriver.nin || 'N/A'}</span>
              </div>
            </div>

            {/* Part 1: Personal profile Details */}
            <div className="flex flex-col gap-2">
              <h4 className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider flex items-center gap-1.5 border-b border-border-main/30 pb-1">
                <User className="h-3.5 w-3.5 text-brand-gold" /> Personal Identity parameters
              </h4>
              <div className="grid grid-cols-2 gap-3 bg-bg-base/25 p-2 rounded-lg text-text-muted">
                <div>
                  <span className="block text-[10px] font-bold text-text-main">Residential Address:</span>
                  <span>{selectedReviewDriver.address || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-text-main">License & Expiry:</span>
                  <span className="font-mono">{selectedReviewDriver.licenseNumber} (Exp: {selectedReviewDriver.licenseExpiry})</span>
                </div>
              </div>
            </div>

            {/* Part 2: Guarantor Profile Details */}
            {selectedReviewDriver.guarantor && (
              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider flex items-center gap-1.5 border-b border-border-main/30 pb-1">
                  <Users className="h-3.5 w-3.5 text-blue-500" /> Professional Guarantor File
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-bg-base/25 p-2 rounded-lg text-text-muted items-center">
                  <div className="md:col-span-3 h-14 w-14 rounded-lg bg-slate-800 border overflow-hidden flex items-center justify-center">
                    {selectedReviewDriver.guarantor.passportPhotoUrl || selectedReviewDriver.guarantor.passport ? (
                      <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }} 
                        src={selectedReviewDriver.guarantor.passportPhotoUrl || selectedReviewDriver.guarantor.passport} 
                        alt="Guarantor" 
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="h-6 w-6 text-text-muted" />
                    )}
                  </div>
                  <div className="md:col-span-9 grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-text-main">Guarantor Name:</span>
                      <span>{selectedReviewDriver.guarantor.fullName}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-text-main">Phone & Address:</span>
                      <span>{selectedReviewDriver.guarantor.phone} ({selectedReviewDriver.guarantor.address})</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-text-main">Relationship:</span>
                      <span>{selectedReviewDriver.guarantor.relationship}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-text-main">Guarantor NIN:</span>
                      <span className="font-mono">{selectedReviewDriver.guarantor.nin}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Part 3: Vehicle details */}
            {selectedReviewDriver.vehicle && (
              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider flex items-center gap-1.5 border-b border-border-main/30 pb-1">
                  <Truck className="h-3.5 w-3.5 text-emerald-500" /> Fleet Carrier Asset Specification
                </h4>
                <div className="grid grid-cols-3 gap-2 bg-bg-base/25 p-2 rounded-lg text-text-muted font-mono text-[10px]">
                  <div>
                    <span className="block text-[10px] font-bold text-text-main font-sans">Brand / Model:</span>
                    <span>{selectedReviewDriver.vehicle.brand} {selectedReviewDriver.vehicle.model}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-text-main font-sans">Plate Number:</span>
                    <span className="text-brand-gold font-bold">{selectedReviewDriver.vehicle.plateNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-text-main font-sans">Chassis Number:</span>
                    <span>{selectedReviewDriver.vehicle.chassisNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-text-main font-sans">Engine Number:</span>
                    <span>{selectedReviewDriver.vehicle.engineNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-text-main font-sans">Reg Number:</span>
                    <span>{selectedReviewDriver.vehicle.registrationNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-text-main font-sans">Tonnage Capacity:</span>
                    <span className="text-text-main font-bold">{selectedReviewDriver.vehicle.capacity}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Part 3.5: Dynamic Contract terms lookup */}
            {selectedReviewDriver.vehicle && (
              <div className="flex flex-col gap-2 mt-2 animate-fadeIn">
                <h4 className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider flex items-center gap-1.5 border-b border-border-main/30 pb-1">
                  <Coins className="h-3.5 w-3.5 text-brand-gold" /> Dynamic Contract Terms (Calculated)
                </h4>
                <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-3 flex flex-col gap-2">
                  {lookupLoading ? (
                    <div className="text-[10px] text-text-muted animate-pulse py-1">
                      Querying dynamic terms lookup service...
                    </div>
                  ) : lookupTerms ? (
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="block font-bold text-text-main">30-Day Cycle Remittance:</span>
                        <span className="font-mono text-[#D4AF37] font-extrabold text-xs">₦{(lookupTerms.agreedAmount || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block font-bold text-text-main">Calculated Vehicle Valuation:</span>
                        <span className="font-mono text-[#D4AF37] font-extrabold text-xs">₦{(lookupTerms.purchasePrice || 0).toLocaleString()}</span>
                      </div>
                      <div className="col-span-2 text-[9px] text-text-muted italic border-t border-border-main/20 pt-1.5 mt-1">
                        * Values are calculated dynamically from the carrier specifications (brand, model, age, capacity) by the lookup engine. These specific values will be assigned automatically upon approval.
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-rose-400">
                      Could not retrieve dynamic contract terms. Default terms will be assigned.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Part 4: Form Actions and remarks */}
            <div className="flex flex-col gap-3 mt-2 border-t border-border-main/50 pt-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-main">Assign Company Driver ID (Required on Approval)</label>
                <input
                  type="text"
                  value={companyDriverId}
                  onChange={(e) => setCompanyDriverId(e.target.value.toUpperCase())}
                  placeholder="e.g. RTL-DRV-042"
                  className="w-full px-3 py-1.5 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-main">Audit Remarks / Feedback comments (Required for Corrections)</label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="e.g. NIN matches but Guarantor telephone is incorrect. Please upload clearer photo."
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                />
              </div>

              {/* Secure Decision Row */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleReviewAction('correction_requested')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Request Correction
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction('rejected')}
                  className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <UserX className="h-3 w-3" /> Deny & Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction('approved')}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <UserCheck className="h-3 w-3" /> Approve & Certify
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Driver 360° Profile Drawer/Modal */}
      {selected360Driver && (
        <Driver360Modal
          lang={lang}
          driver={selected360Driver}
          drivers={drivers}
          payments={payments.filter(p => p.driverId === selected360Driver.id)}
          vehicles={vehicles}
          onClose={() => setSelected360Driver(null)}
          onSync={syncAllData}
        />
      )}

      {/* Register Assisted Driver Wizard */}
      {isRegisterAssistedOpen && (
        <RegisterAssistedDriverModal
          lang={lang}
          vehicles={vehicles}
          onClose={() => setIsRegisterAssistedOpen(false)}
          onSync={syncAllData}
        />
      )}
    </div>
  );
};
