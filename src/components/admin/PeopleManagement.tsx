/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  User, 
  Percent, 
  FileText, 
  ShieldCheck, 
  Search, 
  Upload, 
  Plus, 
  Check, 
  X, 
  Eye, 
  Clock, 
  Trash2, 
  TrendingUp, 
  ShieldAlert, 
  AlertCircle,
  Briefcase,
  Layers,
  MapPin,
  Calendar,
  Lock,
  ChevronRight,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert, Modal } from '../ui/SharedComponents';
import { api } from '../../utils/api';
import { Vehicle, Driver, Shareholder } from '../../types';

interface PeopleManagementProps {
  lang: 'en' | 'ha';
  drivers: Driver[];
  vehicles: Vehicle[];
  shareholders: Shareholder[];
  onSync: () => void;
  currentUserRole?: string;
}

export const PeopleManagement: React.FC<PeopleManagementProps> = ({
  lang,
  drivers,
  vehicles,
  shareholders,
  onSync,
  currentUserRole = 'admin'
}) => {
  // Navigation Section State
  const [subTab, setSubTab] = useState<'drivers' | 'import' | 'shareholders' | 'documents' | 'pending'>('drivers');

  // Unified Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState<'all' | 'Smart' | 'Assisted'>('all');
  const [docCategoryFilter, setDocCategoryFilter] = useState<'all' | 'driver' | 'vehicle' | 'company'>('all');
  const [docStatusFilter, setDocStatusFilter] = useState<'all' | 'active' | 'expired' | 'pending'>('all');

  // Shared Modal Controls
  const [isDriverWizardOpen, setIsDriverWizardOpen] = useState(false);
  const [isShareholderModalOpen, setIsShareholderModalOpen] = useState(false);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [selectedDriverFor360, setSelectedDriverFor360] = useState<Driver | null>(null);
  const [selectedShareholderLedger, setSelectedShareholderLedger] = useState<Shareholder | null>(null);
  const [selectedDocumentPreview, setSelectedDocumentPreview] = useState<any | null>(null);

  // Review Queue Controls
  const [reviewDriver, setReviewDriver] = useState<Driver | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewCompanyId, setReviewCompanyId] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  // System Notifications inside feature
  const [alertError, setAlertError] = useState('');
  const [alertSuccess, setAlertSuccess] = useState('');

  // Local document state
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Fetch Documents
  const fetchDocuments = async () => {
    try {
      setDocsLoading(true);
      // Retrieve company, driver and vehicle docs from local state (we fetch via api if possible or simulate based on drivers/vehicles)
      const res = await api.getSelfDriverDocuments().catch(() => ({ driver_documents: [], vehicle_documents: [], company_documents: [] }));
      
      // Let's create a combined digital ledger of documents from active db state
      // Since selfDocuments endpoint is tailored for single driver, let's query a combined array
      // of documents if the endpoint exists, or fallback to mock data combined with active driver/vehicle docs
      const docList: any[] = [];
      
      // Seed with driver/vehicle documents
      drivers.forEach(drv => {
        if (drv.passportPhoto) {
          docList.push({
            id: `passport-${drv.id}`,
            title: `${drv.fullName} Passport Photo`,
            document_type: 'passport_photo',
            category: 'driver',
            file_url: drv.passportPhoto,
            owner_name: drv.fullName,
            created_at: drv.created_at || new Date().toISOString(),
            status: 'active',
            verified_by: 'System'
          });
        }
      });

      // Query from R2 mock data if available
      // Let's fetch self drivers documents to enrich
      setAllDocuments(docList);
    } catch (e) {
      console.error("Docs load error", e);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [drivers]);

  // -------------------------------------------------------------
  // MULTI-STEP DRIVER REGISTRATION WIZARD STATE
  // -------------------------------------------------------------
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState('');

  // Step 1: Personal Dossier
  const [drvFullName, setDrvFullName] = useState('');
  const [drvPhone, setDrvPhone] = useState('');
  const [drvAddress, setDrvAddress] = useState('');
  const [drvNin, setDrvNin] = useState('');
  const [drvLicense, setDrvLicense] = useState('');
  const [drvLicenseExpiry, setDrvLicenseExpiry] = useState('');

  // Step 2: Guarantor Info
  const [gFullName, setGFullName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gAddress, setGAddress] = useState('');
  const [gRelationship, setGRelationship] = useState('');
  const [gNin, setGNin] = useState('');
  const [gPassportBase64, setGPassportBase64] = useState('');

  // Step 3: Tricycle / Rig Assignment
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  // Step 4: Financial Settings
  const [drvAgreedAmount, setDrvAgreedAmount] = useState('180000'); // DEFAULT 30-DAY RATE
  const [drvCapitalValue, setDrvCapitalValue] = useState('15000000'); // DEFAULT LEASE COST

  // Step 5: Account Credentials
  const [drvEmail, setDrvEmail] = useState('');
  const [drvPassword, setDrvPassword] = useState('');
  const [drvRequirePassChange, setDrvRequirePassChange] = useState(true);
  const [drvPassportBase64, setDrvPassportBase64] = useState('');

  const resetWizard = () => {
    setWizardStep(1);
    setDrvFullName('');
    setDrvPhone('');
    setDrvAddress('');
    setDrvNin('');
    setDrvLicense('');
    setDrvLicenseExpiry('');
    setGFullName('');
    setGPhone('');
    setGAddress('');
    setGRelationship('');
    setGNin('');
    setGPassportBase64('');
    setSelectedVehicleId('');
    setDrvAgreedAmount('180000');
    setDrvCapitalValue('15000000');
    setDrvEmail('');
    setDrvPassword('');
    setDrvRequirePassChange(true);
    setDrvPassportBase64('');
    setWizardError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitDriverWizard = async () => {
    setWizardError('');
    setWizardLoading(true);
    try {
      if (!drvEmail) {
        throw new Error(lang === 'en' ? "System email address is mandatory." : "Dole ne a saka adireshin email.");
      }
      
      const payload = {
        personal: {
          fullName: drvFullName,
          phone: drvPhone,
          email: drvEmail.toLowerCase(),
          password: drvPassword || 'driver123',
          address: drvAddress,
          nin: drvNin,
          licenseNumber: drvLicense,
          licenseExpiry: drvLicenseExpiry,
          agreedAmount: parseFloat(drvAgreedAmount),
          remainingVehicleBalance: parseFloat(drvCapitalValue),
          classification: 'Assisted',
          passportPhoto: drvPassportBase64 || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
          mustChangePassword: drvRequirePassChange
        },
        guarantor: {
          fullName: gFullName,
          phone: gPhone,
          address: gAddress,
          relationship: gRelationship,
          nin: gNin,
          passport: gPassportBase64 || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
        },
        vehicle: {
          brand: "Bajaj",
          model: "RE Optima",
          plateNumber: selectedVehicleId 
            ? (vehicles.find(v => v.id === selectedVehicleId)?.plateNumber || `RTL-${Math.floor(100 + Math.random() * 900)}`)
            : `RTL-${Math.floor(100 + Math.random() * 900)}`,
          capacity: "4 Passengers",
          chassisNumber: "CHAS-" + Math.floor(100000 + Math.random() * 900000),
          engineNumber: "ENG-" + Math.floor(100000 + Math.random() * 900000),
          registrationNumber: "REG-" + Math.floor(100000 + Math.random() * 900000),
          fuelType: "gasoline"
        }
      };

      await api.registerDriver(payload);

      // Link selected vehicle
      if (selectedVehicleId) {
        await api.updateVehicle(selectedVehicleId, { status: 'assigned' });
      }

      setAlertSuccess(lang === 'en' ? "Standard Onboarding Profile created successfully!" : "An yi nasarar bude asusun direban!");
      setIsDriverWizardOpen(false);
      resetWizard();
      onSync();
    } catch (err: any) {
      setWizardError(err.message || "Failed to finalize registration.");
    } finally {
      setWizardLoading(false);
    }
  };

  // -------------------------------------------------------------
  // MIGRATION / IMPORT EXISTING PAPER DRIVERS STATE
  // -------------------------------------------------------------
  const [impDriverId, setImpDriverId] = useState('');
  const [impFullName, setImpFullName] = useState('');
  const [impEmail, setImpEmail] = useState('');
  const [impPhone, setImpPhone] = useState('');
  const [impAddress, setImpAddress] = useState('');
  const [impNin, setImpNin] = useState('');
  const [impLicense, setImpLicense] = useState('');
  const [impLicenseExpiry, setImpLicenseExpiry] = useState('');
  const [impTotalPaid, setImpTotalPaid] = useState('0');
  const [impInstallmentPos, setImpInstallmentPos] = useState('1');
  const [impBalanceCheckDate, setImpBalanceCheckDate] = useState(new Date().toISOString().split('T')[0]);
  const [impNotes, setImpNotes] = useState('Imported legacy paper contract record');

  // Guarantor import
  const [impGName, setImpGName] = useState('');
  const [impGPhone, setImpGPhone] = useState('');
  const [impGAddress, setImpGAddress] = useState('');
  const [impGRelationship, setImpGRelationship] = useState('');
  const [impGNin, setImpGNin] = useState('');

  // Tricycle assigned import
  const [impBrand, setImpBrand] = useState('Bajaj');
  const [impModel, setImpModel] = useState('RE Optima');
  const [impPlate, setImpPlate] = useState('');
  const [impChassis, setImpChassis] = useState('');
  const [impEngine, setImpEngine] = useState('');
  
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  const submitImportTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportLoading(true);

    if (!impDriverId || !impFullName || !impPhone || !impPlate) {
      setImportError(lang === 'en' ? "Please complete Corporate ID, Name, Phone, and Plate fields." : "Da fatan a cika shigar da ID, Suna, Lambar Waya da Lambar Mota.");
      setImportLoading(false);
      return;
    }

    try {
      const computedEmail = impEmail || `imported_${impPhone.replace(/\s/g, '').slice(-6)}@ruqayyah.com`;
      const agreed30Day = 180000;
      const initialLeaseValue = 15000000;
      
      // remaining balance dynamically modeled
      const computedRemaining = initialLeaseValue - parseFloat(impTotalPaid);

      const payload = {
        personal: {
          fullName: impFullName,
          phone: impPhone,
          email: computedEmail,
          password: "imported_safe_pass",
          address: impAddress,
          nin: impNin,
          licenseNumber: impLicense,
          licenseExpiry: impLicenseExpiry,
          agreedAmount: agreed30Day,
          vehiclePurchasePrice: initialLeaseValue,
          remainingVehicleBalance: computedRemaining,
          classification: 'Assisted',
          companyDriverId: impDriverId,
          totalPaidToDate: parseFloat(impTotalPaid),
          currentInstallmentPosition: parseInt(impInstallmentPos),
          openingBalanceDate: impBalanceCheckDate,
          openingNotes: impNotes
        },
        guarantor: {
          fullName: impGName || "Administrative Placeholder",
          phone: impGPhone || "+234 000 000 0000",
          address: impGAddress || "Corporate Records",
          relationship: impGRelationship || "Guarantor",
          nin: impGNin || "00000000000"
        },
        vehicle: {
          brand: impBrand,
          model: impModel,
          year: 2024,
          colour: "Yellow",
          plateNumber: impPlate.toUpperCase(),
          registrationNumber: `REG-${impPlate.toUpperCase()}`,
          chassisNumber: impChassis || `CHAS-${Math.floor(100000 + Math.random()*900000)}`,
          engineNumber: impEngine || `ENG-${Math.floor(100000 + Math.random()*900000)}`,
          capacity: "4 Passengers"
        }
      };

      await api.importDriver(payload);

      setAlertSuccess(lang === 'en' ? "Paper record migrated and dynamic contract initialized!" : "An yi nasarar shigar da bayanan wannan yarjejeniya!");
      
      // Reset Import Fields
      setImpDriverId('');
      setImpFullName('');
      setImpEmail('');
      setImpPhone('');
      setImpAddress('');
      setImpNin('');
      setImpLicense('');
      setImpPlate('');
      setImpTotalPaid('0');
      setImpInstallmentPos('1');
      setImpGName('');
      setImpGPhone('');
      onSync();
    } catch (err: any) {
      setImportError(err.message || "Failed to migrate ledger.");
    } finally {
      setImportLoading(false);
    }
  };

  // -------------------------------------------------------------
  // SHAREHOLDER REGISTRATION & CAPITAL WALLET CREATION
  // -------------------------------------------------------------
  const [shName, setShName] = useState('');
  const [shPhone, setShPhone] = useState('');
  const [shEmail, setShEmail] = useState('');
  const [shAddress, setShAddress] = useState('');
  const [shInvestment, setShInvestment] = useState('');
  const [shPassword, setShPassword] = useState('');
  const [shJoinDate, setShJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [shPassportBase64, setShPassportBase64] = useState('');
  
  const [shLoading, setShLoading] = useState(false);
  const [shError, setShError] = useState('');

  const submitShareholderForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setShError('');
    setShLoading(true);

    if (!shName || !shPhone || !shEmail || !shInvestment) {
      setShError(lang === 'en' ? "Complete all required fields." : "Da fatan a cika duka bayanan.");
      setShLoading(false);
      return;
    }

    try {
      // Register shareholder inside core investment system
      const payload = {
        fullName: shName,
        phone: shPhone,
        email: shEmail.toLowerCase(),
        address: shAddress,
        investmentAmount: parseFloat(shInvestment),
        investmentDate: shJoinDate,
        passportPhoto: shPassportBase64 || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150',
        password: shPassword || 'shareholder123',
        mustChangePassword: true
      };

      await api.addShareholder(payload);

      setAlertSuccess(lang === 'en' ? "Shareholder account, dynamic earnings ledger & wallet initialized successfully!" : "An yi nasarar rajistar mai hannun jarin tare da asusun sa!");
      setIsShareholderModalOpen(false);
      
      // Reset Form
      setShName('');
      setShPhone('');
      setShEmail('');
      setShAddress('');
      setShInvestment('');
      setShPassword('');
      setShPassportBase64('');
      onSync();
    } catch (err: any) {
      setShError(err.message || "Failed to create investor profile.");
    } finally {
      setShLoading(false);
    }
  };

  // -------------------------------------------------------------
  // CLOUDFLARE R2 DOCUMENT ARCHIVE STATE
  // -------------------------------------------------------------
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('Passport Photo');
  const [docFileBase64, setDocFileBase64] = useState('');
  const [docDriverId, setDocDriverId] = useState('');
  const [docVehicleId, setDocVehicleId] = useState('');
  const [docUploadLoading, setDocUploadLoading] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocUploadError('');
    setDocUploadLoading(true);

    if (!docTitle || !docFileBase64) {
      setDocUploadError(lang === 'en' ? "Please select a file and provide a title." : "Da fatan a zabi fayil sannan a ba shi suna.");
      setDocUploadLoading(false);
      return;
    }

    try {
      const payload = {
        title: docTitle,
        docType: docType,
        fileBase64: docFileBase64,
        driverId: docDriverId || undefined,
        vehicleId: docVehicleId || undefined
      };

      await api.uploadCompanyDocument(payload);

      setAlertSuccess(lang === 'en' ? "Document securely archived in R2 Storage!" : "An yi nasarar daura takardar a R2!");
      setIsUploadDocModalOpen(false);
      setDocTitle('');
      setDocFileBase64('');
      setDocDriverId('');
      setDocVehicleId('');
      fetchDocuments();
    } catch (err: any) {
      setDocUploadError(err.message || "Upload failure.");
    } finally {
      setDocUploadLoading(false);
    }
  };

  // -------------------------------------------------------------
  // REVIEW QUEUE / PENDING APPROVALS DECISION FORTS
  // -------------------------------------------------------------
  const handleReviewDecision = async (status: 'approved' | 'rejected' | 'correction_requested') => {
    if (!reviewDriver) return;
    setReviewActionLoading(true);
    setAlertError('');
    setAlertSuccess('');
    
    try {
      await api.updateDriverStatus(reviewDriver.id, {
        status,
        remarks: reviewRemarks,
        companyDriverId: status === 'approved' ? reviewCompanyId : undefined
      });

      setAlertSuccess(lang === 'en' ? `Decision committed successfully: driver roster updated.` : `An kammala tsarin yanke shawara a kan direba.`);
      setIsReviewModalOpen(false);
      setReviewDriver(null);
      setReviewRemarks('');
      setReviewCompanyId('');
      onSync();
    } catch (err: any) {
      setAlertError(err.message || "Failed to submit roster decision.");
    } finally {
      setReviewActionLoading(false);
    }
  };

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Filter lists based on Search input
  const filteredDriversList = drivers.filter(d => {
    const query = searchQuery.toLowerCase();
    const matchSearch = d.fullName.toLowerCase().includes(query) || 
                        d.phone.includes(query) || 
                        (d.companyDriverId && d.companyDriverId.toLowerCase().includes(query));
    if (driverFilter === 'all') return matchSearch;
    return matchSearch && d.classification === driverFilter;
  });

  const filteredShareholdersList = shareholders.filter(s => {
    const query = searchQuery.toLowerCase();
    return s.full_name.toLowerCase().includes(query) || s.phone.includes(query) || s.email.toLowerCase().includes(query);
  });

  // Calculate dynamic investment stats
  const totalShareholderCapital = shareholders.reduce((sum, s) => sum + s.investment_amount, 0);

  // Pending items in registry
  const pendingReviewDrivers = drivers.filter(d => d.status === 'pending');

  return (
    <div className="flex flex-col gap-6" id="people-management-root">
      
      {/* Dynamic Alerts */}
      {alertSuccess && (
        <Alert type="success" onClose={() => setAlertSuccess('')}>
          {alertSuccess}
        </Alert>
      )}
      {alertError && (
        <Alert type="danger" onClose={() => setAlertError('')}>
          {alertError}
        </Alert>
      )}

      {/* Primary People Management Section Title & Inner Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main/50 pb-4">
        <div>
          <h2 className="text-xl font-black text-brand-navy flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-gold" />
            {lang === 'en' ? "People Management System" : "Tsarin Gudanar da Jama’a"}
          </h2>
          <p className="text-xs text-text-muted mt-1 font-medium">
            {lang === 'en' ? "Manage, onboard, and verify professional drivers, shareholders, and corporate documentation." : "Gudanar da shigarwar direbobi, masu hannun jari, da takaddun kamfani."}
          </p>
        </div>

        {/* Action Controls based on current tab */}
        <div className="flex items-center gap-2">
          {subTab === 'drivers' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDriverWizardOpen(true)}
              className="font-bold text-xs border-brand-navy text-brand-navy hover:bg-brand-navy/5 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {lang === 'en' ? "New Smart Driver" : "Sabuwar Rijista"}
            </Button>
          )}
          {subTab === 'shareholders' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsShareholderModalOpen(true)}
              className="font-bold text-xs border-brand-navy text-brand-navy hover:bg-brand-navy/5 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {lang === 'en' ? "Register Investor" : "Zuba Jari"}
            </Button>
          )}
          {subTab === 'documents' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadDocModalOpen(true)}
              className="font-bold text-xs border-brand-navy text-brand-navy hover:bg-brand-navy/5 flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {lang === 'en' ? "Upload Archive File" : "Dora Takarda"}
            </Button>
          )}
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-bg-base/60 p-1 rounded-xl border border-border-main/40 max-w-max">
        <button
          onClick={() => { setSubTab('drivers'); setSearchQuery(''); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${subTab === 'drivers' ? 'bg-brand-navy text-brand-gold shadow-sm' : 'text-text-muted hover:text-text-main'}`}
        >
          <User className="h-3.5 w-3.5" />
          {lang === 'en' ? "Driver Registry" : "Kundayen Direbobi"}
        </button>
        <button
          onClick={() => { setSubTab('import'); setSearchQuery(''); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${subTab === 'import' ? 'bg-brand-navy text-brand-gold shadow-sm' : 'text-text-muted hover:text-text-main'}`}
        >
          <Layers className="h-3.5 w-3.5" />
          {lang === 'en' ? "Import Paper Records" : "Shigar da Takaddun Kwangila"}
        </button>
        <button
          onClick={() => { setSubTab('shareholders'); setSearchQuery(''); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${subTab === 'shareholders' ? 'bg-brand-navy text-brand-gold shadow-sm' : 'text-text-muted hover:text-text-main'}`}
        >
          <Percent className="h-3.5 w-3.5" />
          {lang === 'en' ? "Shareholders Pool" : "Masu Hannun Jari"}
        </button>
        <button
          onClick={() => { setSubTab('documents'); setSearchQuery(''); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${subTab === 'documents' ? 'bg-brand-navy text-brand-gold shadow-sm' : 'text-text-muted hover:text-text-main'}`}
        >
          <FileText className="h-3.5 w-3.5" />
          {lang === 'en' ? "Document Archive" : "Taskar Takardu"}
        </button>
        <button
          onClick={() => { setSubTab('pending'); setSearchQuery(''); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${subTab === 'pending' ? 'bg-brand-navy text-brand-gold shadow-sm relative' : 'text-text-muted hover:text-text-main'}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {lang === 'en' ? "Pending Approvals" : "Suri don Amincewa"}
          {pendingReviewDrivers.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white font-extrabold text-[8px] h-4 w-4 rounded-full flex items-center justify-center animate-pulse">
              {pendingReviewDrivers.length}
            </span>
          )}
        </button>
      </div>

      {/* Global Filter & Search Header (Visible on most tabs) */}
      {subTab !== 'import' && subTab !== 'pending' && (
        <div className="flex flex-col sm:flex-row gap-3 items-center bg-bg-surface border border-border-main/50 p-3 rounded-xl shadow-xs">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder={
                subTab === 'drivers' ? (lang === 'en' ? "Search by full name, phone, or corporate ID..." : "Nemo direba...") :
                subTab === 'shareholders' ? (lang === 'en' ? "Search investor name, email, address..." : "Nemo mai hannun jari...") :
                (lang === 'en' ? "Search document title or owner name..." : "Nemo takarda...")
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-base border border-border-main text-text-main pl-9 pr-4 py-2 text-xs rounded-lg focus:outline-none focus:border-brand-navy font-medium"
            />
          </div>

          {subTab === 'drivers' && (
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <span className="text-[10px] text-text-muted font-bold uppercase shrink-0 mr-1">Filter:</span>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value as any)}
                className="bg-bg-base border border-border-main text-text-main text-xs py-1.5 px-3 rounded-lg focus:outline-none"
              >
                <option value="all">All Classifications</option>
                <option value="Smart">Smart Carrier</option>
                <option value="Assisted">Assisted Carrier</option>
              </select>
            </div>
          )}

          {subTab === 'documents' && (
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto shrink-0">
              <select
                value={docCategoryFilter}
                onChange={(e) => setDocCategoryFilter(e.target.value as any)}
                className="bg-bg-base border border-border-main text-text-main text-xs py-1.5 px-3 rounded-lg focus:outline-none"
              >
                <option value="all">All Folders</option>
                <option value="driver">Driver Dossiers</option>
                <option value="vehicle">Tricycle Rigs</option>
                <option value="company">Corporate Folders</option>
              </select>

              <select
                value={docStatusFilter}
                onChange={(e) => setDocStatusFilter(e.target.value as any)}
                className="bg-bg-base border border-border-main text-text-main text-xs py-1.5 px-3 rounded-lg focus:outline-none"
              >
                <option value="all">All States</option>
                <option value="active">Active/Verified</option>
                <option value="expired">Expired</option>
                <option value="pending">Verification Pending</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 1: DRIVERS REGISTRY & PROFILE VIEWS
          ------------------------------------------------------------- */}
      {subTab === 'drivers' && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                  <th className="p-4">Corporate ID</th>
                  <th className="p-4">Full Name</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Credentials</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/50 text-text-main">
                {filteredDriversList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-muted font-medium">
                      {lang === 'en' ? "No drivers matching query in active registry." : "Babu direbobi masu mazaunin wannan bayani."}
                    </td>
                  </tr>
                ) : (
                  filteredDriversList.map(d => {
                    const linkedRig = vehicles.find(v => v.driver_id === d.id);
                    return (
                      <tr key={d.id} className="hover:bg-bg-base/20 transition-all">
                        <td className="p-4 font-black font-mono text-[11px] text-brand-navy">
                          {d.companyDriverId || `PEND-${d.id.substring(0, 5).toUpperCase()}`}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={d.passport_photo_url || d.passportPhoto || d.passport_photo || d.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'}
                              alt={d.fullName}
                              className="h-8 w-8 rounded-full border border-border-main/50 object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <span className="font-bold text-text-main block">{d.fullName}</span>
                              <span className="text-[10px] text-text-muted font-mono block">{d.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-text-main font-mono text-[11px]">{d.phone}</span>
                            <span className="text-[10px] text-text-muted truncate max-w-[150px]" title={d.address}>{d.address}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col font-mono text-[10px] text-text-muted">
                            <span>NIN: {d.nin || 'N/A'}</span>
                            <span>DL: {d.licenseNumber || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                            d.classification === 'Smart' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {(d.classification || 'Assisted').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge variant={
                            d.status === 'pending' ? 'warning' :
                            d.status === 'correction_requested' ? 'default' :
                            d.status === 'rejected' ? 'danger' : 'success'
                          }>
                            {(d.status || '').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDriverFor360(d)}
                              className="px-2.5 py-1 text-[10px] font-extrabold flex items-center gap-1 border-brand-gold text-brand-navy hover:bg-brand-gold/10"
                            >
                              <Eye className="h-3 w-3" />
                              360° Dossier
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 2: IMPORT EXISTING PAPER RECORDS
          ------------------------------------------------------------- */}
      {subTab === 'import' && (
        <Card className="p-6 md:p-8">
          <div className="mb-6 pb-4 border-b border-border-main/50">
            <h3 className="text-lg font-black text-brand-navy flex items-center gap-2">
              <Layers className="h-5 w-5 text-brand-gold animate-pulse" />
              {lang === 'en' ? "Legacy Paper Records Migration" : "Shigar da Yarjejeniyar Tsofaffin Kwangiloli"}
            </h3>
            <p className="text-xs text-text-muted mt-1 font-medium">
              {lang === 'en' ? "Digitize paper ledger contracts directly into the active D1 database. Enter historical payments to accurately build the dynamic amortization ledger." : "Hada tsofaffin yarjejeniyar kudi da bayanai na takarda kai tsaye zuwa rumbun ajiya don fara lissafi na gaske."}
            </p>
          </div>

          {importError && <Alert type="danger" onClose={() => setImportError('')}>{importError}</Alert>}

          <form onSubmit={submitImportTool} className="flex flex-col gap-6">
            
            {/* Section 1: Corporate ID & Profile Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">RTL Corporate Driver ID *</label>
                <input
                  type="text"
                  placeholder="e.g. RTL-DRV-102"
                  value={impDriverId}
                  onChange={(e) => setImpDriverId(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Driver Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Alhaji Mustapha Yusuf"
                  value={impFullName}
                  onChange={(e) => setImpFullName(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Contact Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. +234 803..."
                  value={impPhone}
                  onChange={(e) => setImpPhone(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">System Login Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. mustapha@ruqayya.com"
                  value={impEmail}
                  onChange={(e) => setImpEmail(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Residential Address</label>
                <input
                  type="text"
                  placeholder="e.g. 14 Zaria Road, Kano"
                  value={impAddress}
                  onChange={(e) => setImpAddress(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">NIN Number</label>
                <input
                  type="text"
                  placeholder="11-digit National Identity"
                  value={impNin}
                  onChange={(e) => setImpNin(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">License Number</label>
                <input
                  type="text"
                  placeholder="Driver's License ID"
                  value={impLicense}
                  onChange={(e) => setImpLicense(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">License Expiry Date</label>
                <input
                  type="date"
                  value={impLicenseExpiry}
                  onChange={(e) => setImpLicenseExpiry(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
            </div>

            {/* Section 2: Historical Financial Position */}
            <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col gap-4">
              <h4 className="text-xs font-black text-brand-navy uppercase tracking-wider border-b border-border-main/30 pb-2">
                {lang === 'en' ? "Historical Contract Financial State" : "Tarihin Yarjejeniyar Kudi"}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Total Paid To Date (₦) *</label>
                  <input
                    type="number"
                    value={impTotalPaid}
                    onChange={(e) => setImpTotalPaid(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                    required
                  />
                  <span className="text-[9px] text-text-muted mt-1 block">
                    Remaining Dynamic Rig Balance: ₦{(15000000 - parseFloat(impTotalPaid || '0')).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Current Completed Installment (Pos)</label>
                  <input
                    type="number"
                    value={impInstallmentPos}
                    onChange={(e) => setImpInstallmentPos(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Date of Last Ledger Verification</label>
                  <input
                    type="date"
                    value={impBalanceCheckDate}
                    onChange={(e) => setImpBalanceCheckDate(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Historical Contract Notes / Metadata</label>
                <textarea
                  value={impNotes}
                  onChange={(e) => setImpNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  placeholder="Add details regarding historical payments or handovers..."
                />
              </div>
            </div>

            {/* Section 3: Guarantor Info */}
            <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col gap-4">
              <h4 className="text-xs font-black text-brand-navy uppercase tracking-wider border-b border-border-main/30 pb-2">
                {lang === 'en' ? "Guarantor File Parameters" : "Bayanin Guarantor"}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Guarantor Name *</label>
                  <input
                    type="text"
                    value={impGName}
                    onChange={(e) => setImpGName(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                    placeholder="Full name of guarantor"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Guarantor Phone *</label>
                  <input
                    type="text"
                    value={impGPhone}
                    onChange={(e) => setImpGPhone(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                    placeholder="Telephone code"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Relationship</label>
                  <input
                    type="text"
                    value={impGRelationship}
                    onChange={(e) => setImpGRelationship(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                    placeholder="Brother, Uncle, etc."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Guarantor NIN</label>
                  <input
                    type="text"
                    value={impGNin}
                    onChange={(e) => setImpGNin(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                    placeholder="11-digit identification"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Guarantor Residential Address</label>
                  <input
                    type="text"
                    value={impGAddress}
                    onChange={(e) => setImpGAddress(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                    placeholder="Residential address of guarantor"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Assigned Rig Specifications */}
            <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col gap-4">
              <h4 className="text-xs font-black text-brand-navy uppercase tracking-wider border-b border-border-main/30 pb-2">
                {lang === 'en' ? "Assigned Tricycle Rig Specifications" : "Bayanin Motar da aka Sanya masa"}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Plate Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. KMC-101-AA"
                    value={impPlate}
                    onChange={(e) => setImpPlate(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Brand / Make</label>
                  <input
                    type="text"
                    value={impBrand}
                    onChange={(e) => setImpBrand(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Model Name</label>
                  <input
                    type="text"
                    value={impModel}
                    onChange={(e) => setImpModel(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Chassis Number</label>
                  <input
                    type="text"
                    placeholder="Chassis VIN code"
                    value={impChassis}
                    onChange={(e) => setImpChassis(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-brand-navy uppercase block mb-1">Engine Number</label>
                  <input
                    type="text"
                    placeholder="Engine block code"
                    value={impEngine}
                    onChange={(e) => setImpEngine(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 border-t border-border-main/50 pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => setSubTab('drivers')}
                className="font-bold text-xs"
              >
                {lang === 'en' ? "Cancel" : "Soke"}
              </Button>
              <Button
                variant="secondary"
                type="submit"
                isLoading={importLoading}
                className="font-bold text-xs px-8 text-slate-950"
              >
                {lang === 'en' ? "Certify and Migrate Contract" : "Tabbatar da Kwangila"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 3: SHAREHOLDERS MANAGEMENT & DIVIDENDS
          ------------------------------------------------------------- */}
      {subTab === 'shareholders' && (
        <div className="flex flex-col gap-6">
          {/* Top investment stat board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-brand-navy to-slate-900 text-white p-5">
              <span className="text-[10px] font-mono tracking-wider text-slate-300 block uppercase font-bold">Total Authorized Equity Capital</span>
              <span className="text-2xl font-black block mt-1 font-mono text-brand-gold">₦{totalShareholderCapital.toLocaleString()}</span>
              <span className="text-[10px] font-medium text-slate-400 mt-2 block">
                Total seed funding logged in digital system ledger
              </span>
            </Card>

            <Card className="bg-bg-surface p-5 border border-border-main">
              <span className="text-[10px] font-mono tracking-wider text-text-muted block uppercase font-bold">Investor Nodes</span>
              <span className="text-2xl font-black text-brand-navy block mt-1 font-mono">{shareholders.length} Registered</span>
              <span className="text-[10px] font-medium text-text-muted mt-2 block">
                Each node holds automated authentication role profile
              </span>
            </Card>

            <Card className="bg-bg-surface p-5 border border-border-main">
              <span className="text-[10px] font-mono tracking-wider text-text-muted block uppercase font-bold">Standard Profit Split (Pool)</span>
              <span className="text-2xl font-black text-emerald-600 block mt-1 font-mono">2.0%</span>
              <span className="text-[10px] font-medium text-text-muted mt-2 block">
                Dynamic allocations run automatically at operating cycle close
              </span>
            </Card>
          </div>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                    <th className="p-4">Investor ID</th>
                    <th className="p-4">Full Name</th>
                    <th className="p-4">Contact Profile</th>
                    <th className="p-4 text-right">Investment Principal</th>
                    <th className="p-4 text-center">Equity Weight</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main/50 text-text-main">
                  {filteredShareholdersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-muted font-medium">
                        {lang === 'en' ? "No shareholders logged in the enterprise database." : "Babu masu hannun jari da aka saita."}
                      </td>
                    </tr>
                  ) : (
                    filteredShareholdersList.map((s, idx) => {
                      const weight = totalShareholderCapital > 0 ? (s.investment_amount / totalShareholderCapital) * 100 : 0;
                      return (
                        <tr key={s.id} className="hover:bg-bg-base/20 transition-all">
                          <td className="p-4 font-black font-mono text-[11px] text-brand-navy">
                            RTL-SH-{(idx + 1).toString().padStart(2, '0')}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={s.passport_photo_url || s.passportPhoto || s.passport_photo || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150'}
                                alt={s.full_name}
                                className="h-8 w-8 rounded-full border border-border-main/50 object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <span className="font-bold text-text-main block">{s.full_name}</span>
                                <span className="text-[10px] text-text-muted font-mono block">{s.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold font-mono text-[11px] text-text-main">{s.phone}</span>
                              <span className="text-[10px] text-text-muted truncate max-w-[150px]">{s.address}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-bold font-mono text-brand-navy">
                            ₦{s.investment_amount.toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            <span className="font-black font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded text-[11px] border border-emerald-100">
                              {weight.toFixed(2)}%
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <Badge variant={s.status === 'active' ? 'success' : 'danger'}>
                              {(s.status || 'ACTIVE').toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedShareholderLedger(s)}
                              className="px-2.5 py-1 text-[10px] font-extrabold border-brand-navy text-brand-navy hover:bg-brand-navy/5 cursor-pointer"
                            >
                              Earnings Ledger
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 4: CLOUDFLARE R2 SECURE DOCUMENT ARCHIVE
          ------------------------------------------------------------- */}
      {subTab === 'documents' && (
        <Card className="p-0 overflow-hidden">
          {docsLoading ? (
            <div className="p-12 text-center text-text-muted font-bold font-mono text-xs flex flex-col items-center justify-center gap-3">
              <Clock className="h-6 w-6 text-brand-gold animate-spin" />
              Loading system files from R2 secure vaults...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                    <th className="p-4">File Name / Owner</th>
                    <th className="p-4">Document Type</th>
                    <th className="p-4">Folder</th>
                    <th className="p-4">Archived At</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main/50 text-text-main">
                  {allDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-text-muted font-medium">
                        {lang === 'en' ? "No secure documents found matching query." : "Babu takardu a cikin wannan rukunin."}
                      </td>
                    </tr>
                  ) : (
                    allDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-bg-base/20 transition-all">
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <FileText className="h-5 w-5 text-brand-navy shrink-0" />
                            <div>
                              <span className="font-bold text-text-main block">{doc.title}</span>
                              <span className="text-[10px] text-text-muted block">Owner: {doc.owner_name || 'Corporate'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-text-muted">
                          {doc.document_type.replace(/_/g, ' ').toUpperCase()}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-bg-base border border-border-main">
                            {doc.category.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-text-muted font-mono text-[10px]">
                          {doc.created_at.substring(0, 10)}
                        </td>
                        <td className="p-4">
                          <Badge variant={doc.status === 'active' ? 'success' : 'warning'}>
                            {doc.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDocumentPreview(doc)}
                            className="px-2 py-1 text-[10px] font-bold border-brand-gold text-brand-navy hover:bg-brand-gold/10 flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            Preview File
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 5: PENDING APPROVALS QUEUE
          ------------------------------------------------------------- */}
      {subTab === 'pending' && (
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h3 className="text-md font-black text-brand-navy flex items-center gap-2 mb-4 pb-2 border-b border-border-main/50">
              <Clock className="h-5 w-5 text-brand-gold" />
              {lang === 'en' ? "Roster Candidates Verification" : "Masu Neman Shiga Rukunin Direbobi"}
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bg-base border-b border-border-main text-[10px] uppercase font-bold text-text-muted">
                    <th className="p-4">Candidate Name</th>
                    <th className="p-4">Telephone</th>
                    <th className="p-4">License / NIN</th>
                    <th className="p-4">Proposed Rig Specs</th>
                    <th className="p-4">Date Filed</th>
                    <th className="p-4 text-center">Roster Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main/50 text-text-main">
                  {pendingReviewDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-text-muted font-bold">
                        {lang === 'en' ? "Great! Roster review queue is completely empty." : "Duk masu neman shiga an riga an tantance su!"}
                      </td>
                    </tr>
                  ) : (
                    pendingReviewDrivers.map((d) => {
                      const linkedRig = vehicles.find(v => v.driver_id === d.id);
                      return (
                        <tr key={d.id} className="hover:bg-bg-base/20 transition-all">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={d.passport_photo_url || d.passportPhoto || d.passport_photo || d.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'}
                                alt={d.fullName}
                                className="h-8 w-8 rounded-full border object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <span className="font-extrabold text-text-main block">{d.fullName}</span>
                                <span className="text-[10px] text-text-muted font-mono block">{d.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-text-main">{d.phone}</td>
                          <td className="p-4">
                            <div className="flex flex-col font-mono text-[10px] text-text-muted">
                              <span>DL: {d.licenseNumber}</span>
                              <span>NIN: {d.nin || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="p-4 font-semibold text-text-muted">
                            {linkedRig ? `${linkedRig.plateNumber} (${linkedRig.brand})` : 'Register Only'}
                          </td>
                          <td className="p-4 text-text-muted font-mono text-[10px]">
                            {d.created_at ? d.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)}
                          </td>
                          <td className="p-4 text-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setReviewDriver(d);
                                setReviewCompanyId(`RTL-DRV-${Math.floor(100 + Math.random() * 900)}`);
                                setIsReviewModalOpen(true);
                              }}
                              className="px-3 py-1 font-bold text-[11px] text-slate-950 cursor-pointer"
                            >
                              Authorize dossier
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}


      {/* -------------------------------------------------------------
          MODALS & FLYOUTS
          ------------------------------------------------------------- */}

      {/* 1. MULTI-STEP DRIVER REGISTRATION WIZARD */}
      {isDriverWizardOpen && (
        <Modal onClose={() => setIsDriverWizardOpen(false)} title={lang === 'en' ? "Register Standard Smart Driver" : "Rijistar Direban Mota"}>
          <div className="flex flex-col gap-4 p-2 max-w-2xl">
            {/* Step indicators */}
            <div className="flex items-center justify-between border-b border-border-main/40 pb-3 mb-2 flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <span
                  key={s}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                    wizardStep === s 
                      ? 'bg-brand-navy text-brand-gold border border-brand-navy' 
                      : wizardStep > s 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-bg-base text-text-muted border border-border-main/50'
                  }`}
                >
                  Step {s}: {
                    s === 1 ? 'Personal' :
                    s === 2 ? 'Guarantor' :
                    s === 3 ? 'Tricycle' :
                    s === 4 ? 'Finance' : 'Account'
                  }
                </span>
              ))}
            </div>

            {wizardError && <Alert type="danger" onClose={() => setWizardError('')}>{wizardError}</Alert>}

            {/* Step 1: Personal Dossier */}
            {wizardStep === 1 && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase text-brand-navy">Step 1: Driver Personal Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">FULL NAME *</label>
                    <input
                      type="text"
                      placeholder="e.g. Alhaji Yusuf Musa"
                      value={drvFullName}
                      onChange={(e) => setDrvFullName(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">PHONE NUMBER *</label>
                    <input
                      type="text"
                      placeholder="e.g. +234..."
                      value={drvPhone}
                      onChange={(e) => setDrvPhone(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">RESIDENTIAL ADDRESS *</label>
                    <input
                      type="text"
                      placeholder="Complete physical address"
                      value={drvAddress}
                      onChange={(e) => setDrvAddress(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">NIN (NATIONAL ID) *</label>
                    <input
                      type="text"
                      placeholder="11 digits ID"
                      value={drvNin}
                      onChange={(e) => setDrvNin(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">DRIVER LICENSE CODE *</label>
                    <input
                      type="text"
                      placeholder="e.g. ABC098233"
                      value={drvLicense}
                      onChange={(e) => setDrvLicense(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">LICENSE EXPIRY DATE *</label>
                    <input
                      type="date"
                      value={drvLicenseExpiry}
                      onChange={(e) => setDrvLicenseExpiry(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">PASSPORT PHOTO</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setDrvPassportBase64)}
                      className="w-full text-xs text-text-muted"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsDriverWizardOpen(false)}
                    className="font-bold text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!drvFullName || !drvPhone || !drvAddress || !drvNin || !drvLicense || !drvLicenseExpiry) {
                        setWizardError('Please fill out all asterisk (*) fields to proceed.');
                        return;
                      }
                      setWizardError('');
                      setWizardStep(2);
                    }}
                    className="font-bold text-xs text-slate-950"
                  >
                    Continue to Guarantor
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Guarantor Info */}
            {wizardStep === 2 && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase text-brand-navy">Step 2: Guarantor Parameters</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">GUARANTOR FULL NAME *</label>
                    <input
                      type="text"
                      placeholder="e.g. Mallam Ibrahim Bello"
                      value={gFullName}
                      onChange={(e) => setGFullName(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">PHONE NUMBER *</label>
                    <input
                      type="text"
                      placeholder="e.g. +234..."
                      value={gPhone}
                      onChange={(e) => setGPhone(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">RESIDENTIAL ADDRESS *</label>
                    <input
                      type="text"
                      placeholder="Complete physical address"
                      value={gAddress}
                      onChange={(e) => setGAddress(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">RELATIONSHIP TO DRIVER *</label>
                    <input
                      type="text"
                      placeholder="Uncle, Brother, Employer, etc."
                      value={gRelationship}
                      onChange={(e) => setGRelationship(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">GUARANTOR NIN *</label>
                    <input
                      type="text"
                      placeholder="11 digits ID"
                      value={gNin}
                      onChange={(e) => setGNin(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">GUARANTOR PASSPORT PHOTO</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setGPassportBase64)}
                      className="w-full text-xs text-text-muted"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep(1)}
                    className="font-bold text-xs"
                  >
                    Go Back
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!gFullName || !gPhone || !gAddress || !gRelationship || !gNin) {
                        setWizardError('Please complete all guarantor details.');
                        return;
                      }
                      setWizardError('');
                      setWizardStep(3);
                    }}
                    className="font-bold text-xs text-slate-950"
                  >
                    Continue to Rig Assignment
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Tricycle assigned */}
            {wizardStep === 3 && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase text-brand-navy">Step 3: Fleet Rig Assignment</h4>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold block text-text-muted">SELECT FROM IDLE FLEET RIGS</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  >
                    <option value="">-- No Rig Assignment (Register Profile Only) --</option>
                    {vehicles.filter(v => v.status === 'idle').map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} - {v.brand} {v.model} ({v.colour})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">
                    Drivers are automatically linked to their vehicles in active operational cycle rosters.
                  </p>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep(2)}
                    className="font-bold text-xs"
                  >
                    Go Back
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setWizardStep(4)}
                    className="font-bold text-xs text-slate-950"
                  >
                    Continue to Financials
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Financial Settings */}
            {wizardStep === 4 && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase text-brand-navy">Step 4: Lease Financial Settings</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">AGREED 30 CYCLE AMOUNT TO BRING TO COMPANY (₦) *</label>
                    <input
                      type="number"
                      value={drvAgreedAmount}
                      onChange={(e) => setDrvAgreedAmount(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none font-mono"
                    />
                    <span className="text-[9px] text-text-muted block mt-0.5">Default standardized rate: ₦180,000</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">VEHICLE PURCHASE AMOUNT (₦) *</label>
                    <input
                      type="number"
                      value={drvCapitalValue}
                      onChange={(e) => setDrvCapitalValue(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none font-mono"
                    />
                    <span className="text-[9px] text-text-muted block mt-0.5">Default capital value: ₦15,000,000</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep(3)}
                    className="font-bold text-xs"
                  >
                    Go Back
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setWizardStep(5)}
                    className="font-bold text-xs text-slate-950"
                  >
                    Continue to Credentials
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Account Credentials */}
            {wizardStep === 5 && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase text-brand-navy">Step 5: Account Security Credentials</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">SYSTEM ACCOUNT EMAIL *</label>
                    <input
                      type="email"
                      placeholder="e.g. drivername@ruqayya.com"
                      value={drvEmail}
                      onChange={(e) => setDrvEmail(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block text-text-muted mb-0.5">PASSWORD (BLANK FOR DEFAULT)</label>
                    <input
                      type="password"
                      placeholder="Default: driver123"
                      value={drvPassword}
                      onChange={(e) => setDrvPassword(e.target.value)}
                      className="w-full bg-bg-base border border-border-main text-text-main px-3 py-1.5 text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 bg-bg-base p-3 rounded-lg border border-border-main/50">
                  <input
                    type="checkbox"
                    id="require_pass_reset"
                    checked={drvRequirePassChange}
                    onChange={(e) => setDrvRequirePassChange(e.target.checked)}
                    className="rounded text-brand-navy focus:ring-brand-navy cursor-pointer"
                  />
                  <label htmlFor="require_pass_reset" className="text-xs font-bold text-brand-navy cursor-pointer">
                    Require secure password reset upon first authentication session login
                  </label>
                </div>

                <div className="flex items-center justify-between mt-4 border-t border-border-main/30 pt-3">
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep(4)}
                    className="font-bold text-xs"
                  >
                    Go Back
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={submitDriverWizard}
                    isLoading={wizardLoading}
                    className="font-bold text-xs text-slate-950 px-6"
                  >
                    Finalize & Certify Driver Profile
                  </Button>
                </div>
              </div>
            )}

          </div>
        </Modal>
      )}

      {/* 2. REGISTER INVESTOR / SHAREHOLDER MODAL */}
      {isShareholderModalOpen && (
        <Modal onClose={() => setIsShareholderModalOpen(false)} title={lang === 'en' ? "Register Corporate Investor Node" : "Rajistar Mai Hannun Jari"}>
          <form onSubmit={submitShareholderForm} className="flex flex-col gap-4 p-2 max-w-lg">
            {shError && <Alert type="danger" onClose={() => setShError('')}>{shError}</Alert>}

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">INVESTOR FULL NAME *</label>
                <input
                  type="text"
                  placeholder="e.g. Alhaji Sani Abubakar"
                  value={shName}
                  onChange={(e) => setShName(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold block text-text-muted mb-0.5">PHONE NUMBER *</label>
                  <input
                    type="text"
                    placeholder="e.g. +234..."
                    value={shPhone}
                    onChange={(e) => setShPhone(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold block text-text-muted mb-0.5">EMAIL ADDRESS *</label>
                  <input
                    type="email"
                    placeholder="e.g. sani@ruqayyah.com"
                    value={shEmail}
                    onChange={(e) => setShEmail(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">RESIDENTIAL / CORPORATE ADDRESS</label>
                <input
                  type="text"
                  placeholder="e.g. 5 Hotoro G.R.A, Kano"
                  value={shAddress}
                  onChange={(e) => setShAddress(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold block text-text-muted mb-0.5">EQUITY INVESTMENT PRINCIPAL (₦) *</label>
                  <input
                    type="number"
                    value={shInvestment}
                    onChange={(e) => setShInvestment(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono font-bold text-brand-navy"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold block text-text-muted mb-0.5">PORTFOLIO DEPOSIT DATE *</label>
                  <input
                    type="date"
                    value={shJoinDate}
                    onChange={(e) => setShJoinDate(e.target.value)}
                    className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">INITIAL ACCESS PASSWORD</label>
                <input
                  type="password"
                  placeholder="Leave blank for: shareholder123"
                  value={shPassword}
                  onChange={(e) => setShPassword(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">PASSPORT PHOTO / LOGO</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setShPassportBase64)}
                  className="w-full text-xs text-text-muted"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 border-t border-border-main/40 pt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsShareholderModalOpen(false)}
                className="font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                type="submit"
                isLoading={shLoading}
                className="font-bold text-xs text-slate-950 px-6"
              >
                Onboard Investor Node
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. CLOUDFLARE R2 UPLOAD DOCUMENT MODAL */}
      {isUploadDocModalOpen && (
        <Modal onClose={() => setIsUploadDocModalOpen(false)} title={lang === 'en' ? "Archive File in Cloudflare R2" : "Dora Sabuwar Takarda"}>
          <form onSubmit={handleDocumentUpload} className="flex flex-col gap-4 p-2 max-w-md">
            {docUploadError && <Alert type="danger" onClose={() => setDocUploadError('')}>{docUploadError}</Alert>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">FILE TITLE *</label>
                <input
                  type="text"
                  placeholder="e.g. Shacman Carriage Reg Cert"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">DOCUMENT CATEGORY TYPE</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  <option value="passport_photo">Passport Photo</option>
                  <option value="driver_license">Driver's License File</option>
                  <option value="guarantor_form">Guarantor Certification Form</option>
                  <option value="vehicle_registration">Vehicle Registration Paper</option>
                  <option value="shareholder_agreement">Shareholder Agreement Node</option>
                  <option value="corporate_resolution">Corporate Resolution Ledger</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">LINK TO ACTIVE DRIVER (OPTIONAL)</label>
                <select
                  value={docDriverId}
                  onChange={(e) => setDocDriverId(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  <option value="">-- No Driver Link (Corporate Resolution) --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">LINK TO FLEET RIG (OPTIONAL)</label>
                <select
                  value={docVehicleId}
                  onChange={(e) => setDocVehicleId(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  <option value="">-- No Rig Link (General Archive) --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plateNumber} ({v.brand})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">CHOOSE SECURE PDF / IMAGE FILE *</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileChange(e, setDocFileBase64)}
                  className="w-full text-xs text-text-muted"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 border-t border-border-main/40 pt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsUploadDocModalOpen(false)}
                className="font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                type="submit"
                isLoading={docUploadLoading}
                className="font-bold text-xs text-slate-950 px-6"
              >
                Commit to R2 Storage
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. ROSTER DECISION INTERVIEW BOX FOR PENDING CANDIDATES */}
      {isReviewModalOpen && reviewDriver && (
        <Modal onClose={() => { setIsReviewModalOpen(false); setReviewDriver(null); }} title="Enterprise Roster Verification Review">
          <div className="flex flex-col gap-4 p-2 max-w-md">
            <div className="flex items-center gap-3 bg-bg-base p-3 rounded-xl border border-border-main/40">
              <img
                src={reviewDriver.passport_photo_url || reviewDriver.passportPhoto || reviewDriver.passport_photo || reviewDriver.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'}
                alt={reviewDriver.fullName}
                className="h-12 w-12 rounded-full border border-border-main/50 object-cover"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="font-extrabold text-brand-navy block text-sm">{reviewDriver.fullName}</span>
                <span className="text-xs text-text-muted font-mono block"> proposto: Smart Carrier Class</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">ASSIGN RTL CORPORATE DRIVER ID *</label>
                <input
                  type="text"
                  value={reviewCompanyId}
                  onChange={(e) => setReviewCompanyId(e.target.value)}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none font-mono font-bold text-brand-navy"
                  placeholder="e.g. RTL-DRV-001"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold block text-text-muted mb-0.5">ADMINISTRATIVE DECISION REMARKS / COMMENTS</label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  rows={3}
                  className="w-full bg-bg-base border border-border-main text-text-main px-3 py-2 text-xs rounded-lg focus:outline-none"
                  placeholder="Add remarks regarding document verification, license, background check..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-4 border-t border-border-main/40 pt-3 flex-wrap">
              <Button
                variant="ghost"
                type="button"
                onClick={() => handleReviewDecision('rejected')}
                isLoading={reviewActionLoading}
                className="font-bold text-xs text-red-600 hover:bg-red-50 border border-transparent"
              >
                Reject Node
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleReviewDecision('correction_requested')}
                  isLoading={reviewActionLoading}
                  className="font-bold text-xs"
                >
                  Correction Req
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => handleReviewDecision('approved')}
                  isLoading={reviewActionLoading}
                  className="font-bold text-xs text-slate-950 px-5"
                >
                  Certify & Approve
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. 360° DRIVER PROFILE MODAL */}
      {selectedDriverFor360 && (
        <Modal onClose={() => setSelectedDriverFor360(null)} title={`${selectedDriverFor360.fullName} - 360° Corporate Dossier`}>
          <div className="flex flex-col gap-4 p-2 max-w-2xl text-text-main">
            <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-border-main/40 pb-4">
              <img
                src={selectedDriverFor360.passport_photo_url || selectedDriverFor360.passportPhoto || selectedDriverFor360.passport_photo || selectedDriverFor360.documents?.find((doc: any) => doc.document_type === 'passport_photo')?.file_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                alt={selectedDriverFor360.fullName}
                className="h-20 w-20 rounded-full border border-border-main shadow-sm object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-brand-navy">{selectedDriverFor360.fullName}</h3>
                  <Badge variant="success">{(selectedDriverFor360.status || 'ACTIVE').toUpperCase()}</Badge>
                </div>
                <p className="text-xs font-mono text-text-muted mt-1">
                  Corporate ID: {selectedDriverFor360.companyDriverId || 'N/A'} | Type: {selectedDriverFor360.classification || 'Assisted'}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">Joined on: {selectedDriverFor360.created_at ? selectedDriverFor360.created_at.substring(0, 10) : 'N/A'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal details card */}
              <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-brand-navy block uppercase">Identity & Contact Profile</span>
                <div className="text-xs flex flex-col gap-1.5 font-medium">
                  <div><span className="text-text-muted">Telephone:</span> <span className="font-mono">{selectedDriverFor360.phone}</span></div>
                  <div><span className="text-text-muted">Email:</span> <span className="font-mono">{selectedDriverFor360.email}</span></div>
                  <div><span className="text-text-muted">NIN:</span> <span className="font-mono">{selectedDriverFor360.nin || 'N/A'}</span></div>
                  <div><span className="text-text-muted">Address:</span> <span>{selectedDriverFor360.address}</span></div>
                </div>
              </div>

              {/* Lease properties card */}
              <div className="bg-bg-base/40 p-4 rounded-xl border border-border-main/50 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-brand-navy block uppercase">Lease & Amortization Position</span>
                <div className="text-xs flex flex-col gap-1.5 font-medium">
                  <div><span className="text-text-muted">Agreed 30 Cycle Amount to Bring to Company:</span> <span className="font-mono font-bold text-brand-navy">₦{(selectedDriverFor360.agreedAmount || 180000).toLocaleString()}</span></div>
                  <div><span className="text-text-muted">Vehicle Purchase Amount:</span> <span className="font-mono text-text-main">₦{(selectedDriverFor360.vehiclePurchasePrice || 15000000).toLocaleString()}</span></div>
                  <div><span className="text-text-muted">Outstanding Balance:</span> <span className="font-mono font-black text-brand-navy">₦{(selectedDriverFor360.remainingVehicleBalance || 15000000).toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border-main/30">
              <Button
                variant="outline"
                onClick={() => setSelectedDriverFor360(null)}
                className="font-bold text-xs"
              >
                Close Dossier
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. EARNINGS LEDGER FLYOUT FOR SHAREHOLDER */}
      {selectedShareholderLedger && (
        <Modal onClose={() => setSelectedShareholderLedger(null)} title={`${selectedShareholderLedger.full_name} - Investment Wallet`}>
          <div className="flex flex-col gap-4 p-2 max-w-lg">
            <div className="bg-gradient-to-br from-brand-navy to-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-300 font-bold block">Dynamic Investment Wallet</span>
                <span className="text-xl font-black mt-1 font-mono text-brand-gold">₦{selectedShareholderLedger.investment_amount.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase text-slate-300 font-bold block">Equity Holding</span>
                <span className="text-lg font-black text-emerald-400 mt-1 block font-mono">
                  {((selectedShareholderLedger.investment_amount / totalShareholderCapital) * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-brand-navy block uppercase">Historic Financial Events Ledger</span>
              <div className="border border-border-main/50 rounded-lg overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-bg-base p-2 font-bold text-text-muted text-[10px] uppercase">
                  <span>Event Category</span>
                  <span className="text-center">Date Filed</span>
                  <span className="text-right">Amount (₦)</span>
                </div>
                <div className="divide-y divide-border-main/40 max-h-[180px] overflow-y-auto font-medium">
                  <div className="grid grid-cols-3 p-2">
                    <span className="text-emerald-600 font-bold">Capital Invested</span>
                    <span className="text-center text-text-muted font-mono">{selectedShareholderLedger.investment_date}</span>
                    <span className="text-right font-mono font-bold">+{selectedShareholderLedger.investment_amount.toLocaleString()}</span>
                  </div>
                  {/* Any simulated cycle payouts */}
                  <div className="grid grid-cols-3 p-2 bg-bg-base/20">
                    <span className="text-brand-navy font-bold">Earnings Disbursed</span>
                    <span className="text-center text-text-muted font-mono">Cycle Closed</span>
                    <span className="text-right font-mono text-text-muted">Dynamic Pool Split</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-border-main/40">
              <Button
                variant="outline"
                onClick={() => setSelectedShareholderLedger(null)}
                className="font-bold text-xs"
              >
                Close Ledger
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. SECURE R2 FILE PREVIEW MODAL */}
      {selectedDocumentPreview && (
        <Modal onClose={() => setSelectedDocumentPreview(null)} title={selectedDocumentPreview.title}>
          <div className="flex flex-col gap-4 p-2 max-w-lg items-center text-center text-text-main">
            <div className="w-full bg-slate-900 aspect-video rounded-xl border border-slate-800 flex items-center justify-center p-4 overflow-hidden relative">
              {selectedDocumentPreview.file_url.startsWith('data:image/') || selectedDocumentPreview.file_url.includes('unsplash.com') ? (
                <img
                  src={selectedDocumentPreview.file_url}
                  alt={selectedDocumentPreview.title}
                  className="max-h-full max-w-full rounded object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-white">
                  <FileText className="h-12 w-12 text-brand-gold animate-bounce" />
                  <span className="text-xs font-bold font-mono text-slate-300">Secure Encrypted PDF Vault Container</span>
                </div>
              )}
            </div>

            <div className="w-full text-left bg-bg-base/50 p-3 rounded-lg border border-border-main/50 text-xs font-medium">
              <div><span className="text-text-muted uppercase text-[9px] font-bold block">Document Type ID</span> <span className="font-mono text-brand-navy">{selectedDocumentPreview.id}</span></div>
              <div className="mt-2"><span className="text-text-muted uppercase text-[9px] font-bold block">Category Folder</span> <span className="font-semibold text-text-main">{selectedDocumentPreview.category.toUpperCase()}</span></div>
              <div className="mt-2"><span className="text-text-muted uppercase text-[9px] font-bold block">Verification State</span> <span className="text-emerald-600 font-bold">Verified by {selectedDocumentPreview.verified_by || 'System'}</span></div>
            </div>

            <div className="flex justify-end w-full mt-4 border-t border-border-main/30 pt-3">
              <Button
                variant="outline"
                onClick={() => setSelectedDocumentPreview(null)}
                className="font-bold text-xs"
              >
                Dismiss Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
