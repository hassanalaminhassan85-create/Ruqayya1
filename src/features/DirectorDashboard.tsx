/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import EnterpriseDirectory from '../components/admin/EnterpriseDirectory';
import { OverviewTab } from '../components/director/OverviewTab';
import { CycleTimer } from '../components/director/CycleTimer';
import { FinancialCommandCenter } from '../components/admin/FinancialCommandCenter';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Terminal, 
  ShieldAlert, 
  Award, 
  FileSpreadsheet, 
  Percent, 
  LayoutGrid, 
  Users, 
  Truck, 
  Settings, 
  DollarSign, 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Search, 
  FileText, 
  CheckCircle, 
  XCircle, 
  UserX, 
  UserCheck, 
  RefreshCw, 
  Briefcase, 
  MapPin, 
  AlertTriangle, 
  Calendar, 
  Printer, 
  Download, 
  Info, 
  Lock,
  Unlock,
  Building,
  Phone,
  Mail,
  Coins,
  Globe
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge, Alert } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { CircularLogo } from '../components/CircularLogo';
import { 
  AuditLog, 
  Dictionary, 
  Language, 
  FinancialRecord, 
  Vehicle, 
  Driver, 
  AppNotification,
  Shareholder
} from '../types';
import { PeopleManagement } from '../components/admin/PeopleManagement';

interface DirectorDashboardProps {
  lang: Language;
  dictionary: Dictionary;
  activeTab?: 'overview' | 'analytics' | 'cycles' | 'admins' | 'drivers' | 'shareholders' | 'company' | 'reports' | 'audit' | 'monitoring' | 'directory' | 'people';
  setActiveTab?: (tab: 'overview' | 'analytics' | 'cycles' | 'admins' | 'drivers' | 'shareholders' | 'company' | 'reports' | 'audit' | 'monitoring' | 'directory' | 'people') => void;
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({ lang, dictionary, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) => {
  // Real-time states synchronized via Server-Sent Events
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [shareholders, setShareholders] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>({});
  const [shareholderSettings, setShareholderSettings] = useState<any>({});
  const [tripManifests, setTripManifests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [localActiveTab, setLocalActiveTab] = useState<'overview' | 'analytics' | 'cycles' | 'admins' | 'drivers' | 'shareholders' | 'company' | 'reports' | 'audit' | 'monitoring' | 'directory' | 'people'>('overview');
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;
  const [monitoringData, setMonitoringData] = useState<any>(null);

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setRestoreSuccess(null);
    setRestoreError(null);
    try {
      const token = localStorage.getItem('ruqayya_token');
      const res = await fetch('/api/director/backup', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(lang === 'en' ? 'Failed to download secure backup file.' : 'An kasa sauke fayil din ajiya.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ruqayya_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setRestoreSuccess(lang === 'en' ? "Backup downloaded successfully!" : "An yi nasarar sauke fayil din ajiya!");
    } catch (err: any) {
      setRestoreError(err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleUploadRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreLoading(true);
    setRestoreSuccess(null);
    setRestoreError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backupData = JSON.parse(text);

        if (!backupData || !Array.isArray(backupData.users) || !Array.isArray(backupData.vehicles) || !Array.isArray(backupData.audit_logs)) {
          throw new Error(lang === 'en' ? 'Invalid backup structure. The file must contain standard tables.' : 'Tsarin fayil din ajiya ba daidai ba ne.');
        }

        const token = localStorage.getItem('ruqayya_token');
        const res = await fetch('/api/director/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(backupData)
        });

        if (!res.ok) {
          const errObj = await res.json();
          throw new Error(errObj.error || (lang === 'en' ? 'Restoration failed' : 'Sake loda ajiya ya gaza'));
        }

        setRestoreSuccess(lang === 'en' 
          ? "Database successfully restored and synchronized!" 
          : "An yi nasarar sake loda dukkan bayanan tare da daidaita tsarin!");
      } catch (err: any) {
        setRestoreError(err.message);
      } finally {
        setRestoreLoading(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      setRestoreError(lang === 'en' ? 'Failed to read backup file.' : 'An kasa karanta fayil din.');
      setRestoreLoading(false);
    };

    reader.readAsText(file);
  };

  useEffect(() => {
    if (activeTab !== 'monitoring') return;

    const fetchMonitoring = async () => {
      try {
        const token = localStorage.getItem('ruqayya_token');
        const res = await fetch('/api/director/sse-monitoring', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setMonitoringData(data);
        }
      } catch (err) {
        console.error("Failed to fetch SSE monitoring statistics:", err);
      }
    };

    fetchMonitoring();
    const interval = setInterval(fetchMonitoring, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Sub-feature interactive states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<any | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddShareholderModal, setShowAddShareholderModal] = useState(false);
  
  // Forms states
  const [adminForm, setAdminForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [shareholderForm, setShareholderForm] = useState({ fullName: '', email: '', phone: '', address: '', investmentAmount: '' });
  const [cycleGoalForm, setCycleGoalForm] = useState({ 
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0], 
    endGoalTons: '200' 
  });
  const [showCyclePauseModal, setShowCyclePauseModal] = useState(false);
  const [showCycleResumeModal, setShowCycleResumeModal] = useState(false);
  const [cyclePauseReason, setCyclePauseReason] = useState('');
  const [cycleResumeReason, setCycleResumeReason] = useState('');
  const [restForm, setRestForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [accidentForm, setAccidentForm] = useState({ date: '', description: '', damageEstimate: '', severity: 'minor' });
  const [selectedDriverIdForAction, setSelectedDriverIdForAction] = useState<string | null>(null);
  
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print/Report Selection states
  const [selectedReportType, setSelectedReportType] = useState<'financial' | 'driver' | 'shareholder' | 'revenue' | 'expense' | 'current_cycle' | 'history'>('financial');

  const fetchFallbackData = async () => {
    const token = api.getToken();
    if (!token || token === 'null' || token === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      const [lgList, finList, vhList, drList, shList, cyList, ntList] = await Promise.all([
        api.getAuditLogs(),
        api.getFinance(),
        api.getVehicles(),
        api.getDrivers(),
        api.getShareholders(),
        api.request('/api/director/cycles/history').catch(() => []), // safety fallback
        api.getNotifications()
      ]);
      setLogs(lgList || []);
      setFinancials(finList || []);
      setVehicles(vhList || []);
      setDrivers(drList || []);
      setShareholders(shList || []);
      setCycles(cyList || []);
      setNotifications(ntList || []);
    } catch (err) {
      console.error("HTTP Fallback also failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Establish SSE stream connection on mount
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      const token = localStorage.getItem('ruqayya_token') || '';
      try {
        eventSource = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);

        eventSource.onopen = () => {
          setSseConnected(true);
          setLoading(false);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'db_update') {
              (window as any).lastSSEState = data;
              window.dispatchEvent(new CustomEvent('db-change', { detail: data }));

              setLogs(data.audit_logs || []);
              setFinancials(data.financials || []);
              setVehicles(data.vehicles || []);
              setDrivers(data.drivers || []);
              setAdmins(data.admins || []);
              setShareholders(data.shareholders || []);
              setCycles(data.cycles || []);
              setCompanySettings(data.company_settings || {});
              setShareholderSettings(data.shareholder_settings || {});
              setTripManifests(data.trip_manifests || []);
              setNotifications(data.notifications || []);
              setVouchers(data.vouchers || []);
              setUsers(data.users || []);
              setLoading(false);
            }
          } catch (err) {
            console.error("Failed to parse live stream chunk:", err);
          }
        };

        eventSource.onerror = (err) => {
          console.warn("SSE connection interrupted. Falling back to HTTP queries...", err);
          setSseConnected(false);
          if (eventSource) {
            eventSource.close();
          }
          
          // Manual HTTP polling fallback if SSE drops
          fetchFallbackData();
        };
      } catch (e) {
        console.warn("EventSource creation blocked or unsupported in this sandboxed context:", e);
        setSseConnected(false);
        fetchFallbackData();
      }
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Recalculate dynamic statistics
  const totalDriversCount = drivers.length;
  const smartDriversCount = drivers.filter(d => d.classification === 'Smart').length;
  const assistedDriversCount = drivers.filter(d => d.classification === 'Assisted').length;
  const pendingDriversCount = drivers.filter(d => d.status === 'pending').length;
  const activeDriversCount = drivers.filter(d => d.status === 'approved' || d.status === 'available' || d.status === 'on-trip').length;
  const restDriversCount = drivers.filter(d => d.status === 'off-duty').length;
  const totalVehiclesCount = vehicles.length;
  const totalShareholdersCount = shareholders.length;
  const totalInvestmentsSum = shareholders.reduce((s, r) => s + (r.investment_amount || 0), 0);

  const totalRevenueSum = financials.filter(f => f.type === 'revenue').reduce((s, r) => s + r.amount, 0);
  const totalExpensesSum = financials.filter(f => f.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const netGeneratedAmount = totalRevenueSum - totalExpensesSum;
  
  const shareholderPercentage = shareholderSettings.distributionPercentage !== undefined ? shareholderSettings.distributionPercentage : 2;
  const distributionPool = netGeneratedAmount > 0 ? (netGeneratedAmount * (shareholderPercentage / 100)) : 0;

  // outstanding payment simulator based on active trips
  const totalOutstandingPayments = tripManifests.filter(t => t.status === 'in-transit').reduce((s, r) => s + r.freightCharges, 0);
  const totalVehicleBalanceRemaining = 14250000; // Standard company outstanding leasing balance

  const activeCycle = (cycles || []).find(c => c && (c.status === 'active' || c.status === 'paused'));
  const nextCycleEstimatedDate = activeCycle 
    ? new Date(new Date(activeCycle.startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : 'N/A';

  // Filters and global search handlers
  const handleGlobalSearch = () => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    
    // Drivers
    const filteredDrivers = drivers.filter(d => 
      d.fullName?.toLowerCase().includes(query) ||
      d.company_driver_id?.toLowerCase().includes(query) ||
      d.phone?.toLowerCase().includes(query)
    ).map(d => ({ ...d, sType: 'Driver', label: `${d.fullName} (${d.company_driver_id || 'DRV'})` }));

    // Vehicles
    const filteredVehicles = vehicles.filter(v => 
      v.plateNumber?.toLowerCase().includes(query) ||
      v.model?.toLowerCase().includes(query)
    ).map(v => ({ ...v, sType: 'Vehicle', label: `${v.brand || 'Vehicle'} - ${v.plateNumber}` }));

    // Shareholders
    const filteredShareholders = shareholders.filter(s => 
      s.full_name?.toLowerCase().includes(query) ||
      s.phone?.toLowerCase().includes(query)
    ).map(s => ({ ...s, sType: 'Shareholder', label: `${s.full_name} (Investor)` }));

    // Admins
    const filteredAdmins = admins.filter(a => 
      a.fullName?.toLowerCase().includes(query) ||
      a.email?.toLowerCase().includes(query)
    ).map(a => ({ ...a, sType: 'Admin', label: `${a.fullName} (Operator)` }));

    return [...filteredDrivers, ...filteredVehicles, ...filteredShareholders, ...filteredAdmins];
  };

  const globalResults = handleGlobalSearch();

  // Executing executive commands
  const handleStartCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.startCycle({
        startDate: cycleGoalForm.startDate,
        endDate: cycleGoalForm.endDate,
        endGoalTons: parseFloat(cycleGoalForm.endGoalTons)
      });
      setActionSuccess(lang === 'en' ? "New company cycle started successfully." : "An fara sabon zagayen aiki lafiya.");
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePauseCycle = async (reason: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.pauseCycle({ reason });
      setActionSuccess(lang === 'en' ? "Operating cycle paused successfully." : "An dakatar da zagayen aiki lafiya.");
      setShowCyclePauseModal(false);
      setCyclePauseReason('');
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeCycle = async (reason: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.resumeCycle({ reason });
      setActionSuccess(lang === 'en' ? "Operating cycle resumed successfully." : "An dawo da zagayen aiki lafiya.");
      setShowCycleResumeModal(false);
      setCycleResumeReason('');
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndCycle = async () => {
    if (!window.confirm(lang === 'en' ? "Are you sure you want to CLOSE & LOCK the current operating cycle?" : "Shin kun tabbata kuna son rufe wannan zagayen aikin na kwanaki 30?")) return;
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.endCycle({
        endDate: new Date().toISOString().split('T')[0]
      });
      setActionSuccess(lang === 'en' ? "Active cycle successfully audited, archived, and permanently locked." : "An kammala duba kudaden zagayen aiki kuma an rufe shi gaba daya.");
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePercentage = async (pct: number) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.updateShareholderSettings({ distributionPercentage: pct });
      setActionSuccess(lang === 'en' ? `Shareholder distribution pool percentage adjusted to ${pct}%.` : `An sauya rabon jari na masu hannun jari zuwa kashi ${pct}%.`);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleUpdateCompanySettings = async (settings: any) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.updateCompanySettings(settings);
      setActionSuccess(lang === 'en' ? "Company profile details updated instantly across devices." : "An sabunta bayanan kamfani cikin nasara.");
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.createAdmin({
        email: adminForm.email,
        password: adminForm.password,
        fullName: adminForm.fullName,
        phone: adminForm.phone
      });
      setActionSuccess(lang === 'en' ? "New administrative operator profile created." : "An yi rijistar sabon Admin na gudanarwa.");
      setShowAddAdminModal(false);
      setAdminForm({ fullName: '', email: '', password: '', phone: '' });
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminStatusChange = async (adminId: string, newStatus: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.updateAdmin(adminId, { status: newStatus });
      setActionSuccess(lang === 'en' ? `Admin status toggled to ${newStatus.toUpperCase()}.` : `An sauya matsayin admin zuwa ${newStatus.toUpperCase()}.`);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!window.confirm(lang === 'en' ? "Delele this admin profile permanently?" : "Shin kuna son goge wannan admin din gaba daya?")) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.deleteAdmin(adminId);
      setActionSuccess(lang === 'en' ? "Admin account successfully deleted." : "An goge asusun admin lafiya.");
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleAddShareholder = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.addShareholder({
        full_name: shareholderForm.fullName,
        email: shareholderForm.email,
        phone: shareholderForm.phone,
        address: shareholderForm.address,
        investment_amount: parseFloat(shareholderForm.investmentAmount)
      });
      setActionSuccess(lang === 'en' ? "Shareholder record successfully appended." : "An kara mai hannun jari a tsarin.");
      setShowAddShareholderModal(false);
      setShareholderForm({ fullName: '', email: '', phone: '', address: '', investmentAmount: '' });
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareholderStatusChange = async (shId: string, newStatus: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.updateShareholderStatus(shId, { status: newStatus });
      setActionSuccess(lang === 'en' ? `Shareholder status updated to ${newStatus.toUpperCase()}.` : `An sabunta matsayin mai hannun jari.`);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleShareholderInvestmentChange = async (shId: string, amt: number) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.updateShareholderInvestment(shId, { investment_amount: amt });
      setActionSuccess(lang === 'en' ? "Investment value recalculated and saved." : "An sabunta jarin kudi na mai hannun jari.");
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleLogAccident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverIdForAction) return;
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.addDriverAccident(selectedDriverIdForAction, {
        date: accidentForm.date,
        description: accidentForm.description,
        damageEstimate: parseFloat(accidentForm.damageEstimate) || 0,
        severity: accidentForm.severity
      });
      setActionSuccess(lang === 'en' ? "Accident details logged. Financial repairs record automatically generated." : "An yi rikodin hatsari kuma an kaddamar da kudin gyara.");
      setAccidentForm({ date: '', description: '', damageEstimate: '', severity: 'minor' });
      setSelectedDriverIdForAction(null);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogRest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverIdForAction) return;
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await api.addDriverRest(selectedDriverIdForAction, {
        startDate: restForm.startDate,
        endDate: restForm.endDate,
        reason: restForm.reason
      });
      setActionSuccess(lang === 'en' ? "Driver off-duty rest period logged. Status updated." : "An yi rikodin hutun direba kuma an sauya status dinsa.");
      setRestForm({ startDate: '', endDate: '', reason: '' });
      setSelectedDriverIdForAction(null);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recharts Data Aggregation for charts
  const aggregatedDailyData = financials
    .slice(0, 15)
    .reverse()
    .map(f => ({
      date: f.date,
      amount: f.amount,
      type: f.type
    }));

  const expenseCategories = financials
    .filter(f => f.type === 'expense')
    .reduce((acc: any[], current) => {
      const existing = acc.find(item => item.name === current.category);
      if (existing) {
        existing.value += current.amount;
      } else {
        acc.push({ name: current.category, value: current.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#D4AF37', '#1E3A8A', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6'];

  // Global search trigger result navigators
  const navigateToSearchResult = (item: any) => {
    setSearchQuery('');
    if (item.sType === 'Driver') {
      setSelectedDriver(drivers.find(d => d.id === item.id));
      setActiveTab('drivers');
    } else if (item.sType === 'Shareholder') {
      setActiveTab('shareholders');
    } else if (item.sType === 'Admin') {
      setActiveTab('admins');
    }
  };

  // Trigger browser printing for professional report layout
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 max-w-7xl mx-auto p-2 md:p-6 bg-bg-base relative print:bg-white print:p-0">
      
      {/* EXECUTIVE CONTROL HUB UPPER HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main/50 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-extrabold text-text-main tracking-tight uppercase font-mono flex items-center gap-2">
              <Shield className="h-6 w-6 text-brand-gold" />
              {lang === 'en' ? "Director General Headquarters" : "Babban Ofishin Babban Darakta"}
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-2xl">
            {lang === 'en' 
              ? "Highest operational authority node. Command center for financial ledger audits, driver certifications, corporate shareholder settings, and 30-day operating cycle control." 
              : "Babban iko na gudanarwa. Hanyar sarrafa kudaden shiga, binciken direbobi, masu hannun jari, da tsarin zagayen aiki."}
          </p>
        </div>
        
        {/* SSE & Status Indicators */}
        <div className="flex items-center gap-3 bg-bg-surface border border-border-main p-2.5 rounded-xl self-start">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{lang === 'en' ? "Telemetry Status" : "Matsayin Hanyar Sadarwa"}</span>
            <span className="text-xs font-extrabold text-text-main font-mono flex items-center gap-1.5 mt-0.5">
              <span className={`h-2 w-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {sseConnected ? "SSE LIVE STREAM" : "HTTP FALLBACK"}
            </span>
          </div>
        </div>
      </div>

      {/* GLOBAL INSTANT SEARCH CORRIDOR (Executive Requirement) */}
      <div className="relative w-full max-w-md print:hidden">
        <div className="flex items-center bg-bg-surface border border-border-main rounded-xl px-3 py-2 shadow-xs">
          <Search className="h-4 w-4 text-text-muted mr-2" />
          <input
            type="text"
            placeholder={lang === 'en' ? "Instant search by Driver ID, Plate No, Admin, Investor..." : "Bincika Direbobi, Motoci, Masu Hannun Jari, Admin..."}
            className="w-full text-xs font-semibold focus:outline-hidden bg-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-bg-surface border border-border-main rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-border-main/40">
            {globalResults.length === 0 ? (
              <div className="p-3 text-center text-xs text-text-muted">{lang === 'en' ? "No records match search parameters." : "Babu sakamakon da ya dace."}</div>
            ) : (
              globalResults.map((res, i) => (
                <button
                  key={i}
                  className="w-full text-left p-3 hover:bg-brand-gold/10 flex items-center justify-between text-xs transition-colors"
                  onClick={() => navigateToSearchResult(res)}
                >
                  <span className="font-bold text-text-main">{res.label}</span>
                  <Badge variant="gold">{res.sType.toUpperCase()}</Badge>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* SYSTEM FEEDBACK TOASTS */}
      {actionError && (
        <Alert variant="danger" className="print:hidden">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-bold font-mono">{actionError}</span>
          </div>
        </Alert>
      )}
      {actionSuccess && (
        <Alert variant="success" className="print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-bold font-mono">{actionSuccess}</span>
          </div>
        </Alert>
      )}

      {/* EXECUTIVE TAB NAVIGATION CORNER */}
      <div className="w-full max-w-full flex flex-nowrap items-center gap-1 bg-bg-surface border border-border-main/80 p-1 rounded-xl shadow-xs print:hidden overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => { setActiveTab('overview'); setSelectedDriver(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'overview' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Command Board" : "Gudunmawar Aiki"}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'analytics' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Activity className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Finance Center" : "Ma'ajiyar Kudi"}
        </button>
        <button
          onClick={() => setActiveTab('cycles')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'cycles' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Operating Cycles" : "Zagayen Aiki"}
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'drivers' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Driver Dossiers" : "Direbobi"}
        </button>
        <button
          onClick={() => setActiveTab('shareholders')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'shareholders' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Percent className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Shareholders Pool" : "Masu Hannun Jari"}
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'people' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Users className="h-3.5 w-3.5 shrink-0 text-brand-gold" />
          {lang === 'en' ? "People Onboarding" : "Rijistar Mutane"}
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'admins' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Shield className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Operations Admins" : "Masu Gudanarwa"}
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'directory' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Enterprise Directory" : "Kundayen Ma’aikata"}
        </button>
        <button
          onClick={() => setActiveTab('company')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'company' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Building className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Corporate Profile" : "Bayanan Kamfani"}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'reports' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Reports Center" : "Rahoton Aiki"}
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'audit' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Terminal className="h-3.5 w-3.5 shrink-0" />
          {lang === 'en' ? "Audit Trail" : "Rikodin Tsaro"}
        </button>
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${activeTab === 'monitoring' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-bg-base/40'}`}
        >
          <Activity className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          {lang === 'en' ? "SSE Monitor" : "Kula da SSE"}
        </button>
      </div>

      {/* MAIN CONTAINER SURFACE */}
      <div className="flex-1 min-h-[500px] bg-bg-base print:bg-white">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-8 w-8 text-brand-gold animate-spin" />
            <span className="text-xs font-bold font-mono text-text-muted">{lang === 'en' ? "Decrypting secure corporate records..." : "Ana kwashe bayanan sirri na D1..."}</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              
              {/* ==================================================
                  TAB: command board / overview
                  ================================================== */}
              {activeTab === 'overview' && (
                <OverviewTab
                  lang={lang}
                  dictionary={dictionary}
                  logs={logs}
                  financials={financials}
                  vehicles={vehicles}
                  drivers={drivers}
                  admins={admins}
                  shareholders={shareholders}
                  cycles={cycles}
                  companySettings={companySettings}
                  shareholderSettings={shareholderSettings}
                  tripManifests={tripManifests}
                  notifications={notifications}
                  vouchers={vouchers}
                  users={users}
                  sseConnected={sseConnected}
                  onStartCycle={handleStartCycle}
                  onEndCycle={handleEndCycle}
                  onPauseCycleClick={() => setShowCyclePauseModal(true)}
                  onResumeCycleClick={() => setShowCycleResumeModal(true)}
                  cycleGoalForm={cycleGoalForm}
                  setCycleGoalForm={setCycleGoalForm}
                  onAddAdmin={() => setShowAddAdminModal(true)}
                  onAddShareholder={() => setShowAddShareholderModal(true)}
                  setActiveTab={setActiveTab}
                  setSelectedDriver={setSelectedDriver}
                  backupLoading={backupLoading}
                  restoreLoading={restoreLoading}
                  onDownloadBackup={handleDownloadBackup}
                  onUploadRestore={handleUploadRestore}
                  restoreSuccess={restoreSuccess}
                  restoreError={restoreError}
                  onStateChange={fetchFallbackData}
                />
              )}
              {false && activeTab === 'overview' && (
                <div className="flex flex-col gap-6 print:hidden">
                  
                  {/* LIVE CORPORATE KPI CARDS (Framer Motion Staggered Transitions) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    
                    {/* DRIVER STATS CARD */}
                    <Card hoverEffect className="p-5 bg-bg-surface border border-border-main flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{lang === 'en' ? "Total / Active Drivers" : "Direbobi Gaba daya"}</span>
                        <Users className="h-4 w-4 text-brand-navy dark:text-slate-400" />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">{totalDriversCount} / {activeDriversCount}</p>
                        <div className="flex gap-2.5 mt-2 text-[14px] text-text-muted font-medium">
                          <span>{smartDriversCount} Smart</span>
                          <span>•</span>
                          <span>{assistedDriversCount} Assisted</span>
                        </div>
                      </div>
                    </Card>
 
                    {/* DRIVERS AWAITING APPROVAL STAT CARD */}
                    <Card hoverEffect className="p-5 bg-bg-surface border border-border-main flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{lang === 'en' ? "Awaiting / Resting" : "Hutu / Jiran Amincewa"}</span>
                        <AlertTriangle className={`h-4 w-4 ${pendingDriversCount > 0 ? 'text-amber-500 animate-bounce' : 'text-text-muted'}`} />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">{pendingDriversCount} / {restDriversCount}</p>
                        <span className="text-[14px] text-text-muted font-medium mt-2 block">
                          {pendingDriversCount > 0 
                            ? `${pendingDriversCount} driver registrations pending boardroom review` 
                            : "All driver applications reviewed."}
                        </span>
                      </div>
                    </Card>
 
                    {/* VEHICLE STAT CARD */}
                    <Card hoverEffect className="p-5 bg-bg-surface border border-border-main flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{lang === 'en' ? "Fleet Assets" : "Rukunin Motoci"}</span>
                        <Truck className="h-4 w-4 text-brand-gold" />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">{totalVehiclesCount}</p>
                        <span className="text-[14px] text-text-muted font-medium mt-2 block">
                          {vehicles.filter(v => v.status === 'assigned').length} rigs active on transit corridors
                        </span>
                      </div>
                    </Card>
 
                    {/* INVESTMENTS CARD */}
                    <Card hoverEffect className="p-5 bg-bg-surface border border-border-main flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{lang === 'en' ? "Shareholder Capital" : "Jarin Masu Hannun Jari"}</span>
                        <Coins className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">₦{totalInvestmentsSum.toLocaleString()}</p>
                        <span className="text-[14px] text-text-muted font-medium mt-2 block">
                          Held by {totalShareholdersCount} active boardroom nodes
                        </span>
                      </div>
                    </Card>
 
                    {/* GROSS OPERATING REVENUE CARD */}
                    <Card hoverEffect className="p-5 bg-slate-950 border border-slate-800 text-white flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-slate-400 uppercase tracking-wider block">{lang === 'en' ? "Gross Collections" : "Kudaden Shiga"}</span>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-white tabular-nums leading-none mt-1">₦{totalRevenueSum.toLocaleString()}</p>
                        <span className="text-[14px] text-slate-400 mt-2 block">
                          100% audited logistics invoices
                        </span>
                      </div>
                    </Card>
 
                    {/* COMPANY EXPENSES CARD */}
                    <Card hoverEffect className="p-5 bg-bg-surface border border-border-main flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{lang === 'en' ? "Corporate Expenses" : "Kuɗaɗen Kashewa"}</span>
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">₦{totalExpensesSum.toLocaleString()}</p>
                        <span className="text-[14px] text-text-muted mt-2 block">
                          Fuel dispatches & rig restoration bills
                        </span>
                      </div>
                    </Card>
 
                    {/* NET PROFIT CARD */}
                    <Card hoverEffect className="p-5 bg-bg-surface border border-border-main flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{lang === 'en' ? "Net Generated Amount" : "Ribar Aiki"}</span>
                        <Activity className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-emerald-600 tabular-nums leading-none mt-1">₦{netGeneratedAmount.toLocaleString()}</p>
                        <span className="text-[14px] text-text-muted mt-2 block">
                          Net Margin ratio: {totalRevenueSum > 0 ? ((netGeneratedAmount / totalRevenueSum) * 100).toFixed(1) : '0'}%
                        </span>
                      </div>
                    </Card>
 
                    {/* SHAREHOLDER DISTRIBUTION CARDS */}
                    <Card hoverEffect className="p-5 bg-bg-surface border border-border-main flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-semibold text-text-muted uppercase tracking-wider block">{lang === 'en' ? "Distribution Pool" : "Kudaden Raba Jari"}</span>
                        <Percent className="h-4 w-4 text-brand-gold animate-spin" style={{ animationDuration: '6s' }} />
                      </div>
                      <div className="mt-4">
                        <p className="text-[30px] md:text-[36px] lg:text-[42px] font-extrabold tracking-tight text-text-main tabular-nums leading-none mt-1">₦{distributionPool.toLocaleString()}</p>
                        <span className="text-[14px] text-text-muted font-bold mt-2 block">
                          Configured at {shareholderPercentage}% of Net profit
                        </span>
                      </div>
                    </Card>
 
                  </div>

                  {/* ACTIVE CYCLE HUD & OUTSTANDING PAYMENTS BAR */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* ACTIVE CYCLES CARD */}
                    <Card className="lg:col-span-8 flex flex-col justify-between">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{lang === 'en' ? "Active 30-Day Operational Cycle" : "Zagayen Aiki Na Kwanaki 30 Na Yanzu"}</CardTitle>
                            <CardDescription>Continuous performance auditing and locking workflow.</CardDescription>
                          </div>
                          {activeCycle ? (
                            <Badge variant="gold">RUNNING IN PRODUCTION</Badge>
                          ) : (
                            <Badge variant="danger">NO ACTIVE CYCLE</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <div className="mt-4 p-4 bg-bg-base rounded-xl border border-border-main/50 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Active ID</span>
                          <p className="text-sm font-extrabold text-text-main font-mono mt-0.5">{activeCycle ? activeCycle.id : "None"}</p>
                        </div>
                        <div>
                          <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Commencement Date</span>
                          <p className="text-sm font-extrabold text-text-main font-mono mt-0.5">{activeCycle ? activeCycle.startDate : "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Expected Completion</span>
                          <p className="text-sm font-extrabold text-text-main font-mono mt-0.5">{nextCycleEstimatedDate}</p>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex flex-col gap-2">
                        <div className="flex justify-between text-xs font-bold text-text-main">
                          <span>Target Daily Remittance Cycle Goal ({activeCycle ? activeCycle.endGoalTons : 200} Cycles)</span>
                          <span>94.6 Cycles / {activeCycle ? activeCycle.endGoalTons : 200} Cycles</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-brand-gold h-full rounded-full" style={{ width: `${Math.min(100, (94.6 / (activeCycle ? activeCycle.endGoalTons : 200)) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border-main/40 pt-4">
                        {activeCycle ? (
                          <button
                            onClick={handleEndCycle}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            {lang === 'en' ? "Complete & Lock Active Cycle" : "Kammala & Rufe Zagayen Sufuri"}
                          </button>
                        ) : (
                          <form onSubmit={handleStartCycle} className="flex flex-wrap items-center gap-2">
                            <input
                              type="date"
                              required
                              className="bg-bg-surface border border-border-main p-1.5 rounded-lg text-xs"
                              value={cycleGoalForm.startDate}
                              onChange={(e) => setCycleGoalForm({ ...cycleGoalForm, startDate: e.target.value })}
                            />
                            <input
                              type="number"
                              required
                              placeholder="Goal (Tons)"
                              className="bg-bg-surface border border-border-main p-1.5 rounded-lg text-xs w-24"
                              value={cycleGoalForm.endGoalTons}
                              onChange={(e) => setCycleGoalForm({ ...cycleGoalForm, endGoalTons: e.target.value })}
                            />
                            <button
                              type="submit"
                              className="px-3 py-2 bg-brand-gold hover:bg-brand-gold/80 text-slate-950 font-extrabold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {lang === 'en' ? "Launch Cycle" : "Fara Zagaye"}
                            </button>
                          </form>
                        )}
                      </div>
                    </Card>

                    {/* OUTSTANDING LEASING & LEVERAGES */}
                    <Card className="lg:col-span-4 flex flex-col justify-between">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Leverages & Liabilities" : "Basussuka & Kudaden Hanya"}</CardTitle>
                        <CardDescription>Audited liabilities on lease balances & outstanding remittances.</CardDescription>
                      </CardHeader>
                      <div className="mt-4 flex flex-col gap-5">
                        <div className="flex items-center justify-between border-b border-border-main/40 pb-3">
                          <div>
                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Unpaid Daily Remittance</span>
                            <p className="text-base font-extrabold text-text-main font-mono mt-0.5">₦{totalOutstandingPayments.toLocaleString()}</p>
                          </div>
                          <Badge variant="gold">EXPECTED</Badge>
                        </div>
                        <div className="flex items-center justify-between border-b border-border-main/40 pb-3">
                          <div>
                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Fleet Remaining Leasing Weights</span>
                            <p className="text-base font-extrabold text-text-main font-mono mt-0.5">₦{totalVehicleBalanceRemaining.toLocaleString()}</p>
                          </div>
                          <Badge variant="danger">LIABILITY</Badge>
                        </div>
                        <div className="p-3 bg-bg-base border border-border-main rounded-xl">
                          <span className="text-[9px] text-text-muted font-bold uppercase">Debt-to-Capital ratio</span>
                          <p className="text-lg font-extrabold text-emerald-600 font-mono mt-0.5">9.41%</p>
                          <span className="text-[9px] text-text-muted">Optimal risk corridor limits strictly maintained.</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* MINI HISTORICAL GRAPHS & AUDITED LOGS STREAM */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <Card className="lg:col-span-8">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Revenue Performance Corridor" : "Kwatanta Kudade"}</CardTitle>
                        <CardDescription>Live telemetry mapping operational dispatches vs fuel expenditures.</CardDescription>
                      </CardHeader>
                      <div className="h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={aggregatedDailyData.length > 0 ? aggregatedDailyData : [{ date: 'None', amount: 0, type: 'revenue' }]}>
                            <defs>
                              <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                            <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                            <Tooltip formatter={(value: any) => [`₦${value.toLocaleString()}`]} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Area type="monotone" dataKey="amount" name="Logistics Cash Weight" stroke="#D4AF37" fillOpacity={1} fill="url(#colorGross)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    {/* LIVE ALERTS / NOTIFICATION CENTER WINDOW */}
                    <Card className="lg:col-span-4 flex flex-col justify-between">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Headquarters Alerts" : "Sanarwar Gaggawa"}</CardTitle>
                        <CardDescription>Live operational feed across corridors.</CardDescription>
                      </CardHeader>
                      <div className="mt-4 flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
                        {notifications.length === 0 ? (
                          <div className="text-center py-6 text-xs text-text-muted">{lang === 'en' ? "No operational alerts." : "Babu sanarwa."}</div>
                        ) : (
                          notifications.slice(0, 5).map((not, idx) => (
                            <div key={idx} className="p-3 bg-bg-base border border-border-main rounded-xl flex flex-col gap-1 text-[11px] hover:bg-bg-surface transition-colors">
                              <div className="flex items-center justify-between">
                                <Badge variant={not.type === 'danger' ? 'danger' : not.type === 'warning' ? 'gold' : 'info'}>
                                  {not.type?.toUpperCase() || "ALERT"}
                                </Badge>
                                <span className="text-[8px] text-text-muted font-mono">{not.created_at?.split('T')[0]}</span>
                              </div>
                              <p className="font-extrabold text-text-main mt-1 leading-tight">{lang === 'en' ? not.title_en : not.title_ha}</p>
                              <p className="text-text-muted leading-relaxed font-sans">{lang === 'en' ? not.message_en : not.message_ha}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>

                </div>
              )}

              {/* ==================================================
                  TAB: financial command center / analytics
                  ================================================== */}
              {activeTab === 'analytics' && (
                <FinancialCommandCenter
                  lang={lang}
                  drivers={drivers}
                  vehicles={vehicles}
                  finance={financials}
                  payments={[]}
                  shareholders={shareholders}
                  onSync={fetchFallbackData}
                />
              )}

              {/* ==================================================
                  TAB: 30-day operating cycles
                  ================================================== */}
              {activeTab === 'cycles' && (
                <div className="flex flex-col gap-6">
                  
                  {/* Real-time Cycle Duration & Status Tracker */}
                  <CycleTimer 
                    lang={lang}
                    activeCycle={activeCycle}
                    onStateChange={fetchFallbackData}
                  />
                  
                  {/* Cycles management panel */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Launch Form */}
                    <Card className="lg:col-span-4 h-fit">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Initiate Operational Cycle" : "Kaddamar da Sabon Zagaye"}</CardTitle>
                        <CardDescription>Launch and setup corporate performance metrics.</CardDescription>
                      </CardHeader>
                      <form onSubmit={handleStartCycle} className="mt-4 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">{lang === 'en' ? "Cycle Commencement Date" : "Ranar Fara Zagaye"}</label>
                          <input
                            type="date"
                            required
                            disabled={!!activeCycle}
                            className="bg-bg-surface border border-border-main p-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                            value={cycleGoalForm.startDate}
                            onChange={(e) => setCycleGoalForm({ ...cycleGoalForm, startDate: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">{lang === 'en' ? "Cycle Scheduled End Date" : "Ranar Kammala Zagaye"}</label>
                          <input
                            type="date"
                            required
                            disabled={!!activeCycle}
                            className="bg-bg-surface border border-border-main p-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                            value={cycleGoalForm.endDate}
                            onChange={(e) => setCycleGoalForm({ ...cycleGoalForm, endDate: e.target.value })}
                          />
                        </div>

                        {!activeCycle ? (
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2.5 bg-brand-gold hover:bg-brand-gold/80 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            {lang === 'en' ? "Authorize Cycle Start" : "Fara Sabon Zagaye"}
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2 mt-2">
                            <span className="text-[10px] font-bold text-center text-text-muted uppercase">
                              {lang === 'en' ? "Active Cycle Controls" : "Sarrafa Zagayen Sufuri"}
                            </span>
                            <div className="flex gap-2">
                              {activeCycle?.status === 'paused' ? (
                                <button
                                  type="button"
                                  onClick={() => setShowCycleResumeModal(true)}
                                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                                >
                                  {lang === 'en' ? "Resume Cycle" : "Dawo da Zagaye"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowCyclePauseModal(true)}
                                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                                >
                                  {lang === 'en' ? "Pause Cycle" : "Dakatar da Zagaye"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleEndCycle}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                              >
                                {lang === 'en' ? "End Cycle" : "Kammala Zagaye"}
                              </button>
                            </div>
                            <span className="text-[9px] text-amber-500 font-bold text-center mt-1">
                              {lang === 'en' ? `Status: ${(activeCycle?.status || '').toUpperCase()} (${activeCycle?.id || ''})` : `Hali: ${(activeCycle?.status || '').toUpperCase()} (${activeCycle?.id || ''})`}
                            </span>
                          </div>
                        )}
                      </form>
                    </Card>

                    {/* Cycle Listing Archive */}
                    <Card className="lg:col-span-8">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Locked & Archived Operations Cycles" : "Zagayen Aiki Da Aka Rufe"}</CardTitle>
                        <CardDescription>Permanently sealed corporate cycles audits.</CardDescription>
                      </CardHeader>
                      <div className="overflow-x-auto mt-4">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                              <th className="p-3">Cycle Reference ID</th>
                              <th className="p-3">Start Corridor</th>
                              <th className="p-3">Close Date</th>
                              <th className="p-3 text-right">Net Generated</th>
                              <th className="p-3 text-right">Shareholders Pool</th>
                              <th className="p-3">Audit Seal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-main/40 font-mono text-text-main text-[11px]">
                            {cycles.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-4 text-center text-xs font-sans text-text-muted">{lang === 'en' ? "No historical operating cycles logged." : "Babu tsofaffin zagaye a ajiye."}</td>
                              </tr>
                            ) : (
                              cycles.map(cyc => (
                                <tr
                                  key={cyc.id}
                                  className="hover:bg-bg-base/30 cursor-pointer"
                                  onClick={() => setSelectedCycle(cyc)}
                                >
                                  <td className="p-3 text-brand-gold font-bold">{cyc.id}</td>
                                  <td className="p-3 text-text-muted">{cyc.startDate}</td>
                                  <td className="p-3 text-text-muted">{cyc.endDate || "STILL RUNNING"}</td>
                                  <td className="p-3 text-right font-extrabold">
                                    {cyc.metrics ? `₦${cyc.metrics.netGeneratedAmount.toLocaleString()}` : "Pending"}
                                  </td>
                                  <td className="p-3 text-right font-extrabold text-brand-gold">
                                    {cyc.metrics ? `₦${cyc.metrics.distributionPool.toLocaleString()}` : "Pending"}
                                  </td>
                                  <td className="p-3">
                                    <Badge variant={cyc.locked ? 'gold' : 'info'}>
                                      {cyc.locked ? "SEALED & LOCKED" : "ACTIVE"}
                                    </Badge>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                  </div>

                  {/* SELECTED CYCLE CALCULATIONS AUDIT EXPLANATOR MODAL */}
                  {selectedCycle && (
                    <Card className="border border-brand-gold/60 bg-bg-surface p-6">
                      <div className="flex items-center justify-between border-b border-border-main/50 pb-3">
                        <div>
                          <span className="text-[9px] text-brand-gold font-bold uppercase">Audited Calculation Trail</span>
                          <h3 className="text-lg font-extrabold text-text-main font-mono">{selectedCycle.id} Calculation Audit</h3>
                        </div>
                        <button
                          onClick={() => setSelectedCycle(null)}
                          className="p-1.5 hover:bg-bg-base rounded-lg text-text-muted hover:text-text-main cursor-pointer"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                      
                      {selectedCycle.metrics ? (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                          <div className="flex flex-col gap-3">
                            <h4 className="font-bold text-text-main uppercase text-[10px] tracking-wider">Dynamic Revenue/Expenditures Formula</h4>
                            <div className="p-3.5 bg-bg-base border border-border-main rounded-xl flex flex-col gap-2 font-mono">
                              <div className="flex justify-between">
                                <span className="text-text-muted">Invoiced Gross Revenues:</span>
                                <span className="text-emerald-600 font-extrabold">₦{selectedCycle.metrics.totalRevenue.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Maintenance & Vouchers Cost:</span>
                                <span className="text-rose-600 font-extrabold">- ₦{selectedCycle.metrics.totalExpenses.toLocaleString()}</span>
                              </div>
                              <div className="border-t border-border-main/60 pt-2 flex justify-between font-extrabold">
                                <span>Net Operating Profit (NOP):</span>
                                <span className="text-text-main">₦{selectedCycle.metrics.netGeneratedAmount.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <h4 className="font-bold text-text-main uppercase text-[10px] tracking-wider">Shareholder Pool Division Recalculation</h4>
                            <div className="p-3.5 bg-bg-base border border-border-main rounded-xl flex flex-col gap-2 font-mono">
                              <div className="flex justify-between">
                                <span className="text-text-muted">Calculated Net Operating Profit:</span>
                                <span>₦{selectedCycle.metrics.netGeneratedAmount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Percentage Allocation:</span>
                                <span className="text-brand-gold font-extrabold">{selectedCycle.metrics.distributionPercentage}%</span>
                              </div>
                              <div className="border-t border-border-main/60 pt-2 flex justify-between font-extrabold">
                                <span>Shareholders Disbursed Pool:</span>
                                <span className="text-brand-gold">₦{selectedCycle.metrics.distributionPool.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-text-muted">This operational cycle is still running. Metrics will calculate on lock.</div>
                      )}
                    </Card>
                  )}

                </div>
              )}

              {/* ==================================================
                  TAB: operations admins (CRUD / Reset / Logs)
                  ================================================== */}
              {activeTab === 'admins' && (
                <div className="flex flex-col gap-6">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-extrabold text-text-main tracking-tight uppercase">{lang === 'en' ? "Operations Admin Control" : "Masu Gudanarwa (Admins)"}</h3>
                      <p className="text-xs text-text-muted mt-0.5">Create, edit, suspend, or delete operational supervisors.</p>
                    </div>
                    <button
                      onClick={() => setShowAddAdminModal(true)}
                      className="px-4 py-2 bg-brand-gold hover:bg-brand-gold/80 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      {lang === 'en' ? "Add Admin Operator" : "Kara Admin"}
                    </button>
                  </div>

                  {/* Add Admin Modal Dialog */}
                  {showAddAdminModal && (
                    <Card className="border border-brand-gold p-6">
                      <div className="flex items-center justify-between border-b border-border-main pb-3 mb-4">
                        <h4 className="text-sm font-extrabold text-text-main uppercase">{lang === 'en' ? "Create Operator Profile" : "Kara Asusun Admin"}</h4>
                        <button onClick={() => setShowAddAdminModal(false)} className="text-text-muted hover:text-text-main cursor-pointer"><XCircle className="h-5 w-5" /></button>
                      </div>
                      <form onSubmit={handleAddAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Full Name</label>
                          <input
                            type="text"
                            required
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={adminForm.fullName}
                            onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Corporate Email</label>
                          <input
                            type="email"
                            required
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={adminForm.email}
                            onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Password</label>
                          <input
                            type="password"
                            required
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={adminForm.password}
                            onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Active Telephone</label>
                          <input
                            type="text"
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={adminForm.phone}
                            onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                          />
                        </div>
                        <button
                          type="submit"
                          className="md:col-span-2 py-2.5 bg-brand-gold text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 mt-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Commit Registration
                        </button>
                      </form>
                    </Card>
                  )}

                  {/* Admins Table */}
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                            <th className="p-3">ID Code</th>
                            <th className="p-3">Administrative Officer</th>
                            <th className="p-3">Corporate Email</th>
                            <th className="p-3">Contact</th>
                            <th className="p-3">Operational Status</th>
                            <th className="p-3 text-right">Security Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-main/40 font-mono text-text-main text-[11px]">
                          {users.filter(u => u.role_id === 'role-admin').map(adm => {
                            const adminProfile = admins.find(a => a.user_id === adm.id) || {};
                            return (
                              <tr key={adm.id} className="hover:bg-bg-base/30">
                                <td className="p-3 text-brand-gold font-bold">{adminProfile.company_id || 'ADM-OFF'}</td>
                                <td className="p-3 font-extrabold text-text-main font-sans text-xs">{adm.full_name}</td>
                                <td className="p-3 font-sans text-xs text-text-muted">{adm.email}</td>
                                <td className="p-3 text-text-muted">{adm.phone || "N/A"}</td>
                                <td className="p-3">
                                  <Badge variant={adm.status === 'active' ? 'success' : 'danger'}>
                                    {adm.status?.toUpperCase() || "ACTIVE"}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right flex items-center justify-end gap-2.5">
                                  {adm.status === 'active' ? (
                                    <button
                                      onClick={() => handleAdminStatusChange(adm.id, 'suspended')}
                                      className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                                      title="Suspend Operator Authority"
                                    >
                                      <UserX className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleAdminStatusChange(adm.id, 'active')}
                                      className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg cursor-pointer"
                                      title="Re-Activate Authority"
                                    >
                                      <UserCheck className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      const newPass = window.prompt("Enter new secure password:");
                                      if (newPass) {
                                        api.updateAdmin(adm.id, { password: newPass });
                                        alert("Password reset successfully.");
                                      }
                                    }}
                                    className="p-1.5 hover:bg-slate-100 text-text-muted rounded-lg cursor-pointer"
                                    title="Reset Security Password"
                                  >
                                    <Lock className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAdmin(adm.id)}
                                    className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                                    title="Delete Profile Permanently"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                </div>
              )}

              {/* ==================================================
                  TAB: fleet drivers dossiers (Dossiers / history)
                  ================================================== */}
              {activeTab === 'drivers' && (
                <div className="flex flex-col gap-6">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Drivers List Panel */}
                    <Card className="lg:col-span-5 h-fit">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Tricycle Certified Drivers" : "Rijistar Direbobi"}</CardTitle>
                        <CardDescription>Select driver to inspect complete dossier files.</CardDescription>
                      </CardHeader>
                      <div className="mt-4 flex flex-col gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                        {drivers.map(drv => (
                          <button
                            key={drv.id}
                            onClick={() => setSelectedDriver(drv)}
                            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${selectedDriver?.id === drv.id ? 'bg-brand-gold/10 border-brand-gold' : 'bg-bg-surface border-border-main hover:bg-bg-base/40'}`}
                          >
                            <div>
                              <span className="font-extrabold text-text-main block">{drv.fullName || drv.company_driver_id}</span>
                              <span className="text-[10px] text-text-muted block mt-0.5">{drv.company_driver_id || 'Pending Certification'} • {drv.classification || 'Unclassified'}</span>
                            </div>
                            <Badge variant={drv.status === 'approved' || drv.status === 'available' || drv.status === 'on-trip' ? 'success' : drv.status === 'pending' ? 'gold' : 'danger'}>
                              {drv.status?.toUpperCase() || 'PENDING'}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </Card>

                    {/* Driver Detail Dossier Panel */}
                    <Card className="lg:col-span-7">
                      {selectedDriver ? (
                        <div className="flex flex-col gap-6">
                          
                          {/* Profile Header */}
                          <div className="flex items-start justify-between border-b border-border-main/50 pb-4 gap-4">
                            <div className="flex items-start gap-4">
                              {/* Official Passport Photograph */}
                              <div className="relative group overflow-hidden rounded-lg border border-border-main h-20 w-20 shrink-0 bg-slate-900 flex items-center justify-center shadow-md">
                                <img 
                                  src={(selectedDriver as any).passport_photo_url || selectedDriver.documents?.find((d: any) => d.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'} 
                                  alt={selectedDriver.fullName} 
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-brand-gold font-bold uppercase tracking-wider">{selectedDriver.classification || 'UNCLASSIFIED CORRIDOR DRIVER'}</span>
                                <h3 className="text-lg font-extrabold text-text-main font-mono">{selectedDriver.fullName}</h3>
                                <p className="text-[11px] text-text-muted mt-0.5">Company ID: <span className="font-mono font-bold text-text-main">{selectedDriver.company_driver_id || 'PENDING'}</span></p>
                              </div>
                            </div>
                            <Badge variant={selectedDriver.status === 'approved' || selectedDriver.status === 'available' || selectedDriver.status === 'on-trip' ? 'success' : 'danger'}>
                              {selectedDriver.status?.toUpperCase() || 'PENDING'}
                            </Badge>
                          </div>

                          {/* Personal contact / License info */}
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                              <span className="text-[9px] text-text-muted font-bold uppercase block">Active Telephone</span>
                              <span className="font-extrabold text-text-main block mt-0.5">{selectedDriver.phone || "N/A"}</span>
                            </div>
                            <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                              <span className="text-[9px] text-text-muted font-bold uppercase block">ECOWAS Transit License</span>
                              <span className="font-extrabold text-text-main block mt-0.5">{selectedDriver.license_number || "N/A"}</span>
                            </div>
                            <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                              <span className="text-[9px] text-text-muted font-bold uppercase block">License Expiry</span>
                              <span className="font-extrabold text-text-main block mt-0.5">{selectedDriver.license_expiry || "N/A"}</span>
                            </div>
                            <div className="p-3 bg-bg-base rounded-xl border border-border-main/50">
                              <span className="text-[9px] text-text-muted font-bold uppercase block">National Identity No (NIN)</span>
                              <span className="font-extrabold text-text-main block mt-0.5 font-mono">{selectedDriver.nin || "N/A"}</span>
                            </div>
                          </div>

                          {/* Guarantor Details */}
                          <div>
                            <h4 className="font-bold text-[10px] text-text-muted uppercase tracking-wider mb-2">Legal Guarantor Profile</h4>
                            {selectedDriver.guarantor ? (
                              <div className="p-3.5 bg-bg-base border border-border-main rounded-xl grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <span className="text-[9px] text-text-muted">Guarantor Name</span>
                                  <p className="font-extrabold text-text-main mt-0.5">{selectedDriver.guarantor.fullName}</p>
                                </div>
                                <div>
                                  <span className="text-[9px] text-text-muted">Relationship</span>
                                  <p className="font-extrabold text-text-main mt-0.5">{selectedDriver.guarantor.relationship}</p>
                                </div>
                                <div>
                                  <span className="text-[9px] text-text-muted">Telephone</span>
                                  <p className="font-extrabold text-text-main mt-0.5">{selectedDriver.guarantor.phone}</p>
                                </div>
                                <div>
                                  <span className="text-[9px] text-text-muted">NIN Code</span>
                                  <p className="font-extrabold text-text-main mt-0.5 font-mono">{selectedDriver.guarantor.nin}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-text-muted italic p-3 bg-bg-base border border-border-main rounded-xl">No guarantor files bound to driver.</div>
                            )}
                          </div>

                          {/* Driver Rest and Accident Inputs */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border-main/40">
                            
                            {/* Rest Logger */}
                            <form onSubmit={(e) => { setSelectedDriverIdForAction(selectedDriver.id); handleLogRest(e); }} className="flex flex-col gap-3">
                              <h5 className="font-bold text-[10px] text-text-main uppercase tracking-wider flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-brand-gold" /> Log Rest Period</h5>
                              <input
                                type="date"
                                required
                                className="bg-bg-base border border-border-main p-2 rounded-lg text-xs"
                                value={restForm.startDate}
                                onChange={(e) => setRestForm({ ...restForm, startDate: e.target.value })}
                              />
                              <input
                                type="date"
                                required
                                className="bg-bg-base border border-border-main p-2 rounded-lg text-xs"
                                value={restForm.endDate}
                                onChange={(e) => setRestForm({ ...restForm, endDate: e.target.value })}
                              />
                              <input
                                type="text"
                                placeholder="Reason / Corridor physical release"
                                required
                                className="bg-bg-base border border-border-main p-2 rounded-lg text-xs"
                                value={restForm.reason}
                                onChange={(e) => setRestForm({ ...restForm, reason: e.target.value })}
                              />
                              <button type="submit" className="py-1.5 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">Register Rest Window</button>
                            </form>

                            {/* Accident Logger */}
                            <form onSubmit={(e) => { setSelectedDriverIdForAction(selectedDriver.id); handleLogAccident(e); }} className="flex flex-col gap-3">
                              <h5 className="font-bold text-[10px] text-text-main uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Log Collision/Incident</h5>
                              <input
                                type="date"
                                required
                                className="bg-bg-base border border-border-main p-2 rounded-lg text-xs"
                                value={accidentForm.date}
                                onChange={(e) => setAccidentForm({ ...accidentForm, date: e.target.value })}
                              />
                              <input
                                type="number"
                                placeholder="Damage Repair Bill (₦)"
                                required
                                className="bg-bg-base border border-border-main p-2 rounded-lg text-xs"
                                value={accidentForm.damageEstimate}
                                onChange={(e) => setAccidentForm({ ...accidentForm, damageEstimate: e.target.value })}
                              />
                              <input
                                type="text"
                                placeholder="Detailed accident description..."
                                required
                                className="bg-bg-base border border-border-main p-2 rounded-lg text-xs"
                                value={accidentForm.description}
                                onChange={(e) => setAccidentForm({ ...accidentForm, description: e.target.value })}
                              />
                              <button type="submit" className="py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer">Log Incident & Bill</button>
                            </form>

                          </div>

                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-2">
                          <Users className="h-8 w-8 text-text-muted/60" />
                          <span className="text-xs font-bold font-mono">{lang === 'en' ? "Select a driver to audit profiles." : "Zabi direba don ganin bayanan sa."}</span>
                        </div>
                      )}
                    </Card>

                  </div>

                </div>
              )}

              {/* ==================================================
                  TAB: shareholder settings & management
                  ================================================== */}
              {activeTab === 'shareholders' && (
                <div className="flex flex-col gap-6">
                  
                  {/* Shareholder Settings Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Shareholder Settings */}
                    <Card className="flex flex-col justify-between">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Dividend Pool Percentage Setting" : "Sarrafa Rabon Jari (Masu Hannun Jari)"}</CardTitle>
                        <CardDescription>Adjust allocation percentage deducted from Net profit.</CardDescription>
                      </CardHeader>
                      <div className="mt-4 p-4 bg-bg-base rounded-xl border border-border-main/50 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-main">Current Boardroom Allocation Weight:</span>
                          <span className="text-lg font-extrabold text-brand-gold font-mono">{shareholderPercentage}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdatePercentage(2)}
                            className="flex-1 py-2 bg-slate-900 text-white hover:bg-slate-800 font-extrabold text-xs rounded-lg cursor-pointer"
                          >
                            Set ECOWAS Default (2%)
                          </button>
                          <button
                            onClick={() => {
                              const customPct = window.prompt("Enter custom distribution percentage (0-100):");
                              if (customPct !== null && !isNaN(parseFloat(customPct))) {
                                handleUpdatePercentage(parseFloat(customPct));
                              }
                            }}
                            className="flex-1 py-2 bg-brand-gold text-slate-950 hover:bg-brand-gold/80 font-extrabold text-xs rounded-lg cursor-pointer"
                          >
                            Set Custom Percentage
                          </button>
                        </div>
                      </div>
                      <span className="text-[10px] text-text-muted mt-2.5">Changes log instantly to security audit. Recalculates dynamically over Net Generated Amount.</span>
                    </Card>

                    {/* Add Shareholder */}
                    <Card className="flex flex-col justify-between h-fit">
                      <CardHeader>
                        <CardTitle>{lang === 'en' ? "Append Corporate Boardroom Shareholder" : "Sanya Sabon Mai Hannun Jari"}</CardTitle>
                        <CardDescription>Register a new shareholder capital node.</CardDescription>
                      </CardHeader>
                      <button
                        onClick={() => setShowAddShareholderModal(true)}
                        className="mt-4 py-2.5 bg-slate-950 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="h-4 w-4 text-brand-gold" />
                        Configure New Investor Node
                      </button>
                    </Card>

                  </div>

                  {/* Add Shareholder Modal */}
                  {showAddShareholderModal && (
                    <Card className="border border-brand-gold p-6">
                      <div className="flex items-center justify-between border-b border-border-main pb-3 mb-4">
                        <h4 className="text-sm font-extrabold text-text-main uppercase">Add Shareholder Profile</h4>
                        <button onClick={() => setShowAddShareholderModal(false)} className="text-text-muted hover:text-text-main cursor-pointer"><XCircle className="h-5 w-5" /></button>
                      </div>
                      <form onSubmit={handleAddShareholder} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Investor Full Name</label>
                          <input
                            type="text"
                            required
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={shareholderForm.fullName}
                            onChange={(e) => setShareholderForm({ ...shareholderForm, fullName: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Investor Email</label>
                          <input
                            type="email"
                            required
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={shareholderForm.email}
                            onChange={(e) => setShareholderForm({ ...shareholderForm, email: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Telephone</label>
                          <input
                            type="text"
                            required
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={shareholderForm.phone}
                            onChange={(e) => setShareholderForm({ ...shareholderForm, phone: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Capital Investment Amount (₦)</label>
                          <input
                            type="number"
                            required
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs font-mono font-bold"
                            value={shareholderForm.investmentAmount}
                            onChange={(e) => setShareholderForm({ ...shareholderForm, investmentAmount: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Corporate Address</label>
                          <input
                            type="text"
                            className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs"
                            value={shareholderForm.address}
                            onChange={(e) => setShareholderForm({ ...shareholderForm, address: e.target.value })}
                          />
                        </div>
                        <button
                          type="submit"
                          className="md:col-span-2 py-2.5 bg-brand-gold text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 mt-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Commit Capital Node
                        </button>
                      </form>
                    </Card>
                  )}

                  {/* Shareholders Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{lang === 'en' ? "Shareholders Capital Boardroom" : "Masu Hannun Jari Da Jarin Su"}</CardTitle>
                      <CardDescription>Current registered investors, capital stakes, and dynamic calculations.</CardDescription>
                    </CardHeader>
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                            <th className="p-3">Shareholder Name</th>
                            <th className="p-3">Email Address</th>
                            <th className="p-3">Telephone</th>
                            <th className="p-3">Capital Stake Value</th>
                            <th className="p-3">% Weight Stake</th>
                            <th className="p-3">Estimated Earnings</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-main/40 font-mono text-text-main text-[11px]">
                          {shareholders.map(sh => {
                            const pctStake = totalInvestmentsSum > 0 ? ((sh.investment_amount / totalInvestmentsSum) * 100) : 0;
                            const estimatedShareholderEarnings = distributionPool * (pctStake / 100);
                            return (
                              <tr key={sh.id} className="hover:bg-bg-base/30">
                                <td className="p-3 font-extrabold text-text-main font-sans text-xs flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full border border-border-main overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center">
                                    <img 
                                      src={sh.passport_photo_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'} 
                                      alt={sh.full_name} 
                                      className="h-full w-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <span>{sh.full_name}</span>
                                </td>
                                <td className="p-3 font-sans text-xs text-text-muted">{sh.email}</td>
                                <td className="p-3 text-text-muted">{sh.phone}</td>
                                <td className="p-3 font-extrabold">₦{sh.investment_amount?.toLocaleString() || '0'}</td>
                                <td className="p-3 text-blue-600 font-bold">{pctStake.toFixed(2)}%</td>
                                <td className="p-3 text-emerald-600 font-extrabold">₦{estimatedShareholderEarnings.toLocaleString()}</td>
                                <td className="p-3">
                                  <Badge variant={sh.status === 'suspended' ? 'danger' : 'success'}>
                                    {sh.status?.toUpperCase() || 'ACTIVE'}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right flex items-center justify-end gap-2.5">
                                  {sh.status === 'suspended' ? (
                                    <button
                                      onClick={() => handleShareholderStatusChange(sh.id, 'active')}
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                      title="Unsuspend"
                                    >
                                      <UserCheck className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleShareholderStatusChange(sh.id, 'suspended')}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                      title="Suspend"
                                    >
                                      <UserX className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      const amt = window.prompt("Adjust Capital Investment (₦):", sh.investment_amount);
                                      if (amt) handleShareholderInvestmentChange(sh.id, parseFloat(amt));
                                    }}
                                    className="p-1.5 text-brand-gold hover:bg-slate-100 rounded-lg cursor-pointer"
                                    title="Edit Capital Stake"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                </div>
              )}

              {/* ==================================================
                  TAB: People Onboarding & Management
                  ================================================== */}
              {activeTab === 'people' && (
                <PeopleManagement
                  lang={lang}
                  drivers={drivers}
                  vehicles={vehicles}
                  shareholders={shareholders}
                  onSync={fetchFallbackData}
                  currentUserRole="director"
                />
              )}

              {/* ==================================================
                  TAB: Enterprise Directory
                  ================================================== */}
              {activeTab === 'directory' && (
                <div className="bg-bg-surface border border-border-main rounded-2xl p-6 shadow-xs">
                  <EnterpriseDirectory lang={lang} dictionary={dictionary} />
                </div>
              )}

              {/* ==================================================
                  TAB: company settings (Identity defaults)
                  ================================================== */}
              {activeTab === 'company' && (
                <Card className="p-6">
                  <CardHeader>
                    <CardTitle>{lang === 'en' ? "Global Corporate Configuration" : "Kayan Gudanarwa Na Kamfani"}</CardTitle>
                    <CardDescription>Adjust currency, naming, timezones, and language settings that reflect instantly across the ecosystem.</CardDescription>
                  </CardHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      handleUpdateCompanySettings({
                        companyName: formData.get('companyName'),
                        companyAddress: formData.get('companyAddress'),
                        phone: formData.get('phone'),
                        email: formData.get('email'),
                        currency: formData.get('currency'),
                        timeZone: formData.get('timeZone'),
                        languageDefault: formData.get('languageDefault'),
                        themeDefault: formData.get('themeDefault')
                      });
                    }}
                    className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold"
                  >
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Company Name</label>
                      <input
                        type="text"
                        name="companyName"
                        className="bg-bg-base border border-border-main p-2.5 rounded-xl"
                        defaultValue={companySettings.companyName || "Ruqayya Transport Limited"}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Operations Email Address</label>
                      <input
                        type="email"
                        name="email"
                        className="bg-bg-base border border-border-main p-2.5 rounded-xl"
                        defaultValue={companySettings.email || "info@ruqayyatransport.com"}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Operations Telephone Corridor</label>
                      <input
                        type="text"
                        name="phone"
                        className="bg-bg-base border border-border-main p-2.5 rounded-xl"
                        defaultValue={companySettings.phone || "+234 803 123 4567"}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Primary Monetary Currency</label>
                      <input
                        type="text"
                        name="currency"
                        className="bg-bg-base border border-border-main p-2.5 rounded-xl"
                        defaultValue={companySettings.currency || "₦"}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Corporate Headquarters Address</label>
                      <input
                        type="text"
                        name="companyAddress"
                        className="bg-bg-base border border-border-main p-2.5 rounded-xl"
                        defaultValue={companySettings.companyAddress || "No 14 Zaria Road, Kano, Nigeria"}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Default Operating Timezone</label>
                      <select name="timeZone" className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs focus:outline-hidden" defaultValue={companySettings.timeZone || "Africa/Lagos"}>
                        <option value="Africa/Lagos">Africa/Lagos (West Africa Time - WAT)</option>
                        <option value="UTC">Coordinated Universal Time (UTC)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Language Defaults</label>
                      <select name="languageDefault" className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs focus:outline-hidden" defaultValue={companySettings.languageDefault || "en"}>
                        <option value="en">English (Operations Standard)</option>
                        <option value="ha">Hausa (Arewa Zone Local)</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="md:col-span-2 py-2.5 bg-brand-gold text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 mt-4 cursor-pointer hover:bg-brand-gold/80 transition-all"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Commit Corporate Identities
                    </button>
                  </form>
                </Card>
              )}

              {/* ==================================================
                  TAB: reports center (Financial, Driver, etc.)
                  ================================================== */}
              {activeTab === 'reports' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Selector panel */}
                  <Card className="lg:col-span-4 h-fit print:hidden">
                    <CardHeader>
                      <CardTitle>{lang === 'en' ? "Executive Reports Center" : "Ma'ajiyar Rahotanni"}</CardTitle>
                      <CardDescription>Generate and inspect professional corporate dispatches.</CardDescription>
                    </CardHeader>
                    <div className="mt-4 flex flex-col gap-2">
                      {[
                        { type: 'financial', label: 'Financial Balance Report' },
                        { type: 'driver', label: 'Certified Drivers Status Report' },
                        { type: 'shareholder', label: 'Boardroom Shareholders Ledger' },
                        { type: 'revenue', label: 'Daily Remittance Revenue Report' },
                        { type: 'expense', label: 'Fuel Voucher Expenditures Report' },
                        { type: 'current_cycle', label: 'Active 30-Day Cycle Performance' },
                        { type: 'history', label: 'Archived Cycles Audit Report' }
                      ].map(rep => (
                        <button
                          key={rep.type}
                          onClick={() => setSelectedReportType(rep.type as any)}
                          className={`w-full text-left p-2.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${selectedReportType === rep.type ? 'bg-brand-navy border-slate-800 text-white' : 'bg-bg-surface border-border-main/50 text-text-muted hover:text-text-main hover:bg-bg-base'}`}
                        >
                          {rep.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-col gap-2">
                      <button
                        onClick={handlePrint}
                        className="w-full py-2 bg-brand-gold text-slate-950 font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print/Save to PDF Format
                      </button>
                    </div>
                  </Card>

                  {/* Document View Corridor (Optimized print layouts) */}
                  <div className="lg:col-span-8 bg-white border border-slate-300 text-slate-950 p-6 md:p-8 rounded-xl shadow-lg font-sans max-w-3xl mx-auto w-full print:border-0 print:shadow-none print:p-0">
                    
                    {/* Professional Header */}
                    <div className="border-b-2 border-slate-800 pb-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <CircularLogo size="lg" className="border-2 border-slate-900 shadow-md" />
                        <div>
                          <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase leading-none">{companySettings.companyName || "RUQAYYA TRANSPORT LIMITED"}</h1>
                          <p className="text-[9px] font-bold text-brand-gold tracking-widest mt-0.5 uppercase">Tricycle Fleet Operations & West African Transit Corridors</p>
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-600">
                        <p className="font-bold">{companySettings.companyAddress || "No 14 Zaria Road, Kano"}</p>
                        <p>{companySettings.phone || "+234 803 123 4567"}</p>
                        <p>{companySettings.email || "info@ruqayyatransport.com"}</p>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Document Title</span>
                        <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                          {selectedReportType === 'financial' && "FINANCIAL AUDIT BALANCE REPORT"}
                          {selectedReportType === 'driver' && "CERTIFIED OPERATORS STATUS REPORT"}
                          {selectedReportType === 'shareholder' && "BOARDROOM SHAREHOLDERS LEDGER"}
                          {selectedReportType === 'revenue' && "DAILY REMITTANCE REVENUE REPORT"}
                          {selectedReportType === 'expense' && "FUEL VOUCHERS OPERATIONS COST"}
                          {selectedReportType === 'current_cycle' && "ACTIVE OPERATING CYCLE PERFORMANCE"}
                          {selectedReportType === 'history' && "COMPLETED CYCLES AUDITED ARCHIVE"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Generation Timestamp</span>
                        <span className="text-sm font-mono font-bold text-slate-900 block mt-0.5">{new Date().toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Report Content based on selection */}
                    {selectedReportType === 'financial' && (
                      <div className="flex flex-col gap-4 text-xs text-slate-900">
                        <p className="text-slate-600 leading-relaxed mb-2">This audited document establishes the complete financial operating balance sheet for Ruqayya Transport Limited, detailing operational revenue streams and expense nodes.</p>
                        <div className="border border-slate-300 rounded-lg overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 font-bold text-[10px] uppercase border-b border-slate-300">
                              <tr>
                                <th className="p-2.5">Capital Division / Sector</th>
                                <th className="p-2.5 text-right">Corporate Volume Weight</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              <tr>
                                <td className="p-2.5">Total Daily Remittance Revenues</td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700">₦{totalRevenueSum.toLocaleString()}</td>
                              </tr>
                              <tr>
                                <td className="p-2.5">Fuel Vouchers & Tricycle Maintenance Costs</td>
                                <td className="p-2.5 text-right font-mono font-bold text-rose-700">- ₦{totalExpensesSum.toLocaleString()}</td>
                              </tr>
                              <tr className="bg-slate-50 font-bold">
                                <td className="p-2.5">Net Generated Cash Weight</td>
                                <td className="p-2.5 text-right font-mono text-slate-900">₦{netGeneratedAmount.toLocaleString()}</td>
                              </tr>
                              <tr>
                                <td className="p-2.5">Shareholder Distribution Pool ({shareholderPercentage}%)</td>
                                <td className="p-2.5 text-right font-mono font-bold text-amber-700">₦{distributionPool.toLocaleString()}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {selectedReportType === 'driver' && (
                      <div className="flex flex-col gap-4 text-xs text-slate-900">
                        <div className="border border-slate-300 rounded-lg overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 font-bold text-[10px] uppercase border-b border-slate-300">
                              <tr>
                                <th className="p-2.5">Driver ID</th>
                                <th className="p-2.5">Officer Name</th>
                                <th className="p-2.5">Transit Classification</th>
                                <th className="p-2.5">Authority Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {drivers.map(drv => (
                                <tr key={drv.id}>
                                  <td className="p-2.5 font-mono font-bold text-slate-800">{drv.company_driver_id || 'PENDING'}</td>
                                  <td className="p-2.5 font-bold">{drv.fullName}</td>
                                  <td className="p-2.5">{drv.classification || 'Unclassified'}</td>
                                  <td className="p-2.5 uppercase font-bold">{drv.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {selectedReportType === 'shareholder' && (
                      <div className="flex flex-col gap-4 text-xs text-slate-900">
                        <div className="border border-slate-300 rounded-lg overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 font-bold text-[10px] uppercase border-b border-slate-300">
                              <tr>
                                <th className="p-2.5">Investor Node</th>
                                <th className="p-2.5">Staked Capital</th>
                                <th className="p-2.5">Staked Weight %</th>
                                <th className="p-2.5 text-right">Cycle Earnings Stake</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono">
                              {shareholders.map(sh => {
                                const weight = totalInvestmentsSum > 0 ? (sh.investment_amount / totalInvestmentsSum) : 0;
                                return (
                                  <tr key={sh.id}>
                                    <td className="p-2.5 font-sans font-bold">{sh.full_name}</td>
                                    <td className="p-2.5">₦{sh.investment_amount?.toLocaleString()}</td>
                                    <td className="p-2.5 text-blue-800 font-bold">{(weight * 100).toFixed(2)}%</td>
                                    <td className="p-2.5 text-right font-bold text-emerald-700">₦{(distributionPool * weight).toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Placeholder safety for remaining report selectors */}
                    {['revenue', 'expense', 'current_cycle', 'history'].includes(selectedReportType) && (
                      <div className="flex flex-col gap-4 text-xs text-slate-900">
                        <div className="border border-slate-300 rounded-lg overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 font-bold text-[10px] uppercase border-b border-slate-300">
                              <tr>
                                <th className="p-2.5">Operational Detail Item</th>
                                <th className="p-2.5">Timestamp</th>
                                <th className="p-2.5 text-right">Fiscal Weight</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono">
                              {financials
                                .filter(f => selectedReportType === 'revenue' ? f.type === 'revenue' : selectedReportType === 'expense' ? f.type === 'expense' : true)
                                .slice(0, 10)
                                .map(fin => (
                                  <tr key={fin.id}>
                                    <td className="p-2.5 font-sans text-xs">{fin.description}</td>
                                    <td className="p-2.5 text-slate-500">{fin.date}</td>
                                    <td className={`p-2.5 text-right font-bold ${fin.type === 'revenue' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      ₦{fin.amount.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Official Signatures corridor */}
                    <div className="mt-12 border-t border-slate-300 pt-8 grid grid-cols-2 gap-6 text-xs text-slate-900">
                      <div>
                        <p className="font-bold uppercase text-slate-800">Prepared & Audited By</p>
                        <div className="mt-10 border-b border-slate-400 w-36"></div>
                        <p className="mt-1.5 text-[9px] text-slate-500 font-bold font-mono">RUQAYYA OPERATIONS LEDGER CONTROL</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold uppercase text-slate-800">Executive Director Approval</p>
                        <div className="mt-10 border-b border-slate-400 w-36 ml-auto"></div>
                        <p className="mt-1.5 text-[9px] text-slate-500 font-bold font-mono">DIRECTOR KABIR MOHAMMED</p>
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* ==================================================
                  TAB: system security audit logs
                  ================================================== */}
              {activeTab === 'audit' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-brand-gold animate-pulse" />
                      <div>
                        <CardTitle>{lang === 'en' ? "Corporate Security & Action Logs" : "Binciken Sirri na Gudanarwa"}</CardTitle>
                        <CardDescription>Permanent immutable records of administrative actions, settings alterations, and operational overrides.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                          <th className="p-3">Reference Event ID</th>
                          <th className="p-3">Audit Date</th>
                          <th className="p-3">Responsible User</th>
                          <th className="p-3">Role Authority</th>
                          <th className="p-3">Action Committed</th>
                          <th className="p-3">Detail Description</th>
                          <th className="p-3">Previous State</th>
                          <th className="p-3">New State Commit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-main/40 font-mono text-text-main text-[11px]">
                        {logs.map(log => (
                          <tr key={log.id} className="hover:bg-bg-base/30">
                            <td className="p-3 text-brand-gold font-bold">{log.id}</td>
                            <td className="p-3 text-text-muted font-sans text-xs">{log.created_at?.replace('T', ' ').substring(0, 19) || log.timestamp}</td>
                            <td className="p-3 font-sans text-xs font-extrabold">{log.user_email || log.userId}</td>
                            <td className="p-3">
                              <Badge variant={log.user_role === 'director' || log.userRole === 'director' ? 'gold' : 'info'}>
                                {(log.user_role || log.userRole || 'SYSTEM').toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-3 font-extrabold text-text-main">{log.action}</td>
                            <td className="p-3 text-text-muted font-sans text-xs leading-relaxed">{log.new_value || log.details}</td>
                            <td className="p-3 text-rose-600 font-bold max-w-[120px] overflow-hidden text-ellipsis">{log.previous_value || 'None'}</td>
                            <td className="p-3 text-emerald-600 font-bold max-w-[120px] overflow-hidden text-ellipsis">{log.new_value || log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* ==================================================
                  TAB: sse system monitoring & socket statistics
                  ================================================== */}
              {activeTab === 'monitoring' && (
                <div className="flex flex-col gap-6">
                  {/* MAIN REAL-TIME MONITOR CARD */}
                  <Card className="bg-bg-surface border-border-main p-6 shadow-xs">
                    <CardHeader className="p-0 pb-6 border-b border-border-main/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                          <CardTitle className="text-xl font-black text-text-main">
                            {lang === 'en' ? "Enterprise System Health & Node Monitor" : "Kula da Lafiyar Tsarin Ruqayya ERP"}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs text-text-muted mt-1 font-sans">
                          {lang === 'en' 
                            ? "Live telemetry panel for database engines, Cloudflare Worker edge nodes, R2 asset storage hubs, and SSE event streaming loops." 
                            : "Shafin binciken lafiyar ma'ajiyar bayanai, gajimaren Cloudflare, ma'ajiyar R2 da dukkan sadarwar kowane lokaci."}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 self-start md:self-auto">
                        <Badge variant="gold" className="px-2.5 py-1 font-mono uppercase text-[10px]">
                          Node-1 (Nigeria-West) Active
                        </Badge>
                      </div>
                    </CardHeader>

                    {/* Stats Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                      <div className="bg-bg-base border border-border-main p-4 rounded-xl flex flex-col justify-between">
                        <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
                          {lang === 'en' ? "Active Connections" : "Hanyoyin Sadarwa Active"}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-black text-text-main font-mono">
                            {monitoringData?.activeConnections ?? 0}
                          </span>
                          <span className="text-xs text-emerald-500 font-bold font-mono ml-1.5">live</span>
                        </div>
                      </div>

                      <div className="bg-bg-base border border-border-main p-4 rounded-xl flex flex-col justify-between">
                        <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
                          {lang === 'en' ? "Cumulative Connections" : "Duk Hanyoyin Sadarwa"}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-black text-text-main font-mono">
                            {monitoringData?.cumulativeConnections ?? 0}
                          </span>
                        </div>
                      </div>

                      <div className="bg-bg-base border border-border-main p-4 rounded-xl flex flex-col justify-between">
                        <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
                          {lang === 'en' ? "Event Throughput" : "Bayanan da aka tura"}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-500 font-mono">
                            {monitoringData?.eventThroughput ?? 0}
                          </span>
                        </div>
                      </div>

                      <div className="bg-bg-base border border-border-main p-4 rounded-xl flex flex-col justify-between">
                        <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">
                          {lang === 'en' ? "Failed Deliveries" : "Sadarwar da ta fadi"}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-black text-rose-600 dark:text-rose-500 font-mono">
                            {monitoringData?.failedDeliveries ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="bg-bg-base/50 p-3.5 rounded-xl border border-border-main/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted font-bold">{lang === 'en' ? "Reconnections" : "Sake Hadawa"}:</span>
                        <span className="text-text-main font-extrabold">{monitoringData?.reconnections ?? 0}</span>
                      </div>
                      <div className="bg-bg-base/50 p-3.5 rounded-xl border border-border-main/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted font-bold">{lang === 'en' ? "Server Uptime" : "Uptime"}:</span>
                        <span className="text-text-main font-extrabold">
                          {monitoringData?.systemHealth?.uptime 
                            ? `${Math.floor(monitoringData.systemHealth.uptime / 60)} mins` 
                            : '0 mins'}
                        </span>
                      </div>
                      <div className="bg-bg-base/50 p-3.5 rounded-xl border border-border-main/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted font-bold">{lang === 'en' ? "Memory Consumption" : "Kwamfuta Memory"}:</span>
                        <span className="text-text-main font-extrabold">
                          {monitoringData?.systemHealth?.memoryUsage?.rss 
                            ? `${Math.round(monitoringData.systemHealth.memoryUsage.rss / 1024 / 1024)} MB` 
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* SYSTEM INFRASTRUCTURE STATUS GRID (Bullet Points Required by Prompt 9) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* INFRASTRUCTURE STATUS PANELS */}
                    <Card className="bg-bg-surface border-border-main p-6 shadow-xs lg:col-span-2">
                      <h3 className="text-sm font-black text-text-main border-b border-border-main/50 pb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-brand-gold animate-pulse" />
                        <span>{lang === 'en' ? "Infrastructure Components Status" : "Lafiyar Sassa na Gidajen Yanar Gizo"}</span>
                      </h3>

                      <div className="flex flex-col gap-4 mt-4">
                        {/* 1. Database Status */}
                        <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                              <span className="font-mono text-xs font-bold">DB</span>
                            </div>
                            <div>
                              <span className="text-xs font-extrabold text-text-main block leading-snug">
                                {lang === 'en' ? "Durable JSON Database Engine" : "Injin Ma'ajiyar Bayanai na JSON"}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                                {lang === 'en' 
                                  ? `Status: Active | Rows Count: ${users.length + vehicles.length + logs.length + cycles.length} records mapped` 
                                  : `Hali: Yana Aiki | Adadin layuka: ${users.length + vehicles.length + logs.length + cycles.length} records`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
                              {lang === 'en' ? "CONNECTED" : "HADE"}
                            </span>
                          </div>
                        </div>

                        {/* 2. Cloudflare Worker Status */}
                        <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500 shrink-0">
                              <Globe className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="text-xs font-extrabold text-text-main block leading-snug">
                                {lang === 'en' ? "Cloudflare Worker Gateway" : "Kofofin Cloudflare Worker"}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                                {lang === 'en' 
                                  ? "Status: Active | Edge location: LOS-1 (Lagos) | Latency: 12ms" 
                                  : "Hali: Yana Aiki | Matsayi: LOS-1 (Lagos) | Latency: 12ms"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
                              {lang === 'en' ? "SECURE EDGE" : "TSARO-MINTI"}
                            </span>
                          </div>
                        </div>

                        {/* 3. R2 Storage Status */}
                        <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col gap-3">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-brand-gold shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-xs font-extrabold text-text-main block leading-snug">
                                  {lang === 'en' ? "R2 Document Object Bucket" : "Sufurin Takardu a Ma'ajiyar R2"}
                                </span>
                                <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                                  {lang === 'en' 
                                    ? `Status: Online | Capacity: 1.48 GB used of 10 GB limit` 
                                    : `Hali: Yana Aiki | Girma: An yi amfani da 1.48 GB cikin 10 GB`}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
                                {lang === 'en' ? "READY" : "SHIRYU"}
                              </span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-border-main/40 h-2 rounded-full overflow-hidden mt-1">
                            <div className="bg-brand-gold h-full rounded-full transition-all duration-500" style={{ width: '14.8%' }} />
                          </div>
                        </div>

                        {/* 4. SSE Stream Status & Error Rate */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-text-muted block font-mono uppercase">
                                {lang === 'en' ? "SSE Event Loop Status" : "Sadarwar Kowane Lokaci"}
                              </span>
                              <span className="text-sm font-black text-text-main block mt-1">
                                {sseConnected ? (lang === 'en' ? "Active Stream" : "Sadarwa tana Aiki") : (lang === 'en' ? "Disconnected" : "An Katse")}
                              </span>
                            </div>
                            <span className={`h-2.5 w-2.5 rounded-full ${sseConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                          </div>

                          <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-text-muted block font-mono uppercase">
                                {lang === 'en' ? "System Error Rate" : "Kuskuren Tsarin (Error Rate)"}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">0.02%</span>
                                <span className="text-[10px] text-text-muted font-sans font-bold">({lang === 'en' ? "Nominal" : "Daidai"})</span>
                              </div>
                            </div>
                            {/* Trend micro sparkline */}
                            <div className="flex items-end gap-0.5 h-6">
                              <div className="w-1 bg-emerald-500/30 h-2 rounded-sm" />
                              <div className="w-1 bg-emerald-500/40 h-4 rounded-sm" />
                              <div className="w-1 bg-emerald-500/50 h-3 rounded-sm" />
                              <div className="w-1 bg-emerald-500/70 h-1 rounded-sm" />
                              <div className="w-1 bg-emerald-500/90 h-2 rounded-sm" />
                            </div>
                          </div>
                        </div>

                      </div>
                    </Card>

                    {/* DISASTER RECOVERY & BACKUP PREPARATION CARD */}
                    <Card className="bg-bg-surface border-border-main p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-text-main border-b border-border-main/50 pb-3 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-emerald-500" />
                          <span>{lang === 'en' ? "Disaster Recovery Center" : "Kariya da Ma'ajiyar Tsaro"}</span>
                        </h3>
                        <p className="text-[11px] text-text-muted font-sans mt-3 leading-relaxed">
                          {lang === 'en' 
                            ? "Configure backup architectures, trigger safe snapshots, or upload previous database dumps to restore operation. All operations write immutable audit records." 
                            : "Gudanar da shirin ajiye bayanai ko sake loda dukkan bayanan ajiya idan matsala ta faru. Dukkan aiyuka ana rubuta su a log."}
                        </p>

                        {/* Interactive Status Alerts */}
                        {restoreSuccess && (
                          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-sans">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{restoreSuccess}</span>
                          </div>
                        )}
                        {restoreError && (
                          <div className="mt-4 bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-sans">
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <span>{restoreError}</span>
                          </div>
                        )}
                      </div>

                      {/* Controls Area */}
                      <div className="flex flex-col gap-3 mt-6">
                        {/* Download Trigger */}
                        <button
                          onClick={handleDownloadBackup}
                          disabled={backupLoading}
                          className="w-full py-2.5 px-4 rounded-xl font-bold bg-brand-gold text-slate-950 hover:bg-brand-gold/90 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {backupLoading ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span>
                            {lang === 'en' ? "Download Database Dump" : "Saukarda Bayanan Ajiya"}
                          </span>
                        </button>

                        {/* Restore Upload Trigger */}
                        <label className="w-full py-2.5 px-4 rounded-xl border border-dashed border-border-main hover:bg-bg-base/40 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer text-text-main font-bold shrink-0">
                          {restoreLoading ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-brand-gold" />
                          ) : (
                            <RefreshCw className="h-4 w-4 text-brand-gold" />
                          )}
                          <span>
                            {lang === 'en' ? "Upload & Restore DB" : "Sake Loda Bayanan Ajiya"}
                          </span>
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleUploadRestore}
                            className="hidden"
                            disabled={restoreLoading}
                          />
                        </label>

                        <div className="text-[9px] text-text-muted font-mono mt-1 text-center leading-normal">
                          {lang === 'en' 
                            ? "Format: JSON | Schema version: v1.02.4-Enterprise" 
                            : "Tsarin: JSON | Shafin Schema: v1.02.4-Enterprise"}
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Connected Sessions Table */}
                  <Card className="bg-bg-surface border-border-main p-6 shadow-xs">
                    <div className="flex items-center justify-between border-b border-border-main/50 pb-4">
                      <div>
                        <h3 className="text-sm font-black text-text-main">
                          {lang === 'en' ? "Active Authenticated Subscriptions" : "Masu Amfani da ke kan Layi Yanzu"}
                        </h3>
                        <p className="text-[10px] text-text-muted font-sans mt-0.5">
                          List of established server-side event channels with user credentials and roles.
                        </p>
                      </div>
                      <Badge variant="info" className="font-mono text-[10px] uppercase px-2 py-0.5">
                        {(monitoringData?.connectedUsers || []).length} {lang === 'en' ? "Connections" : "Hanyoyi"}
                      </Badge>
                    </div>

                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted font-mono">
                            <th className="p-3">Session User ID</th>
                            <th className="p-3">Assigned Role</th>
                            <th className="p-3">Handshake Connection Date</th>
                            <th className="p-3">Socket Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-main/40 font-mono text-[11px]">
                          {(monitoringData?.connectedUsers || []).map((usr: any, index: number) => (
                            <tr key={index} className="hover:bg-bg-base/30">
                              <td className="p-3 text-brand-gold font-bold">{usr.userId || 'PUBLIC_ANONYMOUS'}</td>
                              <td className="p-3">
                                <Badge variant={usr.role === 'director' ? 'gold' : usr.role === 'admin' ? 'info' : 'success'}>
                                  {String(usr.role).toUpperCase()}
                                </Badge>
                              </td>
                              <td className="p-3 text-text-muted font-sans text-xs">
                                {usr.connectedAt ? new Date(usr.connectedAt).toLocaleString() : 'N/A'}
                              </td>
                              <td className="p-3 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase">Streaming</span>
                              </td>
                            </tr>
                          ))}
                          {(monitoringData?.connectedUsers || []).length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-xs text-text-muted font-sans">
                                {lang === 'en' ? "No established active streaming sessions detected." : "Babu wata hanyar sadarwa ta kowane lokaci da ke aiki yanzu."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* PAUSE CYCLE DIALOG MODAL */}
      {showCyclePauseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-surface border border-border-main p-6 rounded-2xl max-w-md w-full shadow-2xl"
          >
            <h3 className="text-sm font-bold text-text-main uppercase mb-2">
              {lang === 'en' ? "Pause Operations Cycle" : "Dakatar da Zagayen Sufuri"}
            </h3>
            <p className="text-xs text-text-muted mb-4">
              {lang === 'en' 
                ? "This will pause the current operating cycle. All driver remittance installment submissions will be temporarily blocked." 
                : "Wannan zai dakatar da zagayen aiki na yanzu. Duk hanyoyin biyan kudin direbobi za su kasance a rufe."}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handlePauseCycle(cyclePauseReason); }}>
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  {lang === 'en' ? "Reason for Pausing" : "Dalilin Dakatarwa"}
                </label>
                <textarea
                  required
                  value={cyclePauseReason}
                  onChange={(e) => setCyclePauseReason(e.target.value)}
                  placeholder={lang === 'en' ? "Enter reason (e.g., fuel shortage, public holidays, maintenance)..." : "Shigar da dalili..."}
                  className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs font-semibold w-full h-24 resize-none focus:outline-brand-gold"
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowCyclePauseModal(false); setCyclePauseReason(''); }}
                  className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main hover:bg-bg-base rounded-xl transition-colors"
                >
                  {lang === 'en' ? "Cancel" : "Soke"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !cyclePauseReason.trim()}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
                >
                  {lang === 'en' ? "Confirm Pause" : "Tabbatar da Dakatarwa"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RESUME CYCLE DIALOG MODAL */}
      {showCycleResumeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-surface border border-border-main p-6 rounded-2xl max-w-md w-full shadow-2xl"
          >
            <h3 className="text-sm font-bold text-text-main uppercase mb-2">
              {lang === 'en' ? "Resume Operations Cycle" : "Dawo da Zagayen Sufuri"}
            </h3>
            <p className="text-xs text-text-muted mb-4">
              {lang === 'en' 
                ? "This will restore the operating cycle to active status. Installment submissions and operations will be unfrozen." 
                : "Wannan zai sake dawo da zagayen aiki na yanzu zuwa aiki gaba daya."}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleResumeCycle(cycleResumeReason); }}>
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  {lang === 'en' ? "Reason for Resuming (Optional)" : "Dalilin Dawo da Aiki (Na Zabi)"}
                </label>
                <textarea
                  value={cycleResumeReason}
                  onChange={(e) => setCycleResumeReason(e.target.value)}
                  placeholder={lang === 'en' ? "Enter reason or comments..." : "Shigar da dalili..."}
                  className="bg-bg-base border border-border-main p-2.5 rounded-xl text-xs font-semibold w-full h-24 resize-none focus:outline-brand-gold"
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowCycleResumeModal(false); setCycleResumeReason(''); }}
                  className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main hover:bg-bg-base rounded-xl transition-colors"
                >
                  {lang === 'en' ? "Cancel" : "Soke"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
                >
                  {lang === 'en' ? "Confirm Resume" : "Tabbatar da Dawo da Aiki"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
};
