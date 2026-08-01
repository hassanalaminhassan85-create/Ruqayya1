import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Users, 
  Camera,
  Truck, 
  FileText, 
  Wallet, 
  AlertTriangle, 
  Moon, 
  Calendar, 
  Trash2, 
  Edit, 
  X, 
  Plus, 
  Download, 
  Eye, 
  Lock, 
  History,
  Coins,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert, ProgressBar } from '../ui/SharedComponents';
import { Driver, Vehicle } from '../../types';
import { api } from '../../utils/api';

interface Driver360ModalProps {
  lang: 'en' | 'ha';
  driver: Driver;
  vehicles: Vehicle[];
  payments: any[];
  onClose: () => void;
  onSync: () => void;
}

export const Driver360Modal: React.FC<Driver360ModalProps> = ({
  lang,
  driver,
  vehicles,
  payments,
  onClose,
  onSync
}) => {
  const token = api.getToken() || '';
  const getAuthorizedUrl = (urlPath: string) => {
    if (!urlPath) return '';
    if (urlPath.startsWith('/api/documents/preview/') && !urlPath.includes('token=')) {
      return `${urlPath}?token=${encodeURIComponent(token)}`;
    }
    return urlPath;
  };

  const driverPassportUrl = getAuthorizedUrl(
    (driver as any).passport_photo_url || 
    (driver as any).passportPhoto || 
    (driver as any).passport_photo || 
    driver.documents?.find((d: any) => d.document_type === 'passport_photo')?.file_url || 
    ''
  );

  const guarantorPassportUrl = driver.guarantor ? getAuthorizedUrl(
    (driver.guarantor as any).passport_photo_url || 
    (driver.guarantor as any).passportPhotoUrl || 
    (driver.guarantor as any).passport_photo || 
    (driver.guarantor as any).passport || 
    ''
  ) : '';

  // Tabs within Profile
  const [activeTab, setActiveTab] = useState<'info' | 'payments' | 'history' | 'docs'>('info');
  const [installments, setInstallments] = useState<any[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<any | null>(null);

  const fetchDriverInstallmentsAndData = async () => {
    if (!driver?.id) return;
    setLoadingInstallments(true);
    try {
      const res = await api.request(`/api/drivers/${driver.id}/installments`);
      if (res && res.success) {
        setInstallments(res.installments || []);
      }
    } catch (err) {
      console.error("Failed to fetch installments", err);
    } finally {
      setLoadingInstallments(false);
    }
  };

  useEffect(() => {
    fetchDriverInstallmentsAndData();

    const handleDBChange = () => {
      fetchDriverInstallmentsAndData();
      if (onSync) onSync();
    };
    window.addEventListener('db-change', handleDBChange);
    return () => window.removeEventListener('db-change', handleDBChange);
  }, [driver?.id, payments]);
  
  // Action Modals inside 360 View
  const [isLogAccidentOpen, setIsLogAccidentOpen] = useState(false);
  const [isLogRestOpen, setIsLogRestOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isFullscreenDocOpen, setIsFullscreenDocOpen] = useState<string | null>(null);

  // Form states: Log Accident
  const [accDate, setAccDate] = useState(new Date().toISOString().split('T')[0]);
  const [accDesc, setAccDesc] = useState('');
  const [accEstimate, setAccEstimate] = useState('0');
  const [accSeverity, setAccSeverity] = useState<'minor' | 'moderate' | 'major'>('minor');
  const [accError, setAccError] = useState('');

  // Form states: Log Rest
  const [restStart, setRestStart] = useState(new Date().toISOString().split('T')[0]);
  const [restEnd, setRestEnd] = useState('');
  const [restReason, setRestReason] = useState('');
  const [restError, setRestError] = useState('');

  // Form states: Edit Profile Details
  const [editName, setEditName] = useState(driver.fullName);
  const [editPhone, setEditPhone] = useState(driver.phone);
  const [editAddress, setEditAddress] = useState(driver.address || '');
  const [editNin, setEditNin] = useState(driver.nin || '');
  const [editLicense, setEditLicense] = useState(driver.licenseNumber);
  const [editExpiry, setEditExpiry] = useState(driver.licenseExpiry);
  const [editAgreedAmount, setEditAgreedAmount] = useState((driver as any).agreed_amount?.toString() || '300000');
  const [editRemainingBalance, setEditRemainingBalance] = useState((driver as any).remaining_vehicle_balance?.toString() || '15000000');
  const [editStatus, setEditStatus] = useState(driver.status);
  const [editError, setEditError] = useState('');

  // Localized dictionaries
  const labels = {
    en: {
      profileTitle: "Driver 360° Operations Center",
      personal: "Personal Identity Details",
      guarantor: "Guarantor Profile",
      vehicle: "Allocated Rig Asset",
      documents: "Company Documents",
      payments: "Installment History",
      accidents: "Accident Registry",
      rest: "Rest Timeline Logs",
      audits: "Security Audit Log",
      actions: "Operational Controls",
      logAccident: "Record Accident Claim",
      logRest: "Register Rest Mode",
      editDossier: "Edit Driver Dossier",
      close: "Close Drawer",
      outstanding: "Outstanding Lease Balance",
      contractTotal: "Contract 30-Day Rate",
      remainingRig: "Remaining Rig Balance",
      fullName: "Full Name",
      phone: "Telephone Number",
      address: "Residential Address",
      license: "License & Expiry Date",
      nin: "National Identity (NIN)",
      status: "Roster Status",
      reason: "Reason/Justification",
      save: "Save Changes",
      cancel: "Cancel",
      severity: "Severity Level"
    },
    ha: {
      profileTitle: "Kundin Direba Na 360°",
      personal: "Bayanin Shaidar Kai",
      guarantor: "Bayanin Guarantor (Wanda ya tsaya)",
      vehicle: "Mota Da Aka Bashi",
      documents: "Takardun Kamfani",
      payments: "Tarihin Biyan Installments",
      accidents: "Tarihin Hatsari",
      rest: "Tarihin Hutu (Rest Mode)",
      audits: "Rikodin Tsaro da Audit",
      actions: "Ayyukan Gudanarwa",
      logAccident: "Shigar da Bayanin Hatsari",
      logRest: "Sanya Shi Hutu",
      editDossier: "Gyara Bayanan Direba",
      close: "Kulle",
      outstanding: "Kudin Installments da ke Kanshi",
      contractTotal: "Yarjejeniyar Kwanaki 30",
      remainingRig: "Kudin Mota da Ya Rage",
      fullName: "Cikakken Suna",
      phone: "Lambar Wayar Salula",
      address: "Adireshin Gida",
      license: "Lambar Lasisin Mota",
      nin: "Lambar NIN",
      status: "Matsayin Aiki",
      reason: "Dalilin Hutu",
      save: "Ajiye Gyara",
      cancel: "Soke",
      severity: "Girma ko Karancin sa"
    }
  }[lang];

  // Map matching vehicle plate
  const vehicleAssigned = vehicles.find(v => v.id === driver.assignedVehicleId) || (driver as any).vehicle;

  // Driver calculations
  const driverPayments = payments.filter(p => p.driver_id === driver.id || p.driverId === driver.id);
  const totalPaid = driverPayments
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0);
  const agreedTotal = (driver as any).agreed_amount || 300000;
  const outstandingInstallment = Math.max(0, agreedTotal - totalPaid);

  // Submit Log Accident
  const handleLogAccidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccError('');
    if (!accDesc) {
      setAccError(lang === 'en' ? "Please outline accident description." : "Da fatan za a rubuta bayanin hatsari.");
      return;
    }

    try {
      await api.addDriverAccident(driver.id, {
        date: accDate,
        description: accDesc,
        damageEstimate: parseFloat(accEstimate),
        severity: accSeverity
      });
      setIsLogAccidentOpen(false);
      setAccDesc('');
      setAccEstimate('0');
      window.dispatchEvent(new CustomEvent('db-change'));
      onSync();
    } catch (err: any) {
      setAccError(err.message || "Failed to log accident.");
    }
  };

  // Submit Log Rest
  const handleLogRestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestError('');
    if (!restEnd) {
      setRestError(lang === 'en' ? "End date of rest window is required." : "Da fatan za a sanya ranar karshen hutu.");
      return;
    }

    try {
      await api.addDriverRest(driver.id, {
        startDate: restStart,
        endDate: restEnd,
        reason: restReason
      });
      setIsLogRestOpen(false);
      setRestReason('');
      window.dispatchEvent(new CustomEvent('db-change'));
      onSync();
    } catch (err: any) {
      setRestError(err.message || "Failed to log rest period.");
    }
  };

  // Submit Complete Profile Edit
  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    try {
      await api.updateDriverProfileComplete(driver.id, {
        fullName: editName,
        phone: editPhone,
        address: editAddress,
        nin: editNin,
        licenseNumber: editLicense,
        licenseExpiry: editExpiry,
        agreedAmount: parseFloat(editAgreedAmount),
        remainingVehicleBalance: parseFloat(editRemainingBalance),
        status: editStatus
      });
      setIsEditProfileOpen(false);
      window.dispatchEvent(new CustomEvent('db-change'));
      onSync();
    } catch (err: any) {
      setEditError(err.message || "Dossier update failed.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-bg-surface border border-border-main rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Drawer Header Area */}
        <div className="flex items-center justify-between p-4 border-b border-border-main/50 bg-bg-base/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border border-border-main overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center">
              {driverPassportUrl ? (
                <img 
                  src={driverPassportUrl} 
                  alt={driver.fullName} 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e: any) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <span className={`font-black text-brand-gold text-xs ${driverPassportUrl ? 'hidden' : ''}`}>
                {driver.fullName ? driver.fullName.substring(0, 2).toUpperCase() : 'DR'}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase tracking-tight flex items-center gap-1.5">
                {labels.profileTitle} 
                <Badge variant={driver.classification === 'Smart' ? 'info' : 'default'} className="text-[9px]">
                  {driver.classification || 'Assisted'}
                </Badge>
              </h3>
              <p className="text-[10px] text-text-muted font-mono">{driver.fullName} | {driver.company_driver_id || 'PENDING'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg-base/40 rounded-lg transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dashboard Cards Inside 360 */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border-main/30 bg-bg-base/10 text-xs">
          <div className="p-3 border-r border-border-main/20 flex flex-col gap-0.5">
            <span className="text-[9px] text-text-muted font-bold uppercase">{labels.contractTotal}</span>
            <span className="font-extrabold text-text-main">₦{agreedTotal.toLocaleString()}</span>
          </div>
          <div className="p-3 border-r border-border-main/20 flex flex-col gap-0.5">
            <span className="text-[9px] text-text-muted font-bold uppercase">{lang === 'en' ? "Total Paid" : "An Biya"}</span>
            <span className="font-extrabold text-emerald-500">₦{totalPaid.toLocaleString()}</span>
          </div>
          <div className="p-3 border-r border-border-main/20 flex flex-col gap-0.5">
            <span className="text-[9px] text-text-muted font-bold uppercase">{labels.outstanding}</span>
            <span className="font-extrabold text-rose-500">₦{outstandingInstallment.toLocaleString()}</span>
          </div>
          <div className="p-3 flex flex-col gap-0.5 bg-brand-gold/5">
            <span className="text-[9px] text-brand-gold font-bold uppercase">{labels.remainingRig}</span>
            <span className="font-extrabold text-brand-gold">₦{((driver as any).remaining_vehicle_balance || 15000000).toLocaleString()}</span>
          </div>
        </div>

        {/* Tab Switchers within 360 Profile */}
        <div className="flex gap-1 border-b border-border-main/30 px-4 pt-2 bg-bg-base/20">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'info' ? 'border-brand-gold text-text-main' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}
          >
            <Users className="h-3.5 w-3.5" />
            {lang === 'en' ? "Core Dossier" : "Tantance Bayani"}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'payments' ? 'border-brand-gold text-text-main' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}
          >
            <Wallet className="h-3.5 w-3.5" />
            {labels.payments} ({driverPayments.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'history' ? 'border-brand-gold text-text-main' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}
          >
            <History className="h-3.5 w-3.5" />
            {lang === 'en' ? "Accidents & Rests" : "Hatsari da Hutu"}
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'docs' ? 'border-brand-gold text-text-main' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}
          >
            <FileText className="h-3.5 w-3.5" />
            {labels.documents}
          </button>
        </div>

        {/* Dynamic Inner Tab Content Area */}
        <div className="flex-1 p-5 overflow-y-auto max-h-[55vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {/* TAB 1: CORE DOSSIER */}
              {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs text-text-muted">
              
              {/* Personal details */}
              <div className="md:col-span-6 flex flex-col gap-4">
                <div className="bg-bg-base/30 p-4 border border-border-main rounded-xl flex flex-col gap-3">
                  <h4 className="text-[10px] font-extrabold uppercase text-text-main tracking-wider flex items-center gap-1 border-b border-border-main/50 pb-1.5 justify-between">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-brand-gold" />
                      {labels.personal}
                    </span>
                    <span className="text-[8px] text-emerald-500 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">CERTIFIED RECORD</span>
                  </h4>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {/* Official Passport Photograph */}
                    <div className="flex flex-col items-center shrink-0 mx-auto sm:mx-0">
                      <div className="relative group overflow-hidden rounded-lg border border-border-main h-28 w-24 bg-slate-900 flex items-center justify-center shadow-md">
                        {driverPassportUrl ? (
                          <img 
                            src={driverPassportUrl} 
                            alt={driver.fullName} 
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`flex flex-col items-center justify-center h-full w-full text-brand-gold font-black text-sm ${driverPassportUrl ? 'hidden' : ''}`}>
                          {driver.fullName ? driver.fullName.substring(0, 2).toUpperCase() : 'DR'}
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] font-mono font-extrabold text-brand-gold text-center py-0.5 uppercase tracking-tighter">
                          RTL PASSPORT
                        </div>
                      </div>
                    </div>
                    
                    {/* Contact & Identity Fields */}
                    <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                      <div>
                        <span className="block text-[10px] font-bold text-text-main">Full Name:</span>
                        <span className="text-text-main font-semibold block truncate" title={driver.fullName}>{driver.fullName}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main">Phone:</span>
                        <span className="font-mono block truncate">{driver.phone}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main">NIN:</span>
                        <span className="font-mono block truncate">{driver.nin || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main">License:</span>
                        <span className="font-mono block truncate" title={`${driver.licenseNumber} (Exp: ${driver.licenseExpiry})`}>
                          {driver.licenseNumber}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] font-bold text-text-main">Address:</span>
                        <span className="block text-text-muted text-[11px] leading-relaxed">{driver.address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guarantor Profile */}
                {driver.guarantor && (
                  <div className="bg-bg-base/30 p-4 border border-border-main rounded-xl flex flex-col gap-3">
                    <h4 className="text-[10px] font-extrabold uppercase text-text-main tracking-wider flex items-center gap-1 border-b border-border-main/50 pb-1.5 justify-between">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-blue-500" />
                        {labels.guarantor}
                      </span>
                      <span className="text-[8px] text-blue-500 font-mono font-bold bg-blue-500/10 px-1.5 py-0.5 rounded-full">PASSPORT SECURED</span>
                    </h4>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="flex flex-col items-center shrink-0 mx-auto sm:mx-0">
                        <div className="relative group overflow-hidden rounded-lg border border-border-main h-24 w-20 bg-slate-900 flex items-center justify-center shadow-md">
                          {guarantorPassportUrl ? (
                            <img 
                              src={guarantorPassportUrl} 
                              alt="Guarantor Passport" 
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e: any) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`flex flex-col items-center justify-center h-full w-full text-blue-400 font-black text-xs ${guarantorPassportUrl ? 'hidden' : ''}`}>
                            {driver.guarantor.fullName ? driver.guarantor.fullName.substring(0, 2).toUpperCase() : 'GR'}
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[7px] font-mono font-extrabold text-blue-400 text-center py-0.5 uppercase tracking-tighter">
                            GUARANTOR
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 flex-1 w-full text-xs">
                        <div>
                          <span className="block text-[10px] font-bold text-text-main">Guarantor Suna:</span>
                          <span className="text-text-main font-semibold block">{driver.guarantor.fullName}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-text-main">Telephone:</span>
                          <span className="font-mono block">{driver.guarantor.phone}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-text-main">Guarantor NIN:</span>
                          <span className="font-mono block">{driver.guarantor.nin || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-text-main">Relationship:</span>
                          <span className="block">{driver.guarantor.relationship || 'N/A'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-[10px] font-bold text-text-main">Guarantor Address:</span>
                          <span className="block text-text-muted leading-relaxed">{driver.guarantor.address || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle allocation / Action board */}
              <div className="md:col-span-6 flex flex-col gap-4">
                
                {/* Rig Specification */}
                {vehicleAssigned ? (
                  <div className="bg-bg-base/30 p-4 border border-border-main rounded-xl flex flex-col gap-3">
                    <h4 className="text-[10px] font-extrabold uppercase text-text-main tracking-wider flex items-center gap-1 border-b border-border-main/50 pb-1.5">
                      <Truck className="h-3.5 w-3.5 text-emerald-500" />
                      {labels.vehicle}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 font-mono">
                      <div>
                        <span className="block text-[10px] font-bold text-text-main font-sans">Brand & Model:</span>
                        <span className="text-text-main font-bold font-sans">{vehicleAssigned.brand} {vehicleAssigned.model}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main font-sans">Plate Number:</span>
                        <span className="text-brand-gold font-extrabold text-[12px]">{vehicleAssigned.plateNumber || vehicleAssigned.plate_number}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main font-sans">Engine No:</span>
                        <span>{vehicleAssigned.engineNumber || vehicleAssigned.engine_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main font-sans">Chassis No:</span>
                        <span>{vehicleAssigned.chassisNumber || vehicleAssigned.chassis_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main font-sans">Tons Limit:</span>
                        <span className="text-text-main font-sans font-bold">{vehicleAssigned.capacity}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-main font-sans">Rig Status:</span>
                        <Badge variant="success" className="font-sans text-[9px] uppercase">{vehicleAssigned.status}</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-center">
                    {lang === 'en' ? "No rig asset currently allocated to this driver." : "Babu motar da aka sanya wa wannan direba a halin yanzu."}
                  </div>
                )}

                {/* ACTIVE CONTROLS GRID */}
                <div className="bg-bg-base/30 p-4 border border-border-main rounded-xl flex flex-col gap-3">
                  <h4 className="text-[10px] font-extrabold uppercase text-text-main tracking-wider flex items-center gap-1 border-b border-border-main/50 pb-1.5">
                    <Coins className="h-3.5 w-3.5 text-brand-gold animate-bounce" />
                    {labels.actions}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setIsLogRestOpen(true)}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-extrabold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Moon className="h-3.5 w-3.5 text-purple-500" />
                      {labels.logRest}
                    </button>
                    <button
                      onClick={() => setIsLogAccidentOpen(true)}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-extrabold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                      {labels.logAccident}
                    </button>
                    <button
                      onClick={() => setIsEditProfileOpen(true)}
                      className="col-span-2 px-3 py-2 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/20 font-extrabold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      {labels.editDossier}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INSTALLMENT HISTORY */}
          {activeTab === 'payments' && (
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex justify-between items-center bg-bg-base/20 p-3 rounded-lg border border-border-main/50 font-mono text-[11px] font-bold">
                <span>Contract Lease Ledger</span>
                <span className="text-emerald-500">₦{totalPaid.toLocaleString()} paid</span>
              </div>

              {/* Installment Milestones Grid */}
              <div className="flex flex-col gap-2">
                <span className="font-extrabold uppercase text-[10px] text-text-muted tracking-wider">
                  {lang === 'en' ? "30-Day Installment Cycles (6 x 5-Day Milestones)" : "Tsarin Raba Biyan Kwanaki 30 (Kashi 6 na kwanaki 5 kowanne)"}
                </span>
                
                {loadingInstallments ? (
                  <div className="py-4 text-center text-text-muted font-mono text-[11px]">Loading installment milestones...</div>
                ) : installments.length === 0 ? (
                  <div className="py-4 text-center text-text-muted font-mono text-[11px]">No active installment cycle found for this driver.</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {installments.map((inst: any) => {
                      const isCompleted = inst.status === 'Completed';
                      const isOverdue = inst.status === 'Overdue';
                      const isPartial = inst.status === 'Partially Paid';
                      
                      let badgeBg = 'bg-slate-500/10 text-slate-400 border-white/5';
                      if (isCompleted) badgeBg = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                      if (isOverdue) badgeBg = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
                      if (isPartial) badgeBg = 'bg-amber-500/10 text-amber-500 border-amber-500/20';

                      return (
                        <div 
                          key={inst.installmentNumber} 
                          onClick={() => setSelectedMilestone(inst)}
                          className="bg-bg-base/30 border border-border-main p-2.5 rounded-lg flex flex-col gap-1.5 hover:border-brand-gold/80 hover:bg-bg-base/50 transition-all cursor-pointer shadow-xs group"
                          title="Click to inspect milestone breakdown"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-text-main font-mono text-[11px] group-hover:text-brand-gold transition-colors">Milestone #{inst.installmentNumber}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold border uppercase ${badgeBg}`}>
                              {inst.status === 'Completed' ? (lang === 'en' ? 'Paid' : 'An Biya') : inst.status}
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-text-muted">{lang === 'en' ? 'Due:' : 'Ya kamata:'}</span>
                              <span className="font-extrabold text-text-main font-mono">₦{(inst.amountDue || inst.totalDue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-text-muted">{lang === 'en' ? 'Paid:' : 'An biya:'}</span>
                              <span className="font-extrabold text-emerald-500 font-mono">₦{(inst.amountPaid || inst.totalPaid || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px] border-t border-border-main/50 pt-0.5 mt-0.5">
                              <span className="text-text-muted">{lang === 'en' ? 'Bal:' : 'Sauran:'}</span>
                              <span className="font-extrabold text-brand-gold font-mono">₦{Math.max(0, (inst.amountDue || inst.totalDue || 0) - (inst.amountPaid || inst.totalPaid || 0)).toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="text-[8px] text-text-muted font-mono flex flex-col gap-0.5 border-t border-border-main/30 pt-1 mt-0.5">
                            <div>Due: {inst.dueDate || inst.endDate}</div>
                            {inst.paidDate && (
                              <div className="text-emerald-500 font-semibold font-mono">Paid: {inst.paidDate}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Milestone Detail Inspection Modal */}
              {selectedMilestone && (
                <div className="absolute inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="w-full max-w-lg bg-bg-surface border border-border-main rounded-2xl p-6 shadow-2xl flex flex-col gap-5 text-xs text-text-main">
                    <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold">
                          #{selectedMilestone.installmentNumber}
                        </div>
                        <div>
                          <h4 className="font-extrabold uppercase text-sm tracking-tight text-text-main">
                            Milestone #{selectedMilestone.installmentNumber} - Detailed Audit
                          </h4>
                          <span className="text-[10px] text-text-muted font-mono">
                            5-Day Lease Contract Installment Cycle
                          </span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedMilestone(null)} className="p-1.5 text-text-muted hover:text-text-main rounded-lg cursor-pointer">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 bg-bg-base/40 p-3.5 rounded-xl border border-border-main/60 font-mono">
                      <div>
                        <span className="block text-[9px] text-text-muted font-bold uppercase">Total Due</span>
                        <span className="text-sm font-black text-text-main">₦{(selectedMilestone.amountDue || selectedMilestone.totalDue || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-text-muted font-bold uppercase">Amount Paid</span>
                        <span className="text-sm font-black text-emerald-500">₦{(selectedMilestone.amountPaid || selectedMilestone.totalPaid || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-text-muted font-bold uppercase">Balance</span>
                        <span className="text-sm font-black text-brand-gold">₦{(selectedMilestone.remainingBalance || Math.max(0, (selectedMilestone.amountDue || selectedMilestone.totalDue || 0) - (selectedMilestone.amountPaid || selectedMilestone.totalPaid || 0))).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <span className="font-extrabold uppercase text-[10px] text-text-muted tracking-wider">Milestone Lifecycle Schedule</span>
                      <div className="grid grid-cols-2 gap-3 text-xs bg-bg-base/20 p-3 rounded-xl border border-border-main/40 font-mono">
                        <div>
                          <span className="text-text-muted block text-[10px]">Start Date:</span>
                          <strong className="text-text-main">{selectedMilestone.startDate || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px]">Due Date (Deadline):</span>
                          <strong className="text-rose-500">{selectedMilestone.dueDate || selectedMilestone.endDate || 'N/A'}</strong>
                        </div>
                        {selectedMilestone.paidDate && (
                          <div className="col-span-2 border-t border-border-main/40 pt-1.5 mt-0.5">
                            <span className="text-text-muted block text-[10px]">Settled On:</span>
                            <strong className="text-emerald-500">{selectedMilestone.paidDate}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="font-extrabold uppercase text-[10px] text-text-muted tracking-wider">Matched Remittance Transactions</span>
                      <div className="max-h-40 overflow-y-auto flex flex-col gap-2 pr-1">
                        {driverPayments.filter(p => p.installment_number === selectedMilestone.installmentNumber).length === 0 ? (
                          <div className="p-3 text-center text-text-muted italic bg-bg-base/20 rounded-lg">
                            No payment receipts logged specifically for Milestone #{selectedMilestone.installmentNumber} yet.
                          </div>
                        ) : (
                          driverPayments.filter(p => p.installment_number === selectedMilestone.installmentNumber).map(p => (
                            <div key={p.id} className="p-2.5 bg-bg-surface border border-border-main rounded-lg flex items-center justify-between font-mono text-[11px]">
                              <div>
                                <span className="font-bold text-brand-gold">{p.receipt_number}</span>
                                <span className="text-[10px] text-text-muted block">{p.date} • {(p.payment_method || 'Transfer').toUpperCase()}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-emerald-500 block">₦{p.amount.toLocaleString()}</span>
                                <Badge variant={p.status === 'approved' ? 'success' : 'warning'} className="text-[8px]">{p.status}</Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border-main/50">
                      <Button size="sm" onClick={() => setSelectedMilestone(null)} className="font-bold">Close Details</Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-border-main rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                      <th className="p-3">Receipt Code</th>
                      <th className="p-3">Installment Milestone</th>
                      <th className="p-3">Amount Processed</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Audit Review</th>
                      <th className="p-3">Cash Desk Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/50 text-text-main">
                    {driverPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-text-muted">
                          {lang === 'en' ? "No installment transactions logged for this candidate." : "Babu wasu kudaden installments da aka shigar a baya."}
                        </td>
                      </tr>
                    ) : (
                      driverPayments.map((p: any, idx: number) => (
                        <tr key={`${p.id}-${idx}`} className="hover:bg-bg-base/20 font-mono text-[11px]">
                          <td className="p-3 font-bold text-brand-gold">{p.receipt_number}</td>
                          <td className="p-3 font-sans font-bold text-text-muted">Milestone #{p.installment_number}</td>
                          <td className="p-3 font-extrabold text-emerald-500">₦{p.amount.toLocaleString()}</td>
                          <td className="p-3 text-text-muted text-[10px]">{p.date}</td>
                          <td className="p-3 font-sans">
                            <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}>
                              {(p.status || '').toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-3 font-sans text-text-muted">{p.recorded_by || 'Operator Ibrahim'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ACCIDENTS & RESTS */}
          {activeTab === 'history' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-text-muted">
              
              {/* Accident registry */}
              <div className="bg-bg-base/20 p-4 border border-border-main rounded-xl flex flex-col gap-3">
                <h4 className="text-[10px] font-extrabold uppercase text-text-main tracking-wider flex items-center gap-1 border-b border-border-main/50 pb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  {labels.accidents}
                </h4>
                <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {(!driver.accidentHistory || driver.accidentHistory.length === 0) ? (
                    <div className="text-center py-6 text-text-muted italic">{lang === 'en' ? "Clean record: No active accidents logged." : "Lafiya kalau: Babu hatsarin da aka yi."}</div>
                  ) : (
                    driver.accidentHistory.map((acc: any, idx: number) => (
                      <div key={`${acc.id}-${idx}`} className="p-2.5 bg-bg-surface border border-border-main rounded-lg flex flex-col gap-1.5 font-mono text-[10px]">
                        <div className="flex justify-between items-center font-sans font-bold text-text-main">
                          <span className="text-[11px] text-rose-500">Claim Code: #{acc.id}</span>
                          <span>{acc.date}</span>
                        </div>
                        <p className="font-sans leading-normal text-text-muted">{acc.description}</p>
                        <div className="flex justify-between items-center pt-1 border-t border-border-main/30 text-[9px]">
                          <span>Severity: <strong className="text-rose-400">{acc.severity?.toUpperCase()}</strong></span>
                          <span>Est Repair Cost: <strong className="text-emerald-500">₦{acc.damageEstimate?.toLocaleString()}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rest timeline */}
              <div className="bg-bg-base/20 p-4 border border-border-main rounded-xl flex flex-col gap-3">
                <h4 className="text-[10px] font-extrabold uppercase text-text-main tracking-wider flex items-center gap-1 border-b border-border-main/50 pb-1.5">
                  <Moon className="h-3.5 w-3.5 text-purple-500" />
                  {labels.rest}
                </h4>
                <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {(!driver.restHistory || driver.restHistory.length === 0) ? (
                    <div className="text-center py-6 text-text-muted italic">{lang === 'en' ? "Roster: Active duty cycle, no logged rest." : "Yana aiki: Babu hutun da aka nema a halin yanzu."}</div>
                  ) : (
                    driver.restHistory.map((rst: any, idx: number) => (
                      <div key={`${rst.id}-${idx}`} className="p-2.5 bg-bg-surface border border-border-main rounded-lg flex flex-col gap-1 font-mono text-[10px]">
                        <div className="flex justify-between items-center font-sans font-bold text-text-main">
                          <span className="text-purple-400">Rest ID: #{rst.id}</span>
                          <span className="text-text-muted font-bold">{rst.startDate} to {rst.endDate}</span>
                        </div>
                        <p className="font-sans leading-normal text-text-muted mt-1">{rst.reason || 'Routine physical rest window guidelines'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMPANY DOCUMENTS */}
          {activeTab === 'docs' && (
            <div className="flex flex-col gap-4 text-xs">
              <span className="text-text-muted leading-relaxed">
                {lang === 'en' ? "Secure digital locker storing registration documents on Cloudflare R2 emulation." : "Ma'ajiyar takardun direba amintattu a tsarin Cloudflare R2."}
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(!driver.documents || driver.documents.length === 0) ? (
                  <div className="col-span-3 text-center py-8 text-text-muted italic">{lang === 'en' ? "No documents uploaded." : "Babu takardun da aka dora."}</div>
                ) : (
                  driver.documents.map((doc: any, idx: number) => (
                    <Card key={doc.id || `doc-${doc.created_at || idx}`} className="p-3 flex flex-col justify-between border border-border-main/60 bg-bg-base/30 text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-brand-gold shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-extrabold text-text-main capitalize">{doc.document_type.replace('_', ' ')}</span>
                          <span className="text-[9px] text-text-muted font-mono">{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={() => setIsFullscreenDocOpen(doc.file_url)}
                          className="flex-1 py-1 px-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </button>
                        <a
                          href={doc.file_url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 px-2 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/20 rounded flex items-center justify-center"
                          title="Download Document"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
            </motion.div>
          </AnimatePresence>

        </div>

        {/* MODAL: ACCIDENT CLAIMS */}
        {isLogAccidentOpen && (
          <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-5 flex flex-col gap-4 text-xs bg-bg-surface border border-border-main">
              <div className="flex justify-between items-center border-b border-border-main/50 pb-2">
                <span className="text-xs font-bold text-rose-500 uppercase flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {labels.logAccident}</span>
                <button onClick={() => setIsLogAccidentOpen(false)} className="text-text-muted hover:text-text-main"><X className="h-4 w-4" /></button>
              </div>

              <form onSubmit={handleLogAccidentSubmit} className="flex flex-col gap-4">
                {accError && <Alert type="danger">{accError}</Alert>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">Accident Date</label>
                    <input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{labels.severity}</label>
                    <select value={accSeverity} onChange={(e: any) => setAccSeverity(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1.5 rounded-lg focus:outline-none">
                      <option value="minor">Minor Damage</option>
                      <option value="moderate">Moderate Damage</option>
                      <option value="major">Major Structural Failure</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Est Repair Cost (₦) (Will post Ledger Expense)</label>
                  <input type="number" value={accEstimate} onChange={(e) => setAccEstimate(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1.5 rounded-lg focus:outline-none" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Accident details & Description</label>
                  <textarea value={accDesc} onChange={(e) => setAccDesc(e.target.value)} rows={3} placeholder="Describe the accident incident on Zaria Road..." className="w-full bg-bg-base border border-border-main px-2 py-1.5 rounded-lg focus:outline-none" />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border-main/50">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsLogAccidentOpen(false)}>{labels.cancel}</Button>
                  <Button variant="secondary" size="sm" type="submit">Submit Claim</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* MODAL: REST MODE */}
        {isLogRestOpen && (
          <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-5 flex flex-col gap-4 text-xs bg-bg-surface border border-border-main">
              <div className="flex justify-between items-center border-b border-border-main/50 pb-2">
                <span className="text-xs font-bold text-purple-500 uppercase flex items-center gap-1"><Moon className="h-4 w-4" /> {labels.logRest}</span>
                <button onClick={() => setIsLogRestOpen(false)} className="text-text-muted hover:text-text-main"><X className="h-4 w-4" /></button>
              </div>

              <form onSubmit={handleLogRestSubmit} className="flex flex-col gap-4">
                {restError && <Alert type="danger">{restError}</Alert>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">Rest Start Date</label>
                    <input type="date" value={restStart} onChange={(e) => setRestStart(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">Rest End Date</label>
                    <input type="date" value={restEnd} onChange={(e) => setRestEnd(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{labels.reason}</label>
                  <textarea value={restReason} onChange={(e) => setRestReason(e.target.value)} rows={3} placeholder="Operational health guidelines rest request..." className="w-full bg-bg-base border border-border-main px-2 py-1.5 rounded-lg focus:outline-none" />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border-main/50">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsLogRestOpen(false)}>{labels.cancel}</Button>
                  <Button variant="secondary" size="sm" type="submit">Activate Rest Mode</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* MODAL: EDIT PROFILE */}
        {isEditProfileOpen && (
          <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-5 flex flex-col gap-4 text-xs bg-bg-surface border border-border-main max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-border-main/50 pb-2">
                <span className="text-xs font-bold text-brand-gold uppercase">{labels.editDossier}</span>
                <button onClick={() => setIsEditProfileOpen(false)} className="text-text-muted hover:text-text-main"><X className="h-4 w-4" /></button>
              </div>

              <form onSubmit={handleEditProfileSubmit} className="flex flex-col gap-3">
                {editError && <Alert type="danger">{editError}</Alert>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{labels.fullName}</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{labels.phone}</label>
                    <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{labels.nin}</label>
                    <input type="text" value={editNin} onChange={(e) => setEditNin(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{labels.license}</label>
                    <input type="text" value={editLicense} onChange={(e) => setEditLicense(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">License Expiry</label>
                    <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{labels.status}</label>
                    <select value={editStatus} onChange={(e: any) => setEditStatus(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none">
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="available">Available</option>
                      <option value="off-duty">Off-duty (Rest)</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">Agreed 30 Cycle Amount to Bring to Company (₦)</label>
                    <input type="number" value={editAgreedAmount} onChange={(e) => setEditAgreedAmount(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">Remaining Vehicle Balance (₦)</label>
                    <input type="number" value={editRemainingBalance} onChange={(e) => setEditRemainingBalance(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none font-mono" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{labels.address}</label>
                  <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="w-full bg-bg-base border border-border-main px-2 py-1 rounded-lg focus:outline-none" />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border-main/50">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsEditProfileOpen(false)}>{labels.cancel}</Button>
                  <Button variant="secondary" size="sm" type="submit">{labels.save}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* FULLSCREEN PREVIEW */}
        <AnimatePresence>
          {isFullscreenDocOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col justify-between p-4"
            >
              <div className="flex justify-end">
                <button 
                  onClick={() => setIsFullscreenDocOpen(null)}
                  className="p-1 px-3 bg-rose-950 text-rose-300 rounded font-bold"
                >
                  Close Preview
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center p-4">
                <img 
                  src={getAuthorizedUrl(isFullscreenDocOpen)} 
                  alt="Document Preview" 
                  className="max-h-full max-w-full object-contain border border-border-main rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
};
