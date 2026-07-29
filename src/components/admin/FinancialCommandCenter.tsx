/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Trash2, 
  User, 
  Truck, 
  ListFilter,
  FileText,
  Calendar,
  HelpCircle,
  Info,
  Calculator,
  BookOpen,
  ArrowRight,
  Percent,
  Wallet,
  Printer,
  Clock,
  Briefcase,
  Users,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Check,
  AlertTriangle,
  ShieldCheck,
  Receipt,
  Trello,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert, Modal } from '../ui/SharedComponents';
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  Cell
} from 'recharts';
import { Driver, Vehicle, FinancialRecord, Shareholder } from '../../types';
import { api } from '../../utils/api';
import { ReportCenter } from './ReportCenter';

interface FinancialCommandCenterProps {
  lang: 'en' | 'ha';
  drivers: Driver[];
  vehicles: Vehicle[];
  finance: FinancialRecord[];
  payments: any[];
  shareholders?: Shareholder[];
  onSync: () => void;
  trips?: any[];
}

export const FinancialCommandCenter: React.FC<FinancialCommandCenterProps> = ({
  lang,
  drivers,
  vehicles,
  finance,
  payments,
  shareholders = [],
  onSync,
  trips = []
}) => {
  // Navigation tabs
  const [subTab, setSubTab] = useState<'dashboard' | 'payments' | 'wallet' | 'expenses' | 'shareholders' | 'payroll' | 'reports' | 'audit'>('dashboard');
  
  // Localized data states
  const [localPayments, setLocalPayments] = useState<any[]>([]);
  const [localShareholders, setLocalShareholders] = useState<Shareholder[]>([]);
  const [localAuditLogs, setLocalAuditLogs] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Modal / Interaction states
  const [isRecordExpenseOpen, setIsRecordExpenseOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [payAmountInput, setPayAmountInput] = useState<string>('');
  const [payReceiptInput, setPayReceiptInput] = useState<string>('');
  const [payRemarksInput, setPayRemarksInput] = useState<string>('');
  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = useState(false);

  // Expense logging form state
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('maintenance');
  const [expDescription, setExpDescription] = useState('');
  const [expDriverId, setExpDriverId] = useState('');
  const [expReceiptNo, setExpReceiptNo] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expError, setExpError] = useState('');
  const [expSuccess, setExpSuccess] = useState('');

  // Shareholder Action Modals
  const [activeShareholder, setActiveShareholder] = useState<Shareholder | null>(null);
  const [shSubView, setShSubView] = useState<'roster' | 'history'>('roster');
  const [payrollSubView, setPayrollSubView] = useState<'analytics' | 'history'>('analytics');
  const [driverView, setDriverView] = useState<'remit' | 'history' | 'compliance'>('remit');
  const [dbCycles, setDbCycles] = useState<any[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('1'); // Use '1' as initial fallback before cycles load
  const [selectedInstallment, setSelectedInstallment] = useState('1'); // Default to '1' as requested
  const [isCyclePopupOpen, setIsCyclePopupOpen] = useState(false);
  const [isInstallmentPopupOpen, setIsInstallmentPopupOpen] = useState(false);
  const [isUnpaidDriversPopupOpen, setIsUnpaidDriversPopupOpen] = useState(false);
  const [pendingCycleSelection, setPendingCycleSelection] = useState('1');
  const [userHasSelectedCycle, setUserHasSelectedCycle] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isReinvestOpen, setIsReinvestOpen] = useState(false);
  const [shActionAmount, setShActionAmount] = useState('');
  const [shActionRemarks, setShActionRemarks] = useState('');
  const [shActionError, setShActionError] = useState('');
  const [shActionSuccess, setShActionSuccess] = useState('');

  // Add & Edit Shareholder Modal states
  const [isAddEditShareholderOpen, setIsAddEditShareholderOpen] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<Shareholder | null>(null);
  const [shFormFullName, setShFormFullName] = useState('');
  const [shFormPhone, setShFormPhone] = useState('');
  const [shFormEmail, setShFormEmail] = useState('');
  const [shFormAddress, setShFormAddress] = useState('');
  const [shFormInvestmentAmount, setShFormInvestmentAmount] = useState('');
  const [shFormInvestmentDate, setShFormInvestmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [shFormPassportNumber, setShFormPassportNumber] = useState('');
  const [shFormPassportPhoto, setShFormPassportPhoto] = useState('');
  const [shFormError, setShFormError] = useState('');
  const [shFormSuccess, setShFormSuccess] = useState('');
  const [shFormLoading, setShFormLoading] = useState(false);

  const openAddShareholder = () => {
    setEditingShareholder(null);
    setShFormFullName('');
    setShFormPhone('');
    setShFormEmail('');
    setShFormAddress('');
    setShFormInvestmentAmount('');
    setShFormInvestmentDate(new Date().toISOString().split('T')[0]);
    setShFormPassportNumber('');
    setShFormPassportPhoto('');
    setShFormError('');
    setShFormSuccess('');
    setIsAddEditShareholderOpen(true);
  };

  const openEditShareholder = (sh: Shareholder) => {
    setEditingShareholder(sh);
    setShFormFullName(sh.full_name || '');
    setShFormPhone(sh.phone || '');
    setShFormEmail(sh.email || '');
    setShFormAddress(sh.address || '');
    setShFormInvestmentAmount((sh.investment_amount || 0).toString());
    setShFormInvestmentDate(sh.investment_date || new Date().toISOString().split('T')[0]);
    setShFormPassportNumber((sh as any).passport_number || '');
    setShFormPassportPhoto(sh.passport_photo_url || (sh as any).passportPhoto || (sh as any).passport_photo || (sh as any).passport || '');
    setShFormError('');
    setShFormSuccess('');
    setIsAddEditShareholderOpen(true);
  };

  const handleShFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setShFormPassportPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddEditShareholderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShFormError('');
    setShFormSuccess('');
    setShFormLoading(true);

    if (!shFormFullName || !shFormPhone || !shFormEmail || !shFormInvestmentAmount) {
      setShFormError(lang === 'en' ? "Please fill in all required fields." : "Da fatan a cika duka bayanan da ake bukata.");
      setShFormLoading(false);
      return;
    }

    try {
      if (editingShareholder) {
        // Edit flow
        const payload = {
          full_name: shFormFullName,
          fullName: shFormFullName,
          phone: shFormPhone,
          email: shFormEmail,
          address: shFormAddress,
          investment_amount: parseFloat(shFormInvestmentAmount),
          investmentAmount: parseFloat(shFormInvestmentAmount),
          investment_date: shFormInvestmentDate,
          investmentDate: shFormInvestmentDate,
          passport_photo_url: shFormPassportPhoto,
          passportPhoto: shFormPassportPhoto,
          passport_number: shFormPassportNumber
        };
        await api.updateShareholder(editingShareholder.id, payload);
        setShFormSuccess(lang === 'en' ? "Shareholder updated successfully!" : "An yi nasarar sabunta mai hannun jari!");
      } else {
        // Add flow
        const payload = {
          full_name: shFormFullName,
          fullName: shFormFullName,
          phone: shFormPhone,
          email: shFormEmail,
          address: shFormAddress,
          investment_amount: parseFloat(shFormInvestmentAmount),
          investmentAmount: parseFloat(shFormInvestmentAmount),
          investment_date: shFormInvestmentDate,
          investmentDate: shFormInvestmentDate,
          passport_photo_url: shFormPassportPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
          passportPhoto: shFormPassportPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
          passport_number: shFormPassportNumber
        };
        await api.addShareholder(payload);
        setShFormSuccess(lang === 'en' ? "Shareholder registered successfully!" : "An yi nasarar yi wa mai hannun jari rajista!");
      }

      // Refresh and close after brief delay
      setTimeout(async () => {
        await fetchAuxRecords();
        onSync();
        setIsAddEditShareholderOpen(false);
      }, 1000);
    } catch (err: any) {
      setShFormError(err.message || (lang === 'en' ? "Operation failed." : "Aiki bai yi nasara ba."));
    } finally {
      setShFormLoading(false);
    }
  };

  // Payroll disburse state
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollSuccess, setPayrollSuccess] = useState('');
  const [payrollError, setPayrollError] = useState('');

  // Search/Filters inside subtabs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Format and sequentialize started cycles dynamically
  const formattedCycles = React.useMemo(() => {
    if (!dbCycles || dbCycles.length === 0) {
      return [
        {
          id: 'CYC-2026-ACTIVE',
          seqId: '1',
          label: 'CYC 001',
          status: 'active',
          isCurrent: true,
          displayLabel: 'CYC 001 CURRENT CYCLE',
          startDate: '2026-07-01'
        }
      ];
    }

    // Sort by startDate or fallback to original index order (oldest first)
    const sorted = [...dbCycles].sort((a, b) => {
      const dateA = a.startDate || a.created_at || '';
      const dateB = b.startDate || b.created_at || '';
      return dateA.localeCompare(dateB);
    });

    return sorted.map((c, index) => {
      const seqNum = index + 1;
      const padNum = String(seqNum).padStart(3, '0');
      const label = `CYC ${padNum}`;
      const isCurrent = c.status === 'active' || c.status === 'paused';
      const displayLabel = isCurrent ? `${label} CURRENT CYCLE` : `${label} COMPLETED`;
      return {
        ...c,
        seqId: String(seqNum),
        label,
        isCurrent,
        displayLabel
      };
    });
  }, [dbCycles]);

  // Auto-select current active cycle on load
  useEffect(() => {
    if (formattedCycles.length > 0 && !userHasSelectedCycle) {
      const activeCyc = formattedCycles.find(c => c.isCurrent);
      if (activeCyc) {
        setSelectedCycle(activeCyc.seqId);
        setPendingCycleSelection(activeCyc.seqId);
      } else {
        const lastCyc = formattedCycles[formattedCycles.length - 1];
        setSelectedCycle(lastCyc.seqId);
        setPendingCycleSelection(lastCyc.seqId);
      }
    }
  }, [formattedCycles, userHasSelectedCycle]);

  // Identify drivers missing payments for selected period
  const pendingDrivers = drivers.filter(d => {
    const hasPayment = localAuditLogs.some(log => 
      log.userId === d.id && 
      log.action === 'DRIVER_REMITTANCE' && 
      (log.description?.includes(`Cycle #${selectedCycle}`) || log.description?.includes(`Cycle ${selectedCycle}`)) &&
      (log.description?.includes(`Inst. #${selectedInstallment}`) || log.description?.includes(`Installment #${selectedInstallment}`))
    );
    return !hasPayment;
  });

  // Auto-fetch additional records
  const fetchAuxRecords = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    setIsFetching(true);
    try {
      const [pList, sList, aList, cyList] = await Promise.all([
        api.getPayments().catch(() => []),
        api.getShareholders().catch(() => []),
        api.getAuditLogs().catch(() => []),
        api.request('/api/director/cycles').catch(() => ({ cycles: [] }))
      ]);
      setLocalPayments(pList || []);
      if (sList && sList.length > 0) {
        setLocalShareholders(sList);
      } else if (shareholders && shareholders.length > 0) {
        setLocalShareholders(shareholders);
      } else {
        setLocalShareholders([]);
      }
      setLocalAuditLogs(aList || []);
      setDbCycles(cyList?.cycles || []);
    } catch (err) {
      console.error("Auxiliary financial data fetch failed:", err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (shareholders && shareholders.length > 0) {
      setLocalShareholders(shareholders);
    }
    fetchAuxRecords();
  }, [payments, shareholders, finance]);

  const handleManualSync = async () => {
    await fetchAuxRecords();
    onSync();
  };

  // Translations
  const t = {
    en: {
      dashTitle: "Financial Core",
      dashSubtitle: "Automated real-time general ledger, smart collections, corporate spend, & shareholder equities.",
      companyWallet: "Company Net Cash Balance",
      todayCollections: "Today's Collections",
      todayExpenses: "Today's Corporate Spend",
      monthlyCollections: "Monthly Collections",
      monthlyExpenses: "Monthly Operating Expenses",
      netProfit: "Net cash surplus",
      driverReceivables: "Driver Lease Balances",
      dividendsPool: "Continuous Dividends Pool (2%)",
      totalWithdrawn: "Dividends Disbursed",
      payrollLiability: "Payroll Obligation (Est.)",
      recentActivity: "Recent Ledger Activities",
      amount: "Amount",
      category: "Category",
      date: "Date",
      description: "Description",
      status: "Status",
      action: "Actions",
      recordPay: "Post Driver Remittance",
      recordExp: "Post Corporate Spend",
      searchDriver: "Search driver...",
      allCategories: "All Categories",
      salary: "Team Wages",
      maintenance: "Spare Parts / Repair",
      fuel: "Fuel/Petrol",
      legal: "Legal & Regulatory",
      office: "Office Admin & Electric",
      miscellaneous: "Miscellaneous Logs",
      bankCharges: "Bank & Transaction Fees",
      processPayroll: "Disburse Monthly Wages",
      processPayrollSuccess: "Corporate wages successfully disbursed to staff accounts!",
      insufficientFunds: "Insufficient funds in company wallet to execute transaction.",
      shareholdersTitle: "Shareholder Investment Stock",
      shareholderStake: "Equity Weight",
      earnings: "Accumulated Dividends",
      withdrawable: "Available Dividends",
      totalReinvested: "Earnings Reinvested",
      withdrawDividends: "Withdraw Dividends",
      reinvestDividends: "Reinvest Earnings",
      receiptNumber: "Receipt / Invoice No.",
      approvedBy: "Authorized Officer",
      driverWallet: "Driver Credits Wallet"
    },
    ha: {
      dashTitle: "Babban Ma'ajiyar Kudi",
      dashSubtitle: "Lissafin kudin shiga da na kashewa, kudaden direbobi, da rabon jari na shareholders kai-tsaye.",
      companyWallet: "Kudin Net na Kamfani",
      todayCollections: "Kudin da aka Tara Yau",
      todayExpenses: "Kudin da aka Kashe Yau",
      monthlyCollections: "Kudaden da aka Tara na Wata",
      monthlyExpenses: "Kudaden da aka Kashe na Wata",
      netProfit: "Ribar Net na Kudi",
      driverReceivables: "Sauran Kudaden Babura",
      dividendsPool: "Asusun Rabon Jari (2%)",
      totalWithdrawn: "Dividends da aka Cire",
      payrollLiability: "Albashin Ma’aikata (Kiyasi)",
      recentActivity: "Ayyukan Kudi na Karshe",
      amount: "Adadin Kudi",
      category: "Nau'i",
      date: "Rana",
      description: "Bayani",
      status: "Tantancewa",
      action: "Ayyuka",
      recordPay: "Shigar da Kudin Remittance",
      recordExp: "Shigar da Kudin da aka Kashe",
      searchDriver: "Nemo direba...",
      allCategories: "Duk Nau'ukan",
      salary: "Albashin Ma’aikata",
      maintenance: "Kudin Gyaran Mota",
      fuel: "Kudin Mai/Fetur",
      legal: "Kudin Shari'a/Haraji",
      office: "Kudin Ofis & Wuta",
      miscellaneous: "Sauran Kudaden",
      bankCharges: "Kudin Banki",
      processPayroll: "Biya Albashin Staff",
      processPayrollSuccess: "An yi nasarar biyan albashin ma’aikata!",
      insufficientFunds: "Kudin kamfani bai kai na gudanar da wannan aiki ba.",
      shareholdersTitle: "Jarin Shareholders na Kamfani",
      shareholderStake: "Kason Jari (%)",
      earnings: "Kudin Raba Jari da aka Tara",
      withdrawable: "Kudin da za a iya Cirewa",
      totalReinvested: "Kudin da aka sake Zuba Jari",
      withdrawDividends: "Fitar da Ribar Jari",
      reinvestDividends: "Sake Zuba Jari na Riba",
      receiptNumber: "Lambar Rasit/Inwois",
      approvedBy: "Jami'i mai Tabbatarwa",
      driverWallet: "Asusun Ajiyar Direbobi"
    }
  }[lang];

  // REAL-TIME LEDGER METRICS
  const totalRevenue = finance.filter(f => f.type === 'revenue').reduce((sum, f) => sum + f.amount, 0);
  const totalExpenses = finance.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
  const companyWalletBalance = totalRevenue - totalExpenses;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCollections = finance
    .filter(f => f.type === 'revenue' && f.category === 'remittance' && f.date?.startsWith(todayStr))
    .reduce((sum, f) => sum + f.amount, 0);

  const todayExpenses = finance
    .filter(f => f.type === 'expense' && f.date?.startsWith(todayStr))
    .reduce((sum, f) => sum + f.amount, 0);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyCollections = finance
    .filter(f => f.type === 'revenue' && f.category === 'remittance' && f.date?.startsWith(currentMonthStr))
    .reduce((sum, f) => sum + f.amount, 0);

  const monthlyExpenses = finance
    .filter(f => f.type === 'expense' && f.date?.startsWith(currentMonthStr))
    .reduce((sum, f) => sum + f.amount, 0);

  const outstandingDriverReceivables = drivers.reduce((sum, d) => sum + (d.remaining_vehicle_balance || 0), 0);

  // Shareholder Dividend calculations
  const distributionPercentage = 2; // Fixed 2% accumulation continuous pool
  const continuousDividendPool = companyWalletBalance > 0 ? (companyWalletBalance * (distributionPercentage / 100)) : 0;
  const totalInvestmentsSum = localShareholders.reduce((sum, sh) => sum + (sh.investment_amount || 0), 0);

  // Active Tricycles Payroll calculated automatically from trip/keke activity logs over a 30-day cycle
  const activeTricyclesCount = (() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeTricycleIds = new Set<string>();

    (trips || []).forEach((t: any) => {
      const tripDateStr = t.created_at || t.departureTime || t.departure_time;
      if (tripDateStr) {
        const tripDate = new Date(tripDateStr);
        if (tripDate >= thirtyDaysAgo && tripDate <= now) {
          const vid = t.vehicle_id || t.vehicleId;
          if (vid) {
            activeTricycleIds.add(vid);
          }
        }
      }
    });

    if (activeTricycleIds.size > 0) {
      return activeTricycleIds.size;
    }

    // Fallback: get all vehicles that had ANY trip manifest ever
    const allTripVehicleIds = new Set<string>();
    (trips || []).forEach((t: any) => {
      const vid = t.vehicle_id || t.vehicleId;
      if (vid) allTripVehicleIds.add(vid);
    });
    
    if (allTripVehicleIds.size > 0) {
      return allTripVehicleIds.size;
    }

    // Secondary fallback
    return vehicles.filter(v => v.status === 'active' || v.status === 'assigned' || v.status === 'idle').length || vehicles.length || 5;
  })();
  const barristerSal = activeTricyclesCount * 1000;
  const managerSal = activeTricyclesCount * 500;
  const adamSal = activeTricyclesCount * 1000;
  const abakakaSal = activeTricyclesCount * 1000;
  const totalPayroll_liability = barristerSal + managerSal + adamSal + abakakaSal;

  const activeTricyclesList = (() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const mapped: { [key: string]: { lastTrip: string; route: string; date: string } } = {};

    (trips || []).forEach((t: any) => {
      const tripDateStr = t.created_at || t.departureTime || t.departure_time;
      if (tripDateStr) {
        const tripDate = new Date(tripDateStr);
        if (tripDate >= thirtyDaysAgo && tripDate <= now) {
          const vid = t.vehicle_id || t.vehicleId;
          if (vid) {
            const currentObj = mapped[vid];
            const isNewer = !currentObj || new Date(tripDateStr) > new Date(currentObj.date);
            if (isNewer) {
              mapped[vid] = {
                lastTrip: t.manifest_number || t.manifestNumber || 'N/A',
                route: `${t.origin || 'Kano'} ➔ ${t.destination || 'Zaria'}`,
                date: tripDateStr.substring(0, 10)
              };
            }
          }
        }
      }
    });

    const list = Object.entries(mapped).map(([id, info]) => {
      const vehicle = vehicles.find(v => v.id === id);
      return {
        id,
        plateNumber: vehicle?.plateNumber || 'N/A',
        model: vehicle?.model || 'Utility Keke',
        status: vehicle?.status || 'active',
        ...info
      };
    });

    if (list.length > 0) return list;

    // Fallback: use all vehicles with active trip manifests
    const fallbackMapped: { [key: string]: { lastTrip: string; route: string; date: string } } = {};
    (trips || []).forEach((t: any) => {
      const vid = t.vehicle_id || t.vehicleId;
      if (vid) {
        fallbackMapped[vid] = {
          lastTrip: t.manifest_number || t.manifestNumber || 'N/A',
          route: `${t.origin || 'Kano'} ➔ ${t.destination || 'Zaria'}`,
          date: (t.created_at || t.departureTime || t.departure_time || '').substring(0, 10) || 'N/A'
        };
      }
    });

    const fallbackList = Object.entries(fallbackMapped).map(([id, info]) => {
      const vehicle = vehicles.find(v => v.id === id);
      return {
        id,
        plateNumber: vehicle?.plateNumber || 'N/A',
        model: vehicle?.model || 'Utility Keke',
        status: vehicle?.status || 'active',
        ...info
      };
    });

    if (fallbackList.length > 0) return fallbackList;

    // Last resort fallback: list some vehicles from vehicles state
    return vehicles.slice(0, 5).map((v, idx) => ({
      id: v.id,
      plateNumber: v.plateNumber || 'N/A',
      model: v.model || 'Utility Keke',
      status: v.status || 'active',
      lastTrip: 'N/A',
      route: 'No Active Trips Found',
      date: 'N/A'
    }));
  })();

  // Chart Grouping logic
  const compileChartData = () => {
    const datesMap: { [key: string]: { date: string; Revenue: number; Expense: number } } = {};
    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      datesMap[str] = { date: str.substring(5), Revenue: 0, Expense: 0 };
    }
    finance.forEach(f => {
      if (!f.date) return;
      const dKey = f.date.split('T')[0];
      if (datesMap[dKey]) {
        if (f.type === 'revenue') {
          datesMap[dKey].Revenue += f.amount;
        } else {
          datesMap[dKey].Expense += f.amount;
        }
      }
    });
    return Object.values(datesMap).sort((a, b) => a.date.localeCompare(b.date));
  };
  const mainChartData = compileChartData();

  // DRIVER PAYMENT SPECIFIC MATHS & LOGIC
  const matchedDriver = drivers.find(d => d.id === selectedDriverId);

  // Calculate agreement
  const agreedAmount = matchedDriver?.agreed_amount || 180000;
  const installmentDue = agreedAmount / 6;

  // Payments already registered for this installment
  const currentInstallmentNumber = matchedDriver 
    ? Math.min(6, Math.floor((localPayments.filter(p => p.driver_id === matchedDriver.id && p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)) / installmentDue) + 1)
    : 1;

  const totalInstallmentPaymentsPaid = matchedDriver
    ? localPayments
        .filter(p => p.driver_id === matchedDriver.id && p.status === 'approved' && p.installment_number === currentInstallmentNumber)
        .reduce((sum, p) => sum + p.amount, 0)
    : 0;

  const remainingInstallmentBalance = Math.max(0, installmentDue - totalInstallmentPaymentsPaid);
  const driverWalletBalance = matchedDriver ? (matchedDriver as any).wallet_balance || 0 : 0;
  const outstandingVehicleBalance = matchedDriver?.remaining_vehicle_balance || 14250000;
  const driverOutstandingDebt = matchedDriver ? Math.max(0, (currentInstallmentNumber - 1) * installmentDue - (localPayments.filter(p => p.driver_id === matchedDriver.id && p.status === 'approved').reduce((sum, p) => sum + p.amount, 0) - totalInstallmentPaymentsPaid)) : 0;

  // Real-time engine calculators (as the admin types)
  const incomingCash = parseFloat(payAmountInput) || 0;
  
  // Mathematical logic
  let remainingInstallmentAfterPay = Math.max(0, remainingInstallmentBalance - incomingCash);
  let leftoverCash = Math.max(0, incomingCash - remainingInstallmentBalance);
  let driverWalletIncrease = 0;
  let remainingVehicleBalanceAfterPay = Math.max(0, outstandingVehicleBalance - incomingCash);
  let isNextInstallmentActivated = incomingCash >= remainingInstallmentBalance;
  let expectedInstallmentStatus = 'partial';

  if (incomingCash >= remainingInstallmentBalance) {
    expectedInstallmentStatus = 'paid';
    driverWalletIncrease = leftoverCash;
  }

  // Handle Driver Payment Save
  const handleRecordPaymentConfirm = async () => {
    if (!selectedDriverId || !payAmountInput || !payReceiptInput) return;
    setIsConfirmPaymentOpen(false);

    try {
      await api.addPayment({
        driverId: selectedDriverId,
        amount: parseFloat(payAmountInput),
        installmentNumber: parseInt(selectedInstallment),
        outstandingAmount: remainingInstallmentAfterPay,
        date: new Date().toISOString().split('T')[0],
        receiptNumber: payReceiptInput,
        remarks: payRemarksInput || `Remittance for ${formattedCycles.find(c => c.seqId === selectedCycle)?.label || `CYC 00${selectedCycle}`}, Inst. #${selectedInstallment}`
      });

      // Reset
      setPayAmountInput('');
      setPayReceiptInput('');
      setPayRemarksInput('');
      setSelectedDriverId('');
      
      // Auto-update SSE / Parent triggers
      await handleManualSync();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Process Expense Logging
  const handleRecordExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpError('');
    setExpSuccess('');

    if (!expAmount || !expDescription || !expDate) {
      setExpError(lang === 'en' ? "Please fill in amount, description, and date." : "Da fatan za a cika kudi, bayani, da rana.");
      return;
    }

    try {
      await api.addExpenseDirect({
        amount: parseFloat(expAmount),
        category: expCategory,
        description: `${expDescription} ${expReceiptNo ? '(Inv/Receipt: ' + expReceiptNo + ')' : ''}`,
        date: expDate,
        driverId: expDriverId || undefined
      });

      setExpSuccess(lang === 'en' ? "Operational expense posted to ledger successfully!" : "An yi nasarar shigar da kudaden da aka kashe!");
      setExpAmount('');
      setExpDescription('');
      setExpDriverId('');
      setExpReceiptNo('');
      
      setTimeout(() => {
        setIsRecordExpenseOpen(false);
        handleManualSync();
      }, 1500);
    } catch (err: any) {
      setExpError(err.message || "Failed to log spend record.");
    }
  };

  // Process Shareholder Dividend Withdrawal
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShActionError('');
    setShActionSuccess('');

    if (!activeShareholder || !shActionAmount || parseFloat(shActionAmount) <= 0) {
      setShActionError("Please specify a valid withdrawal amount.");
      return;
    }

    try {
      await api.postShareholderWithdrawal({
        shareholderId: activeShareholder.id,
        amount: parseFloat(shActionAmount),
        remarks: shActionRemarks
      });

      setShActionSuccess("Withdrawal of ₦" + parseFloat(shActionAmount).toLocaleString() + " approved and disbursed!");
      setShActionAmount('');
      setShActionRemarks('');
      
      setTimeout(() => {
        setIsWithdrawOpen(false);
        setActiveShareholder(null);
        handleManualSync();
      }, 1500);
    } catch (err: any) {
      setShActionError(err.message || "Failing to disburse dividend payment.");
    }
  };

  // Process Shareholder Dividend Reinvestment (Rollover)
  const handleReinvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShActionError('');
    setShActionSuccess('');

    if (!activeShareholder || !shActionAmount || parseFloat(shActionAmount) <= 0) {
      setShActionError("Please specify a valid reinvestment amount.");
      return;
    }

    try {
      await api.postShareholderReinvestment({
        shareholderId: activeShareholder.id,
        amount: parseFloat(shActionAmount)
      });

      setShActionSuccess("Earnings of ₦" + parseFloat(shActionAmount).toLocaleString() + " successfully rolled-over into capital stock!");
      setShActionAmount('');
      
      setTimeout(() => {
        setIsReinvestOpen(false);
        setActiveShareholder(null);
        handleManualSync();
      }, 1500);
    } catch (err: any) {
      setShActionError(err.message || "Failed to reinvest dividends.");
    }
  };

  // Process Automated Payroll Disbursal
  const handleProcessPayroll = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setPayrollError("Authentication required to process payroll.");
      return;
    }
    
    setPayrollLoading(true);
    setPayrollError('');
    setPayrollSuccess('');

    if (companyWalletBalance < totalPayroll_liability) {
      setPayrollError(t.insufficientFunds);
      setPayrollLoading(false);
      return;
    }

    try {
      await api.postPayroll();
      setPayrollSuccess(t.processPayrollSuccess);
      await handleManualSync();
    } catch (err: any) {
      setPayrollError(err.message || "Wages processing failed.");
    } finally {
      setPayrollLoading(false);
    }
  };

  // Merge general ledger receipts & approved driver installments for a clean cash flow list
  const getCombinedLedger = () => {
    let list: any[] = [];
    finance.forEach(f => {
      list.push({
        id: f.id,
        type: f.type,
        category: f.category,
        amount: f.amount,
        date: f.date,
        description: f.description,
        source: 'ledger',
        approvedBy: f.approvedBy || 'System Administrator'
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const combinedLedger = getCombinedLedger();

  // Search filter combined ledger
  const filteredLedger = combinedLedger.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = item.description.toLowerCase().includes(query) || 
                          item.id.toLowerCase().includes(query) || 
                          item.category.toLowerCase().includes(query);
    const matchesCategory = !selectedCategoryFilter || item.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6" id="corporate-finance-center">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-main/50 pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-slate-900 text-brand-gold rounded-lg shadow-md shrink-0">
              <Wallet className="h-5 w-5" />
            </span>
            {t.dashTitle}
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            {t.dashSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            className="font-bold flex items-center gap-1.5 cursor-pointer text-xs"
            disabled={isFetching}
          >
            <Clock className={`h-4 w-4 text-brand-gold ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? "Syncing..." : "Sync Ledger"}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRecordExpenseOpen(true)}
            className="font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer text-xs border-none"
          >
            <Plus className="h-4 w-4" />
            {t.recordExp}
          </Button>
        </div>
      </div>

      {/* FINANCE CENTER NAVIGATION TABS */}
      <div className="flex flex-wrap gap-1 border-b border-border-main/40 pb-2">
        {[
          { key: 'dashboard', label: lang === 'en' ? 'Dashboard' : 'Gudanarwa', icon: Layers },
          { key: 'payments', label: lang === 'en' ? 'Driver Payments' : 'Kudin Direbobi', icon: Calculator },
          { key: 'wallet', label: lang === 'en' ? 'Company Wallet' : 'Asusun Kamfani', icon: Wallet },
          { key: 'expenses', label: lang === 'en' ? 'Expenses' : 'Kashe Kudi', icon: TrendingDown },
          { key: 'shareholders', label: lang === 'en' ? 'Shareholders' : 'Masu Jari', icon: Users },
          { key: 'payroll', label: lang === 'en' ? 'Payroll' : 'Albashin Staff', icon: Briefcase },
          { key: 'reports', label: lang === 'en' ? 'Financial Reports' : 'Rahoton Kudi', icon: FileText },
          { key: 'audit', label: lang === 'en' ? 'Audit History' : 'Tantancewa', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key as any)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 text-brand-gold shadow-sm' 
                  : 'text-text-muted hover:text-text-main hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==============================================
          1. DASHBOARD SUBTAB
          ============================================== */}
      {subTab === 'dashboard' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          {/* TOP METRICS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* COMPANY WALLET */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.05, ease: "easeOut" }}
              className="flex"
            >
              <Card className="p-4 border-l-4 border-slate-900 bg-bg-surface flex flex-col justify-between h-32 shadow-sm w-full">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.companyWallet}</span>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-1">₦{companyWalletBalance.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-slate-100 pt-2">
                  <span>Inflows - Outflows</span>
                  <Badge variant="success">Auto Calculations</Badge>
                </div>
              </Card>
            </motion.div>

            {/* TODAY'S COLLECTIONS */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="flex"
            >
              <Card className="p-4 border-l-4 border-emerald-500 bg-bg-surface flex flex-col justify-between h-32 shadow-sm w-full">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.todayCollections}</span>
                  <p className="text-2xl font-black text-emerald-600 font-mono mt-1">₦{todayCollections.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-slate-100 pt-2">
                  <span>Today's Remittances</span>
                  <span className="text-emerald-600 font-bold font-mono">Live</span>
                </div>
              </Card>
            </motion.div>

            {/* NET SURPLUS PROFIT */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
              className="flex"
            >
              <Card className="p-4 border-l-4 border-brand-gold bg-bg-surface flex flex-col justify-between h-32 shadow-sm w-full">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.netProfit}</span>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-1">₦{companyWalletBalance.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-slate-100 pt-2">
                  <span>Net Profit margin</span>
                  <div className="flex items-center text-emerald-600 font-bold gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    <span>100%</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* DRIVER LEASE OUTSTANDING */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="flex"
            >
              <Card className="p-4 border-l-4 border-rose-500 bg-bg-surface flex flex-col justify-between h-32 shadow-sm w-full">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.driverReceivables}</span>
                  <p className="text-2xl font-black text-rose-600 font-mono mt-1">₦{outstandingDriverReceivables.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-slate-100 pt-2">
                  <span>Asset fleet value backlogs</span>
                  <Badge variant="danger">Receivable</Badge>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* SECOND METRICS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
              className="flex"
            >
              <Card className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between w-full">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.dividendsPool}</span>
                  <p className="text-lg font-bold text-slate-900 font-mono mt-1">₦{continuousDividendPool.toLocaleString()}</p>
                </div>
                <Percent className="h-8 w-8 text-slate-400 shrink-0" />
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
              className="flex"
            >
              <Card className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between w-full">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Month operating spends</span>
                  <p className="text-lg font-bold text-rose-600 font-mono mt-1">₦{monthlyExpenses.toLocaleString()}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-rose-400 shrink-0" />
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
              className="flex"
            >
              <Card className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between w-full">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.payrollLiability}</span>
                  <p className="text-lg font-bold text-blue-600 font-mono mt-1">₦{totalPayroll_liability.toLocaleString()}</p>
                </div>
                <Briefcase className="h-8 w-8 text-blue-400 shrink-0" />
              </Card>
            </motion.div>
          </div>

          {/* DUAL SECTION CHART AND RECENT TIMELINE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* INFLOWS OUTFLOWS AREA CHART */}
            <Card className="lg:col-span-8 p-5">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">{lang === 'en' ? 'Cash Flow Trends (Past 15 Days)' : 'Jadawalin Kudin Shiga da na Kashewa'}</h3>
              <p className="text-[10px] text-text-muted mt-0.5">Continuous visual ledger tracking for revenue vs operating costs.</p>
              
              <div className="h-72 mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mainChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <Tooltip formatter={(value) => [`₦${value.toLocaleString()}`]} />
                    <Area type="monotone" dataKey="Revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    <Area type="monotone" dataKey="Expense" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* COMPACT REAL-TIME TIMELINE */}
            <Card className="lg:col-span-4 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">{t.recentActivity}</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Live general ledger tracking feeds.</p>

                <div className="mt-4 flex flex-col gap-3 max-h-[280px] overflow-y-auto pr-1">
                  {combinedLedger.slice(0, 5).map((log, index) => {
                    const isRev = log.type === 'revenue';
                    return (
                      <div key={log.id || index} className="flex items-start gap-2.5 text-xs pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isRev ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {isRev ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{log.description}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-0.5 font-mono">
                            <span>{log.date}</span>
                            <span>•</span>
                            <span className="uppercase">{log.category}</span>
                          </div>
                        </div>
                        <span className={`font-mono font-bold shrink-0 ${isRev ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isRev ? '+' : '-'}₦{log.amount.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setSubTab('wallet')}
                className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-brand-gold text-xs font-bold rounded-lg text-center transition-colors cursor-pointer"
              >
                View Full Wallet Ledger
              </button>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ==============================================
          2. DRIVER PAYMENTS SUBTAB (SMART CORNER)
          ============================================== */}
      {subTab === 'payments' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          {/* HEADER & NAV */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                Driver Remittance Engine
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Manage operational lease payments and compliance across cycles.</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-end">
              <button
                onClick={() => setDriverView('remit')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${
                  driverView === 'remit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Remittance
              </button>
              <button
                onClick={() => setDriverView('compliance')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${
                  driverView === 'compliance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Compliance <Badge variant="danger" className="h-4 px-1 text-[8px] border-none ml-1">{pendingDrivers.length}</Badge>
              </button>
              <button
                onClick={() => setDriverView('history')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${
                  driverView === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                History
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {driverView === 'remit' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT PANEL: DRIVER LIST SELECT */}
                <Card className="lg:col-span-4 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Select Lease Driver</h3>
                    <div className="flex gap-1.5">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCyclePopupOpen(true)}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-brand-gold rounded-lg px-2.5 py-1 text-[9px] font-black focus:outline-none flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Choose Operational Lease Cycle"
                      >
                        <span>{formattedCycles.find(c => c.seqId === selectedCycle)?.label || `CYC 00${selectedCycle}`}</span>
                        <ChevronDown className="h-2.5 w-2.5 text-brand-gold shrink-0" />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setPendingCycleSelection(selectedCycle);
                          setIsInstallmentPopupOpen(true);
                        }}
                        className="bg-amber-500 border border-amber-600 hover:bg-amber-600 text-white rounded-lg px-2.5 py-1 text-[9px] font-black focus:outline-none flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Choose Installment"
                      >
                        <span>I#{selectedInstallment}</span>
                        <ChevronDown className="h-2.5 w-2.5 text-white shrink-0" />
                      </motion.button>
                    </div>
                  </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.searchDriver}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>

            <div className="flex flex-col gap-1.5 max-h-[460px] overflow-y-auto pr-1">
              {drivers
                .filter(d => d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || (d.company_driver_id && d.company_driver_id.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((d, idx) => {
                  const isSelected = selectedDriverId === d.id;
                  return (
                    <button
                      key={`${d.id}-${idx}`}
                      onClick={() => {
                        setSelectedDriverId(d.id);
                        setPayAmountInput('');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        isSelected 
                          ? 'bg-slate-900 border-slate-900 text-brand-gold shadow-md' 
                          : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                        <img 
                          src={d.passport_photo_url || d.passportPhoto || d.passport_photo || d.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'} 
                          alt="" 
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs truncate">{d.fullName}</p>
                        <p className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-slate-300' : 'text-text-muted'}`}>
                          {d.company_driver_id || 'PENDING'}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </div>
          </Card>

          {/* RIGHT PANEL: DYNAMIC INTERACTIVE CONSOLE */}
          <Card className="lg:col-span-8 p-5">
            {!matchedDriver ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                <Calculator className="h-12 w-12 text-slate-300 stroke-1 mb-3" />
                <h3 className="font-extrabold text-slate-700 text-sm">No Driver Selected</h3>
                <p className="text-xs text-text-muted max-w-xs mt-1">Select an active leasing driver from the side list to open the automated payment engine console.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* DRIVER MINI 360 BLOCK */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full border border-slate-200 overflow-hidden bg-slate-100 shrink-0">
                      <img 
                        src={matchedDriver.passport_photo_url || matchedDriver.passportPhoto || matchedDriver.passport_photo || matchedDriver.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'} 
                        alt="" 
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{matchedDriver.fullName}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-0.5 font-mono">
                        <span>ID: {matchedDriver.company_driver_id || 'PENDING'}</span>
                        <span>•</span>
                        <span>{matchedDriver.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 font-mono text-[10px]">
                    <span className="text-text-muted font-bold uppercase">Assigned Tricycle</span>
                    <Badge variant="outline" className="border-slate-300 font-bold bg-white text-slate-900">
                      {matchedDriver.assignedVehicleId || 'V-7789 Kano'}
                    </Badge>
                  </div>
                </div>

                {/* AUTOMATED FINANCIAL METRICS LEDGER */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Agreed 30 Cycle Amount to Bring to Company</span>
                    <p className="text-md font-bold text-slate-900 font-mono mt-1">₦{agreedAmount.toLocaleString()}</p>
                    <span className="text-[9px] text-text-muted block mt-1">6 installments of ₦{(agreedAmount/6).toLocaleString()}</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Current Installment due</span>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-md font-bold text-slate-900 font-mono">₦{installmentDue.toLocaleString()}</p>
                      <Badge variant="primary" className="font-mono text-[9px]">Cycle #{currentInstallmentNumber}</Badge>
                    </div>
                    <span className="text-[9px] text-text-muted block mt-1">Due every 5 operational days</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Paid this installment</span>
                    <p className="text-md font-bold text-emerald-600 font-mono mt-1">₦{totalInstallmentPaymentsPaid.toLocaleString()}</p>
                    <span className="text-[9px] text-text-muted block mt-1">Remaining: ₦{remainingInstallmentBalance.toLocaleString()}</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.driverWallet}</span>
                    <p className="text-md font-bold text-blue-600 font-mono mt-1">₦{driverWalletBalance.toLocaleString()}</p>
                    <span className="text-[9px] text-text-muted block mt-1">Overpayments and credit balances</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Outstanding Vehicle Balance</span>
                    <p className="text-md font-bold text-rose-600 font-mono mt-1">₦{outstandingVehicleBalance.toLocaleString()}</p>
                    <span className="text-[9px] text-text-muted block mt-1">Amortized capital lease debt</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Outstanding Carry-forward Debt</span>
                    <p className="text-md font-bold text-slate-700 font-mono mt-1">₦{driverOutstandingDebt.toLocaleString()}</p>
                    <span className="text-[9px] text-text-muted block mt-1">Arrears from past installments</span>
                  </div>
                </div>

                {/* INTERACTIVE PAYMENT INPUT & REAL-TIME CALCULATOR ENGINE */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Post Remittance Transaction</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* INPUT FORM (LEFT) */}
                    <div className="md:col-span-7 flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-extrabold text-slate-700">Amount Received (₦)</label>
                        <input
                          type="number"
                          placeholder="Example: 40000"
                          value={payAmountInput}
                          onChange={(e) => setPayAmountInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-extrabold text-slate-700">{t.receiptNumber}</label>
                        <input
                          type="text"
                          placeholder="Example: RQL-90812"
                          value={payReceiptInput}
                          onChange={(e) => setPayReceiptInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-extrabold text-slate-700">Transaction Remarks</label>
                        <input
                          type="text"
                          placeholder="Optional notes..."
                          value={payRemarksInput}
                          onChange={(e) => setPayRemarksInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold"
                        />
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          if (!payAmountInput || !payReceiptInput) {
                            alert(lang === 'en' ? "Please complete amount and receipt number fields." : "Da fatan za a cika kudi da lambar rasit.");
                            return;
                          }
                          setIsConfirmPaymentOpen(true);
                        }}
                        className="mt-2 w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs border-none"
                      >
                        Submit for Verification
                      </Button>
                    </div>

                    {/* DYNAMIC CALCULATOR SCREEN (RIGHT) */}
                    <div className="md:col-span-5 bg-slate-900 text-slate-200 p-4 rounded-xl shadow-lg border border-slate-800 flex flex-col justify-between h-full min-h-[260px]">
                      <div>
                        <div className="flex items-center gap-1 text-brand-gold text-[10px] font-black uppercase tracking-widest border-b border-slate-800 pb-2 mb-3">
                          <Calculator className="h-4.5 w-4.5 text-brand-gold" />
                          <span>Real-time Ledger Allocator</span>
                        </div>

                        {incomingCash <= 0 ? (
                          <div className="text-[11px] text-slate-400 text-center py-10">
                            Enter an incoming cash amount to view dynamic allocation splits.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cash Received:</span>
                              <span className="text-brand-gold font-bold">₦{incomingCash.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between border-t border-slate-800/60 pt-2">
                              <span className="text-slate-400">Installment Credit:</span>
                              <span className="text-emerald-400 font-bold">
                                ₦{Math.min(incomingCash, remainingInstallmentBalance).toLocaleString()}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-400">Overpayment Credit:</span>
                              <span className="text-blue-400 font-bold">₦{driverWalletIncrease.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-400">Remaining Installment:</span>
                              <span className="text-slate-200">₦{remainingInstallmentAfterPay.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between border-t border-slate-800/60 pt-2">
                              <span className="text-slate-400">Amortization reduction:</span>
                              <span className="text-rose-400">₦{incomingCash.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-400">Expected status:</span>
                              <Badge variant={expectedInstallmentStatus === 'paid' ? 'success' : 'warning'}>
                                {expectedInstallmentStatus?.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-[9px] text-slate-500 border-t border-slate-800 pt-2 mt-4">
                        * Allocations comply with Ruqayya ERP bylaws regarding automatic overpayment ledger distribution.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : driverView === 'compliance' ? (
              <motion.div
                key="compliance-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Incomplete Remittance Cycle</h4>
                    <p className="text-[11px] text-amber-700 font-medium mt-1 leading-relaxed">
                      The following drivers have <span className="font-black underline decoration-amber-300">not recorded</span> any payments for 
                      <span className="font-black"> {formattedCycles.find(c => c.seqId === selectedCycle)?.label || `CYC 00${selectedCycle}`}, Installment #{selectedInstallment}</span>. Automated alerts can be dispatched via the driver portal.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingDrivers.map((d, index) => (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-amber-200 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                          {d.fullName?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 leading-tight">{d.fullName}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{d.company_driver_id || d.id}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-[9px] font-black uppercase border-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-4 rounded-xl"
                        onClick={() => {
                          setSelectedDriverId(d.id);
                          setDriverView('remit');
                        }}
                      >
                        Action
                      </Button>
                    </motion.div>
                  ))}
                  {pendingDrivers.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="h-8 w-8 stroke-[3]" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Full Compliance</h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">All active drivers have fulfilled obligations for the selected period.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="history-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
                        <th className="p-5">Driver Identity</th>
                        <th className="p-5">Ledger Context</th>
                        <th className="p-5 text-right">Amount Paid</th>
                        <th className="p-5">System Date</th>
                        <th className="p-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {localAuditLogs
                        .filter(l => l.action === 'DRIVER_REMITTANCE')
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((log, index) => (
                          <tr key={log.id || index} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="p-5">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900">{log.description.split(' from ')[1]?.split(' (')[0] || 'Driver Asset'}</span>
                                <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter mt-0.5">{log.userId}</span>
                              </div>
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-2">
                                <Badge variant="primary" className="text-[8px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-none">CYC {log.description.match(/Cycle #(\d+)/)?.[1] || '?'}</Badge>
                                <Badge variant="neutral" className="text-[8px] px-2 py-0.5 bg-slate-100 text-slate-600 border-none uppercase">INST {log.description.match(/Inst. #(\d+)/)?.[1] || '?'}</Badge>
                              </div>
                            </td>
                            <td className="p-5 text-right font-black font-mono text-emerald-600 text-sm">
                              ₦{log.amount?.toLocaleString() || '0'}
                            </td>
                            <td className="p-5 text-slate-500 font-bold text-[10px]">
                              {new Date(log.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase tracking-widest">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Verified
                              </div>
                            </td>
                          </tr>
                        ))}
                      {localAuditLogs.filter(l => l.action === 'DRIVER_REMITTANCE').length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-20 text-center text-slate-400 bg-slate-50/50">
                            <History className="h-10 w-10 mx-auto mb-4 opacity-20" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest">No Remittance History Found</h4>
                            <p className="text-[10px] font-medium mt-1">Begin posting driver payments to populate the ledger history.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ==============================================
          3. COMPANY WALLET (GENERAL LEDGER) SUBTAB
          ============================================== */}
      {subTab === 'wallet' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          {/* BIG WALLET COMPONENT */}
          <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-gold text-slate-950 rounded-xl shadow-lg shrink-0">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t.companyWallet}</span>
                <p className="text-3xl font-black text-brand-gold font-mono mt-0.5">₦{companyWalletBalance.toLocaleString()}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                  <span>Inflows: ₦{totalRevenue.toLocaleString()}</span>
                  <span>•</span>
                  <span>Outflows: ₦{totalExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 font-mono text-xs text-right">
              <span className="text-slate-400 uppercase font-bold text-[9px]">Account status</span>
              <Badge variant="success">ACTIVE & SECURED</Badge>
            </div>
          </div>

          {/* LEDGER TRANSACTION LIST */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Cash Ledger Statements</h3>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>

                {/* Category select */}
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">{t.allCategories}</option>
                  <option value="remittance">Remittances</option>
                  <option value="salary">Wages & Payroll</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="fuel">Fuel Spends</option>
                  <option value="other">Other Accounts</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Reference ID</th>
                    <th className="p-3">Transaction Description</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Credit / Debit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-text-muted font-sans">
                        No transactions match filter configurations.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((item, index) => {
                      const isRev = item.type === 'revenue';
                      return (
                        <tr key={item.id || index} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900 truncate max-w-[120px]">{item.id}</td>
                          <td className="p-3 font-sans font-medium text-slate-800">{item.description}</td>
                          <td className="p-3 text-slate-600">{item.date}</td>
                          <td className="p-3">
                            <Badge variant={item.category === 'remittance' ? 'success' : item.category === 'salary' ? 'primary' : 'warning'}>
                              {item.category?.toUpperCase()}
                            </Badge>
                          </td>
                          <td className={`p-3 text-right font-bold font-mono text-sm ${isRev ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isRev ? '+' : '-'}₦{item.amount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ==============================================
          4. EXPENSES MANAGEMENTS SUBTAB
          ============================================== */}
      {subTab === 'expenses' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* LEFT: LOG EXPENSE FORM */}
          <Card className="lg:col-span-5 p-5 h-fit">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">{t.recordExp}</h3>
            
            <form onSubmit={handleRecordExpenseSubmit} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                >
                  <option value="maintenance">{t.maintenance}</option>
                  <option value="office">{t.office}</option>
                  <option value="electricity">{lang === 'en' ? 'Electricity Power' : 'Kudin Wuta'}</option>
                  <option value="fuel">{t.fuel}</option>
                  <option value="legal">{t.legal}</option>
                  <option value="bankCharges">{t.bankCharges}</option>
                  <option value="other">{t.miscellaneous}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Amount Spent (₦)</label>
                <input
                  type="number"
                  placeholder="Example: 50000"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">{t.receiptNumber}</label>
                <input
                  type="text"
                  placeholder="Example: INV-88712"
                  value={expReceiptNo}
                  onChange={(e) => setExpReceiptNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Spend Description</label>
                <textarea
                  placeholder="What was this expense for?"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold h-20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Associated Tricycle Driver (Optional)</label>
                <select
                  value={expDriverId}
                  onChange={(e) => setExpDriverId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                >
                  <option value="">-- No Association --</option>
                  {drivers.map((d, idx) => (
                    <option key={`${d.id}-${idx}`} value={d.id}>{d.fullName}</option>
                  ))}
                </select>
              </div>

              {expError && <Alert variant="danger">{expError}</Alert>}
              {expSuccess && <Alert variant="success">{expSuccess}</Alert>}

              <Button
                type="submit"
                variant="primary"
                className="w-full font-bold bg-rose-600 hover:bg-rose-700 text-white py-2 text-xs border-none"
              >
                Post Ledger Expense
              </Button>
            </form>
          </Card>

          {/* RIGHT: EXPENSE LOG RECORDS HISTORY */}
          <Card className="lg:col-span-7 p-5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Operational Expenditures History</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Reference ID</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {finance.filter(f => f.type === 'expense').length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-text-muted font-sans">
                        No expense logs found.
                      </td>
                    </tr>
                  ) : (
                    finance
                      .filter(f => f.type === 'expense')
                      .slice(0, 15)
                      .map((f, index) => (
                        <tr key={f.id || index} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900">{f.id}</td>
                          <td className="p-3">
                            <Badge variant="danger">{f.category?.toUpperCase()}</Badge>
                          </td>
                          <td className="p-3 font-sans font-medium text-slate-800">{f.description}</td>
                          <td className="p-3 text-right font-bold font-mono text-rose-600">
                            -₦{f.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ==============================================
          5. SHAREHOLDER CENTER SUBTAB (WITHDRAW/REINVEST)
          ============================================== */}
      {subTab === 'shareholders' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          {/* GENERAL SHAREHOLDER POOL CARD */}
          <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t.dividendsPool}</span>
              <p className="text-3xl font-black text-brand-gold font-mono mt-0.5">₦{continuousDividendPool.toLocaleString()}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Accrued automatically on real-time net generated income.</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Equities Registered</span>
              <p className="text-3xl font-black text-slate-200 font-mono mt-0.5">₦{totalInvestmentsSum.toLocaleString()}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Paid-up capital seed reserves.</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Shareholders Registered</span>
              <p className="text-3xl font-black text-slate-200 font-mono mt-0.5">{localShareholders.length}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Bylaw validated board directors.</span>
            </motion.div>
          </div>

          {/* VIEW TOGGLE, ADD BUTTON, AND INSIGHTS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setShSubView('roster')}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    shSubView === 'roster' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Investment Roster
                </button>
                <button
                  onClick={() => setShSubView('history')}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    shSubView === 'history' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  Action History
                </button>
              </div>

              {shSubView === 'roster' && (
                <Button
                  variant="primary"
                  onClick={openAddShareholder}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm shrink-0 w-full sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Shareholder
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 w-full sm:w-auto overflow-hidden relative group">
              <div className="absolute inset-0 bg-emerald-100/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
              <TrendingUp className="h-4 w-4 relative z-10" />
              <span className="text-xs font-black relative z-10">Active Equity Yielding: {distributionPercentage}% Growth</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {shSubView === 'roster' ? (
              localShareholders.length === 0 ? (
                <motion.div
                  key="empty-roster"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300 max-w-2xl mx-auto my-6"
                >
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-lg mb-2">Investment Roster is Empty</h3>
                  <p className="text-slate-500 text-xs max-w-md mb-6 leading-relaxed">
                    No board directors or corporate investors are registered yet in this operating cycle. Registering a shareholder initializes their dynamic earnings ledger and automatically calculates their equity stake real-time based on their Capital Stock.
                  </p>
                  <Button
                    variant="primary"
                    onClick={openAddShareholder}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    Add First Shareholder
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="roster"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {localShareholders.map((sh, idx) => {
                    const weightStake = totalInvestmentsSum > 0 ? (((sh.investment_amount || 0) / totalInvestmentsSum) * 100) : 0;
                    const estimatedEarnings = continuousDividendPool * (weightStake / 100);
                    const shTotalWithdrawn = sh.total_withdrawn || 0;
                    const availableWithdrawable = Math.max(0, estimatedEarnings - shTotalWithdrawn);
                    const shTotalReinvested = sh.total_reinvested || 0;

                    return (
                      <motion.div
                        key={sh.id || idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group"
                      >
                        <Card className="p-0 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-slate-200/60 h-full flex flex-col">
                          {/* Header Section */}
                          <div className="p-5 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 relative overflow-hidden">
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                              <Badge variant={availableWithdrawable > 0 ? 'success' : 'neutral'} className="font-mono text-[9px] font-black uppercase">
                                {weightStake.toFixed(2)}% Stake
                              </Badge>
                              <button
                                onClick={() => openEditShareholder(sh)}
                                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-all shadow-sm"
                                title="Edit Shareholder"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-2xl border-2 border-white shadow-lg overflow-hidden shrink-0 bg-slate-900 group-hover:rotate-3 transition-transform duration-500">
                                <img 
                                  src={sh.passport_photo_url || sh.passportPhoto || sh.passport_photo || sh.passport || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'} 
                                  alt={sh.full_name} 
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 text-sm tracking-tight">{sh.full_name}</h4>
                                <p className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">{sh.email}</p>
                              </div>
                            </div>
                          </div>

                          {/* Metrics Section */}
                          <div className="p-5 flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Capital Stock</label>
                                <p className="text-sm font-bold text-slate-900 font-mono">₦{(sh.investment_amount || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Accumulated</label>
                                <p className="text-sm font-bold text-emerald-600 font-mono">₦{estimatedEarnings.toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="p-4 bg-slate-900 rounded-2xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-brand-gold/10 rounded-full blur-2xl -mr-8 -mt-8" />
                              <label className="text-[9px] font-black text-brand-gold uppercase tracking-widest block mb-1">Available Dividend</label>
                              <p className="text-xl font-black text-white font-mono">₦{availableWithdrawable.toLocaleString()}</p>
                            </div>

                            {/* Passport and Phone Information */}
                            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Passport No</span>
                                <span className="text-[11px] font-bold text-slate-700 font-mono">{(sh as any).passport_number || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Phone</span>
                                <span className="text-[11px] font-bold text-slate-700">{sh.phone || 'N/A'}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-mono text-[10px]">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Reinvested</span>
                                <span className="text-[11px] font-bold text-slate-700 font-mono">₦{shTotalReinvested.toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Withdrawn</span>
                                <span className="text-[11px] font-bold text-slate-700 font-mono">₦{shTotalWithdrawn.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions Section */}
                          <div className="p-4 bg-slate-50 grid grid-cols-2 gap-2">
                            <Button
                              variant="primary"
                              disabled={availableWithdrawable <= 0}
                              onClick={() => {
                                setActiveShareholder(sh);
                                setIsWithdrawOpen(true);
                              }}
                              className="w-full font-black bg-brand-gold hover:bg-amber-500 text-slate-900 py-2.5 text-[10px] uppercase border-none shadow-sm h-auto"
                            >
                              Withdraw
                            </Button>

                            <Button
                              variant="outline"
                              disabled={availableWithdrawable <= 0}
                              onClick={() => {
                                setActiveShareholder(sh);
                                setIsReinvestOpen(true);
                              }}
                              className="w-full font-black border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white py-2.5 text-[10px] uppercase h-auto"
                            >
                              Reinvest
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )
            ) : (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="p-0 overflow-hidden border-slate-200/60">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Transaction Ledger</h3>
                    <Badge variant="default" className="font-mono text-[9px]">
                      {localAuditLogs.filter(l => l.category === 'shareholder').length} Records
                    </Badge>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead>
                        <tr className="bg-white text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                          <th className="p-4">Action</th>
                          <th className="p-4">Shareholder</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Timestamp</th>
                          <th className="p-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {localAuditLogs
                          .filter(log => log.category === 'shareholder' || log.action?.includes('withdrawal') || log.action?.includes('reinvest'))
                          .map((log, lidx) => (
                            <motion.tr 
                              key={log.id || lidx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: lidx * 0.03 }}
                              className="hover:bg-slate-50/50"
                            >
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className={`h-2 w-2 rounded-full ${log.action?.includes('withdrawal') ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  <span className="font-extrabold uppercase text-[10px] tracking-tight">{log.action || 'Transaction'}</span>
                                </div>
                              </td>
                              <td className="p-4 font-bold text-slate-900">
                                {localShareholders.find(s => s.id === log.shareholder_id)?.full_name || log.user_name || 'System Admin'}
                              </td>
                              <td className={`p-4 font-black font-mono ${log.action?.includes('withdrawal') ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ₦{log.amount?.toLocaleString() || '0'}
                              </td>
                              <td className="p-4 text-slate-500 font-medium">
                                {new Date(log.timestamp || log.created_at).toLocaleString()}
                              </td>
                              <td className="p-4">
                                <Badge variant="success" className="text-[9px] uppercase font-black">Verified</Badge>
                              </td>
                            </motion.tr>
                          ))}
                        
                        {localAuditLogs.filter(log => log.category === 'shareholder' || log.action?.includes('withdrawal') || log.action?.includes('reinvest')).length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">
                              <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                              <p>No shareholder transactions detected in current ledger cycle.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ==============================================
          6. AUTOMATED TEAM PAYROLL SUBTAB
          ============================================== */}
      {subTab === 'payroll' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* LEFT COLUMN: SALARY METRICS & ACTIVE TRICYCLES ACTIVITY LOG TRACKING */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* PAYROLL CARD EXPLAINER */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="h-5 w-5 text-slate-900" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Salary Management</h3>
                </div>
                
                <p className="text-xs text-slate-700 leading-relaxed mb-4">
                  Ruqayya Transport Limited ERP calculates personnel wages automatically based on the count of **active leasing tricycles** extracted from 30-day activity logs. This guarantees staff salary scaling with operating volume.
                </p>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 font-mono text-xs flex flex-col gap-2.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Total Tricycles Fleet:</span>
                    <span className="font-bold text-slate-900">{vehicles.length} Units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Active Cycle Tricycles (Logs):</span>
                    <span className="font-bold text-slate-900">{activeTricyclesCount} Units</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-2 text-sm">
                    <span className="text-slate-800 font-extrabold">Next Payroll Total:</span>
                    <span className="font-black text-slate-900">₦{totalPayroll_liability.toLocaleString()}</span>
                  </div>
                </div>

                {payrollError && <Alert variant="danger" className="mb-4">{payrollError}</Alert>}
                {payrollSuccess && <Alert variant="success" className="mb-4">{payrollSuccess}</Alert>}
              </div>

              <Button
                variant="primary"
                disabled={payrollLoading}
                onClick={handleProcessPayroll}
                className="w-full font-bold bg-slate-900 hover:bg-slate-800 text-brand-gold py-2 text-xs border-none"
              >
                {payrollLoading ? "Disbursing..." : t.processPayroll}
              </Button>
            </Card>

            {/* ACTIVE TRICYCLES TRACKER (Keke Activity Monitor) */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Keke Activity Monitor</h3>
                  <p className="text-[10px] text-text-muted mt-0.5">Verified active in current 30-day cycle</p>
                </div>
                <Badge variant="success" className="font-mono text-[10px] font-bold">
                  {activeTricyclesCount} Active
                </Badge>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {activeTricyclesList.length === 0 ? (
                  <div className="text-center py-6 text-text-muted text-xs">
                    No tricycle activity logged in this 30-day cycle.
                  </div>
                ) : (
                  activeTricyclesList.map((v, idx) => (
                    <motion.div
                      key={`${v.id}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-xl flex flex-col gap-1.5 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-900">{v.plateNumber}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-200/60 text-slate-800 rounded font-bold uppercase">{v.model}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-text-muted">
                        <span>Route: <strong className="text-slate-800 font-semibold">{v.route}</strong></span>
                        <span className="font-mono">{v.date}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono flex items-center justify-between mt-0.5 pt-1 border-t border-slate-200/40">
                        <span>Manifest: {v.lastTrip}</span>
                        <span className="text-green-600 flex items-center gap-1 font-bold">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                          Logged Active
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* SALARY DISBURSAL ANALYTICS GRID */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <div className="h-4 w-1 bg-brand-gold rounded-full" />
                  Salary Disbursal Analytics
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-1">Real-time operational payroll liabilities across management tiers.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setPayrollSubView('analytics')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${
                    payrollSubView === 'analytics' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Trello className="h-3 w-3" />
                  Analytics
                </button>
                <button
                  onClick={() => setPayrollSubView('history')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${
                    payrollSubView === 'history' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <History className="h-3 w-3" />
                  Ledger
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {payrollSubView === 'analytics' ? (
                <motion.div
                  key="payroll-analytics"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'legal', name: "Barrister Legal Officer", rate: 1000, computed: barristerSal, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                      { id: 'gm', name: "General Manager", rate: 500, computed: managerSal, icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                      { id: 'payroll', name: "Admin Adam (Payroll Officer)", rate: 1000, computed: adamSal, icon: Receipt, color: 'text-brand-gold', bg: 'bg-amber-50', border: 'border-amber-100' },
                      { id: 'logistics', name: "Admin Abakaka (Logistics Manager)", rate: 1000, computed: abakakaSal, icon: Truck, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' }
                    ].map((role, ridx) => {
                      const Icon = role.icon;
                      const percentage = totalPayroll_liability > 0 ? (role.computed / totalPayroll_liability) * 100 : 25;
                      
                      return (
                        <motion.div
                          key={role.id}
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: ridx * 0.05, type: 'spring', stiffness: 100 }}
                          className="group"
                        >
                          <Card className="p-0 overflow-hidden border-slate-200/60 hover:shadow-2xl transition-all duration-300 h-full flex flex-col bg-white">
                            <div className="p-4 sm:p-5 flex items-start gap-4 flex-1">
                              <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl ${role.bg} ${role.color} flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-6 transition-transform`}>
                                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0">
                                    <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">{role.name}</h4>
                                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase mt-0.5">Management Tier</p>
                                  </div>
                                  <Badge variant="default" className="text-[8px] sm:text-[9px] font-black font-mono shrink-0">
                                    {percentage.toFixed(0)}%
                                  </Badge>
                                </div>
                                
                                <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                                  <div className="space-y-1">
                                    <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest block">Operational Payout</span>
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-lg sm:text-xl font-black text-slate-950 font-mono tracking-tight">₦{role.computed.toLocaleString()}</span>
                                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">/ 30d</span>
                                    </div>
                                  </div>
                                  <div className="text-right self-end sm:self-auto">
                                    <div className="px-2 py-1 bg-slate-100 rounded-lg inline-block border border-slate-200/50">
                                      <span className="text-[9px] font-bold text-slate-700 font-mono">₦{role.rate.toLocaleString()} × {activeTricyclesCount}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="h-1 w-full bg-slate-100 overflow-hidden mt-auto">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ delay: 0.3 + (ridx * 0.1), duration: 1, ease: "circOut" }}
                                className={`h-full ${role.id === 'legal' ? 'bg-indigo-500' : role.id === 'gm' ? 'bg-emerald-500' : role.id === 'payroll' ? 'bg-amber-500' : 'bg-rose-500'}`}
                              />
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-5 sm:p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-brand-gold/10 transition-colors duration-1000" />
                    
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                      <div className="flex items-center gap-4 text-center sm:text-left">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner backdrop-blur-sm">
                          <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-brand-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white tracking-tight">Aggregate Operational Liability</p>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-1">
                            Calculated across <span className="text-brand-gold font-bold">{activeTricyclesCount} active asset units</span>.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
                        <div className="text-center sm:text-right">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total 30-Day Liability</span>
                          <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tighter">₦{totalPayroll_liability.toLocaleString()}</span>
                        </div>
                        <Button
                          variant="primary"
                          disabled={payrollLoading || totalPayroll_liability <= 0}
                          onClick={handleProcessPayroll}
                          className="w-full sm:w-auto font-black bg-brand-gold hover:bg-amber-500 text-slate-950 px-8 py-3 rounded-2xl shadow-[0_8px_16px_rgba(212,175,55,0.2)] hover:shadow-[0_12px_24px_rgba(212,175,55,0.3)] transition-all h-auto uppercase tracking-widest text-[11px] border-none"
                        >
                          {payrollLoading ? 'Processing...' : 'Disburse Payroll'}
                        </Button>
                      </div>
                    </div>
                    
                    {payrollSuccess && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-emerald-400 text-[10px] font-bold uppercase tracking-widest">{payrollSuccess}</motion.p>
                    )}
                    {payrollError && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-rose-400 text-[10px] font-bold uppercase tracking-widest">{payrollError}</motion.p>
                    )}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="payroll-history"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
                >
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Disbursement Ledger</span>
                    <Badge variant="default" className="font-mono text-[9px]">{localAuditLogs.filter(l => l.category === 'payroll').length} Records</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
                          <th className="p-4">Recipient Role</th>
                          <th className="p-4 text-right">Amount</th>
                          <th className="p-4">Timestamp</th>
                          <th className="p-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {localAuditLogs
                          .filter(log => log.category === 'payroll' || log.action === 'SALARY_DISBURSEMENT')
                          .map((log, lidx) => (
                            <tr key={log.id || lidx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  <span className="font-bold text-slate-900">{log.description.split('to ')[1] || 'Staff Member'}</span>
                                </div>
                              </td>
                              <td className="p-4 text-right font-black font-mono text-emerald-600">
                                ₦{log.amount?.toLocaleString() || '0'}
                              </td>
                              <td className="p-4 text-slate-500 font-medium text-[10px]">
                                {new Date(log.timestamp || log.created_at).toLocaleString()}
                              </td>
                              <td className="p-4">
                                <Badge variant="success" className="text-[8px] uppercase font-black py-0.5">Disbursed</Badge>
                              </td>
                            </tr>
                          ))}
                        {localAuditLogs.filter(log => log.category === 'payroll' || log.action === 'SALARY_DISBURSEMENT').length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-12 text-center text-slate-400">
                              <History className="h-8 w-8 mx-auto mb-3 opacity-20" />
                              <p className="text-[10px] font-medium uppercase tracking-widest">No payroll transactions found.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ==============================================
          7. FINANCIAL STATEMENTS & REPORTS (PRINT FRIENDLY)
          ============================================== */}
      {subTab === 'reports' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          <ReportCenter
            lang={lang}
            drivers={drivers}
            vehicles={vehicles}
            finance={finance}
            payments={payments}
            shareholders={shareholders || []}
            onSync={onSync}
          />
        </motion.div>
      )}

      {/* ==============================================
          8. AUDIT HISTORY TIMELINE SUBTAB
          ============================================== */}
      {subTab === 'audit' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Card className="p-5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Corporate Audit Timeline Log</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Administrator/Actor</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Action Event</th>
                    <th className="p-3">Details Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {localAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-text-muted font-sans">
                        No corporate audit histories found.
                      </td>
                    </tr>
                  ) : (
                    localAuditLogs.slice(0, 30).map((log, index) => (
                      <tr key={log.id || index} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3 font-sans font-bold text-slate-800">{log.userId}</td>
                        <td className="p-3">
                          <Badge variant={log.userRole === 'director' ? 'primary' : 'outline'}>
                            {log.userRole?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3 font-black text-slate-900">{log.action}</td>
                        <td className="p-3 font-sans text-slate-600 max-w-sm truncate">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ==============================================
          MODAL: DRIVER PAYMENT CONFIRMATION SUMMARY
          ============================================== */}
      <Modal
        isOpen={isConfirmPaymentOpen}
        onClose={() => setIsConfirmPaymentOpen(false)}
        title="Verify Remittance Parameters"
      >
        <div className="flex flex-col gap-4 text-xs font-mono">
          <Alert variant="warning" className="flex items-start gap-2 text-slate-800">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="font-sans">
              Verify receipt figures before confirming. This ledger entry will instantly update the company general cash pool and adjust driver loan parameters.
            </span>
          </Alert>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5">
            <div className="flex justify-between font-sans">
              <span className="text-text-muted font-bold">Lease Driver:</span>
              <span className="font-black text-slate-900">{matchedDriver?.fullName}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-text-muted">Target Period:</span>
              <span className="font-black text-emerald-600">{formattedCycles.find(c => c.seqId === selectedCycle)?.label || `CYC 00${selectedCycle}`} — Inst. #{selectedInstallment}</span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>Required installment due:</span>
              <span>₦{installmentDue.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-slate-800">
              <span>Remaining balance due:</span>
              <span>₦{remainingInstallmentBalance.toLocaleString()}</span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-emerald-600 text-sm">
              <span>Remittance Received:</span>
              <span>₦{incomingCash.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-slate-800">
              <span>New Installment balance:</span>
              <span>₦{remainingInstallmentAfterPay.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-blue-600 font-bold">
              <span>Deposited to Driver's Credits Wallet:</span>
              <span>₦{driverWalletIncrease.toLocaleString()}</span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 text-rose-600">
              <span>New outstanding lease balance:</span>
              <span>₦{remainingVehicleBalanceAfterPay.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 mt-4 font-sans">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmPaymentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRecordPaymentConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
            >
              Confirm & Post Ledger
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==============================================
          MODAL: RECORD OPERATIONAL EXPENSE
          ============================================== */}
      <Modal
        isOpen={isRecordExpenseOpen}
        onClose={() => setIsRecordExpenseOpen(false)}
        title={t.recordExp}
      >
        <form onSubmit={handleRecordExpenseSubmit} className="flex flex-col gap-4 text-xs">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Expense Category</label>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
            >
              <option value="maintenance">{t.maintenance}</option>
              <option value="office">{t.office}</option>
              <option value="electricity">{lang === 'en' ? 'Electricity Power' : 'Kudin Wuta'}</option>
              <option value="fuel">{t.fuel}</option>
              <option value="legal">{t.legal}</option>
              <option value="bankCharges">{t.bankCharges}</option>
              <option value="other">{t.miscellaneous}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Amount Spent (₦)</label>
            <input
              type="number"
              placeholder="Example: 50000"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">{t.receiptNumber}</label>
            <input
              type="text"
              placeholder="Example: INV-88712"
              value={expReceiptNo}
              onChange={(e) => setExpReceiptNo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Spend Description</label>
            <textarea
              placeholder="What was this expense for?"
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold h-20"
            />
          </div>

          {expError && <Alert variant="danger">{expError}</Alert>}
          {expSuccess && <Alert variant="success">{expSuccess}</Alert>}

          <div className="flex justify-end gap-2.5 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRecordExpenseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-rose-600 hover:bg-rose-700 text-white border-none"
            >
              Post Ledger Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==============================================
          MODAL: ADD / EDIT SHAREHOLDER (WITH PASSPORT)
          ============================================== */}
      <Modal
        isOpen={isAddEditShareholderOpen}
        onClose={() => {
          setIsAddEditShareholderOpen(false);
          setEditingShareholder(null);
        }}
        title={editingShareholder ? (lang === 'en' ? "Edit Shareholder Profile" : "Gyara Bayanan Mai Hannun Jari") : (lang === 'en' ? "Register Corporate Shareholder" : "Yi Rajistar Mai Hannun Jari")}
      >
        <form onSubmit={handleAddEditShareholderSubmit} className="flex flex-col gap-4 text-xs">
          {shFormError && <Alert variant="danger">{shFormError}</Alert>}
          {shFormSuccess && <Alert variant="success">{shFormSuccess}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">{lang === 'en' ? "Full Name" : "Cikakken Suna"} *</label>
              <input
                type="text"
                required
                placeholder={lang === 'en' ? "e.g. Alhaji Hassan Aminu" : "Misali Alhaji Hassan Aminu"}
                value={shFormFullName}
                onChange={(e) => setShFormFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">{lang === 'en' ? "Phone Number" : "Lambar Waya"} *</label>
              <input
                type="tel"
                required
                placeholder="e.g. +234 803 123 4567"
                value={shFormPhone}
                onChange={(e) => setShFormPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">{lang === 'en' ? "Email Address" : "Adireshin Imel"} *</label>
              <input
                type="email"
                required
                placeholder="e.g. hassan@example.com"
                value={shFormEmail}
                onChange={(e) => setShFormEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">{lang === 'en' ? "Passport Number" : "Lambar Fasfot"} *</label>
              <input
                type="text"
                required
                placeholder="e.g. A01234567"
                value={shFormPassportNumber}
                onChange={(e) => setShFormPassportNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono uppercase"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">{lang === 'en' ? "Home/Office Address" : "Adireshin Gida/Ofis"}</label>
            <input
              type="text"
              placeholder={lang === 'en' ? "e.g. No 12 Airport Road, Kano" : "Misali No 12 Airport Road, Kano"}
              value={shFormAddress}
              onChange={(e) => setShFormAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">{lang === 'en' ? "Capital Stock / Investment (₦)" : "Jarin Hannun Jari (₦)"} *</label>
              <input
                type="number"
                required
                placeholder="e.g. 5000000"
                value={shFormInvestmentAmount}
                onChange={(e) => setShFormInvestmentAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">{lang === 'en' ? "Investment Date" : "Ranar Sanya Jari"}</label>
              <input
                type="date"
                value={shFormInvestmentDate}
                onChange={(e) => setShFormInvestmentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
            <label className="font-black text-[10px] text-slate-400 uppercase tracking-widest">{lang === 'en' ? "Shareholder Passport Photo" : "Hoton Fasfot Na Mai Hannun Jari"}</label>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="h-20 w-20 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-slate-900 shrink-0">
                {shFormPassportPhoto ? (
                  <img
                    src={shFormPassportPhoto}
                    alt="Passport Preview"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                    No Photo
                  </div>
                )}
              </div>
              
              <div className="flex-1 w-full space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleShFormFileChange}
                  className="block w-full text-[10px] text-slate-500
                    file:mr-4 file:py-1.5 file:px-3
                    file:rounded-lg file:border-0
                    file:text-[10px] file:font-bold
                    file:bg-slate-900 file:text-white
                    hover:file:bg-slate-800"
                />
                <p className="text-[9px] text-slate-400 leading-normal">
                  {lang === 'en' ? "Upload a JPG or PNG passport photo. Or click below to select a default premium preset image if a file is not handy." : "Sanya hoton JPG ko PNG. Ko latsa kasa domin zabar hoto na gaba daya."}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShFormPassportPhoto('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150')}
                    className="px-2 py-1 text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded"
                  >
                    Preset 1 (Male)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShFormPassportPhoto('https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150')}
                    className="px-2 py-1 text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded"
                  >
                    Preset 2 (Female)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShFormPassportPhoto('https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150')}
                    className="px-2 py-1 text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded"
                  >
                    Preset 3 (Male)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddEditShareholderOpen(false);
                setEditingShareholder(null);
              }}
              className="px-4 py-2 text-xs font-bold"
            >
              {lang === 'en' ? "Cancel" : "Soke"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={shFormLoading}
              className="bg-slate-900 hover:bg-slate-800 text-white border-none font-bold px-4 py-2 text-xs"
            >
              {shFormLoading ? (lang === 'en' ? "Saving..." : "Ana Ajiye...") : (lang === 'en' ? "Save Shareholder" : "Ajiye Mai Hannun Jari")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==============================================
          MODAL: WITHDRAW SHAREHOLDER DIVIDENDS
          ============================================== */}
      <Modal
        isOpen={isWithdrawOpen}
        onClose={() => {
          setIsWithdrawOpen(false);
          setActiveShareholder(null);
          setShActionError('');
          setShActionSuccess('');
        }}
        title={`Disburse Dividends: ${activeShareholder?.full_name}`}
      >
        <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span>Paid Equity Stake:</span>
              <span className="font-bold text-slate-900">₦{activeShareholder?.investment_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200/60 pt-1.5">
              <span>Total Withdrawn to Date:</span>
              <span className="font-bold text-slate-900">₦{(activeShareholder?.total_withdrawn || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Withdrawal Amount (₦)</label>
            <input
              type="number"
              placeholder="Enter amount to withdraw..."
              value={shActionAmount}
              onChange={(e) => setShActionAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Withdrawal Remarks</label>
            <input
              type="text"
              placeholder="Reason / payment reference..."
              value={shActionRemarks}
              onChange={(e) => setShActionRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>

          {shActionError && <Alert variant="danger">{shActionError}</Alert>}
          {shActionSuccess && <Alert variant="success">{shActionSuccess}</Alert>}

          <div className="flex justify-end gap-2.5 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsWithdrawOpen(false);
                setActiveShareholder(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-brand-gold hover:bg-brand-gold/90 text-slate-950 border-none font-bold"
            >
              Disburse Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==============================================
          MODAL: REINVEST SHAREHOLDER DIVIDENDS
          ============================================== */}
      <Modal
        isOpen={isReinvestOpen}
        onClose={() => {
          setIsReinvestOpen(false);
          setActiveShareholder(null);
          setShActionError('');
          setShActionSuccess('');
        }}
        title={`Reinvest Dividends: ${activeShareholder?.full_name}`}
      >
        <form onSubmit={handleReinvestSubmit} className="flex flex-col gap-4 text-xs">
          <Alert variant="warning" className="font-sans">
            Reinvesting dividends transfers the selected available cash directly into the shareholder's Capital Stock reserves, increasing their percentage ownership weight in the company instantly.
          </Alert>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Reinvestment Amount (₦)</label>
            <input
              type="number"
              placeholder="Enter amount to roll-over..."
              value={shActionAmount}
              onChange={(e) => setShActionAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold font-mono"
            />
          </div>

          {shActionError && <Alert variant="danger">{shActionError}</Alert>}
          {shActionSuccess && <Alert variant="success">{shActionSuccess}</Alert>}

          <div className="flex justify-end gap-2.5 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsReinvestOpen(false);
                setActiveShareholder(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-slate-900 hover:bg-slate-800 text-brand-gold border-none font-bold"
            >
              Confirm Rollover
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==============================================
          1. PREMIUM CYCLE SELECTOR POPUP MODAL
          ============================================== */}
      <AnimatePresence>
        {isCyclePopupOpen && (
          <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 overflow-hidden relative"
            >
              {/* Background gradient embellishment */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-gold/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-slate-100 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-5">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <span className="p-1.5 bg-slate-900 text-brand-gold rounded-lg shadow-sm">
                      <Layers className="h-4 w-4" />
                    </span>
                    Select Operational Lease Cycle
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Choose a leasing cycle to view installment schedules and track compliance.
                  </p>
                </div>
                <button
                  onClick={() => setIsCyclePopupOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Grid of Dynamic Cycles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 max-h-[360px] overflow-y-auto pr-1">
                {formattedCycles.map((cy) => {
                  const numStr = cy.seqId;
                  const isCurrent = cy.isCurrent;
                  const isCompleted = cy.status === 'completed';
                  
                  let statusLabel = "Upcoming / Locked";
                  let statusStyle = "bg-slate-50 text-slate-400 border-slate-200 opacity-60";
                  let badgeStyle = "bg-slate-200 text-slate-600";
                  let iconElement = <Lock className="h-3.5 w-3.5 text-slate-400" />;

                  if (isCurrent) {
                    statusLabel = "Current Active";
                    statusStyle = "bg-amber-50/70 border-brand-gold text-slate-900 shadow-md ring-2 ring-brand-gold/20";
                    badgeStyle = "bg-brand-gold text-slate-900 font-extrabold animate-pulse";
                    iconElement = <Clock className="h-3.5 w-3.5 text-amber-600" />;
                  } else if (isCompleted) {
                    statusLabel = "Completed";
                    statusStyle = "bg-emerald-50/30 border-emerald-200 text-slate-800 hover:bg-emerald-50/50";
                    badgeStyle = "bg-emerald-100 text-emerald-800 font-bold";
                    iconElement = <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
                  }

                  return (
                    <motion.button
                      key={cy.id || cy.seqId}
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setPendingCycleSelection(numStr);
                        setUserHasSelectedCycle(true);
                        setIsCyclePopupOpen(false);
                        setIsInstallmentPopupOpen(true);
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all cursor-pointer ${statusStyle}`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="font-mono font-black text-xs">{cy.label}</span>
                        {iconElement}
                      </div>

                      <div className="mt-2">
                        <h4 className="font-extrabold text-xs text-slate-900">{cy.label}</h4>
                        <span className={`inline-block mt-1 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-md ${badgeStyle}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* ERP Footer note */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-medium">
                <span>* Dynamic cycle operations auto-archived into Ruqayya ERP ledger.</span>
                <span className="font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">CONTRACT TERM: 12 CYCLES</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================
          2. PREMIUM INSTALLMENT SELECTOR POPUP MODAL
          ============================================== */}
      <AnimatePresence>
        {isInstallmentPopupOpen && (
          <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
              className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 overflow-hidden relative"
            >
              {/* background design */}
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-5">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500 text-white rounded-lg shadow-sm">
                      <Calculator className="h-4 w-4" />
                    </span>
                    Select Installment for {formattedCycles.find(c => c.seqId === pendingCycleSelection)?.label || `CYC 00${pendingCycleSelection}`}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Select one of the 6 installments to evaluate unpaid balances and audit driver reports.
                  </p>
                </div>
                <button
                  onClick={() => setIsInstallmentPopupOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Grid of 6 Installments */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const numStr = num.toString();
                  return (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedCycle(pendingCycleSelection);
                        setSelectedInstallment(numStr);
                        setIsInstallmentPopupOpen(false);
                        setIsUnpaidDriversPopupOpen(true);
                      }}
                      className="p-4 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-2xl text-left flex flex-col justify-between h-28 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="font-mono font-black text-slate-400 group-hover:text-amber-600 text-xs">I#{num}</span>
                        <div className="p-1 rounded-md bg-white border border-slate-200 group-hover:bg-amber-100 group-hover:border-amber-200">
                          <Check className="h-3 w-3 text-slate-400 group-hover:text-amber-600" />
                        </div>
                      </div>

                      <div className="mt-2">
                        <h4 className="font-extrabold text-xs text-slate-800">Installment {num}</h4>
                        <p className="text-[9px] text-slate-400 mt-1 font-mono font-bold">₦41,666.67 Due</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={() => {
                    setIsInstallmentPopupOpen(false);
                    setIsCyclePopupOpen(true);
                  }}
                  className="text-xs text-brand-gold hover:text-slate-900 font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  ← Back to Cycles
                </button>
                <span className="text-[9px] text-slate-400 font-medium">Cycle term divided into 6 installments.</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================
          3. PREMIUM UNPAID DRIVERS AUDIT LIST POPUP MODAL
          ============================================== */}
      <AnimatePresence>
        {isUnpaidDriversPopupOpen && (
          <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
              className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 overflow-hidden relative flex flex-col"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-rose-500 text-white rounded-lg shadow-sm">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      Unpaid Drivers ({pendingDrivers.length})
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Selected period: <strong className="text-brand-navy">{formattedCycles.find(c => c.seqId === selectedCycle)?.label || `CYC 00${selectedCycle}`} — Installment #{selectedInstallment}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setIsUnpaidDriversPopupOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {pendingDrivers.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Perfect Compliance Recorded!</h4>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    All leasing drivers have successfully recorded their remittances for {formattedCycles.find(c => c.seqId === selectedCycle)?.label || `CYC 00${selectedCycle}`}, Installment #{selectedInstallment}.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsUnpaidDriversPopupOpen(false)}
                    className="font-bold text-xs"
                  >
                    Close Panel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl mb-4 text-[10px] text-rose-700 font-medium leading-relaxed">
                    The following drivers have <span className="font-black underline">not submitted</span> remittance for this installment. Choose a driver below to load their financial details directly into the payment calculator.
                  </div>

                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {pendingDrivers.map((d, index) => {
                      const overdueAmt = 41666.67; // standard installment
                      return (
                        <motion.div
                          key={d.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04 }}
                          whileHover={{ x: 4, backgroundColor: "rgba(244, 63, 94, 0.04)" }}
                          onClick={() => {
                            setSelectedDriverId(d.id);
                            setPayAmountInput('');
                            setIsUnpaidDriversPopupOpen(false);
                            const el = document.getElementById("corporate-finance-center");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="p-3 border border-slate-100 hover:border-rose-200 rounded-2xl flex items-center justify-between cursor-pointer bg-white transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                              <img
                                src={d.passport_photo_url || d.passportPhoto || d.passport_photo || d.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs text-slate-800 truncate">{d.fullName}</h4>
                              <p className="text-[9px] text-slate-400 font-mono mt-0.5 font-bold">ID: {d.company_driver_id || 'PENDING'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-[9px] uppercase tracking-wider text-rose-500 font-black font-mono block">OVERDUE</span>
                              <span className="text-xs font-black text-rose-600 font-mono block mt-0.5">₦{overdueAmt.toLocaleString()}</span>
                            </div>
                            <div className="h-6 w-6 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                              <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <button
                      onClick={() => {
                        setIsUnpaidDriversPopupOpen(false);
                        setIsInstallmentPopupOpen(true);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      ← Back to Installments
                    </button>
                    <span className="text-[9px] text-slate-400 font-medium">Automatic system calculation.</span>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
