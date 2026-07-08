import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert } from '../ui/SharedComponents';
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
  Building
} from 'lucide-react';
import { Language, Driver } from '../../types';
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
}

export const PaymentWorkflow: React.FC<PaymentWorkflowProps> = ({ lang }) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'approved' | 'rejected'>('all');

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

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
    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      
      const drvRes = await fetch('/api/drivers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const drvList = drvRes.ok ? await drvRes.json() : [];
      setDrivers(drvList);

      const payRes = await fetch('/api/payments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payList = payRes.ok ? await payRes.json() : [];

      // Link payment records to driver profile
      const linkedList = payList.map((p: any) => {
        const d = drvList.find((item: any) => item.id === p.driver_id);
        return {
          ...p,
          driverName: d ? d.fullName : 'Unknown Driver',
          company_driver_id: d ? d.company_driver_id : 'Pending'
        };
      });

      setPayments(linkedList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (payId: string, newStatus: 'approved' | 'rejected') => {
    const confirmMsg = lang === 'en' 
      ? `Are you sure you want to transition payment ${payId} to: ${newStatus.toUpperCase()}?` 
      : `Shin ko kun tabbata kuna son canza yanayin wannan biyan kudi ${payId} zuwa: ${newStatus.toUpperCase()}?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      const res = await fetch(`/api/payments/${payId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status');

      alert(lang === 'en' ? `Payment successfully ${newStatus}!` : `An riga an tabbatar da biyan kudin cikin nasara!`);
      fetchPaymentsAndDrivers(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = searchQuery === '' || 
      String(p.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.receipt_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.driverName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.company_driver_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate high-level metrics
  const submittedPayments = payments.filter(p => p.status === 'submitted');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const approvedTotal = payments.filter(p => p.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0);

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <Card className="bg-bg-surface border-border-main p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
              {lang === 'en' ? "Driver Submissions" : "Masu Jiran Dubawa (Drivers)"}
            </span>
            <span className="block text-xl font-extrabold text-text-main mt-1">
              {submittedPayments.length}
            </span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center">
            <Clock className="h-4 w-4 text-yellow-600" />
          </div>
        </Card>

        <Card className="bg-bg-surface border-border-main p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
              {lang === 'en' ? "Admin Reviews" : "Masu Jiran Tabbatarwa (Admins)"}
            </span>
            <span className="block text-xl font-extrabold text-text-main mt-1">
              {pendingPayments.length}
            </span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </div>
        </Card>

        <Card className="bg-bg-surface border-border-main p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
              {lang === 'en' ? "Total Certified Revenue" : "Jimillar Kudin Shiga"}
            </span>
            <span className="block text-xl font-extrabold text-green-600 dark:text-green-400 mt-1">
              ₦{approvedTotal.toLocaleString()}
            </span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-green-600" />
          </div>
        </Card>

      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-main/50 pb-3">
        <div>
          <h3 className="text-base font-extrabold text-text-main">
            {lang === 'en' ? "PAYMENT APPROVALS WORKFLOW" : "TSARIN TABBATAR DA BIYAN KUDI"}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {lang === 'en' 
              ? "Review receipts uploaded by drivers, authorize transaction logs, and generate professional PDF statements." 
              : "Duba takaddun da direbobi suka sanya, tabbatar da biyan kudi, sannan samar da takaddun shaida na PDF."}
          </p>
        </div>

        {/* Filter Selection */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? "Search receipts, drivers..." : "Nemo takaddun shaida..."}
              className="pl-8 pr-3 py-1.5 text-xs bg-bg-surface border border-border-main/75 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold w-48 sm:w-64"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-bg-surface border border-border-main/75 rounded-lg focus:outline-none text-text-main font-bold"
          >
            <option value="all">{lang === 'en' ? "All Statuses" : "Duk Yanayi"}</option>
            <option value="submitted">{lang === 'en' ? "Submitted (Driver)" : "Sabuwar Shiga (Direba)"}</option>
            <option value="pending">{lang === 'en' ? "Pending (Admin)" : "Ana Dubawa"}</option>
            <option value="approved">{lang === 'en' ? "Approved" : "An Amince"}</option>
            <option value="rejected">{lang === 'en' ? "Rejected" : "An Ki Amincewa"}</option>
          </select>
        </div>
      </div>

      {/* Table List */}
      {loading ? (
        <div className="py-12 text-center text-text-muted font-mono text-xs">
          Syncing transactional ledger...
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="py-12 text-center bg-bg-surface rounded-xl border border-dashed border-border-main p-8">
          <Receipt className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
          <span className="block text-xs font-bold text-text-main">
            {lang === 'en' ? "No transaction records found" : "Ba a sami tarihin biyan kudi ba"}
          </span>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border-main/60 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-bg-base/50 border-b border-border-main text-[11px] font-extrabold uppercase tracking-wider text-text-muted">
                  <th className="p-4">{lang === 'en' ? "Reference / Date" : "Lamba / Rana"}</th>
                  <th className="p-4">{lang === 'en' ? "Driver Details" : "Bayanin Direba"}</th>
                  <th className="p-4 text-center">{lang === 'en' ? "Installment No" : "Kashi No"}</th>
                  <th className="p-4 text-right">{lang === 'en' ? "Paid Amount" : "Kudi"}</th>
                  <th className="p-4 text-center">{lang === 'en' ? "Status" : "Yanayi"}</th>
                  <th className="p-4 text-right">{lang === 'en' ? "Actions" : "Ayyuka"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/40 font-medium">
                {filteredPayments.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-bg-base/20 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-text-main block">{p.receipt_number}</span>
                        <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                          {new Date(p.date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-text-main block">{p.driverName}</span>
                        <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                          ID: {p.company_driver_id || 'unassigned'}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono font-bold">
                        {p.installment_number}
                      </td>
                      <td className="p-4 text-right font-bold text-text-main font-mono">
                        ₦{p.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <Badge 
                          variant={
                            p.status === 'approved' ? 'success' : 
                            p.status === 'rejected' ? 'danger' : 
                            p.status === 'submitted' ? 'info' : 'warning'
                          }
                          className="capitalize text-[10px] font-bold"
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setSelectedReceipt(p)}
                            className="font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={lang === 'en' ? "Print PDF Receipt" : "Buga Takardar PDF"}
                          >
                            <Printer className="h-3.5 w-3.5 text-text-main" />
                            <span className="hidden md:inline">Receipt</span>
                          </Button>

                          {(p.status === 'submitted' || p.status === 'pending') && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'approved')}
                                className="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-600 transition-colors cursor-pointer border border-green-200/50"
                                title={lang === 'en' ? "Approve Payment" : "Amince"}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'rejected')}
                                className="p-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-brand-danger transition-colors cursor-pointer border border-rose-200/50"
                                title={lang === 'en' ? "Reject Payment" : "Ki Amincewa"}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PROFESSIONAL RECEIPT PDF GENERATOR MODAL --- */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-50 backdrop-blur-xs print:bg-white print:p-0">
          <Card className="w-full max-w-2xl bg-bg-surface border-border-main shadow-2xl p-6 text-text-main flex flex-col gap-6 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-full">
            
            {/* Action controls (Hidden during printing!) */}
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3 print:hidden">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-brand-gold" />
                {lang === 'en' ? "Professional Certified Receipt Statement" : "Takardar Tabbatar da Biyan Kudi"}
              </h3>
              <div className="flex items-center gap-2">
                <Button 
                  size="xs" 
                  variant="secondary" 
                  onClick={handlePrintReceipt}
                  className="font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3 w-3" />
                  {lang === 'en' ? "Print PDF" : "Buga Takarda"}
                </Button>
                <button onClick={() => setSelectedReceipt(null)} className="text-text-muted hover:text-text-main font-bold cursor-pointer">X</button>
              </div>
            </div>

            {/* --- PRINTABLE RECEIPT LAYOUT --- */}
            <div className="flex flex-col gap-6 p-4 border border-border-main/60 rounded-xl bg-white text-slate-950 font-sans print:border-none print:p-0">
              
              {/* Receipt Header Banner */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3">
                  <CircularLogo size="lg" className="border-2 border-slate-900 shadow-md animate-none" />
                  <div>
                    <h2 className="text-lg font-black tracking-tighter text-slate-950 uppercase font-mono">
                      RUQAYYA TRANSPORT LIMITED
                    </h2>
                    <span className="text-[10px] text-slate-500 font-bold block leading-relaxed">
                      Heavy Duty Carrier Logistics & Fleet Management Assets
                    </span>
                    <span className="text-[9px] text-slate-400 block font-medium">
                      HQ: Plot 14, Kano-Zaria Expressway, Kano State, Nigeria.
                    </span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <Badge variant="success" className="text-[10px] font-extrabold uppercase py-0.5 px-3 border border-slate-900 text-slate-950 font-mono">
                    OFFICIAL RECEIPT
                  </Badge>
                  <span className="text-[11px] font-bold text-slate-700 block mt-2">
                    Ref: <span className="font-mono font-extrabold text-slate-950">{selectedReceipt.receipt_number}</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                    Date: {new Date(selectedReceipt.date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Transaction details block */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">DRIVER PROFILE</span>
                  <span className="text-xs font-bold text-slate-950">{selectedReceipt.driverName}</span>
                  <span className="text-[10px] text-slate-500">Corporate Driver ID: {selectedReceipt.company_driver_id || 'Pending'}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">METRICS CONTROL</span>
                  <span className="text-xs font-bold text-slate-950">Installment Cycle: #{selectedReceipt.installment_number}</span>
                  <span className="text-[10px] text-slate-500">Method: {selectedReceipt.payment_method?.replace(/_/g, ' ').toUpperCase() || 'BANK TRANSFER'}</span>
                </div>
              </div>

              {/* Pricing ledger list */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Outstanding (₦)</th>
                      <th className="p-3 text-right">Amount Paid (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-900 font-medium">
                    <tr>
                      <td className="p-3">
                        <span className="font-bold">Truck Installment Payment #{selectedReceipt.installment_number}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">5-Day installment schedule contract.</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        ₦{selectedReceipt.outstanding_amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-950">
                        ₦{selectedReceipt.amount.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-950">
                      <td className="p-3 text-right" colSpan={2}>GRAND TOTAL RECEIVED:</td>
                      <td className="p-3 text-right font-mono text-[13px] text-slate-950">
                        ₦{selectedReceipt.amount.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in words */}
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/60 text-xs flex flex-col gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">AMOUNT IN WORDS</span>
                <span className="font-bold text-slate-950 italic capitalize">
                  {lang === 'en' ? "Certified transaction completed." : "An tabbatar da kammala biyan kudi na aiki."}
                </span>
              </div>

              {/* Signature section */}
              <div className="flex justify-between items-center pt-8 border-t border-slate-200 text-xs">
                <div className="text-center w-40">
                  <div className="border-b border-slate-400 h-8 flex items-end justify-center">
                    <span className="font-serif italic text-[11px] text-slate-600 font-bold">Musa Garba</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold block mt-1">Uploader / Accountant</span>
                </div>

                <div className="flex flex-col items-center">
                  {/* Decorative Certified circular stamp */}
                  <div className="h-14 w-14 rounded-full border-4 border-double border-green-600 flex items-center justify-center text-center text-green-600 font-black text-[8px] tracking-tighter uppercase select-none -rotate-12 opacity-85">
                    RUQAYYA<br/>CERTIFIED
                  </div>
                  <span className="text-[8px] text-slate-400 font-bold mt-1">Digital Stamp Verified</span>
                </div>

                <div className="text-center w-40">
                  <div className="border-b border-slate-400 h-8 flex items-end justify-center">
                    <span className="font-serif italic text-[11px] text-slate-600 font-bold">Signed Digital Auth</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold block mt-1">Board Director Approval</span>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-border-main/50 pt-3 mt-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => setSelectedReceipt(null)} className="font-bold cursor-pointer">
                {lang === 'en' ? "Close View" : "Rufe"}
              </Button>
            </div>

          </Card>
        </div>
      )}

    </div>
  );
};
