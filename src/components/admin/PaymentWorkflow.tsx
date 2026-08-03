import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/SharedComponents';
import { 
  FileText, 
  Check, 
  X, 
  Search, 
  Filter, 
  DollarSign, 
  Printer, 
  Download, 
  Clock, 
  Calendar,
  AlertCircle,
  TrendingUp,
  Receipt,
  User,
  ShieldCheck,
  Building,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Share2,
  Copy,
  ExternalLink,
  Eye,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Phone,
  Truck,
  ArrowUpRight,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Maximize2,
  ChevronRight,
  ArrowRight,
  CreditCard,
  Send,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Language, Driver, Vehicle } from '../../types';
import { CircularLogo } from '../CircularLogo';

interface PaymentWorkflowProps {
  lang: Language;
}

interface PaymentRecord {
  id: string;
  driver_id: string;
  amount: number;
  installment_number: number;
  outstanding_amount: number;
  date: string;
  receipt_number: string;
  status: 'submitted' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  recorded_by: string;
  remarks: string;
  payment_method?: string;
  reference_number?: string;
  created_at: string;
  driverName?: string;
  company_driver_id?: string;
  driverObj?: Driver | null;
  receipt_image_url?: string;
  vehicle_plate?: string;
}

// Convert amount to English words for official receipt
function numberToWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Naira Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 !== 0 ? ' ' + inWords(n % 1000000) : '');
    return n.toString();
  }
  
  return `${inWords(Math.floor(num))} Naira Only`;
}

export const PaymentWorkflow: React.FC<PaymentWorkflowProps> = ({ lang }) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companySettings, setCompanySettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'approved' | 'rejected'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Multi-selection for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detailed Modal Drawer State
  const [inspectPayment, setInspectPayment] = useState<PaymentRecord | null>(null);
  const [adminRemarksInput, setAdminRemarksInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Official Certified Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

  // Proof Image Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Toast message
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    fetchPaymentsAndDrivers();

    const handleDBChange = () => {
      fetchPaymentsAndDrivers(false);
    };
    window.addEventListener('db-change', handleDBChange);
    return () => window.removeEventListener('db-change', handleDBChange);
  }, []);

  const fetchPaymentsAndDrivers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setIsRefreshing(true);
    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      
      const [drvRes, payRes, vehRes, opsRes] = await Promise.all([
        fetch('/api/drivers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/payments', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/vehicles', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
        fetch('/api/operations/state', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
      ]);

      const drvList = drvRes.ok ? await drvRes.json() : [];
      setDrivers(drvList);

      const payList = payRes.ok ? await payRes.json() : [];
      const vehList = vehRes && vehRes.ok ? await vehRes.json() : [];
      setVehicles(vehList);

      const opsData = opsRes && opsRes.ok ? await opsRes.json() : null;
      if (opsData && opsData.state && opsData.state.company_settings) {
        setCompanySettings(opsData.state.company_settings);
      } else {
        const lastSSE = (window as any).lastSSEState;
        if (lastSSE && lastSSE.company_settings) {
          setCompanySettings(lastSSE.company_settings);
        }
      }

      // Link payment records to driver profile and vehicle details
      const linkedList: PaymentRecord[] = payList.map((p: any) => {
        const d = drvList.find((item: any) => item.id === p.driver_id || item.company_driver_id === p.company_driver_id);
        const v = vehList.find((item: any) => item.id === d?.assignedVehicleId || item.id === p.vehicle_id);
        return {
          ...p,
          driverName: d ? d.fullName : (p.driverName || 'Unknown Driver'),
          company_driver_id: d ? d.company_driver_id : (p.company_driver_id || 'Pending'),
          driverObj: d || null,
          vehicle_plate: v ? `${v.plateNumber} (${v.model})` : (d?.assignedVehicleId ? `Vehicle #${d.assignedVehicleId}` : 'Kano Tricycle')
        };
      });

      setPayments(linkedList);
    } catch (e) {
      console.error("PaymentWorkflow sync failed:", e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const token = localStorage.getItem('ruqayya_token') || '';
  const getAuthorizedUrl = (urlPath: string) => {
    if (!urlPath) return '';
    if (urlPath.startsWith('/api/documents/preview/') && !urlPath.includes('token=')) {
      return `${urlPath}?token=${encodeURIComponent(token)}`;
    }
    return urlPath;
  };

  const getDriverPassport = (d: Driver | null | undefined, idx = 0) => {
    if (!d) return '';
    const anyD = d as any;
    const docUrl = anyD.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url;
    const directUrl = anyD.passport_photo_url || anyD.passportPhoto || anyD.passport_photo || anyD.passportPhotoUrl || anyD.passport || '';
    const url = docUrl || directUrl || '';
    return url ? getAuthorizedUrl(url) : '';
  };

  const getReceiptProofImage = (p: PaymentRecord) => {
    return (
      (p as any).receipt_image_url ||
      (p as any).receipt_file ||
      (p as any).teller_image ||
      (p as any).receiptUrl ||
      p.driverObj?.documents?.find((doc: any) => doc.document_type === 'payment_receipt' || doc.document_type === 'teller')?.file_url ||
      null
    );
  };

  const handleUpdateStatus = async (payId: string, newStatus: 'approved' | 'rejected', remarks = '') => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      const res = await fetch(`/api/payments/${payId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, remarks: remarks || adminRemarksInput })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status');

      showToast(lang === 'en' ? `Payment ${payId} ${newStatus.toUpperCase()} successfully!` : `An tabbatar da biyan kudi ${payId} zuwa ${newStatus}!`);
      
      // Update local state optimistically
      setPayments(prev => prev.map(p => p.id === payId ? { ...p, status: newStatus, remarks: remarks || adminRemarksInput || p.remarks } : p));
      if (inspectPayment && inspectPayment.id === payId) {
        setInspectPayment(prev => prev ? { ...prev, status: newStatus, remarks: remarks || adminRemarksInput || prev.remarks } : null);
      }
      setAdminRemarksInput('');
      fetchPaymentsAndDrivers(false);
    } catch (err: any) {
      alert(err.message || "Status update failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(lang === 'en' ? `Approve all ${selectedIds.length} selected payment records?` : `Shin kuna son amincewa da dukkan kudaden da kuka zaba?`)) return;

    setActionLoading(true);
    let count = 0;
    for (const id of selectedIds) {
      try {
        const token = localStorage.getItem('ruqayya_token') || '';
        await fetch(`/api/payments/${id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'approved', remarks: 'Batch approved by Operations Administrator' })
        });
        count++;
      } catch (err) {
        console.error(`Batch item ${id} failed:`, err);
      }
    }
    showToast(lang === 'en' ? `Batch approved ${count} payment records!` : `An amince da kudaden biya ${count}!`);
    setSelectedIds([]);
    setActionLoading(false);
    fetchPaymentsAndDrivers(false);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredPayments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPayments.map(p => p.id));
    }
  };

  // Generate WhatsApp Share Link
  const getWhatsAppShareLink = (p: PaymentRecord) => {
    const phone = p.driverObj?.phone ? p.driverObj.phone.replace(/[^0-9]/g, '') : '';
    const msg = `*RUQAYYA TRANSPORT LIMITED* 🚚
*OFFICIAL CERTIFIED PAYMENT STATEMENT*
-------------------------------------
*Receipt Ref:* ${p.receipt_number}
*Driver Name:* ${p.driverName || 'Driver'}
*Corporate ID:* ${p.company_driver_id || 'Pending'}
*Installment Cycle:* #${p.installment_number}
*Amount Paid:* ₦${p.amount.toLocaleString()}
*Outstanding Balance:* ₦${(p.outstanding_amount || 0).toLocaleString()}
*Payment Method:* ${(p.payment_method || 'Bank Transfer').replace(/_/g, ' ').toUpperCase()}
*Date:* ${new Date(p.date || Date.now()).toLocaleDateString('en-GB')}
*Status:* ${(p.status || 'APPROVED').toUpperCase()} (VERIFIED)

Thank you for your prompt remittance!
_Ruqayya Transport Fleet Operations Command_`;

    const encoded = encodeURIComponent(msg);
    return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  };

  const handleExportCSV = () => {
    const records = filteredPayments;
    const headers = ['Receipt No', 'Date', 'Driver Name', 'Driver ID', 'Installment #', 'Amount Paid (NGN)', 'Outstanding Balance (NGN)', 'Payment Method', 'Status', 'Recorded By', 'Remarks'];
    const rows = records.map(p => [
      `"${p.receipt_number}"`,
      `"${new Date(p.date).toLocaleDateString()}"`,
      `"${p.driverName || ''}"`,
      `"${p.company_driver_id || ''}"`,
      p.installment_number,
      p.amount,
      p.outstanding_amount,
      `"${p.payment_method || 'Bank Transfer'}"`,
      `"${p.status.toUpperCase()}"`,
      `"${p.recorded_by || 'System'}"`,
      `"${(p.remarks || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ruqayya_Payment_Approvals_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(lang === 'en' ? "CSV Ledger statement exported!" : "An goge rahoton biyan kudi zuwa CSV!");
  };

  // Filtered payments list
  const filteredPayments = payments.filter((p) => {
    const matchesSearch = searchQuery === '' || 
      String(p.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.receipt_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.driverName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.company_driver_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.amount || '').includes(searchQuery) ||
      String(p.payment_method || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || (p.payment_method || 'bank_transfer') === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  // Analytics Metrics
  const submittedPayments = payments.filter(p => p.status === 'submitted');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const approvedPayments = payments.filter(p => p.status === 'approved');
  const rejectedPayments = payments.filter(p => p.status === 'rejected');

  const approvedTotal = approvedPayments.reduce((acc, curr) => acc + curr.amount, 0);
  const pendingTotal = [...submittedPayments, ...pendingPayments].reduce((acc, curr) => acc + curr.amount, 0);

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 relative font-sans">

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl font-bold text-xs flex items-center gap-2 border border-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* --- HERO METRICS CONTROL CENTER --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Approved Certified Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-bg-surface border border-border-main/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-emerald-500/50 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
              {lang === 'en' ? "Total Certified Revenue" : "Jimillar Biyan Kudi"}
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 block tracking-tight">
              ₦{approvedTotal.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted font-medium">
              <span className="text-emerald-500 font-bold font-mono">{approvedPayments.length}</span>
              <span>{lang === 'en' ? "authorized transactions" : "biyan kudi da aka amince"}</span>
            </div>
          </div>
        </motion.div>

        {/* Pending & Driver Submissions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-bg-surface border border-border-main/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-yellow-500/50 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
              {lang === 'en' ? "Pending Verification" : "Masu Jiran Tabbatarwa"}
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
              <Clock className="h-4 w-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 block tracking-tight">
              ₦{pendingTotal.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted font-medium">
              <span className="text-amber-500 font-bold font-mono">{submittedPayments.length + pendingPayments.length}</span>
              <span>{lang === 'en' ? "awaiting approval" : "suna jiran dubawa"}</span>
            </div>
          </div>
        </motion.div>

        {/* Driver Upload Submissions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-bg-surface border border-border-main/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-sky-500/50 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl group-hover:bg-sky-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
              {lang === 'en' ? "Driver Receipts" : "Rasit din Direbobi"}
            </span>
            <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 font-bold">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-text-main block tracking-tight">
              {submittedPayments.length}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted font-medium">
              <span className="text-sky-500 font-bold font-mono">100%</span>
              <span>{lang === 'en' ? "uploaded with proof image" : "tare da hoton shaidar biya"}</span>
            </div>
          </div>
        </motion.div>

        {/* Total Ledger Records */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-bg-surface border border-border-main/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-brand-gold/50 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/5 rounded-full blur-xl group-hover:bg-brand-gold/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
              {lang === 'en' ? "Total System Log" : "Jimillar Tarihi"}
            </span>
            <div className="h-9 w-9 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-bold">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-brand-gold block tracking-tight">
              {payments.length}
            </span>
            <div className="flex items-center justify-between mt-1 text-[11px] text-text-muted">
              <span>{lang === 'en' ? "Rejections:" : "An Ki:"} <strong className="text-rose-500">{rejectedPayments.length}</strong></span>
              <button 
                onClick={() => fetchPaymentsAndDrivers(false)} 
                className="hover:text-brand-gold transition-colors flex items-center gap-1 font-bold text-[10px]"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {lang === 'en' ? "Sync Live" : "Sake Loda"}
              </button>
            </div>
          </div>
        </motion.div>

      </div>

      {/* --- CONTROL HEADER & FILTER BAR --- */}
      <div className="bg-bg-surface border border-border-main/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        
        <div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-base font-black text-text-main tracking-tight uppercase">
              {lang === 'en' ? "LIVE PAYMENT APPROVALS WORKFLOW" : "TSARIN TABBATAR DA BIYAN KUDI NA DUK LOKACI"}
            </h3>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {lang === 'en' 
              ? "Review receipts uploaded by drivers, verify payment proof slips, approve installment logs, and issue certified PDF statements." 
              : "Duba takaddun da direbobi suka sanya, tabbatar da biyan kudi, sannan samar da takaddun shaida na PDF."}
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Batch approve action button if items selected */}
          {selectedIds.length > 0 && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Button
                size="sm"
                onClick={handleBatchApprove}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                {lang === 'en' ? `Approve Selected (${selectedIds.length})` : `Amince da Zabi (${selectedIds.length})`}
              </Button>
            </motion.div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="font-bold text-xs flex items-center gap-1.5 cursor-pointer border-border-main hover:bg-bg-base text-text-main"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">{lang === 'en' ? "Export Ledger CSV" : "Fitar da CSV"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchPaymentsAndDrivers(false)}
            className="font-bold text-xs flex items-center gap-1 cursor-pointer border-border-main hover:bg-bg-base"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-brand-gold ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

      </div>

      {/* --- STATUS FILTER PILLS & SEARCH BAR --- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'all', label: lang === 'en' ? 'All' : 'Duk', count: payments.length },
            { key: 'submitted', label: lang === 'en' ? 'Submitted' : 'Shigowa', count: submittedPayments.length, color: 'border-sky-500/40 text-sky-500' },
            { key: 'pending', label: lang === 'en' ? 'Pending Review' : 'Masu Jiran Duba', count: pendingPayments.length, color: 'border-amber-500/40 text-amber-500' },
            { key: 'approved', label: lang === 'en' ? 'Approved' : 'An Amince', count: approvedPayments.length, color: 'border-emerald-500/40 text-emerald-500' },
            { key: 'rejected', label: lang === 'en' ? 'Rejected' : 'An Ki', count: rejectedPayments.length, color: 'border-rose-500/40 text-rose-500' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-brand-navy text-white shadow-md border border-brand-navy'
                  : 'bg-bg-surface text-text-muted hover:text-text-main border border-border-main/60'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-bg-base text-text-main'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Method Controls */}
        <div className="flex items-center gap-2">
          
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? "Search driver, ID, receipt ref..." : "Bincika sunan direba, lamba..."}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-bg-surface border border-border-main rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold text-text-main font-medium shadow-xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-main"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-bg-surface border border-border-main rounded-xl text-text-main font-bold focus:outline-none cursor-pointer"
          >
            <option value="all">{lang === 'en' ? "All Channels" : "Duk Hanyoyi"}</option>
            <option value="bank_transfer">{lang === 'en' ? "Bank Transfer" : "Canja Kudi (Bank)"}</option>
            <option value="pos">{lang === 'en' ? "POS Terminal" : "POS"}</option>
            <option value="cash">{lang === 'en' ? "Direct Cash" : "Tsabar Kudi"}</option>
          </select>

        </div>

      </div>

      {/* --- TABLE & LIST DISPLAY --- */}
      {loading ? (
        <div className="py-20 text-center bg-bg-surface border border-border-main rounded-2xl flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 text-brand-gold animate-spin" />
          <span className="text-xs font-bold font-mono text-text-muted">
            {lang === 'en' ? "Synchronizing real-time payment approvals ledger..." : "Ana loda tsarin bayanan biyan kudi..."}
          </span>
        </div>
      ) : filteredPayments.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-16 text-center bg-bg-surface rounded-2xl border-2 border-dashed border-border-main/70 p-8 flex flex-col items-center justify-center gap-3"
        >
          <div className="h-12 w-12 rounded-full bg-bg-base border border-border-main flex items-center justify-center text-text-muted">
            <Receipt className="h-6 w-6 opacity-60" />
          </div>
          <div>
            <span className="block text-sm font-extrabold text-text-main">
              {lang === 'en' ? "No matching payment records found" : "Ba a sami tarihin biyan kudi ba"}
            </span>
            <span className="text-xs text-text-muted block mt-1">
              {lang === 'en' ? "Try adjusting your search query or status filter criteria." : "Sake gwada neman takardar ta amfani da wata kalma."}
            </span>
          </div>
          {searchQuery && (
            <Button size="xs" variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="mt-2 font-bold cursor-pointer">
              {lang === 'en' ? "Clear Search Filters" : "Goge Bincike"}
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="bg-bg-surface border border-border-main rounded-2xl overflow-hidden shadow-xs">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-bg-base/70 border-b border-border-main text-[11px] font-black uppercase tracking-wider text-text-muted select-none">
                  <th className="p-3.5 w-10 text-center">
                    <button onClick={handleSelectAll} className="text-text-muted hover:text-text-main cursor-pointer">
                      {selectedIds.length > 0 && selectedIds.length === filteredPayments.length ? (
                        <CheckSquare className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5">{lang === 'en' ? "DRIVER PROFILE" : "DIREBA"}</th>
                  <th className="p-3.5">{lang === 'en' ? "REFERENCE / DATE" : "LAMBA DA RANA"}</th>
                  <th className="p-3.5 text-center">{lang === 'en' ? "INSTALLMENT" : "KASHI"}</th>
                  <th className="p-3.5 text-right">{lang === 'en' ? "AMOUNT PAID" : "KUDIN DA AKA BIYA"}</th>
                  <th className="p-3.5 text-center">{lang === 'en' ? "CHANNEL / STATUS" : "STATUS"}</th>
                  <th className="p-3.5 text-right">{lang === 'en' ? "ACTIONS" : "AYYUKA"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/50 font-medium">
                {filteredPayments.map((p, index) => {
                  const driverPhoto = getDriverPassport(p.driverObj, index);
                  const isSelected = selectedIds.includes(p.id);

                  return (
                    <motion.tr 
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      className={`hover:bg-bg-base/40 transition-colors ${isSelected ? 'bg-brand-gold/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <button onClick={() => handleToggleSelect(p.id)} className="text-text-muted hover:text-text-main cursor-pointer">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Square className="h-4 w-4 text-border-main" />
                          )}
                        </button>
                      </td>

                      {/* Driver Passport Avatar & Name */}
                      <td className="p-3.5">
                        <div 
                          className="flex items-center gap-3 cursor-pointer group"
                          onClick={() => setInspectPayment(p)}
                        >
                          <div className="relative shrink-0">
                            {driverPhoto ? (
                              <img
                                src={driverPhoto}
                                alt={p.driverName}
                                className="h-10 w-10 rounded-xl object-cover border-2 border-border-main/80 group-hover:border-brand-gold transition-all shadow-xs"
                                referrerPolicy="no-referrer"
                                onError={(e: any) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`h-10 w-10 rounded-xl bg-slate-900 border-2 border-border-main/80 flex items-center justify-center font-black text-brand-gold text-xs shadow-xs ${driverPhoto ? 'hidden' : ''}`}>
                              {p.driverName ? p.driverName.substring(0, 2).toUpperCase() : 'DR'}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-bg-surface ${
                              p.status === 'approved' ? 'bg-emerald-500' :
                              p.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'
                            }`} />
                          </div>

                          <div className="flex flex-col">
                            <span className="font-extrabold text-text-main group-hover:text-brand-gold transition-colors text-xs flex items-center gap-1">
                              {p.driverName}
                              <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-text-muted font-mono font-semibold bg-bg-base px-1.5 py-0.2 rounded">
                                ID: {p.company_driver_id || 'DRV-2026-001'}
                              </span>
                              {p.vehicle_plate && (
                                <span className="text-[9px] text-text-muted font-mono truncate max-w-[120px]">
                                  {p.vehicle_plate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Reference & Date */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-text-main text-xs">{p.receipt_number}</span>
                          <span className="text-[10px] text-text-muted font-mono mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(p.date || p.created_at || Date.now()).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </td>

                      {/* Installment No */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-extrabold text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-lg text-xs">
                            #{p.installment_number}
                          </span>
                          <span className="text-[9px] text-text-muted font-mono mt-0.5">
                            Remittance
                          </span>
                        </div>
                      </td>

                      {/* Amount Paid */}
                      <td className="p-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-black text-text-main text-sm">
                            ₦{p.amount.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono mt-0.5">
                            Bal: ₦{(p.outstanding_amount || 0).toLocaleString()}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge & Channel */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge 
                            variant={
                              p.status === 'approved' ? 'success' : 
                              p.status === 'rejected' ? 'danger' : 
                              p.status === 'submitted' ? 'info' : 'warning'
                            }
                            className="capitalize text-[10px] font-black px-2.5 py-0.5"
                          >
                            {p.status}
                          </Badge>
                          <span className="text-[9px] text-text-muted font-mono uppercase font-bold">
                            {(p.payment_method || 'bank_transfer').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Inspect Detail Button */}
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setInspectPayment(p)}
                            className="font-bold flex items-center gap-1 cursor-pointer hover:bg-bg-base border-border-main"
                            title={lang === 'en' ? "Inspect Details & Verify" : "Duba Bayani"}
                          >
                            <Eye className="h-3.5 w-3.5 text-brand-gold" />
                            <span className="hidden lg:inline">{lang === 'en' ? "Inspect" : "Duba"}</span>
                          </Button>

                          {/* Print PDF Receipt Button */}
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => setSelectedReceipt(p)}
                            className="font-bold flex items-center gap-1 cursor-pointer"
                            title={lang === 'en' ? "Official Certified Receipt" : "Takardar Biyan Kudi"}
                          >
                            <Printer className="h-3.5 w-3.5 text-text-main" />
                            <span className="hidden xl:inline">Receipt</span>
                          </Button>

                          {/* Instant Quick Approval Actions for pending/submitted */}
                          {(p.status === 'submitted' || p.status === 'pending') && (
                            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-border-main/50">
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'approved')}
                                disabled={actionLoading}
                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white transition-all cursor-pointer border border-emerald-500/30"
                                title={lang === 'en' ? "Approve Payment" : "Amince"}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'rejected')}
                                disabled={actionLoading}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white transition-all cursor-pointer border border-rose-500/30"
                                title={lang === 'en' ? "Reject Payment" : "Ki Amincewa"}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                        </div>
                      </td>

                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Stats */}
          <div className="bg-bg-base/50 p-3 border-t border-border-main flex items-center justify-between text-xs text-text-muted font-medium">
            <span>
              {lang === 'en' ? `Showing ${filteredPayments.length} of ${payments.length} total payment logs` : `Ana nuna ${filteredPayments.length} daga cikakken tarihin ${payments.length}`}
            </span>
            <span className="font-mono font-bold text-text-main">
              Total Filtered: ₦{filteredPayments.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
            </span>
          </div>

        </div>
      )}


      {/* --- LIVE PAYMENT INSPECTION & APPROVAL MODAL DRAWER --- */}
      <AnimatePresence>
        {inspectPayment && (
          <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-bg-surface border border-border-main rounded-2xl shadow-2xl p-5 sm:p-6 text-text-main my-auto flex flex-col gap-5"
            >
              
              {/* Drawer Header */}
              <div className="flex justify-between items-center border-b border-border-main/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-main uppercase font-mono tracking-tight">
                      {lang === 'en' ? "LIVE TRANSACTION VERIFICATION & AUDIT" : "DUBI TARIHIN BIYAN KUDI CIKIN SAURI"}
                    </h3>
                    <span className="text-[10px] text-text-muted font-mono font-semibold">
                      Ref: <strong className="text-brand-gold">{inspectPayment.receipt_number}</strong>
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setInspectPayment(null)} 
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-base transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Driver Profile Header Banner */}
              <div className="p-4 bg-bg-base border border-border-main/60 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }}
                    src={getDriverPassport(inspectPayment.driverObj)}
                    alt={inspectPayment.driverName}
                    className="h-14 w-14 rounded-2xl object-cover border-2 border-brand-gold shadow-md shrink-0"
                  />
                  <div>
                    <h4 className="font-extrabold text-text-main text-sm">{inspectPayment.driverName}</h4>
                    <span className="text-xs text-text-muted font-mono block font-semibold mt-0.5">
                      Corporate ID: {inspectPayment.company_driver_id || 'DRV-2026-001'}
                    </span>
                    <span className="text-[10px] text-brand-gold font-mono font-bold block mt-0.5">
                      {inspectPayment.vehicle_plate || 'Kano Carrier Unit'}
                    </span>
                  </div>
                </div>

                {inspectPayment.driverObj?.phone && (
                  <a
                    href={`tel:${inspectPayment.driverObj.phone}`}
                    className="p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/30 text-brand-gold hover:bg-brand-gold hover:text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{inspectPayment.driverObj.phone}</span>
                  </a>
                )}
              </div>

              {/* Main Detailed Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                <div className="p-3.5 bg-bg-base/60 border border-border-main/50 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-wider font-mono block">TRANSACTION METRICS</span>
                  <div className="flex justify-between items-center py-1 border-b border-border-main/30">
                    <span className="text-text-muted">Amount Paid:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">₦{inspectPayment.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-main/30">
                    <span className="text-text-muted">Installment Cycle:</span>
                    <span className="font-mono font-bold text-brand-gold">Cycle #{inspectPayment.installment_number}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-main/30">
                    <span className="text-text-muted">Outstanding Balance:</span>
                    <span className="font-mono font-bold text-text-main">₦{(inspectPayment.outstanding_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-text-muted">Date & Time:</span>
                    <span className="font-mono font-semibold text-text-main">{new Date(inspectPayment.date || inspectPayment.created_at || Date.now()).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-bg-base/60 border border-border-main/50 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-wider font-mono block">PAYMENT AUDIT & CHANNEL</span>
                  <div className="flex justify-between items-center py-1 border-b border-border-main/30">
                    <span className="text-text-muted">Payment Channel:</span>
                    <span className="font-mono font-bold text-text-main uppercase">{(inspectPayment.payment_method || 'bank_transfer').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-main/30">
                    <span className="text-text-muted">Bank Reference / Ref:</span>
                    <span className="font-mono font-bold text-text-main">{inspectPayment.reference_number || inspectPayment.receipt_number}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-main/30">
                    <span className="text-text-muted">Logged By:</span>
                    <span className="font-semibold text-text-main">{inspectPayment.recorded_by || 'Driver Mobile Upload'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-text-muted">Current Verification:</span>
                    <Badge variant={inspectPayment.status === 'approved' ? 'success' : inspectPayment.status === 'rejected' ? 'danger' : 'warning'} className="capitalize font-black text-[10px]">
                      {inspectPayment.status}
                    </Badge>
                  </div>
                </div>

              </div>

              {/* Teller Receipt Image / Attached Proof Section */}
              <div className="p-3.5 bg-bg-base/40 border border-border-main/50 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-brand-gold" />
                    {lang === 'en' ? "UPLOADED TELLER / PAYMENT SLIP PROOF" : "TAKARDAR SHAIDAR BIYAN KUDI"}
                  </span>
                  {getReceiptProofImage(inspectPayment) && (
                    <button
                      onClick={() => setLightboxImage(getReceiptProofImage(inspectPayment))}
                      className="text-[11px] font-bold text-brand-gold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="h-3 w-3" />
                      {lang === 'en' ? "View Full Screen" : "Cikakken Hoto"}
                    </button>
                  )}
                </div>

                {getReceiptProofImage(inspectPayment) ? (
                  <div 
                    className="relative group rounded-xl overflow-hidden border border-border-main max-h-48 bg-slate-950 flex items-center justify-center cursor-pointer"
                    onClick={() => setLightboxImage(getReceiptProofImage(inspectPayment))}
                  >
                    <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }} 
                      src={getReceiptProofImage(inspectPayment)} 
                      alt="Bank Teller Slip" 
                      className="w-full h-48 object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2">
                      <Eye className="h-5 w-5 text-brand-gold" />
                      Click to expand proof slip
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center border-2 border-dashed border-border-main/60 rounded-xl text-text-muted text-xs flex flex-col items-center justify-center gap-1">
                    <Info className="h-5 w-5 text-text-muted opacity-60" />
                    <span>{lang === 'en' ? "Direct bank deposit / No image slip attached." : "Babu hoton da aka makala."}</span>
                  </div>
                )}
              </div>

              {/* Admin Notes & Remarks Input Box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-text-main block">
                  {lang === 'en' ? "Administrator Authorization Notes & Remarks" : "Bayani ko Sharuɗɗa"}
                </label>
                <input
                  type="text"
                  value={adminRemarksInput}
                  onChange={(e) => setAdminRemarksInput(e.target.value)}
                  placeholder={inspectPayment.remarks || (lang === 'en' ? "Enter remarks or authorization code..." : "Rubuta dalili ko sako...")}
                  className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold text-text-main"
                />
              </div>

              {/* Drawer Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border-main/60 pt-4 mt-1">
                
                {/* Secondary Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={getWhatsAppShareLink(inspectPayment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </a>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const p = inspectPayment;
                      setInspectPayment(null);
                      setSelectedReceipt(p);
                    }}
                    className="font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{lang === 'en' ? "Print PDF" : "Buga Takarda"}</span>
                  </Button>
                </div>

                {/* Primary Approval / Rejection Controls */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setInspectPayment(null)}
                    className="text-text-muted hover:text-text-main font-bold text-xs cursor-pointer"
                  >
                    {lang === 'en' ? "Cancel" : "Fasa"}
                  </Button>

                  <button
                    onClick={() => handleUpdateStatus(inspectPayment.id, 'rejected')}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    <span>{lang === 'en' ? "Reject" : "Ki Amincewa"}</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(inspectPayment.id, 'approved')}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    <span>{lang === 'en' ? "Approve Payment" : "Tabbatar da Biya"}</span>
                  </button>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* --- PROFESSIONAL CERTIFIED RECEIPT MODAL --- */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm print:bg-white print:p-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-bg-surface border border-border-main rounded-2xl shadow-2xl p-5 sm:p-6 text-text-main flex flex-col gap-5 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-full print:rounded-none"
            >
              
              {/* Action Toolbar Controls (Hidden during print!) */}
              <div className="flex justify-between items-center border-b border-border-main/50 pb-3 print:hidden">
                <div className="flex items-center gap-2">
                  <Button 
                    size="xs" 
                    variant="outline" 
                    onClick={() => setSelectedReceipt(null)}
                    className="font-bold flex items-center gap-1 cursor-pointer text-xs"
                  >
                    ← {lang === 'en' ? "Back" : "Baya"}
                  </Button>
                  <h3 className="text-sm font-black text-text-main flex items-center gap-1.5 font-mono">
                    <FileText className="h-4 w-4 text-brand-gold" />
                    {lang === 'en' ? "OFFICIAL RECEIPT" : "TAKARDAR BIYAN KUDI"}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={getWhatsAppShareLink(selectedReceipt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </a>

                  <Button 
                    size="xs" 
                    variant="secondary" 
                    onClick={handlePrintReceipt}
                    className="font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-text-main" />
                    {lang === 'en' ? "Print PDF" : "Buga Takarda"}
                  </Button>

                  <button 
                    onClick={() => setSelectedReceipt(null)} 
                    className="p-1 rounded-lg text-text-muted hover:text-text-main cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* --- PRINTABLE A4 CERTIFIED RECEIPT LAYOUT --- */}
              <div className="flex flex-col gap-4 p-4 sm:p-5 border border-border-main/80 rounded-2xl bg-white text-slate-950 font-sans print:border-none print:p-0 relative overflow-hidden shadow-inner max-h-[75vh] overflow-y-auto">
                
                {/* Background Watermark Stamp */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                  <CircularLogo size="lg" className="w-96 h-96 scale-150" />
                </div>

                {/* Receipt Header Banner */}
                <div className="flex justify-between items-start border-b-2 border-slate-950 pb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <CircularLogo size="md" className="border-2 border-slate-950 shadow-sm shrink-0" />
                    <div>
                      <h2 className="text-base sm:text-lg font-black tracking-tighter text-slate-950 uppercase font-mono">
                        {companySettings.companyName || 'RUQAYYA TRANSPORT LIMITED'}
                      </h2>
                      <span className="text-[10px] text-slate-600 font-bold block leading-relaxed uppercase tracking-wider">
                        Heavy Duty Carrier Logistics & Fleet Management Assets
                      </span>
                      <span className="text-[9px] text-slate-500 block font-medium">
                        {companySettings.companyAddress || 'HQ: Plot 14, Kano-Zaria Expressway, Kano State, Nigeria.'}
                      </span>
                      {(companySettings.phone || companySettings.email) && (
                        <span className="text-[8px] text-slate-400 block font-mono mt-0.5">
                          Tel: {companySettings.phone || '+234 803 123 4567'} | Email: {companySettings.email || 'info@ruqayyatransport.com'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end shrink-0">
                    <span className="bg-slate-950 text-white text-[9px] font-black uppercase py-0.5 px-2.5 rounded font-mono tracking-wider">
                      OFFICIAL RECEIPT
                    </span>
                    <span className="text-[10px] font-bold text-slate-800 block mt-1.5">
                      Ref: <span className="font-mono font-black text-slate-950">{selectedReceipt.receipt_number}</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
                      Date: {new Date(selectedReceipt.date || selectedReceipt.created_at || Date.now()).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>

                {/* Driver Profile & Transaction Header */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs relative z-10">
                  
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                    <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }}
                      src={getDriverPassport(selectedReceipt.driverObj)}
                      alt={selectedReceipt.driverName}
                      className="h-12 w-12 rounded-xl object-cover border border-slate-300 shadow-xs shrink-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">DRIVER INFORMATION</span>
                      <span className="text-xs font-bold text-slate-950">{selectedReceipt.driverName}</span>
                      <span className="text-[10px] text-slate-600 font-mono font-semibold">Corporate ID: {selectedReceipt.company_driver_id || 'DRV-2026-001'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-center gap-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">FINANCIAL CONTRACT METRICS</span>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600">Installment Cycle:</span>
                      <span className="font-mono font-bold text-slate-950">Cycle #{selectedReceipt.installment_number}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600">Payment Channel:</span>
                      <span className="font-mono font-bold text-slate-950 uppercase">{(selectedReceipt.payment_method || 'bank_transfer').replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                </div>

                {/* Pricing Breakdown Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden relative z-10">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                        <th className="p-3">DESCRIPTION</th>
                        <th className="p-3 text-right">OUTSTANDING (₦)</th>
                        <th className="p-3 text-right">AMOUNT PAID (₦)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-950 font-medium">
                      <tr>
                        <td className="p-3">
                          <span className="font-bold block">Tricycle Hire-Purchase Remittance #{selectedReceipt.installment_number}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">5-Day installment schedule agreement.</span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600 font-semibold">
                          ₦{(selectedReceipt.outstanding_amount || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-950 text-sm">
                          ₦{selectedReceipt.amount.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-950">
                        <td className="p-3 text-right uppercase tracking-wider text-[10px] font-black" colSpan={2}>GRAND TOTAL RECEIVED:</td>
                        <td className="p-3 text-right font-mono text-base font-black text-emerald-700">
                          ₦{selectedReceipt.amount.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Amount in Words */}
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs flex flex-col gap-0.5 relative z-10">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">AMOUNT IN WORDS</span>
                  <span className="font-bold text-slate-950 italic capitalize text-xs">
                    {numberToWords(selectedReceipt.amount)}
                  </span>
                </div>

                {/* Digital Stamp & Signatures */}
                <div className="flex justify-between items-end pt-6 border-t border-slate-200 text-xs relative z-10">
                  
                  <div className="text-center w-36">
                    <div className="border-b border-slate-400 h-8 flex items-end justify-center pb-0.5">
                      <span className="font-serif italic text-xs text-slate-800 font-bold">Musa Garba</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold block mt-1">Accounts Officer</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="h-16 w-16 rounded-full border-4 border-double border-emerald-600 flex items-center justify-center text-center text-emerald-700 font-black text-[8px] tracking-tighter uppercase select-none -rotate-12 bg-emerald-50/50 shadow-xs">
                      RUQAYYA<br/>CERTIFIED
                    </div>
                    <span className="text-[8px] text-slate-500 font-bold mt-1 font-mono">Digital Token Verified</span>
                  </div>

                  <div className="text-center w-36">
                    <div className="border-b border-slate-400 h-8 flex items-end justify-center pb-0.5">
                      <span className="font-serif italic text-xs text-slate-800 font-bold">Executive Board</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold block mt-1">Director Approval</span>
                  </div>

                </div>

              </div>

              {/* Modal Footer Controls */}
              <div className="flex justify-between items-center border-t border-border-main/50 pt-3 print:hidden">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedReceipt(null)} 
                  className="font-bold cursor-pointer text-xs"
                >
                  ← {lang === 'en' ? "Back to Payments" : "Koma Baya"}
                </Button>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-text-muted font-mono hidden sm:inline">
                    Ruqayya Transport ERP • Serial Auth Verified
                  </span>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => setSelectedReceipt(null)} 
                    className="font-bold cursor-pointer"
                  >
                    {lang === 'en' ? "Close View" : "Rufe"}
                  </Button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* --- PROOF IMAGE LIGHTBOX MODAL --- */}
      <AnimatePresence>
        {lightboxImage && (
          <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center"
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-2 right-2 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 z-10 cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>

              <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }}
                src={lightboxImage}
                alt="Enlarged Payment Proof"
                className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-700"
              />

              <div className="mt-3 flex items-center gap-3">
                <a
                  href={lightboxImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-brand-gold text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Original Image</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
