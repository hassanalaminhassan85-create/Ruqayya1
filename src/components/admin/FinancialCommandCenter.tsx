import React, { useState } from 'react';
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
  Calendar
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
  CartesianGrid
} from 'recharts';
import { Driver, Vehicle, FinancialRecord } from '../../types';
import { api } from '../../utils/api';

interface FinancialCommandCenterProps {
  lang: 'en' | 'ha';
  drivers: Driver[];
  vehicles: Vehicle[];
  finance: FinancialRecord[];
  payments: any[];
  onSync: () => void;
}

export const FinancialCommandCenter: React.FC<FinancialCommandCenterProps> = ({
  lang,
  drivers,
  vehicles,
  finance,
  payments,
  onSync
}) => {
  // Navigation / Modal States
  const [subTab, setSubTab] = useState<'payments' | 'expenses' | 'ledger'>('payments');
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isRecordExpenseOpen, setIsRecordExpenseOpen] = useState(false);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  
  // Filtering States
  const [filterDriver, setFilterDriver] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Form States (Record Payment)
  const [payDriverId, setPayDriverId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payInstallment, setPayInstallment] = useState('1');
  const [payReceipt, setPayReceipt] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');

  // Form States (Record Expense)
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('maintenance');
  const [expDescription, setExpDescription] = useState('');
  const [expDriverId, setExpDriverId] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expError, setExpError] = useState('');
  const [expSuccess, setExpSuccess] = useState('');

  // Form States (Edit Payment)
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [editPayAmount, setEditPayAmount] = useState('');
  const [editPayReceipt, setEditPayReceipt] = useState('');
  const [editPayRemarks, setEditPayRemarks] = useState('');
  const [editPayDate, setEditPayDate] = useState('');
  const [editPayError, setEditPayError] = useState('');

  // Localized Dictionary
  const dict = {
    en: {
      payments: "Driver Installments",
      expenses: "Corporate Spend",
      ledger: "General Ledger & Chart",
      driverBalance: "Outstanding Driver Balances",
      recordPay: "Record Installment Payment",
      recordExp: "Record Operational Expense",
      approve: "Approve",
      reject: "Reject",
      edit: "Edit Record",
      save: "Save Changes",
      cancel: "Cancel",
      searchDriver: "Filter by Driver...",
      searchVehicle: "Filter by Vehicle...",
      category: "Category",
      amount: "Amount",
      date: "Date",
      receipt: "Receipt Number",
      remarks: "Remarks",
      recordedBy: "Recorded By",
      status: "Status",
      action: "Actions",
      selectDriver: "-- Select Driver --",
      selectVehicle: "-- Select Vehicle --",
      selectCategory: "-- Select Category --",
      allCategory: "All Categories",
      revenue: "Revenue Graph",
      netGenerated: "Net Cash Surplus",
      shareholderPool: "Dividend Pool (2%)",
      linkedDriver: "Linked Driver",
      installmentLabel: "Installment Cycle",
      pendingReview: "Awaiting Admin Review",
      description: "Description",
      addPaymentTitle: "Record 5-Day Installment",
      addExpenseTitle: "Post Ledger Expense",
      editPaymentTitle: "Edit Payment details",
      accident: "Accident Repair Layout",
      maintenance: "Maintenance/Spare Parts",
      fuel: "Fuel/Petrol Refined",
      operational: "Operational / Road Tax",
      other: "Miscellaneous Ledger Log"
    },
    ha: {
      payments: "Kudaden Installments",
      expenses: "Kudaden da aka Kashe",
      ledger: "Babban Littafi & Jadawali",
      driverBalance: "Sauran Kudin Direbobi",
      recordPay: "Shigar da Kudin Installment",
      recordExp: "Kashe Kudin Gyara/Mai",
      approve: "Yarda (Approve)",
      reject: "Ki Yardda (Reject)",
      edit: "Gyara Bayani",
      save: "Ajiye Gyara",
      cancel: "Soke",
      searchDriver: "Tace ta Direba...",
      searchVehicle: "Tace ta Mota...",
      category: "Nau'i",
      amount: "Kudi",
      date: "Rana",
      receipt: "Lambar Rasit",
      remarks: "Karin Bayani",
      recordedBy: "Wanda ya Shigar",
      status: "Tantancewa",
      action: "Ayyuka",
      selectDriver: "-- Zabi Direba --",
      selectVehicle: "-- Zabi Mota --",
      selectCategory: "-- Zabi Rukunin Kudiri --",
      allCategory: "Duk Nau'ukan",
      revenue: "Graf na Kudin Shiga",
      netGenerated: "Ribaccen Kudaden Shiga",
      shareholderPool: "Kudin Dividend (2%)",
      linkedDriver: "Direba mai alaka",
      installmentLabel: "Zangon Installment",
      pendingReview: "Yana jiran Dubawa",
      description: "Karin Bayani",
      addPaymentTitle: "Shigar da Biyan Installment na kwanaki 5",
      addExpenseTitle: "Shigar da Kudin da Aka Kashe",
      editPaymentTitle: "Gyara Bayanin Biyan Kudi",
      accident: "Gyaran Hatsari",
      maintenance: "Kudin Gyaran Mota",
      fuel: "Kudin Mai/Fetur",
      operational: "Kudin Hanya/Haraji",
      other: "Sauran Kudaden"
    }
  }[lang];

  // Calculations
  const activeCycleRevenue = finance
    .filter(f => f.type === 'revenue')
    .reduce((sum, f) => sum + f.amount, 0);

  const activeCycleExpenses = finance
    .filter(f => f.type === 'expense')
    .reduce((sum, f) => sum + f.amount, 0);

  const netSurplus = activeCycleRevenue - activeCycleExpenses;
  const shareholderShare = netSurplus > 0 ? netSurplus * 0.02 : 0;

  // Chart Data compilation (Grouped by date over the past 30 days)
  const compileChartData = () => {
    const datesMap: { [key: string]: { date: string; Revenue: number; Expense: number } } = {};
    
    // Seed past 7 dates to ensure graph shows continuity if empty
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      datesMap[str] = { date: str.substring(5), Revenue: 0, Expense: 0 };
    }

    finance.forEach(f => {
      if (!f.date) return;
      const dateKey = f.date.split('T')[0];
      const displayKey = dateKey.substring(5); // MM-DD
      
      if (!datesMap[dateKey]) {
        datesMap[dateKey] = { date: displayKey, Revenue: 0, Expense: 0 };
      }
      
      if (f.type === 'revenue') {
        datesMap[dateKey].Revenue += f.amount;
      } else {
        datesMap[dateKey].Expense += f.amount;
      }
    });

    return Object.values(datesMap).sort((a, b) => a.date.localeCompare(b.date));
  };

  const chartData = compileChartData();

  // Handle Recording Installment Payment
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');
    setPaySuccess('');

    if (!payDriverId || !payAmount || !payReceipt) {
      setPayError(lang === 'en' ? "Please complete driver, amount and receipt number fields." : "Da fatan za a cika direba, kudi, da lambar rasit.");
      return;
    }

    const matchedDriver = drivers.find(d => d.id === payDriverId);
    const day30Total = matchedDriver?.agreed_amount || 300000;
    const installmentValue = day30Total / 6;

    try {
      await api.addPayment({
        driverId: payDriverId,
        amount: parseFloat(payAmount),
        installmentNumber: parseInt(payInstallment),
        outstandingAmount: Math.max(0, day30Total - (parseFloat(payAmount) * parseInt(payInstallment))),
        date: new Date().toISOString().split('T')[0],
        receiptNumber: payReceipt,
        remarks: payRemarks
      });

      setPaySuccess(lang === 'en' ? "Installment ledger recorded! Awaiting admin review." : "An yi nasarar ajiye kudin! Ana jiran amincewa.");
      setPayDriverId('');
      setPayAmount('');
      setPayReceipt('');
      setPayRemarks('');
      
      setTimeout(() => {
        setIsRecordPaymentOpen(false);
        onSync();
      }, 1500);
    } catch (err: any) {
      setPayError(err.message || "Failed to record transaction.");
    }
  };

  // Handle Recording Expense
  const handleRecordExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpError('');
    setExpSuccess('');

    if (!expAmount || !expDescription || !expDate) {
      setExpError(lang === 'en' ? "Please fill in cost amount, description, and date." : "Da fatan za a cika kudi, bayani, da rana.");
      return;
    }

    try {
      await api.addExpenseDirect({
        amount: parseFloat(expAmount),
        category: expCategory,
        description: expDescription,
        date: expDate,
        driverId: expDriverId || undefined
      });

      setExpSuccess(lang === 'en' ? "Operational expense posted to ledger successfully!" : "An yi nasarar shigar da kudaden da aka kashe!");
      setExpAmount('');
      setExpDescription('');
      setExpDriverId('');
      
      setTimeout(() => {
        setIsRecordExpenseOpen(false);
        onSync();
      }, 1500);
    } catch (err: any) {
      setExpError(err.message || "Failed to log spend record.");
    }
  };

  // Handle Payment Reviews (Approve / Reject)
  const handlePaymentReview = async (payId: string, status: 'approved' | 'rejected') => {
    try {
      await api.updatePaymentStatus(payId, { status, remarks: `Reviewed by admin.` });
      onSync();
    } catch (err) {
      console.error("Payment status transaction failed:", err);
    }
  };

  // Handle Edit Payment Save
  const handleEditPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditPayError('');
    if (!selectedPayment) return;

    try {
      await api.updatePayment(selectedPayment.id, {
        amount: parseFloat(editPayAmount),
        date: editPayDate,
        receiptNumber: editPayReceipt,
        remarks: editPayRemarks
      });

      setIsEditPaymentOpen(false);
      setSelectedPayment(null);
      onSync();
    } catch (err: any) {
      setEditPayError(err.message || "Failed to update payment parameters.");
    }
  };

  // Filter payments and general ledger
  const filteredPayments = payments.filter(p => {
    const drvMatch = !filterDriver || p.driver_id === filterDriver;
    return drvMatch;
  });

  const filteredLedger = finance.filter(f => {
    const drvMatch = !filterDriver || f.description.toLowerCase().includes(filterDriver.toLowerCase()) || (f as any).driver_id === filterDriver;
    const catMatch = !filterCategory || f.category === filterCategory;
    return drvMatch && catMatch;
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* Visual Header & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-md font-extrabold text-text-main uppercase">
              {lang === 'en' ? "Corporate Financial Command" : "Gudanar da Kudaden Kamfani"}
            </h3>
            <p className="text-[10px] text-text-muted mt-0.5">
              {lang === 'en' ? "Verify 5-day installments, record operational maintenance spends, and view real-time charts." : "Duba installments na kwanaki 5, shigar da kudin gyaran motoci, da duba jaddawalin kudi."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRecordPaymentOpen(true)}
            className="font-bold flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Plus className="h-4 w-4 text-emerald-500" />
            {dict.recordPay}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRecordExpenseOpen(true)}
            className="font-bold flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Plus className="h-4 w-4 text-rose-500" />
            {dict.recordExp}
          </Button>
        </div>
      </div>

      {/* Grid of Balances / Surplus / Dividend Pool */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex flex-col gap-1 border-l-4 border-emerald-500 bg-bg-surface">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{lang === 'en' ? "Total Corporate Revenue" : "Jimillar Kudin Shiga"}</span>
          <p className="text-xl font-extrabold text-emerald-600">₦{activeCycleRevenue.toLocaleString()}</p>
          <span className="text-[9px] text-text-muted">Aggregated ledger receipts</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 border-l-4 border-rose-500 bg-bg-surface">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{lang === 'en' ? "Total Operational Expenses" : "Jimillar Spend na Gyare-gyare"}</span>
          <p className="text-xl font-extrabold text-rose-600">₦{activeCycleExpenses.toLocaleString()}</p>
          <span className="text-[9px] text-text-muted">Maintenance, fuel, & accident claims</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 border-l-4 border-amber-500 bg-bg-surface">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{dict.shareholderPool}</span>
          <p className="text-xl font-extrabold text-amber-500">₦{shareholderShare.toLocaleString()}</p>
          <span className="text-[9px] text-text-muted">Continuous 2% pool accumulation</span>
        </Card>
      </div>

      {/* Interactive Segment Tabs */}
      <div className="flex gap-1.5 border-b border-border-main/50 pb-2">
        <button
          onClick={() => setSubTab('payments')}
          className={`px-4 py-1.5 text-xs font-extrabold transition-all border-b-2 ${subTab === 'payments' ? 'border-brand-gold text-text-main' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}
        >
          {dict.payments}
        </button>
        <button
          onClick={() => setSubTab('expenses')}
          className={`px-4 py-1.5 text-xs font-extrabold transition-all border-b-2 ${subTab === 'expenses' ? 'border-brand-gold text-text-main' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}
        >
          {lang === 'en' ? "Outstanding Balances" : "Sauran Kudade"}
        </button>
        <button
          onClick={() => setSubTab('ledger')}
          className={`px-4 py-1.5 text-xs font-extrabold transition-all border-b-2 ${subTab === 'ledger' ? 'border-brand-gold text-text-main' : 'border-transparent text-text-muted hover:text-text-main cursor-pointer'}`}
        >
          {dict.ledger}
        </button>
      </div>

      {/* Filtering Selector Panel */}
      <div className="bg-bg-surface/30 border border-border-main rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        <div className="flex items-center gap-2 relative">
          <User className="h-4 w-4 text-text-muted shrink-0" />
          <select
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
            className="w-full bg-bg-surface border border-border-main rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          >
            <option value="">{lang === 'en' ? "Filter by Driver" : "Tace ta Direba"}</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.fullName} ({d.company_driver_id || 'PENDING'})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-text-muted shrink-0" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full bg-bg-surface border border-border-main rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          >
            <option value="">{dict.allCategory}</option>
            <option value="freight">{lang === 'en' ? "Remittance Contract Revenue" : "Kudaden Remittance"}</option>
            <option value="maintenance">{lang === 'en' ? "Maintenance & Repairs" : "Gyaran Motoci"}</option>
            <option value="fuel">{lang === 'en' ? "Fuel Voucher Disbursals" : "Kudin Mai"}</option>
            <option value="salary">{lang === 'en' ? "Admin Salaries" : "Albashin Ma'aikata"}</option>
            <option value="other">{lang === 'en' ? "Other Ledger Logs" : "Sauran Kudaden Shiga"}</option>
          </select>
        </div>

        <div className="text-[10px] text-text-muted text-right font-mono font-bold">
          {lang === 'en' ? "Real-time auditing active" : "Binciken kudi yana aiki a take"}
        </div>
      </div>

      {/* TAB SUB-CONTENT */}

      {/* 1. PAYMENTS TAB */}
      {subTab === 'payments' && (
        <div className="bg-bg-surface border border-border-main rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                  <th className="p-3">{dict.receipt}</th>
                  <th className="p-3">{lang === 'en' ? "Driver Details" : "Bayanan Direba"}</th>
                  <th className="p-3">{dict.installmentLabel}</th>
                  <th className="p-3">{dict.amount}</th>
                  <th className="p-3">{dict.date}</th>
                  <th className="p-3">{dict.status}</th>
                  <th className="p-3 text-center">{dict.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/50 text-text-main">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-text-muted">
                      {lang === 'en' ? "No installment payment records logged." : "Babu bayanan biyan installments tukun."}
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p: any) => {
                    const drv = drivers.find(d => d.id === p.driver_id);
                    return (
                      <tr key={p.id} className="hover:bg-bg-base/20">
                        <td className="p-3 font-mono font-bold text-[11px] text-brand-gold">{p.receipt_number}</td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-bold">{drv?.fullName || "Assisted Driver"}</span>
                            <span className="text-[9px] text-text-muted font-mono">{drv?.company_driver_id || 'PENDING'}</span>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-text-muted">
                          {lang === 'en' ? `Installment #${p.installment_number} of 6` : `Kashin Installment #${p.installment_number} na 6`}
                        </td>
                        <td className="p-3 font-extrabold text-emerald-600">₦{p.amount.toLocaleString()}</td>
                        <td className="p-3 text-text-muted text-[11px] font-mono">{p.date}</td>
                        <td className="p-3">
                          <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}>
                            {(p.status || '').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {p.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handlePaymentReview(p.id, 'approved')}
                                  className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded transition-all cursor-pointer"
                                  title={dict.approve}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handlePaymentReview(p.id, 'rejected')}
                                  className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                  title={dict.reject}
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setSelectedPayment(p);
                                setEditPayAmount(p.amount.toString());
                                setEditPayReceipt(p.receipt_number);
                                setEditPayRemarks(p.remarks || '');
                                setEditPayDate(p.date);
                                setIsEditPaymentOpen(true);
                              }}
                              className="p-1 text-blue-500 hover:bg-blue-500/10 rounded transition-all cursor-pointer"
                              title={dict.edit}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. OUTSTANDING BALANCES TAB */}
      {subTab === 'expenses' && (
        <div className="bg-bg-surface border border-border-main rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                  <th className="p-3">Driver Profile</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">30-Day Contract Value</th>
                  <th className="p-3">Six 5-Day Installment Rate</th>
                  <th className="p-3">Total Amount Paid</th>
                  <th className="p-3">Outstanding Lease Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/50 text-text-main">
                {drivers.map(d => {
                  const contractValue = d.agreed_amount || 300000;
                  const installmentRate = contractValue / 6;
                  
                  // Sum of approved payments for this driver
                  const totalPaid = payments
                    .filter(p => p.driver_id === d.id && p.status === 'approved')
                    .reduce((sum, p) => sum + p.amount, 0);

                  const outstanding = Math.max(0, contractValue - totalPaid);

                  return (
                    <tr key={d.id} className="hover:bg-bg-base/20">
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-extrabold">{d.fullName}</span>
                          <span className="text-[10px] text-text-muted font-mono">{d.company_driver_id || 'NOT_ASSIGNED'}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={d.classification === 'Smart' ? 'info' : 'default'}>
                          {(d.classification || 'Assisted').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 font-bold text-text-main">₦{contractValue.toLocaleString()}</td>
                      <td className="p-3 font-mono text-text-muted">₦{installmentRate.toLocaleString()}</td>
                      <td className="p-3 font-extrabold text-emerald-600">₦{totalPaid.toLocaleString()}</td>
                      <td className="p-3 font-extrabold text-rose-500 font-mono">
                        ₦{outstanding.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CHART & LEDGER TAB */}
      {subTab === 'ledger' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Recharts Graphical Visualizer */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <Card className="p-4 bg-bg-surface border border-border-main rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-text-main uppercase block mb-3">{dict.revenue} (30 days)</span>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1}/>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                    <YAxis stroke="#94a3b8" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}/>
                    <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="Expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-center items-center gap-4 mt-2 text-[10px] font-bold font-mono">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> REVENUE (KUDIN SHIGA)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"></span> EXPENSE (KASHIN KUDI)</span>
              </div>
            </Card>
          </div>

          {/* Ledger List */}
          <div className="lg:col-span-5 bg-bg-surface border border-border-main rounded-2xl p-4 flex flex-col gap-3">
            <span className="text-xs font-bold text-text-main uppercase border-b border-border-main/50 pb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-brand-gold" />
              {lang === 'en' ? "Consolidated Ledger Transactions" : "Rahoton Babban Littafin Kudi"}
            </span>

            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredLedger.length === 0 ? (
                <div className="text-center text-text-muted py-8 text-xs">{lang === 'en' ? "No ledger entries fit parameters." : "Babu bayanan babban littafin kudi."}</div>
              ) : (
                filteredLedger.map((record, idx) => (
                  <div key={record.id} className="flex justify-between items-start p-2.5 rounded-lg bg-bg-base/30 border border-border-main/50 text-xs">
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      <span className="font-bold text-text-main leading-normal">{record.description}</span>
                      <span className="text-[9px] text-text-muted flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" /> {record.date} • {(record.category || '').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-extrabold text-[12px] block ${record.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {record.type === 'revenue' ? '+' : '-'}₦{record.amount.toLocaleString()}
                      </span>
                      {record.approvedBy && (
                        <span className="text-[8px] text-text-muted block">By {record.approvedBy}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PAYMENT */}
      <Modal isOpen={isRecordPaymentOpen} onClose={() => setIsRecordPaymentOpen(false)} title={dict.addPaymentTitle}>
        <form onSubmit={handleRecordPaymentSubmit} className="flex flex-col gap-4 text-xs">
          {payError && <Alert type="danger">{payError}</Alert>}
          {paySuccess && <Alert type="success">{paySuccess}</Alert>}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">Choose Driver Profile</label>
            <select
              value={payDriverId}
              onChange={(e) => setPayDriverId(e.target.value)}
              className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
            >
              <option value="">{dict.selectDriver}</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.fullName} ({d.company_driver_id || 'PENDING'})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Payment Amount (₦)</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Installment Milestone</label>
              <select
                value={payInstallment}
                onChange={(e) => setPayInstallment(e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              >
                <option value="1">Installment #1 of 6</option>
                <option value="2">Installment #2 of 6</option>
                <option value="3">Installment #3 of 6</option>
                <option value="4">Installment #4 of 6</option>
                <option value="5">Installment #5 of 6</option>
                <option value="6">Installment #6 of 6</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">Manual Receipt / Bank Teller Reference ID</label>
            <input
              type="text"
              value={payReceipt}
              onChange={(e) => setPayReceipt(e.target.value.toUpperCase())}
              placeholder="e.g. REC-POL-9921"
              className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">Audit Remarks / Bank comments</label>
            <textarea
              value={payRemarks}
              onChange={(e) => setPayRemarks(e.target.value)}
              placeholder="e.g. Paid in cash at Kano Zaria Road terminal cash-desk"
              rows={2}
              className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border-main/50 mt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsRecordPaymentOpen(false)}>
              {dict.cancel}
            </Button>
            <Button variant="secondary" size="sm" type="submit">
              {lang === 'en' ? "Commit Installment Record" : "Ajiye Bayanin Installment"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: RECORD EXPENSE */}
      <Modal isOpen={isRecordExpenseOpen} onClose={() => setIsRecordExpenseOpen(false)} title={dict.addExpenseTitle}>
        <form onSubmit={handleRecordExpenseSubmit} className="flex flex-col gap-4 text-xs">
          {expError && <Alert type="danger">{expError}</Alert>}
          {expSuccess && <Alert type="success">{expSuccess}</Alert>}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Expense Cost Amount (₦)</label>
              <input
                type="number"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="e.g. 120000"
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Spend Classification</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              >
                <option value="maintenance">{dict.maintenance}</option>
                <option value="fuel">{dict.fuel}</option>
                <option value="accident">{dict.accident}</option>
                <option value="salary">{lang === 'en' ? "Salaries/Wages" : "Albashin Ma'aikata"}</option>
                <option value="other">{dict.other}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Date of disbursement</label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Link Driver Profile (Optional)</label>
              <select
                value={expDriverId}
                onChange={(e) => setExpDriverId(e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              >
                <option value="">-- Choose Driver --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">Expense Description details</label>
            <textarea
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              placeholder="e.g. Replaced hydraulic pressure seals on mercedes trailer"
              rows={3}
              className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border-main/50 mt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsRecordExpenseOpen(false)}>
              {dict.cancel}
            </Button>
            <Button variant="secondary" size="sm" type="submit">
              {lang === 'en' ? "Post Expense Ledger" : "Ajiye Kashe Kudi"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT PAYMENT DETAILS */}
      <Modal isOpen={isEditPaymentOpen} onClose={() => setIsEditPaymentOpen(false)} title={dict.editPaymentTitle}>
        <form onSubmit={handleEditPaymentSubmit} className="flex flex-col gap-4 text-xs">
          {editPayError && <Alert type="danger">{editPayError}</Alert>}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Payment Amount (₦)</label>
              <input
                type="number"
                value={editPayAmount}
                onChange={(e) => setEditPayAmount(e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-main">Payment Date</label>
              <input
                type="date"
                value={editPayDate}
                onChange={(e) => setEditPayDate(e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">Receipt ID Code</label>
            <input
              type="text"
              value={editPayReceipt}
              onChange={(e) => setEditPayReceipt(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-main">Audit Remarks</label>
            <textarea
              value={editPayRemarks}
              onChange={(e) => setEditPayRemarks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-bg-surface border border-border-main rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border-main/50 mt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditPaymentOpen(false)}>
              {dict.cancel}
            </Button>
            <Button variant="secondary" size="sm" type="submit">
              {dict.save}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
