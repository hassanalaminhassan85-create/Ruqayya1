/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Alert, ProgressBar } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { Vehicle, Driver, DailyRemittance, FuelVoucher, Dictionary, Language } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bike, 
  MapPin, 
  ClipboardList, 
  Fuel, 
  CheckCircle, 
  Clock, 
  Navigation, 
  Compass, 
  ShieldAlert, 
  User, 
  CreditCard, 
  History, 
  FileText, 
  Settings, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Printer, 
  Calendar, 
  TrendingUp, 
  Check, 
  Info, 
  DollarSign, 
  Layers,
  ArrowRight
} from 'lucide-react';

interface DriverDashboardProps {
  driverName: string;
  lang: Language;
  dictionary: Dictionary;
  activeTab?: TabType;
  setActiveTab?: (tab: TabType) => void;
}

type TabType = 'overview' | 'payments' | 'history' | 'vehicle' | 'documents' | 'profile';

// Complete English & Hausa translations for Driver Dashboard specifically
const localDict = {
  en: {
    tabs: {
      overview: "Overview",
      payments: "Installments & Billing",
      history: "Payment History",
      vehicle: "My Rig",
      documents: "Company Docs",
      profile: "My Profile"
    },
    restBanner: {
      title: "REST MODE ACTIVE",
      reason: "Reason",
      start: "Start Date",
      end: "End Date",
      days: "Remaining Days",
      explanation: "Your 5-day installment schedule is officially PAUSED. No payments are accrued during this approved recuperation interval."
    },
    welcome: {
      certified: "Certified {class} Operator",
      driverId: "Driver ID",
      rating: "Operator Rating",
      license: "License",
      licenseExp: "Expiry",
      status: "Duty Status"
    },
    metrics: {
      agreedAmount: "Agreed 30-Day Rate",
      outstanding: "Outstanding Installments",
      totalPaid: "Total Paid",
      vehicleBalance: "Vehicle Remaining Balance",
      nextDue: "Next Payment Due",
      payoutProgress: "Amortization Progress"
    },
    installments: {
      title: "30-Day Installment Calendar",
      desc: "Amortized schedule split into 6 recurring 5-day payment intervals.",
      cardTitle: "Installment {num}",
      days: "Days {start}-{end}",
      paid: "Paid",
      due: "Due",
      remaining: "Remaining Balance",
      completed: "Completed",
      pending: "Pending",
      pendingApproval: "Pending Admin Approval",
      overdue: "Overdue",
      drawerTitle: "Installment Details",
      dueDate: "Payment Due Date",
      receiptNo: "Receipt Number",
      receivedBy: "Received & Approved By",
      datePaid: "Date Paid"
    },
    history: {
      title: "Receipt Ledger",
      desc: "Chronological ledger audits of approved installment collections.",
      searchPlaceholder: "Search by receipt or remarks...",
      statusAll: "All Statuses",
      statusApproved: "Approved",
      statusPending: "Pending",
      statusRejected: "Rejected",
      receiptNo: "Receipt No",
      amount: "Amount",
      date: "Date & Time",
      approvedBy: "Approved By",
      status: "Status",
      action: "Actions",
      noRecords: "No historical receipts found.",
      printTitle: "OFFICIAL TRANSACTION RECEIPT",
      downloadPdf: "Download PDF",
      print: "Print Receipt",
      paymentVoucher: "PAYMENT VOUCHER"
    },
    vehicle: {
      title: "Tricycle Lease Asset Specifications",
      desc: "Corporate assigned rental tricycle details.",
      odometer: "Odometer Reading",
      tonnage: "Tonnage Capacity",
      service: "Last Service Date",
      fuel: "Fuel Class",
      rigImages: "Asset Visual Registry"
    },
    docs: {
      title: "Corporate Legal Document Vault",
      desc: "Read-only access to regulatory compliance permits and asset titles.",
      regCert: "Registration Certificate",
      insurance: "Insurance Policy",
      roadWorthiness: "Road Worthiness Permit",
      ownership: "Proof of Ownership",
      inspection: "Annual Safety Inspection",
      preview: "Preview Document",
      download: "Download Permit",
      closePreview: "Close Preview"
    },
    profile: {
      title: "Operator Account Controls",
      desc: "Modify self-profile credentials. Financial records and vehicle mapping are read-only.",
      phone: "Phone Number",
      email: "Email Address",
      address: "Residential Address",
      password: "New Password (leave blank to keep current)",
      save: "Update Profile Credentials",
      readOnlyAlert: "Notice: Driver ID, vehicle associations, and credit history are locked. Contact administrative desk for revisions.",
      success: "Operator profile updated successfully.",
      error: "Failed to update profile details."
    }
  },
  ha: {
    tabs: {
      overview: "Bayanai",
      payments: "Rabon Kudade (Installments)",
      history: "Rikodin Biya",
      vehicle: "Motata",
      documents: "Takardun Kamfani",
      profile: "Bayanai na"
    },
    restBanner: {
      title: "HUTUN DIREBA (REST MODE ACTIVE)",
      reason: "Dalili",
      start: "Ranar Farawa",
      end: "Ranar Karewa",
      days: "Kwanaki da Suka Rage",
      explanation: "An tsayar da lissafin kuɗin biyan ku na kwanaki 5 na ɗan lokaci. Babu tara ko biyan kuɗi a lokacin wannan hutun."
    },
    welcome: {
      certified: "Gwarzon Direba ({class})",
      driverId: "Lambar Direba",
      rating: "Makin Aiki",
      license: "Lasisin Tuƙi",
      licenseExp: "Karewa",
      status: "Yanayin Aiki"
    },
    metrics: {
      agreedAmount: "Kuɗin Yarjejeniya (Kwanaki 30)",
      outstanding: "Kuɗin da Ke Kansa",
      totalPaid: "Jimillar Kuɗin da Aka Biya",
      vehicleBalance: "Sauran Kuɗin Mota",
      nextDue: "Biyan Na Gaba",
      payoutProgress: "Ci Gaban Biyan Kuɗi"
    },
    installments: {
      title: "Tsarin Biyan Kudade Na Kwanaki 30",
      desc: "An raba kuɗin yarjejeniyar zuwa kashi 6 na kowace kwana 5.",
      cardTitle: "Biyan Kashi {num}",
      days: "Kwana {start}-{end}",
      paid: "An Biya",
      due: "Ya Kamata",
      remaining: "Sauran Kuɗi",
      completed: "An Kammala",
      pending: "Yana Jira",
      pendingApproval: "Yana Jiran Amincewar Admin",
      overdue: "Ya Wuce Lokaci",
      drawerTitle: "Cikakken Bayanin Biyan Kudi",
      dueDate: "Ranar Biyan Kudi",
      receiptNo: "Lambar Rasit",
      receivedBy: "Wanda Ya Karɓa Ya Amince",
      datePaid: "Ranar da Aka Biya"
    },
    history: {
      title: "Rikodin Rasit na Kudade",
      desc: "Tattaunawa da lissafin duk kuɗaɗen da aka biya kamfani.",
      searchPlaceholder: "Nemo ta rasit ko bayani...",
      statusAll: "Duk Yanayi",
      statusApproved: "An Amince",
      statusPending: "Yana Jira",
      statusRejected: "An Ki Amincewa",
      receiptNo: "Rasit No",
      amount: "Kuɗi",
      date: "Rana & Lokaci",
      approvedBy: "Wanda Ya Amince",
      status: "Yadda Yake",
      action: "Ayyuka",
      noRecords: "Babu wani tarihin biyan kuɗi da aka samu.",
      printTitle: "RASIT NA BIYAN KUDI NA SAMU",
      downloadPdf: "Zazzage PDF",
      print: "Buga Rasit",
      paymentVoucher: "TAKARDAR BIYA (VOUCHER)"
    },
    vehicle: {
      title: "Bayanan Motar Sufuri",
      desc: "Cikakken bayanin motar da kamfani ya sanya maka.",
      odometer: "Nisan Tafiya",
      tonnage: "Nauyin Kaya da Ke Dauka",
      service: "Ranar Gyara na Gaba",
      fuel: "Irin Mai",
      rigImages: "Hotunan Motar"
    },
    docs: {
      title: "Taskar Takardun Kamfani",
      desc: "Karanta takardun izini na gwamnati da na mallakar mota.",
      regCert: "Takardar Rijistar Mota",
      insurance: "Takardar Inshora",
      roadWorthiness: "Takardar Kula da Lafiyar Mota",
      ownership: "Takardar Shaidar Mallaka",
      inspection: "Dubawar Tsaro na Shekara",
      preview: "Duba Takarda",
      download: "Zazzage Takarda",
      closePreview: "Rufe Dubawa"
    },
    profile: {
      title: "Kula da Akun na Direba",
      desc: "Sauya lambar waya, imel, adireshi, ko kalmar sirri.",
      phone: "Lambar Waya",
      email: "Adireshin Imel",
      address: "Adireshin Gida",
      password: "Sabuwar Kalmar Sirri (ka bar shi a sake don kada ka sauya)",
      save: "Sabunta Bayanai",
      readOnlyAlert: "Sanarwa: Lambar Direba, motar da aka ba ka, da tarihin kudi duka a rufe suke. Tuntuɓi Admin don gyara.",
      success: "An yi nasarar sabunta bayanan direba.",
      error: "An kasa sabunta bayanan direba."
    }
  }
};

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ driverName, lang, dictionary, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) => {
  const [localActiveTab, setLocalActiveTab] = useState<TabType>('overview');
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;
  const [driver, setDriver] = useState<any | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activeTrip, setActiveTrip] = useState<DailyRemittance | null>(null);
  const [vouchers, setVouchers] = useState<FuelVoucher[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<any[]>([]);

  // Profile update form state
  const [profileForm, setProfileForm] = useState({
    phone: '',
    email: '',
    address: '',
    password: ''
  });
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Fuel Request state
  const [liters, setLiters] = useState(250);
  const [fuelError, setFuelError] = useState('');
  const [fuelSuccess, setFuelSuccess] = useState(false);
  const DIESEL_RATE = 1450; // Nigerian Diesel rate in Naira per Liter

  // Inspection Checklist state
  const [checklist, setChecklist] = useState({
    brakes: false,
    steering: false,
    headlights: false,
    tires: false,
    fluids: false
  });
  const [inspectSuccess, setInspectSuccess] = useState(false);

  // History search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected payment installment for details drawer
  const [selectedInstallment, setSelectedInstallment] = useState<any | null>(null);

  // Selected receipt for PDF printable receipt viewer
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // Driver installment payment submission states
  const [payReceiptNo, setPayReceiptNo] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payRemarks, setPayRemarks] = useState('');
  const [payFileBase64, setPayFileBase64] = useState('');
  const [payFileName, setPayFileName] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSubmitError, setPaymentSubmitError] = useState('');
  const [paymentSubmitSuccess, setPaymentSubmitSuccess] = useState('');

  // Selected document preview url
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  const t = localDict[lang];

  const syncDriverData = async (dataPayload?: any) => {
    try {
      let me;
      let tripsList;
      let vouchersList;
      let paymentsList;

      if (dataPayload) {
        // SSE Hydration
        const dbUsers = dataPayload.users || [];
        const dbDrivers = dataPayload.drivers || [];
        const dbVehicles = dataPayload.vehicles || [];
        const dbVouchers = dataPayload.vouchers || [];
        const dbTrips = dataPayload.trip_manifests || [];
        const dbPayments = dataPayload.driver_payments || [];

        // Find active logged-in user
        const token = api.getToken();
        const activeUser = dbUsers.find((u: any) => 
          (driver?.email && u.email && u.email.toLowerCase() === driver.email.toLowerCase()) || 
          (u.full_name && u.full_name === driverName)
        );
        if (!activeUser) return;

        const profile = dbDrivers.find((d: any) => d.user_id === activeUser.id);
        if (!profile) return;

        me = {
          user: {
            id: activeUser.id,
            fullName: activeUser.full_name,
            email: activeUser.email,
            phone: activeUser.phone,
            role: 'driver',
            profile: {
              ...profile,
              vehicle: dbVehicles.find((v: any) => v.driver_id === profile.id) || null
            }
          }
        };

        tripsList = dbTrips;
        vouchersList = dbVouchers;
        paymentsList = dbPayments;
        const dbCycles = dataPayload.cycles || [];
        setCycles(dbCycles);
      } else {
        // HTTP Hydration
        me = await api.getMe();
        tripsList = await api.getTrips();
        vouchersList = await api.getVouchers();
        paymentsList = await api.request('/api/payments');
        const dbCyclesRes = await api.request('/api/director/cycles').catch(() => null);
        if (dbCyclesRes && dbCyclesRes.cycles) {
          setCycles(dbCyclesRes.cycles);
        }
      }

      if (me && me.user && me.user.role === 'driver') {
        const profile = me.user.profile;
        if (!profile) return;

        const updatedDriver = {
          id: profile.id,
          userId: me.user.id,
          fullName: me.user.fullName,
          email: me.user.email,
          phone: me.user.phone,
          status: profile.status || 'available',
          classification: profile.classification || 'Assisted',
          licenseNumber: profile.license_number || 'KND-9828A',
          licenseExpiry: profile.license_expiry || '2028-10-12',
          nin: profile.nin || '',
          rating: profile.rating || 5.0,
          agreedAmount: profile.agreed_amount || (profile.classification === 'Smart' ? 1200000 : 1800000),
          remainingVehicleBalance: profile.remaining_vehicle_balance !== undefined ? profile.remaining_vehicle_balance : 24000000,
          address: profile.address || 'No 24 Airport Road, Kano',
          restStartDate: profile.rest_start_date || '2026-06-15',
          restEndDate: profile.rest_end_date || '2026-06-25',
          restReason: profile.rest_reason || 'Fatigue rehabilitation',
          restHistory: profile.restHistory || []
        };

        setDriver(updatedDriver);

        // Map initial profile inputs
        if (!loading && profileForm.email === '') {
          setProfileForm({
            phone: updatedDriver.phone,
            email: updatedDriver.email,
            address: updatedDriver.address,
            password: ''
          });
        }

        if (profile.vehicle) {
          setVehicle({
            id: profile.vehicle.id,
            plateNumber: profile.vehicle.plate_number,
            model: profile.vehicle.model,
            status: profile.vehicle.status,
            fuelType: profile.vehicle.fuel_type || 'diesel',
            capacity: profile.vehicle.capacity || '30 Tons',
            driverId: profile.id,
            lastServiceDate: profile.vehicle.last_service_date || new Date().toISOString().split('T')[0],
            mileage: profile.vehicle.mileage || 184000,
            registrationNumber: profile.vehicle.registration_number || 'RTL-TRK-708A',
            chassisNumber: profile.vehicle.chassis_number || 'WDB9630031L239841',
            engineNumber: profile.vehicle.engine_number || 'OM501LA-V/6-239401',
            purchasePrice: profile.vehicle.purchase_price || 35000000,
            remainingBalance: profile.vehicle.remaining_balance || 24000000
          });
        } else {
          setVehicle(null);
        }

        const trip = tripsList.find((t: any) => t.driverId === profile.id && t.status !== 'delivered');
        setActiveTrip(trip || null);

        const myVouchers = vouchersList.filter((v: any) => v.driverId === profile.id);
        setVouchers(myVouchers.map((v: any) => ({
          id: v.id,
          voucherNumber: v.voucherNumber,
          vehicleId: v.vehicleId,
          driverId: v.driverId,
          litersRequested: v.litersRequested,
          estimatedCost: v.estimatedCost,
          status: v.status,
          requestDate: v.requestDate
        })));

        const myPayments = paymentsList.filter((p: any) => p.driver_id === profile.id);
        setPayments(myPayments);
      }
    } catch (e) {
      console.error("Failed to hydrate Driver Dashboard from backend services:", e);
    } finally {
      setLoading(false);
    }
  };

  // Real-time updates via Server Sent Events (SSE)
  useEffect(() => {
    syncDriverData();

    // HANDSHAKE DIRECTLY WITH SECURE ENDPOINT
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
            syncDriverData(data);
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection interrupted. Fallback to active interval polling.");
      };
    } catch (e) {
      console.warn("EventSource creation blocked or unsupported in this sandboxed context:", e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [driverName]);

  const handleDriverPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSubmitError('');
    setPaymentSubmitSuccess('');

    if (!payReceiptNo) {
      setPaymentSubmitError(lang === 'en' ? "Please provide a receipt/reference number." : "Da fatan za a samar da lambar rasit.");
      return;
    }

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentSubmitError(lang === 'en' ? "Please specify a valid payment amount." : "Da fatan za a shigar da adadin kuɗi mai kyau.");
      return;
    }

    try {
      setSubmittingPayment(true);
      const token = localStorage.getItem('ruqayya_token') || '';
      let remoteReceiptUrl = '';

      // If driver uploaded a file receipt, push to secure DMS simulation first
      if (payFileBase64) {
        const uploadRes = await fetch('/api/documents/upload-company', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: `driver_payment_${Date.now()}_${payFileName.replace(/\s+/g, '_')}`,
            docType: 'general',
            fileBase64: payFileBase64
          })
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          remoteReceiptUrl = uploadData.fileUrl;
        }
      }

      // Submit actual installment payment
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amt,
          installmentNumber: selectedInstallment.installmentNumber,
          outstandingAmount: selectedInstallment.amount - amt,
          receiptNumber: payReceiptNo,
          paymentMethod: payMethod,
          remarks: payRemarks + (remoteReceiptUrl ? ` [Receipt: ${remoteReceiptUrl}]` : '')
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit payment receipt');

      setPaymentSubmitSuccess(lang === 'en' ? "Payment receipt successfully submitted for Admin verification!" : "An riga an aika da rasit ga jami'an kula!");
      
      // Clear inputs
      setPayReceiptNo('');
      setPayAmount('');
      setPayRemarks('');
      setPayFileBase64('');
      setPayFileName('');

      setTimeout(() => {
        setSelectedInstallment(null);
        setPaymentSubmitSuccess('');
        syncDriverData();
      }, 1500);

    } catch (err: any) {
      setPaymentSubmitError(err.message || 'Submission error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleTripComplete = async () => {
    if (!activeTrip) return;
    try {
      await api.completeTrip(activeTrip.id);
      syncDriverData();
    } catch (err: any) {
      console.error("Failed to mark daily remittance collection complete:", err);
    }
  };

  const handleFuelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFuelError('');
    setFuelSuccess(false);

    if (liters < 50 || liters > 1000) {
      setFuelError(lang === 'en' ? "Please request between 50 and 1000 liters." : "Da fatan za a nemi lita tsakanin 50 zuwa 1000.");
      return;
    }

    if (!driver || !vehicle) {
      setFuelError(lang === 'en' ? "No assigned vehicle profile found." : "Ba a sami lambar motar ka ba.");
      return;
    }

    try {
      const estimatedCost = liters * DIESEL_RATE;
      await api.requestVoucher({
        vehicleId: vehicle.id,
        litersRequested: liters,
        estimatedCost
      });
      setFuelSuccess(true);
      setLiters(250);
      syncDriverData();
    } catch (err: any) {
      setFuelError(err.message || "Failed to submit fuel request.");
    }
  };

  const handleInspectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allChecked = Object.values(checklist).every(v => v === true);
    if (!allChecked) {
      setInspectSuccess(false);
      alert(lang === 'en' ? "All inspection parameters must be physically verified." : "Dole ne a duba dukkan abubuwan da ake duba motar.");
      return;
    }

    if (driver && vehicle) {
      setInspectSuccess(true);
      setChecklist({ brakes: false, steering: false, headlights: false, tires: false, fluids: false });
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');

    try {
      const payload: any = {
        phone: profileForm.phone,
        email: profileForm.email,
        address: profileForm.address
      };
      if (profileForm.password) {
        payload.password = profileForm.password;
      }

      await api.updateSelfDriverProfile(payload);
      setProfileSuccess(t.profile.success);
      setProfileForm(p => ({ ...p, password: '' }));
      syncDriverData();
    } catch (err: any) {
      setProfileError(err.message || t.profile.error);
    }
  };

  if (loading || !driver) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-10 w-10 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-text-muted font-mono font-bold uppercase tracking-wider">
          {lang === 'en' ? "Initializing Encrypted Operator Terminal..." : "Ana Bude Tashar Direba Ta Musamman..."}
        </p>
      </div>
    );
  }

  // INSTALLMENT BILLING MATHS
  const activeCycle = cycles.find(c => c.status === 'active') || cycles[0];
  const agreedAmount = driver.agreedAmount || 180000;
  const installmentCost = Math.round(agreedAmount / 6); // Split into 6 intervals
  const approvedPayments = payments.filter(p => p.status === 'approved');
  const totalPaid = approvedPayments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAgreedBalance = Math.max(0, agreedAmount - totalPaid);
  const amortizationProgress = agreedAmount > 0 ? (totalPaid / agreedAmount) * 100 : 0;

  // Calculate total rest days during this active cycle to extend installments
  let totalRestDays = 0;
  const restHistory = driver.restHistory || [];
  let cycleStartDate = activeCycle ? new Date(activeCycle.startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  
  if (activeCycle) {
    restHistory.forEach((rest: any) => {
      const restStart = new Date(rest.startDate);
      const restEnd = new Date(rest.endDate);
      const cycleStart = new Date(activeCycle.startDate);
      
      // If rest period overlaps with cycle
      if (restEnd >= cycleStart) {
        const overlapStart = restStart < cycleStart ? cycleStart : restStart;
        const overlapEnd = restEnd;
        const diffTime = overlapEnd.getTime() - overlapStart.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (days > 0) {
          totalRestDays += days;
        }
      }
    });
  }

  // Check if driver is currently on rest
  const today = new Date('2026-07-07'); // system-wide operational timestamp
  const isCurrentlyOnRest = driver.status === 'off-duty' || driver.status === 'rest' || restHistory.some((rest: any) => {
    const start = new Date(rest.startDate);
    const end = new Date(rest.endDate);
    return today >= start && today <= end;
  });

  // Compute 6 dynamic installments with carrying-forward outstanding balance
  let carryForward = 0;
  const installmentCards = Array.from({ length: 6 }).map((_, idx) => {
    const installmentNumber = idx + 1;
    const startDay = idx * 5 + 1;
    const endDay = (idx + 1) * 5;

    // Shift dates by rest days
    const normalEndDate = new Date(cycleStartDate.getTime() + (endDay - 1) * 24 * 3600 * 1000);
    const extendedEndDate = new Date(normalEndDate.getTime() + totalRestDays * 24 * 3600 * 1000);
    
    const normalStartDate = new Date(cycleStartDate.getTime() + (startDay - 1) * 24 * 3600 * 1000);
    const extendedStartDate = new Date(normalStartDate.getTime() + totalRestDays * 24 * 3600 * 1000);

    const dueAmount = installmentCost + carryForward;
    
    // Find matching payments for this installment
    const matchingPayments = payments.filter(p => p.installment_number === installmentNumber);
    const paidAmount = matchingPayments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.amount, 0);

    const hasPendingApproval = matchingPayments.some(p => p.status === 'pending');

    const remaining = dueAmount - paidAmount;
    carryForward = remaining; // outstanding balance carries forward to the next installment

    let status: 'Completed' | 'Pending Approval' | 'Pending' | 'Overdue' = 'Pending';
    if (remaining <= 0) {
      status = 'Completed';
    } else if (hasPendingApproval) {
      status = 'Pending Approval';
    } else if (paidAmount > 0) {
      status = 'Pending'; // wait, it's partially paid, but still has outstanding, so marked Pending until fully paid or overdue
    } else if (!isCurrentlyOnRest && today > extendedEndDate) {
      status = 'Overdue';
    }

    return {
      installmentNumber,
      startDay,
      endDay,
      startDate: extendedStartDate.toISOString().split('T')[0],
      endDate: extendedEndDate.toISOString().split('T')[0],
      amount: installmentCost,
      carriedForward: dueAmount - installmentCost,
      totalDue: dueAmount,
      totalPaid: paidAmount,
      remainingBalance: remaining,
      status,
      paymentDetails: matchingPayments[0] || null
    };
  });

  // Calculate outstanding count
  const outstandingCount = installmentCards.filter(i => i.status === 'Overdue').length;

  // Filter history logs
  const filteredPayments = payments.filter(p => {
    const matchSearch = String(p.receipt_number || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (p.remarks && String(p.remarks || '').toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Is Rest Mode Active?
  const isRestActive = driver.status === 'rest' || driver.status === 'off-duty';
  const restStartDateObj = new Date(driver.restStartDate);
  const restEndDateObj = new Date(driver.restEndDate);
  const remainingRestDays = Math.max(0, Math.ceil((restEndDateObj.getTime() - today.getTime()) / (1000 * 3600 * 24)));

  return (
    <div className="flex flex-col gap-6 w-full flex-1 max-w-7xl mx-auto p-4 md:p-6 bg-bg-base">
      
      {/* Rest Mode Banner */}
      {isRestActive && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-orange-500 bg-orange-500/10 p-5 rounded-xl flex flex-col md:flex-row items-start gap-4 shadow-sm"
        >
          <div className="p-3 bg-orange-500 rounded-lg text-white">
            <ShieldAlert className="h-6 w-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-orange-600 dark:text-orange-400 uppercase">{t.restBanner.title}</span>
              <Badge variant="orange">{(driver.status || '').toUpperCase()}</Badge>
            </div>
            <p className="text-xs text-text-main font-bold mt-1.5">{t.restBanner.explanation}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-[11px] font-mono border-t border-orange-500/10 pt-3">
              <div>
                <span className="text-text-muted block">{t.restBanner.reason}:</span>
                <span className="font-extrabold text-orange-700 dark:text-orange-300">{driver.restReason}</span>
              </div>
              <div>
                <span className="text-text-muted block">{t.restBanner.start}:</span>
                <span className="font-extrabold text-text-main">{driver.restStartDate}</span>
              </div>
              <div>
                <span className="text-text-muted block">{t.restBanner.end}:</span>
                <span className="font-extrabold text-text-main">{driver.restEndDate}</span>
              </div>
              <div>
                <span className="text-text-muted block">{t.restBanner.days}:</span>
                <span className="font-black text-orange-600 dark:text-orange-400 text-sm">{remainingRestDays} Days</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Corporate Operator Profile Header Welcome Card */}
      <div className="bg-bg-surface border border-border-main p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-linear-to-r from-transparent to-brand-gold/[0.02] pointer-events-none"></div>
        <div className="flex items-center gap-4.5 z-10">
          {/* Driver Passport Photo */}
          <div className="relative group">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-xl bg-slate-900 border-2 border-brand-gold overflow-hidden flex items-center justify-center">
              <User className="h-10 w-10 text-brand-gold/60" />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 h-6 w-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          </div>

          <div>
            <span className="text-[14px] font-semibold tracking-wider text-brand-gold uppercase">
              {t.welcome.certified.replace('{class}', driver.classification)}
            </span>
            <h2 className="text-[28px] md:text-[30px] lg:text-[36px] font-bold text-text-main tracking-tight mt-1">{driver.fullName}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[14px] font-medium text-text-muted">
              <span><strong>{t.welcome.driverId}:</strong> {driver.id.substring(0, 8).toUpperCase()}</span>
              <span>•</span>
              <span><strong>{t.welcome.license}:</strong> {driver.licenseNumber} ({t.welcome.licenseExp}: {driver.licenseExpiry})</span>
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col items-end gap-3.5 w-full md:w-auto border-t md:border-t-0 border-border-main/50 pt-4 md:pt-0 z-10 justify-between">
          <div className="text-right">
            <span className="text-[14px] font-semibold text-text-muted block uppercase mb-1">{t.welcome.rating}</span>
            <span className="text-[16px] font-semibold text-text-main tabular-nums">⭐ {driver.rating} / 5.0</span>
          </div>
          <div className="text-right">
            <span className="text-[14px] font-semibold text-text-muted block uppercase mb-1">{t.welcome.status}</span>
            <Badge variant={driver.status === 'on-trip' ? 'warning' : driver.status === 'rest' ? 'orange' : 'success'}>
              {(driver.status || '').toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Horizontal Premium Sub-Tab Navigation Bar */}
      <div className="flex border-b border-border-main overflow-x-auto gap-1 scrollbar-none bg-bg-surface p-1.5 rounded-xl border">
        {(Object.keys(t.tabs) as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap relative ${
                isActive 
                  ? 'bg-slate-900 text-white dark:bg-brand-gold dark:text-slate-950 shadow-sm' 
                  : 'text-text-muted hover:text-text-main hover:bg-bg-base/50'
              }`}
            >
              {tab === 'overview' && <Compass className="h-4 w-4" />}
              {tab === 'payments' && <CreditCard className="h-4 w-4" />}
              {tab === 'history' && <History className="h-4 w-4" />}
              {tab === 'vehicle' && <Bike className="h-4 w-4" />}
              {tab === 'documents' && <FileText className="h-4 w-4" />}
              {tab === 'profile' && <Settings className="h-4 w-4" />}
              <span>{t.tabs[tab]}</span>
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold rounded-full hidden"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Views with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-6 w-full"
        >
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* Active Dispatched Trip manifest */}
                <Card className="border-brand-gold bg-brand-gold/[0.01]">
                  <CardHeader className="border-brand-gold/10">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-brand-gold animate-pulse" />
                      <CardTitle>{lang === 'en' ? "Active Daily Remittance" : "Asusun Remittance Na Yanzu"}</CardTitle>
                    </div>
                    {activeTrip && <Badge variant="gold">{activeTrip.remittanceNumber}</Badge>}
                  </CardHeader>

                  {activeTrip ? (
                    <div className="flex flex-col gap-5 p-4 md:p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border-main/50 pb-4">
                        <div>
                          <span className="text-[10px] font-bold text-text-muted uppercase block">{lang === 'en' ? "Origin Departure" : "Tashi Daga"}</span>
                          <span className="text-xs font-extrabold text-text-main mt-1 block flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-blue-500" />
                            {activeTrip.origin}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-text-muted uppercase block">{lang === 'en' ? "Remittance Station" : "Biya Zuwa"}</span>
                          <span className="text-xs font-extrabold text-text-main mt-1 block flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-brand-gold" />
                            {activeTrip.destination}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-text-muted uppercase block">{lang === 'en' ? "Remittance Cycles" : "Nauyin Remittance"}</span>
                          <span className="text-xs font-extrabold text-text-main mt-1 block">
                            {activeTrip.remittanceCount} Cycles ({activeTrip.tricycleType})
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-xs text-text-muted flex flex-col gap-1 font-mono">
                          <p><strong>Departure Time:</strong> {activeTrip.departureTime}</p>
                          <p><strong>ETA Expectation:</strong> {activeTrip.expectedArrivalTime}</p>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={handleTripComplete}
                            className="font-bold flex items-center gap-1 w-full md:w-auto cursor-pointer"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {lang === 'en' ? "Log Remittance Complete" : "Kammala Remittance"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                      <Compass className="h-8 w-8 text-text-muted/40 animate-spin-slow" />
                      <p className="text-xs text-text-muted font-bold">
                        {lang === 'en' ? "No active daily remittances assigned." : "Babu remittance a halin yanzu."}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {lang === 'en' ? "Awaiting next daily collection lease assignment from Operations Admin." : "Kamfani zai turo muku bayanan remittance nan ba da jimawa ba."}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Billing Summary Overview Panel */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-500" />
                      <CardTitle>{t.tabs.payments}</CardTitle>
                    </div>
                  </CardHeader>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 md:p-6 border-b border-border-main/50">
                    <div className="bg-bg-base p-4 rounded-xl border border-border-main/50">
                      <span className="text-[10px] text-text-muted font-bold block uppercase">{t.metrics.agreedAmount}</span>
                      <p className="text-xl font-extrabold text-text-main font-mono mt-1">₦{agreedAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-bg-base p-4 rounded-xl border border-border-main/50">
                      <span className="text-[10px] text-text-muted font-bold block uppercase">{t.metrics.totalPaid}</span>
                      <p className="text-xl font-extrabold text-emerald-600 font-mono mt-1">₦{totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="bg-bg-base p-4 rounded-xl border border-border-main/50">
                      <span className="text-[10px] text-text-muted font-bold block uppercase">{lang === 'en' ? "Outstanding Cycle Balance" : "Sauran Kudin Biyan Kwanaki 30"}</span>
                      <p className="text-xl font-extrabold text-brand-danger font-mono mt-1">₦{remainingAgreedBalance.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="p-4 md:p-6 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-text-muted">{t.metrics.payoutProgress}</span>
                      <span className="font-extrabold text-emerald-600 font-mono">{amortizationProgress.toFixed(1)}%</span>
                    </div>
                    <ProgressBar percentage={amortizationProgress} variant="success" />
                  </div>
                </Card>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Fuel Voucher Request card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-brand-gold animate-bounce" />
                      <CardTitle>{lang === 'en' ? "Raise Fuel Voucher" : "Nemi Rasit Din Mai"}</CardTitle>
                    </div>
                  </CardHeader>

                  <form onSubmit={handleFuelRequest} className="flex flex-col gap-4">
                    {fuelError && <Alert type="danger">{fuelError}</Alert>}
                    {fuelSuccess && <Alert type="success">{lang === 'en' ? "Fuel request successfully submitted to supervisor review." : "An tura buƙatarka ta mai don amincewa."}</Alert>}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-main">
                        {lang === 'en' ? "Requested Tonnage Liters (L)" : "Lita Na Mai Da Kake Nema (L)"}
                      </label>
                      <input
                        type="number"
                        value={liters}
                        onChange={(e) => setLiters(parseInt(e.target.value) || 0)}
                        placeholder="e.g. 350"
                        className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>

                    <div className="p-3 bg-bg-base rounded-lg border border-border-main/50 text-xs flex flex-col gap-1 font-mono">
                      <div className="flex justify-between">
                        <span className="text-text-muted">{lang === 'en' ? "Diesel Base Rate:" : "Farashin Lita Daya:"}</span>
                        <span className="font-bold">₦{DIESEL_RATE}/Liter</span>
                      </div>
                      <div className="flex justify-between border-t border-border-main/40 pt-1.5 mt-1 font-bold">
                        <span className="text-text-main">{lang === 'en' ? "Estimated Ledger Value:" : "Kimanin Kudin Mai:"}</span>
                        <span className="text-brand-gold">₦{(liters * DIESEL_RATE).toLocaleString()}</span>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      type="submit"
                      size="sm"
                      className="w-full font-bold cursor-pointer"
                      disabled={!vehicle}
                    >
                      {lang === 'en' ? "Authorize Request" : "Tura Bukatar Mai"}
                    </Button>
                  </form>
                </Card>

                {/* Pre-Trip Inspection Checklist */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                      <CardTitle>{lang === 'en' ? "Pre-Trip Rig Inspection" : "Duba Lafiyar Mota"}</CardTitle>
                    </div>
                  </CardHeader>

                  <form onSubmit={handleInspectionSubmit} className="flex flex-col gap-4 text-xs">
                    {inspectSuccess && <Alert type="success">{lang === 'en' ? "Safety inspection logs saved successfully." : "An yi nasarar ajiye rahoton lafiyar motar."}</Alert>}

                    <p className="text-[11px] text-text-muted leading-relaxed">
                      {lang === 'en' 
                        ? "Federal Safety regulations require daily walkaround inspection logs before dispatch corridors." 
                        : "Dokokin kiyaye hadarurruka sun bukaci ka duba motarka a kowace rana kafin ka fara tafiya."}
                    </p>

                    <div className="flex flex-col gap-2 pt-2">
                      {Object.keys(checklist).map((param) => (
                        <label key={param} className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-bg-base/45 rounded-lg">
                          <input
                            type="checkbox"
                            checked={(checklist as any)[param]}
                            onChange={(e) => setChecklist({ ...checklist, [param]: e.target.checked })}
                            className="h-4 w-4 rounded-sm border-gray-300 text-brand-gold focus:ring-brand-gold cursor-pointer"
                          />
                          <span className="capitalize">
                            {param === 'brakes' && (lang === 'en' ? "Air Brake systems holding correctly" : "Tsayar da mota (brakes) suna aiki lafiya")}
                            {param === 'steering' && (lang === 'en' ? "Hydraulic steering fluid & responsive turn" : "Tukurin mota (steering) ba shi da matsala")}
                            {param === 'headlights' && (lang === 'en' ? "Low & High beam lamps operational" : "Fitilun gaba da na baya suna aiki")}
                            {param === 'tires' && (lang === 'en' ? "Heavy payload tires inflated and checked" : "Tayoyin motar duka suna da iska kuma ba su fashe ba")}
                            {param === 'fluids' && (lang === 'en' ? "Radiator coolant & engine oil levels green" : "Ruwan sanyaya inji da man inji duka suna daidai")}
                          </span>
                        </label>
                      ))}
                    </div>

                    <Button
                      variant="primary"
                      type="submit"
                      size="sm"
                      className="w-full font-bold mt-2 cursor-pointer"
                      disabled={!vehicle}
                    >
                      {lang === 'en' ? "Submit Security Log" : "Ajiye Rahoton Dubawa"}
                    </Button>
                  </form>
                </Card>
              </div>
            </div>
          )}

          {/* INSTALLMENTS & BILLING TAB */}
          {activeTab === 'payments' && (
            <div className="flex flex-col gap-6">
              
              {/* Amortization Performance Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-bg-surface border border-border-main p-5 rounded-xl">
                  <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block mb-1">{t.metrics.agreedAmount}</span>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">₦{agreedAmount.toLocaleString()}</p>
                </div>
                <div className="bg-bg-surface border border-border-main p-5 rounded-xl">
                  <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block mb-1">{t.metrics.totalPaid}</span>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-emerald-600 tabular-nums leading-none mt-1">₦{totalPaid.toLocaleString()}</p>
                </div>
                <div className="bg-bg-surface border border-border-main p-5 rounded-xl">
                  <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block mb-1">{t.metrics.outstanding}</span>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-brand-danger tabular-nums leading-none mt-1">₦{remainingAgreedBalance.toLocaleString()}</p>
                  <span className="text-[14px] text-brand-danger font-medium mt-2 block">{outstandingCount} {lang === 'en' ? "Installments Overdue" : "Rabe-raben Biyan da Suka Rage"}</span>
                </div>
                <div className="bg-bg-surface border border-border-main p-5 rounded-xl">
                  <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block mb-1">{t.metrics.vehicleBalance}</span>
                  <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-blue-600 tabular-nums leading-none mt-1">₦{driver.remainingVehicleBalance.toLocaleString()}</p>
                </div>
              </div>

              {/* Installments cards layout */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t.installments.title}</CardTitle>
                    <CardDescription>{t.installments.desc}</CardDescription>
                  </div>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 md:p-6">
                  {installmentCards.map((card) => {
                    const statusColors = {
                      Completed: 'border-emerald-500 bg-emerald-500/[0.01]',
                      'Pending Approval': 'border-amber-500 bg-amber-500/[0.01]',
                      Pending: 'border-border-main bg-transparent',
                      Overdue: 'border-red-500 bg-red-500/[0.01]'
                    };

                    const badgeColors = {
                      Completed: 'success' as const,
                      'Pending Approval': 'warning' as const,
                      Pending: 'secondary' as const,
                      Overdue: 'danger' as const
                    };

                    return (
                      <motion.div
                        key={card.installmentNumber}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setSelectedInstallment(card)}
                        className={`border rounded-xl p-5 cursor-pointer flex flex-col justify-between min-h-[160px] shadow-2xs transition-all ${statusColors[card.status]}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-black text-text-main block">
                              {t.installments.cardTitle.replace('{num}', card.installmentNumber.toString())}
                            </span>
                            <span className="text-[11px] font-mono text-text-muted mt-0.5 block">
                              {t.installments.days.replace('{start}', card.startDay.toString()).replace('{end}', card.endDay.toString())}
                            </span>
                          </div>
                          <Badge variant={badgeColors[card.status]}>
                            {card.status === 'Completed' && t.installments.completed}
                            {card.status === 'Pending Approval' && t.installments.pendingApproval}
                            {card.status === 'Pending' && t.installments.pending}
                            {card.status === 'Overdue' && t.installments.overdue}
                          </Badge>
                        </div>

                        <div className="border-t border-border-main/50 pt-3 mt-4 flex justify-between items-end">
                          <div>
                            <span className="text-[10px] text-text-muted uppercase block">{t.installments.due}</span>
                            <span className="text-lg font-black text-text-main font-mono">₦{card.amount.toLocaleString()}</span>
                          </div>
                          <span className="text-xs font-bold text-brand-gold flex items-center gap-1">
                            {lang === 'en' ? "View details" : "Cikakken bayani"} <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>

              {/* Expandable Dialog / Drawer Overlay Container */}
              <AnimatePresence>
                {selectedInstallment && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-bg-surface border border-border-main rounded-2xl max-w-md w-full p-6 shadow-xl relative"
                    >
                      <button 
                        onClick={() => setSelectedInstallment(null)}
                        className="absolute right-4 top-4 text-text-muted hover:text-text-main p-1.5 hover:bg-bg-base rounded-full cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-3 border-b border-border-main pb-4 mb-4">
                        <div className="p-3 bg-brand-gold/10 rounded-xl text-brand-gold">
                          <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-text-main">
                            {t.installments.drawerTitle} (Installment {selectedInstallment.installmentNumber})
                          </h3>
                          <p className="text-xs text-text-muted font-mono">
                            {t.installments.days.replace('{start}', selectedInstallment.startDay.toString()).replace('{end}', selectedInstallment.endDay.toString())}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 text-xs">
                        <div className="flex justify-between py-2 border-b border-border-main/40">
                          <span className="text-text-muted font-bold">{lang === 'en' ? "Target Ledger Amount" : "Adadin Kudin Biyan"}:</span>
                          <span className="font-extrabold font-mono text-text-main">₦{selectedInstallment.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border-main/40">
                          <span className="text-text-muted font-bold">{t.installments.dueDate}:</span>
                          <span className="font-semibold font-mono text-text-main">
                            2026-07-{(selectedInstallment.installmentNumber * 5).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border-main/40">
                          <span className="text-text-muted font-bold">{lang === 'en' ? "Transaction Status" : "Matsayin Biyan Kudin"}:</span>
                          <Badge variant={
                            selectedInstallment.status === 'Completed' ? 'success' : 
                            selectedInstallment.status === 'Pending Approval' ? 'warning' : 
                            selectedInstallment.status === 'Pending' ? 'secondary' : 'danger'
                          }>
                            {selectedInstallment.status}
                          </Badge>
                        </div>

                        {selectedInstallment.paymentDetails ? (
                          <>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.paid}:</span>
                              <span className="font-extrabold font-mono text-emerald-600">₦{selectedInstallment.paymentDetails.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.receiptNo}:</span>
                              <span className="font-extrabold font-mono text-brand-gold">{selectedInstallment.paymentDetails.receipt_number}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.receivedBy}:</span>
                              <span className="font-semibold text-text-main">{selectedInstallment.paymentDetails.approved_by || 'Awaiting Review'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.datePaid}:</span>
                              <span className="font-semibold font-mono text-text-main">{selectedInstallment.paymentDetails.date}</span>
                            </div>
                            {selectedInstallment.paymentDetails.remarks && (
                              <div className="p-3 bg-bg-base border border-border-main/50 rounded-lg text-[11px] text-text-muted mt-2 font-mono">
                                <strong>Remarks:</strong> {selectedInstallment.paymentDetails.remarks}
                              </div>
                            )}

                            {selectedInstallment.status === 'Completed' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedReceipt(selectedInstallment.paymentDetails);
                                  setSelectedInstallment(null);
                                }}
                                className="w-full mt-4 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Printer className="h-4 w-4" />
                                {t.history.print}
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col gap-4 mt-2">
                            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-[11px] text-text-muted leading-relaxed text-center">
                              {lang === 'en' 
                                ? "No validated payments matching this installment have been verified by administrative auditors." 
                                : "Babu wani biyan kudi da aka samu na wannan rabon a halin yanzu."}
                            </div>

                            {/* Payment submission form */}
                            <form onSubmit={handleDriverPaymentSubmit} className="border-t border-border-main/50 pt-4 flex flex-col gap-3">
                              <span className="text-[11px] font-extrabold text-brand-gold uppercase tracking-wider block">
                                {lang === 'en' ? "SUBMIT PAYMENT RECEIPT" : "TURA RASIT NA BIYA"}
                              </span>

                              {paymentSubmitError && <Alert type="danger">{paymentSubmitError}</Alert>}
                              {paymentSubmitSuccess && <Alert type="success">{paymentSubmitSuccess}</Alert>}

                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-text-muted uppercase">
                                    {lang === 'en' ? "Paid Amount (₦)" : "Adadin Kudi (₦)"}
                                  </label>
                                  <input
                                    type="number"
                                    required
                                    value={payAmount || selectedInstallment.amount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder={selectedInstallment.amount.toString()}
                                    className="w-full p-2 bg-bg-base border border-border-main rounded text-xs focus:outline-none"
                                  />
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-text-muted uppercase">
                                    {lang === 'en' ? "Receipt/Ref No" : "Lambar Rasit/Ref"}
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={payReceiptNo}
                                    onChange={(e) => setPayReceiptNo(e.target.value)}
                                    placeholder="e.g. TR-9874521"
                                    className="w-full p-2 bg-bg-base border border-border-main rounded text-xs focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-text-muted uppercase">
                                  {lang === 'en' ? "Payment Method" : "Hanyar Biya"}
                                </label>
                                <select
                                  value={payMethod}
                                  onChange={(e) => setPayMethod(e.target.value)}
                                  className="w-full p-2 bg-bg-base border border-border-main rounded text-xs font-bold text-text-main focus:outline-none"
                                >
                                  <option value="bank_transfer">{lang === 'en' ? "Bank Transfer" : "Tura ta Banki"}</option>
                                  <option value="pos">{lang === 'en' ? "POS / Agent" : "POS / Wakili"}</option>
                                  <option value="cash">{lang === 'en' ? "Cash Deposit" : "Tsabar Kudi (Cash)"}</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-text-muted uppercase">
                                  {lang === 'en' ? "Remarks / Comments" : "Karin Bayani"}
                                </label>
                                <input
                                  type="text"
                                  value={payRemarks}
                                  onChange={(e) => setPayRemarks(e.target.value)}
                                  placeholder="e.g. Paid at Zenith Bank"
                                  className="w-full p-2 bg-bg-base border border-border-main rounded text-xs focus:outline-none"
                                />
                              </div>

                              {/* Upload Image receipt trigger */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-text-muted uppercase">
                                  {lang === 'en' ? "Attach Paper/Digital Receipt" : "Saka Hoton Rasit"}
                                </label>
                                <div className="border border-dashed border-border-main rounded p-2 text-center relative cursor-pointer hover:border-brand-gold bg-bg-base/30">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        setPayFileName(file.name);
                                        const r = new FileReader();
                                        r.onloadend = () => setPayFileBase64(r.result as string);
                                        r.readAsDataURL(file);
                                      }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                  <span className="text-[9px] font-bold text-text-main">
                                    {payFileName ? `Attached: ${payFileName}` : "Click to select JPG/PNG snapshot"}
                                  </span>
                                </div>
                              </div>

                              <Button
                                type="submit"
                                disabled={submittingPayment}
                                className="w-full mt-2 font-bold cursor-pointer text-slate-950 bg-brand-gold py-2"
                              >
                                {submittingPayment ? "Uploading..." : (lang === 'en' ? "Submit Installment Receipt" : "Tura Rasit din Biya")}
                              </Button>
                            </form>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* PAYMENT HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="flex flex-col gap-6">
              
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>{t.history.title}</CardTitle>
                      <CardDescription>{t.history.desc}</CardDescription>
                    </div>
                    
                    {/* Search & Filter tools */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t.history.searchPlaceholder}
                          className="pl-9 pr-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg w-56 text-text-main focus:outline-none"
                        />
                      </div>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                      >
                        <option value="all">{t.history.statusAll}</option>
                        <option value="approved">{t.history.statusApproved}</option>
                        <option value="pending">{t.history.statusPending}</option>
                        <option value="rejected">{t.history.statusRejected}</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                        <th className="p-3">{t.history.receiptNo}</th>
                        <th className="p-3">{lang === 'en' ? "Installment" : "Rabo"}</th>
                        <th className="p-3">{t.history.amount}</th>
                        <th className="p-3">{t.history.date}</th>
                        <th className="p-3">{t.history.approvedBy}</th>
                        <th className="p-3">{t.history.status}</th>
                        <th className="p-3 text-right">{t.history.action}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50 text-text-main">
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-text-muted">
                            {t.history.noRecords}
                          </td>
                        </tr>
                      ) : (
                        filteredPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-bg-base/20 font-mono">
                            <td className="p-3 font-bold text-brand-gold">{p.receipt_number}</td>
                            <td className="p-3 font-semibold text-text-main"># {p.installment_number}</td>
                            <td className="p-3 font-black text-text-main">₦{p.amount.toLocaleString()}</td>
                            <td className="p-3 text-[10px] text-text-muted">{p.date}</td>
                            <td className="p-3 text-text-main font-semibold">{p.approved_by || 'Awaiting Review'}</td>
                            <td className="p-3">
                              <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}>
                                {(p.status || '').toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              {p.status === 'approved' && (
                                <button
                                  onClick={() => setSelectedReceipt(p)}
                                  className="p-1.5 bg-bg-base hover:bg-slate-900 hover:text-white rounded-lg text-text-main transition-all cursor-pointer flex items-center justify-center gap-1 ml-auto"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Printable receipt Voucher overlay modal */}
              <AnimatePresence>
                {selectedReceipt && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white text-slate-900 border border-slate-300 rounded-xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative font-sans"
                    >
                      <button 
                        onClick={() => setSelectedReceipt(null)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-950 p-1.5 hover:bg-slate-100 rounded-full cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {/* Printable Area Wrapper */}
                      <div id="printable-invoice-voucher" className="flex flex-col gap-6">
                        
                        {/* Receipt Header */}
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                          <div>
                            <h2 className="text-lg font-black tracking-tight text-slate-950">RUQAYYA TRANSPORT LIMITED</h2>
                            <p className="text-[10px] text-slate-500 font-mono">No 14 Zaria Road, Kano, Nigeria</p>
                            <p className="text-[10px] text-slate-500 font-mono">info@ruqayyatransport.com | +234 803 123 4567</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black tracking-widest text-slate-950 bg-slate-100 px-2.5 py-1 rounded block uppercase">{t.history.paymentVoucher}</span>
                            <span className="text-[11px] font-mono text-slate-500 mt-1 block">ORIGINAL COPY</span>
                          </div>
                        </div>

                        {/* Invoice Metadata */}
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono border-b border-slate-200 pb-4">
                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{t.history.receiptNo}:</span>
                            <span className="font-extrabold text-slate-900 text-sm">{selectedReceipt.receipt_number}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{t.history.date}:</span>
                            <span className="font-extrabold text-slate-900">{selectedReceipt.date}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{lang === 'en' ? "Operator Name" : "Sunan Direba"}:</span>
                            <span className="font-extrabold text-slate-900">{driver.fullName}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block uppercase font-bold text-[9px]">{lang === 'en' ? "Installment Mapping" : "Taswirar Rabo"}:</span>
                            <span className="font-extrabold text-slate-900">Installment #{selectedReceipt.installment_number}</span>
                          </div>
                        </div>

                        {/* Transaction particulars table */}
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-900 text-slate-500 uppercase font-black text-[9px]">
                              <th className="py-2">Description / Particulars</th>
                              <th className="py-2 text-right">Amortized Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-900">
                            <tr>
                              <td className="py-3">
                                <span className="font-extrabold block">Assisted Transport Operator Lease Installment</span>
                                <span className="text-[10px] text-slate-500 block">30-Day billing agreement cycle installment #{selectedReceipt.installment_number}</span>
                              </td>
                              <td className="py-3 text-right font-bold font-mono">₦{selectedReceipt.amount.toLocaleString()}</td>
                            </tr>
                            <tr className="font-black border-t-2 border-slate-900 text-sm">
                              <td className="py-3 text-right">TOTAL RECEIVED</td>
                              <td className="py-3 text-right font-mono">₦{selectedReceipt.amount.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Signature approvals */}
                        <div className="grid grid-cols-2 gap-8 pt-8 text-[11px] font-mono border-t border-slate-100 mt-4">
                          <div>
                            <span className="text-slate-500 block uppercase text-[9px]">Audited & Approved By:</span>
                            <span className="font-bold text-slate-900 mt-2 block border-b border-slate-300 pb-1">{selectedReceipt.approved_by}</span>
                            <span className="text-[9px] text-slate-400">FINANCIAL COMPLIANCE OFFICER</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block uppercase text-[9px]">Secure Hash Reference:</span>
                            <span className="font-extrabold text-slate-900 text-[10px] block font-mono bg-slate-50 p-1 rounded mt-2 select-all overflow-hidden text-ellipsis whitespace-nowrap">
                              RTL-SEC-{(selectedReceipt?.id || '').replace('PAY-', '').toUpperCase()}-X77
                            </span>
                            <span className="text-[8px] text-slate-400 uppercase">Verification Ref Code</span>
                          </div>
                        </div>
                      </div>

                      {/* PDF download and print buttons */}
                      <div className="flex gap-3 mt-8 pt-4 border-t border-slate-200">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`RUQAYYA TRANSPORT LIMITED\nRECEIPT REF: ${selectedReceipt.receipt_number}\nAMOUNT: ₦${selectedReceipt.amount}\nDATE: ${selectedReceipt.date}\nDRIVER: ${driver.fullName}`);
                            link.download = `Receipt_${selectedReceipt.receipt_number}.pdf`;
                            link.click();
                          }}
                          className="flex-1 font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-900 border-0"
                        >
                          <Download className="h-4 w-4" />
                          {t.history.downloadPdf}
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => {
                            window.print();
                          }}
                          className="flex-1 font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-slate-900 hover:bg-slate-950 text-white border-0"
                        >
                          <Printer className="h-4 w-4" />
                          {t.history.print}
                        </Button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* VEHICLE PAGE TAB */}
          {activeTab === 'vehicle' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <div className="lg:col-span-8 flex flex-col gap-6">
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>{t.vehicle.title}</CardTitle>
                      <CardDescription>{t.vehicle.desc}</CardDescription>
                    </div>
                  </CardHeader>

                  {vehicle ? (
                    <div className="p-4 md:p-6 flex flex-col gap-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                        <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                          <span className="text-[10px] text-text-muted font-bold block uppercase">{lang === 'en' ? "Plate Number" : "Lambar Mota"}</span>
                          <span className="font-extrabold text-text-main mt-1 block text-sm text-brand-gold">{vehicle.plateNumber}</span>
                        </div>
                        <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                          <span className="text-[10px] text-text-muted font-bold block uppercase">{lang === 'en' ? "Model / Brand" : "Irin Mota / Kamfani"}</span>
                          <span className="font-extrabold text-text-main mt-1 block">{vehicle.brand} {vehicle.model}</span>
                        </div>
                        <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                          <span className="text-[10px] text-text-muted font-bold block uppercase">{lang === 'en' ? "Year" : "Shekarar Kera Ta"}</span>
                          <span className="font-extrabold text-text-main mt-1 block">{vehicle.year || 2024}</span>
                        </div>
                        <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                          <span className="text-[10px] text-text-muted font-bold block uppercase">{lang === 'en' ? "Color" : "Launi"}</span>
                          <span className="font-extrabold text-text-main mt-1 block capitalize">{vehicle.colour || 'Silver Metallic'}</span>
                        </div>
                        <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                          <span className="text-[10px] text-text-muted font-bold block uppercase">{lang === 'en' ? "Chassis ID" : "Lambar Sasi"}</span>
                          <span className="font-extrabold text-text-main mt-1 block text-[10px] overflow-hidden text-ellipsis">{vehicle.chassisNumber}</span>
                        </div>
                        <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                          <span className="text-[10px] text-text-muted font-bold block uppercase">{lang === 'en' ? "Engine ID" : "Lambar Inji"}</span>
                          <span className="font-extrabold text-text-main mt-1 block text-[10px] overflow-hidden text-ellipsis">{vehicle.engineNumber}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center mt-2 border-t border-border-main/40 pt-6">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-text-muted font-bold uppercase">{t.vehicle.odometer}</span>
                          <span className="text-xl font-black text-text-main font-mono">{vehicle.mileage.toLocaleString()} KM</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-text-muted font-bold uppercase">{t.vehicle.tonnage}</span>
                          <span className="text-xl font-black text-text-main">{vehicle.capacity}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-text-muted font-bold uppercase">{t.vehicle.service}</span>
                          <span className="text-xl font-black text-text-main font-mono">{vehicle.lastServiceDate}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-text-muted font-bold uppercase">{t.vehicle.fuel}</span>
                          <span className="text-xl font-black text-brand-gold font-mono">{(vehicle.fuelType || '').toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-text-muted font-bold">
                      {lang === 'en' ? "No active vehicle assigned." : "Babu motar da aka sanya maka a halin yanzu."}
                    </div>
                  )}
                </Card>
              </div>

              {/* Asset illustrations visuals */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.vehicle.rigImages}</CardTitle>
                  </CardHeader>
                  <div className="p-4 flex flex-col gap-4">
                    {/* Illustrative modern tricycle drawing */}
                    <div className="h-44 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-slate-400 p-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-radial-at-t from-brand-gold/10 to-transparent pointer-events-none"></div>
                      <Bike className="h-16 w-16 text-brand-gold animate-pulse mb-3" />
                      <span className="text-xs font-bold text-white font-mono">{vehicle ? vehicle.plateNumber : 'RTL-TRICYCLE'}</span>
                      <span className="text-[9px] text-slate-500 font-mono mt-1 uppercase">AUDITED FLEET TRICYCLE</span>
                    </div>

                    <div className="p-3.5 bg-bg-base border border-border-main/50 rounded-xl text-[11px] text-text-muted leading-relaxed font-mono">
                      <strong>Vehicle Valued At:</strong> ₦35,000,000<br />
                      <strong>Capital Downpayment:</strong> ₦11,000,000<br />
                      <strong>Amortized Amortization Remaining:</strong> ₦{driver.remainingVehicleBalance.toLocaleString()}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* COMPANY DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Document Lists */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>{t.docs.title}</CardTitle>
                      <CardDescription>{t.docs.desc}</CardDescription>
                    </div>
                  </CardHeader>

                  <div className="flex flex-col divide-y divide-border-main/40 text-xs">
                    {[
                      { key: 'regCert', title: t.docs.regCert, type: 'Certificate' },
                      { key: 'insurance', title: t.docs.insurance, type: 'Policy' },
                      { key: 'roadWorthiness', title: t.docs.roadWorthiness, type: 'Permit' },
                      { key: 'ownership', title: t.docs.ownership, type: 'Attestation' },
                      { key: 'inspection', title: t.docs.inspection, type: 'Log' }
                    ].map((doc) => {
                      const demoFilename = `vehicle_${doc.key}.pdf`;
                      return (
                        <div key={doc.key} className="p-4 flex justify-between items-center hover:bg-bg-base/20 transition-all">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-red-500/10 rounded-lg text-red-500">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-text-main block">{doc.title}</span>
                              <span className="text-[10px] text-text-muted font-mono mt-0.5 block">{doc.type} • PDF File</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPreviewDoc({ title: doc.title, url: `/api/documents/preview/${demoFilename}?token=${api.getToken()}` })}
                              className="p-1.5 bg-bg-base hover:bg-slate-900 hover:text-white rounded-lg text-text-main transition-all cursor-pointer flex items-center justify-center gap-1"
                              title={t.docs.preview}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <a
                              href={`data:text/plain;charset=utf-8,RUQAYYA TRANSPORT LIMITED OFFICIAL PERMIT: ${doc.title}`}
                              download={`${doc.key}.pdf`}
                              className="p-1.5 bg-bg-base hover:bg-slate-900 hover:text-white rounded-lg text-text-main transition-all cursor-pointer flex items-center justify-center gap-1"
                              title={t.docs.download}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Secure Document Preview Visualizer container */}
              <div className="lg:col-span-6">
                {previewDoc ? (
                  <Card className="h-full min-h-[400px] flex flex-col">
                    <CardHeader className="flex justify-between items-center border-b border-border-main/50 pb-3">
                      <CardTitle className="text-sm">{previewDoc.title}</CardTitle>
                      <button
                        onClick={() => setPreviewDoc(null)}
                        className="text-text-muted hover:text-text-main font-bold text-xs"
                      >
                        {t.docs.closePreview}
                      </button>
                    </CardHeader>
                    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-400 font-mono relative overflow-hidden min-h-[300px]">
                      <div className="absolute inset-0 bg-radial-at-t from-white/[0.02] to-transparent pointer-events-none"></div>
                      <FileText className="h-16 w-16 text-slate-600 mb-4 animate-bounce" />
                      <p className="text-xs text-white font-bold mb-1">SECURE DOCUMENT VIEWER</p>
                      <p className="text-[10px] text-slate-500 text-center max-w-xs leading-relaxed">
                        Authorized credential session active.<br />
                        File: {previewDoc.title.replace(/\s+/g, '_')}.pdf
                      </p>
                      <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg text-[10px] text-slate-400 leading-relaxed max-w-sm">
                        <strong>Official Compliance Attestation:</strong><br />
                        This certifies that the vehicle assigned is registered under federal transport corridors and is fully certified for nationwide operations.
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="border border-dashed border-border-main p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px] rounded-2xl bg-bg-surface/30">
                    <Eye className="h-10 w-10 text-text-muted/30 mb-2.5" />
                    <p className="text-xs text-text-muted font-bold uppercase tracking-wider">
                      {lang === 'en' ? "Secure Document Viewer Console" : "Shafin Duba Takardun Kamfani"}
                    </p>
                    <p className="text-[10px] text-text-muted max-w-xs mt-1">
                      {lang === 'en' 
                        ? "Select any compliance certificate or ownership title to preview credentials securely." 
                        : "Zaɓi kowane takarda don duba shi a nan take tare da cikakken tsaro."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Profile details and edits */}
              <div className="lg:col-span-8">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.profile.title}</CardTitle>
                    <CardDescription>{t.profile.desc}</CardDescription>
                  </CardHeader>

                  <form onSubmit={handleProfileUpdate} className="flex flex-col gap-5">
                    {profileSuccess && <Alert type="success">{profileSuccess}</Alert>}
                    {profileError && <Alert type="danger">{profileError}</Alert>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text-main">{t.profile.phone}</label>
                        <input
                          type="text"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text-main">{t.profile.email}</label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-main">{t.profile.address}</label>
                      <input
                        type="text"
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-main">{t.profile.password}</label>
                      <input
                        type="password"
                        value={profileForm.password}
                        onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none"
                      />
                    </div>

                    <Button
                      variant="primary"
                      type="submit"
                      size="sm"
                      className="font-bold w-full md:w-auto cursor-pointer"
                    >
                      {t.profile.save}
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Read-Only Parameters and Notices */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <Card className="bg-bg-surface border-border-main/50">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-brand-gold" />
                      {lang === 'en' ? "Audit Integrity Center" : "Ofishin Tsaro da Tantancewa"}
                    </CardTitle>
                  </CardHeader>
                  <div className="p-4 flex flex-col gap-4 text-xs leading-relaxed text-text-muted">
                    <p>{t.profile.readOnlyAlert}</p>
                    
                    <div className="flex flex-col gap-2.5 font-mono text-[10px] bg-bg-base/50 p-4 border border-border-main/50 rounded-xl">
                      <div className="flex justify-between">
                        <span>CLASSIFICATION:</span>
                        <span className="font-bold text-text-main">{(driver.classification || '').toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AGREED RATE:</span>
                        <span className="font-bold text-text-main">₦{driver.agreedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VEHICLE DEBT BAL:</span>
                        <span className="font-bold text-text-main">₦{driver.remainingVehicleBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>NATIONAL NIN:</span>
                        <span className="font-bold text-text-main">{driver.nin || 'UNRECORDED'}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// Simple helper component for close icon since X is needed
const X: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2} 
    stroke="currentColor" 
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
