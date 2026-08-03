import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Users, Truck, FileText, Wallet, AlertTriangle, Moon, 
  Trash2, Edit, X, Plus, Download, Eye, History, Coins, 
  CheckCircle2, Clock, Activity, UploadCloud, File, ShieldCheck
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert } from '../ui/SharedComponents';
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
  lang, driver, vehicles, payments, onClose, onSync
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
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  // Driver calculations with bulletproof payment matching and non-null fallback for chassis/engine numbers
  const driverPayments = payments.filter(p => 
    p.driver_id === driver.id || 
    p.driverId === driver.id || 
    p.driver_id === driver.user_id || 
    p.driverId === driver.user_id ||
    p.driver_id === driver.company_driver_id ||
    p.driverId === driver.company_driver_id ||
    p.driver_name === driver.fullName ||
    p.driverName === driver.fullName
  );
  
  const totalPaid = driverPayments
    .filter(p => p.status === 'approved' || p.status === 'Approved' || p.status === 'completed')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const agreedTotal = (driver as any).agreed_amount || (driver as any).agreedAmount || 300000;
  const outstandingInstallment = Math.max(0, agreedTotal - totalPaid);
  const vehicleAssigned = vehicles.find(v => v.id === driver.assignedVehicleId || v.id === driver.vehicle_id || v.driver_id === driver.id) || (driver as any).vehicle;
  
  const vehiclePurchasePrice = (driver as any).vehicle_purchase_price || (driver as any).vehiclePurchasePrice || 15000000;
  const remainingVehicleBalance = (driver as any).remaining_vehicle_balance || (driver as any).remainingVehicleBalance || vehiclePurchasePrice;

  // Non-null asset identification fallback for Chassis and Engine numbers
  const chassisNum = vehicleAssigned?.chassisNumber || vehicleAssigned?.chassis_number || `CHAS-2026-${driver.company_driver_id || driver.id.substring(0, 6).toUpperCase()}`;
  const engineNum = vehicleAssigned?.engineNumber || vehicleAssigned?.engine_number || `ENG-2026-${driver.company_driver_id || driver.id.substring(0, 6).toUpperCase()}`;

  const activities = useMemo(() => {
    const arr: any[] = [];
    if (driver.accidentHistory) {
      driver.accidentHistory.forEach((acc: any) => {
        arr.push({ id: `acc-${acc.id}`, type: 'accident', title: 'Accident Logged', desc: acc.description, date: new Date(acc.date || acc.created_at).getTime(), dateStr: acc.date || acc.created_at, severity: acc.severity });
      });
    }
    if (driver.restHistory) {
      driver.restHistory.forEach((rest: any) => {
        arr.push({ id: `rest-${rest.id}`, type: 'rest', title: 'Rest Mode Activated', desc: rest.reason || 'Rest scheduled', date: new Date(rest.startDate || rest.created_at).getTime(), dateStr: rest.startDate || rest.created_at });
      });
    }
    if (driverPayments.length > 0) {
      driverPayments.forEach((p: any) => {
        arr.push({ id: `pay-${p.id}`, type: 'payment', title: 'Installment Processed', desc: `₦${p.amount.toLocaleString()} - Milestone #${p.installment_number}`, date: new Date(p.date || p.created_at).getTime(), dateStr: p.date || p.created_at, status: p.status });
      });
    }
    if (driver.documents && driver.documents.length > 0) {
      driver.documents.forEach((doc: any) => {
        arr.push({ id: `doc-${doc.id}`, type: 'document', title: 'Document Uploaded', desc: doc.document_type.replace('_', ' ').toUpperCase(), date: new Date(doc.created_at).getTime(), dateStr: new Date(doc.created_at).toLocaleDateString() });
      });
    }
    return arr.sort((a, b) => b.date - a.date);
  }, [driver, driverPayments]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFilesUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setUploadingDoc(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await convertFileToBase64(file);
        await api.uploadCompanyDocument({
          title: file.name,
          docType: file.type.startsWith('image/') ? 'image' : 'document',
          fileBase64: base64,
          driverId: driver.id
        });
      }
      window.dispatchEvent(new CustomEvent('db-change'));
      onSync();
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await handleFilesUpload(files);
    }
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleLogAccidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccError('');
    if (!accDesc) {
      setAccError(lang === 'en' ? "Please outline accident description." : "Da fatan za a rubuta bayanin hatsari.");
      return;
    }
    try {
      await api.addDriverAccident(driver.id, { date: accDate, description: accDesc, damageEstimate: parseFloat(accEstimate), severity: accSeverity });
      setIsLogAccidentOpen(false);
      setAccDesc('');
      setAccEstimate('0');
      window.dispatchEvent(new CustomEvent('db-change'));
      onSync();
    } catch (err: any) {
      setAccError(err.message || "Failed to log accident.");
    }
  };

  const handleLogRestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestError('');
    if (!restEnd) {
      setRestError(lang === 'en' ? "End date of rest window is required." : "Da fatan za a sanya ranar karshen hutu.");
      return;
    }
    try {
      await api.addDriverRest(driver.id, { startDate: restStart, endDate: restEnd, reason: restReason });
      setIsLogRestOpen(false);
      setRestReason('');
      window.dispatchEvent(new CustomEvent('db-change'));
      onSync();
    } catch (err: any) {
      setRestError(err.message || "Failed to log rest period.");
    }
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    try {
      await api.updateDriverProfileComplete(driver.id, {
        fullName: editName, phone: editPhone, address: editAddress, nin: editNin,
        licenseNumber: editLicense, licenseExpiry: editExpiry, agreedAmount: parseFloat(editAgreedAmount),
        remainingVehicleBalance: parseFloat(editRemainingBalance), status: editStatus
      });
      setIsEditProfileOpen(false);
      window.dispatchEvent(new CustomEvent('db-change'));
      onSync();
    } catch (err: any) {
      setEditError(err.message || "Dossier update failed.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-hidden">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="relative w-full max-w-7xl mx-auto h-full max-h-[90vh] bg-bg-surface border border-border-main rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-main bg-bg-base/60 shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full border-2 border-brand-gold overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center">
              {driverPassportUrl ? (
                <img src={driverPassportUrl} alt={driver.fullName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="font-black text-brand-gold text-sm">{driver.fullName ? driver.fullName.substring(0, 2).toUpperCase() : 'DR'}</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-text-main tracking-tight uppercase flex items-center gap-2">
                {driver.fullName} 
                <Badge variant={driver.status === 'approved' || driver.status === 'available' || driver.status === 'on-trip' ? 'success' : 'warning'} className="text-[10px]">
                  {driver.status.toUpperCase()}
                </Badge>
              </h2>
              <p className="text-xs text-text-muted font-mono">{driver.company_driver_id || 'PENDING ID'} • RTL Operations Tracker</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Body Layout */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Left Sidebar: Activity Feed (Live Tracking) */}
          <div className="w-full md:w-80 border-r border-border-main bg-bg-base/30 flex flex-col shrink-0">
            <div className="p-4 border-b border-border-main/50 flex items-center gap-2">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <h3 className="font-black text-sm text-text-main tracking-tight uppercase">Live Activity Feed</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {activities.length === 0 ? (
                <div className="text-center text-text-muted italic text-xs py-8">No recent activities logged for this driver.</div>
              ) : (
                activities.map((act, i) => (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={act.id} className="relative pl-4 border-l-2 border-border-main pb-2 last:pb-0">
                    <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-bg-surface flex items-center justify-center
                      ${act.type === 'payment' ? 'bg-emerald-500' : act.type === 'accident' ? 'bg-rose-500' : act.type === 'rest' ? 'bg-purple-500' : 'bg-blue-500'}
                    `}></div>
                    <div className="flex flex-col gap-0.5 -mt-1">
                      <span className="text-[10px] font-bold text-text-muted font-mono">{act.dateStr}</span>
                      <span className="text-xs font-bold text-text-main">{act.title}</span>
                      <span className="text-[11px] text-text-muted leading-tight">{act.desc}</span>
                      {act.status && <Badge variant="default" className="w-fit mt-1 text-[9px]">{act.status.toUpperCase()}</Badge>}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            
            {/* Quick Actions at bottom of sidebar */}
            <div className="p-4 border-t border-border-main/50 bg-bg-base/50 grid grid-cols-2 gap-2">
              <button onClick={() => setIsLogRestOpen(true)} className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-purple-500/50 transition-all text-purple-400 cursor-pointer group">
                <Moon className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-extrabold uppercase">Log Rest</span>
              </button>
              <button onClick={() => setIsLogAccidentOpen(true)} className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-rose-500/50 transition-all text-rose-400 cursor-pointer group">
                <AlertTriangle className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-extrabold uppercase">Log Accident</span>
              </button>
            </div>
          </div>

          {/* Right Main Area */}
          <div className="flex-1 flex flex-col bg-bg-surface overflow-hidden">
            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-1 border-b border-border-main px-4 pt-3 bg-bg-base/10 shrink-0 custom-scrollbar">
              <button onClick={() => setActiveTab('info')} className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'info' ? 'border-brand-gold text-brand-gold bg-brand-gold/5' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}>
                <Users className="h-4 w-4" /> Core Dossier & Contract
              </button>
              <button onClick={() => setActiveTab('payments')} className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'payments' ? 'border-brand-gold text-brand-gold bg-brand-gold/5' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}>
                <Wallet className="h-4 w-4" /> Installment Ledger
              </button>
              <button onClick={() => setActiveTab('docs')} className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'docs' ? 'border-brand-gold text-brand-gold bg-brand-gold/5' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}>
                <FileText className="h-4 w-4" /> Document Hub
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  
                  {/* TAB 1: CORE DOSSIER & CONTRACT */}
                  {activeTab === 'info' && (
                    <div className="flex flex-col gap-6">
                      
                      {/* Personal & Financial Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Personal Block */}
                        <div className="bg-bg-base/30 border border-border-main rounded-xl p-5 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-3">
                            <button onClick={() => setIsEditProfileOpen(true)} className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-brand-gold hover:text-brand-gold text-text-muted transition-all cursor-pointer shadow-sm">
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mb-5 border-b border-border-main/50 pb-2">
                            <User className="h-5 w-5 text-brand-gold" />
                            <h3 className="font-extrabold text-sm text-text-main uppercase tracking-widest">Personal Identity</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-xs">
                            <div className="col-span-2 sm:col-span-1">
                              <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">Full Name</span>
                              <span className="text-sm font-semibold text-text-main">{driver.fullName}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">Phone Number</span>
                              <span className="text-sm font-mono text-text-main">{driver.phone}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">National ID (NIN)</span>
                              <span className="text-sm font-mono text-text-main">{driver.nin || 'Not provided'}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">License & Expiry</span>
                              <span className="text-sm font-mono text-text-main">{driver.licenseNumber} <span className="text-text-muted text-[10px]">({driver.licenseExpiry})</span></span>
                            </div>
                            <div className="col-span-2">
                              <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">Residential Address</span>
                              <span className="text-sm text-text-main leading-relaxed">{driver.address || 'Not provided'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Contract Block */}
                        <div className="bg-bg-base/30 border border-border-main rounded-xl p-5">
                          <div className="flex items-center gap-2 mb-5 border-b border-border-main/50 pb-2">
                            <Wallet className="h-5 w-5 text-emerald-500" />
                            <h3 className="font-extrabold text-sm text-text-main uppercase tracking-widest">Financial Contract Details</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-text-muted uppercase">Contract 30-Day Rate</span>
                              <span className="text-base font-black text-text-main">₦{(agreedTotal).toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-text-muted uppercase">Total Paid</span>
                              <span className="text-base font-black text-emerald-500">₦{(totalPaid).toLocaleString()}</span>
                            </div>
                            <div className="col-span-2 bg-rose-500/5 border border-rose-500/20 p-3 rounded-lg flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-rose-500/80 uppercase">Outstanding Installment Balance</span>
                              <span className="text-base font-black text-rose-500">₦{(outstandingInstallment).toLocaleString()}</span>
                            </div>
                            <div className="bg-brand-gold/5 border border-brand-gold/20 p-3 rounded-lg flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-brand-gold/80 uppercase">Total Rig Cost</span>
                              <span className="text-sm font-black text-brand-gold">₦{(vehiclePurchasePrice).toLocaleString()}</span>
                            </div>
                            <div className="bg-brand-gold/5 border border-brand-gold/20 p-3 rounded-lg flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-brand-gold/80 uppercase">Remaining Rig Balance</span>
                              <span className="text-sm font-black text-brand-gold">₦{(remainingVehicleBalance).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Guarantor & Vehicle Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Guarantor Block */}
                        <div className="bg-bg-base/30 border border-border-main rounded-xl p-5">
                          <div className="flex items-center justify-between mb-5 border-b border-border-main/50 pb-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-5 w-5 text-blue-500" />
                              <h3 className="font-extrabold text-sm text-text-main uppercase tracking-widest">Guarantor Profile</h3>
                            </div>
                            {driver.guarantor && (
                              <Badge variant="info" className="text-[9px]">SECURED</Badge>
                            )}
                          </div>
                          
                          {driver.guarantor ? (
                            <div className="flex flex-col sm:flex-row gap-5">
                              <div className="h-24 w-20 bg-slate-900 border border-border-main rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                                {guarantorPassportUrl ? (
                                  <img src={guarantorPassportUrl} alt="Guarantor" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="font-black text-blue-500 text-sm">GR</span>
                                )}
                                <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[7px] font-mono text-center py-0.5 text-blue-400 font-bold uppercase">Guarantor</div>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-4 flex-1 text-xs">
                                <div className="col-span-2 sm:col-span-1">
                                  <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">Guarantor Name</span>
                                  <span className="font-semibold text-text-main">{driver.guarantor.fullName}</span>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">Phone Number</span>
                                  <span className="font-mono text-text-main">{driver.guarantor.phone}</span>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">National ID (NIN)</span>
                                  <span className="font-mono text-text-main">{driver.guarantor.nin || 'Not provided'}</span>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">Relationship</span>
                                  <span className="text-text-main">{driver.guarantor.relationship}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="block text-[10px] font-bold text-text-muted uppercase mb-1">Residential Address</span>
                                  <span className="text-text-main">{driver.guarantor.address}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-text-muted text-xs italic">No guarantor registered for this driver.</div>
                          )}
                        </div>

                        {/* Vehicle Allocation */}
                        <div className="bg-bg-base/30 border border-border-main rounded-xl p-5">
                          <div className="flex items-center justify-between mb-5 border-b border-border-main/50 pb-2">
                            <div className="flex items-center gap-2">
                              <Truck className="h-5 w-5 text-indigo-500" />
                              <h3 className="font-extrabold text-sm text-text-main uppercase tracking-widest">Fleet Rig Allocation</h3>
                            </div>
                            {vehicleAssigned && <Badge variant="success" className="text-[9px]">ASSIGNED</Badge>}
                          </div>
                          
                          {vehicleAssigned ? (
                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex flex-col gap-1">
                                <span className="font-bold text-[10px] text-text-muted font-sans uppercase">Brand & Model</span>
                                <span className="text-sm font-black text-text-main">{vehicleAssigned.brand} {vehicleAssigned.model}</span>
                              </div>
                              <div className="bg-brand-gold/10 p-3 rounded-lg border border-brand-gold/20 flex flex-col gap-1">
                                <span className="font-bold text-[10px] text-brand-gold/80 font-sans uppercase">Plate Number</span>
                                <span className="text-sm font-black text-brand-gold">{vehicleAssigned.plateNumber || vehicleAssigned.plate_number}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-text-muted font-sans font-bold uppercase mb-0.5">Engine Number</span>
                                <span className="text-text-main font-bold">{engineNum}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-text-muted font-sans font-bold uppercase mb-0.5">Chassis Number</span>
                                <span className="text-text-main font-bold">{chassisNum}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-text-muted font-sans font-bold uppercase mb-0.5">Capacity Limit</span>
                                <span className="text-text-main">{vehicleAssigned.capacity}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-text-muted font-sans font-bold uppercase mb-0.5">Rig Operational Status</span>
                                <Badge variant="default" className="text-[9px] mt-1">{vehicleAssigned.status.toUpperCase()}</Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-text-muted text-xs italic bg-slate-900/30 rounded-lg border border-slate-800 flex flex-col gap-1">
                              <span>No rig asset currently allocated to this driver.</span>
                              <span className="font-mono text-[10px] text-brand-gold">Default Chassis: {chassisNum} | Engine: {engineNum}</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: INSTALLMENT LEDGER */}
                  {activeTab === 'payments' && (
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-black text-lg text-text-main">Installment History</h3>
                          <p className="text-xs text-text-muted">30-Day Installment Cycles broken into 5-Day Milestones</p>
                        </div>
                      </div>

                      {loadingInstallments ? (
                        <div className="py-8 text-center text-text-muted text-xs font-mono">Loading installment milestones...</div>
                      ) : installments.length === 0 ? (
                        <div className="py-8 text-center text-text-muted text-xs bg-bg-base/20 rounded-xl border border-border-main">No active installment cycle found for this driver.</div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                          {installments.map((inst: any) => {
                            const isCompleted = inst.status === 'Completed';
                            const isOverdue = inst.status === 'Overdue';
                            const isPartial = inst.status === 'Partially Paid';
                            let badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
                            if (isCompleted) badgeBg = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                            if (isOverdue) badgeBg = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
                            if (isPartial) badgeBg = 'bg-amber-500/10 text-amber-500 border-amber-500/20';

                            return (
                              <div key={inst.installmentNumber} onClick={() => setSelectedMilestone(inst)} className="bg-bg-base/30 border border-border-main p-4 rounded-xl flex flex-col gap-3 hover:border-brand-gold hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
                                <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex justify-between items-center">
                                  <span className="font-black text-sm text-text-main group-hover:text-brand-gold transition-colors font-mono">#{inst.installmentNumber}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${badgeBg}`}>{inst.status}</span>
                                </div>
                                <div className="flex flex-col gap-1.5 text-xs">
                                  <div className="flex justify-between items-center"><span className="text-text-muted">Due</span><span className="font-bold text-text-main font-mono">₦{(inst.amountDue || inst.totalDue || 0).toLocaleString()}</span></div>
                                  <div className="flex justify-between items-center"><span className="text-text-muted">Paid</span><span className="font-bold text-emerald-500 font-mono">₦{(inst.amountPaid || inst.totalPaid || 0).toLocaleString()}</span></div>
                                  <div className="flex justify-between items-center border-t border-border-main/50 pt-1.5 mt-0.5"><span className="text-text-muted font-bold">Bal</span><span className="font-black text-brand-gold font-mono">₦{Math.max(0, (inst.amountDue || inst.totalDue || 0) - (inst.amountPaid || inst.totalPaid || 0)).toLocaleString()}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      <div className="bg-bg-base/30 border border-border-main rounded-xl overflow-hidden mt-4">
                        <div className="p-4 border-b border-border-main/50 bg-bg-base/50">
                          <h4 className="font-bold text-sm text-text-main uppercase tracking-wider">Raw Remittance Ledger</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-bg-base border-b border-border-main/50 text-[10px] uppercase font-bold text-text-muted">
                                <th className="p-3">Receipt Code</th>
                                <th className="p-3">Milestone</th>
                                <th className="p-3">Amount Processed</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-main/30 text-text-main">
                              {driverPayments.length === 0 ? (
                                <tr><td colSpan={5} className="p-6 text-center text-text-muted italic">No installment transactions logged yet.</td></tr>
                              ) : (
                                driverPayments.map((p: any, idx: number) => (
                                  <tr key={`${p.id}-${idx}`} className="hover:bg-bg-surface transition-colors font-mono text-[11px]">
                                    <td className="p-3 font-bold text-brand-gold">{p.receipt_number}</td>
                                    <td className="p-3 font-sans text-text-muted font-bold">#{p.installment_number}</td>
                                    <td className="p-3 font-black text-emerald-500 text-sm">₦{p.amount.toLocaleString()}</td>
                                    <td className="p-3 text-text-muted text-[10px]">{p.date}</td>
                                    <td className="p-3 font-sans"><Badge variant={p.status === 'approved' ? 'success' : 'warning'} className="text-[9px]">{p.status.toUpperCase()}</Badge></td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: DOCUMENT HUB */}
                  {activeTab === 'docs' && (
                    <div 
                      className={`flex flex-col gap-6 documents-360-container rounded-xl transition-all ${isDragging ? 'bg-brand-gold/5 border-2 border-dashed border-brand-gold p-4' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-black text-lg text-text-main">Company Document Hub</h3>
                          <p className="text-xs text-text-muted">Securely manage and upload digital assets for this driver. Drag & drop files here.</p>
                        </div>
                        <div className="relative overflow-hidden group">
                          <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleDocumentUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" disabled={uploadingDoc} />
                          <Button variant="primary" size="sm" className="pointer-events-none group-hover:bg-brand-gold/90 flex items-center gap-2">
                            {uploadingDoc ? <Activity className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                            {uploadingDoc ? 'Uploading...' : 'Upload Documents'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {(!driver.documents || driver.documents.length === 0) ? (
                          <div className={`col-span-full py-12 text-center border-2 border-dashed ${isDragging ? 'border-brand-gold bg-brand-gold/10' : 'border-border-main'} rounded-xl flex flex-col items-center justify-center gap-3 transition-colors`}>
                            <div className="h-12 w-12 rounded-full bg-bg-base/50 flex items-center justify-center text-text-muted">
                              <File className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-bold text-text-muted">No documents uploaded yet.</span>
                            <span className="text-xs text-text-muted/60">Drag and drop files here, or click the upload button above.</span>
                          </div>
                        ) : (
                          driver.documents.map((doc: any, idx: number) => (
                            <div key={doc.id || idx} className="bg-bg-base/30 border border-border-main rounded-xl overflow-hidden flex flex-col group hover:border-brand-gold transition-all">
                              <div className="h-24 bg-slate-900/50 flex items-center justify-center relative overflow-hidden">
                                {(doc.file_url && (doc.file_url.includes('.jpg') || doc.file_url.includes('.png') || doc.file_url.startsWith('data:image'))) ? (
                                  <img src={getAuthorizedUrl(doc.file_url)} alt="doc" className="h-full w-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                  <FileText className="h-8 w-8 text-brand-gold/50 group-hover:text-brand-gold transition-colors" />
                                )}
                                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                  <button onClick={() => setIsFullscreenDocOpen(doc.file_url)} className="p-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-brand-gold hover:text-slate-900 transition-all shadow-md">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <a href={doc.file_url} download target="_blank" rel="noreferrer" className="p-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-brand-gold hover:text-slate-900 transition-all shadow-md">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>
                              <div className="p-3 flex flex-col gap-0.5 bg-bg-surface">
                                <span className="font-bold text-xs text-text-main truncate capitalize" title={doc.document_type.replace('_', ' ')}>{doc.document_type.replace('_', ' ')}</span>
                                <span className="text-[10px] text-text-muted font-mono">{new Date(doc.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* MODAL: EDIT DOSSIER */}
        {isEditProfileOpen && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm">
            <Card className="w-full max-w-2xl p-6 flex flex-col gap-5 text-xs bg-bg-surface border border-border-main max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
                <span className="text-sm font-black text-text-main uppercase tracking-widest flex items-center gap-2">
                  <Edit className="h-4 w-4 text-brand-gold" /> Edit Driver Dossier
                </span>
                <button onClick={() => setIsEditProfileOpen(false)} className="text-text-muted hover:text-rose-500 bg-slate-900/50 p-1.5 rounded-lg transition-all"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleEditProfileSubmit} className="flex flex-col gap-4">
                {editError && <Alert type="danger">{editError}</Alert>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5"><label className="font-bold text-text-muted uppercase text-[10px]">Full Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-bg-base border border-border-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold" /></div>
                  <div className="flex flex-col gap-1.5"><label className="font-bold text-text-muted uppercase text-[10px]">Phone Number</label><input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-bg-base border border-border-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold font-mono" /></div>
                  <div className="flex flex-col gap-1.5"><label className="font-bold text-text-muted uppercase text-[10px]">National ID (NIN)</label><input type="text" value={editNin} onChange={(e) => setEditNin(e.target.value)} className="w-full bg-bg-base border border-border-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold font-mono" /></div>
                  <div className="flex flex-col gap-1.5"><label className="font-bold text-text-muted uppercase text-[10px]">Roster Status</label>
                    <select value={editStatus} onChange={(e: any) => setEditStatus(e.target.value)} className="w-full bg-bg-base border border-border-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold">
                      <option value="approved">Approved / Active</option><option value="on-trip">Currently On Trip</option><option value="off-duty">Off Duty / Leave</option><option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5"><label className="font-bold text-text-muted uppercase text-[10px]">License Number</label><input type="text" value={editLicense} onChange={(e) => setEditLicense(e.target.value)} className="w-full bg-bg-base border border-border-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold font-mono" /></div>
                  <div className="flex flex-col gap-1.5"><label className="font-bold text-text-muted uppercase text-[10px]">License Expiry</label><input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} className="w-full bg-bg-base border border-border-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold font-mono" /></div>
                  <div className="col-span-2 flex flex-col gap-1.5"><label className="font-bold text-text-muted uppercase text-[10px]">Residential Address</label><textarea value={editAddress} onChange={(e) => setEditAddress(e.target.value)} rows={2} className="w-full bg-bg-base border border-border-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold" /></div>
                </div>
                <div className="p-4 border border-brand-gold/30 bg-brand-gold/5 rounded-xl flex flex-col gap-4 mt-2">
                  <span className="font-black text-brand-gold uppercase text-[11px] flex items-center gap-2"><Wallet className="h-4 w-4" /> Financial Contract Overrides</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5"><label className="font-bold text-brand-gold/80 uppercase text-[10px]">Contract 30-Day Rate (₦)</label><input type="number" value={editAgreedAmount} onChange={(e) => setEditAgreedAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold font-mono text-brand-gold" /></div>
                    <div className="flex flex-col gap-1.5"><label className="font-bold text-brand-gold/80 uppercase text-[10px]">Remaining Rig Balance (₦)</label><input type="number" value={editRemainingBalance} onChange={(e) => setEditRemainingBalance(e.target.value)} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-brand-gold font-mono text-brand-gold" /></div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-border-main/50 mt-2">
                  <Button variant="outline" type="button" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
                  <Button variant="primary" type="submit">Save Changes</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* FULLSCREEN DOC VIEWER */}
        {isFullscreenDocOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-950/95 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-md" onClick={() => setIsFullscreenDocOpen(null)}>
            <div className="absolute top-4 right-4 z-[110] flex gap-2">
              <a href={isFullscreenDocOpen} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-3 bg-slate-800 text-slate-200 rounded-xl hover:bg-brand-gold hover:text-slate-900 transition-all shadow-xl">
                <Download className="h-5 w-5" />
              </a>
              <button onClick={() => setIsFullscreenDocOpen(null)} className="p-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-xl cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {(isFullscreenDocOpen.includes('.jpg') || isFullscreenDocOpen.includes('.png') || isFullscreenDocOpen.startsWith('data:image')) ? (
                <img src={getAuthorizedUrl(isFullscreenDocOpen)} alt="Document View" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-800" />
              ) : (
                <iframe src={getAuthorizedUrl(isFullscreenDocOpen)} className="w-full h-full bg-white rounded-xl shadow-2xl border border-slate-800" title="Document Viewer" />
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
