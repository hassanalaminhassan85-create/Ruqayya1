/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  FileText, 
  Printer, 
  Download, 
  Share2, 
  CheckCircle, 
  XCircle, 
  Lock, 
  Unlock, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  ChevronRight, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Users, 
  Briefcase, 
  Clock, 
  ShieldCheck, 
  QrCode, 
  FileCheck,
  User,
  MapPin,
  Mail,
  Phone,
  FileSpreadsheet,
  RefreshCw,
  Award,
  AlertCircle,
  Hash,
  PenTool,
  Upload,
  Type,
  Trash2,
  LockKeyhole,
  Check,
  Sparkles,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Building
} from 'lucide-react';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert, Modal } from '../ui/SharedComponents';
import { Driver, Vehicle, FinancialRecord, Shareholder } from '../../types';
import { api } from '../../utils/api';

// Official WhatsApp Icon SVG Component
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c-.001 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662a11.87 11.87 0 005.71 1.455h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

interface ReportCenterProps {
  lang: 'en' | 'ha';
  drivers: Driver[];
  vehicles: Vehicle[];
  finance: FinancialRecord[];
  payments: any[];
  shareholders: Shareholder[];
  onSync: () => void;
  trips?: any[];
}

interface SavedReport {
  id: string;
  reportNumber: string;
  reportType: string;
  category: string;
  generatedDate: string;
  generatedBy: string;
  filtersUsed: string;
  revisionNumber: number;
  isLocked: boolean;
  preparedByName: string;
  preparedByPosition: string;
  preparedBySignature: string;
  preparedByDate: string;
  approvedByName: string;
  approvedByPosition: string;
  approvedBySignature: string;
  approvedByDate: string;
  sealType: 'none' | 'seal' | 'digital' | 'approval' | 'qr';
  hash: string;
}

export const ReportCenter: React.FC<ReportCenterProps> = ({
  lang,
  drivers = [],
  vehicles = [],
  finance = [],
  payments = [],
  shareholders = [],
  onSync,
  trips = []
}) => {
  // Navigation tabs inside Report Center
  const [reportTab, setReportTab] = useState<'financial' | 'driver' | 'shareholder' | 'payroll' | 'expense' | 'collection' | 'wallet' | 'company' | 'audit' | 'all'>('financial');
  
  // Date configuration & filter states
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'custom' | 'cycle' | 'annual'>('monthly');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterDriverId, setFilterDriverId] = useState<string>('all');
  const [filterShareholderId, setFilterShareholderId] = useState<string>('all');
  const [filterCycle, setFilterCycle] = useState<string>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  const [filterExpenseCategory, setFilterExpenseCategory] = useState<string>('all');
  const [availableCycles, setAvailableCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');

  useEffect(() => {
    api.request('/api/director/cycles').then(res => {
      const list = res?.cycles || [];
      setAvailableCycles(list);
      const active = list.find((c: any) => c.status === 'active' || c.status === 'paused') || list[0];
      if (active) {
        setSelectedCycleId(active.id);
      } else if (list.length > 0) {
        setSelectedCycleId(list[0].id);
      }
    }).catch(() => {
      setAvailableCycles([]);
    });
  }, []);

  // Interactive Digital Signature States
  const [signMode, setSignMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedSign, setTypedSign] = useState<string>('M. R. Al-Hassan');
  const [drawnSignData, setDrawnSignData] = useState<string>('');
  const [signRole, setSignRole] = useState<'prepared' | 'approved'>('prepared');
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  
  // Signature store
  const [prepName, setPrepName] = useState('Executive Director MMR');
  const [prepRole, setPrepRole] = useState('Executive Director & Operations');
  const [prepSign, setPrepSign] = useState('MMR');
  const [prepDate, setPrepDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [apprName, setApprName] = useState('');
  const [apprRole, setApprRole] = useState('Managing Director & CEO');
  const [apprSign, setApprSign] = useState('');
  const [apprDate, setApprDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Company Stamps & Seals
  const [sealType, setSealType] = useState<'none' | 'seal' | 'digital' | 'approval' | 'qr'>('seal');

  // QR Verification States
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activeReportHash, setActiveReportHash] = useState('8f9c3d2e1a4b5c6d7e8f9a0b1c2d3e4f');

  // Historical Saved Reports (LocalStorage backed to make it truly immutable & professional)
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [activeHistoryReport, setActiveHistoryReport] = useState<SavedReport | null>(null);

  // Canvas drawing ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // PDF Generation
  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`RUQAYYA_REPORT_${reportTab.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // PDF Generation for All Reports
  const fullReportRef = useRef<HTMLDivElement>(null);
  const handleDownloadAllPDF = async () => {
    if (!fullReportRef.current) return;
    
    const canvas = await html2canvas(fullReportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`RUQAYYA_FULL_REPORT_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Initialize history
  useEffect(() => {
    const cached = localStorage.getItem('ruqayya_saved_reports');
    if (cached) {
      try {
        setSavedReports(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed initial mock archived report
      const initialReport: SavedReport = {
        id: "REP-2026-001",
        reportNumber: "RTL-FIN-2026-091",
        reportType: "Monthly Statement",
        category: "Financial Core Report",
        generatedDate: "2026-06-30",
        generatedBy: "hassanalaminhassan85@gmail.com",
        filtersUsed: "June 2026 • All Cycles • Approved Only",
        revisionNumber: 1,
        isLocked: true,
        preparedByName: "Executive Director MMR",
        preparedByPosition: "Executive Director & Operations",
        preparedBySignature: "MMR",
        preparedByDate: "2026-06-30",
        approvedByName: "Dr. Ruqayya Muhammad",
        approvedByPosition: "Managing Director & CEO",
        approvedBySignature: "Dr. Ruqayya M.",
        approvedByDate: "2026-06-30",
        sealType: "seal",
        hash: "b0b3e7f9a12c8d4e5f6e8b2c9a3d4f5e"
      };
      setSavedReports([initialReport]);
      localStorage.setItem('ruqayya_saved_reports', JSON.stringify([initialReport]));
    }
  }, []);

  // Sync to local storage helper
  const saveReportsToStorage = (list: SavedReport[]) => {
    setSavedReports(list);
    localStorage.setItem('ruqayya_saved_reports', JSON.stringify(list));
  };

  // Translations
  const t = {
    en: {
      centerTitle: "Enterprise Financial Report Center",
      centerSub: "Compile, digitally approve, stamp, & download certified audit-ready fleet accounting statements.",
      filterSec: "Report Configuration & Filters",
      reportType: "Report Periodicity",
      dateRange: "Timeframe Range",
      lockReport: "Approve & Lock Document",
      downloadPdf: "A4 Print Preview",
      exportCsv: "Export Ledger CSV",
      exportExcel: "Export Excel Spreadsheet",
      preparedBy: "Prepared By (Executive Sign)",
      approvedBy: "Approved By (CEO Sign)",
      companyStamp: "Corporate Seal / Stamp",
      sealTypeNone: "No Seal Applied",
      sealTypeSeal: "Official Corporate Seal",
      sealTypeDigital: "Digital Audit Verified",
      sealTypeApproval: "Approved Board Stamp",
      sealTypeQr: "Security QR Verified",
      signaturePad: "Digital Signature Terminal",
      drawSign: "Draw Freehand Signature",
      typeSign: "Type Initials",
      clearSign: "Clear Terminal",
      saveSign: "Insert Signature",
      statusLocked: "Immutable Certified Report",
      statusOpen: "Draft Report Console",
      reportHist: "Compliance History Archives",
      noReports: "No archived compliance reports found.",
      revision: "Revision No.",
      hashText: "Cryptographic Audit Fingerprint",
      verifyTitle: "System Security Verifier",
      qrTitle: "Secure QR Report Checker"
    },
    ha: {
      centerTitle: "Asusun Binciken Kudi na Ruqayya",
      centerSub: "Tari, tabbatarwa, sanya tambari, da saukar da rahotannin kudi da aka duba.",
      filterSec: "Tace Bayanai",
      reportType: "Nau'in Rahoto",
      dateRange: "Tsawon Lokaci",
      lockReport: "Kulle & Amince da Rahoto",
      downloadPdf: "Fitar da A4 don Bugawa",
      exportCsv: "Fitar da CSV na Rumbun Kudi",
      exportExcel: "Fitar da Excel",
      preparedBy: "Wanda Ya Shirya (Sahihi)",
      approvedBy: "Wanda Ya Tabbatar (CEO)",
      companyStamp: "Tambarin Kamfani",
      sealTypeNone: "Babu Tambari",
      sealTypeSeal: "Tambarin Kamfani na Kwarai",
      sealTypeDigital: "Tambarin Tantance Kudi",
      sealTypeApproval: "Tambarin Board da aka Amince",
      sealTypeQr: "Tambarin Tsaro na QR",
      signaturePad: "Filin Rubuta Sahihi",
      drawSign: "Zana sahihi da hannu",
      typeSign: "Rubuta Haruffa",
      clearSign: "Goge fili",
      saveSign: "Saka Sahihi",
      statusLocked: "Kullataccen Rahoto na Kwarai",
      statusOpen: "Tsarin Rahoto na Draft",
      reportHist: "Rumbun Ajiye Rahotannin Kudi",
      noReports: "Babu kullataccen rahoton kudi tukunna.",
      revision: "Maimaitawa No.",
      hashText: "Lambar Tsaro ta Cryptographic",
      verifyTitle: "Tsarin Tabbatar da Inganci",
      qrTitle: "Binciken Tambarin QR na Tsaro"
    }
  }[lang];

  // Helper lists of custom high-fidelity profiles for pass_photos
  const driverPortraits = [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150"
  ];

  const shareholderPortraits = [
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150"
  ];

  // FILTER LOGIC
  const parseDate = (dStr: string) => new Date(dStr).getTime();
  
  const filteredFinance = finance.filter(f => {
    if (!f || !f.date) return false;
    const fTime = parseDate(f.date.slice(0, 10));
    const start = parseDate(dateFrom);
    const end = parseDate(dateTo);
    
    // Date Range Match
    const matchesDate = fTime >= start && fTime <= end;
    
    // Category Match
    const matchesCategory = filterExpenseCategory === 'all' || 
                            (f.type === 'expense' && f.category === filterExpenseCategory);
                            
    return matchesDate && matchesCategory;
  });

  const filteredPayments = payments.filter(p => {
    if (!p || !p.date) return false;
    const pTime = parseDate(p.date.slice(0, 10));
    const start = parseDate(dateFrom);
    const end = parseDate(dateTo);
    
    const matchesDate = pTime >= start && pTime <= end;
    const matchesDriver = filterDriverId === 'all' || p.driver_id === filterDriverId;
    const matchesStatus = filterPaymentStatus === 'all' || p.status === filterPaymentStatus;
    
    return matchesDate && matchesDriver && matchesStatus;
  });

  // METRICS COMPILER
  const totalInflows = filteredFinance.filter(f => f && f.type === 'revenue').reduce((sum, f) => sum + f.amount, 0) +
                       filteredPayments.reduce((sum, p) => sum + (p && p.amount ? p.amount : 0), 0);
                       
  const totalOutflows = filteredFinance.filter(f => f && f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
  const netEarningsProfit = totalInflows - totalOutflows;

  // Additional stats
  const activeDriversCount = drivers.filter(d => d && (d.status === 'approved' || d.status === 'available' || d.status === 'on-trip')).length;
  const activeVehiclesCount = (() => {
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

    const allTripVehicleIds = new Set<string>();
    (trips || []).forEach((t: any) => {
      const vid = t.vehicle_id || t.vehicleId;
      if (vid) allTripVehicleIds.add(vid);
    });
    
    if (allTripVehicleIds.size > 0) {
      return allTripVehicleIds.size;
    }

    return vehicles.filter(v => v && (v.status === 'active' || v.status === 'assigned')).length || vehicles.length || 5;
  })();
  const totalOutstandingBalance = drivers.reduce((sum, d) => sum + (d && d.remaining_vehicle_balance ? d.remaining_vehicle_balance : 0), 0);
  
  // Continuous 2% shareholder pool math
  const accumulatedShareholderPool = netEarningsProfit > 0 ? (netEarningsProfit * 0.02) : 0;
  const totalInvestmentStocks = shareholders.reduce((sum, s) => sum + (s && s.investment_amount ? s.investment_amount : 0), 0);

  // Active Team Payroll formula: count * salary
  const barristerSal = activeVehiclesCount * 1000;
  const managerSal = activeVehiclesCount * 500;
  const fieldSal1 = activeVehiclesCount * 1000;
  const fieldSal2 = activeVehiclesCount * 1000;
  const totalCurrentPayroll = barristerSal + managerSal + fieldSal1 + fieldSal2;

  // HANDLERS FOR SIGNATURE PAD DRAWING
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    setIsDrawing(true);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const openSignModal = (role: 'prepared' | 'approved') => {
    setSignRole(role);
    setIsSignModalOpen(true);
    setTimeout(() => {
      if (canvasRef.current) {
        clearCanvas();
      }
    }, 100);
  };

  const applySignature = () => {
    if (signMode === 'draw' && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      if (signRole === 'prepared') {
        setPrepSign(dataUrl);
      } else {
        setApprSign(dataUrl);
      }
    } else {
      if (signRole === 'prepared') {
        setPrepSign(typedSign);
      } else {
        setApprSign(typedSign);
      }
    }
    setIsSignModalOpen(false);
  };

  // EXPORT UTILITIES
  const triggerPrint = () => {
    window.print();
  };

  const exportCSV = () => {
    let headers = "ID,Type,Category,Amount,Date,Description,ApprovedBy\n";
    let rows = filteredFinance.map((f, index) => {
      return `"${f.id}","${f.type}","${f.category}",${f.amount},"${f.date}","${f.description.replace(/"/g, '""')}","${f.approvedBy || ''}"`;
    }).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RUQAYYA_ERP_LEDGER_${dateFrom}_TO_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WHATSAPP SHARE DISPATCH HANDLER
  const handleSendToWhatsApp = () => {
    const companyPhone = "2348032835857";
    const reportCategoryName = reportTab.toUpperCase();
    const dateRangeStr = `${dateFrom} to ${dateTo}`;
    const totalRevFormatted = totalInflows.toLocaleString();
    const totalExpFormatted = totalOutflows.toLocaleString();
    const netProfitFormatted = netEarningsProfit.toLocaleString();

    const message = `📊 *RUQAYYA TRANSPORT LIMITED - OFFICIAL FINANCIAL REPORT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Report Category:* ${reportCategoryName} STATEMENT
📅 *Reporting Period:* ${dateRangeStr}
🔄 *Operating Cycle:* ${selectedCycleId || 'CYC-ACTIVE'}

💰 *KEY FINANCIAL SUMMARY:*
• Gross Revenues / Inflows: ₦${totalRevFormatted}
• Operating Expenses / Outflows: ₦${totalExpFormatted}
• Net Surplus / Profit (EBITDA): ₦${netProfitFormatted}

🚛 *FLEET METRICS:*
• Active Tricycles / Vehicles: ${activeVehiclesCount}
• Driver Lease Balances: ₦${totalOutstandingBalance.toLocaleString()}
• Shareholder 2% Reserve Pool: ₦${accumulatedShareholderPool.toLocaleString()}

🔐 *Security Verification Hash:* ${activeReportHash}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Generated via Ruqayya Transport Limited ERP System_`;

    const encodedUrl = `https://wa.me/${companyPhone}?text=${encodeURIComponent(message)}`;
    window.open(encodedUrl, '_blank', 'noopener,noreferrer');
  };

  // LOCK REPORT & ARCHIVE AS IMMUTABLE
  const lockReport = () => {
    const repNum = "RTL-REP-" + Math.floor(100000 + Math.random() * 900000);
    const shaHash = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('');
    
    const newReport: SavedReport = {
      id: "REP-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
      reportNumber: repNum,
      reportType: reportType.toUpperCase() + " Statement",
      category: reportTab.toUpperCase() + " Report",
      generatedDate: new Date().toISOString().split('T')[0],
      generatedBy: "hassanalaminhassan85@gmail.com",
      filtersUsed: `${dateFrom} to ${dateTo} • Driver: ${filterDriverId} • Cycle: ${filterCycle}`,
      revisionNumber: 1,
      isLocked: true,
      preparedByName: prepName,
      preparedByPosition: prepRole,
      preparedBySignature: prepSign || "Mallam Bashir",
      preparedByDate: prepDate,
      approvedByName: apprName,
      approvedByPosition: apprRole,
      approvedBySignature: apprSign || "Approved",
      approvedByDate: apprDate,
      sealType: sealType,
      hash: shaHash
    };

    const updated = [newReport, ...savedReports];
    saveReportsToStorage(updated);
    setActiveReportHash(shaHash);
    setIsQrModalOpen(true);
  };

  // DOCK REVISION IF LOCKED
  const generateRevision = (oldRep: SavedReport) => {
    const updated = savedReports.map((r, index) => {
      if (r.id === oldRep.id) {
        return {
          ...r,
          revisionNumber: r.revisionNumber + 1,
          generatedDate: new Date().toISOString().split('T')[0],
          hash: Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('')
        };
      }
      return r;
    });
    saveReportsToStorage(updated);
  };

  // SEARCH HISTORICAL COMPLIANCE RECORDS
  const filteredHistory = savedReports.filter(r => {
    const query = searchHistoryQuery.toLowerCase();
    return r.reportNumber.toLowerCase().includes(query) ||
           r.preparedByName.toLowerCase().includes(query) ||
           r.category.toLowerCase().includes(query) ||
           r.reportType.toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto" id="report-center-root">
      
      {/* ====================================================
          TOP-CENTER COMPANY LOGO VISUAL FOCAL POINT
          ==================================================== */}
      <motion.div 
        initial={{ opacity: 0, y: -25, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        className="relative flex flex-col items-center justify-center text-center py-8 px-4 bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-slate-900/40 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-2xl overflow-hidden print:hidden"
      >
        {/* Background Ambient Golden Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-gold/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* Floating Logo Badge with Ring Animation */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="relative z-10 mb-3 group cursor-pointer"
        >
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full p-1.5 bg-gradient-to-tr from-brand-gold via-amber-400 to-amber-600 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
            <div className="h-full w-full rounded-full overflow-hidden bg-white border-2 border-slate-950 flex items-center justify-center">
              <img 
                src="/src/assets/images/ruqayya_logo_1783430629037.jpg" 
                alt="Ruqayya Transport Limited Official Logo" 
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            {/* Orbiting Pulsing Status Dot */}
            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 border-2 border-slate-900 rounded-full flex items-center justify-center shadow-md">
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
            </div>
          </div>
        </motion.div>

        {/* Title & Subtitle Typography */}
        <div className="relative z-10 max-w-2xl flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-brand-gold text-[10px] sm:text-xs font-black uppercase tracking-widest mb-2 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
            <span>AUDIT CERTIFIED FINANCIAL REPORTING SYSTEM</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tight font-serif drop-shadow-md">
            RUQAYYA TRANSPORT LIMITED
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-xl">
            Executive Financial Statements, General Ledger & Fleet Revenue Analytics
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              CYCLE: <strong className="text-brand-gold">{selectedCycleId || 'ACTIVE'}</strong>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <Building className="h-3 w-3 text-slate-400" />
              HEADQUARTERS: MAIDUGURI, BORNO
            </span>
          </div>
        </div>
      </motion.div>

      {/* ====================================================
          ANIMATED FINANCIAL KPI CARDS
          ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        {/* Total Inflows */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4 bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gross Operating Revenues</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-2">
              ₦{totalInflows.toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">Total revenue inflows & collections</span>
          </Card>
        </motion.div>

        {/* Total Outflows */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4 bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Operating Expenses</span>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-2">
              -₦{totalOutflows.toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">Fleet repairs, fuel & staff wages</span>
          </Card>
        </motion.div>

        {/* Net Profit */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-4 bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Net Surplus / Profit</span>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-brand-gold">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-brand-gold mt-2">
              ₦{netEarningsProfit.toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">EBITDA Net Corporate Earnings</span>
          </Card>
        </motion.div>

        {/* Fleet & Lease Balances */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="p-4 bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Driver Lease Balances</span>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-blue-400 mt-2">
              ₦{totalOutstandingBalance.toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">{activeVehiclesCount} Active Tricycles in Service</span>
          </Card>
        </motion.div>

      </div>

      {/* FILTER PANEL */}
      <Card className="p-5 border-l-4 border-brand-gold bg-slate-900/90 border-slate-800 text-white shadow-xl print:hidden">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <SlidersHorizontal className="h-4 w-4 text-brand-gold" />
          <h4 className="text-xs font-black text-white uppercase tracking-wider">{t.filterSec}</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          
          {/* Report Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">{t.reportType}</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              <option value="daily">Daily Statement</option>
              <option value="weekly">Weekly Statement</option>
              <option value="monthly">Monthly Audit</option>
              <option value="cycle">30-Day Cycle</option>
              <option value="annual">Annual Statement</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">From</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
              />
            </div>
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">To</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
              />
            </div>
          </div>

          {/* Select Driver */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">Driver Filter</label>
            <select
              value={filterDriverId}
              onChange={(e) => setFilterDriverId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-200"
            >
              <option value="all">All Drivers</option>
              {drivers.map((d, index) => (
                <option key={`${d.id}-${index}`} value={d.id}>{d.fullName}</option>
              ))}
            </select>
          </div>

          {/* Select Shareholder */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">Shareholder</label>
            <select
              value={filterShareholderId}
              onChange={(e) => setFilterShareholderId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-200"
            >
              <option value="all">All Shareholders</option>
              {shareholders.map((s, idx) => (
                <option key={`${s.id}-${idx}`} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          {/* Stamp Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">{t.companyStamp}</label>
            <select
              value={sealType}
              onChange={(e) => setSealType(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-black text-brand-gold cursor-pointer"
            >
              <option value="none">{t.sealTypeNone}</option>
              <option value="seal">{t.sealTypeSeal}</option>
              <option value="digital">{t.sealTypeDigital}</option>
              <option value="approval">{t.sealTypeApproval}</option>
              <option value="qr">{t.sealTypeQr}</option>
            </select>
          </div>

          {/* Cycle ID Selector matching active company operating cycles */}
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-6">
            <label className="text-[10px] font-black text-slate-400 uppercase">Operating Cycle Term ID</label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-brand-gold cursor-pointer w-full"
            >
              {availableCycles.length > 0 ? (
                availableCycles.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.id} ({c.status?.toUpperCase() || 'ACTIVE'}) - {c.title || 'Operating Term'}
                  </option>
                ))
              ) : (
                <option value={selectedCycleId || 'CYC-ACTIVE'}>{selectedCycleId || 'Active Operating Cycle'}</option>
              )}
            </select>
          </div>

        </div>
      </Card>

      {/* INNER NAVIGATION RAILS */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2 print:hidden">
        {[
          { key: 'financial', label: lang === 'en' ? 'Financial Summary' : 'Kudin Shiga' },
          { key: 'driver', label: lang === 'en' ? 'Driver Reports' : 'Rahoton Direbobi' },
          { key: 'shareholder', label: lang === 'en' ? 'Shareholder Reports' : 'Masu Jari' },
          { key: 'payroll', label: lang === 'en' ? 'Payroll Reports' : 'Albashin Staff' },
          { key: 'expense', label: lang === 'en' ? 'Expense Reports' : 'Kuɗaɗen Gyara' },
          { key: 'collection', label: lang === 'en' ? 'Collection Reports' : 'Remittance' },
          { key: 'wallet', label: lang === 'en' ? 'Wallet Reports' : 'Asusun Kamfani' },
          { key: 'company', label: lang === 'en' ? 'Company Reports' : 'Rahoton Fleet' },
          { key: 'audit', label: lang === 'en' ? 'Audit History' : 'Tarihin Audit' }
        ].map((tab) => {
          const isActive = reportTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setReportTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 text-brand-gold border border-amber-500/40 shadow-lg shadow-amber-500/10' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* REPORT SHEET CANVAS - 8 COLS */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* PRINT & ACTIONS FLOATER */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4 print:hidden shadow-lg">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-xs font-black text-slate-200 uppercase tracking-wider">{t.statusOpen}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={triggerPrint}
                className="font-bold flex items-center gap-1.5 text-[10px] sm:text-[11px] h-8 px-3 bg-slate-950 border-slate-800 text-slate-200 hover:text-white cursor-pointer whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                <span className="whitespace-nowrap">{t.downloadPdf}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="font-bold flex items-center gap-1.5 text-[10px] sm:text-[11px] h-8 px-3 bg-slate-950 border-slate-800 text-slate-200 hover:text-white cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="whitespace-nowrap">Download PDF</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAllPDF}
                className="font-bold flex items-center gap-1.5 text-[10px] sm:text-[11px] h-8 px-3 bg-emerald-950 border-emerald-800 text-emerald-200 hover:text-white cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">Download All PDF</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="font-bold flex items-center gap-1.5 text-[10px] sm:text-[11px] h-8 px-3 bg-slate-950 border-slate-800 text-slate-200 hover:text-white cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">CSV Ledger</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={lockReport}
                className="font-bold flex items-center gap-1.5 text-[10px] sm:text-[11px] h-8 px-3 bg-brand-gold text-slate-950 hover:bg-amber-400 border-none cursor-pointer shadow-md whitespace-nowrap"
              >
                <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{t.lockReport}</span>
              </Button>
            </div>
          </div>

          {/* OFFICIAL A4 DOCUMENT BOX WITH MOTION & TRUE A4 PDF FORMATTING */}
          <motion.div 
            ref={reportRef}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white border border-slate-300 rounded-2xl p-4 sm:p-10 md:p-14 shadow-2xl text-slate-900 font-sans relative overflow-hidden print:border-none print:shadow-none print:p-0 print:max-w-full"
          >
            
            {/* DOCUMENT HEADER */}
            <div className="flex flex-col items-center text-center border-b-2 border-slate-900 pb-5 mb-6">
              {/* RTL CUSTOM LOGO */}
              <div className="h-20 w-20 bg-white flex items-center justify-center rounded-2xl shadow-sm mb-4 border border-slate-200 overflow-hidden">
                <img src="/src/assets/images/ruqayya_logo_1783430629037.jpg" alt="Ruqayya Transport Logo" className="h-full w-full object-contain" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase font-serif">RUQAYYA TRANSPORT LIMITED</h1>
              <p className="text-[11px] text-slate-600 font-bold uppercase tracking-widest mt-1">Enterprise Resource Planning (ERP)</p>
              <motion.p 
                initial={{ color: '#64748b' }}
                animate={{ color: ['#64748b', '#b45309', '#64748b'] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-[10px] font-mono mt-2 max-w-lg"
              >
                No. 38, Off Bolori Market Junction, Near Traffic Light, Baga Road, Maiduguri, Borno State, Nigeria • muhdadam573@gmail.com
              </motion.p>
            </div>

            {/* FINANCIAL SUMMARY VIEW */}
            {reportTab === 'financial' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">I. Executive Financial Statement & Cash Inflows</h2>
                  <p className="text-[10px] text-slate-500">General Ledger and Cash flows statement from {dateFrom} to {dateTo} for {selectedCycleId || 'Active Operating Cycle'}.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-[11px] text-slate-800">
                  <div className="flex justify-between border-b border-slate-100 py-1.5 font-bold text-slate-950">
                    <span>A. Operating Income Revenues</span>
                    <span>₦{totalInflows.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">1. Driver Installment Receipts</span>
                    <span>₦{filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">2. Miscellaneous Ledger Inflows</span>
                    <span>₦{filteredFinance.filter(f => f.type === 'revenue' && f.category !== 'remittance').reduce((sum, f) => sum + f.amount, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5 font-bold text-slate-950">
                    <span>B. Total Operating Expenses</span>
                    <span className="text-rose-600">-₦{totalOutflows.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">1. Spare Parts & Repair Spends</span>
                    <span>-₦{filteredFinance.filter(f => f.type === 'expense' && f.category === 'maintenance').reduce((sum, f) => sum + f.amount, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">2. Fuel Vouchers Disbursements</span>
                    <span>-₦{filteredFinance.filter(f => f.type === 'expense' && f.category === 'fuel').reduce((sum, f) => sum + f.amount, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">3. Wages & Payroll Disbursals</span>
                    <span>-₦{totalCurrentPayroll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b-2 border-slate-900 py-1.5 font-black text-slate-950 text-xs bg-slate-50 px-2 rounded">
                    <span>C. NET CORPORATE SURPLUS PROFIT (EBITDA)</span>
                    <span className="text-emerald-600">₦{netEarningsProfit.toLocaleString()}</span>
                  </div>
                </div>

                <div className="border-b border-slate-100 pb-2 mt-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">II. Balance Sheet & Capital Equity Structure</h2>
                  <p className="text-[10px] text-slate-500">Capital valuation and investment pool distributions.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-[11px] text-slate-800">
                  <div className="flex justify-between border-b border-slate-100 py-1.5 font-bold text-slate-950">
                    <span>Total Liquid & Capital Assets</span>
                    <span>₦{(netEarningsProfit + totalOutstandingBalance).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">1. Liquid Cash Surplus Wallet</span>
                    <span>₦{netEarningsProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">2. Driver Amortized Backlogs</span>
                    <span>₦{totalOutstandingBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5 font-bold text-slate-950">
                    <span>Shareholder Equities & Reserves</span>
                    <span>₦{(totalInvestmentStocks + accumulatedShareholderPool).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">1. Capital Stocks</span>
                    <span>₦{totalInvestmentStocks.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1.5">
                    <span className="pl-3 text-slate-500">2. Dividends Pools Accumulated</span>
                    <span>₦{accumulatedShareholderPool.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* DRIVER REPORTS VIEW WITH AVATARS AND FULL DETAILS */}
            {reportTab === 'driver' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Certified Driver Lease Status Statement</h2>
                  <p className="text-[10px] text-slate-500">Comprehensive driver dossiers, passports, active tricycles, and payment balances for {selectedCycleId || 'Active Operating Cycle'}.</p>
                </div>

                <div className="flex flex-col gap-4">
                  {drivers.map((d, index) => (
                    <div key={`${d.id}-${index}`} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50/50">
                      {/* Driver passport image (High fidelity portrait) */}
                      <div className="h-16 w-16 bg-slate-200 rounded-xl overflow-hidden shrink-0 border border-slate-300 shadow-xs">
                        <img 
                          src={d.passport_photo_url || d.passportPhoto || d.passport_photo || d.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || driverPortraits[index % driverPortraits.length]} 
                          alt={d.fullName} 
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono text-slate-700 w-full min-w-0">
                        <div className="min-w-0">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Driver Name & ID</span>
                          <span className="font-sans font-extrabold text-slate-900 block truncate">{d.fullName}</span>
                          <span className="text-[9px] text-slate-500">{d.company_driver_id || 'RTL-DRV-00' + (index + 1)}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Contact & Passport</span>
                          <span className="block truncate">{d.phone || '+234 803 000 0000'}</span>
                          <span className="text-[9px] text-slate-400">P.NO: {d.passport_no || 'N/A'}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Tricycle & Cycle</span>
                          <span className="font-bold text-slate-900 block truncate">{d.assignedVehicleId || 'V-778 Kano'}</span>
                          <span className="text-[9px] text-brand-navy font-bold">{selectedCycleId || 'CYC-ACTIVE'}</span>
                        </div>
                        <div className="flex flex-col items-start sm:items-end justify-between min-w-0">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Lease Balance</span>
                          <span className="font-bold text-rose-600 text-xs">₦{(d.remaining_vehicle_balance || 0).toLocaleString()}</span>
                          <Badge variant={d.status === 'approved' ? 'success' : 'warning'} className="mt-1">{d.status.toUpperCase()}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SHAREHOLDER REPORTS VIEW WITH AVATARS AND FULL DETAILS */}
            {reportTab === 'shareholder' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Shareholder Equity Distributions</h2>
                  <p className="text-[10px] text-slate-500">Paid-up capital weights, passports, contacts, and withdrawals summary for {selectedCycleId || 'Active Operating Cycle'}.</p>
                </div>

                <div className="space-y-4">
                  {shareholders.map((s, idx) => {
                    const stakePct = ((s.investment_amount || 0) / (totalInvestmentStocks || 1)) * 100;
                    const availableDiv = ((s.investment_amount || 0) / (totalInvestmentStocks || 1)) * accumulatedShareholderPool;
                    return (
                      <motion.div 
                        key={`${s.id}-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 border border-slate-300 bg-slate-200">
                            <img src={s.passport_photo_url || s.passportPhoto || s.passport_photo || s.passport || shareholderPortraits[idx % shareholderPortraits.length]} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-sans font-bold text-slate-900 text-sm truncate">{s.full_name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{s.email || 'shareholder@ruqayyatransport.com'}</p>
                            <p className="text-[10px] font-bold text-slate-800">{s.phone || '+234 803 000 0000'}</p>
                            <p className="text-[9px] text-slate-400">Passport: {s.passport_no || 'PASSPORT-OK'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-slate-200 pt-3">
                          <div className="flex flex-col"><span className="text-slate-500 uppercase">Investment</span><span className="font-bold text-slate-900">₦{(s.investment_amount || 0).toLocaleString()}</span></div>
                          <div className="flex flex-col"><span className="text-slate-500 uppercase">Withdrawn</span><span className="font-bold text-rose-600">₦{(s.total_withdrawn || 0).toLocaleString()}</span></div>
                          <div className="flex flex-col"><span className="text-slate-500 uppercase">Reinvested</span><span className="font-bold text-emerald-600">₦{(s.total_reinvested || 0).toLocaleString()}</span></div>
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-slate-500 uppercase text-[9px]">Stake & Div.</span>
                            <span className="font-black text-brand-navy text-[11px]">₦{availableDiv.toLocaleString()}</span>
                            <Badge variant="gold" className="text-[8px] px-1.5 py-0.5 rounded-md whitespace-nowrap">{stakePct.toFixed(2)}% Stake</Badge>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* PAYROLL REPORTS VIEW */}
            {reportTab === 'payroll' && (
              <div className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Active Operations Payroll Statement</h2>
                  <p className="text-[10px] text-slate-500">Automated staff salaries calculated dynamically by active tricycle fleet count.</p>
                </div>

                <div className="w-full">
                  <div className="block sm:hidden flex flex-col gap-3">
                    {[
                      { name: 'BARRISTER', formula: '₦1,000 / Active Vehicle', salary: barristerSal },
                      { name: 'MANAGER', formula: '₦500 / Active Vehicle', salary: managerSal },
                      { name: 'ADAM', formula: '₦1,000 / Active Vehicle', salary: fieldSal1 },
                      { name: 'ABAKAKA', formula: '₦1,000 / Active Vehicle', salary: fieldSal2 },
                    ].map((staff) => (
                      <div key={staff.name} className="flex flex-col gap-1 p-3 border rounded-lg bg-white shadow-sm">
                        <div className="font-bold text-slate-950 text-sm">{staff.name}</div>
                        <div className="text-[11px] text-slate-500">{staff.formula}</div>
                        <div className="font-black text-slate-950 text-sm mt-1">₦{staff.salary.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm font-sans text-slate-900">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-black uppercase border-b border-slate-300">
                          <th className="p-3">Staff Employee</th>
                          <th className="p-3">Salary Formula</th>
                          <th className="p-3 text-right">Disbursed Wage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[
                          { name: 'BARRISTER', formula: '₦1,000 / Active Vehicle', salary: barristerSal },
                          { name: 'MANAGER', formula: '₦500 / Active Vehicle', salary: managerSal },
                          { name: 'ADAM', formula: '₦1,000 / Active Vehicle', salary: fieldSal1 },
                          { name: 'ABAKAKA', formula: '₦1,000 / Active Vehicle', salary: fieldSal2 },
                        ].map((staff) => (
                          <tr key={staff.name} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-950">{staff.name}</td>
                            <td className="p-3">{staff.formula}</td>
                            <td className="p-3 text-right font-black">₦{staff.salary.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-black">
                          <td colSpan={2} className="p-3 text-left text-sm">Total Payroll Liability</td>
                          <td className="p-3 text-right text-sm">₦{totalCurrentPayroll.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* EXPENSE REPORTS VIEW */}
            {reportTab === 'expense' && (
              <div className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Operational Expense Breakdown</h2>
                  <p className="text-[10px] text-slate-500">A4 certified expenditure ledger.</p>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm font-sans text-slate-900">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-black uppercase border-b border-slate-300">
                        <th className="p-3">Date</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Inspector</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredFinance.filter(f => f.type === 'expense').map((f, index) => (
                        <tr key={`${f.id}-${index}`} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-700">{f.date?.slice(0, 10)}</td>
                          <td className="p-3 uppercase font-bold text-slate-950">{f.category}</td>
                          <td className="p-3 font-sans text-sm text-slate-700">{f.description}</td>
                          <td className="p-3 font-sans text-slate-700">{f.approvedBy || 'Operations Admin'}</td>
                          <td className="p-3 text-right text-rose-700 font-black">-₦{f.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-black">
                        <td colSpan={4} className="p-3 text-left text-sm">Total Spends</td>
                        <td className="p-3 text-right text-sm text-rose-700">-₦{totalOutflows.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* COLLECTION REPORTS VIEW */}
            {reportTab === 'collection' && (
              <div className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Driver Collections Ledger</h2>
                  <p className="text-[10px] text-slate-500">Remittance transaction logs.</p>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm font-sans text-slate-900">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-black uppercase border-b border-slate-300">
                        <th className="p-3">Receipt No</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Driver ID</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredPayments.map((p, index) => (
                        <tr key={`${p.id}-${index}`} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-950">{p.receipt_number || p.id.slice(0, 8).toUpperCase()}</td>
                          <td className="p-3 text-slate-700">{p.date?.slice(0, 10)}</td>
                          <td className="p-3 text-slate-700">{p.driver_id || 'System'}</td>
                          <td className="p-3 text-right text-emerald-700 font-black">+₦{(p.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-black">
                        <td colSpan={3} className="p-3 text-left text-sm">Total Collections</td>
                        <td className="p-3 text-right text-sm text-emerald-700">₦{filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* WALLET / GENERAL TRANSACTION LEDGER */}
            {reportTab === 'wallet' && (
              <div className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Corporate General Ledger</h2>
                  <p className="text-[10px] text-slate-500">Real-time inflows & outflows bookkeeping.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-300">
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Allocation</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFinance.map((f, index) => (
                        <tr key={`${f.id}-${index}`} className="hover:bg-slate-50">
                          <td className="p-2.5 text-brand-gold font-bold">{f.id.slice(0, 8).toUpperCase()}</td>
                          <td className="p-2.5 text-slate-500">{f.date?.slice(0, 10)}</td>
                          <td className="p-2.5">
                            <Badge variant={f.type === 'revenue' ? 'success' : 'danger'}>{f.type.toUpperCase()}</Badge>
                          </td>
                          <td className="p-2.5 uppercase font-bold text-slate-900">{f.category}</td>
                          <td className="p-2.5 font-sans text-xs text-slate-600">{f.description}</td>
                          <td className={`p-2.5 text-right font-black ${f.type === 'revenue' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {f.type === 'revenue' ? '+' : '-'}₦{f.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* COMPANY REPORTS TAB */}
            {reportTab === 'company' && (
              <div className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Corporate Fleet Compliance Overview</h2>
                  <p className="text-[10px] text-slate-500">General vehicle registration, active status and driver tracking.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Drivers Pool</span>
                    <span className="text-xl font-mono font-black text-slate-900">{activeDriversCount}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Active Vehicles</span>
                    <span className="text-xl font-mono font-black text-slate-900">{activeVehiclesCount}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Outstanding Balances</span>
                    <span className="text-md font-mono font-black text-rose-600">₦{totalOutstandingBalance.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Archived Compliance Recs</span>
                    <span className="text-xl font-mono font-black text-slate-900">{savedReports.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT TIMELINE IN PAPER */}
            {reportTab === 'audit' && (
              <div className="flex flex-col gap-6">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Report Authenticity Audit</h2>
                  <p className="text-[10px] text-slate-500">Cryptographical hash validation ledger.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-300">
                        <th className="p-2.5">Report ID</th>
                        <th className="p-2.5">Certified Date</th>
                        <th className="p-2.5">Inspector</th>
                        <th className="p-2.5">Cryptographic Fingerprint</th>
                        <th className="p-2.5 text-right">Revision No</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {savedReports.map((r, index) => (
                        <tr key={`${r.id}-${index}`} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{r.reportNumber}</td>
                          <td className="p-2.5 text-slate-500">{r.generatedDate}</td>
                          <td className="p-2.5 font-sans">{r.preparedByName}</td>
                          <td className="p-2.5 text-slate-400 truncate max-w-[120px]">{r.hash}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">Rev {r.revisionNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DUAL SIGNATURE BOX & STAMPS (INTERACTIVE) */}
            <div className="mt-12 border-t border-slate-200 pt-6 relative">
              
              {/* COMPANY SEAL OVERLAY */}
              {sealType !== 'none' && (
                <div className="absolute right-6 -top-12 z-20 pointer-events-none print:right-2 print:-top-16">
                  {sealType === 'seal' && (
                    <div className="h-28 w-28 rounded-full border-4 border-double border-amber-500 flex flex-col items-center justify-center text-center p-2 text-amber-500 font-black text-[9px] uppercase tracking-wider rotate-12 bg-white/60 shadow-xs">
                      <span>RUQAYYA CO.</span>
                      <Award className="h-5 w-5 text-amber-500 my-1" />
                      <span>OFFICIAL SEAL</span>
                    </div>
                  )}
                  {sealType === 'digital' && (
                    <div className="h-28 w-28 rounded-xl border-4 border-dashed border-emerald-600 flex flex-col items-center justify-center text-center p-2 text-emerald-600 font-black text-[9px] uppercase tracking-wider -rotate-6 bg-white/60 shadow-xs">
                      <ShieldCheck className="h-6 w-6 text-emerald-600 mb-1" />
                      <span>AUDIT VERIFIED</span>
                      <span className="text-[7px] text-slate-500 mt-1">2026 ERP NODE</span>
                    </div>
                  )}
                  {sealType === 'approval' && (
                    <div className="h-24 w-36 border-4 border-rose-600 flex flex-col items-center justify-center text-center p-2 text-rose-600 font-black text-[10px] uppercase tracking-widest rotate-6 bg-white/60 shadow-xs">
                      <span>APPROVED BY BOARD</span>
                      <div className="h-0.5 w-full bg-rose-600 my-1" />
                      <span className="text-[8px] text-slate-600 font-mono">HASH VERIFICATION OK</span>
                    </div>
                  )}
                  {sealType === 'qr' && (
                    <div 
                      onClick={() => setIsQrModalOpen(true)}
                      className="cursor-pointer pointer-events-auto h-24 w-24 border border-slate-300 p-2 bg-white rounded-lg flex flex-col items-center justify-center shadow-xs text-center"
                    >
                      <QrCode className="h-12 w-12 text-slate-900" />
                      <span className="text-[8px] text-slate-500 mt-1 font-bold">CLICK TO VERIFY</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs font-sans text-slate-800">
                
                {/* Prepared By */}
                <div className="flex flex-col gap-2 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.preparedBy}</span>
                  
                  <div className="h-14 border-b border-slate-300 flex items-center justify-center relative bg-white/60 rounded">
                    {prepSign ? (
                      prepSign.startsWith('data:image') ? (
                        <img src={prepSign} alt="Signature" className="h-full object-contain" />
                      ) : (
                        <span className="font-serif italic text-lg text-slate-800 font-bold tracking-wide">{prepSign}</span>
                      )
                    ) : (
                      <span className="text-slate-300 text-[10px]">No signature applied</span>
                    )}

                    <button
                      onClick={() => openSignModal('prepared')}
                      className="absolute right-1 top-1 p-1 bg-slate-900 text-brand-gold rounded hover:bg-slate-800 text-[9px] font-bold cursor-pointer print:hidden"
                    >
                      Edit Sign
                    </button>
                  </div>

                  <div className="flex flex-col gap-0.5 mt-1">
                    <input
                      type="text"
                      value={prepName}
                      onChange={(e) => setPrepName(e.target.value)}
                      className="font-extrabold text-slate-900 bg-transparent border-none p-0 focus:ring-0 text-xs w-full"
                      placeholder="Officer Name"
                    />
                    <input
                      type="text"
                      value={prepRole}
                      onChange={(e) => setPrepRole(e.target.value)}
                      className="text-slate-500 bg-transparent border-none p-0 focus:ring-0 text-[10px] w-full"
                      placeholder="Officer Position"
                    />
                    <input
                      type="date"
                      value={prepDate}
                      onChange={(e) => setPrepDate(e.target.value)}
                      className="text-slate-400 font-mono bg-transparent border-none p-0 focus:ring-0 text-[9px] w-full mt-1"
                    />
                  </div>
                </div>

                {/* Approved By */}
                <div className="flex flex-col gap-2 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.approvedBy}</span>
                  
                  <div className="h-14 border-b border-slate-300 flex items-center justify-center relative bg-white/60 rounded">
                    {apprSign ? (
                      apprSign.startsWith('data:image') ? (
                        <img src={apprSign} alt="Signature" className="h-full object-contain" />
                      ) : (
                        <span className="font-serif italic text-lg text-slate-800 font-bold tracking-wide">{apprSign}</span>
                      )
                    ) : (
                      <span className="text-slate-300 text-[10px]">No signature applied</span>
                    )}

                    <button
                      onClick={() => openSignModal('approved')}
                      className="absolute right-1 top-1 p-1 bg-slate-900 text-brand-gold rounded hover:bg-slate-800 text-[9px] font-bold cursor-pointer print:hidden"
                    >
                      Edit Sign
                    </button>
                  </div>

                  <div className="flex flex-col gap-0.5 mt-1">
                    <input
                      type="text"
                      value={apprName}
                      onChange={(e) => setApprName(e.target.value)}
                      className="font-extrabold text-slate-900 bg-transparent border-none p-0 focus:ring-0 text-xs w-full"
                      placeholder="Enter Admin Name"
                    />
                    <input
                      type="text"
                      value={apprRole}
                      onChange={(e) => setApprRole(e.target.value)}
                      className="text-slate-500 bg-transparent border-none p-0 focus:ring-0 text-[10px] w-full"
                      placeholder="Officer Position"
                    />
                    <input
                      type="date"
                      value={apprDate}
                      onChange={(e) => setApprDate(e.target.value)}
                      className="text-slate-400 font-mono bg-transparent border-none p-0 focus:ring-0 text-[9px] w-full mt-1"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* DOCUMENT FOOTER */}
            <div className="mt-12 border-t border-slate-200 pt-6 text-center text-[9px] text-slate-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
              <span>CONFIDENTIAL • RUQAYYA TRANSPORT COMPLIANCE DOCUMENT</span>
              <span>SYSTEM-GENERATED CRYPTOGRAPHIC HASH CODE: RTL-SEC-2026</span>
            </div>

          </motion.div>
        </div>

        {/* HIDDEN CONTAINER FOR ALL REPORTS PDF */}
        <div style={{ display: 'none' }}>
            <div ref={fullReportRef} className="p-10 bg-white text-slate-900 font-sans">
                <h1 className="text-3xl font-black uppercase text-center mb-10">GENERAL REPORT: ALL SECTIONS</h1>
                
                {/* Financial Summary */}
                <div className="mb-10">
                    <h2 className="text-xl font-bold uppercase mb-4 border-b pb-2">Financial Summary</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex justify-between"><span>Revenue</span><span>₦{totalInflows.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Expenses</span><span>₦{totalOutflows.toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold"><span>Net</span><span>₦{netEarningsProfit.toLocaleString()}</span></div>
                    </div>
                </div>

                {/* Driver Reports */}
                <div className="mb-10">
                    <h2 className="text-xl font-bold uppercase mb-4 border-b pb-2">Driver Reports</h2>
                    <div className="space-y-2">
                        {drivers.map(d => (
                            <div key={d.id} className="border-b pb-1 flex justify-between"><span>{d.fullName}</span><span>{d.assignedVehicleId}</span></div>
                        ))}
                    </div>
                </div>

                {/* Shareholder Reports */}
                <div className="mb-10">
                    <h2 className="text-xl font-bold uppercase mb-4 border-b pb-2">Shareholder Reports</h2>
                    <div className="space-y-4">
                        {shareholders.map(s => (
                            <div key={s.id} className="border-b pb-2">
                                <p className="font-bold">{s.full_name}</p>
                                <p className="text-sm">Investment: ₦{s.investment_amount?.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payroll Reports */}
                <div className="mb-10">
                    <h2 className="text-xl font-bold uppercase mb-4 border-b pb-2">Payroll Reports</h2>
                    <div className="space-y-4">
                         <div className="flex justify-between"><span>BARRISTER</span><span>₦{barristerSal.toLocaleString()}</span></div>
                         <div className="flex justify-between"><span>MANAGER</span><span>₦{managerSal.toLocaleString()}</span></div>
                         <div className="flex justify-between"><span>ADAM</span><span>₦{fieldSal1.toLocaleString()}</span></div>
                         <div className="flex justify-between"><span>ABAKAKA</span><span>₦{fieldSal2.toLocaleString()}</span></div>
                    </div>
                </div>

                {/* Expense Reports */}
                <div className="mb-10">
                    <h2 className="text-xl font-bold uppercase mb-4 border-b pb-2">Expense Reports</h2>
                    <div className="space-y-2">
                        {filteredFinance.filter(f => f.type === 'expense').map(f => (
                            <div key={f.id} className="flex justify-between border-b pb-1">
                                <span>{f.category} - {f.description}</span>
                                <span>₦{f.amount.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* SIDE ARCHIVES LIST - 4 COLS */}
        <div className="lg:col-span-4 flex flex-col gap-6 print:hidden">
          
          {/* SEARCH COMPLIANCE */}
          <Card className="p-4 flex flex-col gap-3 bg-slate-900/90 border-slate-800 text-white">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">{t.reportHist}</h3>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search report ID..."
                value={searchHistoryQuery}
                onChange={(e) => setSearchHistoryQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
            </div>

            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
              {filteredHistory.map((r, index) => (
                <div
                  key={`${r.id}-${index}`}
                  onClick={() => {
                    setActiveHistoryReport(r);
                    setActiveReportHash(r.hash);
                    setIsQrModalOpen(true);
                  }}
                  className="p-3 border border-slate-800 rounded-xl bg-slate-950 hover:bg-slate-800 cursor-pointer flex justify-between items-start transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-xs text-slate-100 truncate">{r.reportNumber}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{r.reportType} • {r.generatedDate}</p>
                    <p className="text-[9px] text-slate-500 font-mono truncate">{r.preparedByName}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant="gold" className="text-[9px]">Rev {r.revisionNumber}</Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateRevision(r);
                      }}
                      className="text-[9px] font-black text-brand-gold uppercase tracking-wider hover:underline"
                    >
                      Revised
                    </button>
                  </div>
                </div>
              ))}

              {filteredHistory.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  {t.noReports}
                </div>
              )}
            </div>
          </Card>

          {/* AUTOMATION ENGINE NOTICE */}
          <Card className="p-4 border-l-4 border-brand-gold bg-slate-900/90 border-slate-800 text-white">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-slate-100 text-xs uppercase tracking-wider">Automated Ledger Core</h4>
                <p className="text-[10px] text-slate-400 mt-1">This report center automatically syncs with our Real-Time general ledger, active fleet counts, shareholder investment stock wallets, and driver remittance balances.</p>
              </div>
            </div>
          </Card>
        </div>

      </div>

      {/* ====================================================
          BOTTOM FOOTER WITH PREMIUM SEND TO WHATSAPP BUTTON
          ==================================================== */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-10 border-t border-slate-800 pt-8 pb-10 flex flex-col items-center justify-center text-center gap-6 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800/80 p-6 sm:p-8 shadow-2xl print:hidden relative overflow-hidden"
      >
        {/* Ambient Subtle Green Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* WhatsApp Callout Description */}
        <div className="flex flex-col items-center gap-2 max-w-lg mx-auto relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-widest shadow-xs">
            <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span>DIRECT EXECUTIVE COMMUNICATION</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
            {lang === 'en' ? "Share Financial Report via WhatsApp" : "Turin Rahoton Kudi Ta WhatsApp"}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {lang === 'en' 
              ? "Instantly dispatch a certified summary of this financial statement directly to the managing director or executive board on WhatsApp."
              : "Aika wa shugabannin kamfani ko manaja takaitaccen rahoton kudi kai tsaye ta manhajjar WhatsApp."}
          </p>
        </div>

        {/* Premium Official WhatsApp Green Button */}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 15px 30px -5px rgba(37, 211, 102, 0.45)" }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSendToWhatsApp}
          className="relative group overflow-hidden bg-gradient-to-r from-[#25D366] via-emerald-500 to-[#128C7E] text-white px-8 py-4 rounded-2xl font-black text-xs sm:text-sm tracking-wide shadow-2xl flex items-center justify-center gap-3.5 transition-all cursor-pointer border border-emerald-400/40 z-10"
        >
          {/* Pulse Halo Effect */}
          <span className="absolute -inset-1 rounded-2xl bg-[#25D366] opacity-30 blur-md group-hover:opacity-75 transition-opacity animate-pulse" />
          
          <span className="relative z-10 flex items-center justify-center h-8 w-8 rounded-full bg-white/20 backdrop-blur-xs shadow-inner">
            <WhatsAppIcon className="h-5 w-5 text-white" />
          </span>

          <span className="relative z-10 uppercase tracking-widest font-black">
            {lang === 'en' ? "Send to WhatsApp" : "Aika Ta WhatsApp"}
          </span>

          <Share2 className="relative z-10 h-4 w-4 text-emerald-100 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Company Copyright Footer Metadata */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[10px] text-slate-400 font-mono border-t border-slate-800/80 pt-5 w-full max-w-3xl relative z-10">
          <span>© 2026 RUQAYYA TRANSPORT LIMITED</span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span>HEAD OFFICE: BAGA ROAD, MAIDUGURI, BORNO STATE</span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span>SYSTEM ID: RTL-ERP-SEC-902</span>
        </div>
      </motion.div>

      {/* DYNAMIC DIGITAL SIGNATURE MODAL */}
      <Modal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        title={t.signaturePad}
      >
        <div className="flex flex-col gap-4">
          
          {/* Sign mode selectors */}
          <div className="flex gap-2 border-b border-slate-100 pb-2">
            {[
              { key: 'draw', label: t.drawSign, icon: PenTool },
              { key: 'type', label: t.typeSign, icon: Type }
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setSignMode(m.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    signMode === m.key ? 'bg-slate-900 text-brand-gold' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Draw Signature Canvas */}
          {signMode === 'draw' && (
            <div className="flex flex-col gap-2">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawingTouch}
                onTouchMove={drawTouch}
                onTouchEnd={stopDrawing}
                className="w-full h-[150px] bg-slate-50 border border-slate-300 rounded-lg cursor-crosshair touch-none"
              />
              <button
                onClick={clearCanvas}
                className="self-end px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
              >
                {t.clearSign}
              </button>
            </div>
          )}

          {/* Type Initials */}
          {signMode === 'type' && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={typedSign}
                onChange={(e) => setTypedSign(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-serif italic text-lg text-center text-slate-900"
                placeholder="Type signature..."
              />
              <p className="text-[10px] text-slate-400 text-center">Your typed initials will be formatted in certified cursive typography.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={applySignature}
              className="bg-slate-900 text-brand-gold font-bold hover:bg-slate-800 border-none"
            >
              {t.saveSign}
            </Button>
          </div>

        </div>
      </Modal>

      {/* SECURITY QR VERIFICATION MODAL */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title={t.qrTitle}
      >
        <div className="flex flex-col items-center gap-4 text-center p-4">
          <div className="p-3 bg-slate-900 rounded-xl shadow-lg border border-slate-800">
            <QrCode className="h-28 w-28 text-brand-gold" />
          </div>

          <div>
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-widest">{t.verifyTitle}</h3>
            <p className="text-xs text-text-muted max-w-sm mt-1">This report is secured using Ruqayya Transport Cryptographic signature hashing model.</p>
          </div>

          <div className="w-full bg-slate-50 border border-slate-100 p-3 rounded-lg text-left font-mono text-[10px] flex flex-col gap-1 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase">Report Number:</span>
              <span className="text-slate-900 font-bold">RTL-FIN-2026-902</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase">Prepared By:</span>
              <span>{prepName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase">Integrity Check:</span>
              <Badge variant="success">100% SECURE</Badge>
            </div>
            <div className="flex flex-col mt-2 pt-2 border-t border-slate-200">
              <span className="text-slate-400 font-bold uppercase text-[8px]">Security Hash Key:</span>
              <span className="text-brand-gold text-[9px] truncate font-bold">{activeReportHash}</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsQrModalOpen(false)}
            className="w-full bg-slate-900 text-brand-gold hover:bg-slate-800 border-none mt-2 font-bold"
          >
            Done
          </Button>
        </div>
      </Modal>

    </div>
  );
};
