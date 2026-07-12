/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import EnterpriseDirectory from '../components/admin/EnterpriseDirectory';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Alert, Tabs, Modal, ProgressBar } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { Vehicle, Driver, DailyRemittance, FuelVoucher, Dictionary, Language, FinancialRecord } from '../types';
import { 
  Truck, 
  Users, 
  MapPin, 
  Fuel, 
  CirclePlus, 
  ClipboardCheck, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Search, 
  X,
  FileText,
  User,
  Activity,
  AlertTriangle,
  UserCheck,
  UserX,
  RotateCcw,
  MessageSquare
} from 'lucide-react';

import { AdminKPIs } from '../components/admin/AdminKPIs';
import { FinancialCommandCenter } from '../components/admin/FinancialCommandCenter';
import { Driver360Modal } from '../components/admin/Driver360Modal';
import { RegisterAssistedDriverModal } from '../components/admin/RegisterAssistedDriverModal';
import { DocumentHub } from '../components/admin/DocumentHub';
import { CommunicationCenter } from '../components/admin/CommunicationCenter';
import { PaymentWorkflow } from '../components/admin/PaymentWorkflow';
import { CompanyOperationsCard } from '../components/admin/CompanyOperationsCard';

interface AdminDashboardProps {
  lang: Language;
  dictionary: Dictionary;
  activeTab?: 'fleet' | 'drivers' | 'trips' | 'vouchers' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory';
  setActiveTab?: (tab: 'fleet' | 'drivers' | 'trips' | 'vouchers' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, dictionary, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) => {
  // Tabs & Views
  const [localActiveTab, setLocalActiveTab] = useState<'fleet' | 'drivers' | 'trips' | 'vouchers' | 'finance' | 'payments' | 'documents' | 'communications' | 'directory'>('fleet');
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;
  
  // Storage states
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<DailyRemittance[]>([]);
  const [vouchers, setVouchers] = useState<FuelVoucher[]>([]);
  const [finance, setFinance] = useState<FinancialRecord[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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

  const syncAllData = async () => {
    try {
      const [vList, dList, tList, fvList, fin, payList] = await Promise.all([
        api.getVehicles(),
        api.getDrivers(),
        api.getTrips(),
        api.getVouchers(),
        api.getFinance(),
        api.getPayments()
      ]);
      setVehicles(vList || []);
      setDrivers(dList || []);
      setTrips(tList || []);
      setVouchers(fvList || []);
      setFinance(fin || []);
      setPayments(payList || []);
      
      const revTotal = (fin || [])
        .filter((f: any) => f.type === 'revenue')
        .reduce((sum: number, r: any) => sum + r.amount, 0);
      setTotalEarnings(revTotal);

      // Determine active cycle or set a default
      if (fin && fin.length > 0) {
        setActiveCycle({
          startDate: fin[fin.length - 1].date || new Date().toISOString(),
          status: 'active'
        });
      } else {
        setActiveCycle({
          startDate: new Date().toISOString(),
          status: 'active'
        });
      }
    } catch (e) {
      console.error("Failed to sync backend data in AdminDashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncAllData();
    
    // Establish real-time SSE stream sync
    const token = localStorage.getItem('ruqayya_token') || '';
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
            setVouchers(data.vouchers || []);
            setFinance(data.financials || []);
            setPayments(data.driver_payments || []);
            
            const revTotal = (data.financials || [])
              .filter((f: any) => f.type === 'revenue')
              .reduce((sum: number, r: any) => sum + r.amount, 0);
            setTotalEarnings(revTotal);

            const activeCyc = (data.cycles || []).find((c: any) => c.status === 'active');
            if (activeCyc) {
              setActiveCycle(activeCyc);
            } else if (data.financials && data.financials.length > 0) {
              setActiveCycle({
                startDate: data.financials[data.financials.length - 1].date || new Date().toISOString(),
                status: 'active'
              });
            }
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

  const handleApproveVoucher = async (voucherId: string) => {
    try {
      await api.approveVoucher(voucherId);
      syncAllData();
    } catch (err) {
      console.error("Voucher approval failed:", err);
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
  const pendingVouchers = vouchers.filter(v => v.status === 'pending');

  return (
    <div className="flex flex-col gap-6 w-full flex-1 max-w-7xl mx-auto p-4 md:p-6 bg-bg-base">
      
      {/* Header and Quick Action Drawer Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main/50 pb-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-text-main uppercase">
            {lang === 'en' ? "Admin Operations Control" : "Gudanarwar Masu Kula (Admin)"}
          </h2>
          <p className="text-xs text-text-muted mt-0.5 leading-normal">
            {lang === 'en' ? "Manage tricycle lease assets, certify driver registrations, and monitor remittance logs." : "Gudanar da rukunin keken napep, tabbatar da direbobi, da duba kudaden remittance."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddVehicleOpen(true)}
            className="font-bold flex items-center gap-1 cursor-pointer"
          >
            <CirclePlus className="h-4 w-4" />
            {lang === 'en' ? "Register Tricycle Asset" : "Rijistar Sabon Keke"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDispatchTripOpen(true)}
            className="font-bold flex items-center gap-1 cursor-pointer"
          >
            <ClipboardCheck className="h-4 w-4" />
            {lang === 'en' ? "Log Daily Remittance" : "Sanya Remittance"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-muted font-bold font-mono text-xs">
          {lang === 'en' ? "Syncing real-time tricycle assets..." : "Ana duba rukunin kekuna..."}
        </div>
      ) : (
        <>
          {/* Company Operations State Banner */}
          <CompanyOperationsCard
            lang={lang}
            onStateChange={syncAllData}
            driversCount={drivers.length}
            vehiclesCount={vehicles.length}
          />

          {/* Dashboard Summary Widgets */}
          <AdminKPIs
            lang={lang}
            drivers={drivers}
            vehicles={vehicles}
            finance={finance}
            payments={payments}
            activeCycle={activeCycle}
          />

          {/* Module Tab Switchers */}
          <Tabs
            activeTab={activeTab}
            onChange={(id) => { setActiveTab(id as any); setFleetPage(1); }}
            tabs={[
              { id: 'fleet', label: lang === 'en' ? "Tricycle Fleet" : "Rukunin Kekuna", icon: <Truck className="h-3.5 w-3.5" /> },
              { id: 'drivers', label: `${lang === 'en' ? "Driver Registry" : "Direbobi"} (${drivers.filter(d => d.status === 'pending').length} pending)`, icon: <Users className="h-3.5 w-3.5" /> },
              { id: 'trips', label: lang === 'en' ? "Daily Remittances" : "Kudaden Remittance", icon: <MapPin className="h-3.5 w-3.5" /> },
              { id: 'vouchers', label: `${lang === 'en' ? "Fuel Vouchers" : "Rasit na Mai"} (${pendingVouchers.length})`, icon: <Fuel className="h-3.5 w-3.5" /> },
              { id: 'finance', label: lang === 'en' ? "Financial Center" : "Kudaden Shiga", icon: <span className="font-extrabold text-xs">₦</span> },
              { id: 'payments', label: lang === 'en' ? "Installments Approval" : "Biyan Kudi", icon: <span className="font-extrabold text-xs">₦</span> },
              { id: 'documents', label: lang === 'en' ? "Document Hub" : "Taskar Takardu", icon: <FileText className="h-3.5 w-3.5" /> },
              { id: 'communications', label: lang === 'en' ? "Communications" : "Sada Zumunta", icon: <MessageSquare className="h-3.5 w-3.5" /> },
              { id: 'directory', label: lang === 'en' ? "Enterprise Directory" : "Kundayen Kamfani", icon: <Users className="h-3.5 w-3.5" /> }
            ]}
          />

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
                  <span className="text-[10px] text-text-muted font-bold font-mono">Found {filteredVehicles.length} rigs registered</span>
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
                        paginatedVehicles.map(v => (
                          <tr key={v.id} className="hover:bg-bg-base/20">
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
                        filteredDrivers.map(d => (
                          <tr key={d.id} className="hover:bg-bg-base/20">
                            <td className="p-3 font-bold font-mono text-[11px]">{d.company_driver_id || `PEND-${d.id.substring(0, 5).toUpperCase()}`}</td>
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
                      trips.map(t => {
                        const driverName = drivers.find(d => d.id === t.driverId)?.fullName || "Driver";
                        const vehiclePlate = vehicles.find(v => v.id === t.vehicleId)?.plateNumber || "Tricycle";
                        return (
                          <tr key={t.id} className="hover:bg-bg-base/20">
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

            {/* TAB 4: FUEL VOUCHERS */}
            {activeTab === 'vouchers' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                      <th className="p-3">Voucher Code</th>
                      <th className="p-3">Allocated Driver</th>
                      <th className="p-3">Associated Rig</th>
                      <th className="p-3">Disbursement Class</th>
                      <th className="p-3">Estimated Cost</th>
                      <th className="p-3">Request Date</th>
                      <th className="p-3 text-center font-bold">Ledger Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/50 text-text-main">
                    {vouchers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-text-muted">
                          {lang === 'en' ? "No fuel vouchers requested yet." : "Babu buƙatar takardar mai tukuna."}
                        </td>
                      </tr>
                    ) : (
                      vouchers.map(v => {
                        const driverObj = drivers.find(d => d.id === v.driverId);
                        const vehicleObj = vehicles.find(vh => vh.id === v.vehicleId);
                        return (
                          <tr key={v.id} className="hover:bg-bg-base/20">
                            <td className="p-3 font-bold font-mono text-[11px]">{v.voucherNumber}</td>
                            <td className="p-3 font-bold">{driverObj?.fullName || "Driver"}</td>
                            <td className="p-3 font-semibold text-brand-gold">{vehicleObj?.plateNumber || "Vehicle"}</td>
                            <td className="p-3 font-extrabold">{v.litersRequested} Liters</td>
                            <td className="p-3 font-extrabold text-emerald-600">₦{v.estimatedCost.toLocaleString()}</td>
                            <td className="p-3 text-text-muted text-[10px]">{v.requestDate}</td>
                            <td className="p-3 text-center">
                              {v.status === 'pending' ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleApproveVoucher(v.id)}
                                  className="px-3 py-1 font-bold text-[10px] cursor-pointer animate-pulse"
                                >
                                  Approve Fuel Purchase
                                </Button>
                              ) : (
                                <Badge variant={v.status === 'approved' ? 'success' : 'danger'}>
                                  {(v.status || '').toUpperCase()}
                                </Badge>
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
                onSync={syncAllData}
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

            {/* TAB 8: COMMUNICATIONS CONTROL */}
            {activeTab === 'communications' && (
              <CommunicationCenter lang={lang} />
            )}

            {/* TAB 9: ENTERPRISE DIRECTORY */}
            {activeTab === 'directory' && (
              <EnterpriseDirectory lang={lang} dictionary={dictionary} />
            )}
          </div>
        </>
      )}

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
                {vehicles.filter(v => v.status === 'idle').map(v => (
                  <option key={v.id} value={v.id}>{v.plateNumber} ({v.model})</option>
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
                {drivers.filter(d => d.status === 'available').map(d => (
                  <option key={d.id} value={d.id}>{d.fullName}</option>
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
                  <img 
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
                      <img 
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
