import { compressImageFile } from '../utils/imageCompressor';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Modal, ProgressBar } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { subscribeToActiveCycle } from '../utils/cycleService';
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
  Clock,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Coins,
  Building,
  Calendar,
  DollarSign,
  X,
  ShieldCheck,
  Sparkles,
  Calculator,
  RefreshCw,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

  // Pay Now Workflow Pop-Up States
  const [isPayNowModalOpen, setIsPayNowModalOpen] = useState(false);
  const [payNowStep, setPayNowStep] = useState<1 | 2 | 3>(1);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<any | null>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(50000);
  const [paymentChannel, setPaymentChannel] = useState<string>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentRemarks, setPaymentRemarks] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentSuccessReceipt, setPaymentSuccessReceipt] = useState<any | null>(null);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState<boolean>(false);

  // Telematics & Shift States
  const [telematicsData, setTelematicsData] = useState<any | null>(null);
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [isUpdatingShift, setIsUpdatingShift] = useState<boolean>(false);
  const [startingMileage, setStartingMileage] = useState<string>('');
  const [endingMileage, setEndingMileage] = useState<string>('');
  const [shiftLocation, setShiftLocation] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState<string>('');
  
  const fetchTelematics = async (driverId: string) => {
    try {
      const res = await api.getDriverTelematics(driverId);
      if (res && res.success) {
        setTelematicsData(res);
        setIsShiftActive(!!res.activeDuty);
      }
    } catch (err) {
      console.error("Failed to fetch telematics data:", err);
    }
  };

  const fetchData = async () => {
    try {
      const me = await api.getMe();
      if (me) {
        const d = await api.getDriverById('me');
        if (d) {
          setDriverData(d);
          if (d.vehicle) {
            setVehicle(d.vehicle);
          } else {
            const vList = await api.getVehicles();
            const v = vList.find((item: any) => item.driver_id === d.id || item.driverId === d.id || item.id === d.vehicleId || item.id === d.vehicle_id);
            setVehicle(v || null);
          }
          const p = await api.getPayments(d.id);
          setPayments(p || []);
          const t = await api.getTrips().then(list => list.filter((item: any) => item.driverId === d.id || item.driver_id === d.id || item.driverId === me.id));
          setTrips(t || []);
          
          await fetchTelematics(d.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch driver data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handlePendingPassportSync = async () => {
      const pendingPassport = localStorage.getItem('pending_passport_upload');
      const pendingTimestamp = localStorage.getItem('pending_passport_timestamp');
      const isRecent = pendingTimestamp && (Date.now() - parseInt(pendingTimestamp, 10)) < 300000; // 5 mins

      if (pendingPassport && isRecent) {
        try {
          console.log('[AUTO-SYNC] Recovering pending driver passport upload from process death...');
          await api.request('/api/drivers/self', {
            method: 'PUT',
            body: JSON.stringify({ passportPhoto: pendingPassport })
          });
        } catch (syncErr) {
          console.error('Failed to auto-sync pending driver passport:', syncErr);
        } finally {
          localStorage.removeItem('pending_passport_upload');
          localStorage.removeItem('pending_passport_timestamp');
        }
      }
      
      await fetchData();
    };

    handlePendingPassportSync();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Periodic Telematics Location Reporting
  useEffect(() => {
    if (!isShiftActive || !driverData) return;
    
    const reportLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              await api.sendDriverLocation({
                driverId: driverData.id,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                speed: pos.coords.speed || 0,
                heading: pos.coords.heading || 0,
                altitude: pos.coords.altitude || 0,
                placeName: 'Active Tracking Location',
              });
              fetchTelematics(driverData.id);
            } catch (err) {
              console.error("Failed to send location update", err);
            }
          },
          (err) => console.error("Geolocation error:", err),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    };
    
    // Initial report, then every 2 minutes while active
    reportLocation();
    const locInterval = setInterval(reportLocation, 120000);
    return () => clearInterval(locInterval);
  }, [isShiftActive, driverData]);

  const handleStartShift = async () => {
    if (!driverData) return;
    setIsUpdatingShift(true);
    try {
      let lat = 9.0765;
      let lng = 7.3986;
      if ('geolocation' in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              resolve(true);
            },
            () => resolve(false),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
      const res = await api.startDriverDuty({
        startingMileage: parseFloat(startingMileage) || 0,
        startingLocation: shiftLocation || 'Terminal',
        latitude: lat,
        longitude: lng,
        placeName: shiftLocation || 'Terminal'
      });
      if (res.success) {
        await fetchTelematics(driverData.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to start shift");
    } finally {
      setIsUpdatingShift(false);
      setStartingMileage('');
      setShiftLocation('');
    }
  };

  const handleEndShift = async () => {
    if (!driverData) return;
    setIsUpdatingShift(true);
    try {
      const res = await api.finishDriverDuty({
        endingMileage: parseFloat(endingMileage) || 0,
        notes: shiftNotes
      });
      if (res.success) {
        await fetchTelematics(driverData.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to end shift");
    } finally {
      setIsUpdatingShift(false);
      setEndingMileage('');
      setShiftNotes('');
    }
  };

  // Trigger Pay Now modal whenever activeTab is set to 'pay-now'
  useEffect(() => {
    if (activeTab === 'pay-now') {
      openPayNowModal();
    }
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = subscribeToActiveCycle((data) => {
      if (data) {
        setSelectedCycle({
          id: data.cycleId,
          title: `Active Operating Cycle ${data.cycleId}`,
          status: data.status,
          startDate: data.startDate,
          agreedAmount: driverData?.agreed_amount ?? driverData?.agreedAmount ?? 0,
          daysRemaining: data.daysRemaining,
          currentDay: data.currentDay
        });
      } else {
        setSelectedCycle(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const openPayNowModal = async () => {
    setIsPayNowModalOpen(true);
    setPayNowStep(1);
    setPaymentSuccessReceipt(null);
    setReferenceNumber(`TRX-${Date.now().toString().slice(-6)}`);
    try {
      setIsLoadingInstallments(true);
      let currentDriver = driverData;
      if (!currentDriver) {
        const me = await api.getMe();
        if (me) {
          const d = await api.getDriverById('me');
          if (d) {
            currentDriver = d;
            setDriverData(d);
          }
        }
      }

      // Load operational cycles
      const cyclesRes = await api.request('/api/director/cycles').catch(() => ({ cycles: [] }));
      const cyclesList = cyclesRes.cycles || [];
      setCycles(cyclesList);
      
      const cycleToUse = selectedCycle || cyclesList.find((c: any) => c.status === 'active' || c.status === 'paused') || null;
      if (!selectedCycle) setSelectedCycle(cycleToUse);

      // Load installments for driver
      if (currentDriver) {
        const instRes = await api.request(`/api/drivers/${currentDriver.id}/installments${cycleToUse ? `?cycleId=${cycleToUse.id}` : ''}`).catch(() => ({ installments: [] }));
        let list = instRes.installments || [];
        if (list.length === 0) {
          const agreed = currentDriver.agreed_amount ?? currentDriver.agreedAmount ?? 0;
          const perInst = Math.round(agreed / 6);
          list = [1, 2, 3, 4, 5, 6].map(k => ({
            installmentNumber: k,
            dueAmount: perInst,
            paidAmount: 0,
            remainingAmount: perInst,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
            status: 'Pending'
          }));
        }
        setInstallments(list);
        if (list.length > 0) {
          // Default select real-time due installment (isCurrentRealTime) or first unpaid/pending installment
          const realTimeInst = list.find((i: any) => i.isCurrentRealTime && i.status !== 'Completed') ||
                               list.find((i: any) => i.status !== 'Completed') || 
                               list[0];
          setSelectedInstallment(realTimeInst);
          const currentAgreed = currentDriver.agreed_amount ?? currentDriver.agreedAmount ?? 0;
          setPaymentAmount(realTimeInst.remainingAmount || (currentAgreed > 0 ? Math.round(currentAgreed / 6) : 0));
        }
      }
    } catch (err) {
      console.error("Failed to load cycles or installments:", err);
    } finally {
      setIsLoadingInstallments(false);
    }
  };

  const handleSelectInstallment = (inst: any) => {
    setSelectedInstallment(inst);
    setPaymentAmount(inst.remainingAmount || 0);
    setPayNowStep(3); // Proceed to live calculation & payment
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverData) return;
    if (!paymentAmount || paymentAmount <= 0) {
      alert("Please enter a valid payment remittance amount.");
      return;
    }
    const refNum = referenceNumber.trim() || `TRX-${Date.now().toString().slice(-6)}`;
    setIsSubmittingPayment(true);

    try {
      const rawVehPrice = driverData?.vehiclePurchasePrice ?? driverData?.vehicle_purchase_price ?? driverData?.financials?.vehiclePurchasePrice;
      const vehiclePrice = rawVehPrice !== undefined && rawVehPrice !== null ? parseFloat(rawVehPrice) || 0 : 0;
      const totalPaid = driverData?.total_amount_paid || driverData?.totalAmountPaid || payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const currentBalance = driverData?.remaining_vehicle_balance || driverData?.remainingVehicleBalance || Math.max(0, vehiclePrice - totalPaid);
      const newBalance = Math.max(0, currentBalance - paymentAmount);
      const newPaid = totalPaid + paymentAmount;
      const newPercent = ((newPaid / vehiclePrice) * 100).toFixed(2);

      const res = await api.request('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          driverId: driverData.id,
          amount: paymentAmount,
          installmentNumber: selectedInstallment?.installmentNumber || 1,
          date: paymentDate,
          referenceNumber: refNum,
          receiptNumber: refNum,
          paymentMethod: paymentChannel,
          remarks: paymentRemarks,
          outstandingAmount: newBalance
        })
      });

      if (res && (res.success || res.payment)) {
        setPaymentSuccessReceipt({
          receiptNumber: refNum,
          amount: paymentAmount,
          installmentNumber: selectedInstallment?.installmentNumber || 1,
          date: paymentDate,
          channel: paymentChannel,
          projectedBalance: newBalance,
          projectedPercent: newPercent
        });
        await fetchData(); // Refresh local driver & payment data
      } else if (res && res.error) {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit remittance payment.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (loading && !driverData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  // Passport photo URL resolution
  const passportUrl = (() => {
    const doc = (driverData as any)?.documents?.find((d: any) => 
      d.document_type === 'passport_photo' || 
      d.document_type === 'passport' || 
      d.documentType === 'passport_photo' ||
      d.documentType === 'passport'
    );
    const docUrl = doc?.file_url || doc?.fileUrl || doc?.url;
    const directUrl = driverData?.passport_photo_url || 
      driverData?.passportPhoto || 
      driverData?.passportPhotoUrl || 
      (driverData as any)?.passport ||
      (driverData as any)?.avatar ||
      (driverData as any)?.passport_photo ||
      '';
    return docUrl || directUrl || '';
  })();

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageFile(file, 800, 800, 0.75);
      // Save immediately to survive native mobile picker process restarts
      localStorage.setItem('pending_passport_upload', base64);
      localStorage.setItem('pending_passport_timestamp', Date.now().toString());

      // Optimistically update UI state with the new image URL / base64 without page reload
      setDriverData((prev: any) => prev ? {
        ...prev,
        passport_photo_url: base64,
        passportPhoto: base64,
        passportPhotoUrl: base64,
        passport: base64,
        avatar: base64
      } : prev);

      const res = await api.request('/api/drivers/self', {
        method: 'PUT',
        body: JSON.stringify({ passportPhoto: base64 })
      });

      if (res && res.success) {
        localStorage.removeItem('pending_passport_upload');
        localStorage.removeItem('pending_passport_timestamp');
        if (res.driver) {
          setDriverData((prev: any) => prev ? { ...prev, ...res.driver } : res.driver);
        }
      } else {
        console.error("Failed to update passport photo on server:", res?.error);
      }
    } catch (err: any) {
      console.error("Error uploading passport photo:", err?.message || err);
    }
  };

  // Render Animated Passport Avatar
  const renderAnimatedAvatar = (size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'h-12 w-12',
      md: 'h-20 w-20 md:h-24 md:w-24',
      lg: 'h-28 w-28'
    };
    const iconSizes = {
      sm: 'h-6 w-6',
      md: 'h-10 w-10',
      lg: 'h-14 w-14'
    };

    return (
      <div className="relative group flex-shrink-0">
        {/* Animated spinning conic gradient glow ring */}
        <motion.div
          className="absolute -inset-3 rounded-full bg-gradient-to-tr from-brand-gold via-amber-400 to-emerald-400 opacity-80 blur-[4px]"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
        />
        {/* Animated pulsing border halo */}
        <motion.div
          className="absolute -inset-1.5 rounded-full border-2 border-brand-gold/90"
          animate={{ scale: [1, 1.07, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        />
        {/* Inner Avatar Frame */}
        <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden border-2 border-brand-gold bg-slate-950 shadow-2xl flex items-center justify-center`}>
          {passportUrl ? (
            <img
              src={passportUrl}
              alt={driverData?.fullName || driverName}
              className="h-full w-full object-cover rounded-full"
              referrerPolicy="no-referrer"
              onError={(e: any) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`flex flex-col items-center justify-center bg-slate-900 text-brand-gold font-black text-sm h-full w-full ${passportUrl ? 'hidden' : ''}`}>
            {(driverData?.fullName || driverName || 'Driver').substring(0, 2).toUpperCase()}
          </div>
        </div>
        {/* Animated Active Driver Badge Dot */}
        <motion.div
          className="absolute bottom-0 right-0 h-5 w-5 md:h-6 md:w-6 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-lg flex items-center justify-center z-10"
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          title="Active Corporate Fleet Driver"
        >
          <div className="h-2 w-2 bg-white rounded-full" />
        </motion.div>
      </div>
    );
  };

  const rawVehPrice = driverData?.vehiclePurchasePrice ?? driverData?.vehicle_purchase_price ?? driverData?.financials?.vehiclePurchasePrice;
  const vehiclePurchasePrice = rawVehPrice !== undefined && rawVehPrice !== null ? parseFloat(rawVehPrice) || 0 : 0;
  const totalPaid = driverData?.financials?.totalAmountPaid ?? driverData?.total_amount_paid ?? driverData?.totalAmountPaid ?? payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const currentBalance = driverData?.financials?.remainingVehicleBalance ?? driverData?.remaining_vehicle_balance ?? driverData?.remainingVehicleBalance ?? Math.max(0, vehiclePurchasePrice - totalPaid);

  // Live real-time calculations as driver changes payment amount
  const livePaymentVal = paymentAmount || 0;
  const liveProjectedBalance = Math.max(0, currentBalance - livePaymentVal);
  const liveProjectedTotalPaid = totalPaid + livePaymentVal;
  const liveCurrentPercent = vehiclePurchasePrice > 0 ? ((totalPaid / vehiclePurchasePrice) * 100).toFixed(2) : '0.00';
  const liveProjectedPercent = vehiclePurchasePrice > 0 ? ((liveProjectedTotalPaid / vehiclePurchasePrice) * 100).toFixed(2) : '0.00';

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-brand-gold bg-bg-surface shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  {lang === 'en' ? "Active Vehicle" : "Motar da Kake Aiki"}
                </p>
                <h3 className="text-xl font-black mt-1 text-text-main font-mono">
                  {vehicle?.plateNumber || vehicle?.plate_number || "---"}
                </h3>
              </div>
              <div className="p-3 bg-brand-gold/10 rounded-xl text-brand-gold">
                <Truck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-bg-surface shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  {lang === 'en' ? "Total Amount Paid" : "Jimillar Biyan Kudi"}
                </p>
                <h3 className="text-xl font-black mt-1 text-emerald-600 font-mono">
                  ₦{totalPaid.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-bg-surface shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  {lang === 'en' ? "Remaining Lease Balance" : "Sauran Kuden Mota"}
                </p>
                <h3 className="text-xl font-black mt-1 text-blue-500 font-mono">
                  ₦{currentBalance.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-bg-surface shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  {lang === 'en' ? "30-Day Rent Rate" : "Kudin Aiki Na Kwana 30"}
                </p>
                <h3 className="text-xl font-black mt-1 text-purple-600 font-mono">
                  ₦{(driverData?.agreed_amount ?? driverData?.agreedAmount ?? driverData?.financials?.agreedAmount ?? 0).toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pay Now Banner Card */}
      <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 border border-brand-gold/30 shadow-xl rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-brand-gold/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-gold/20 border border-brand-gold/40 rounded-full text-brand-gold text-xs font-extrabold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              {lang === 'en' ? "Remittance Cycle Active" : "Zangon Biyan Kudi Yana Bude"}
            </div>
            <h3 className="text-xl md:text-2xl font-black tracking-tight text-white">
              {lang === 'en' ? "Submit Remittance & Track Vehicle Ownership" : "Tura Kudin Remittance Ka Duba Mallakar Mota"}
            </h3>
            <p className="text-slate-300 text-xs md:text-sm max-w-xl">
              {lang === 'en' 
                ? "Select your active company operating cycle, pick installment terms, and see live real-time calculations on your vehicle balance and ownership percentage."
                : "Auna zangon aikin kamfani, zabi kashi, ka kalli lissafin sauran kudin motarka kai tsaye."}
            </p>
          </div>
          <Button
            onClick={openPayNowModal}
            className="bg-brand-gold hover:bg-amber-400 text-slate-950 font-black px-6 py-3.5 rounded-xl shadow-lg flex items-center gap-2 text-sm whitespace-nowrap transform hover:scale-105 transition-all cursor-pointer"
          >
            <CreditCard className="h-5 w-5 text-slate-950" />
            {lang === 'en' ? "Launch Pay Now Workflow 💳" : "Fara Biyan Kudi 💳"}
          </Button>
        </div>
      </Card>

      {/* Driver & Rig Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-bg-surface">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-brand-gold" />
              {lang === 'en' ? "Driver Dossier Summary" : "Taqaitaccen Bayanin Direba"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">Full Name:</span>
              <span className="font-semibold text-text-main">{driverData?.fullName || driverName}</span>
            </div>
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">Company Driver ID:</span>
              <span className="font-mono text-brand-gold font-bold">{driverData?.company_driver_id || driverData?.companyDriverId || 'PENDING'}</span>
            </div>
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">Phone:</span>
              <span className="font-mono text-text-main">{driverData?.phone || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">NIN:</span>
              <span className="font-mono text-text-main">{driverData?.nin || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted font-bold">License Number:</span>
              <span className="font-mono text-text-main">{driverData?.licenseNumber || driverData?.license_number || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bg-surface">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-500" />
              {lang === 'en' ? "Assigned Rig Asset" : "Motar da Kake Aiki Da Ita"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">Brand & Model:</span>
              <span className="font-semibold text-text-main">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Not Assigned'}</span>
            </div>
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">Plate Number:</span>
              <span className="font-mono text-brand-gold font-bold">{vehicle?.plateNumber || vehicle?.plate_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">Engine Number:</span>
              <span className="font-mono text-text-main">{vehicle?.engineNumber || vehicle?.engine_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-border-main/40 pb-2">
              <span className="text-text-muted font-bold">Chassis Number:</span>
              <span className="font-mono text-text-main">{vehicle?.chassisNumber || vehicle?.chassis_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted font-bold">Tonnage Limit:</span>
              <span className="font-semibold text-text-main">{vehicle?.capacity || '30 Tons'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips */}
      <Card className="bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-brand-gold" />
            {lang === 'en' ? "Recent Activity" : "Ayyukan Kwanan Nan"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trips.slice(0, 5).map((trip, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-bg-base/40 rounded-xl border border-border-main/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-bg-surface rounded-lg border border-border-main">
                    <TrendingUp className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-main">{trip.destination}</p>
                    <p className="text-[10px] text-text-muted font-mono">
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
              <p className="text-center py-6 text-sm text-text-muted italic">
                {lang === 'en' ? "No recent trips recorded." : "Ba a sami tafiye-tafiye ba."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderVehicleTab = () => (
    <Card className="bg-bg-surface p-6">
      <CardHeader className="p-0 pb-4 mb-4 border-b border-border-main">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Truck className="h-5 w-5 text-brand-gold" />
          {lang === 'en' ? "Allocated Rig Specifications" : "Bayanan Mota"}
        </CardTitle>
      </CardHeader>
      {vehicle ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <div><span className="text-text-muted font-bold block text-xs">Brand:</span> <span className="font-semibold text-text-main">{vehicle.brand}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Model:</span> <span className="font-semibold text-text-main">{vehicle.model}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Year:</span> <span className="font-mono text-text-main">{vehicle.year}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Colour:</span> <span className="font-semibold text-text-main">{vehicle.colour || vehicle.color || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Plate Number:</span> <span className="font-mono font-bold text-brand-gold text-base">{vehicle.plateNumber || vehicle.plate_number}</span></div>
          </div>
          <div className="space-y-3">
            <div><span className="text-text-muted font-bold block text-xs">Registration Number:</span> <span className="font-mono text-text-main">{vehicle.registrationNumber || vehicle.registration_number || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Chassis Number:</span> <span className="font-mono text-text-main">{vehicle.chassisNumber || vehicle.chassis_number || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Engine Number:</span> <span className="font-mono text-text-main">{vehicle.engineNumber || vehicle.engine_number || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Capacity:</span> <span className="font-semibold text-text-main">{vehicle.capacity || '30 Tons'}</span></div>
            <div><span className="text-text-muted font-bold block text-xs">Operational Status:</span> <Badge variant="success">{(vehicle.status || 'assigned').toUpperCase()}</Badge></div>
          </div>
        </div>
      ) : (
        <p className="text-text-muted italic text-center py-8">No vehicle assigned yet.</p>
      )}
    </Card>
  );

  const renderPayNowTab = () => (
    <Card className="bg-bg-surface p-6 space-y-6">
      <CardHeader className="p-0 pb-4 mb-4 border-b border-border-main flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-brand-gold" />
            {lang === 'en' ? "Remittance & Payment Engine" : "Tsarin Biyan Kudi"}
          </CardTitle>
          <CardDescription className="text-xs text-text-muted mt-1">
            {lang === 'en' 
              ? "Manage your operational cycle remittances, select installment schedules, and submit payments to build vehicle ownership."
              : "Sarrafa biyan kudinka da kuma mallakar motarka."}
          </CardDescription>
        </div>
        <Button
          onClick={openPayNowModal}
          className="bg-brand-gold hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer"
        >
          <CreditCard className="h-5 w-5" />
          {lang === 'en' ? "Launch Pay Now Wizard 💳" : "Fara Biyan Kudi 💳"}
        </Button>
      </CardHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-bg-base/60 rounded-2xl border border-border-main/50 space-y-2">
          <span className="text-[10px] font-bold text-text-muted uppercase">Vehicle Purchase Price</span>
          <p className="text-xl font-mono font-black text-text-main">₦{vehiclePurchasePrice.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 space-y-2">
          <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Amount Paid</span>
          <p className="text-xl font-mono font-black text-emerald-600">₦{totalPaid.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/30 space-y-2">
          <span className="text-[10px] font-bold text-blue-500 uppercase">Remaining Balance</span>
          <p className="text-xl font-mono font-black text-blue-500">₦{currentBalance.toLocaleString()}</p>
        </div>
      </div>

      <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-brand-gold uppercase tracking-wider">Active Cycle & Installments</span>
          <Badge variant="success">READY FOR REMITTANCE</Badge>
        </div>
        <p className="text-slate-300 text-xs">
          Click the button above to launch the 3-step payment wizard where you can choose your active operating cycle, select installment numbers (1 to 6), calculate live vehicle equity percentages, and submit your payment slip for instant audit approval.
        </p>
        <Button
          onClick={openPayNowModal}
          className="bg-gradient-to-r from-brand-gold via-amber-500 to-amber-600 text-slate-950 font-black px-6 py-3 rounded-xl shadow-md w-full md:w-auto cursor-pointer"
        >
          Open Pay Now Workflow Now 💳
        </Button>
      </div>
    </Card>
  );

  const renderPaymentsTab = () => (
    <Card className="bg-bg-surface p-6">
      <CardHeader className="p-0 pb-4 mb-4 border-b border-border-main flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-500" />
          {lang === 'en' ? "Remittance & Installment History" : "Tarihin Biyan Kudi"}
        </CardTitle>
        <div className="flex items-center gap-3">
          <Button onClick={openPayNowModal} size="sm" className="bg-brand-gold text-slate-950 font-bold text-xs gap-1">
            <CreditCard className="h-4 w-4" />
            {lang === 'en' ? "Pay Now" : "Biyan Yanzu"}
          </Button>
          <span className="text-xs font-mono font-bold text-emerald-500">
            Total Paid: ₦{totalPaid.toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-text-main">
          <thead>
            <tr className="border-b border-border-main bg-bg-base/50 text-text-muted uppercase text-[10px] font-bold">
              <th className="p-3">Date</th>
              <th className="p-3">Reference / Slip</th>
              <th className="p-3">Channel</th>
              <th className="p-3 text-right">Amount (₦)</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, idx) => (
              <tr key={idx} className="border-b border-border-main/30 hover:bg-bg-base/30 transition-all">
                <td className="p-3 font-mono text-text-muted">{p.date || p.created_at?.substring(0, 10) || '---'}</td>
                <td className="p-3 font-mono font-bold text-brand-navy">{p.receipt_number || p.reference_number || 'N/A'}</td>
                <td className="p-3 capitalize">{p.payment_method?.replace('_', ' ') || 'Bank Transfer'}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-600">₦{(p.amount || 0).toLocaleString()}</td>
                <td className="p-3 text-center">
                  <Badge variant={p.status === 'approved' || p.status === 'completed' ? 'success' : 'warning'}>
                    {(p.status || 'submitted').toUpperCase()}
                  </Badge>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted italic">
                  No payment remittances recorded yet. Click "Pay Now" to make your first payment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderProfileTab = () => {
    const g = driverData?.guarantor;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-bg-surface p-6">
          <CardHeader className="p-0 pb-4 mb-4 border-b border-border-main flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-brand-gold" />
              {lang === 'en' ? "Personal Identity Details" : "Bayanin Shaidar Kai"}
            </CardTitle>
            {renderAnimatedAvatar('sm')}
          </CardHeader>
          <div className="space-y-3 text-xs">
            <div><span className="text-text-muted font-bold block">Full Name:</span> <span className="font-semibold text-text-main text-sm">{driverData?.fullName || driverName}</span></div>
            <div><span className="text-text-muted font-bold block">Telephone:</span> <span className="font-mono text-text-main">{driverData?.phone || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block">Email:</span> <span className="font-mono text-text-main">{driverData?.email || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block">Residential Address:</span> <span className="text-text-main">{driverData?.address || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block">NIN Number:</span> <span className="font-mono text-text-main">{driverData?.nin || 'N/A'}</span></div>
            <div><span className="text-text-muted font-bold block">Driver's License:</span> <span className="font-mono text-text-main">{driverData?.licenseNumber || driverData?.license_number || 'N/A'} (Exp: {driverData?.licenseExpiry || driverData?.license_expiry || 'N/A'})</span></div>
            
            <div className="pt-4 border-t border-border-main/40 mt-4 space-y-2">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Real Passport Photograph</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-brand-gold bg-slate-900 flex-shrink-0 shadow-md">
                  {passportUrl ? (
                    <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }} src={passportUrl} alt="Passport" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-brand-gold font-bold text-xs">
                      {(driverData?.fullName || driverName).substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="driver-passport-upload-input" 
                    className="hidden" 
                    onChange={handlePassportUpload} 
                  />
                  <Button 
                    type="button"
                    size="sm" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      document.getElementById('driver-passport-upload-input')?.click();
                    }}
                    className="bg-brand-gold hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    {lang === 'en' ? "Upload / Change Passport 📷" : "Canza Hoton Fasfo 📷"}
                  </Button>
                  <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                    {lang === 'en' ? "Upload your real passport photo to display it on your avatar and profile." : "Sanya ainihin hoton fasfoka don nuna shi a avatar da bayanan martaba."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-bg-surface p-6">
          <CardHeader className="p-0 pb-4 mb-4 border-b border-border-main">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              {lang === 'en' ? "Guarantor Profile" : "Bayanin Guarantor"}
            </CardTitle>
          </CardHeader>
          {g ? (
            <div className="space-y-3 text-xs">
              <div><span className="text-text-muted font-bold block">Guarantor Name:</span> <span className="font-semibold text-text-main text-sm">{g.fullName || g.full_name}</span></div>
              <div><span className="text-text-muted font-bold block">Telephone:</span> <span className="font-mono text-text-main">{g.phone || 'N/A'}</span></div>
              <div><span className="text-text-muted font-bold block">Relationship:</span> <span className="text-text-main">{g.relationship || 'N/A'}</span></div>
              <div><span className="text-text-muted font-bold block">Guarantor Address:</span> <span className="text-text-main">{g.address || 'N/A'}</span></div>
              <div><span className="text-text-muted font-bold block">Guarantor NIN:</span> <span className="font-mono text-text-main">{g.nin || 'N/A'}</span></div>
            </div>
          ) : (
            <p className="text-text-muted italic text-center py-8">No guarantor details provided.</p>
          )}
        </Card>
      </div>
    );
  };

  const renderTelematicsTab = () => (
    <div className="space-y-6">
      <Card className="bg-bg-surface p-6">
        <CardHeader className="p-0 pb-4 mb-4 border-b border-border-main flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-gold" />
            {lang === 'en' ? "Live Telematics & Duty Shift" : "Bibiyar Aiki Tsaye"}
          </CardTitle>
          <Badge variant={isShiftActive ? 'success' : 'warning'}>
            {isShiftActive ? 'ON DUTY' : 'OFF DUTY'}
          </Badge>
        </CardHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Duty Controls */}
          <div className="bg-bg-base border border-border-main p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-text-main">
              {isShiftActive ? 'Active Shift Controls' : 'Start New Shift'}
            </h3>
            
            {isShiftActive ? (
              <div className="space-y-4">
                <p className="text-xs text-text-muted">You are currently on duty. Your live location is being transmitted periodically to the central fleet management.</p>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Ending Mileage</label>
                  <input
                    type="number"
                    value={endingMileage}
                    onChange={(e) => setEndingMileage(e.target.value)}
                    className="w-full bg-bg-surface border border-border-main p-2 rounded-lg text-sm"
                    placeholder="e.g. 15400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Shift Notes / Issues</label>
                  <input
                    type="text"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    className="w-full bg-bg-surface border border-border-main p-2 rounded-lg text-sm"
                    placeholder="Any incidents?"
                  />
                </div>
                <Button 
                  onClick={handleEndShift}
                  disabled={isUpdatingShift}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
                >
                  {isUpdatingShift ? 'Ending...' : 'End Duty Shift 🛑'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-text-muted">Start your shift to begin live GPS tracking and register your operational duty session.</p>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Starting Mileage</label>
                  <input
                    type="number"
                    value={startingMileage}
                    onChange={(e) => setStartingMileage(e.target.value)}
                    className="w-full bg-bg-surface border border-border-main p-2 rounded-lg text-sm"
                    placeholder="e.g. 15200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Starting Location</label>
                  <input
                    type="text"
                    value={shiftLocation}
                    onChange={(e) => setShiftLocation(e.target.value)}
                    className="w-full bg-bg-surface border border-border-main p-2 rounded-lg text-sm"
                    placeholder="e.g. Central Depot"
                  />
                </div>
                <Button 
                  onClick={handleStartShift}
                  disabled={isUpdatingShift}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {isUpdatingShift ? 'Starting...' : 'Start Duty Shift 🚀'}
                </Button>
              </div>
            )}
          </div>

          {/* Telematics Readout */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4 text-white">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-gold" />
              Live Telemetry Feed
            </h3>
            
            {telematicsData?.currentLocation ? (
              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Speed</span>
                  <span className="text-brand-gold font-bold text-lg">{Math.round(telematicsData.currentLocation.speed || 0)} <span className="text-sm">km/h</span></span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Status</span>
                  <span className="text-emerald-400 font-bold">{telematicsData.currentLocation.activity || 'Active'}</span>
                </div>
                <div className="col-span-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Last Known Location</span>
                  <span className="text-white">
                    {telematicsData.currentLocation.place_name || 
                     `${telematicsData.currentLocation.latitude?.toFixed(4)}, ${telematicsData.currentLocation.longitude?.toFixed(4)}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic">
                No active telemetry data streaming. Start your shift to activate.
              </div>
            )}
          </div>
        </div>

        {/* Places Visited Today */}
        {telematicsData?.placesVisitedToday && telematicsData.placesVisitedToday.length > 0 && (
          <div className="mt-6 border-t border-border-main pt-4">
            <h3 className="text-sm font-bold text-text-main mb-4">Places Visited Today</h3>
            <div className="space-y-3">
              {telematicsData.placesVisitedToday.map((place: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-bg-base rounded-xl border border-border-main/50 text-xs">
                  <div>
                    <p className="font-bold text-text-main">{place.place_name}</p>
                    <p className="text-[10px] text-text-muted font-mono mt-1">
                      Arrived: {new Date(place.arrived_at).toLocaleTimeString()} 
                      {place.departed_at ? ` | Departed: ${new Date(place.departed_at).toLocaleTimeString()}` : ' | Currently Here'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={place.status === 'completed' ? 'secondary' : 'warning'}>
                      {place.dwell_duration_minutes} min dwell
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 bg-bg-base min-h-screen">
      {/* Welcome Header with Animated Motion Passport Avatar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-6 md:p-8 rounded-3xl text-white border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 text-center sm:text-left">
          {/* Animated Circle Motion Avatar */}
          {renderAnimatedAvatar('md')}

          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                {lang === 'en' ? `Welcome, ${driverName}` : `Barka da zuwa, ${driverName}`}
              </h1>
              <Badge variant="gold" className="font-mono font-bold text-xs">
                {driverData?.company_driver_id || driverData?.companyDriverId || 'RTL-DRIVER'}
              </Badge>
            </div>
            <p className="text-slate-400 text-xs md:text-sm mt-1.5 max-w-lg leading-relaxed">
              {lang === 'en' 
                ? "Monitor your assigned carrier rig, track operational cycles, submit payment remittances, and view live vehicle calculations."
                : "Bibiyar aikinka, duba biyan kudinka, da kuma sarrafa takardun aikinka a wuri daya."}
            </p>
          </div>
        </div>

        {/* Action Button: Pay Now */}
        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          <Button
            onClick={() => {
              setActiveTab('pay-now');
              openPayNowModal();
            }}
            className="w-full md:w-auto bg-gradient-to-r from-brand-gold via-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-black text-sm px-6 py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2 transform hover:scale-105 transition-all cursor-pointer"
          >
            <CreditCard className="h-5 w-5 text-slate-950" />
            {lang === 'en' ? "Pay Now 💳" : "Biyan Yanzu 💳"}
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border-main overflow-x-auto pb-1">
        {[
          { id: 'overview', label: lang === 'en' ? "Overview" : "Bayanai", icon: <LayersIcon className="h-4 w-4" /> },
          { id: 'telematics', label: lang === 'en' ? "Telematics" : "Bibiya", icon: <Activity className="h-4 w-4 text-emerald-500" /> },
          { id: 'pay-now', label: lang === 'en' ? "Pay Now 💳" : "Biyan Yanzu 💳", icon: <CreditCard className="h-4 w-4 text-emerald-500" /> },
          { id: 'vehicle', label: lang === 'en' ? "My Vehicle" : "Motata", icon: <Truck className="h-4 w-4" /> },
          { id: 'payments', label: lang === 'en' ? "Payments" : "Biyan Kudi", icon: <Wallet className="h-4 w-4" /> },
          { id: 'history', label: lang === 'en' ? "History" : "Tarihi", icon: <HistoryIcon className="h-4 w-4" /> },
          { id: 'documents', label: lang === 'en' ? "Documents" : "Takardu", icon: <FileText className="h-4 w-4" /> },
          { id: 'profile', label: lang === 'en' ? "Profile" : "Akuna", icon: <User className="h-4 w-4" /> },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'pay-now') openPayNowModal();
              }}
              className={`flex items-center gap-2 px-4 py-3 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap cursor-pointer transition-all ${
                isActive 
                  ? 'border-brand-gold text-brand-gold bg-brand-gold/5 rounded-t-xl' 
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab View */}
      <div className="mt-2">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'telematics' && renderTelematicsTab()}
        {activeTab === 'pay-now' && renderPayNowTab()}
        {activeTab === 'vehicle' && renderVehicleTab()}
        {activeTab === 'payments' && renderPaymentsTab()}
        {activeTab === 'profile' && renderProfileTab()}
        {(activeTab === 'history' || activeTab === 'documents') && (
          <Card className="bg-bg-surface p-6">
            <CardHeader className="p-0 pb-4 mb-4 border-b border-border-main">
              <CardTitle className="text-base font-bold flex items-center gap-2 capitalize">
                <FileText className="h-5 w-5 text-brand-gold" />
                {activeTab}
              </CardTitle>
            </CardHeader>
            <p className="text-text-muted text-xs italic py-6 text-center">
              {activeTab === 'history' ? 'Trip history logs are up to date.' : 'Driver license & passport documents verified by Admin.'}
            </p>
          </Card>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3-STEP POP-UP PAY NOW WORKFLOW MODAL                                    */}
      {/* ========================================================================= */}
      {isPayNowModalOpen && (
        <Modal 
          isOpen={true}
          onClose={() => {
            setIsPayNowModalOpen(false);
            if (activeTab === 'pay-now') setActiveTab('overview');
          }} 
          title="RTL Remittance & Amortization Payment Engine"
        >
          <div className="flex flex-col gap-5 p-1 max-w-2xl text-text-main">
            {/* Success Receipt Popup */}
            {paymentSuccessReceipt ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center p-4 md:p-6 bg-emerald-500/5 border border-emerald-500/30 rounded-2xl space-y-4 w-full"
              >
                <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/40">
                  <CheckCircle2 className="h-10 w-10 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-emerald-600">Remittance Payment Submitted!</h3>
                  <p className="text-xs text-text-muted mt-1">Receipt Reference: <span className="font-mono font-bold text-text-main">{paymentSuccessReceipt.receiptNumber}</span></p>
                </div>

                <div className="w-full bg-bg-base/80 p-4 rounded-xl border border-border-main/50 space-y-2 text-left text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted font-bold">Submitted Remittance Amount:</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">₦{(paymentSuccessReceipt.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted font-bold">Installment Number:</span>
                    <span className="font-bold text-text-main">Installment #{paymentSuccessReceipt.installmentNumber}</span>
                  </div>
                  <div className="flex justify-between border-t border-border-main/30 pt-2">
                    <span className="text-text-muted font-bold">New Remaining Vehicle Balance:</span>
                    <span className="font-mono font-bold text-brand-navy">₦{(paymentSuccessReceipt.projectedBalance).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted font-bold">New Vehicle Equity Percentage:</span>
                    <span className="font-mono font-bold text-brand-gold">{paymentSuccessReceipt.projectedPercent}% Paid</span>
                  </div>
                </div>

                <p className="text-[11px] text-text-muted italic">
                  Payment is now pending audit approval by RTL Financial Administration.
                </p>

                <Button 
                  onClick={() => {
                    setIsPayNowModalOpen(false);
                    if (activeTab === 'pay-now') setActiveTab('payments');
                  }}
                  className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl"
                >
                  Done & View Payments Log
                </Button>
              </motion.div>
            ) : (
              <>
                {/* Step Indicator Bar */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold border-b border-border-main/40 pb-3">
                  <div className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                    payNowStep === 1 
                      ? 'bg-brand-gold/15 border-brand-gold text-brand-gold' 
                      : payNowStep > 1 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                      : 'bg-bg-base text-text-muted border-border-main/40'
                  }`}>
                    <span className="text-[10px] uppercase tracking-wider">Step 1</span>
                    <span className="text-[11px] font-extrabold flex items-center gap-1">
                      <Building className="h-3.5 w-3.5" />
                      Operating Cycle
                    </span>
                  </div>

                  <div className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                    payNowStep === 2 
                      ? 'bg-brand-gold/15 border-brand-gold text-brand-gold' 
                      : payNowStep > 2 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                      : 'bg-bg-base text-text-muted border-border-main/40'
                  }`}>
                    <span className="text-[10px] uppercase tracking-wider">Step 2</span>
                    <span className="text-[11px] font-extrabold flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" />
                      Select Installment
                    </span>
                  </div>

                  <div className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                    payNowStep === 3 
                      ? 'bg-brand-gold/15 border-brand-gold text-brand-gold' 
                      : 'bg-bg-base text-text-muted border-border-main/40'
                  }`}>
                    <span className="text-[10px] uppercase tracking-wider">Step 3</span>
                    <span className="text-[11px] font-extrabold flex items-center gap-1">
                      <Calculator className="h-3.5 w-3.5" />
                      Pay & Live Calc
                    </span>
                  </div>
                </div>

                {/* STEP 1: ACTIVE OPERATING CYCLE IN COMPANY */}
                {payNowStep === 1 && (
                  <div className="space-y-4">
                    <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-brand-gold tracking-wider flex items-center gap-1">
                          <Building className="h-3.5 w-3.5" />
                          Corporate Active Cycle
                        </span>
                        <Badge variant="success">ACTIVE RUNNING</Badge>
                      </div>
                      <h3 className="text-lg font-black text-white">
                        {selectedCycle?.title || "No Active Operating Cycle Assigned"}
                      </h3>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        Every operating cycle consists of a 30-day term structured into 6 installments of 5 operational days each.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono border-t border-slate-800">
                        <div>
                          <span className="block text-slate-500 text-[10px]">30-Day Target Remittance:</span>
                          <span className="text-brand-gold font-bold">₦{(selectedCycle?.agreedAmount ?? driverData?.agreed_amount ?? driverData?.agreedAmount ?? 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 text-[10px]">Per-Installment Target (5 Days):</span>
                          <span className="text-emerald-400 font-bold">₦{(((selectedCycle?.agreedAmount ?? driverData?.agreed_amount ?? driverData?.agreedAmount ?? 0)) / 6).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-bg-base/60 p-4 rounded-xl border border-border-main/40 space-y-2 text-xs">
                      <span className="font-bold text-text-main block">Company Cycle Operational Rules:</span>
                      <ul className="list-disc list-inside text-text-muted space-y-1">
                        <li>Each cycle has 6 installment terms (Days 1–5, 6–10, 11–15, 16–20, 21–25, 26–30).</li>
                        <li>Approved rest days extend installment due dates automatically without penalties.</li>
                        <li>Submitting remittances reduces your remaining vehicle lease balance immediately.</li>
                      </ul>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        onClick={() => setPayNowStep(2)}
                        className="w-full bg-brand-gold hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
                      >
                        Select Active Cycle & View 6 Installments
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: INSTALLMENTS TO CHOOSE */}
                {payNowStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-text-main uppercase tracking-tight">
                        Select Installment to Remit
                      </h4>
                      <span className="text-xs text-text-muted italic">6 Installments per Cycle</span>
                    </div>

                    {isLoadingInstallments ? (
                      <div className="py-12 text-center text-xs text-text-muted animate-pulse">
                        Querying installment schedules for your rig...
                      </div>
                    ) : installments.length === 0 ? (
                      <div className="text-center py-10 bg-bg-base/60 rounded-xl border border-border-main/40">
                        <p className="text-sm font-bold text-text-muted">No installments assigned for this cycle.</p>
                        <p className="text-[11px] text-text-muted mt-1">Please contact your administrator to set up your payment schedule.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                        {installments.map((inst: any) => {
                          const isSel = selectedInstallment?.installmentNumber === inst.installmentNumber;
                          return (
                            <div
                              key={inst.installmentNumber}
                              onClick={() => handleSelectInstallment(inst)}
                              className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 ${
                                isSel
                                  ? 'bg-brand-gold/15 border-brand-gold ring-2 ring-brand-gold/50'
                                  : 'bg-bg-base/60 hover:bg-bg-base border-border-main/60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-brand-navy text-xs flex items-center gap-1">
                                  <Coins className="h-3.5 w-3.5 text-brand-gold" />
                                  Installment #{inst.installmentNumber}
                                  {inst.isCurrentRealTime && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 rounded text-[9px] font-black uppercase">
                                      Live Due
                                    </span>
                                  )}
                                </span>
                                <Badge variant={inst.status === 'Completed' ? 'success' : inst.status === 'Overdue' ? 'danger' : 'warning'}>
                                  {inst.status}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                                <div>
                                  <span className="text-text-muted block text-[9px]">Target:</span>
                                  <span className="font-bold text-text-main">₦{(inst.dueAmount || 50000).toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-text-muted block text-[9px]">Remaining:</span>
                                  <span className="font-bold text-emerald-600">₦{(inst.remainingAmount || 0).toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="text-[9px] font-mono text-text-muted flex justify-between border-t border-border-main/20 pt-1">
                                <span>Term: {inst.startDate} to {inst.endDate}</span>
                                {isSel && <span className="font-bold text-brand-gold">SELECTED ✓</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 border-t border-border-main/40 pt-3">
                      <Button variant="ghost" onClick={() => setPayNowStep(1)} className="text-xs">
                        ← Back to Cycle
                      </Button>
                      {selectedInstallment && (
                        <Button
                          onClick={() => setPayNowStep(3)}
                          className="bg-brand-gold hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1"
                        >
                          Proceed to Payment Calculation
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3: PAY AMOUNT & LIVE VEHICLE CALCULATIONS */}
                {payNowStep === 3 && (
                  <form onSubmit={handleSubmitPayment} className="space-y-4">
                    {/* Live Vehicle Amortization Calculation Box */}
                    <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-brand-gold tracking-wider flex items-center gap-1">
                          <Calculator className="h-3.5 w-3.5" />
                          Live Vehicle Amortization Calculations
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Rig: {vehicle ? `${vehicle.brand} (${vehicle.plateNumber || vehicle.plate_number})` : 'Assigned Rig'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-slate-400 text-[9px] block">Vehicle Value:</span>
                          <span className="text-white font-bold">₦{vehiclePurchasePrice.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Current Paid:</span>
                          <span className="text-emerald-400 font-bold">₦{totalPaid.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Current Balance:</span>
                          <span className="text-blue-400 font-bold">₦{currentBalance.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Interactive Amount Input */}
                      <div>
                        <label className="text-[10px] font-bold text-brand-gold uppercase block mb-1">
                          Enter Remittance Amount To Pay (₦) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₦</span>
                          <input
                            type="number"
                            value={paymentAmount || ''}
                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-brand-gold/60 text-brand-gold font-mono font-black text-lg pl-8 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold"
                            placeholder="50000"
                            required
                            min="1000"
                          />
                        </div>
                      </div>

                      {/* Live Real-Time Dynamic Outputs */}
                      <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 p-3.5 rounded-xl border border-emerald-500/30 space-y-2">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-slate-300">Projected Balance After Payment:</span>
                          <span className="text-emerald-400 font-black text-sm">₦{liveProjectedBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-slate-300">New Total Paid:</span>
                          <span className="text-brand-gold font-bold">₦{liveProjectedTotalPaid.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-slate-300">New Vehicle Ownership Equity:</span>
                          <span className="text-amber-300 font-black">{liveProjectedPercent}% Paid</span>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                            <span>0%</span>
                            <span>{liveProjectedPercent}% Paid Off</span>
                            <span>100%</span>
                          </div>
                          <ProgressBar value={parseFloat(liveProjectedPercent)} variant="gold" />
                        </div>
                      </div>
                    </div>

                    {/* Payment Channel & Details Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Payment Channel *
                        </label>
                        <select
                          value={paymentChannel}
                          onChange={(e) => setPaymentChannel(e.target.value)}
                          className="w-full bg-bg-base border border-border-main text-text-main p-2.5 rounded-xl focus:outline-none font-semibold"
                        >
                          <option value="bank_transfer">Direct Bank Transfer</option>
                          <option value="pos_terminal">Mobile POS Agent</option>
                          <option value="cash_deposit">Bank Cash Teller Deposit</option>
                          <option value="online_transfer">Online Corporate Gateway</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Reference / Slip / Teller No *
                        </label>
                        <input
                          type="text"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full bg-bg-base border border-border-main text-text-main p-2.5 rounded-xl font-mono font-bold focus:outline-none"
                          placeholder="e.g. TRX-982104"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Payment Remittance Date
                        </label>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full bg-bg-base border border-border-main text-text-main p-2.5 rounded-xl font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Remarks / Deposit Notes
                        </label>
                        <input
                          type="text"
                          value={paymentRemarks}
                          onChange={(e) => setPaymentRemarks(e.target.value)}
                          className="w-full bg-bg-base border border-border-main text-text-main p-2.5 rounded-xl focus:outline-none"
                          placeholder="Optional notes..."
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border-main/40 pt-3">
                      <Button variant="ghost" type="button" onClick={() => setPayNowStep(2)} className="text-xs">
                        ← Back to Installments
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmittingPayment}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg"
                      >
                        {isSubmittingPayment ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Submitting Remittance...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            Confirm & Submit Payment Remittance 💳
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

// Helper Icon component
const LayersIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);
