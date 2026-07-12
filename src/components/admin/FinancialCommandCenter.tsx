/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  AlertTriangle
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
}

export const FinancialCommandCenter: React.FC<FinancialCommandCenterProps> = ({
  lang,
  drivers,
  vehicles,
  finance,
  payments,
  shareholders = [],
  onSync
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
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isReinvestOpen, setIsReinvestOpen] = useState(false);
  const [shActionAmount, setShActionAmount] = useState('');
  const [shActionRemarks, setShActionRemarks] = useState('');
  const [shActionError, setShActionError] = useState('');
  const [shActionSuccess, setShActionSuccess] = useState('');

  // Payroll disburse state
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollSuccess, setPayrollSuccess] = useState('');
  const [payrollError, setPayrollError] = useState('');

  // Search/Filters inside subtabs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Auto-fetch additional records
  const fetchAuxRecords = async () => {
    setIsFetching(true);
    try {
      const [pList, sList, aList] = await Promise.all([
        api.getPayments().catch(() => []),
        api.getShareholders().catch(() => []),
        api.getAuditLogs().catch(() => [])
      ]);
      setLocalPayments(pList || []);
      setLocalShareholders(sList || []);
      setLocalAuditLogs(aList || []);
    } catch (err) {
      console.error("Auxiliary financial data fetch failed:", err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
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

  // Active Tricycles Payroll
  const activeTricyclesCount = vehicles.filter(v => v.status === 'active' || v.status === 'assigned' || v.status === 'idle').length || vehicles.length || 5;
  const barristerSal = activeTricyclesCount * 1000;
  const managerSal = activeTricyclesCount * 1000;
  const hegelSal = activeTricyclesCount * 500;
  const adamSal = activeTricyclesCount * 1000;
  const abakakaSal = activeTricyclesCount * 1000;
  const totalPayroll_liability = barristerSal + managerSal + hegelSal + adamSal + abakakaSal;

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
        installmentNumber: currentInstallmentNumber,
        outstandingAmount: remainingInstallmentAfterPay,
        date: new Date().toISOString().split('T')[0],
        receiptNumber: payReceiptInput,
        remarks: payRemarksInput || `Auto-processed real-time payment.`
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
            <Card className="p-4 border-l-4 border-slate-900 bg-bg-surface flex flex-col justify-between h-32 shadow-sm">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.companyWallet}</span>
                <p className="text-2xl font-black text-slate-900 font-mono mt-1">₦{companyWalletBalance.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-slate-100 pt-2">
                <span>Inflows - Outflows</span>
                <Badge variant="success">Auto Calculations</Badge>
              </div>
            </Card>

            {/* TODAY'S COLLECTIONS */}
            <Card className="p-4 border-l-4 border-emerald-500 bg-bg-surface flex flex-col justify-between h-32 shadow-sm">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.todayCollections}</span>
                <p className="text-2xl font-black text-emerald-600 font-mono mt-1">₦{todayCollections.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-slate-100 pt-2">
                <span>Today's Remittances</span>
                <span className="text-emerald-600 font-bold font-mono">Live</span>
              </div>
            </Card>

            {/* NET SURPLUS PROFIT */}
            <Card className="p-4 border-l-4 border-brand-gold bg-bg-surface flex flex-col justify-between h-32 shadow-sm">
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

            {/* DRIVER LEASE OUTSTANDING */}
            <Card className="p-4 border-l-4 border-rose-500 bg-bg-surface flex flex-col justify-between h-32 shadow-sm">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.driverReceivables}</span>
                <p className="text-2xl font-black text-rose-600 font-mono mt-1">₦{outstandingDriverReceivables.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-slate-100 pt-2">
                <span>Asset fleet value backlogs</span>
                <Badge variant="danger">Receivable</Badge>
              </div>
            </Card>
          </div>

          {/* SECOND METRICS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.dividendsPool}</span>
                <p className="text-lg font-bold text-slate-900 font-mono mt-1">₦{continuousDividendPool.toLocaleString()}</p>
              </div>
              <Percent className="h-8 w-8 text-slate-400 shrink-0" />
            </Card>

            <Card className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Month operating spends</span>
                <p className="text-lg font-bold text-rose-600 font-mono mt-1">₦{monthlyExpenses.toLocaleString()}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-rose-400 shrink-0" />
            </Card>

            <Card className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{t.payrollLiability}</span>
                <p className="text-lg font-bold text-blue-600 font-mono mt-1">₦{totalPayroll_liability.toLocaleString()}</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-400 shrink-0" />
            </Card>
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
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* LEFT PANEL: DRIVER LIST SELECT */}
          <Card className="lg:col-span-4 p-4 flex flex-col gap-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Select Lease Driver</h3>
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
                .map(d => {
                  const isSelected = selectedDriverId === d.id;
                  return (
                    <button
                      key={d.id}
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
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100" 
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
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150" 
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
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">30-Day Contract Agreement</span>
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
                                {expectedInstallmentStatus.toUpperCase()}
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
                              {item.category.toUpperCase()}
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
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
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
                            <Badge variant="danger">{f.category.toUpperCase()}</Badge>
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
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t.dividendsPool}</span>
              <p className="text-3xl font-black text-brand-gold font-mono mt-0.5">₦{continuousDividendPool.toLocaleString()}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Accrued automatically on real-time net generated income.</span>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Equities Registered</span>
              <p className="text-3xl font-black text-slate-200 font-mono mt-0.5">₦{totalInvestmentsSum.toLocaleString()}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Paid-up capital seed reserves.</span>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Shareholders Registered</span>
              <p className="text-3xl font-black text-slate-200 font-mono mt-0.5">{localShareholders.length}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Bylaw validated board directors.</span>
            </div>
          </div>

          {/* SHAREHOLDER STAKES LEDGER TABLE */}
          <Card className="p-5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">{t.shareholdersTitle}</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Shareholder Details</th>
                    <th className="p-3">Paid Capital Stock</th>
                    <th className="p-3">{t.shareholderStake}</th>
                    <th className="p-3">{t.earnings}</th>
                    <th className="p-3">{t.withdrawable}</th>
                    <th className="p-3">{t.totalReinvested}</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {localShareholders.map((sh, idx) => {
                    const weightStake = totalInvestmentsSum > 0 ? ((sh.investment_amount / totalInvestmentsSum) * 100) : 0;
                    const estimatedEarnings = continuousDividendPool * (weightStake / 100);
                    const shTotalWithdrawn = sh.total_withdrawn || 0;
                    const availableWithdrawable = Math.max(0, estimatedEarnings - shTotalWithdrawn);
                    const shTotalReinvested = sh.total_reinvested || 0;

                    return (
                      <tr key={sh.id || idx} className="hover:bg-slate-50/50">
                        {/* NAME AND DETAILS */}
                        <td className="p-3 font-sans">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full border border-slate-200 overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center">
                              <img 
                                src={sh.passport_photo_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'} 
                                alt={sh.full_name} 
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 text-xs">{sh.full_name}</p>
                              <p className="text-[10px] text-text-muted">{sh.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* INVESTMENT */}
                        <td className="p-3 font-bold text-slate-800">₦{sh.investment_amount.toLocaleString()}</td>
                        
                        {/* WEIGHT */}
                        <td className="p-3 text-slate-700 font-extrabold">{weightStake.toFixed(2)}%</td>
                        
                        {/* ESTIMATED EARNINGS */}
                        <td className="p-3 text-emerald-600 font-bold">₦{estimatedEarnings.toLocaleString()}</td>
                        
                        {/* WITHDRAWABLE */}
                        <td className="p-3 text-brand-gold font-black">₦{availableWithdrawable.toLocaleString()}</td>
                        
                        {/* TOTAL REINVESTED */}
                        <td className="p-3 text-slate-600">₦{shTotalReinvested.toLocaleString()}</td>

                        {/* ACTIONS BUTTONS */}
                        <td className="p-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={availableWithdrawable <= 0}
                              onClick={() => {
                                setActiveShareholder(sh);
                                setIsWithdrawOpen(true);
                              }}
                              className="font-bold border-brand-gold text-brand-gold hover:bg-brand-gold/10 text-[10px] h-7 px-2"
                            >
                              Withdraw
                            </Button>

                            <Button
                              variant="outline"
                              size="xs"
                              disabled={availableWithdrawable <= 0}
                              onClick={() => {
                                setActiveShareholder(sh);
                                setIsReinvestOpen(true);
                              }}
                              className="font-bold border-slate-900 text-slate-900 hover:bg-slate-100 text-[10px] h-7 px-2"
                            >
                              Reinvest
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ==============================================
          6. AUTOMATED TEAM PAYROLL SUBTAB
          ============================================== */}
      {subTab === 'payroll' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* PAYROLL CARD EXPLAINER */}
          <Card className="lg:col-span-5 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="h-5 w-5 text-slate-900" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Salary Management</h3>
              </div>
              
              <p className="text-xs text-slate-700 leading-relaxed mb-4">
                Ruqayya Transport Limited ERP calculates personnel wages automatically based on the count of **active leasing tricycles** currently active in the cycle. This guarantees staff salary scaling with operating volume.
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 font-mono text-xs flex flex-col gap-2.5">
                <div className="flex justify-between">
                  <span className="text-text-muted">Total Tricycles Fleet:</span>
                  <span className="font-bold text-slate-900">{vehicles.length} Units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Active Cycle Tricycles:</span>
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

          {/* PAYROLL SPLITS BREAKDOWN TABLE */}
          <Card className="lg:col-span-7 p-5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Salary Disbursal Splits Breakdown</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Team Member Roles</th>
                    <th className="p-3">Formulas (Per Tricycle)</th>
                    <th className="p-3 text-right">Computed Pay (30 Days)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {[
                    { name: "Barrister Legal Officer", rate: 1000, computed: barristerSal },
                    { name: "General Manager", rate: 1000, computed: managerSal },
                    { name: "Hegel Operations Associate", rate: 500, computed: hegelSal },
                    { name: "Admin Adam (Payroll Officer)", rate: 1000, computed: adamSal },
                    { name: "Admin Abakaka (Logistics Manager)", rate: 1000, computed: abakakaSal }
                  ].map((role, index) => (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="p-3 font-sans font-bold text-slate-900">{role.name}</td>
                      <td className="p-3 text-slate-600">₦{role.rate.toLocaleString()} × {activeTricyclesCount} active tricycles</td>
                      <td className="p-3 text-right font-bold text-slate-900">₦{role.computed.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-sans">
                    <td colSpan={2} className="p-3 font-extrabold text-slate-900">Aggregate Team Salaries:</td>
                    <td className="p-3 text-right font-black font-mono text-sm text-slate-950">₦{totalPayroll_liability.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
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
                            {log.userRole.toUpperCase()}
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
              <span className="text-text-muted">Installment Block:</span>
              <span className="font-bold text-slate-900">Cycle #{currentInstallmentNumber}</span>
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
    </div>
  );
};
